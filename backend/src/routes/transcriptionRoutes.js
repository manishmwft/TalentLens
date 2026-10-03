import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getTranscriptionHealth } from '../controllers/transcriptionHealthController.js';

const router = Router();

router.use(requireAuth);
router.get('/health', getTranscriptionHealth);

export default router;
