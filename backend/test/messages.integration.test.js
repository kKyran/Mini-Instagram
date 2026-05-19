import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Message } from '../src/models/Message.js';
import { User } from '../src/models/User.js';
import { signToken } from '../src/utils/auth.js';

const app = createApp();

describe('messages api', () => {
  test('lists following and followers as message contacts', async () => {
    const current = await User.create({ username: 'current', email: 'current@example.com', password: 'secret123' });
    const following = await User.create({ username: 'following', email: 'following@example.com', password: 'secret123' });
    const follower = await User.create({ username: 'follower', email: 'follower@example.com', password: 'secret123' });

    current.following.push(following._id);
    current.followers.push(follower._id);
    await current.save();

    const res = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${signToken(current)}`);

    expect(res.status).toBe(200);
    expect(res.body.contacts.map((contact) => contact.username)).toEqual(
      expect.arrayContaining(['following', 'follower'])
    );
  });

  test('counts unread senders and marks a thread read when opened', async () => {
    const receiver = await User.create({ username: 'receiver', email: 'receiver@example.com', password: 'secret123' });
    const sender = await User.create({ username: 'sender', email: 'sender@example.com', password: 'secret123' });
    await Message.create({ sender: sender._id, receiver: receiver._id, text: 'Hello unread' });

    const receiverToken = signToken(receiver);
    const conversationsRes = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${receiverToken}`);

    expect(conversationsRes.status).toBe(200);
    expect(conversationsRes.body.unreadCount).toBe(1);
    expect(conversationsRes.body.contacts.find((contact) => contact.id === sender._id.toString()).unreadCount).toBe(1);

    const threadRes = await request(app)
      .get(`/api/messages/${sender._id}`)
      .set('Authorization', `Bearer ${receiverToken}`);

    expect(threadRes.status).toBe(200);

    const afterReadRes = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${receiverToken}`);

    expect(afterReadRes.body.unreadCount).toBe(0);
    expect(afterReadRes.body.contacts.find((contact) => contact.id === sender._id.toString()).unreadCount).toBe(0);
  });

  test('handles missing sender references without crashing', async () => {
    const receiver = await User.create({ username: 'receiver2', email: 'receiver2@example.com', password: 'secret123' });
    const missingSenderId = new mongoose.Types.ObjectId();
    await Message.create({ sender: missingSenderId, receiver: receiver._id, text: 'Hello missing sender' });

    const res = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${signToken(receiver)}`);

    expect(res.status).toBe(200);
    expect(res.body.contacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: missingSenderId.toString() })])
    );
  });
});
