import express from 'express';
import { login, me, register, updateProfile } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

export const authRoutes = express.Router();

authRoutes.post('/register', asyncHandler(register));
authRoutes.post('/login', asyncHandler(login));
authRoutes.get('/me', requireAuth, asyncHandler(me));
authRoutes.patch('/profile', requireAuth, asyncHandler(updateProfile));
