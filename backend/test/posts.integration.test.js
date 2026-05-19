import request from 'supertest';
import { createApp } from '../src/app.js';
import { createPost } from '../src/controllers/postController.js';
import { Post } from '../src/models/Post.js';
import { User } from '../src/models/User.js';
import { signToken } from '../src/utils/auth.js';

const app = createApp();

describe('posts api', () => {
  test('creates an owned post', async () => {
    const user = await User.create({ username: 'poster', email: 'poster@example.com', password: 'secret123' });
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ caption: 'Sunset walk', imageUrl: 'https://example.com/sunset.jpg', location: 'Almaty', tags: ['travel'] });
    expect(res.status).toBe(201);
    expect(res.body.post.caption).toBe('Sunset walk');
  });

  test('search filters posts by text', async () => {
    const user = await User.create({ username: 'searcher', email: 'searcher@example.com', password: 'secret123' });
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ caption: 'Coffee near campus', imageUrl: 'https://example.com/coffee.jpg' });
    const res = await request(app).get('/api/posts?q=campus');
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
  });

  test('saves a local post when database creation times out', async () => {
    const originalCreate = Post.create;
    Post.create = () => Promise.resolve(null);
    const req = {
      body: { caption: 'Local save', imageUrl: 'data:image/png;base64,abc', tags: ['local'] },
      user: { _id: '507f1f77bcf86cd799439011', id: '507f1f77bcf86cd799439011', username: 'offline' }
    };
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      }
    };

    try {
      await createPost(req, res);
    } finally {
      Post.create = originalCreate;
    }

    expect(res.statusCode).toBe(201);
    expect(res.body.post.caption).toBe('Local save');
    expect(res.body.warning).toMatch(/local memory/);
  });

  test('likes and comments on local posts', async () => {
    const user = await User.create({ username: 'offlineuser', email: 'offline@example.com', password: 'secret123' });
    const token = signToken(user);
    const originalCreate = Post.create;
    Post.create = () => Promise.resolve(null);

    let postId;
    try {
      const createRes = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ caption: 'Offline flow', imageUrl: 'data:image/png;base64,abc' });

      expect(createRes.status).toBe(201);
      postId = createRes.body.post._id;
    } finally {
      Post.create = originalCreate;
    }

    const likeRes = await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${token}`);
    expect(likeRes.status).toBe(200);
    expect(likeRes.body.likes).toContain(user._id.toString());

    const commentRes = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Works offline', clientId: 'client-1' });
    expect(commentRes.status).toBe(201);
    expect(commentRes.body.comment.body).toBe('Works offline');

    const commentsRes = await request(app).get(`/api/posts/${postId}/comments`);
    expect(commentsRes.status).toBe(200);
    expect(commentsRes.body.comments).toHaveLength(1);
  });

  test('creates notifications for local post likes and comments', async () => {
    const owner = await User.create({ username: 'localowner', email: 'localowner@example.com', password: 'secret123' });
    const actor = await User.create({ username: 'localactor', email: 'localactor@example.com', password: 'secret123' });
    const ownerToken = signToken(owner);
    const actorToken = signToken(actor);
    const originalCreate = Post.create;
    Post.create = () => Promise.resolve(null);

    let postId;
    try {
      const createRes = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ caption: 'Notify me', imageUrl: 'data:image/png;base64,abc' });

      expect(createRes.status).toBe(201);
      postId = createRes.body.post._id;
    } finally {
      Post.create = originalCreate;
    }

    await request(app).post(`/api/posts/${postId}/like`).set('Authorization', `Bearer ${actorToken}`);
    await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${actorToken}`)
      .send({ body: 'Local comment notification' });

    const notificationsRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(notificationsRes.status).toBe(200);
    expect(notificationsRes.body.notifications.map((notification) => notification.type)).toEqual(
      expect.arrayContaining(['post_like', 'comment'])
    );
  });

  test('stale local post ids do not produce server errors', async () => {
    const user = await User.create({ username: 'staleuser', email: 'stale@example.com', password: 'secret123' });
    const token = signToken(user);
    const postId = 'local-stale-post';

    const likeRes = await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${token}`);
    expect(likeRes.status).toBe(404);

    const commentsRes = await request(app).get(`/api/posts/${postId}/comments`);
    expect(commentsRes.status).toBe(200);
    expect(commentsRes.body.comments).toEqual([]);

    const commentRes = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'No longer here' });
    expect(commentRes.status).toBe(404);
  });
});
