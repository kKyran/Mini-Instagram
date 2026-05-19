import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { sendToUser } from '../websocket.js';

function withTimeout(promise, ms, fallback) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function populateUser(path) {
  return {
    path,
    select: 'username avatarUrl',
    transform: (doc, id) => doc ?? { _id: id, username: 'Unknown', avatarUrl: '' }
  };
}

function publicUser(user) {
  if (!user) return { id: '', username: 'Unknown', avatarUrl: '' };
  const id = user._id || user.id;
  return {
    id: id.toString(),
    username: user.username,
    avatarUrl: user.avatarUrl || ''
  };
}

function publicMessage(message) {
  return {
    id: message._id.toString(),
    sender: publicUser(message.sender),
    receiver: publicUser(message.receiver),
    text: message.text,
    isRead: message.isRead,
    createdAt: message.createdAt
  };
}

export async function listConversations(req, res) {
  const currentId = req.user._id;
  const currentUser = await withTimeout(
    User.findById(currentId)
      .populate('following', 'username avatarUrl')
      .populate('followers', 'username avatarUrl')
      .maxTimeMS(3000),
    3000,
    null
  );
  const linkedIds = new Set();
  for (const id of [
    ...(currentUser?.following || []),
    ...(currentUser?.followers || []),
    ...(req.user?.following || []),
    ...(req.user?.followers || [])
  ]) {
    const value = id?._id || id;
    if (value) linkedIds.add(value.toString());
  }
  const linkedUsers = await withTimeout(
    User.find({ _id: { $in: [...linkedIds] } }).select('username avatarUrl').maxTimeMS(3000),
    3000,
    []
  );
  const messages = await withTimeout(
    Message.find({ $or: [{ sender: currentId }, { receiver: currentId }] })
      .sort({ createdAt: -1 })
      .populate(populateUser('sender'))
      .populate(populateUser('receiver'))
      .maxTimeMS(3000),
    3000,
    []
  );
  const unreadCounts = await withTimeout(
    Message.aggregate([
      { $match: { receiver: currentId, isRead: false } },
      { $group: { _id: '$sender', count: { $sum: 1 } } }
    ]),
    3000,
    []
  );
  const unreadMap = new Map(unreadCounts.map((item) => [item._id.toString(), item.count]));

  const contacts = new Map();
  for (const linkedUser of linkedUsers) {
    const id = linkedUser._id.toString();
    contacts.set(id, {
      ...publicUser(linkedUser),
      preview: 'Start a conversation',
      time: '',
      unreadCount: unreadMap.get(id) || 0
    });
  }

  for (const message of messages) {
    if (!message.sender?._id || !message.receiver?._id) continue;
    const other = message.sender._id.equals(currentId) ? message.receiver : message.sender;
    const id = other?._id?.toString();
    if (!id) continue;
    if (!contacts.has(id)) {
      contacts.set(id, { ...publicUser(other), preview: message.text, time: message.createdAt, unreadCount: unreadMap.get(id) || 0 });
    } else {
      const current = contacts.get(id);
      if (!current.time || new Date(message.createdAt) > new Date(current.time)) {
        contacts.set(id, { ...current, preview: message.text, time: message.createdAt, unreadCount: unreadMap.get(id) || 0 });
      }
    }
  }

  res.json({ contacts: [...contacts.values()], unreadCount: [...unreadMap.keys()].length });
}

export async function listMessages(req, res) {
  const otherId = req.params.userId;
  await withTimeout(
    Message.updateMany({ sender: otherId, receiver: req.user._id, isRead: false }, { $set: { isRead: true } }),
    3000,
    null
  );
  const messages = await withTimeout(
    Message.find({
      $or: [
        { sender: req.user._id, receiver: otherId },
        { sender: otherId, receiver: req.user._id }
      ]
    })
      .sort({ createdAt: 1 })
      .populate(populateUser('sender'))
      .populate(populateUser('receiver'))
      .maxTimeMS(3000),
    3000,
    []
  );

  res.json({ messages: messages.map(publicMessage) });
}

export async function sendMessage(req, res) {
  const receiver = await User.findById(req.params.userId);
  if (!receiver) return res.status(404).json({ message: 'User not found' });
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ message: 'Message text is required' });

  const message = await Message.create({ sender: req.user._id, receiver: receiver._id, text });
  const populated = await message.populate([
    { path: 'sender', select: 'username avatarUrl' },
    { path: 'receiver', select: 'username avatarUrl' }
  ]);
  const payload = { type: 'message:created', message: publicMessage(populated) };
  sendToUser(receiver._id, payload);
  sendToUser(req.user._id, payload);
  res.status(201).json({ message: payload.message });
}
