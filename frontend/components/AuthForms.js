'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';

function MiniInstagramLogo() {
  return (
    <div className="mini-logo" aria-label="Mini Instagram">
      <span className="mini-logo__lens" />
      <span className="mini-logo__spark" />
    </div>
  );
}

function AuthActionButtons({ mode, onAction }) {
  return (
    <div className="auth-switcher" aria-label="Authentication action">
      <button
        type="submit"
        className={mode === 'login' ? 'is-selected' : ''}
        onClick={() => onAction('login')}
      >
        Login
      </button>
      <button
        type="submit"
        className={mode === 'register' ? 'is-selected' : ''}
        onClick={() => onAction('register')}
      >
        Sign up
      </button>
    </div>
  );
}

export function AuthForms() {
  const { login, register, user } = useAuth();
  const router = useRouter();
  const actionRef = useRef('login');
  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) router.replace('/');
  }, [router, user]);

  async function submit(action, event) {
    event.preventDefault();
    const selectedAction = actionRef.current || action;
    setMessage(selectedAction === 'login' ? 'Signing in...' : 'Creating your account...');
    const form = new FormData(event.currentTarget);
    const email = form.get('email');
    const password = form.get('password');
    const fallbackUsername = String(email || 'mini_user')
      .split('@')[0]
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .padEnd(3, '_');
    const username = form.get('username') || fallbackUsername;

    try {
      if (selectedAction === 'login') await login(email, password);
      else await register(username, email, password);
      setMessage('Success. Opening your feed...');
      window.location.assign('/');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function chooseAction(action) {
    actionRef.current = action;
    setMode(action);
  }

  return (
    <main className="auth-page">
      <section className="auth-stage">
        <MiniInstagramLogo />
        <div className={`auth-panels auth-panels--${mode}`}>
          <form
            className={`auth-panel auth-panel--login ${mode === 'login' ? 'is-active' : 'is-compact'}`}
            onSubmit={(event) => submit('login', event)}
          >
            <div className="auth-fields">
              <label>
                <span>Email address</span>
                <input name="email" type="email" placeholder="demo@mini.instagram" required />
              </label>
              <label>
                <span>Password</span>
                <input name="password" type="password" placeholder="Password" required />
              </label>
              <AuthActionButtons mode={mode} onAction={chooseAction} />
            </div>
            {mode !== 'login' ? (
              <button type="button" className="auth-compact-hit" onClick={() => setMode('login')}>
                Login
              </button>
            ) : null}
          </form>

          <form
            className={`auth-panel auth-panel--register ${mode === 'register' ? 'is-active' : 'is-compact'}`}
            onSubmit={(event) => submit('register', event)}
          >
            <div className="auth-fields">
              <label>
                <span>Username</span>
                <input name="username" placeholder="mini_creator" />
              </label>
              <label>
                <span>Email address</span>
                <input name="email" type="email" placeholder="you@mini.instagram" required />
              </label>
              <label>
                <span>Password</span>
                <input name="password" type="password" minLength={6} placeholder="Password" required />
              </label>
              <AuthActionButtons mode={mode} onAction={chooseAction} />
            </div>
            {mode !== 'register' ? (
              <button type="button" className="auth-compact-hit" onClick={() => setMode('register')}>
                Sign up
              </button>
            ) : null}
          </form>
        </div>
        {message ? <p className="auth-message">{message}</p> : null}
      </section>
    </main>
  );
}
