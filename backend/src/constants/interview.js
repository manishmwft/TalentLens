export const INTERVIEW_DELIVERY_MODES = {
  HUMAN_LED: 'human_led',
  AUTOMATED_AI: 'automated_ai',
};

export const AUTOMATED_INTERVIEW_STATUSES = {
  DRAFT: 'draft',
  INVITED: 'invited',
  ACTIVATED: 'activated',
  READY: 'ready',
  IN_PROGRESS: 'in_progress',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
};

export const INTERVIEW_ATTEMPT_STATUSES = {
  DRAFT: 'draft',
  READY: 'ready',
  IN_PROGRESS: 'in_progress',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
};

export const INTERVIEW_ANSWER_STATUSES = {
  NOT_STARTED: 'not_started',
  RECORDING: 'recording',
  UPLOADING: 'uploading',
  UPLOAD_FAILED: 'upload_failed',
  UPLOADED: 'uploaded',
  QUEUED: 'queued',
  TRANSCRIBING: 'transcribing',
  TRANSCRIBED: 'transcribed',
  EVALUATION_QUEUED: 'evaluation_queued',
  EVALUATING: 'evaluating',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const INVITATION_TYPES = {
  CANDIDATE_ACCOUNT: 'candidate_account_activation',
  INTERVIEW: 'candidate_interview_invitation',
  PASSWORD_RESET: 'candidate_password_reset',
};
