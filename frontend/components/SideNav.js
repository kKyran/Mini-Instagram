'use client';

import Link from 'next/link';
import { Clapperboard, Heart, Home, LogOut, MessageCircle, PlusSquare } from 'lucide-react';
import { Avatar } from './Avatar';
import { useAuth } from './AuthProvider';

const items = [
  { label: 'Home', icon: Home, view: 'home' },
  { label: 'Reels', icon: Clapperboard, view: 'reels' },
  { label: 'Messages', icon: MessageCircle, view: 'messages' },
  { label: 'Notification', icon: Heart, view: 'notifications' },
  { label: 'Create', icon: PlusSquare }
];

function getItemHref(item) {
  if (item.view === 'home') return '/';
  if (item.view) return `/?view=${item.view}`;
  return '/';
}

export function SideNav({ activeView = 'home', unreadMessages = 0, onCreate, onViewChange }) {
  const { user, logout } = useAuth();
  const isProfileActive = activeView === 'profile';

  return (
    <nav className="side-nav" aria-label="Social navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const isCreate = item.label === 'Create';
        const isViewLink = Boolean(item.view);
        return (
          <a
            className={item.view === activeView ? 'is-active' : ''}
            href={getItemHref(item)}
            key={item.label}
            onClick={(event) => {
              if (isCreate && onCreate) {
                event.preventDefault();
                onCreate();
                return;
              }
              if (isViewLink && onViewChange) {
                event.preventDefault();
                onViewChange(item.view);
              }
            }}
          >
            {item.glow ? <span className="side-nav__glow" /> : <Icon size={18} />}
            <span>{item.label}</span>
            {item.view === 'messages' && unreadMessages > 0 ? (
              <b className="side-nav__badge">{unreadMessages}</b>
            ) : null}
          </a>
        );
      })}
      <Link className={`side-nav__profile-link${isProfileActive ? ' is-active' : ''}`} href="/profile">
        <Avatar user={user} className="side-nav__avatar" />
        <span>Profile</span>
      </Link>
      {user ? (
        <button type="button" className="side-nav__logout" onClick={logout}>
          <LogOut size={17} />
          <span>Logout</span>
        </button>
      ) : null}
    </nav>
  );
}
