import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

function supportedMime(candidates) {
  return (
    candidates.find((type) =>
      globalThis.MediaRecorder?.isTypeSupported?.(type),
    ) || ''
  );
}

function stopTracks(stream) {
  stream?.getTracks?.().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Ignore already-stopped tracks.
    }
  });
}

function revokeUrl(value) {
  if (value) {
    URL.revokeObjectURL(value);
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

async function createProcessedAudioStream(sourceStream) {
  const sourceTrack = sourceStream.getAudioTracks()[0];

  if (!sourceTrack) {
    return {
      stream: null,
      context: null,
    };
  }

  const AudioContextClass =
    globalThis.AudioContext ||
    globalThis.webkitAudioContext;

  if (!AudioContextClass) {
    return {
      stream: new MediaStream([sourceTrack.clone()]),
      context: null,
    };
  }

  const context = new AudioContextClass({
    latencyHint: 'interactive',
    sampleRate: 48_000,
  });

  await context.resume();

  const inputStream = new MediaStream([
    sourceTrack.clone(),
  ]);

  const source =
    context.createMediaStreamSource(inputStream);

  // Remove low-frequency rumble and desk vibration.
  const highPass = context.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 85;
  highPass.Q.value = 0.7;

  // Prevent sudden volume spikes and improve speech consistency.
  const compressor =
    context.createDynamicsCompressor();

  compressor.threshold.value = -24;
  compressor.knee.value = 18;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.006;
  compressor.release.value = 0.22;

  const gain = context.createGain();
  gain.gain.value = 0.95;

  const destination =
    context.createMediaStreamDestination();

  source
    .connect(highPass)
    .connect(compressor)
    .connect(gain)
    .connect(destination);

  return {
    stream: destination.stream,
    context,
  };
}

function waitForRecorderStop(recorder, chunks, fallbackType) {
  return new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = (event) => {
      reject(
        event.error ||
          new Error('Media recorder failed.'),
      );
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, {
        type:
          recorder.mimeType ||
          fallbackType,
      });

      resolve(blob);
    };
  });
}

function stopRecorder(recorder) {
  if (!recorder) {
    return;
  }

  if (recorder.state === 'recording') {
    try {
      // Ask the browser to flush its final encoded data before stop.
      recorder.requestData?.();
    } catch {
      // Some browsers throw when requestData is too close to stop.
    }

    recorder.stop();
  }
}

export default function InterviewRecorder({
  requireAudio,
  requireVideo,
  preparationSeconds,
  answerSeconds,
  maxRecordingSeconds,
  maxRetries,
  onReadyToSubmit,
  onIntegrityEvent,
}) {
  const liveVideoRef = useRef(null);
  const reviewVideoRef = useRef(null);
  const reviewAudioRef = useRef(null);

  const sourceStreamRef = useRef(null);
  const videoOnlyStreamRef = useRef(null);
  const processedAudioStreamRef = useRef(null);
  const audioContextRef = useRef(null);

  const audioRecorderRef = useRef(null);
  const videoRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const stoppingRef = useRef(false);

  const [phase, setPhase] =
    useState('requesting');

  const [preparationLeft, setPreparationLeft] =
    useState(preparationSeconds);

  const [timeLeft, setTimeLeft] = useState(
    Math.min(
      answerSeconds,
      maxRecordingSeconds,
    ),
  );

  const [audioBlob, setAudioBlob] =
    useState(null);

  const [videoBlob, setVideoBlob] =
    useState(null);

  const [audioUrl, setAudioUrl] =
    useState('');

  const [videoUrl, setVideoUrl] =
    useState('');

  const [retryCount, setRetryCount] =
    useState(0);

  const [error, setError] =
    useState('');

  const [expired, setExpired] =
    useState(false);

  const [quality, setQuality] =
    useState(null);

  const [actualDuration, setActualDuration] =
    useState(0);

  const clearPreviewUrls = useCallback(() => {
    setAudioUrl((current) => {
      revokeUrl(current);
      return '';
    });

    setVideoUrl((current) => {
      revokeUrl(current);
      return '';
    });
  }, []);

  const stopReviewPlayback = useCallback(
    (except = '') => {
      const video = reviewVideoRef.current;
      const audio = reviewAudioRef.current;

      if (except !== 'video' && video) {
        video.pause();
        video.currentTime = Math.min(
          video.currentTime,
          video.duration || 0,
        );
      }

      if (except !== 'audio' && audio) {
        audio.pause();
        audio.currentTime = Math.min(
          audio.currentTime,
          audio.duration || 0,
        );
      }
    },
    [],
  );

  const releaseRecorderStreams =
    useCallback(() => {
      stopTracks(videoOnlyStreamRef.current);
      stopTracks(
        processedAudioStreamRef.current,
      );

      videoOnlyStreamRef.current = null;
      processedAudioStreamRef.current = null;

      if (audioContextRef.current) {
        audioContextRef.current
          .close()
          .catch(() => {});

        audioContextRef.current = null;
      }
    }, []);

  const finishRecording = useCallback(
    async ({ timerExpired = false } = {}) => {
      if (
        stoppingRef.current ||
        phase !== 'recording'
      ) {
        return;
      }

      stoppingRef.current = true;
      clearInterval(timerRef.current);
      setExpired(timerExpired);
      setPhase('processing');

      const audioRecorder =
        audioRecorderRef.current;

      const videoRecorder =
        videoRecorderRef.current;

      const pending = [];

      if (audioRecorder) {
        pending.push(
          audioRecorder._completionPromise,
        );
      }

      if (videoRecorder) {
        pending.push(
          videoRecorder._completionPromise,
        );
      }

      stopRecorder(audioRecorder);
      stopRecorder(videoRecorder);

      try {
        const blobs = await Promise.all(
          pending,
        );

        let nextAudioBlob = null;
        let nextVideoBlob = null;

        for (const blob of blobs) {
          if (blob.type.startsWith('audio/')) {
            nextAudioBlob = blob;
          } else if (
            blob.type.startsWith('video/')
          ) {
            nextVideoBlob = blob;
          }
        }

        const elapsedSeconds = Math.max(
          1,
          Math.round(
            (Date.now() -
              startedAtRef.current) /
              1_000,
          ),
        );

        if (
          requireAudio &&
          (!nextAudioBlob ||
            nextAudioBlob.size < 1_000)
        ) {
          throw new Error(
            'The audio recording is empty. Check microphone access and record again.',
          );
        }

        if (
          requireVideo &&
          (!nextVideoBlob ||
            nextVideoBlob.size < 10_000)
        ) {
          throw new Error(
            'The video recording is empty. Check camera access and record again.',
          );
        }

        clearPreviewUrls();

        setAudioBlob(nextAudioBlob);
        setVideoBlob(nextVideoBlob);

        setAudioUrl(
          nextAudioBlob
            ? URL.createObjectURL(
                nextAudioBlob,
              )
            : '',
        );

        setVideoUrl(
          nextVideoBlob
            ? URL.createObjectURL(
                nextVideoBlob,
              )
            : '',
        );

        setActualDuration(elapsedSeconds);
        setPhase('review');

        onReadyToSubmit?.({
          audioBlob: nextAudioBlob,
          videoBlob: nextVideoBlob,
          audioMimeType:
            nextAudioBlob?.type || '',
          videoMimeType:
            nextVideoBlob?.type || '',
          elapsedSeconds,
          retryCount,
          expired: timerExpired,
          quality,
        });
      } catch (recordingError) {
        setError(
          recordingError?.message ||
            'Unable to finalize the recording.',
        );

        setPhase('error');
      } finally {
        stoppingRef.current = false;
        releaseRecorderStreams();
      }
    },
    [
      clearPreviewUrls,
      onReadyToSubmit,
      phase,
      quality,
      releaseRecorderStreams,
      requireAudio,
      requireVideo,
      retryCount,
    ],
  );

  const beginRecording = useCallback(
    async () => {
      const sourceStream =
        sourceStreamRef.current;

      if (!sourceStream) {
        setError(
          'Camera and microphone stream is not available.',
        );
        setPhase('error');
        return;
      }

      try {
        setError('');
        setAudioBlob(null);
        setVideoBlob(null);
        setActualDuration(0);
        setExpired(false);

        releaseRecorderStreams();

        if (requireVideo) {
          const sourceVideoTrack =
            sourceStream.getVideoTracks()[0];

          if (!sourceVideoTrack) {
            throw new Error(
              'Required camera track is unavailable.',
            );
          }

          const clonedVideoTrack =
            sourceVideoTrack.clone();

          videoOnlyStreamRef.current =
            new MediaStream([
              clonedVideoTrack,
            ]);

          const videoMimeType =
            supportedMime([
              'video/webm;codecs=vp9',
              'video/webm;codecs=vp8',
              'video/webm',
            ]);

          const videoOptions = {
            videoBitsPerSecond: 2_500_000,
          };

          if (videoMimeType) {
            videoOptions.mimeType =
              videoMimeType;
          }

          const videoRecorder =
            new MediaRecorder(
              videoOnlyStreamRef.current,
              videoOptions,
            );

          const videoChunks = [];

          videoRecorder._completionPromise =
            waitForRecorderStop(
              videoRecorder,
              videoChunks,
              videoMimeType ||
                'video/webm',
            );

          videoRecorderRef.current =
            videoRecorder;
        }

        if (requireAudio) {
          const processed =
            await createProcessedAudioStream(
              sourceStream,
            );

          if (
            !processed.stream?.getAudioTracks()
              ?.length
          ) {
            throw new Error(
              'Required microphone track is unavailable.',
            );
          }

          processedAudioStreamRef.current =
            processed.stream;

          audioContextRef.current =
            processed.context;

          const audioMimeType =
            supportedMime([
              'audio/webm;codecs=opus',
              'audio/ogg;codecs=opus',
              'audio/webm',
              'audio/ogg',
            ]);

          const audioOptions = {
            audioBitsPerSecond: 128_000,
          };

          if (audioMimeType) {
            audioOptions.mimeType =
              audioMimeType;
          }

          const audioRecorder =
            new MediaRecorder(
              processedAudioStreamRef.current,
              audioOptions,
            );

          const audioChunks = [];

          audioRecorder._completionPromise =
            waitForRecorderStop(
              audioRecorder,
              audioChunks,
              audioMimeType ||
                'audio/webm',
            );

          audioRecorderRef.current =
            audioRecorder;
        }

        startedAtRef.current = Date.now();
        setPhase('recording');

        // Start without a timeslice. This produces one coherent WebM/OGG
        // recording instead of concatenated one-second fragments.
        videoRecorderRef.current?.start();
        audioRecorderRef.current?.start();

        const allowed = Math.min(
          answerSeconds,
          maxRecordingSeconds,
        );

        setTimeLeft(allowed);

        clearInterval(timerRef.current);

        timerRef.current = setInterval(
          () => {
            setTimeLeft((current) => {
              if (current <= 1) {
                clearInterval(
                  timerRef.current,
                );

                setTimeout(
                  () =>
                    finishRecording({
                      timerExpired: true,
                    }),
                  0,
                );

                return 0;
              }

              return current - 1;
            });
          },
          1_000,
        );
      } catch (recordingError) {
        setError(
          recordingError?.message ||
            'Unable to begin recording.',
        );

        setPhase('error');
        releaseRecorderStreams();
      }
    },
    [
      answerSeconds,
      finishRecording,
      maxRecordingSeconds,
      releaseRecorderStreams,
      requireAudio,
      requireVideo,
    ],
  );

  useEffect(() => {
    let active = true;

    async function prepareDevices() {
      try {
        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: requireAudio
              ? {
                  echoCancellation: {
                    ideal: true,
                  },
                  noiseSuppression: {
                    ideal: true,
                  },
                  autoGainControl: {
                    ideal: true,
                  },
                  channelCount: {
                    ideal: 1,
                  },
                  sampleRate: {
                    ideal: 48_000,
                  },
                  sampleSize: {
                    ideal: 16,
                  },
                }
              : false,

            video: requireVideo
              ? {
                  width: {
                    ideal: 1280,
                    min: 640,
                  },
                  height: {
                    ideal: 720,
                    min: 480,
                  },
                  frameRate: {
                    ideal: 24,
                    max: 30,
                  },
                  aspectRatio: {
                    ideal: 16 / 9,
                  },
                  facingMode: 'user',
                }
              : false,
          });

        if (!active) {
          stopTracks(stream);
          return;
        }

        sourceStreamRef.current = stream;

        const videoTrack =
          stream.getVideoTracks()[0];

        if (videoTrack) {
          try {
            await videoTrack.applyConstraints({
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
              frameRate: {
                ideal: 24,
                max: 30,
              },
            });
          } catch {
            // Keep browser-selected quality if exact constraints fail.
          }
        }

        const videoSettings =
          videoTrack?.getSettings?.() || {};

        const audioSettings =
          stream
            .getAudioTracks()[0]
            ?.getSettings?.() || {};

        setQuality({
          width:
            videoSettings.width || null,
          height:
            videoSettings.height || null,
          frameRate:
            videoSettings.frameRate || null,
          sampleRate:
            audioSettings.sampleRate || null,
          channelCount:
            audioSettings.channelCount || 1,
          echoCancellation:
            audioSettings.echoCancellation ??
            null,
          noiseSuppression:
            audioSettings.noiseSuppression ??
            null,
          autoGainControl:
            audioSettings.autoGainControl ??
            null,
        });

        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject =
            stream;

          liveVideoRef.current.muted = true;
          liveVideoRef.current.volume = 0;

          await liveVideoRef.current
            .play()
            .catch(() => {});
        }

        setPhase('preparing');
      } catch (requestError) {
        setError(
          requestError?.message ||
            'Camera or microphone permission was denied.',
        );

        setPhase('error');
      }
    }

    prepareDevices();

    return () => {
      active = false;
      clearInterval(timerRef.current);
      stopTracks(sourceStreamRef.current);
      releaseRecorderStreams();
      clearPreviewUrls();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'preparing') {
      return undefined;
    }

    setPreparationLeft(
      preparationSeconds,
    );

    const preparationTimer =
      setInterval(() => {
        setPreparationLeft((current) => {
          if (current <= 1) {
            clearInterval(
              preparationTimer,
            );

            setTimeout(
              beginRecording,
              0,
            );

            return 0;
          }

          return current - 1;
        });
      }, 1_000);

    return () =>
      clearInterval(preparationTimer);
  }, [
    beginRecording,
    phase,
    preparationSeconds,
  ]);

  useEffect(() => {
    const stream =
      sourceStreamRef.current;

    if (!stream) {
      return undefined;
    }

    const onEnded = (event) => {
      onIntegrityEvent?.(
        event.target.kind === 'video'
          ? 'camera_disabled'
          : 'microphone_disabled',
        {
          label:
            event.target.label || '',
        },
      );
    };

    stream
      .getTracks()
      .forEach((track) =>
        track.addEventListener(
          'ended',
          onEnded,
        ),
      );

    return () =>
      stream
        .getTracks()
        .forEach((track) =>
          track.removeEventListener(
            'ended',
            onEnded,
          ),
        );
  }, [onIntegrityEvent]);

  function retry() {
    if (
      retryCount >= maxRetries
    ) {
      return;
    }

    stopReviewPlayback();
    clearPreviewUrls();

    setAudioBlob(null);
    setVideoBlob(null);
    setActualDuration(0);
    setRetryCount(
      (current) => current + 1,
    );
    setPhase('preparing');
  }

  const totalAllowed = Math.min(
    answerSeconds,
    maxRecordingSeconds,
  );

  const percent =
    phase === 'recording'
      ? Math.max(
          0,
          (timeLeft / totalAllowed) *
            100,
        )
      : 100;

  const lowVideoQuality =
    quality?.width &&
    quality?.height &&
    (quality.width < 960 ||
      quality.height < 540);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-black">
        <video
          ref={liveVideoRef}
          muted
          playsInline
          autoPlay
          className="aspect-video w-full object-cover"
        />

        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 text-xs font-black text-white backdrop-blur">
          <span
            className={`h-2 w-2 rounded-full ${
              phase === 'recording'
                ? 'animate-pulse bg-rose-500'
                : 'bg-emerald-400'
            }`}
          />

          {phase === 'recording'
            ? 'Recording'
            : 'Camera preview'}
        </div>

        {quality?.width &&
          quality?.height && (
            <div className="absolute bottom-4 right-4 rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-slate-200 backdrop-blur">
              {quality.width} ×{' '}
              {quality.height}
              {quality.frameRate
                ? ` · ${Math.round(
                    quality.frameRate,
                  )} fps`
                : ''}
            </div>
          )}

        {phase === 'preparing' && (
          <Overlay
            title="Get ready"
            value={preparationLeft}
            subtitle="Recording starts automatically"
          />
        )}

        {phase === 'requesting' && (
          <Overlay
            title="Preparing devices"
            subtitle="Allow camera and microphone access"
          />
        )}

        {phase === 'processing' && (
          <Overlay
            title="Finalizing recording"
            subtitle="Please wait for the full video and audio files"
          />
        )}
      </div>

      {lowVideoQuality && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Your camera is providing only{' '}
          {quality.width} ×{' '}
          {quality.height}. Improve lighting,
          close other camera applications, and
          select an HD camera in browser settings
          for a clearer interview video.
        </div>
      )}

      {phase === 'recording' && (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[.06] p-5">
          <div className="flex items-center justify-between">
            <strong className="text-sm text-rose-200">
              Answer time remaining
            </strong>

            <span className="text-2xl font-black text-white">
              {formatTime(timeLeft)}
            </span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-rose-500 transition-all"
              style={{
                width: `${percent}%`,
              }}
            />
          </div>

          <button
            type="button"
            onClick={() =>
              finishRecording({
                timerExpired: false,
              })
            }
            className="mt-5 w-full rounded-xl bg-rose-500 px-5 py-3 text-sm font-black text-white hover:bg-rose-400"
          >
            Stop recording
          </button>
        </div>
      )}

      {phase === 'review' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <strong className="block">
                Review your answer
              </strong>

              <span className="text-xs text-slate-500">
                Recorded duration:{' '}
                {formatTime(
                  actualDuration,
                )}. You may retry{' '}
                {Math.max(
                  0,
                  maxRetries -
                    retryCount,
                )}{' '}
                more time(s).
              </span>
            </div>

            {expired && (
              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-300">
                Timer ended
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {videoUrl && (
              <video
                ref={reviewVideoRef}
                src={videoUrl}
                controls
                muted
                volume={0}
                playsInline
                preload="metadata"
                onPlay={() =>
                  stopReviewPlayback(
                    'video',
                  )
                }
                className="aspect-video w-full rounded-xl bg-black object-contain"
              />
            )}

            {audioUrl && (
              <div className="flex items-center rounded-xl border border-slate-800 bg-[#0b1220] p-4">
                <audio
                  ref={reviewAudioRef}
                  src={audioUrl}
                  controls
                  preload="metadata"
                  onPlay={() =>
                    stopReviewPlayback(
                      'audio',
                    )
                  }
                  className="w-full"
                />
              </div>
            )}
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            The video file contains no audio and
            remains muted. The separate processed
            mono audio file is the only sound source,
            preventing double playback.
          </p>

          <button
            type="button"
            disabled={
              retryCount >= maxRetries
            }
            onClick={retry}
            className="mt-4 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-black text-slate-300 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Record again
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
          <strong className="block">
            Recording failed
          </strong>

          <span className="mt-2 block text-rose-300/80">
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              globalThis.location.reload()
            }
            className="mt-4 rounded-xl border border-rose-400/40 px-4 py-2 font-black"
          >
            Reload and try again
          </button>
        </div>
      )}
    </div>
  );
}

function Overlay({
  title,
  value,
  subtitle,
}) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center backdrop-blur-sm">
      <div>
        {value !== undefined && (
          <strong className="block text-6xl font-black text-white">
            {value}
          </strong>
        )}

        <span className="mt-3 block text-xl font-black text-white">
          {title}
        </span>

        {subtitle && (
          <span className="mt-2 block text-sm text-slate-300">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
