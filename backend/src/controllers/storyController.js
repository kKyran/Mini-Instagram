import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Story } from '../models/Story.js';
import { broadcast } from '../websocket.js';
import { createLocalNotification, createNotification } from '../utils/notifications.js';
import { isLocalFallbackEnabled } from '../utils/localFallback.js';

const memoryStories = [];
const shouldPersist = isLocalFallbackEnabled() && process.env.NODE_ENV !== 'test';
const storePath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'local-stories.json');

function loadMemoryStories() {
  if (!shouldPersist || !existsSync(storePath)) return;

  try {
    memoryStories.push(...JSON.parse(readFileSync(storePath, 'utf8')));
  } catch {
    memoryStories.length = 0;
  }
}

function saveMemoryStories() {
  if (!shouldPersist) return;

  try {
    mkdirSync(dirname(storePath), { recursive: true });
    writeFileSync(storePath, JSON.stringify(memoryStories, null, 2));
  } catch {
    // Story fallback persistence should not block the API response.
  }
}

loadMemoryStories();

function findMemoryStory(storyId) {
  return memoryStories.find((story) => story._id === storyId);
}

function isMemoryStoryId(storyId) {
  return typeof storyId === 'string' && storyId.startsWith('local-story-');
}

function setMemoryStoryLike(storyId, userId, shouldLike) {
  const story = findMemoryStory(storyId);
  if (!story) return null;
  const id = String(userId);
  story.likes = shouldLike
    ? [...new Set([...story.likes.map(String), id])]
    : story.likes.filter((likeId) => String(likeId) !== id);
  story.updatedAt = new Date().toISOString();
  saveMemoryStories();
  return story.likes;
}

export function clearMemoryStories() {
  memoryStories.length = 0;
  saveMemoryStories();
}

function withTimeout(promise, ms, fallback) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function createMemoryStory({ mediaUrl, mediaType, overlays = [], author }) {
  const now = new Date().toISOString();
  const story = {
    _id: `local-story-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mediaUrl,
    mediaType,
    author: {
      _id: String(author._id),
      id: String(author._id),
      username: author.username,
      avatarUrl: author.avatarUrl || ''
    },
    overlays: normalizeOverlays(overlays),
    likes: [],
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
    isLocalOnly: true
  };
  memoryStories.unshift(story);
  saveMemoryStories();
  return story;
}

function normalizeOverlays(overlays = []) {
  return overlays
    .filter((overlay) => overlay?.type && overlay?.value)
    .map((overlay) => ({
      type: overlay.type,
      value: String(overlay.value).slice(0, 80),
      x: Number.isFinite(Number(overlay.x)) ? Number(overlay.x) : 50,
      y: Number.isFinite(Number(overlay.y)) ? Number(overlay.y) : 50
    }));
}

export async function listStories(_req, res) {
  try {
    const stories = await withTimeout(
      Story.find({ expiresAt: { $gt: new Date() } })
        .sort({ createdAt: -1 })
        .populate('author', 'username avatarUrl')
        .maxTimeMS(3000),
      3000,
      []
    );

    res.json({ stories: [...memoryStories, ...stories] });
  } catch {
    if (!isLocalFallbackEnabled()) return res.status(503).json({ message: 'Stories are temporarily unavailable.' });
    res.json({ stories: memoryStories });
  }
}

export async function createStory(req, res) {
  const { mediaUrl, mediaType, overlays = [] } = req.body;
  if (!mediaUrl || !['image', 'video'].includes(mediaType)) {
    return res.status(400).json({ message: 'Story media is required.' });
  }

  if (isLocalFallbackEnabled()) {
    const story = createMemoryStory({ mediaUrl, mediaType, overlays, author: req.user });
    broadcast({ type: 'story:created', storyId: story._id, username: req.user.username, story });
    return res.status(201).json({ story, warning: 'Saved in local fallback storage.' });
  }

  try {
    const story = await withTimeout(
      Story.create({
        mediaUrl,
        mediaType,
        author: req.user._id,
        overlays: normalizeOverlays(overlays)
      }),
      5000,
      null
    );
    if (!story) throw new Error('Story save timed out');
    const populated = await withTimeout(story.populate('author', 'username avatarUrl'), 3000, story);
    broadcast({ type: 'story:created', storyId: story._id.toString(), username: req.user.username, story: populated });
    res.status(201).json({ story: populated });
  } catch {
    if (!isLocalFallbackEnabled()) {
      return res.status(503).json({ message: 'Story could not be saved. Check the database connection.' });
    }
    const story = createMemoryStory({ mediaUrl, mediaType, overlays, author: req.user });
    broadcast({ type: 'story:created', storyId: story._id, username: req.user.username, story });
    res.status(201).json({ story, warning: 'Saved in local memory because the database is unavailable.' });
  }
}

export async function likeStory(req, res) {
  const memoryStory = findMemoryStory(req.params.id);
  if (memoryStory) {
    const likes = setMemoryStoryLike(req.params.id, req.user._id, true);
    createLocalNotification({
      sender: req.user,
      receiver: memoryStory.author,
      type: 'story_like',
      story: memoryStory,
      text: `${req.user.username} liked your story.`
    });
    broadcast({ type: 'story:liked', storyId: req.params.id, likes });
    return res.json({ likes });
  }
  if (isMemoryStoryId(req.params.id)) return res.status(404).json({ message: 'Local story not found' });

  const story = await Story.findById(req.params.id).populate('author', 'username avatarUrl');
  if (!story) return res.status(404).json({ message: 'Story not found' });
  const alreadyLiked = story.likes.some((id) => id.equals(req.user._id));
  if (!alreadyLiked) {
    story.likes.push(req.user._id);
    await story.save();
    createNotification({
      sender: req.user._id,
      receiver: story.author._id,
      type: 'story_like',
      story: story._id,
      text: `${req.user.username} liked your story.`
    }).catch(() => {});
  }
  const likes = story.likes.map((id) => id.toString());
  broadcast({ type: 'story:liked', storyId: story._id.toString(), likes });
  res.json({ likes });
}

export async function unlikeStory(req, res) {
  const memoryStory = findMemoryStory(req.params.id);
  if (memoryStory) {
    const likes = setMemoryStoryLike(req.params.id, req.user._id, false);
    broadcast({ type: 'story:liked', storyId: req.params.id, likes });
    return res.json({ likes });
  }
  if (isMemoryStoryId(req.params.id)) return res.status(404).json({ message: 'Local story not found' });

  const story = await Story.findById(req.params.id);
  if (!story) return res.status(404).json({ message: 'Story not found' });
  story.likes = story.likes.filter((id) => !id.equals(req.user._id));
  await story.save();
  const likes = story.likes.map((id) => id.toString());
  broadcast({ type: 'story:liked', storyId: story._id.toString(), likes });
  res.json({ likes });
}
