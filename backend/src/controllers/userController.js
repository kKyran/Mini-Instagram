import { User } from '../models/User.js';
import { sendToUser } from '../websocket.js';
import { createNotification } from '../utils/notifications.js';

function publicUser(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    followers: (user.followers || []).map((id) => id.toString()),
    following: (user.following || []).map((id) => id.toString())
  };
}

export async function searchUsers(req, res) {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ users: [] });

  const users = await User.find({
    isActive: true,
    username: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  }).limit(8);

  res.json({ users: users.map(publicUser) });
}

export async function listFollowing(req, res) {
  const currentUser = await User.findById(req.user._id).populate('following', 'username avatarUrl bio followers following');
  res.json({ users: (currentUser.following || []).map(publicUser) });
}

export async function followUser(req, res) {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found' });
  if (target._id.equals(req.user._id)) return res.status(400).json({ message: 'You cannot follow yourself' });

  await Promise.all([
    User.updateOne({ _id: req.user._id }, { $addToSet: { following: target._id } }),
    User.updateOne({ _id: target._id }, { $addToSet: { followers: req.user._id } })
  ]);

  const [currentUser, updatedTarget] = await Promise.all([
    User.findById(req.user._id),
    User.findById(target._id)
  ]);
  const payload = {
    type: 'follow:created',
    followerId: req.user._id.toString(),
    followingId: target._id.toString(),
    followerUsername: req.user.username
  };
  await createNotification({
    sender: req.user._id,
    receiver: target._id,
    type: 'follow',
    text: `${req.user.username} started following you.`
  });
  sendToUser(req.user._id, payload);
  sendToUser(target._id, payload);
  res.json({ user: currentUser.toSafeJSON(), target: publicUser(updatedTarget) });
}

export async function unfollowUser(req, res) {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found' });

  await Promise.all([
    User.updateOne({ _id: req.user._id }, { $pull: { following: target._id } }),
    User.updateOne({ _id: target._id }, { $pull: { followers: req.user._id } })
  ]);

  const [currentUser, updatedTarget] = await Promise.all([
    User.findById(req.user._id),
    User.findById(target._id)
  ]);
  const payload = {
    type: 'follow:removed',
    followerId: req.user._id.toString(),
    followingId: target._id.toString()
  };
  sendToUser(req.user._id, payload);
  sendToUser(target._id, payload);
  res.json({ user: currentUser.toSafeJSON(), target: publicUser(updatedTarget) });
}
