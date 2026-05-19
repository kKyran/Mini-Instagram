import express from 'express';
import { createStory, likeStory, listStories, unlikeStory } from '../controllers/storyController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

export const storyRoutes = express.Router();

storyRoutes.get('/', asyncHandler(listStories));
storyRoutes.post('/', requireAuth, asyncHandler(createStory));
storyRoutes.post('/:id/like', requireAuth, asyncHandler(likeStory));
storyRoutes.delete('/:id/like', requireAuth, asyncHandler(unlikeStory));
