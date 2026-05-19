'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiUrl, wsUrl } from '../lib/api-config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const saved = localStorage.getItem('mini-instagram-auth');
        if (!saved) return;

        const parsed = JSON.parse(saved);
        if (!parsed?.token || !parsed?.user) {
          clearAuthState();
          return;
        }

        const res = await fetch(`${apiUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${parsed.token}` }
        });
        const data = await res.json().catch(() => ({}));

        if (!isMounted) return;
        if (!res.ok) {
          clearAuthState();
          return;
        }

        persist(data.user || parsed.user, parsed.token);
      } catch {
        if (!isMounted) return;
        try {
          const parsed = JSON.parse(localStorage.getItem('mini-instagram-auth') || '{}');
          if (parsed?.token && parsed?.user) {
            setToken(parsed.token);
            setUser(parsed.user);
            return;
          }
        } catch {
          clearAuthState();
        }
      } finally {
        if (isMounted) setIsReady(true);
      }
    }

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  function clearAuthState() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('mini-instagram-auth');
  }

  function persist(nextUser, nextToken) {
    setUser(nextUser);
    setToken(nextToken);
    localStorage.setItem('mini-instagram-auth', JSON.stringify({ user: nextUser, token: nextToken }));
  }

  async function login(email, password) {
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    persist(data.user, data.token);
  }

  async function register(username, email, password) {
    const res = await fetch(`${apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    persist(data.user, data.token);
  }

  async function updateProfile(patch) {
    const res = await fetch(`${apiUrl}/api/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch)
    });
    const data = await res.json();
    if (res.status === 401) {
      logout();
      throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) throw new Error(data.message || 'Profile update failed');
    persist(data.user, token);
  }

  async function refreshMe() {
    if (!token) return;
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.status === 401) {
      logout();
      return;
    }
    if (res.ok) persist(data.user, token);
  }

  useEffect(() => {
    if (!token || !user) return undefined;
    let ws;
    const wsTimer = setTimeout(() => {
      ws = new WebSocket(`${wsUrl}?token=${token}`);
      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if ((payload.type === 'follow:created' || payload.type === 'follow:removed') && payload.followingId === user.id) {
          refreshMe();
        }
      };
    }, 0);
    return () => {
      clearTimeout(wsTimer);
      if (ws?.readyState === WebSocket.OPEN) ws.close();
      if (ws?.readyState === WebSocket.CONNECTING) ws.addEventListener('open', () => ws.close(), { once: true });
    };
  }, [token, user?.id]);

  function logout() {
    clearAuthState();
  }

  const value = useMemo(() => ({ user, token, isReady, login, register, logout, updateProfile, refreshMe, persist }), [user, token, isReady]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
