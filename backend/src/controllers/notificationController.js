import { Notification } from '../models/Notification.js';
import { listLocalNotifications, publicNotification } from '../utils/notifications.js';

function withTimeout(promise, ms, fallback) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export async function listNotifications(req, res) {
  const notifications = await withTimeout(
    Notification.find({ receiver: req.user._id })
      .sort({ createdAt: -1 })
      .limit(80)
      .populate('sender', 'username avatarUrl')
      .populate('post', 'caption imageUrl mediaType')
      .populate('story', 'mediaUrl mediaType')
      .populate('comment', 'body')
      .maxTimeMS(3000),
    3000,
    []
  );

  res.json({
    notifications: [
      ...listLocalNotifications(req.user._id),
      ...notifications.map(publicNotification)
    ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  });
}

export async function markNotificationsRead(req, res) {
  await Notification.updateMany({ receiver: req.user._id, isRead: false }, { $set: { isRead: true } });
  res.json({ ok: true });
}
