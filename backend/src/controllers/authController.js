import { User } from '../models/User.js';
import { signToken } from '../utils/auth.js';

function withTimeout(promise, ms, timeoutMessage) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function isTimeoutError(error) {
  return error.message === 'Database request timed out';
}

export async function register(req, res) {
  try {
    const { username, email, password } = req.body;
    const user = await withTimeout(User.create({ username, email, password }), 5000, 'Database request timed out');
    res.status(201).json({ user: user.toSafeJSON(), token: signToken(user) });
  } catch (error) {
    if (isTimeoutError(error)) {
      return res.status(503).json({ message: 'Database request timed out. Try again.' });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'account';
      return res.status(409).json({ message: `${field} already exists` });
    }

    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors).map((item) => item.message).join(', ');
      return res.status(400).json({ message });
    }

    throw error;
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await withTimeout(
      User.findOne({ email: String(email).toLowerCase() }).maxTimeMS(5000),
      5000,
      'Database request timed out'
    );
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.json({ user: user.toSafeJSON(), token: signToken(user) });
  } catch (error) {
    if (isTimeoutError(error)) {
      return res.status(503).json({ message: 'Database request timed out. Try again.' });
    }

    throw error;
  }
}

export function me(req, res) {
  res.json({ user: req.user.toSafeJSON() });
}

export async function updateProfile(req, res) {
  const { username, bio, avatarUrl } = req.body;
  if (username !== undefined) req.user.username = username;
  if (bio !== undefined) req.user.bio = bio;
  if (avatarUrl !== undefined) req.user.avatarUrl = avatarUrl;
  await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
}
