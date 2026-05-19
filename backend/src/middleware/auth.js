import { User } from '../models/User.js';
import { verifyToken } from '../utils/auth.js';

function withTimeout(promise, ms, timeoutMessage) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export async function requireAuth(req, res, next) {
  let payload;
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    payload = verifyToken(token);
    const user = await withTimeout(User.findById(payload.sub).maxTimeMS(5000), 5000, 'Authentication lookup timed out');
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    req.user = user;
    next();
  } catch (error) {
    if (error.message === 'Authentication lookup timed out') {
      req.user = {
        _id: payload.sub,
        id: payload.sub,
        username: payload.username,
        role: payload.role || 'user',
        followers: [],
        following: [],
        isTokenOnly: true,
        toSafeJSON() {
          return {
            id: this.id,
            username: this.username,
            followers: this.followers,
            following: this.following,
            role: this.role
          };
        }
      };
      return next();
    }

    res.status(401).json({ message: 'Invalid token' });
  }
}
