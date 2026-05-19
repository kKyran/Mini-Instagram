'use client';

import { Bell, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { useAuth } from './AuthProvider';
import { Feed } from './Feed';
import { MessagesView } from './MessagesView';
import { NotificationsView } from './NotificationsView';
import { PostComposer } from './PostComposer';
import { ProfileSummary } from './ProfileSummary';
import { ReelsViewer } from './ReelsViewer';
import { SideNav } from './SideNav';
import { StoryComposer } from './StoryComposer';
import { StoryViewer } from './StoryViewer';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getAuthorKey(author) {
  return author?._id || author?.id || author?.username;
}

function mergeStories(incomingStories, currentStories) {
  const nextStories = [...(incomingStories || [])];
  const seen = new Set(nextStories.map((story) => story._id || story.id));
  const clientStories = (currentStories || []).filter((story) => (
    (story?.isLocalOnly || story?.isClientCreated) && !seen.has(story._id || story.id)
  ));
  return [...clientStories, ...nextStories];
}

function getStoriesFromStories(items) {
  const seen = new Set();
  return (items || []).reduce((stories, story) => {
    const author = story?.author;
    const key = getAuthorKey(author);
    if (!author?.username || !key || seen.has(key)) return stories;
    seen.add(key);
    stories.push({ ...author, storyId: story._id });
    return stories;
  }, []);
}

function getVisibleStories(stories, user) {
  return (stories || []).filter((story) => isOwnStory(story, user) || isFollowingStory(story, user));
}

function getOrderedStoryAuthors(stories, user) {
  const authors = getStoriesFromStories(getVisibleStories(stories, user));
  return authors.sort((left, right) => {
    const leftIsMe = isOwnStory(left, user);
    const rightIsMe = isOwnStory(right, user);
    if (leftIsMe && !rightIsMe) return -1;
    if (!leftIsMe && rightIsMe) return 1;
    return 0;
  });
}

function isOwnStory(story, user) {
  const author = story?.author || story;
  return String(author?._id || '') === String(user?.id || '') || String(author?.id || '') === String(user?.id || '') || author?.username === user?.username;
}

function isFollowingStory(story, user) {
  const authorId = String(story?.author?._id || story?.author?.id || story?._id || story?.id || '');
  return Boolean(authorId && user?.following?.some((id) => String(id) === authorId));
}

function StoriesRow({ stories, onViewStories }) {
  const { user } = useAuth();
  const storyAuthors = getOrderedStoryAuthors(stories, user);

  if (!storyAuthors.length) return null;

  return (
    <section className="stories-row" aria-label="Stories">
      {storyAuthors.map((story, index) => {
        const isMe = isOwnStory(story, user);
        const label = isMe ? 'You' : story.username;
        return (
          <div className="story" key={getAuthorKey(story)}>
            <Avatar
              as="button"
              type="button"
              user={story}
              className={`story-ring story-ring--${index % 4}`}
              onClick={() => onViewStories(story)}
            />
            <span>{label}</span>
          </div>
        );
      })}
    </section>
  );
}

function UserSearch({ stories, onViewStories }) {
  const { token, user, persist } = useAuth();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');

  const searchUsers = useCallback(async (nextQuery) => {
    if (!token || !nextQuery.trim()) {
      setUsers([]);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/users?q=${encodeURIComponent(nextQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Search failed');
      setUsers((data.users || []).filter((item) => item.id !== user?.id));
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  }, [token, user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(query), 260);
    return () => clearTimeout(timer);
  }, [query, searchUsers]);

  async function toggleFollow(target) {
    const isFollowing = user?.following?.includes(target.id);
    const previousUser = user;
    const previousUsers = users;
    const nextFollowing = isFollowing
      ? (user?.following || []).filter((id) => id !== target.id)
      : [...(user?.following || []), target.id];
    const nextUser = { ...user, following: nextFollowing };
    const nextTarget = {
      ...target,
      followers: isFollowing
        ? (target.followers || []).filter((id) => id !== user?.id)
        : [...(target.followers || []), user?.id].filter(Boolean)
    };

    persist(nextUser, token);
    setUsers((current) => current.map((item) => (item.id === target.id ? nextTarget : item)));
    window.dispatchEvent(new Event('mini-instagram:follow-changed'));

    try {
      const res = await fetch(`${apiUrl}/api/users/${target.id}/follow`, {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Follow failed');
      persist(data.user, token);
      setUsers((current) => current.map((item) => (item.id === target.id ? data.target : item)));
    } catch (error) {
      persist(previousUser, token);
      setUsers(previousUsers);
      setMessage(error.message);
      window.dispatchEvent(new Event('mini-instagram:follow-changed'));
    }
  }

  function openUserStory(target) {
    const selectedStories = stories.filter((story) => {
      const authorId = story?.author?._id || story?.author?.id;
      return authorId === target.id || story?.author?.username === target.username;
    });
    if (selectedStories.length) onViewStories(selectedStories);
  }

  return (
    <div className="social-search-wrap">
      <div className="social-search">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" />
        <Bell size={18} />
      </div>
      {query.trim() ? (
        <div className="user-results">
          {users.length ? users.map((target) => {
            const isFollowing = user?.following?.includes(target.id);
            const hasStory = stories.some((story) => {
              const authorId = story?.author?._id || story?.author?.id;
              return authorId === target.id || story?.author?.username === target.username;
            });
            return (
              <div className="user-result" key={target.id}>
                <Avatar
                  as="button"
                  type="button"
                  user={target}
                  className={hasStory ? 'has-story' : ''}
                  onClick={() => openUserStory(target)}
                  aria-label={`View ${target.username} story`}
                />
                <div>
                  <strong>{target.username}</strong>
                  <span>{target.followers?.length || 0} followers</span>
                </div>
                <button type="button" className={isFollowing ? 'secondary' : ''} onClick={() => toggleFollow(target)}>
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            );
          }) : <p>{message || 'No users found'}</p>}
        </div>
      ) : null}
    </div>
  );
}

export function FeedShell({ initialPosts, initialView = 'home' }) {
  const { user, token } = useAuth();
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [activeView, setActiveView] = useState(initialView);
  const [isStoryComposerOpen, setStoryComposerOpen] = useState(false);
  const [viewerStories, setViewerStories] = useState([]);
  const [viewerAuthorKey, setViewerAuthorKey] = useState('');
  const [stories, setStories] = useState([]);
  const [unreadMessageSenders, setUnreadMessageSenders] = useState([]);
  const [messagesCache, setMessagesCache] = useState({ contacts: [], activeId: '', threads: {} });

  const refreshStories = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/stories`);
      const data = await res.json();
      setStories((current) => mergeStories(data.stories, current));
    } catch {
      setStories((current) => current);
    }
  }, []);

  useEffect(() => {
    function addCreatedStory(event) {
      const story = event?.detail?.story;
      if (!story?._id && !story?.id) {
        refreshStories();
        return;
      }

      setStories((current) => {
        const storyId = story._id || story.id;
        if (current.some((item) => (item._id || item.id) === storyId)) return current;
        return [{ ...story, isClientCreated: true }, ...current];
      });
    }

    refreshStories();
    window.addEventListener('mini-instagram:story-created', addCreatedStory);
    return () => window.removeEventListener('mini-instagram:story-created', addCreatedStory);
  }, [refreshStories]);

  useEffect(() => {
    let ws;
    if (!token) return undefined;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    ws = new WebSocket(`${wsUrl}?token=${token}`);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'story:created') {
        if (payload.story) {
          window.dispatchEvent(new CustomEvent('mini-instagram:story-created', { detail: { story: payload.story } }));
        } else {
          refreshStories();
        }
      }
      if (payload.type === 'story:liked') refreshStories();
    };

    return () => {
      if (ws?.readyState === WebSocket.OPEN) ws.close();
      if (ws?.readyState === WebSocket.CONNECTING) ws.addEventListener('open', () => ws.close(), { once: true });
    };
  }, [refreshStories, token]);

  const refreshUnreadMessages = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) return;
      setUnreadMessageSenders((data.contacts || []).filter((contact) => contact.unreadCount > 0).map((contact) => contact.id));
    } catch {
      setUnreadMessageSenders((current) => current);
    }
  }, [token]);

  useEffect(() => {
    function handleMessagesRead(event) {
      const contactId = event?.detail?.contactId;
      if (!contactId) {
        setUnreadMessageSenders([]);
        return;
      }
      setUnreadMessageSenders((current) => current.filter((id) => String(id) !== String(contactId)));
    }

    refreshUnreadMessages();
    window.addEventListener('mini-instagram:messages-read', handleMessagesRead);
    return () => window.removeEventListener('mini-instagram:messages-read', handleMessagesRead);
  }, [refreshUnreadMessages]);

  useEffect(() => {
    let ws;
    if (!token || !user) return undefined;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    ws = new WebSocket(`${wsUrl}?token=${token}`);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type !== 'message:created') return;
      window.dispatchEvent(new CustomEvent('mini-instagram:message-created', { detail: { message: payload.message } }));
      const senderId = payload.message?.sender?.id;
      if (!senderId || String(senderId) === String(user.id)) return;
      setUnreadMessageSenders((current) => (
        current.some((id) => String(id) === String(senderId)) ? current : [...current, senderId]
      ));
    };

    return () => {
      if (ws?.readyState === WebSocket.OPEN) ws.close();
      if (ws?.readyState === WebSocket.CONNECTING) ws.addEventListener('open', () => ws.close(), { once: true });
    };
  }, [token, user?.id]);

  const ownStories = stories.filter((story) => isOwnStory(story, user));
  const hasOwnStory = ownStories.length > 0;
  const storyAuthors = getOrderedStoryAuthors(stories, user);

  function openStoryGroup(author) {
    const selectedStories = stories.filter((story) => getAuthorKey(story.author) === getAuthorKey(author));
    setViewerAuthorKey(getAuthorKey(author));
    setViewerStories(selectedStories);
  }

  function openStories(selectedStories) {
    setViewerAuthorKey(getAuthorKey(selectedStories?.[0]?.author));
    setViewerStories(selectedStories);
  }

  function openNextStoryGroup() {
    if (!storyAuthors.length) return;
    const activeIndex = storyAuthors.findIndex((author) => getAuthorKey(author) === viewerAuthorKey);
    const nextAuthor = storyAuthors[activeIndex + 1];
    if (nextAuthor) openStoryGroup(nextAuthor);
  }

  function openPreviousStoryGroup() {
    if (!storyAuthors.length) return;
    const activeIndex = storyAuthors.findIndex((author) => getAuthorKey(author) === viewerAuthorKey);
    const previousAuthor = storyAuthors[activeIndex - 1];
    if (previousAuthor) openStoryGroup(previousAuthor);
  }

  function handleProfileStoryClick() {
    if (hasOwnStory) {
      setViewerAuthorKey(getAuthorKey(ownStories[0]?.author));
      setViewerStories(ownStories);
      return;
    }
    setStoryComposerOpen(true);
  }

  return (
    <>
      <aside className={`left-rail${activeView === 'reels' ? ' left-rail--reels' : ''}${activeView === 'messages' || activeView === 'notifications' ? ' left-rail--messages' : ''}`}>
        <ProfileSummary initialPosts={initialPosts} onStoryClick={handleProfileStoryClick} hasStory={hasOwnStory} />
        <SideNav
          activeView={activeView}
          unreadMessages={unreadMessageSenders.length}
          onCreate={() => setComposerOpen((value) => !value)}
          onViewChange={setActiveView}
        />
      </aside>
      <section className={`social-center${activeView === 'home' ? ' social-center--home' : ''}${activeView === 'reels' ? ' social-center--reels' : ''}${activeView === 'messages' ? ' social-center--messages' : ''}${activeView === 'notifications' ? ' social-center--notifications' : ''}`}>
        {activeView === 'home' ? <UserSearch stories={stories} onViewStories={openStories} /> : null}

        {activeView === 'home' ? <StoriesRow stories={stories} onViewStories={openStoryGroup} /> : null}

        {isStoryComposerOpen ? <StoryComposer onDone={() => setStoryComposerOpen(false)} /> : null}
        {viewerStories.length ? (
          <StoryViewer
            stories={viewerStories}
            hasPreviousStoryGroup={storyAuthors.some((author, index) => getAuthorKey(author) === viewerAuthorKey && index > 0)}
            hasNextStoryGroup={storyAuthors.some((author, index) => getAuthorKey(author) === viewerAuthorKey && index < storyAuthors.length - 1)}
            onPreviousStoryGroup={openPreviousStoryGroup}
            onNextStoryGroup={openNextStoryGroup}
            onDone={() => {
              setViewerAuthorKey('');
              setViewerStories([]);
            }}
            onCreateStory={() => {
              setViewerAuthorKey('');
              setViewerStories([]);
              setStoryComposerOpen(true);
            }}
          />
        ) : null}
        {isComposerOpen ? <PostComposer onDone={() => setComposerOpen(false)} /> : null}
        {activeView === 'reels' ? <ReelsViewer initialPosts={initialPosts} /> : null}
        {activeView === 'messages' ? <MessagesView cachedState={messagesCache} onCacheChange={setMessagesCache} /> : null}
        {activeView === 'notifications' ? <NotificationsView /> : null}
        {activeView === 'home' ? <Feed initialPosts={initialPosts} /> : null}
      </section>
    </>
  );
}
