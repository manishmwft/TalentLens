import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';
import InterviewRecorder from '../../components/candidate/InterviewRecorder.jsx';
import {
  getCandidateInterviewSession,
  recordCandidateIntegrityEvent,
  startCandidateInterview,
  submitCandidateInterviewAnswer,
} from '../../services/candidatePortalService.js';

const finishedStatuses = new Set([
  'processing',
  'completed',
]);

export default function CandidateAutomatedInterviewPage() {
  const { interviewId } =
    useParams();

  const navigate = useNavigate();

  const [session, setSession] =
    useState(null);

  const [recording, setRecording] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [progress, setProgress] =
    useState(0);

  const [error, setError] =
    useState('');

  const [uploadFailed, setUploadFailed] =
    useState(false);

  const submissionIdRef =
    useRef('');

  const inactivityRef =
    useRef(null);

  const lastEventRef =
    useRef(new Map());

  const sendIntegrity = useCallback(
    (type, metadata = {}) => {
      const now = Date.now();

      const previous =
        lastEventRef.current.get(
          type,
        ) || 0;

      if (now - previous < 3000) {
        return;
      }

      lastEventRef.current.set(
        type,
        now,
      );

      recordCandidateIntegrityEvent(
        interviewId,
        { type, metadata },
      ).catch(() => {});
    },
    [interviewId],
  );

  const load = useCallback(
    async () => {
      try {
        setLoading(true);
        setError('');

        let data =
          await getCandidateInterviewSession(
            interviewId,
          );

        // Build 5.5I: READY means preparation is complete but the
        // interview clock has not started. Explicitly transition it
        // before displaying the recorder.
        if (data.status === 'ready') {
          data =
            await startCandidateInterview(
              interviewId,
            );
        }

        if (
          finishedStatuses.has(
            data.status,
          ) ||
          !data.question
        ) {
          navigate(
            `/candidate/interviews/${interviewId}/submitted`,
            { replace: true },
          );
          return;
        }

        if (
          data.status !==
          'in_progress'
        ) {
          throw new Error(
            `Interview session is in unexpected state: ${data.status}`,
          );
        }

        setSession(data);
        setRecording(null);
        submissionIdRef.current =
          '';
        setUploadFailed(false);
        setProgress(0);
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            requestError.message ||
            'Unable to start the interview session.',
        );
      } finally {
        setLoading(false);
      }
    },
    [interviewId, navigate],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (
      !session ||
      session.status !==
        'in_progress'
    ) {
      return undefined;
    }

    const visibility = () => {
      if (document.hidden) {
        sendIntegrity(
          'tab_hidden',
          { hidden: true },
        );
      }
    };

    const blur = () =>
      sendIntegrity('window_blur');

    const focus = () =>
      sendIntegrity('window_focus');

    const offline = () =>
      sendIntegrity(
        'network_disconnected',
      );

    const online = () =>
      sendIntegrity(
        'network_reconnected',
      );

    const activity = () => {
      clearTimeout(
        inactivityRef.current,
      );

      inactivityRef.current =
        setTimeout(
          () =>
            sendIntegrity(
              'inactivity',
              { seconds: 60 },
            ),
          60000,
        );
    };

    document.addEventListener(
      'visibilitychange',
      visibility,
    );

    window.addEventListener(
      'blur',
      blur,
    );

    window.addEventListener(
      'focus',
      focus,
    );

    window.addEventListener(
      'offline',
      offline,
    );

    window.addEventListener(
      'online',
      online,
    );

    const activityEvents = [
      'mousemove',
      'keydown',
      'click',
      'touchstart',
    ];

    activityEvents.forEach(
      (event) =>
        window.addEventListener(
          event,
          activity,
          { passive: true },
        ),
    );

    activity();

    return () => {
      clearTimeout(
        inactivityRef.current,
      );

      document.removeEventListener(
        'visibilitychange',
        visibility,
      );

      window.removeEventListener(
        'blur',
        blur,
      );

      window.removeEventListener(
        'focus',
        focus,
      );

      window.removeEventListener(
        'offline',
        offline,
      );

      window.removeEventListener(
        'online',
        online,
      );

      activityEvents.forEach(
        (event) =>
          window.removeEventListener(
            event,
            activity,
          ),
      );
    };
  }, [session, sendIntegrity]);

  useEffect(() => {
    const warnBeforeUnload = (
      event,
    ) => {
      if (!submitting) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener(
      'beforeunload',
      warnBeforeUnload,
    );

    return () =>
      window.removeEventListener(
        'beforeunload',
        warnBeforeUnload,
      );
  }, [submitting]);

  function createSubmissionId() {
    if (
      globalThis.crypto?.randomUUID
    ) {
      return globalThis.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}-${Math.random()
      .toString(36)
      .slice(2)}`;
  }

  function handleRecordingReady(
    value,
  ) {
    setRecording(value);

    submissionIdRef.current =
      createSubmissionId();

    setUploadFailed(false);
    setProgress(0);
    setError('');
  }

  async function submit() {
    if (
      !recording ||
      !session?.question ||
      submitting
    ) {
      return;
    }

    if (!navigator.onLine) {
      setUploadFailed(true);

      setError(
        'You are offline. Reconnect and retry the same upload.',
      );

      return;
    }

    submissionIdRef.current ||=
      createSubmissionId();

    try {
      setSubmitting(true);
      setError('');

      const result =
        await submitCandidateInterviewAnswer(
          interviewId,
          session.question.id,
          recording,
          submissionIdRef.current,
          setProgress,
        );

      if (result.completed) {
        navigate(
          result.nextRoute ||
            `/candidate/interviews/${interviewId}/submitted`,
          { replace: true },
        );

        return;
      }

      if (
        result.session?.status ===
          'ready'
      ) {
        result.session =
          await startCandidateInterview(
            interviewId,
          );
      }

      setSession(result.session);
      setRecording(null);

      submissionIdRef.current =
        '';

      setUploadFailed(false);
      setProgress(0);
    } catch (requestError) {
      setUploadFailed(true);

      const message =
        requestError.response?.data
          ?.message ||
        (requestError.code ===
          'ERR_NETWORK'
          ? 'The backend connection was interrupted. Confirm the backend is running, then retry the same upload.'
          : '') ||
        'Unable to upload your answer. Your recording is still available—retry the upload.';

      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Panel>
        Preparing your secure interview
        session…
      </Panel>
    );
  }

  if (error && !session) {
    return (
      <Panel tone="error">
        {error}
      </Panel>
    );
  }

  if (!session?.question) {
    return (
      <Panel>
        No interview question is
        available.
      </Panel>
    );
  }

  const completed =
    session.completedQuestions || 0;

  const percent = Math.round(
    (completed /
      session.totalQuestions) *
      100,
  );

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 rounded-3xl border border-slate-800 bg-[#0b1220] p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <span className="text-xs font-black uppercase tracking-[.2em] text-brand-400">
              Automated AI interview
            </span>

            <h1 className="mt-2 text-2xl font-black sm:text-3xl">
              {session.title}
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Question{' '}
              {session.question.number} of{' '}
              {session.question.total}.
              Answer naturally and keep your
              camera and microphone enabled.
            </p>
          </div>

          <div className="min-w-[220px]">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>
                Interview progress
              </span>

              <span>{percent}%</span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{
                  width: `${percent}%`,
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-5 sm:p-7">
          <div className="mb-6 rounded-2xl border border-brand-500/20 bg-brand-500/[.07] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-500/15 px-3 py-1 text-xs font-black uppercase text-brand-300">
                {session.question.category?.replaceAll(
                  '_',
                  ' ',
                )}
              </span>

              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black uppercase text-slate-400">
                {session.question.difficulty}
              </span>
            </div>

            <h2 className="mt-4 text-xl font-black leading-8 text-white sm:text-2xl">
              {session.question.question}
            </h2>
          </div>

          <InterviewRecorder
            key={session.question.id}
            requireAudio={
              session.config.requireAudio
            }
            requireVideo={
              session.config.requireVideo
            }
            preparationSeconds={
              session.config
                .preparationTimeSeconds
            }
            answerSeconds={
              session.config
                .questionTimeSeconds
            }
            maxRecordingSeconds={
              session.config
                .maxRecordingSeconds
            }
            maxRetries={
              session.config
                .maxRetriesPerQuestion
            }
            onReadyToSubmit={
              handleRecordingReady
            }
            onIntegrityEvent={
              sendIntegrity
            }
          />

          {error && (
            <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          )}

          {submitting && (
            <div className="mt-5 rounded-2xl border border-brand-500/30 bg-brand-500/10 p-4">
              <div className="flex items-center justify-between text-xs font-black text-brand-200">
                <span>
                  Securely uploading audio
                  and video
                </span>

                <span>{progress}%</span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-brand-400 transition-all"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <p className="mt-2 text-xs text-slate-400">
                Keep this page open. You
                will advance only after the
                server verifies both
                recordings.
              </p>
            </div>
          )}

          {recording && (
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className={`mt-6 w-full rounded-xl px-5 py-3.5 text-sm font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60 ${
                uploadFailed
                  ? 'bg-amber-500 hover:bg-amber-400'
                  : 'bg-brand-500 hover:bg-brand-400'
              }`}
            >
              {submitting
                ? `Uploading answer… ${progress}%`
                : uploadFailed
                  ? 'Retry the same upload'
                  : session.question.number ===
                      session.question.total
                    ? 'Submit final answer'
                    : 'Submit answer and continue'}
            </button>
          )}
        </section>

        <aside className="space-y-5">
          <Card title="Session rules">
            <Rule
              label="Question timer"
              value={`${session.config.questionTimeSeconds}s`}
            />

            <Rule
              label="Preparation"
              value={`${session.config.preparationTimeSeconds}s`}
            />

            <Rule
              label="Recording retry"
              value={`${session.config.maxRetriesPerQuestion}`}
            />

            <Rule
              label="Audio"
              value={
                session.config.requireAudio
                  ? 'Required'
                  : 'Optional'
              }
            />

            <Rule
              label="Video"
              value={
                session.config.requireVideo
                  ? 'Required'
                  : 'Optional'
              }
            />
          </Card>

          <Card title="Integrity monitoring">
            <p className="text-sm leading-6 text-slate-400">
              Tab changes, window focus,
              inactivity, network
              interruptions, camera, and
              microphone availability are
              logged for authorized staff
              review. These signals do not
              automatically reject you.
            </p>
          </Card>

          <Card title="Important">
            <ul className="space-y-2 text-sm leading-6 text-slate-400">
              <li>
                • Do not refresh while
                recording.
              </li>

              <li>
                • Submitted answers cannot
                be changed.
              </li>

              <li>
                • Keep your face visible
                and speak clearly.
              </li>

              <li>
                • Your final result is
                reviewed by hiring staff.
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5">
      <h3 className="text-sm font-black text-white">
        {title}
      </h3>

      <div className="mt-4">
        {children}
      </div>
    </section>
  );
}

function Rule({
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 py-2.5 text-sm last:border-0">
      <span className="text-slate-500">
        {label}
      </span>

      <strong>{value}</strong>
    </div>
  );
}

function Panel({
  children,
  tone = 'default',
}) {
  return (
    <div
      className={`rounded-2xl border p-8 text-center text-sm font-bold ${
        tone === 'error'
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
          : 'border-slate-800 bg-[#0b1220] text-slate-400'
      }`}
    >
      {children}
    </div>
  );
}
