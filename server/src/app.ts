import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import mediaRoutes from './routes/mediaRoutes';
import searchRoutes from './routes/searchRoutes';
import projectRoutes from './routes/projectRoutes';
import storyboardRoutes from './routes/storyboardRoutes';
import contentRoutes from './routes/contentRoutes';
import jobRoutes from './routes/jobRoutes';
import nasRoutes from './routes/nasRoutes';
import { getAllowedOrigins } from './utils/cors';
import { NotFoundError } from './utils/errors';

export function createApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );

  app.use(
    cors({
      origin: getAllowedOrigins(env.CLIENT_URL),
      credentials: true
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  if (env.NODE_ENV !== 'test') {
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 600,
      standardHeaders: true,
      legacyHeaders: false
    });
    app.use('/api/v1', apiLimiter);

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 50,
      message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' }
      }
    });
    app.use('/api/v1/auth/login', authLimiter);
    app.use('/api/v1/auth/register', authLimiter);
  }

  app.get('/api/v1/health', (_req, res) => {
    res.status(200).json({
      success: true,
      service: 'reelmind-api',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/media', mediaRoutes);
  app.use('/api/v1/search', searchRoutes);
  app.use('/api/v1/projects', projectRoutes);
  app.use('/api/v1/storyboards', storyboardRoutes);
  app.use('/api/v1/content', contentRoutes);
  app.use('/api/v1/jobs', jobRoutes);
  app.use('/api/v1/nas', nasRoutes);

  app.use((_req, _res, next) => {
    next(new NotFoundError('API endpoint not found'));
  });

  app.use(errorHandler);
  return app;
}

