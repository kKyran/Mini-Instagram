'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthGate } from '../components/AuthGate';
import { FeedShell } from '../components/FeedShell';

function getInitialView(searchParams) {
  const view = searchParams.get('view');
  return ['home', 'reels', 'messages', 'notifications'].includes(view) ? view : 'home';
}

function HomeContent() {
  const searchParams = useSearchParams();
  const initialView = getInitialView(searchParams);

  return (
    <AuthGate>
      <main className="social-app social-app--with-profile">
        <FeedShell initialPosts={[]} initialView={initialView} />
      </main>
    </AuthGate>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
