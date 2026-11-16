import type { Request, Response } from 'express';
import { createApp } from '../server/src/app';
import { connectDatabase } from '../server/src/config/db';

let appInstance: any = null;

export default async function handler(req: Request, res: Response) {
  try {
    await connectDatabase();
  } catch (err) {
    console.error('Failed to connect to MongoDB in serverless handler:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'DATABASE_CONNECTION_ERROR', message: 'Unable to connect to database' }
    });
  }

  if (!appInstance) {
    appInstance = createApp();
  }

  // Handle URL normalization when Vercel rewrites to /api
  if (req.url === '/api' || req.url === '/api/' || req.url.startsWith('/api/index')) {
    const original = (req.headers['x-forwarded-uri'] || req.headers['x-matched-path'] || req.originalUrl) as string;
    if (original && original !== '/api' && original !== '/api/') {
      req.url = original;
    }
  }

  return appInstance(req, res);
}
