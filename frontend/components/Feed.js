'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { PostCard } from './PostCard';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getAuthorId(post) {
  return post?.author?._id || post?.author?.id;
}

function isOwnPost(post, user) {
  return String(getAuthorId(post) || '') === String(user?.id || '') || post?.author?.username === user?.username;
}

function isFollowingPost(post, user) {
  const authorId = String(getAuthorId(post) || '');
  return Boolean(authorId && user?.following?.some((id) => String(id) === authorId));
}

function mergePosts(serverPosts, currentPosts) {
  const nextPosts = [...(serverPosts || [])];
  const seen = new Set(nextPosts.map((post) => post._id));
  const clientCreatedPosts = (currentPosts || []).filter((post) => (
    (post?.isLocalOnly || post?.isClientCreated) && !seen.has(post._id)
  ));
  return [...clientCreatedPosts, ...nextPosts];
}

export function Feed({ initialPosts }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState(initialPosts || []);

  useEffect(() => {
    const token = getSavedToken();
    search();

    let ws;
    const wsTimer = setTimeout(() => {
      if (!token) return;
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
      ws = new WebSocket(`${wsUrl}?token=${token}`);
      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === 'post:deleted') setPosts((current) => current.filter((post) => post._id !== payload.postId));
        if (payload.type === 'post:created') search();
        if (payload.type === 'post:liked') {
          setPosts((current) => current.map((post) => (post._id === payload.postId ? { ...post, likes: payload.likes || [] } : post)));
        }
        if (payload.type === 'comment:created') {
          setPosts((current) => current.map((post) => (
            post._id === payload.postId ? { ...post, commentCount: (post.commentCount || 0) + 1 } : post
          )));
        }
        if (payload.type === 'comment:deleted') {
          setPosts((current) => current.map((post) => (
            post._id === payload.postId ? { ...post, commentCount: Math.max(0, (post.commentCount || 0) - 1) } : post
          )));
        }
        if (['post:liked', 'comment:created', 'comment:deleted'].includes(payload.type)) {
          window.dispatchEvent(new CustomEvent('mini-instagram:post-ws', { detail: payload }));
        }
      };
    }, 0);

    window.addEventListener('mini-instagram:post-created', addCreatedPost);
    window.addEventListener('mini-instagram:follow-changed', search);
    window.addEventListener('mini-instagram:post-archived', removeArchivedPost);
    return () => {
      clearTimeout(wsTimer);
      if (ws?.readyState === WebSocket.OPEN) ws.close();
      if (ws?.readyState === WebSocket.CONNECTING) ws.addEventListener('open', () => ws.close(), { once: true });
      window.removeEventListener('mini-instagram:post-created', addCreatedPost);
      window.removeEventListener('mini-instagram:follow-changed', search);
      window.removeEventListener('mini-instagram:post-archived', removeArchivedPost);
    };
  }, []);

  function getSavedToken() {
    try {
      return JSON.parse(localStorage.getItem('mini-instagram-auth') || '{}').token;
    } catch {
      return null;
    }
  }

  function removeArchivedPost(event) {
    const postId = event?.detail?.postId;
    if (!postId) return;
    setPosts((current) => current.filter((post) => post._id !== postId));
  }

  function addCreatedPost(event) {
    const post = event?.detail?.post;
    if (!post?._id) {
      search();
      return;
    }

    setPosts((current) => {
      if (current.some((item) => item._id === post._id)) return current;
      return [{ ...post, isClientCreated: true }, ...current];
    });
  }

  async function search(event) {
    event?.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/api/posts`);
      const data = await res.json();
      setPosts((current) => mergePosts(data.posts, current));
    } catch {
      setPosts((current) => current);
    }
  }

  const visiblePosts = posts.filter((post) => isOwnPost(post, user) || isFollowingPost(post, user));

  return (
    <>
      {visiblePosts.length ? visiblePosts.map((post) => <PostCard post={post} key={post._id} />) : (
        <div className="empty-feed">
          <strong>No posts yet</strong>
          <span>Follow someone or create your first post.</span>
        </div>
      )}
    </>
  );
}
