import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { signToken } from '../src/utils/auth.js';

const app = createApp();

describe('auth routes', () => {
  test('allows CORS preflight from Vercel frontend', async () => {
    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://mini-instagram-frontend-eight.vercel.app')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('https://mini-instagram-frontend-eight.vercel.app');
  });

  test('registers a new user', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'newbie', email: 'new@example.com', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.token).toBeTruthy();
  });

  test('protected me rejects missing token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('protected me returns authenticated user', async () => {
    const user = await User.create({ username: 'authed', email: 'authed@example.com', password: 'secret123' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${signToken(user)}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('authed');
  });
});
