import jwt from 'jsonwebtoken';

export function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), username: user.username, role: user.role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
}
