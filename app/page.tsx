'use client';

import dynamic from 'next/dynamic';

const GameWorld = dynamic(() => import('./game/components/GameWorld'), {
  ssr: false
});

export default function Home() {
  return (
    <main className="w-screen h-screen">
      <GameWorld />
    </main>
  );
}
