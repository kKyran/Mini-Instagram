'use client';

import { useEffect, useState } from 'react';
import { Archive, Bookmark, Heart, MessageCircle, MoreVertical, Send, Trash2 } from 'lucide-react';
import { apiUrl } from '../lib/api-config';
import { Avatar } from './Avatar';
import { useAuth } from './AuthProvider';

function getAuthorId(post) {
  return post?.author?._id || post?.author?.id;
}

function isOwnPost(post, user) {
  return String(getAuthorId(post) || '') === String(user?.id || '') || post?.author?.username === user?.username;
}

export function PostCard({ post, showArchiveAction = true }) {
  const auth = useAuth() || {};
  const { token, user } = auth;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [likes, setLikes] = useState(post.likes || []);
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [isCommentsOpen, setCommentsOpen] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [error, setError] = useState('');
  const tags = post.tags || [];
  const isVideo = post.mediaType === 'video' || (typeof post.imageUrl === 'string' && post.imageUrl.startsWith('data:video/'));
  const canArchive = showArchiveAction && isOwnPost(post, user);
  const isLiked = likes.some((id) => String(id) === String(user?.id));

  useEffect(() => {
    function handlePostEvent(event) {
      const payload = event.detail;
      if (payload.postId !== post._id) return;
      if (payload.type === 'post:liked') setLikes(payload.likes || []);
      if (payload.type === 'comment:created') {
        setComments((current) => {
          if (current.some((comment) => comment._id === payload.comment._id || (payload.comment.clientId && comment.clientId === payload.comment.clientId))) {
            return current.map((comment) => (payload.comment.clientId && comment.clientId === payload.comment.clientId ? payload.comment : comment));
          }
          setCommentCount((count) => count + 1);
          return [...current, payload.comment];
        });
      }
      if (payload.type === 'comment:deleted') {
        setComments((current) => {
          if (!current.some((comment) => comment._id === payload.commentId)) return current;
          setCommentCount((count) => Math.max(0, count - 1));
          return current.filter((comment) => comment._id !== payload.commentId);
        });
      }
    }

    window.addEventListener('mini-instagram:post-ws', handlePostEvent);
    return () => window.removeEventListener('mini-instagram:post-ws', handlePostEvent);
  }, [post._id]);

  useEffect(() => {
    setLikes(post.likes || []);
    setCommentCount(post.commentCount || 0);
  }, [post.likes, post.commentCount]);

  async function archivePost() {
    if (!token || isArchiving) return;
    setError('');
    setIsArchiving(true);
    try {
      const res = await fetch(`${apiUrl}/api/posts/${post._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Post could not be hidden');
      }
      window.dispatchEvent(new CustomEvent('mini-instagram:post-archived', { detail: { postId: post._id } }));
      setIsMenuOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsArchiving(false);
    }
  }

  async function toggleLike() {
    if (!token) return;
    const previousLikes = likes;
    const userId = user?.id;
    const nextLikes = isLiked ? likes.filter((id) => String(id) !== String(userId)) : [...likes, userId].filter(Boolean);
    setLikes(nextLikes);
    const res = await fetch(`${apiUrl}/api/posts/${post._id}/like`, {
      method: isLiked ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) setLikes(data.likes || []);
    else setLikes(previousLikes);
  }

  async function loadComments() {
    const res = await fetch(`${apiUrl}/api/posts/${post._id}/comments`);
    const data = await res.json();
    if (res.ok) {
      setComments(data.comments || []);
      setCommentCount((data.comments || []).length);
    }
  }

  async function toggleComments() {
    const nextOpen = !isCommentsOpen;
    setCommentsOpen(nextOpen);
    if (nextOpen) await loadComments();
  }

  async function submitComment(event) {
    event.preventDefault();
    const body = commentBody.trim();
    if (!token || !body) return;
    const clientId = `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticComment = {
      _id: clientId,
      clientId,
      body,
      author: { id: user?.id, _id: user?.id, username: user?.username, avatarUrl: user?.avatarUrl },
      isOptimistic: true
    };
    setComments((current) => [...current, optimisticComment]);
    setCommentCount((current) => current + 1);
    setCommentBody('');
    const res = await fetch(`${apiUrl}/api/posts/${post._id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ body, clientId })
    });
    const data = await res.json();
    if (res.ok) {
      setComments((current) => current.map((comment) => (comment.clientId === clientId ? data.comment : comment)));
    } else {
      setComments((current) => current.filter((comment) => comment.clientId !== clientId));
      setCommentCount((current) => Math.max(0, current - 1));
      setCommentBody(body);
    }
  }

  async function deleteComment(commentId) {
    if (!token) return;
    const previousComments = comments;
    setComments((current) => current.filter((comment) => comment._id !== commentId));
    setCommentCount((current) => Math.max(0, current - 1));
    const res = await fetch(`${apiUrl}/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      setComments(previousComments);
      setCommentCount(previousComments.length);
    }
  }

  return (
    <article className="post-card">
      <header className="post-head">
        <Avatar user={post.author} />
        <div>
          <strong>{post.author?.username || 'Unknown user'}</strong>
          <p>{post.location || 'No location'} · just now</p>
        </div>
        {canArchive ? (
          <div className="post-menu-wrap">
            <button type="button" aria-label="More options" onClick={() => setIsMenuOpen((value) => !value)}>
              <MoreVertical size={18} />
            </button>
            {isMenuOpen ? (
              <div className="post-menu">
                <button type="button" onClick={archivePost} disabled={isArchiving}>
                  <Archive size={16} />
                  {isArchiving ? 'Hiding...' : 'Hide post'}
                </button>
              </div>
            ) : null}
          </div>
        ) : <span aria-hidden="true" />}
      </header>
      {error ? <p className="post-menu-error">{error}</p> : null}
      {post.imageUrl ? (
        isVideo ? <video src={post.imageUrl} controls /> : <img src={post.imageUrl} alt="" />
      ) : <div className="post-art" aria-hidden="true" />}
      <div className="post-body">
        <p>{post.caption}</p>
        <div className="tags">
          {tags.map((tag, index) => {
            const label = tag.name || tag;
            const key = tag._id || tag.slug || `${label}-${index}`;
            return <span className="tag" key={key}>#{label}</span>;
          })}
        </div>
        <footer className="post-actions">
          <button type="button" className={isLiked ? 'is-active' : ''} onClick={toggleLike}><Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />{likes.length} Like</button>
          <button type="button" onClick={toggleComments}><MessageCircle size={18} />{commentCount} comments</button>
          <span><Send size={18} />Share</span>
          <Bookmark size={18} />
        </footer>
        {isCommentsOpen ? (
          <section className="post-comments">
            <div className="post-comments__list">
              {comments.length ? comments.map((comment) => {
                const canDelete = comment.author?._id === user?.id || comment.author?.id === user?.id || comment.author?.username === user?.username;
                return (
                  <article className="post-comment" key={comment._id}>
                    <Avatar user={comment.author} />
                    <div>
                      <strong>{comment.author?.username || 'Unknown'}</strong>
                      <p>{comment.body}{comment.isOptimistic ? ' · sending...' : ''}</p>
                    </div>
                    {canDelete ? (
                      <button type="button" onClick={() => deleteComment(comment._id)} aria-label="Delete comment">
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </article>
                );
              }) : <p className="post-comments__empty">No comments yet.</p>}
            </div>
            <form className="post-comment-form" onSubmit={submitComment}>
              <input value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Write a comment" />
              <button type="submit">Send</button>
            </form>
          </section>
        ) : null}
      </div>
    </article>
  );
}
