'use client';

import { Heart, MessageCircle, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar } from './Avatar';
import { useAuth } from './AuthProvider';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getIcon(type) {
  if (type === 'comment') return <MessageCircle size={16} />;
  if (type === 'follow') return <UserPlus size={16} />;
  return <Heart size={16} />;
}

function getThumb(notification) {
  if (notification.post?.imageUrl) return notification.post.imageUrl;
  if (notification.story?.mediaUrl) return notification.story.mediaUrl;
  return '';
}

function formatTime(value) {
  if (!value) return 'now';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function NotificationsView() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');

  async function loadNotifications() {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Notifications could not be loaded');
      setNotifications(data.notifications || []);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    const ws = new WebSocket(`${wsUrl}?token=${token}`);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'notification:new') {
        setNotifications((current) => [payload.notification, ...current.filter((item) => item.id !== payload.notification.id)]);
      }
    };
    return () => ws.close();
  }, [token]);

  const visibleNotifications = useMemo(() => notifications.filter((notification) => {
    if (filter === 'all') return true;
    if (filter === 'likes') return notification.type === 'post_like' || notification.type === 'story_like';
    if (filter === 'comments') return notification.type === 'comment';
    if (filter === 'follows') return notification.type === 'follow';
    return true;
  }), [filter, notifications]);

  return (
    <section className="notifications-panel" aria-label="Notifications">
      <header>
        <h2>Notifications</h2>
        <button type="button" onClick={loadNotifications} aria-label="Refresh notifications"><X size={20} /></button>
      </header>
      <div className="notification-tabs">
        {[
          ['all', 'All'],
          ['likes', 'Likes'],
          ['comments', 'Comments'],
          ['follows', 'Follows']
        ].map(([value, label]) => (
          <button type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)} key={value}>
            {label}
          </button>
        ))}
      </div>
      <h3>This week</h3>
      {message ? <p className="notification-empty">{message}</p> : null}
      <div className="notification-list">
        {visibleNotifications.length ? visibleNotifications.map((notification) => {
          const thumb = getThumb(notification);
          const isVideoThumb = notification.story?.mediaType === 'video' || notification.post?.mediaType === 'video' || thumb.startsWith('data:video/');
          return (
            <article className="notification-item" key={notification.id}>
              <Avatar user={notification.sender} />
              <div>
                <p><strong>{notification.sender?.username || 'Someone'}</strong> {notification.text?.replace(`${notification.sender?.username || ''} `, '')}</p>
                <span>{getIcon(notification.type)} {formatTime(notification.createdAt)}</span>
              </div>
              {thumb ? (
                isVideoThumb ? <video src={thumb} muted playsInline /> : <img src={thumb} alt="" />
              ) : null}
            </article>
          );
        }) : <p className="notification-empty">No notifications yet.</p>}
      </div>
    </section>
  );
}
