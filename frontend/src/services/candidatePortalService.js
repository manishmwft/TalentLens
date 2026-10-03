import { candidateApi } from './candidateApi.js';

export async function getCandidateInterviews() {
  const { data } = await candidateApi.get(
    '/candidate/interviews',
  );
  return data.interviews || [];
}

export async function getCandidateInterview(interviewId) {
  const { data } = await candidateApi.get(
    `/candidate/interviews/${interviewId}`,
  );
  return data.interview;
}

export async function getCandidateProfile() {
  const { data } = await candidateApi.get(
    '/candidate/profile',
  );
  return data.profile;
}

export async function updateCandidateProfile(payload) {
  const { data } = await candidateApi.patch(
    '/candidate/profile',
    payload,
  );
  return data;
}

export async function acceptCandidateInterviewConsent(
  interviewId,
  payload,
) {
  const { data } = await candidateApi.post(
    `/candidate/interviews/${interviewId}/consent`,
    payload,
  );
  return data;
}

export async function saveCandidateDeviceCheck(
  interviewId,
  payload,
) {
  const { data } = await candidateApi.post(
    `/candidate/interviews/${interviewId}/device-check`,
    payload,
  );
  return data;
}

export async function completeCandidatePreparation(
  interviewId,
) {
  const { data } = await candidateApi.post(
    `/candidate/interviews/${interviewId}/prepare`,
  );
  return data;
}

export async function startCandidateInterview(
  interviewId,
) {
  const { data } = await candidateApi.post(
    `/candidate/interviews/${interviewId}/start`,
  );
  return data.session;
}

export async function getCandidateInterviewSession(
  interviewId,
) {
  const { data } = await candidateApi.get(
    `/candidate/interviews/${interviewId}/session`,
  );
  return data.session;
}

function extensionFor(type, fallback) {
  const value = String(type || '').toLowerCase();

  if (value.includes('ogg')) return 'ogg';
  if (value.includes('wav')) return 'wav';
  if (value.includes('mpeg')) return 'mp3';
  if (value.includes('mp4')) return 'mp4';
  return fallback;
}

export async function submitCandidateInterviewAnswer(
  interviewId,
  questionId,
  recording,
  submissionId,
  onProgress,
) {
  const formData = new FormData();
  formData.append('submissionId', submissionId);

  if (recording.audioBlob) {
    const extension = extensionFor(
      recording.audioBlob.type,
      'webm',
    );

    formData.append(
      'audio',
      recording.audioBlob,
      `audio-${questionId}.${extension}`,
    );
  }

  if (recording.videoBlob) {
    const extension = extensionFor(
      recording.videoBlob.type,
      'webm',
    );

    formData.append(
      'video',
      recording.videoBlob,
      `video-${questionId}.${extension}`,
    );
  }

  formData.append(
    'audioDurationSeconds',
    String(recording.elapsedSeconds || 0),
  );
  formData.append(
    'videoDurationSeconds',
    String(recording.elapsedSeconds || 0),
  );
  formData.append(
    'elapsedSeconds',
    String(recording.elapsedSeconds || 0),
  );
  formData.append(
    'retryCount',
    String(recording.retryCount || 0),
  );
  formData.append(
    'expired',
    String(Boolean(recording.expired)),
  );

  const { data } = await candidateApi.post(
    `/candidate/interviews/${interviewId}/questions/${questionId}/answer`,
    formData,
    {
      timeout: 15 * 60 * 1000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        'X-Submission-Id': submissionId,
      },
      onUploadProgress(event) {
        if (!onProgress) return;

        if (!event.total) {
          onProgress(0);
          return;
        }

        onProgress(
          Math.min(
            99,
            Math.round((event.loaded * 100) / event.total),
          ),
        );
      },
    },
  );

  onProgress?.(100);
  return data;
}

export async function recordCandidateIntegrityEvent(
  interviewId,
  payload,
) {
  const { data } = await candidateApi.post(
    `/candidate/interviews/${interviewId}/integrity-events`,
    payload,
  );
  return data;
}
