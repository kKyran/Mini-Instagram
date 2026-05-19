import cors from 'cors';
import express from 'express';
import { createRouteHandler } from 'uploadthing/express';
import { authRoutes } from './routes/authRoutes.js';
import { commentRoutes } from './routes/commentRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { messageRoutes } from './routes/messageRoutes.js';
import { notificationRoutes } from './routes/notificationRoutes.js';
import { postRoutes } from './routes/postRoutes.js';
import { storyRoutes } from './routes/storyRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { isDbConnected } from './config/db.js';
import { isUploadThingConfigured, uploadRouter } from './uploadthing.js';

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://192.168.56.1:3000',
  'https://mini-instagram-frontend-eight.vercel.app'
];

function getAllowedOrigins() {
  const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([
    ...defaultAllowedOrigins,
    ...configuredOrigins,
  ]);
}

function isLocalDevOrigin(origin) {
  if (!origin) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === 'http:' && ['localhost', '127.0.0.1', '192.168.56.1'].includes(hostname);
  } catch {
    return false;
  }
}

function isAllowedVercelOrigin(origin) {
  if (!origin) return false;
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === 'https:' && hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

export function createApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin(origin) || isAllowedVercelOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }
  }));
  app.use(express.json({ limit: '12mb' }));
  app.get('/health', (_req, res) => res.json({ ok: true, db: isDbConnected() ? 'connected' : 'connecting' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/stories', storyRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api', commentRoutes);
  app.use('/api/uploadthing', (req, res, next) => {
    if (req.query.actionType === 'upload' && !isUploadThingConfigured()) {
      return res.status(503).json({
        message: 'UploadThing is not configured. Set a real UPLOADTHING_TOKEN in backend/.env and restart the backend server.'
      });
    }
    return next();
  }, createRouteHandler({ router: uploadRouter }));
  app.use(errorHandler);
  return app;
}
