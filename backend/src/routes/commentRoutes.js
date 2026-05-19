import express from 'express';
import { createComment, deleteComment, listComments, updateComment } from '../controllers/commentController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

export const commentRoutes = express.Router();

commentRoutes.get('/posts/:postId/comments', asyncHandler(listComments));
commentRoutes.post('/posts/:postId/comments', requireAuth, asyncHandler(createComment));
commentRoutes.patch('/comments/:id', requireAuth, asyncHandler(updateComment));
commentRoutes.delete('/comments/:id', requireAuth, asyncHandler(deleteComment));
