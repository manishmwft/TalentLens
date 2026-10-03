import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { recoverQueuedTranscriptions } from './services/interviewTranscriptionService.js';
import { recoverQueuedEvaluations } from './services/interviewAnswerEvaluationProcessor.js';

async function start() {
  await connectDatabase();
  const server = app.listen(env.port, () => {
    console.log(`API running at http://localhost:${env.port}`);
    recoverQueuedTranscriptions().catch((error) => {
      console.error('Unable to recover queued transcriptions:', error);
    });
    recoverQueuedEvaluations().catch((error) => {
      console.error('Unable to recover queued AI evaluations:', error);
    });
  });

  // Media answers can be large and are uploaded over slower candidate
  // connections. These limits prevent Node from terminating a healthy
  // multipart upload while still keeping finite server timeouts.
  server.requestTimeout = Number(
    process.env.INTERVIEW_MEDIA_REQUEST_TIMEOUT_MS ||
      15 * 60 * 1000,
  );
  server.headersTimeout = Number(
    process.env.SERVER_HEADERS_TIMEOUT_MS ||
      2 * 60 * 1000,
  );
  server.keepAliveTimeout = Number(
    process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS ||
      65 * 1000,
  );

  const shutdown = (signal) => {
    console.log(`${signal} received. Shutting down...`);
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
