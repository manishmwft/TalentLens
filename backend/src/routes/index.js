import { Router } from 'express';
import authRoutes from './authRoutes.js';
import organizationRoutes from './organizationRoutes.js';
import screeningRoutes from './screeningRoutes.js';
import userRoutes from './userRoutes.js';
import interviewRoutes from './interviewRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import candidateInvitationRoutes from './candidateInvitationRoutes.js';
import candidateAuthRoutes from './candidateAuthRoutes.js';
import candidatePortalRoutes from './candidatePortalRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import jobDescriptionRoutes from './jobDescriptionRoutes.js';
import publicJobApplicationRoutes from './publicJobApplicationRoutes.js';
import websiteApplicationRoutes from './websiteApplicationRoutes.js';

import transcriptionRoutes from './transcriptionRoutes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, service: 'ai-resume-mvp-api' });
});

router.use('/public', publicJobApplicationRoutes);
router.use('/auth', authRoutes);
router.use('/candidate-auth', candidateAuthRoutes);
router.use('/candidate', candidatePortalRoutes);
router.use('/organization', organizationRoutes);
router.use('/screenings', screeningRoutes);
router.use('/job-descriptions', jobDescriptionRoutes);
router.use('/website-applications', websiteApplicationRoutes);
router.use('/users', userRoutes);
router.use('/interviews', interviewRoutes);
router.use('/notifications', notificationRoutes);
router.use('/automated-interviews', candidateInvitationRoutes);
router.use('/dashboard/analytics', analyticsRoutes);

router.use('/transcription', transcriptionRoutes);

export default router;