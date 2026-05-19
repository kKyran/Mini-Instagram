import { Comment } from '../models/Comment.js';
import { Post } from '../models/Post.js';
import { broadcast } from '../websocket.js';
import { createLocalNotification, createNotification } from '../utils/notifications.js';
import { createMemoryComment, deleteMemoryComment, findMemoryPost, isMemoryPostId, listMemoryComments } from '../utils/localStore.js';

export async function listComments(req, res) {
  if (findMemoryPost(req.params.postId)) {
    return res.json({ comments: listMemoryComments(req.params.postId) });
  }
  if (isMemoryPostId(req.params.postId)) return res.json({ comments: [] });

  const comments = await Comment.find({ post: req.params.postId, isDeleted: false })
    .sort({ createdAt: 1 })
    .populate('author', 'username avatarUrl');
  res.json({ comments });
}

export async function createComment(req, res) {
  const memoryPost = findMemoryPost(req.params.postId);
  if (memoryPost) {
    const comment = createMemoryComment({
      postId: req.params.postId,
      body: req.body.body,
      author: req.user,
      clientId: req.body.clientId
    });
    createLocalNotification({
      sender: req.user,
      receiver: memoryPost.author,
      type: 'comment',
      post: memoryPost,
      comment,
      text: `${req.user.username} commented: ${comment.body}`
    });
    broadcast({ type: 'comment:created', postId: req.params.postId, comment });
    return res.status(201).json({ comment });
  }
  if (isMemoryPostId(req.params.postId)) return res.status(404).json({ message: 'Local post not found' });

  const post = await Post.findById(req.params.postId).populate('author', 'username avatarUrl');
  if (!post) return res.status(404).json({ message: 'Post not found' });
  const comment = await Comment.create({ body: req.body.body, post: post._id, author: req.user._id });
  const populated = await comment.populate('author', 'username avatarUrl');
  const publicComment = { ...populated.toObject(), clientId: req.body.clientId || '' };
  createNotification({
    sender: req.user._id,
    receiver: post.author._id,
    type: 'comment',
    post: post._id,
    comment: comment._id,
    text: `${req.user.username} commented: ${comment.body}`
  }).catch(() => {});
  broadcast({ type: 'comment:created', postId: post._id.toString(), comment: publicComment });
  res.status(201).json({ comment: publicComment });
}

export async function updateComment(req, res) {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });
  if (!comment.author.equals(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
  comment.body = req.body.body ?? comment.body;
  comment.editedAt = new Date();
  await comment.save();
  res.json({ comment });
}

export async function deleteComment(req, res) {
  const memoryComment = deleteMemoryComment(req.params.id, req.user);
  if (memoryComment === false) return res.status(403).json({ message: 'Forbidden' });
  if (memoryComment) {
    broadcast({ type: 'comment:deleted', postId: memoryComment.post, commentId: memoryComment._id });
    return res.status(204).end();
  }

  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });
  if (!comment.author.equals(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
  comment.isDeleted = true;
  await comment.save();
  broadcast({ type: 'comment:deleted', postId: comment.post.toString(), commentId: comment._id.toString() });
  res.status(204).end();
}
