import dotenv from 'dotenv';

dotenv.config();

const required = ['MONGODB_URI', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  candidateJwtExpiresIn: process.env.CANDIDATE_JWT_EXPIRES_IN || '12h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 5),
  maxFilesPerUpload: Number(process.env.MAX_FILES_PER_UPLOAD || 10),
  aiProvider: String(process.env.AI_PROVIDER || 'gemini').trim().toLowerCase(),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  aiConcurrency: Math.max(1, Number(process.env.AI_CONCURRENCY || 1)),
  emailProvider: String(process.env.EMAIL_PROVIDER || 'mock').trim().toLowerCase(),
  emailFrom: process.env.EMAIL_FROM || 'TalentLens AI <no-reply@talentlens.local>',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  speechProvider: String(process.env.SPEECH_PROVIDER || 'faster_whisper').trim().toLowerCase(),
  googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
  googleCloudCredentialsJson: process.env.GOOGLE_CLOUD_CREDENTIALS_JSON || '',
  googleSpeechLanguage: process.env.GOOGLE_SPEECH_LANGUAGE || 'en-US',
  googleSpeechModel: process.env.GOOGLE_SPEECH_MODEL || 'latest_long',
  mockTranscriptText: process.env.MOCK_TRANSCRIPT_TEXT || '',
  fasterWhisperServiceUrl: String(
    process.env.FASTER_WHISPER_SERVICE_URL || 'http://127.0.0.1:8001',
  ).replace(/\/$/, ''),
  fasterWhisperToken: process.env.FASTER_WHISPER_TOKEN || '',
  fasterWhisperModel: process.env.FASTER_WHISPER_MODEL || 'small',
  fasterWhisperLanguage: process.env.FASTER_WHISPER_LANGUAGE || 'auto',
  fasterWhisperTask: process.env.FASTER_WHISPER_TASK || 'transcribe',
  fasterWhisperTimeoutMs: Math.max(
    30_000,
    Number(process.env.FASTER_WHISPER_TIMEOUT_MS || 10 * 60 * 1000),
  ),
  transcriptionAutoProcess: String(process.env.TRANSCRIPTION_AUTO_PROCESS || 'true').toLowerCase() === 'true',
  transcriptionConcurrency: Math.max(1, Number(process.env.TRANSCRIPTION_CONCURRENCY || 1)),
  transcriptionMaxAttempts: Math.max(1, Number(process.env.TRANSCRIPTION_MAX_ATTEMPTS || 3)),
  transcriptionRecoveryLimit: Math.max(1, Number(process.env.TRANSCRIPTION_RECOVERY_LIMIT || 50)),
  transcriptionStaleMinutes: Math.max(1, Number(process.env.TRANSCRIPTION_STALE_MINUTES || 15)),
};
