import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Notification } from '../models/Notification.js';
import { sendToUser } from '../websocket.js';
import { isLocalFallbackEnabled } from './localFallback.js';

const shouldPersist = isLocalFallbackEnabled() && process.env.NODE_ENV !== 'test';
const localNotifications = [];
const storePath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'local-notifications.json');

function localUser(user) {
  if (!user) return null;
  return {
    id: String(user.id || user._id),
    username: user.username,
    avatarUrl: user.avatarUrl || ''
  };
}

function localPost(post) {
  if (!post) return null;
  return {
    id: String(post.id || post._id),
    imageUrl: post.imageUrl || '',
    caption: post.caption || '',
    mediaType: post.mediaType || 'image'
  };
}

function localStory(story) {
  if (!story) return null;
  return {
    id: String(story.id || story._id),
    mediaUrl: story.mediaUrl || '',
    mediaType: story.mediaType || ''
  };
}

function localComment(comment) {
  if (!comment) return null;
  return {
    id: String(comment.id || comment._id),
    body: comment.body || ''
  };
}

function loadLocalNotifications() {
  if (!shouldPersist || !existsSync(storePath)) return;

  try {
    localNotifications.push(...JSON.parse(readFileSync(storePath, 'utf8')));
  } catch {
    localNotifications.length = 0;
  }
}

function saveLocalNotifications() {
  if (!shouldPersist) return;

  try {
    mkdirSync(dirname(storePath), { recursive: true });
    writeFileSync(storePath, JSON.stringify(localNotifications, null, 2));
  } catch {
    // Notifications should not block the main interaction when local persistence is unavailable.
  }
}

loadLocalNotifications();

export function publicNotification(notification) {
  return {
    id: notification._id.toString(),
    type: notification.type,
    text: notification.text,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    sender: notification.sender ? {
      id: notification.sender._id?.toString?.() || notification.sender.id,
      username: notification.sender.username,
      avatarUrl: notification.sender.avatarUrl || ''
    } : null,
    post: notification.post ? {
      id: notification.post._id?.toString?.() || notification.post.id,
      imageUrl: notification.post.imageUrl || '',
      caption: notification.post.caption || '',
      mediaType: notification.post.mediaType || 'image'
    } : null,
    story: notification.story ? {
      id: notification.story._id?.toString?.() || notification.story.id,
      mediaUrl: notification.story.mediaUrl || '',
      mediaType: notification.story.mediaType || ''
    } : null,
    comment: notification.comment ? {
      id: notification.comment._id?.toString?.() || notification.comment.id,
      body: notification.comment.body || ''
    } : null
  };
}

export async function createNotification({ sender, receiver, type, post = null, story = null, comment = null, text = '' }) {
  if (!sender || !receiver || String(sender) === String(receiver)) return null;
  const notification = await Notification.create({ sender, receiver, type, post, story, comment, text });
  const populated = await notification.populate([
    { path: 'sender', select: 'username avatarUrl' },
    { path: 'post', select: 'caption imageUrl mediaType' },
    { path: 'story', select: 'mediaUrl mediaType' },
    { path: 'comment', select: 'body' }
  ]);
  const payload = { type: 'notification:new', notification: publicNotification(populated) };
  sendToUser(receiver, payload);
  return payload.notification;
}

export function createLocalNotification({ sender, receiver, type, post = null, story = null, comment = null, text = '' }) {
  if (!isLocalFallbackEnabled()) return null;
  const senderUser = localUser(sender);
  const receiverUser = localUser(receiver);
  if (!senderUser?.id || !receiverUser?.id || senderUser.id === receiverUser.id) return null;

  const notification = {
    id: `local-notification-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    text,
    isRead: false,
    createdAt: new Date().toISOString(),
    receiverId: receiverUser.id,
    sender: senderUser,
    post: localPost(post),
    story: localStory(story),
    comment: localComment(comment)
  };
  localNotifications.unshift(notification);
  saveLocalNotifications();
  sendToUser(receiverUser.id, { type: 'notification:new', notification });
  return notification;
}

export function listLocalNotifications(receiverId) {
  if (!isLocalFallbackEnabled()) return [];
  return localNotifications
    .filter((notification) => String(notification.receiverId) === String(receiverId))
    .map(({ receiverId: _receiverId, ...notification }) => notification);
}

export function clearLocalNotifications() {
  localNotifications.length = 0;
  saveLocalNotifications();
}
