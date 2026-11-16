import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as nasController from '../controllers/nasController';

const ConnectNasBody = z.object({
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  useSsl: z.boolean().optional(),
  apiKey: z.string().optional(),
  nasMountPoint: z.string().optional(),
  shareName: z.string().optional()
});

const router = Router();
router.use(requireAuth);

router.get('/status', nasController.getNasStatus);
router.post('/connect', validateBody(ConnectNasBody), nasController.connectNas);
router.post('/sync', nasController.syncNas);
router.post('/disconnect', nasController.disconnectNas);

export default router;

