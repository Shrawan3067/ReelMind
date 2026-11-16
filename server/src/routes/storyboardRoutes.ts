import { Router } from 'express';
import { z } from 'zod';
import { GenerateStoryboardRequestSchema } from '@reelmind/shared';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as storyboardController from '../controllers/storyboardController';

const RegenerateSceneBody = z.object({
  sceneId: z.string().min(1),
  instruction: z.string().optional()
});

const router = Router();
router.use(requireAuth);

router.get('/', storyboardController.listStoryboards);
router.post('/generate', validateBody(GenerateStoryboardRequestSchema), storyboardController.generateStoryboard);
router.get('/:id', storyboardController.getStoryboard);
router.patch('/:id', storyboardController.updateStoryboard);
router.post('/:id/regenerate-scene', validateBody(RegenerateSceneBody), storyboardController.regenerateScene);
router.post('/:id/export-plan', storyboardController.exportStoryboardPlan);

export default router;

