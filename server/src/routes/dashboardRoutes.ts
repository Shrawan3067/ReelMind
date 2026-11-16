import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboardController';

const router = Router();
router.use(requireAuth);

router.get('/stats', dashboardController.getDashboardStats);
router.get('/recent-projects', dashboardController.getRecentProjects);

export default router;

