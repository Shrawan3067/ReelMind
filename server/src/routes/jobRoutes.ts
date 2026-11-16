import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as jobController from '../controllers/jobController';

const router = Router();
router.use(requireAuth);

router.get('/', jobController.listJobs);
router.get('/:id', jobController.getJobById);
router.post('/:id/retry', jobController.retryJob);

export default router;

