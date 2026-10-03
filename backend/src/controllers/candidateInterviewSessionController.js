import { Interview } from '../models/Interview.js';
import { InterviewAttempt } from '../models/InterviewAttempt.js';
import { InterviewAnswer } from '../models/InterviewAnswer.js';
import {
  INTERVIEW_ANSWER_STATUSES,
  INTERVIEW_ATTEMPT_STATUSES,
  INTERVIEW_DELIVERY_MODES,
} from '../constants/interview.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ensureAutomatedInterviewQuestions } from '../services/automatedInterviewQuestionService.js';
import {
  finalizeMediaFile,
  removeMediaFiles,
} from '../services/interviewMediaService.js';
import { queueInterviewAnswerTranscription } from '../services/interviewTranscriptionService.js';

const terminalAttemptStatuses = new Set([
  INTERVIEW_ATTEMPT_STATUSES.PROCESSING,
  INTERVIEW_ATTEMPT_STATUSES.COMPLETED,
  INTERVIEW_ATTEMPT_STATUSES.CANCELLED,
  INTERVIEW_ATTEMPT_STATUSES.EXPIRED,
  INTERVIEW_ATTEMPT_STATUSES.FAILED,
]);

function availability(interview, now = new Date()) {
  if (interview.status === 'cancelled') {
    return {
      allowed: false,
      message: 'This interview was cancelled',
    };
  }

  const availableFrom =
    interview.automatedConfig?.availableFrom;

  const expiresAt =
    interview.automatedConfig?.expiresAt;

  if (availableFrom && availableFrom > now) {
    return {
      allowed: false,
      message: 'This interview is not available yet',
    };
  }

  if (expiresAt && expiresAt < now) {
    return {
      allowed: false,
      message: 'This interview has expired',
    };
  }

  return { allowed: true };
}

async function findInterview(req) {
  const interview = await Interview.findOne({
    _id: req.params.interviewId,
    candidateAccount: req.candidateAccount._id,
    deliveryMode:
      INTERVIEW_DELIVERY_MODES.AUTOMATED_AI,
  })
    .populate('screening', 'jobDescription')
    .populate(
      'candidate',
      'originalFileName analysis.candidateName',
    );

  if (!interview) {
    throw new AppError('Interview not found', 404);
  }

  return interview;
}

async function findAttempt(interview, account) {
  const attempt = await InterviewAttempt.findOne({
    interview: interview._id,
    candidateAccount: account._id,
  }).sort({ attemptNumber: -1 });

  if (!attempt) {
    throw new AppError(
      'Complete interview preparation before starting',
      409,
    );
  }

  return attempt;
}

function publicQuestion(question, index, total) {
  return {
    id: question._id.toString(),
    number: index + 1,
    total,
    question: question.question,
    category: question.category,
    difficulty: question.difficulty,
  };
}

function serializeSession(interview, attempt) {
  const totalQuestions =
    interview.questions.length;

  const rawIndex = Math.max(
    0,
    Number(attempt.currentQuestionIndex || 0),
  );

  const completed =
    rawIndex >= totalQuestions ||
    attempt.status ===
      INTERVIEW_ATTEMPT_STATUSES.PROCESSING ||
    attempt.status ===
      INTERVIEW_ATTEMPT_STATUSES.COMPLETED;

  const question = completed
    ? null
    : interview.questions[rawIndex] || null;

  const config =
    interview.automatedConfig || {};

  return {
    interviewId:
      interview._id.toString(),
    attemptId:
      attempt._id.toString(),
    title:
      interview.questionSetTitle ||
      'Automated AI Interview',
    status: attempt.status,
    currentQuestionIndex: rawIndex,
    completedQuestions:
      attempt.completedQuestionIds?.length || 0,
    totalQuestions,
    question: question
      ? publicQuestion(
          question,
          rawIndex,
          totalQuestions,
        )
      : null,
    config: {
      preparationTimeSeconds:
        config.preparationTimeSeconds ?? 30,
      questionTimeSeconds:
        config.questionTimeSeconds ?? 180,
      maxRecordingSeconds:
        config.maxRecordingSeconds ?? 180,
      maxRetriesPerQuestion:
        config.maxRetriesPerQuestion ?? 1,
      requireAudio:
        config.requireAudio !== false,
      requireVideo:
        config.requireVideo !== false,
      allowRecordingReview:
        config.allowRecordingReview !== false,
      monitorTabAndFocus:
        config.monitorTabAndFocus === true,
      monitorInactivity:
        config.monitorInactivity === true,
      webcamMonitoring:
        config.webcamMonitoring === true,
    },
    startedAt:
      attempt.session?.startedAt || null,
    submittedAt:
      attempt.session?.submittedAt || null,
  };
}

async function ensureAnswerRows(
  interview,
  attempt,
) {
  const operations =
    interview.questions.map(
      (question, index) => ({
        updateOne: {
          filter: {
            attempt: attempt._id,
            questionId: question._id,
          },
          update: {
            $setOnInsert: {
              organization:
                interview.organization,
              interview: interview._id,
              attempt: attempt._id,
              candidate:
                interview.candidate._id ||
                interview.candidate,
              questionId: question._id,
              questionSnapshot: {
                question:
                  question.question,
                category:
                  question.category,
                difficulty:
                  question.difficulty,
                expectedPoints:
                  question.expectedPoints ||
                  [],
                evaluationGuidance:
                  question.evaluationGuidance ||
                  '',
              },
              order: index,
              status:
                INTERVIEW_ANSWER_STATUSES.NOT_STARTED,
              maxRetries:
                interview.automatedConfig
                  ?.maxRetriesPerQuestion ??
                1,
              timer: {
                allowedSeconds:
                  interview.automatedConfig
                    ?.questionTimeSeconds ??
                  180,
              },
            },
          },
          upsert: true,
        },
      }),
    );

  if (operations.length) {
    await InterviewAnswer.bulkWrite(
      operations,
      { ordered: false },
    );
  }
}

async function synchronizeAttemptProgress(
  interview,
  attempt,
) {
  const submittedAnswers =
    await InterviewAnswer.find({
      attempt: attempt._id,
      submittedAt: { $ne: null },
    })
      .select('questionId order')
      .sort({ order: 1 });

  const submittedIds = new Set(
    submittedAnswers.map((answer) =>
      answer.questionId.toString(),
    ),
  );

  let nextIndex = 0;

  while (
    nextIndex < interview.questions.length &&
    submittedIds.has(
      interview.questions[
        nextIndex
      ]._id.toString(),
    )
  ) {
    nextIndex += 1;
  }

  attempt.completedQuestionIds =
    interview.questions
      .filter((question) =>
        submittedIds.has(
          question._id.toString(),
        ),
      )
      .map((question) => question._id);

  attempt.currentQuestionIndex =
    nextIndex;

  if (
    nextIndex >=
      interview.questions.length &&
    interview.questions.length > 0
  ) {
    if (
      attempt.status !==
      INTERVIEW_ATTEMPT_STATUSES.COMPLETED
    ) {
      attempt.status =
        INTERVIEW_ATTEMPT_STATUSES.PROCESSING;
    }

    attempt.session.submittedAt ||=
      new Date();
  }

  attempt.session.lastSavedAt =
    new Date();

  await attempt.save();
  return attempt;
}

async function activateAttempt(
  interview,
  attempt,
) {
  if (
    attempt.status ===
    INTERVIEW_ATTEMPT_STATUSES.READY
  ) {
    attempt.status =
      INTERVIEW_ATTEMPT_STATUSES.IN_PROGRESS;
  }

  if (
    attempt.status !==
    INTERVIEW_ATTEMPT_STATUSES.IN_PROGRESS
  ) {
    throw new AppError(
      'This interview attempt cannot be started',
      409,
    );
  }

  const now = new Date();

  attempt.session.startedAt ||= now;
  attempt.session.lastActivityAt = now;
  attempt.session.lastSavedAt = now;

  interview.status = 'in_progress';

  await Promise.all([
    attempt.save(),
    interview.save(),
    ensureAnswerRows(interview, attempt),
  ]);

  return attempt;
}

export const startCandidateInterview =
  asyncHandler(async (req, res) => {
    const interview =
      await findInterview(req);

    const state =
      availability(interview);

    if (!state.allowed) {
      throw new AppError(
        state.message,
        409,
      );
    }

    await ensureAutomatedInterviewQuestions(
      interview,
    );

    const attempt = await findAttempt(
      interview,
      req.candidateAccount,
    );

    if (
      !attempt.consent?.accepted ||
      !attempt.deviceCheck?.completedAt
    ) {
      throw new AppError(
        'Complete consent and device checks before starting',
        409,
      );
    }

    await ensureAnswerRows(
      interview,
      attempt,
    );

    await synchronizeAttemptProgress(
      interview,
      attempt,
    );

    if (
      terminalAttemptStatuses.has(
        attempt.status,
      )
    ) {
      return res.json({
        success: true,
        message:
          'Interview session already submitted',
        session: serializeSession(
          interview,
          attempt,
        ),
      });
    }

    await activateAttempt(
      interview,
      attempt,
    );

    return res.json({
      success: true,
      message: 'Interview started',
      session: serializeSession(
        interview,
        attempt,
      ),
    });
  });

export const getCandidateInterviewSession =
  asyncHandler(async (req, res) => {
    const interview =
      await findInterview(req);

    await ensureAutomatedInterviewQuestions(
      interview,
    );

    const attempt = await findAttempt(
      interview,
      req.candidateAccount,
    );

    await ensureAnswerRows(
      interview,
      attempt,
    );

    await synchronizeAttemptProgress(
      interview,
      attempt,
    );

    const allowedStatuses = new Set([
      INTERVIEW_ATTEMPT_STATUSES.READY,
      INTERVIEW_ATTEMPT_STATUSES.IN_PROGRESS,
      INTERVIEW_ATTEMPT_STATUSES.PROCESSING,
      INTERVIEW_ATTEMPT_STATUSES.COMPLETED,
    ]);

    if (
      !allowedStatuses.has(
        attempt.status,
      )
    ) {
      throw new AppError(
        'Complete interview preparation before opening the session',
        409,
      );
    }

    if (
      attempt.status ===
        INTERVIEW_ATTEMPT_STATUSES.IN_PROGRESS &&
      interview.status !== 'in_progress'
    ) {
      interview.status = 'in_progress';
      await interview.save();
    }

    return res.json({
      success: true,
      session: serializeSession(
        interview,
        attempt,
      ),
    });
  });

export const submitCandidateAnswer =
  asyncHandler(async (req, res) => {
    const uploadedFiles = [
      ...(req.files?.audio || []),
      ...(req.files?.video || []),
    ];

    const finalizedFiles = [];

    try {
      const interview =
        await findInterview(req);

      const state =
        availability(interview);

      if (!state.allowed) {
        throw new AppError(
          state.message,
          409,
        );
      }

      await ensureAutomatedInterviewQuestions(
        interview,
      );

      const attempt = await findAttempt(
        interview,
        req.candidateAccount,
      );

      await ensureAnswerRows(
        interview,
        attempt,
      );

      await synchronizeAttemptProgress(
        interview,
        attempt,
      );

      // Recovery path for the exact bug fixed by Build 5.5I:
      // older frontend sessions could display the recorder while the
      // attempt was still READY. A valid upload now activates that same
      // prepared attempt instead of discarding the candidate recording.
      if (
        attempt.status ===
        INTERVIEW_ATTEMPT_STATUSES.READY
      ) {
        if (
          !attempt.consent?.accepted ||
          !attempt.deviceCheck?.completedAt
        ) {
          throw new AppError(
            'Complete consent and device checks before submitting an answer',
            409,
          );
        }

        await activateAttempt(
          interview,
          attempt,
        );
      }

      const existingAnswer =
        await InterviewAnswer.findOne({
          attempt: attempt._id,
          questionId:
            req.params.questionId,
        });

      // Idempotency is evaluated before terminal-state rejection so that
      // a lost successful response can still be recovered after the last
      // answer moved the attempt into PROCESSING.
      if (
        existingAnswer?.submittedAt &&
        existingAnswer.submissionId ===
          req.body.submissionId
      ) {
        await removeMediaFiles(
          uploadedFiles,
        );

        const completed =
          attempt.currentQuestionIndex >=
          interview.questions.length;

        return res.json({
          success: true,
          duplicate: true,
          message:
            'Answer was already uploaded successfully',
          completed,
          session: serializeSession(
            interview,
            attempt,
          ),
          nextRoute: completed
            ? `/candidate/interviews/${interview._id}/submitted`
            : `/candidate/interviews/${interview._id}/session`,
        });
      }

      if (
        attempt.status !==
        INTERVIEW_ATTEMPT_STATUSES.IN_PROGRESS
      ) {
        throw new AppError(
          attempt.status ===
            INTERVIEW_ATTEMPT_STATUSES.PROCESSING ||
          attempt.status ===
            INTERVIEW_ATTEMPT_STATUSES.COMPLETED
            ? 'This interview has already been submitted'
            : 'Interview is not in progress',
          409,
        );
      }

      const index =
        attempt.currentQuestionIndex || 0;

      const question =
        interview.questions[index];

      if (
        !question ||
        question._id.toString() !==
          req.params.questionId
      ) {
        throw new AppError(
          'Answers must be submitted in question order',
          409,
        );
      }

      const answer =
        existingAnswer ||
        (await InterviewAnswer.findOne({
          attempt: attempt._id,
          questionId: question._id,
        }));

      if (!answer) {
        throw new AppError(
          'Interview answer record not found',
          404,
        );
      }

      if (answer.submittedAt) {
        throw new AppError(
          'This answer has already been submitted',
          409,
        );
      }

      const config =
        interview.automatedConfig || {};

      const audioFile =
        req.files?.audio?.[0];

      const videoFile =
        req.files?.video?.[0];

      if (
        config.requireAudio !== false &&
        !audioFile
      ) {
        throw new AppError(
          'An audio recording is required',
          400,
        );
      }

      if (
        config.requireVideo !== false &&
        !videoFile
      ) {
        throw new AppError(
          'A video recording is required',
          400,
        );
      }

      if (
        Number(req.body.retryCount || 0) >
        (config.maxRetriesPerQuestion ??
          1)
      ) {
        throw new AppError(
          'Recording retry limit exceeded',
          400,
        );
      }

      const elapsedSeconds =
        Number(
          req.body.elapsedSeconds || 0,
        );

      const maximumSeconds =
        config.maxRecordingSeconds ??
        config.questionTimeSeconds ??
        180;

      if (
        elapsedSeconds >
        maximumSeconds + 10
      ) {
        throw new AppError(
          'Recording duration exceeds the configured limit',
          400,
        );
      }

      answer.status =
        INTERVIEW_ANSWER_STATUSES.UPLOADING;

      answer.submissionId =
        req.body.submissionId;

      answer.uploadError = '';

      await answer.save();

      const common = {
        organizationId:
          interview.organization,
        interviewId:
          interview._id,
        attemptId:
          attempt._id,
        questionId:
          question._id,
        submissionId:
          req.body.submissionId,
      };

      const audio =
        await finalizeMediaFile({
          ...common,
          file: audioFile,
          durationSeconds:
            req.body
              .audioDurationSeconds,
        });

      const video =
        await finalizeMediaFile({
          ...common,
          file: videoFile,
          durationSeconds:
            req.body
              .videoDurationSeconds,
        });

      if (audio?.filePath) {
        finalizedFiles.push(
          audio.filePath,
        );
      }

      if (video?.filePath) {
        finalizedFiles.push(
          video.filePath,
        );
      }

      answer.audio =
        audio || answer.audio;

      answer.video =
        video || answer.video;

      answer.retryCount =
        Number(req.body.retryCount || 0);

      answer.status =
        INTERVIEW_ANSWER_STATUSES.QUEUED;

      answer.timer.startedAt ||=
        attempt.session
          .lastActivityAt ||
        attempt.session.startedAt ||
        new Date();

      answer.timer.stoppedAt =
        new Date();

      answer.timer.elapsedSeconds =
        elapsedSeconds;

      answer.timer.expired =
        String(req.body.expired) ===
        'true';

      answer.transcription.status =
        'pending';

      answer.submittedAt =
        new Date();

      await answer.save();

      if (
        !attempt.completedQuestionIds.some(
          (id) =>
            id.toString() ===
            question._id.toString(),
        )
      ) {
        attempt.completedQuestionIds.push(
          question._id,
        );
      }

      attempt.currentQuestionIndex =
        index + 1;

      attempt.session.lastActivityAt =
        new Date();

      attempt.session.lastSavedAt =
        new Date();

      const completed =
        attempt.currentQuestionIndex >=
        interview.questions.length;

      if (completed) {
        attempt.status =
          INTERVIEW_ATTEMPT_STATUSES.PROCESSING;

        attempt.session.submittedAt =
          new Date();
      } else {
        attempt.status =
          INTERVIEW_ATTEMPT_STATUSES.IN_PROGRESS;
      }

      await attempt.save();

      queueInterviewAnswerTranscription(
        answer._id,
      );

      return res.json({
        success: true,
        message: completed
          ? 'Interview submitted for transcription and AI evaluation'
          : 'Answer uploaded and queued',
        completed,
        answer: {
          id: answer._id.toString(),
          status: answer.status,
          audio: {
            sizeBytes:
              answer.audio?.sizeBytes ||
              0,
            verifiedAt:
              answer.audio?.verifiedAt ||
              null,
          },
          video: {
            sizeBytes:
              answer.video?.sizeBytes ||
              0,
            verifiedAt:
              answer.video?.verifiedAt ||
              null,
          },
          transcriptionStatus:
            answer.transcription?.status ||
            'pending',
        },
        session: serializeSession(
          interview,
          attempt,
        ),
        nextRoute: completed
          ? `/candidate/interviews/${interview._id}/submitted`
          : `/candidate/interviews/${interview._id}/session`,
      });
    } catch (error) {
      await removeMediaFiles(
        uploadedFiles,
      );

      await removeMediaFiles(
        finalizedFiles,
      );

      try {
        if (
          req.body?.submissionId &&
          req.params?.questionId &&
          req.candidateAccount?._id
        ) {
          const attempt =
            await InterviewAttempt.findOne({
              candidateAccount:
                req.candidateAccount._id,
              interview:
                req.params.interviewId,
            }).sort({
              attemptNumber: -1,
            });

          if (attempt) {
            await InterviewAnswer.updateOne(
              {
                attempt: attempt._id,
                questionId:
                  req.params.questionId,
                submittedAt: null,
              },
              {
                $set: {
                  status:
                    INTERVIEW_ANSWER_STATUSES.UPLOAD_FAILED,
                  uploadError:
                    error.message ||
                    'Media upload failed',
                },
              },
            );
          }
        }
      } catch (stateError) {
        console.error(
          'Unable to persist upload failure state:',
          stateError,
        );
      }

      throw error;
    }
  });

export const recordCandidateIntegrityEvent =
  asyncHandler(async (req, res) => {
    const interview =
      await findInterview(req);

    const attempt = await findAttempt(
      interview,
      req.candidateAccount,
    );

    if (
      attempt.status !==
      INTERVIEW_ATTEMPT_STATUSES.IN_PROGRESS
    ) {
      return res.status(204).end();
    }

    attempt.integrityEvents.push({
      type: req.body.type,
      occurredAt: new Date(),
      metadata:
        req.body.metadata || {},
    });

    if (
      attempt.integrityEvents.length >
      500
    ) {
      attempt.integrityEvents =
        attempt.integrityEvents.slice(
          -500,
        );
    }

    attempt.session.lastActivityAt =
      new Date();

    await attempt.save();

    return res.status(201).json({
      success: true,
    });
  });
