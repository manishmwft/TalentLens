import { Router } from 'express';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notificationIdSchema } from '../validators/candidateInvitationValidators.js';

const router = Router();
router.use(requireAuth);
router.get('/', listNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:notificationId/read', validate(notificationIdSchema), markNotificationRead);
export default router;
