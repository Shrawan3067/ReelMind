import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const AspectRatioSchema = z.enum(['16:9', '9:16', '1:1', '4:5']);
export const TransitionSchema = z.enum(['cut', 'fade_in', 'fade_out', 'crossfade', 'dissolve', 'wipe']);
export const EvidenceSourceSchema = z.enum(['visual_analysis', 'transcript', 'metadata', 'hybrid']);
export const SourceTypeSchema = z.enum(['ugreen_nas', 'local_upload', 'demo']);
export const MediaTypeSchema = z.enum(['video', 'image', 'audio']);

export const StoryboardSceneSchema = z.object({
  id: z.string(),
  order: z.number().int().nonnegative(),
  mediaAssetId: z.string().min(1),
  sourceFilename: z.string().min(1),
  sourceType: SourceTypeSchema,
  isDemoData: z.boolean().default(false),
  sourceDuration: z.number().positive(),
  sourceStartTime: z.number().nonnegative(),
  sourceEndTime: z.number().positive(),
  timelineStartTime: z.number().nonnegative(),
  timelineEndTime: z.number().positive(),
  description: z.string().min(1),
  caption: z.string().default(''),
  transition: TransitionSchema.default('cut'),
  editingNotes: z.string().optional(),
  locked: z.boolean().default(false),
  thumbnailUrl: z.string().optional(),
  playbackUrl: z.string().optional(),
  evidenceSource: EvidenceSourceSchema.default('metadata')
}).refine(data => data.sourceEndTime > data.sourceStartTime, {
  message: 'sourceEndTime must be greater than sourceStartTime',
  path: ['sourceEndTime']
}).refine(data => data.sourceEndTime <= data.sourceDuration + 0.1, {
  message: 'sourceEndTime cannot exceed source media duration',
  path: ['sourceEndTime']
}).refine(data => data.timelineEndTime > data.timelineStartTime, {
  message: 'timelineEndTime must be greater than timelineStartTime',
  path: ['timelineEndTime']
});

export const StoryboardSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().min(1),
  title: z.string().min(1).max(120),
  creativeConcept: z.string().min(1).max(1000),
  targetDuration: z.number().positive().max(600), // Max 10 minutes
  actualDuration: z.number().positive(),
  aspectRatio: AspectRatioSchema,
  mood: z.string().min(1).max(100),
  scenes: z.array(StoryboardSceneSchema).min(1, 'Storyboard must contain at least 1 scene'),
  musicSuggestions: z.array(z.object({
    title: z.string(),
    mood: z.string(),
    tempo: z.string(),
    notes: z.string()
  })).default([]),
  editingNotes: z.string().default(''),
  version: z.number().int().positive().default(1)
}).refine(data => {
  // Check scene ordering and continuity
  for (let i = 0; i < data.scenes.length; i++) {
    const scene = data.scenes[i];
    if (scene.order !== i) return false;
    if (i > 0) {
      const prev = data.scenes[i - 1];
      // Tolerable threshold of 0.05s for float rounding
      if (Math.abs(prev.timelineEndTime - scene.timelineStartTime) > 0.05) {
        return false;
      }
    }
  }
  return true;
}, {
  message: 'Timeline scenes must be sequentially ordered with continuous timestamps without overlap or gap',
  path: ['scenes']
});

export const GenerateStoryboardRequestSchema = z.object({
  prompt: z.string().min(3, 'Creative prompt must be at least 3 characters'),
  targetDuration: z.number().min(5).max(300).default(30),
  aspectRatio: AspectRatioSchema.default('16:9'),
  mood: z.string().optional(),
  selectedMediaIds: z.array(z.string()).optional(),
  includeDemoMedia: z.boolean().default(true)
});

export const SemanticSearchRequestSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  mediaTypes: z.array(MediaTypeSchema).optional(),
  sourceTypes: z.array(SourceTypeSchema).optional(),
  minDuration: z.number().optional(),
  maxDuration: z.number().optional(),
  limit: z.number().int().min(1).max(50).default(20),
  page: z.number().int().min(1).default(1)
});

export const ContentStudioRequestSchema = z.object({
  platform: z.enum(['youtube', 'shorts', 'tiktok', 'instagram', 'linkedin']),
  targetDuration: z.number().optional(),
  tone: z.enum(['cinematic', 'energetic', 'educational', 'professional', 'casual', 'humorous']).default('cinematic'),
  audience: z.string().default('general'),
  language: z.string().default('English'),
  storyboardId: z.string().optional(),
  topicOrSummary: z.string().min(3, 'Topic or summary must be at least 3 characters')
});

export const NasConnectSchema = z.object({
  host: z.string().min(1, 'NAS host address is required'),
  port: z.number().int().min(1).max(65535).default(80),
  useSsl: z.boolean().default(false),
  apiKey: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional()
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type StoryboardInput = z.infer<typeof StoryboardSchema>;
export type GenerateStoryboardInput = z.infer<typeof GenerateStoryboardRequestSchema>;
export type SemanticSearchInput = z.infer<typeof SemanticSearchRequestSchema>;
export type ContentStudioInput = z.infer<typeof ContentStudioRequestSchema>;
export type NasConnectInput = z.infer<typeof NasConnectSchema>;

