import { Router } from 'express';
import { candidateChangePassword, candidateForgotPassword, candidateLogin, candidateMe, candidateResetPassword } from '../controllers/candidateAuthController.js';
import { requireCandidateAuth } from '../middleware/candidateAuth.js';
import { validate } from '../middleware/validate.js';
import { candidateChangePasswordSchema, candidateForgotPasswordSchema, candidateLoginSchema, candidateResetPasswordSchema } from '../validators/candidateAuthValidators.js';

const router = Router();
router.post('/login', validate(candidateLoginSchema), candidateLogin);
router.post('/forgot-password', validate(candidateForgotPasswordSchema), candidateForgotPassword);
router.post('/reset-password', validate(candidateResetPasswordSchema), candidateResetPassword);
router.get('/me', requireCandidateAuth, candidateMe);
router.patch('/password', requireCandidateAuth, validate(candidateChangePasswordSchema), candidateChangePassword);
export default router;
