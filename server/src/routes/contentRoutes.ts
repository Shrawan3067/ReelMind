import { Router } from 'express';
import { ContentStudioRequestSchema } from '@reelmind/shared';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as contentController from '../controllers/contentController';

const router = Router();
router.use(requireAuth);

router.post('/generate-title', validateBody(ContentStudioRequestSchema), contentController.generateTitle);
router.post('/generate-caption', validateBody(ContentStudioRequestSchema), contentController.generateCaption);
router.post('/generate-description', validateBody(ContentStudioRequestSchema), contentController.generateDescription);
router.post('/generate-hashtags', validateBody(ContentStudioRequestSchema), contentController.generateHashtags);
router.post('/generate-pack', validateBody(ContentStudioRequestSchema), contentController.generatePack);

export default router;

