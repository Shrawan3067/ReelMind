import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as projectController from '../controllers/projectController';

const router = Router();
router.use(requireAuth);

router.get('/', projectController.listProjects);
router.post('/', projectController.createProject);
router.get('/:id', projectController.getProjectById);
router.patch('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

export default router;

