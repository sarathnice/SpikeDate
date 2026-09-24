'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { CalendarDays, Mic, Music2, Utensils, Moon, Heart, HandHeart, Gamepad2 } from 'lucide-react';

const stories = [
  { label: 'Today', title: 'What’s your today?', detail: 'Coffee and a sunset walk.', photo: '/spikedate-welcome-cafe.png', icon: CalendarDays },
  { label: 'Music lovers', title: 'Find your kind of rhythm.', detail: 'Share the songs you love.', photo: '/welcome-music.png', icon: Music2 },
  { label: 'Food lovers', title: 'Good food. Better company.', detail: 'Discover your next favorite spot together.', photo: '/welcome-food.png', icon: Utensils },
  { label: 'Available tonight', title: 'Make tonight a story.', detail: 'Share when you’re free to meet.', photo: '/welcome-walk.png', icon: Moon },
  { label: 'Short-term', title: 'Keep your intentions clear.', detail: 'Find someone looking for the same thing.', photo: '/welcome-music.png', icon: Heart },
  { label: 'Marriage', title: 'Something worth building.', detail: 'Connect over a shared future.', photo: '/welcome-coffee.png', icon: HandHeart },
  { label: 'Games together', title: 'A little friendly competition.', detail: 'Play, laugh, and break the ice.', photo: '/welcome-games.png', icon: Gamepad2 },
  { label: 'Announcements', title: 'Catch up on your connections.', detail: 'Listen to your activity briefing.', photo: '/spikedate-welcome-cafe.png', icon: Mic },
];
const photos = [...new Set(stories.map(story => story.photo))];

export function WelcomeStories({ brand, onLogin, onCreate }: { brand: ReactNode; onLogin: () => void; onCreate: () => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPaused(media.matches);
    const motion = () => setPaused(media.matches);
    const visibility = () => setVisible(document.visibilityState === 'visible');
    media.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    visibility();
    let mounted = true;
    void Promise.all(photos.map(src => new Promise<void>(resolve => {
      const image = new window.Image();
      image.onload = image.onerror = () => resolve();
      image.src = src;
    }))).then(() => { if (mounted) setReady(true); });
    return () => { mounted = false; media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (paused || !visible || !ready) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % stories.length), 1000);
    return () => window.clearInterval(timer);
  }, [paused, visible, ready]);
  const story = stories[index];
  const Icon = story.icon;
  return (
    <main className={`welcome-cinema welcome-stories${paused ? ' welcome-paused' : ''}`} aria-label="Welcome to SpikeDate">
      {photos.map(photo => <Image key={photo} className={`welcome-cinema-photo${photo === story.photo ? ' is-current' : ''}`} src={photo} alt="" aria-hidden="true" fill sizes="100vw" unoptimized />)}
      <div className="welcome-cinema-shade" />
      <header className="welcome-cinema-header">{brand}<nav aria-label="Account access"><button onClick={onLogin}>Login</button><button onClick={onCreate}>Create account</button></nav></header>
      <section className="welcome-cinema-copy" aria-label={story.label}>
        <div className="welcome-story-label"><Icon size={21} aria-hidden="true" /><span>{story.label}</span></div>
        <h1>{story.title}</h1><p>{story.detail}</p>
      </section>
    </main>
  );
}
