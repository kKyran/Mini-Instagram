import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { isLocalFallbackEnabled } from './localFallback.js';

export const memoryPosts = [];

const memoryComments = [];
const shouldPersist = isLocalFallbackEnabled() && process.env.NODE_ENV !== 'test';
const storePath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'local-store.json');

function loadStore() {
  if (!shouldPersist || !existsSync(storePath)) return;

  try {
    const data = JSON.parse(readFileSync(storePath, 'utf8'));
    memoryPosts.push(...(data.posts || []));
    memoryComments.push(...(data.comments || []));
  } catch {
    memoryPosts.length = 0;
    memoryComments.length = 0;
  }
}

function saveStore() {
  if (!shouldPersist) return;

  try {
    mkdirSync(dirname(storePath), { recursive: true });
    writeFileSync(storePath, JSON.stringify({ posts: memoryPosts, comments: memoryComments }, null, 2));
  } catch {
    // The API should keep working even if local fallback persistence is unavailable.
  }
}

loadStore();

function toAuthor(author) {
  return {
    _id: String(author._id || author.id),
    id: String(author.id || author._id),
    username: author.username,
    avatarUrl: author.avatarUrl || ''
  };
}

export function createMemoryPost({ caption, imageUrl, mediaType = 'image', location = '', visibility = 'public', author, tags = [] }) {
  const now = new Date().toISOString();
  const post = {
    _id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    caption,
    imageUrl,
    mediaType,
    location,
    visibility,
    author: toAuthor(author),
    tags: tags.map((tag) => ({ name: tag, slug: String(tag).trim().toLowerCase().replace(/\s+/g, '-') })),
    likes: [],
    commentCount: 0,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    isLocalOnly: true
  };
  memoryPosts.unshift(post);
  saveStore();
  return post;
}

export function findMemoryPost(postId) {
  return memoryPosts.find((post) => post._id === postId && !post.isArchived);
}

export function isMemoryPostId(postId) {
  return typeof postId === 'string' && postId.startsWith('local-');
}

export function setMemoryPostLike(postId, userId, shouldLike) {
  const post = findMemoryPost(postId);
  if (!post) return null;
  const id = String(userId);
  post.likes = shouldLike
    ? [...new Set([...post.likes.map(String), id])]
    : post.likes.filter((likeId) => String(likeId) !== id);
  post.updatedAt = new Date().toISOString();
  saveStore();
  return post.likes;
}

export function archiveMemoryPost(postId, user) {
  const post = findMemoryPost(postId);
  if (!post) return null;
  const userId = String(user.id || user._id);
  const authorId = String(post.author.id || post.author._id);
  if (authorId !== userId && post.author.username !== user.username) return false;
  post.isArchived = true;
  post.updatedAt = new Date().toISOString();
  saveStore();
  return true;
}

export function listMemoryComments(postId) {
  return memoryComments.filter((comment) => comment.post === postId && !comment.isDeleted);
}

export function createMemoryComment({ postId, body, author, clientId = '' }) {
  const post = findMemoryPost(postId);
  if (!post) return null;
  const now = new Date().toISOString();
  const comment = {
    _id: `local-comment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    clientId,
    body,
    post: postId,
    author: toAuthor(author),
    parentComment: null,
    mentions: [],
    editedAt: null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  };
  memoryComments.push(comment);
  post.commentCount += 1;
  post.updatedAt = now;
  saveStore();
  return comment;
}

export function deleteMemoryComment(commentId, user) {
  const comment = memoryComments.find((item) => item._id === commentId && !item.isDeleted);
  if (!comment) return null;
  const userId = String(user.id || user._id);
  const authorId = String(comment.author.id || comment.author._id);
  if (authorId !== userId && comment.author.username !== user.username) return false;
  comment.isDeleted = true;
  comment.updatedAt = new Date().toISOString();
  const post = memoryPosts.find((item) => item._id === comment.post);
  if (post) post.commentCount = Math.max(0, post.commentCount - 1);
  saveStore();
  return comment;
}

export function clearLocalStore() {
  memoryPosts.length = 0;
  memoryComments.length = 0;
  saveStore();
}
