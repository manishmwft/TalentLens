import { InterviewAnswer } from '../models/InterviewAnswer.js';
import { ROLES } from '../constants/roles.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { streamMedia } from '../services/interviewMediaService.js';

export const streamInterviewAnswerMedia = asyncHandler(async (req, res) => {
  const filter = {
    _id: req.params.answerId,
    interview: req.params.interviewId,
    organization: req.user.organization,
  };

  const answer = await InterviewAnswer.findOne(filter).select('audio video');
  if (!answer) throw new AppError('Interview answer not found', 404);

  const mediaType = req.params.mediaType;
  if (!['audio', 'video'].includes(mediaType)) throw new AppError('Invalid media type', 400);
  const media = answer[mediaType];
  if (!media?.filePath) throw new AppError(`${mediaType} recording is not available`, 404);

  // Internal interview recordings are available only to staff roles already
  // authorized by the parent interview route.
  if (![ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER, ROLES.INTERVIEWER].includes(req.user.role)) {
    throw new AppError('You are not allowed to access this recording', 403);
  }

  await streamMedia(req, res, media);
});
