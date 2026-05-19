'use client';

import { CalendarDays, Edit, MessageCircle, Search, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar } from './Avatar';

export function PresencePanel() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const token = JSON.parse(localStorage.getItem('mini-instagram-auth') || '{}').token;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    const ws = new WebSocket(`${wsUrl}?token=${token || ''}`);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'presence') setUsers(payload.users);
    };
    return () => ws.close();
  }, []);

  return (
    <aside className="right-rail">
      <section className="messages-card">
        <header>
          <h2><MessageCircle size={18} /> Messages</h2>
          <Edit size={18} />
        </header>
        <div className="rail-search"><Search size={16} /><span>Search</span></div>
        <div className="message-tabs"><b>Primary</b><span>General</span><span>Requests(4)</span></div>
        {(users.length ? users : ['Roger Korsgaard', 'Terry Torff', 'Angel Bergson', 'Emerson Gouse', 'Zain Culhane'].map((username) => ({ username }))).map((item) => (
          <p className="message-row" key={item.id || item.username}><Avatar user={item} />{item.username}<i /></p>
        ))}
      </section>

      <section className="events-card">
        <h2><CalendarDays size={18} /> Events</h2>
        <p><b>10 Events Invites</b></p>
        <p>Design System Collaboration</p>
        <p>Web Dev 2.0 Meetup</p>
      </section>

      <section className="events-card">
        <h2><Users size={18} /> Online</h2>
        {users.length ? users.map((user) => <p key={`${user.id}-${user.username}`}>{user.username}</p>) : <p className="meta">No active sessions yet.</p>}
      </section>
    </aside>
  );
}
