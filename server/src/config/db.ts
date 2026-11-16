import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

let cachedConnection: typeof mongoose | null = null;

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<void> {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  if (cachedConnection && cachedConnection.connection.readyState >= 1) {
    return;
  }
  try {
    cachedConnection = await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000
    });
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error({ err: error }, 'MongoDB connection failed');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('Disconnected from MongoDB');
}

