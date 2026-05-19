'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

export function Topbar() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (pathname === '/login') return null;

  return (
    <header className="topbar">
      <Link href="/" className="brand">Mini Instagram</Link>
      <nav className="nav">
        {!user ? <Link className="button" href="/login">Login</Link> : null}
      </nav>
    </header>
  );
}
