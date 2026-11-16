import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { connectDatabase } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { verifyAccessToken } from './utils/token';
import { globalProcessingQueue } from './queues/ProcessingQueue';

async function bootstrap() {
  await connectDatabase();

  const app = createApp();
  const httpServer = http.createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required for real-time updates'));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', socket => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    logger.debug({ userId }, 'Socket.IO client joined private workspace room');
  });

  globalProcessingQueue.attachSocketServer(io);

  httpServer.listen(env.PORT, () => {
    logger.info(`ReelMind API & WebSocket Gateway listening on port ${env.PORT}`);
  });
}

bootstrap().catch(err => {
  logger.error({ err }, 'Fatal error during ReelMind server bootstrap');
  process.exit(1);
});

