import { Router } from 'express';
import { login, me, register } from '../controllers/authController.js';
import { changePassword, updateProfile } from '../controllers/profileController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/authValidators.js';
import { changePasswordSchema, updateProfileSchema } from '../validators/profileValidators.js';

const router = Router();
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', requireAuth, me);
router.patch('/profile', requireAuth, validate(updateProfileSchema), updateProfile);
router.patch('/password', requireAuth, validate(changePasswordSchema), changePassword);

export default router;
