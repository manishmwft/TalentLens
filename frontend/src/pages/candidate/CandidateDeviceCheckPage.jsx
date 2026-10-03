import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PreparationProgress from '../../components/candidate/PreparationProgress.jsx';
import { getCandidateInterview, saveCandidateDeviceCheck } from '../../services/candidatePortalService.js';

function initialChecks() {
  return {
    browserSupported: Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder),
    connectionPassed: navigator.onLine,
    microphonePassed: false,
    cameraPassed: false,
    speakerPassed: false,
  };
}

export default function CandidateDeviceCheckPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationRef = useRef(null);
  const [interview, setInterview] = useState(null);
  const [checks, setChecks] = useState(initialChecks);
  const [micLevel, setMicLevel] = useState(0);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getCandidateInterview(interviewId).then((data) => {
      setInterview(data);
      if (!data.preparation?.consentComplete) navigate(`/candidate/interviews/${interviewId}/consent`, { replace: true });
      else if (data.preparation?.deviceCheckComplete) navigate(`/candidate/interviews/${interviewId}/instructions`, { replace: true });
    }).catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load device-check details.'));

    const online = () => setChecks((current) => ({ ...current, connectionPassed: true }));
    const offline = () => setChecks((current) => ({ ...current, connectionPassed: false }));
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      stopMedia();
    };
  }, [interviewId, navigate]);

  function stopMedia() {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
  }

  async function runCameraMicrophoneTest() {
    setTesting(true); setError(''); stopMedia();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: interview?.requireAudio !== false,
        video: interview?.requireVideo !== false ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const microphonePassed = !interview?.requireAudio || stream.getAudioTracks().some((track) => track.readyState === 'live' && track.enabled);
      const cameraPassed = !interview?.requireVideo || stream.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled);
      setChecks((current) => ({ ...current, microphonePassed, cameraPassed }));

      if (stream.getAudioTracks().length) {
        const context = new AudioContext();
        audioContextRef.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(stream).connect(analyser);
        const values = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
          analyser.getByteFrequencyData(values);
          setMicLevel(Math.min(100, Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 1.8)));
          animationRef.current = requestAnimationFrame(draw);
        };
        draw();
      }
    } catch (mediaError) {
      setChecks((current) => ({ ...current, microphonePassed: false, cameraPassed: false }));
      setError(mediaError.name === 'NotAllowedError' ? 'Camera or microphone permission was denied. Allow access in your browser settings and try again.' : mediaError.message || 'Unable to access camera and microphone.');
    } finally { setTesting(false); }
  }

  async function testSpeaker() {
    setError('');
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 660;
      gain.gain.value = 0.08;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.45);
      setTimeout(() => context.close(), 700);
      setChecks((current) => ({ ...current, speakerPassed: true }));
    } catch {
      setError('Unable to play the speaker test. Check your browser audio settings.');
    }
  }

  const requiredPassed = checks.browserSupported && checks.connectionPassed && checks.speakerPassed
    && (!interview?.requireAudio || checks.microphonePassed)
    && (!interview?.requireVideo || checks.cameraPassed);

  async function continueNext() {
    if (!requiredPassed || saving) return;
    setSaving(true); setError('');
    try {
      await saveCandidateDeviceCheck(interviewId, {
        ...checks,
        metadata: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          screen: `${window.screen.width}x${window.screen.height}`,
          connectionType: navigator.connection?.effectiveType || '',
        },
      });
      stopMedia();
      navigate(`/candidate/interviews/${interviewId}/instructions`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Device check failed.');
    } finally { setSaving(false); }
  }

  if (!interview) return <Panel>{error || 'Loading device check…'}</Panel>;

  return (
    <div className="mx-auto max-w-5xl">
      <Link to={`/candidate/interviews/${interviewId}/consent`} className="text-sm font-bold text-brand-400">← Back to consent</Link>
      <section className="mt-5 rounded-3xl border border-slate-800 bg-[#0b1220] p-6 sm:p-8">
        <span className="text-xs font-black uppercase tracking-[.18em] text-brand-400">Step 2 of 3</span>
        <h1 className="mt-3 text-3xl font-black">Device and connection check</h1>
        <p className="mt-3 text-sm leading-7 text-slate-400">Allow access and verify that your browser, camera, microphone, speakers, and connection are ready.</p>
        <div className="mt-6"><PreparationProgress preparation={interview.preparation} compact /></div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-6">
          <div className="aspect-video overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500"><span>Microphone level</span><span>{micLevel}%</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${micLevel}%` }} /></div>
          </div>
          <button onClick={runCameraMicrophoneTest} disabled={testing} className="mt-5 w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-black text-white hover:bg-brand-600 disabled:opacity-60">{testing ? 'Requesting access…' : 'Test camera and microphone'}</button>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-6">
          <h2 className="text-lg font-black">System checks</h2>
          <div className="mt-5 space-y-3">
            <Check label="Supported browser" passed={checks.browserSupported} />
            <Check label="Internet connection" passed={checks.connectionPassed} />
            <Check label="Microphone" passed={checks.microphonePassed} required={interview.requireAudio} />
            <Check label="Camera" passed={checks.cameraPassed} required={interview.requireVideo} />
            <Check label="Speakers" passed={checks.speakerPassed} />
          </div>
          <button onClick={testSpeaker} className="mt-5 w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-black text-slate-300 hover:border-slate-500 hover:text-white">Play speaker test</button>
          {error && <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm leading-6 text-rose-300">{error}</div>}
          <button onClick={continueNext} disabled={!requiredPassed || saving} className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-black text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">{saving ? 'Saving checks…' : 'Save and continue'}</button>
        </section>
      </div>
    </div>
  );
}

function Check({ label, passed, required = true }) { return <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3"><span className="text-sm font-bold">{label}{!required && <span className="ml-2 text-xs font-normal text-slate-600">Optional</span>}</span><span className={`rounded-full px-2.5 py-1 text-xs font-black ${passed || !required ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>{passed ? 'Passed' : !required ? 'Not required' : 'Required'}</span></div>; }
function Panel({ children }) { return <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8 text-center text-sm font-bold text-slate-400">{children}</div>; }
