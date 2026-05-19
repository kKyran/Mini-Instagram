'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../lib/api-config';
import { Avatar } from './Avatar';
import { useAuth } from './AuthProvider';

function countItems(value) {
  return Array.isArray(value) ? value.length : 0;
}

function isOwnPost(post, user) {
  const author = post?.author;
  return author?._id === user?.id || author?.id === user?.id || author?.username === user?.username;
}

function countOwnPosts(posts, user) {
  if (!user) return 0;
  return (posts || []).filter((post) => isOwnPost(post, user)).length;
}

export function ProfileSummary({ initialPosts = [], onStoryClick, hasStory }) {
  const { user } = useAuth();
  const [postCount, setPostCount] = useState(0);

  const refreshPostCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${apiUrl}/api/posts`);
      const data = await res.json();
      setPostCount(countOwnPosts(data.posts, user));
    } catch {
      setPostCount((current) => current);
    }
  }, [user]);

  useEffect(() => {
    setPostCount(countOwnPosts(initialPosts, user));
    refreshPostCount();
    window.addEventListener('mini-instagram:post-created', handlePostCreated);
    return () => window.removeEventListener('mini-instagram:post-created', handlePostCreated);
  }, [initialPosts, refreshPostCount, user]);

  function handlePostCreated(event) {
    const post = event?.detail?.post;
    if (post && isOwnPost(post, user)) {
      setPostCount((current) => current + 1);
      return;
    }

    refreshPostCount();
  }

  if (!user) return null;

  return (
    <aside className="profile-summary">
      <Avatar
        as="button"
        type="button"
        user={user}
        className={`avatar--profile profile-summary__avatar${hasStory ? ' has-story' : ''}`}
        onClick={onStoryClick}
        aria-label={hasStory ? 'View story' : 'Create story'}
      />
      <div className="profile-summary__identity">
        <strong>{user.username}</strong>
        <span>@{user.username}</span>
      </div>
      <div className="profile-summary__stats">
        <span><b>{countItems(user.followers)}</b>Follower</span>
        <span><b>{countItems(user.following)}</b>Following</span>
        <span><b>{postCount}</b>Post</span>
      </div>
    </aside>
  );
}
