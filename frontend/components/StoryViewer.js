'use client';

import { ChevronLeft, ChevronRight, Heart, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar } from './Avatar';
import { useAuth } from './AuthProvider';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getAuthorName(story) {
  return story?.author?.username || 'Unknown';
}

function getAuthor(story) {
  return story?.author || { username: getAuthorName(story) };
}

export function StoryViewer({
  stories = [],
  initialIndex = 0,
  hasPreviousStoryGroup = false,
  hasNextStoryGroup = false,
  onPreviousStoryGroup,
  onNextStoryGroup,
  onDone,
  onCreateStory
}) {
  const { token, user } = useAuth();
  const [index, setIndex] = useState(initialIndex);
  const [likesByStory, setLikesByStory] = useState(() => Object.fromEntries(stories.map((item) => [item._id || item.id, item.likes || []])));
  const story = stories[index];
  const canGoBack = index > 0;
  const canGoNext = index < stories.length - 1;
  const canGoBackward = canGoBack || hasPreviousStoryGroup;
  const canGoForward = canGoNext || hasNextStoryGroup;
  const storyId = story?._id || story?.id;
  const likes = likesByStory[storyId] || [];
  const isLiked = likes.some((id) => String(id) === String(user?.id));

  const progress = useMemo(() => {
    if (!stories.length) return [];
    return stories.map((_, itemIndex) => itemIndex <= index);
  }, [index, stories]);

  useEffect(() => {
    setIndex(initialIndex);
    setLikesByStory(Object.fromEntries(stories.map((item) => [item._id || item.id, item.likes || []])));
  }, [initialIndex, stories]);

  useEffect(() => {
    if (!token) return undefined;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    const ws = new WebSocket(`${wsUrl}?token=${token}`);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'story:liked') {
        setLikesByStory((current) => ({ ...current, [payload.storyId]: payload.likes || [] }));
      }
    };
    return () => ws.close();
  }, [token]);

  async function toggleStoryLike() {
    if (!token || !storyId) return;
    const res = await fetch(`${apiUrl}/api/stories/${storyId}/like`, {
      method: isLiked ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) setLikesByStory((current) => ({ ...current, [storyId]: data.likes || [] }));
  }

  function goForward() {
    if (canGoNext) {
      setIndex((value) => value + 1);
      return;
    }
    onNextStoryGroup?.();
  }

  function goBackward() {
    if (canGoBack) {
      setIndex((value) => value - 1);
      return;
    }
    onPreviousStoryGroup?.();
  }

  if (!story) return null;

  return (
    <div className="story-modal" role="dialog" aria-modal="true" aria-label="View story">
      <section className="story-viewer">
        <button type="button" className="story-close" onClick={onDone} aria-label="Close story">
          <X size={22} />
        </button>

        <header className="story-viewer__header">
          <div className="story-progress" aria-hidden="true">
            {progress.map((isActive, itemIndex) => (
              <span className={isActive ? 'is-active' : ''} key={`${story._id || story.id}-${itemIndex}`} />
            ))}
          </div>
          <div className="story-viewer__author">
            <Avatar user={getAuthor(story)} />
            <strong>{getAuthorName(story)}</strong>
          </div>
        </header>

        <div className="story-viewer__media">
          {story.mediaType === 'video' ? (
            <video src={story.mediaUrl} controls autoPlay />
          ) : (
            <img src={story.mediaUrl} alt="" />
          )}
          {(story.overlays || []).map((overlay) => (
            <span
              className={`story-overlay story-overlay--${overlay.type}`}
              key={overlay._id || `${overlay.type}-${overlay.value}-${overlay.x}-${overlay.y}`}
              style={{ left: `${overlay.x}%`, top: `${overlay.y}%` }}
            >
              {overlay.value}
            </span>
          ))}
        </div>

        {canGoBackward ? (
          <button type="button" className="story-viewer__nav story-viewer__nav--prev" onClick={goBackward} aria-label="Previous story">
            <ChevronLeft size={26} />
          </button>
        ) : null}
        {canGoForward ? (
          <button type="button" className="story-viewer__nav story-viewer__nav--next" onClick={goForward} aria-label="Next story">
            <ChevronRight size={26} />
          </button>
        ) : null}

        {onCreateStory ? (
          <button type="button" className="story-viewer__add" onClick={onCreateStory}>
            <Plus size={18} />Add story
          </button>
        ) : null}
        <button type="button" className={`story-viewer__like${isLiked ? ' is-active' : ''}`} onClick={toggleStoryLike}>
          <Heart size={20} />{likes.length}
        </button>
      </section>
    </div>
  );
}
