'use client';

import { ArrowLeft, Info, Mic, Phone, Search, Send, Video } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar } from './Avatar';
import { useAuth } from './AuthProvider';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getMessageContact(message, currentUser) {
  return message.sender.id === currentUser?.id ? message.receiver : message.sender;
}

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function mergeContacts(currentContacts, incomingContacts) {
  const contacts = new Map();
  for (const contact of currentContacts || []) contacts.set(contact.id, contact);
  for (const contact of incomingContacts || []) {
    const existing = contacts.get(contact.id);
    contacts.set(contact.id, {
      ...existing,
      ...contact,
      preview: contact.preview || existing?.preview || 'Start a conversation',
      time: contact.time || existing?.time || '',
      unreadCount: Math.max(contact.unreadCount || 0, existing?.unreadCount || 0)
    });
  }
  return [...contacts.values()].sort(sortContacts);
}

function sortContacts(left, right) {
  const leftTime = left.time ? new Date(left.time).getTime() : 0;
  const rightTime = right.time ? new Date(right.time).getTime() : 0;
  return rightTime - leftTime;
}

export function MessagesView({ cachedState, onCacheChange }) {
  const { token, user } = useAuth();
  const [contacts, setContactsState] = useState(cachedState?.contacts || []);
  const [activeId, setActiveIdState] = useState(cachedState?.activeId || '');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [threads, setThreadsState] = useState(cachedState?.threads || {});
  const filteredContacts = useMemo(() => contacts.filter((contact) => (
    contact.username.toLowerCase().includes(query.trim().toLowerCase())
  )), [contacts, query]);
  const activeContact = filteredContacts.find((contact) => contact.id === activeId) || filteredContacts[0];
  const messages = threads[activeContact?.id] || [];

  function setContacts(update) {
    setContactsState((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      return next;
    });
  }

  function setActiveId(update) {
    setActiveIdState((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      return next;
    });
  }

  function setThreads(update) {
    setThreadsState((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      return next;
    });
  }

  useEffect(() => {
    onCacheChange?.({ contacts, activeId, threads });
  }, [activeId, contacts, onCacheChange, threads]);

  function applyIncomingMessage(nextMessage) {
    if (!nextMessage || !user) return;
    const contact = getMessageContact(nextMessage, user);
    if (!contact?.id) return;
    const isIncoming = nextMessage.sender.id !== user?.id;
    const isActiveThread = contact.id === activeContact?.id;

    upsertContact({
      ...contact,
      unreadCount: isIncoming && !isActiveThread ? (contacts.find((item) => item.id === contact.id)?.unreadCount || 0) + 1 : 0
    }, nextMessage.text, nextMessage.createdAt);

    setThreads((current) => {
      const currentThread = current[contact.id] || [];
      if (currentThread.some((message) => message.id === nextMessage.id)) return current;
      return { ...current, [contact.id]: [...currentThread, nextMessage] };
    });

    setActiveId((current) => current || contact.id);

    if (isIncoming && isActiveThread) {
      fetch(`${apiUrl}/api/messages/${contact.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
      window.dispatchEvent(new CustomEvent('mini-instagram:messages-read', { detail: { contactId: contact.id } }));
    }
  }

  function upsertContact(contact, preview, time) {
    setContacts((current) => {
      const existing = current.find((item) => item.id === contact.id);
      const nextContact = { ...existing, ...contact, preview: preview || existing?.preview || 'Start a conversation', time: time || existing?.time || '' };
      if (existing) return current.map((item) => (item.id === contact.id ? nextContact : item)).sort(sortContacts);
      return [nextContact, ...current];
    });
  }

  useEffect(() => {
    async function loadConversations() {
      if (!token) return;
      try {
        const res = await fetch(`${apiUrl}/api/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Messages failed to load');
        const nextContacts = [...(data.contacts || [])].sort(sortContacts);
        setContacts((current) => mergeContacts(current, nextContacts));
        setActiveId((current) => current || nextContacts[0]?.id || contacts[0]?.id || '');
        setError('');
      } catch {
        setError('Backend қосылмаған немесе API URL дұрыс емес.');
      }
    }

    loadConversations();
  }, [token]);

  useEffect(() => {
    async function loadMessages() {
      if (!token || !activeContact) return;
      try {
        const res = await fetch(`${apiUrl}/api/messages/${activeContact.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Thread failed to load');
        setThreads((current) => ({ ...current, [activeContact.id]: data.messages || [] }));
        setContacts((current) => current.map((contact) => (
          contact.id === activeContact.id ? { ...contact, unreadCount: 0 } : contact
        )));
        window.dispatchEvent(new CustomEvent('mini-instagram:messages-read', { detail: { contactId: activeContact.id } }));
        setError('');
      } catch {
        setError('Хабарламаларды жүктеу мүмкін болмады.');
      }
    }

    loadMessages();
  }, [activeContact?.id, token]);

  useEffect(() => {
    function handleGlobalMessage(event) {
      applyIncomingMessage(event?.detail?.message);
    }

    window.addEventListener('mini-instagram:message-created', handleGlobalMessage);
    return () => window.removeEventListener('mini-instagram:message-created', handleGlobalMessage);
  }, [activeContact?.id, contacts, token, user?.id]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeContact || !token) return;
    try {
      const res = await fetch(`${apiUrl}/api/messages/${activeContact.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Message failed');
      upsertContact(activeContact, data.message.text, data.message.createdAt);
      setError('');
      setDraft('');
    } catch {
      setError('Хабарлама жіберілмеді. Backend серверін тексер.');
    }
  }

  return (
    <section className="messages-view" aria-label="Messages">
      <aside className="messages-list">
        <h2>Messages</h2>
        <label className="messages-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" />
        </label>
        <div className="messages-contacts">
          {filteredContacts.length ? filteredContacts.map((contact, index) => (
            <button
              type="button"
              className={contact.id === activeContact?.id ? 'is-active' : ''}
              key={contact.id}
              onClick={() => setActiveId(contact.id)}
            >
              <Avatar user={contact} className={`message-avatar message-avatar--${index % 5}`} />
              <span>
                <strong>{contact.username}</strong>
                <small>{contact.preview}</small>
              </span>
              <time>{formatTime(contact.time)}</time>
              {contact.unreadCount > 0 ? <b className="messages-contact-badge">{contact.unreadCount}</b> : null}
              <Mic size={14} />
            </button>
          )) : (
            <p className="messages-empty-list">{error || 'Follow people to message them.'}</p>
          )}
        </div>
      </aside>

      <section className="messages-chat">
        <header className="messages-chat__head">
          <button type="button" aria-label="Back"><ArrowLeft size={18} /></button>
          <Avatar user={activeContact} name={activeContact?.username || '..'} />
          <div>
            <strong>{activeContact?.username || 'Messages'}</strong>
            <small>{activeContact?.id || 'follow people first'}</small>
          </div>
          <span className="messages-chat__tools">
            <button type="button" aria-label="Call"><Phone size={17} /></button>
            <button type="button" aria-label="Video"><Video size={17} /></button>
            <button type="button" aria-label="Info"><Info size={17} /></button>
          </span>
        </header>

        <div className="messages-thread">
          {activeContact ? (
            <>
              <span className="messages-day">Wednesday</span>
              {messages.map((message) => (
                <p className={`message-bubble message-bubble--${message.sender.id === user?.id ? 'me' : 'them'}`} key={message.id}>
                  {message.text}
                  <time>{formatTime(message.createdAt)}</time>
                </p>
              ))}
            </>
          ) : (
            <div className="messages-empty-chat">
              <strong>No conversations</strong>
              <span>Follow someone, then they will appear here.</span>
            </div>
          )}
        </div>

        <form className="messages-compose" onSubmit={sendMessage}>
          {error ? <p className="messages-error">{error}</p> : null}
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message" disabled={!activeContact} />
          <button type="button" aria-label="Voice message"><Mic size={18} /></button>
          <button type="submit" disabled={!activeContact}><Send size={17} />Send</button>
        </form>
      </section>
    </section>
  );
}
