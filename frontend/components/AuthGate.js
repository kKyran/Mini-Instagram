'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './AuthProvider';

export function AuthGate({ children }) {
  const { isReady, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !user) router.replace('/login');
  }, [isReady, router, user]);

  if (!isReady || !user) return null;

  return children;
}
