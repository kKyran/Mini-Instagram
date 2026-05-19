import { Comment } from '../models/Comment.js';
import { Post } from '../models/Post.js';
import { Tag } from '../models/Tag.js';
import { broadcast } from '../websocket.js';
import { createLocalNotification, createNotification } from '../utils/notifications.js';
import { archiveMemoryPost, createMemoryPost, findMemoryPost, isMemoryPostId, memoryPosts, setMemoryPostLike } from '../utils/localStore.js';
import { isLocalFallbackEnabled } from '../utils/localFallback.js';

function withTimeout(promise, ms, fallback) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function toPlainPost(post) {
  if (!post) return post;
  return typeof post.toObject === 'function' ? post.toObject() : post;
}

async function syncTags(tagNames, userId, postId) {
  const tags = [];
  for (const rawName of tagNames || []) {
    const name = rawName.trim().toLowerCase();
    if (!name) continue;
    const tag = await Tag.findOneAndUpdate(
      { slug: name.replace(/\s+/g, '-') },
      { $setOnInsert: { name, slug: name.replace(/\s+/g, '-'), createdBy: userId }, $addToSet: { posts: postId } },
      { new: true, upsert: true }
    );
    tags.push(tag._id);
  }
  return tags;
}

async function attachCommentCounts(posts) {
  const counts = await Comment.aggregate([
    { $match: { post: { $in: posts.map((post) => post._id) }, isDeleted: false } },
    { $group: { _id: '$post', count: { $sum: 1 } } }
  ]);
  const countMap = new Map(counts.map((item) => [item._id.toString(), item.count]));
  return posts.map((post) => ({
    ...toPlainPost(post),
    commentCount: countMap.get(post._id.toString()) || 0
  }));
}

export async function listPosts(req, res) {
  try {
    const { q = '', tag = '' } = req.query;
    const filter = { isArchived: false, visibility: 'public' };
    if (q) filter.$or = [{ caption: new RegExp(q, 'i') }, { location: new RegExp(q, 'i') }];
    if (tag) {
      const found = await withTimeout(Tag.findOne({ slug: String(tag).toLowerCase() }).maxTimeMS(3000), 3000, null);
      filter.tags = found?._id || null;
    }
    const posts = await withTimeout(
      Post.find(filter).sort({ createdAt: -1 }).populate('author', 'username avatarUrl').populate('tags').maxTimeMS(3000),
      3000,
      []
    );
    const postsWithCounts = await withTimeout(attachCommentCounts(posts), 3000, posts.map(toPlainPost));
    res.json({ posts: [...(isLocalFallbackEnabled() ? memoryPosts : []), ...postsWithCounts] });
  } catch {
    if (!isLocalFallbackEnabled()) return res.status(503).json({ message: 'Posts are temporarily unavailable.' });
    res.json({ posts: memoryPosts });
  }
}

export async function listArchivedPosts(req, res) {
  const posts = await Post.find({ author: req.user._id, isArchived: true })
    .sort({ updatedAt: -1 })
    .populate('author', 'username avatarUrl')
    .populate('tags');
  res.json({ posts: await attachCommentCounts(posts) });
}

export async function createPost(req, res) {
  const { caption, imageUrl, mediaType = 'image', location, visibility = 'public', tags = [] } = req.body;
  try {
    const post = await withTimeout(
      Post.create({ caption, imageUrl, mediaType, location, visibility, author: req.user._id, tags: [] }),
      5000,
      null
    );
    if (!post) throw new Error('Post save timed out');
    post.tags = await withTimeout(syncTags(tags, req.user._id, post._id), 3000, []);
    if (post.tags.length) await withTimeout(post.save(), 3000, null);
    const plainPost = {
      ...toPlainPost(post),
      author: {
        _id: String(req.user._id),
        id: String(req.user._id),
        username: req.user.username,
        avatarUrl: req.user.avatarUrl || ''
      },
      tags: []
    };
    broadcast({ type: 'post:created', postId: post._id.toString(), caption: post.caption, username: req.user.username });
    res.status(201).json({ post: plainPost });
  } catch (error) {
    if (error.name === 'PayloadTooLargeError') {
      return res.status(413).json({ message: 'File is too large.' });
    }

    if (!isLocalFallbackEnabled()) {
      return res.status(503).json({ message: 'Post could not be saved. Check the database connection.' });
    }

    const post = createMemoryPost({ caption, imageUrl, mediaType, location, visibility, author: req.user, tags });
    broadcast({ type: 'post:created', postId: post._id, caption: post.caption, username: req.user.username });
    return res.status(201).json({ post, warning: 'Saved in local memory because the database is unavailable.' });
  }
}

export async function updatePost(req, res) {
  if (isMemoryPostId(req.params.id)) return res.status(404).json({ message: 'Local post not found' });

  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });
  if (!post.author.equals(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
  const { caption, imageUrl, mediaType, location, visibility, tags } = req.body;
  if (caption !== undefined) post.caption = caption;
  if (imageUrl !== undefined) post.imageUrl = imageUrl;
  if (mediaType !== undefined) post.mediaType = mediaType;
  if (location !== undefined) post.location = location;
  if (visibility !== undefined) post.visibility = visibility;
  if (tags !== undefined) post.tags = await syncTags(tags, req.user._id, post._id);
  await post.save();
  res.json({ post });
}

export async function likePost(req, res) {
  const memoryPost = findMemoryPost(req.params.id);
  if (memoryPost) {
    const likes = setMemoryPostLike(req.params.id, req.user._id, true);
    createLocalNotification({
      sender: req.user,
      receiver: memoryPost.author,
      type: 'post_like',
      post: memoryPost,
      text: `${req.user.username} liked your post.`
    });
    broadcast({ type: 'post:liked', postId: req.params.id, likes });
    return res.json({ likes });
  }
  if (isMemoryPostId(req.params.id)) return res.status(404).json({ message: 'Local post not found' });

  const post = await Post.findById(req.params.id).populate('author', 'username avatarUrl');
  if (!post) return res.status(404).json({ message: 'Post not found' });
  const alreadyLiked = post.likes.some((id) => id.equals(req.user._id));
  if (!alreadyLiked) {
    post.likes.push(req.user._id);
    await post.save();
    createNotification({
      sender: req.user._id,
      receiver: post.author._id,
      type: 'post_like',
      post: post._id,
      text: `${req.user.username} liked your post.`
    }).catch(() => {});
  }
  const likes = post.likes.map((id) => id.toString());
  broadcast({ type: 'post:liked', postId: post._id.toString(), likes });
  res.json({ likes });
}

export async function unlikePost(req, res) {
  const memoryPost = findMemoryPost(req.params.id);
  if (memoryPost) {
    const likes = setMemoryPostLike(req.params.id, req.user._id, false);
    broadcast({ type: 'post:liked', postId: req.params.id, likes });
    return res.json({ likes });
  }
  if (isMemoryPostId(req.params.id)) return res.status(404).json({ message: 'Local post not found' });

  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });
  post.likes = post.likes.filter((id) => !id.equals(req.user._id));
  await post.save();
  const likes = post.likes.map((id) => id.toString());
  broadcast({ type: 'post:liked', postId: post._id.toString(), likes });
  res.json({ likes });
}

export async function deletePost(req, res) {
  const memoryArchiveResult = archiveMemoryPost(req.params.id, req.user);
  if (memoryArchiveResult === false) return res.status(403).json({ message: 'Forbidden' });
  if (memoryArchiveResult === true) {
    broadcast({ type: 'post:deleted', postId: req.params.id });
    return res.status(204).end();
  }
  if (isMemoryPostId(req.params.id)) return res.status(404).json({ message: 'Local post not found' });

  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });
  if (!post.author.equals(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
  post.isArchived = true;
  await post.save();
  broadcast({ type: 'post:deleted', postId: req.params.id });
  res.status(204).end();
}
