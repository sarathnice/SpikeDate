'use client';
import { useState } from 'react';
import { DatingGames } from '@/components/dating-games';
export default function GamesPreview() {
  const [role, setRole] = useState('Alex');
  return (
    <main className="games-preview">
      <header>
        <small>SpikeDate · Interactive mobile preview</small>
        <h1>Ten ways to connect.</h1>
        <p>
          Switch between Alex and Lena to accept invitations and answer both
          sides. Demo data stays in this browser.
        </p>
      </header>
      <div className="game-moods" aria-label="Preview participant">
        {['Alex', 'Lena'].map((name) => (
          <button
            key={name}
            aria-pressed={role === name}
            onClick={() => setRole(name)}
          >
            Play as {name}
          </button>
        ))}
      </div>
      <section className="games-preview-chat">
        <h2>
          {role}&apos;s chat with {role === 'Alex' ? 'Lena' : 'Alex'}
        </h2>
        <p className="preview-message">
          Want to try something fun before our coffee date?
        </p>
        <DatingGames
          key={role}
          viewerId={role}
          partnerId={role === 'Alex' ? 'Lena' : 'Alex'}
          partnerName={role === 'Alex' ? 'Lena' : 'Alex'}
          serverEnabled={false}
          preview
        />
        <p className="game-picker-tip">
          Open Play together to browse all ten games. Close the game to switch
          players; then open it again to accept or answer.
        </p>
      </section>
    </main>
  );
}
