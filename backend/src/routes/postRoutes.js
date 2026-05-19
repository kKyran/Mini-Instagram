import express from 'express';
import { createPost, deletePost, likePost, listArchivedPosts, listPosts, unlikePost, updatePost } from '../controllers/postController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

export const postRoutes = express.Router();

postRoutes.get('/', asyncHandler(listPosts));
postRoutes.get('/archived/mine', requireAuth, asyncHandler(listArchivedPosts));
postRoutes.post('/', requireAuth, asyncHandler(createPost));
postRoutes.post('/:id/like', requireAuth, asyncHandler(likePost));
postRoutes.delete('/:id/like', requireAuth, asyncHandler(unlikePost));
postRoutes.patch('/:id', requireAuth, asyncHandler(updatePost));
postRoutes.delete('/:id', requireAuth, asyncHandler(deletePost));
