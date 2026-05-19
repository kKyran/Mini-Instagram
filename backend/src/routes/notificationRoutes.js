import express from 'express';
import { listNotifications, markNotificationsRead } from '../controllers/notificationController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

export const notificationRoutes = express.Router();

notificationRoutes.get('/', requireAuth, asyncHandler(listNotifications));
notificationRoutes.patch('/read', requireAuth, asyncHandler(markNotificationsRead));
