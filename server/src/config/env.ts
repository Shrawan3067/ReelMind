import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(5001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/reelmind'),
  JWT_ACCESS_SECRET: z.string().min(16).default('dev-reelmind-access-secret-key-min-32-chars'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-reelmind-refresh-secret-key-min-32-chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ENCRYPTION_KEY: z.string().length(64).default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  AI_PROVIDER: z.enum(['openai', 'gemini', 'anthropic', 'ollama', 'none']).default('none'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  EMBEDDING_MODEL: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  UPLOAD_DIRECTORY: z.string().default(path.resolve(process.cwd(), 'uploads')),
  THUMBNAIL_DIRECTORY: z.string().default(path.resolve(process.cwd(), 'thumbnails')),
  MAX_UPLOAD_SIZE: z.coerce.number().default(524288000),
  MAX_CONCURRENT_JOBS: z.coerce.number().default(2),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  VECTOR_SEARCH_MODE: z.enum(['local', 'atlas']).default('local'),
  ATLAS_VECTOR_INDEX: z.string().default('scene_embedding_index'),
  NAS_PROVIDER: z.string().default('ugreen_ugos'),
  NAS_BASE_URL: z.string().optional(),
  NAS_CONNECTION_MODE: z.string().default('disconnected')
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === 'production') {
  if (
    env.JWT_ACCESS_SECRET.includes('dev-reelmind') ||
    env.JWT_REFRESH_SECRET.includes('dev-reelmind') ||
    env.ENCRYPTION_KEY.startsWith('0123456789abcdef')
  ) {
    console.error('SECURITY ERROR: Default development secrets must not be used in production.');
    process.exit(1);
  }
}

