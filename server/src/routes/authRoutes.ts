import { Router } from 'express';
import { z } from 'zod';
import { RegisterSchema, LoginSchema, AspectRatioSchema } from '@reelmind/shared';
import * as authController from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  preferences: z
    .object({
      theme: z.enum(['dark', 'light']).optional(),
      defaultAspectRatio: AspectRatioSchema.optional(),
      aiProvider: z.string().optional(),
      autoProcessUploads: z.boolean().optional()
    })
    .optional(),
  aiConfig: z
    .object({
      provider: z.enum(['openai', 'gemini', 'anthropic', 'ollama', 'none']).optional(),
      apiKey: z.string().optional(),
      model: z.string().optional(),
      embeddingModel: z.string().optional(),
      baseUrl: z.string().optional()
    })
    .optional()
});

const router = Router();

router.post('/register', validateBody(RegisterSchema), authController.register);
router.post('/login', validateBody(LoginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.me);
router.patch('/me', requireAuth, validateBody(UpdateProfileSchema), authController.updateProfile);
router.get('/sessions', requireAuth, authController.getSessions);
router.delete('/sessions/:sessionId', requireAuth, authController.deleteSession);

export default router;

