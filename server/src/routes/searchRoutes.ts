import { Router } from 'express';
import { SemanticSearchRequestSchema } from '@reelmind/shared';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as searchController from '../controllers/searchController';

const router = Router();
router.use(requireAuth);

router.post('/semantic', validateBody(SemanticSearchRequestSchema), searchController.semanticSearch);
router.get('/history', searchController.getSearchHistory);
router.delete('/history/:id', searchController.deleteSearchHistory);

export default router;

