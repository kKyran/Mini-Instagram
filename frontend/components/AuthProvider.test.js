import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthProvider';

const originalFetch = global.fetch;

afterEach(() => {
  localStorage.clear();
  if (originalFetch) global.fetch = originalFetch;
  else delete global.fetch;
  jest.restoreAllMocks();
});

test('AuthProvider renders children and default guest state', () => {
  render(<AuthProvider><p>Inside app</p></AuthProvider>);
  expect(screen.getByText('Inside app')).toBeInTheDocument();
});

function AuthStateProbe() {
  const { isReady, user } = useAuth();
  return <p>{isReady && !user ? 'Guest ready' : 'Loading'}</p>;
}

test('AuthProvider clears invalid saved auth data instead of hanging', async () => {
  localStorage.setItem('mini-instagram-auth', '{bad-json');

  render(
    <AuthProvider>
      <AuthStateProbe />
    </AuthProvider>
  );

  await waitFor(() => expect(screen.getByText('Guest ready')).toBeInTheDocument());
  expect(localStorage.getItem('mini-instagram-auth')).toBeNull();
});

test('AuthProvider clears saved auth when the token is rejected', async () => {
  localStorage.setItem('mini-instagram-auth', JSON.stringify({
    user: { id: 'user-1', username: 'old_user' },
    token: 'expired-token'
  }));
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: 'Invalid token' })
  });

  render(
    <AuthProvider>
      <AuthStateProbe />
    </AuthProvider>
  );

  await waitFor(() => expect(screen.getByText('Guest ready')).toBeInTheDocument());
  expect(localStorage.getItem('mini-instagram-auth')).toBeNull();
});
