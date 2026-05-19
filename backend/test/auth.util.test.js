import jwt from 'jsonwebtoken';
import { signToken } from '../src/utils/auth.js';

test('signToken returns a JWT with the expected subject', () => {
  const token = signToken({ _id: '507f1f77bcf86cd799439011', username: 'mini', role: 'user' });
  const payload = jwt.verify(token, 'test-secret');
  expect(payload.sub).toBe('507f1f77bcf86cd799439011');
});
