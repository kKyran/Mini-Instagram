'use client';

import { Bookmark, Heart, MessageCircle, Send, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { useAuth } from './AuthProvider';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function isVideoPost(post) {
  return post?.mediaType === 'video' || (typeof post?.imageUrl === 'string' && post.imageUrl.startsWith('data:video/'));
}

function postId(post) {
  return post?._id || post?.id;
}

function mergePosts(serverPosts, currentPosts) {
  const nextPosts = [...(serverPosts || [])];
  const seen = new Set(nextPosts.map((post) => postId(post)));
  const clientCreatedPosts = (currentPosts || []).filter((post) => (
    (post?.isLocalOnly || post?.isClientCreated) && !seen.has(postId(post))
  ));
  return [...clientCreatedPosts, ...nextPosts];
}

export function ReelsViewer({ initialPosts = [] }) {
  const { token, user } = useAuth();
  const [posts, setPosts] = useState(initialPosts);
  const [message, setMessage] = useState('');
  const [isSoundOn, setSoundOn] = useState(false);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState('');
  const [commentsByPost, setCommentsByPost] = useState({});
  const [draftsByPost, setDraftsByPost] = useState({});
  const listRef = useRef(null);
  const videoRefs = useRef(new Map());

  useEffect(() => {
    function addCreatedPost(event) {
      const post = event?.detail?.post;
      if (!postId(post)) {
        loadPosts();
        return;
      }

      setPosts((current) => {
        if (current.some((item) => postId(item) === postId(post))) return current;
        return [{ ...post, isClientCreated: true }, ...current];
      });
    }

    loadPosts();
    window.addEventListener('mini-instagram:post-created', addCreatedPost);
    return () => window.removeEventListener('mini-instagram:post-created', addCreatedPost);
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    const ws = new WebSocket(`${wsUrl}?token=${token}`);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'post:created') {
        loadPosts();
      }
      if (payload.type === 'post:deleted') {
        setPosts((current) => current.filter((post) => postId(post) !== payload.postId));
      }
      if (payload.type === 'post:liked') {
        setPosts((current) => current.map((post) => (
          postId(post) === payload.postId ? { ...post, likes: payload.likes || [] } : post
        )));
      }
      if (payload.type === 'comment:created') {
        setPosts((current) => current.map((post) => (
          postId(post) === payload.postId ? { ...post, commentCount: (post.commentCount || 0) + 1 } : post
        )));
        if (payload.comment) {
          setCommentsByPost((current) => {
            const currentComments = current[payload.postId] || [];
            if (currentComments.some((comment) => comment.id === payload.comment.id || comment._id === payload.comment._id)) return current;
            return { ...current, [payload.postId]: [...currentComments, payload.comment] };
          });
        }
      }
      if (payload.type === 'comment:deleted') {
        setPosts((current) => current.map((post) => (
          postId(post) === payload.postId ? { ...post, commentCount: Math.max(0, (post.commentCount || 0) - 1) } : post
        )));
        setCommentsByPost((current) => ({
          ...current,
          [payload.postId]: (current[payload.postId] || []).filter((comment) => comment._id !== payload.commentId && comment.id !== payload.commentId)
        }));
      }
    };
    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
      if (ws.readyState === WebSocket.CONNECTING) ws.addEventListener('open', () => ws.close(), { once: true });
    };
  }, [token]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.72) {
          video.muted = !isSoundOn;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: [0, 0.72, 1] });

    videoRefs.current.forEach((video) => observer.observe(video));
    return () => observer.disconnect();
  }, [isSoundOn, posts]);

  useEffect(() => {
    function scrollReels(direction) {
      const list = listRef.current;
      if (!list) return;
      list.scrollBy({ top: direction * list.clientHeight, behavior: 'smooth' });
    }

    function handleKeyDown(event) {
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (isTyping) return;
      if (['ArrowDown', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        scrollReels(1);
      }
      if (['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        scrollReels(-1);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function setSoundEnabled(nextValue, postId) {
    setSoundOn(nextValue);
    videoRefs.current.forEach((video, key) => {
      video.muted = !nextValue;
      video.volume = nextValue ? 1 : 0;
      if (nextValue && (!postId || key === postId)) video.play().catch(() => {});
    });
  }

  function toggleVideo(postId) {
    const video = videoRefs.current.get(postId);
    if (!video) return;
    if (!isSoundOn) {
      setSoundEnabled(true, postId);
      return;
    }

    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  async function loadPosts() {
    try {
      const res = await fetch(`${apiUrl}/api/posts`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load reels.');
      setPosts((current) => mergePosts(data.posts || [], current));
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function toggleLike(post) {
    if (!token || !user) return;
    const id = postId(post);
    const isLiked = (post.likes || []).some((id) => String(id) === String(user.id));
    const previousLikes = post.likes || [];
    const nextLikes = isLiked
      ? previousLikes.filter((id) => String(id) !== String(user.id))
      : [...previousLikes, user.id];

    setPosts((current) => current.map((item) => (
      postId(item) === id ? { ...item, likes: nextLikes } : item
    )));

    try {
      const res = await fetch(`${apiUrl}/api/posts/${id}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Like failed');
      setPosts((current) => current.map((item) => (
        postId(item) === id ? { ...item, likes: data.likes || [] } : item
      )));
    } catch {
      setPosts((current) => current.map((item) => (
        postId(item) === id ? { ...item, likes: previousLikes } : item
      )));
    }
  }

  async function loadComments(postId) {
    try {
      const res = await fetch(`${apiUrl}/api/posts/${postId}/comments`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Comments failed');
      setCommentsByPost((current) => ({ ...current, [postId]: data.comments || [] }));
    } catch {
      setCommentsByPost((current) => ({ ...current, [postId]: current[postId] || [] }));
    }
  }

  async function toggleComments(postId) {
    const nextPostId = activeCommentsPostId === postId ? '' : postId;
    setActiveCommentsPostId(nextPostId);
    if (nextPostId && !commentsByPost[nextPostId]) await loadComments(nextPostId);
  }

  async function submitComment(event, post) {
    event.preventDefault();
    const id = postId(post);
    const body = (draftsByPost[id] || '').trim();
    if (!token || !user || !body) return;

    const clientId = `reel-comment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticComment = {
      _id: clientId,
      clientId,
      body,
      author: { id: user.id, _id: user.id, username: user.username, avatarUrl: user.avatarUrl || '' },
      isOptimistic: true
    };

    setDraftsByPost((current) => ({ ...current, [id]: '' }));
    setCommentsByPost((current) => ({ ...current, [id]: [...(current[id] || []), optimisticComment] }));
    setPosts((current) => current.map((item) => (
      postId(item) === id ? { ...item, commentCount: (item.commentCount || 0) + 1 } : item
    )));

    try {
      const res = await fetch(`${apiUrl}/api/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body, clientId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Comment failed');
      setCommentsByPost((current) => ({
        ...current,
        [id]: (current[id] || []).map((comment) => (
          comment.clientId === clientId ? data.comment : comment
        ))
      }));
    } catch {
      setDraftsByPost((current) => ({ ...current, [id]: body }));
      setCommentsByPost((current) => ({
        ...current,
        [id]: (current[id] || []).filter((comment) => comment.clientId !== clientId)
      }));
      setPosts((current) => current.map((item) => (
        postId(item) === id ? { ...item, commentCount: Math.max(0, (item.commentCount || 0) - 1) } : item
      )));
    }
  }

  async function deleteComment(post, commentId) {
    if (!token || !commentId) return;
    const id = postId(post);
    const previousComments = commentsByPost[id] || [];
    setCommentsByPost((current) => ({
      ...current,
      [id]: (current[id] || []).filter((comment) => (comment._id || comment.id) !== commentId)
    }));
    setPosts((current) => current.map((item) => (
      postId(item) === id ? { ...item, commentCount: Math.max(0, (item.commentCount || 0) - 1) } : item
    )));

    try {
      const res = await fetch(`${apiUrl}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Delete failed');
    } catch {
      setCommentsByPost((current) => ({ ...current, [id]: previousComments }));
      setPosts((current) => current.map((item) => (
        postId(item) === id ? { ...item, commentCount: previousComments.length } : item
      )));
    }
  }

  return (
    <section className="reels-panel" aria-label="Reels">
      <div className="reels-list" ref={listRef} tabIndex={0}>
        {posts.length ? posts.map((post) => {
          const id = postId(post);
          const isLiked = (post.likes || []).some((id) => String(id) === String(user?.id));
          const comments = commentsByPost[id] || [];
          const isCommentsOpen = activeCommentsPostId === id;
          return (
          <article className="reel-card" key={id}>
            <div className="reel-media">
              {post.imageUrl ? (
                isVideoPost(post) ? (
                  <video
                    src={post.imageUrl}
                    autoPlay
                    loop
                    muted={!isSoundOn}
                    playsInline
                    onClick={() => toggleVideo(id)}
                    ref={(node) => {
                      if (node) videoRefs.current.set(id, node);
                      else videoRefs.current.delete(id);
                    }}
                  />
                ) : (
                  <img src={post.imageUrl} alt="" />
                )
              ) : (
                <div className="reel-placeholder" aria-hidden="true" />
              )}
            </div>

            <div className="reel-info">
              <div className="reel-author">
                <Avatar user={post.author} />
                <strong>{post.author?.username || 'Unknown user'}</strong>
              </div>
              <p>{post.caption}</p>
              <div className="reel-tags">
                {(post.tags || []).map((tag, index) => {
                  const label = tag.name || tag;
                  const key = tag._id || tag.slug || `${label}-${index}`;
                  return <span key={key}>#{label}</span>;
                })}
              </div>
            </div>

            <aside className="reel-actions" aria-label="Reel actions">
              <button type="button" onClick={() => setSoundEnabled(!isSoundOn, id)} aria-label={isSoundOn ? 'Mute video' : 'Turn sound on'}>
                {isSoundOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
              </button>
              <button type="button" className={isLiked ? 'is-active' : ''} onClick={() => toggleLike(post)} aria-label={isLiked ? 'Unlike reel' : 'Like reel'}>
                <Heart size={22} fill={isLiked ? 'currentColor' : 'none'} />{post.likes?.length || 0}
              </button>
              <button type="button" className={isCommentsOpen ? 'is-active' : ''} onClick={() => toggleComments(id)} aria-label="Open comments">
                <MessageCircle size={22} />{post.commentCount || 0}
              </button>
              <span><Send size={22} /></span>
              <span><Bookmark size={22} /></span>
            </aside>

            {isCommentsOpen ? (
              <section className="reel-comments" aria-label="Reel comments">
                <div className="reel-comments__list">
                  {comments.length ? comments.map((comment) => (
                    <article className="reel-comment" key={comment._id || comment.id || comment.clientId}>
                      <Avatar user={comment.author} />
                      <div>
                        <strong>{comment.author?.username || 'Unknown'}</strong>
                        <p>{comment.body}{comment.isOptimistic ? ' · sending...' : ''}</p>
                      </div>
                      {(comment.author?._id === user?.id || comment.author?.id === user?.id || comment.author?.username === user?.username) && !comment.isOptimistic ? (
                        <button type="button" className="reel-comment__delete" onClick={() => deleteComment(post, comment._id || comment.id)} aria-label="Delete comment">
                          <X size={13} />
                        </button>
                      ) : null}
                    </article>
                  )) : <p className="reel-comments__empty">No comments yet.</p>}
                </div>
                <form className="reel-comment-form" onSubmit={(event) => submitComment(event, post)}>
                  <input
                    value={draftsByPost[id] || ''}
                    onChange={(event) => setDraftsByPost((current) => ({ ...current, [id]: event.target.value }))}
                    placeholder="Write a comment"
                  />
                  <button type="submit" disabled={!token}>Send</button>
                </form>
              </section>
            ) : null}
          </article>
        );
        }) : (
          <div className="reels-empty">
            <strong>No reels yet</strong>
            <span>{message || 'Posts will appear here when people share them.'}</span>
          </div>
        )}
      </div>
    </section>
  );
}
