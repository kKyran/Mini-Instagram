import request from 'supertest';
import { createApp } from '../src/app.js';
import { listStories } from '../src/controllers/storyController.js';
import { Story } from '../src/models/Story.js';
import { User } from '../src/models/User.js';
import { signToken } from '../src/utils/auth.js';

const app = createApp();

describe('stories api', () => {
  test('creates and lists active stories', async () => {
    const user = await User.create({ username: 'storyteller', email: 'story@example.com', password: 'secret123' });

    const createRes = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({
        mediaUrl: 'https://example.com/story.jpg',
        mediaType: 'image',
        overlays: [{ type: 'text', value: 'hello', x: 25, y: 30 }]
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.story.author.username).toBe('storyteller');

    const listRes = await request(app).get('/api/stories');
    expect(listRes.status).toBe(200);
    expect(listRes.body.stories).toHaveLength(1);
    expect(listRes.body.stories[0].overlays[0].value).toBe('hello');
  });

  test('returns a stories payload when story lookup fails', async () => {
    const originalFind = Story.find;
    Story.find = () => ({
      sort() {
        return this;
      },
      populate() {
        return this;
      },
      maxTimeMS() {
        return Promise.reject(new Error('story lookup failed'));
      }
    });

    const res = {
      statusCode: 200,
      body: null,
      json(payload) {
        this.body = payload;
        return this;
      }
    };

    try {
      await listStories({}, res);
    } finally {
      Story.find = originalFind;
    }

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ stories: [] });
  });

  test('likes local stories created while the database is unavailable', async () => {
    const user = await User.create({ username: 'localstory', email: 'localstory@example.com', password: 'secret123' });
    const token = signToken(user);
    const originalCreate = Story.create;
    Story.create = () => Promise.resolve(null);

    let storyId;
    try {
      const createRes = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${token}`)
        .send({ mediaUrl: 'data:image/png;base64,abc', mediaType: 'image' });

      expect(createRes.status).toBe(201);
      storyId = createRes.body.story._id;
    } finally {
      Story.create = originalCreate;
    }

    const likeRes = await request(app)
      .post(`/api/stories/${storyId}/like`)
      .set('Authorization', `Bearer ${token}`);
    expect(likeRes.status).toBe(200);
    expect(likeRes.body.likes).toContain(user._id.toString());

    const unlikeRes = await request(app)
      .delete(`/api/stories/${storyId}/like`)
      .set('Authorization', `Bearer ${token}`);
    expect(unlikeRes.status).toBe(200);
    expect(unlikeRes.body.likes).toEqual([]);
  });

  test('creates notifications for local story likes', async () => {
    const owner = await User.create({ username: 'storyowner', email: 'storyowner@example.com', password: 'secret123' });
    const actor = await User.create({ username: 'storyactor', email: 'storyactor@example.com', password: 'secret123' });
    const ownerToken = signToken(owner);
    const actorToken = signToken(actor);
    const originalCreate = Story.create;
    Story.create = () => Promise.resolve(null);

    let storyId;
    try {
      const createRes = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ mediaUrl: 'data:image/png;base64,abc', mediaType: 'image' });

      expect(createRes.status).toBe(201);
      storyId = createRes.body.story._id;
    } finally {
      Story.create = originalCreate;
    }

    await request(app).post(`/api/stories/${storyId}/like`).set('Authorization', `Bearer ${actorToken}`);

    const notificationsRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(notificationsRes.status).toBe(200);
    expect(notificationsRes.body.notifications.map((notification) => notification.type)).toContain('story_like');
  });

  test('stale local story ids do not produce server errors', async () => {
    const user = await User.create({ username: 'stalestory', email: 'stalestory@example.com', password: 'secret123' });
    const res = await request(app)
      .post('/api/stories/local-story-stale/like')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(res.status).toBe(404);
  });
});
