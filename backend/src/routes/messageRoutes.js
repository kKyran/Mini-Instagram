import express from 'express';
import { listConversations, listMessages, sendMessage } from '../controllers/messageController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

export const messageRoutes = express.Router();

messageRoutes.get('/', requireAuth, asyncHandler(listConversations));
messageRoutes.get('/:userId', requireAuth, asyncHandler(listMessages));
messageRoutes.post('/:userId', requireAuth, asyncHandler(sendMessage));
