import express from 'express';
import { followUser, listFollowing, searchUsers, unfollowUser } from '../controllers/userController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

export const userRoutes = express.Router();

userRoutes.get('/following', requireAuth, asyncHandler(listFollowing));
userRoutes.get('/', requireAuth, asyncHandler(searchUsers));
userRoutes.post('/:id/follow', requireAuth, asyncHandler(followUser));
userRoutes.delete('/:id/follow', requireAuth, asyncHandler(unfollowUser));
