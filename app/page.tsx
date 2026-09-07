'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft, BadgeCheck, ChevronDown, ChevronRight, Edit3, Heart, Home,
  MapPin, MessageCircle, MoreHorizontal, Radio, Send, ShieldCheck, Sparkles,
  UserRound, X,
} from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

type Tab = 'Discover' | 'Rooms' | 'Chat' | 'Profile';
type Profile = { name: string; age: number; image: string; place: string; distance: string; intent: string; tags: string[]; prompt: string };

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: {
        name: string; title: string; description: string; inputSchema: object;
        annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
        execute: (input: unknown) => unknown;
      }, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

const profiles: Profile[] = [
  { name: 'Maya', age: 27, image: '/maya.png', place: 'Brooklyn', distance: '2 miles away', intent: 'Long-term', tags: ['Live music', 'Night walks'], prompt: 'Be curious. Pick the restaurant. Let me make the playlist.' },
  { name: 'Lena', age: 29, image: '/lena.png', place: 'Lower East Side', distance: '3 miles away', intent: 'Serious-ish', tags: ['Vinyl', 'Tiny venues'], prompt: 'Show me the song you never skip.' },
  { name: 'Imani', age: 28, image: '/imani.png', place: 'Fort Greene', distance: '4 miles away', intent: 'Long-term', tags: ['Trail days', 'Good coffee'], prompt: 'A sunrise hike is worth the alarm.' },
];

const roomData = [
  { name: 'Tonight', caption: 'Free in the next 12 hours', count: '84 here now', image: '/maya.png', className: 'wide' },
  { name: 'Music', caption: 'Match on taste', count: '126 listening', image: '/lena.png' },
  { name: 'Outdoors', caption: 'Find your trail person', count: '67 exploring', image: '/imani.png' },
  { name: 'Serious-ish', caption: 'Bio · 4 photos · intent', count: 'Door policy', image: '/maya.png' },
  { name: 'New in town', caption: 'Make the city feel smaller', count: '43 new faces', image: '/lena.png', className: 'wide' },
];

const tabIcons = { Discover: Home, Rooms: Radio, Chat: MessageCircle, Profile: UserRound };

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('Discover');
  const [profileIndex, setProfileIndex] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [incomingOpen, setIncomingOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [room, setRoom] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [composer, setComposer] = useState('');
  const [messages, setMessages] = useState([{ id: 1, text: 'That rooftop view is undefeated.', mine: false }]);
  const [freeTonight, setFreeTonight] = useState(true);
  const [previewCard, setPreviewCard] = useState(false);
  const dragStart = useRef<number | null>(null);
  const dragged = useRef(false);
  const current = profiles[profileIndex % profiles.length];

  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const nextProfile = () => {
    setProfileOpen(false);
    setProfileIndex((value) => (value + 1) % profiles.length);
  };

  const like = () => {
    setProfileOpen(false);
    setMatchOpen(true);
  };

  const spark = () => {
    setProfileOpen(false);
    announce(`Spark sent — ${current.name === 'Maya' ? 'she' : 'they'}’ll see you first`);
  };

  const openChatWith = (text = '') => {
    setMatchOpen(false);
    setIncomingOpen(false);
    setComposer(text);
    setTab('Chat');
    setChatOpen(true);
  };

  const sendMessage = () => {
    const text = composer.trim();
    if (!text) return;
    setMessages((items) => [...items, { id: Date.now(), text, mine: true }]);
    setComposer('');
  };

  const handleTab = (value: Tab) => {
    setTab(value); setRoom(null); setChatOpen(false); setPreviewCard(false);
  };

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<typeof context.registerTool>[0]) => {
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined); } catch { /* unsupported preview */ }
    };
    register({
      name: 'navigate_pulse', title: 'Navigate PULSE', description: 'Open a main area of the PULSE dating app.',
      inputSchema: { type: 'object', properties: { tab: { type: 'string', enum: ['Discover', 'Rooms', 'Chat', 'Profile'] } }, required: ['tab'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => { const value = (input as { tab?: Tab }).tab; if (!value || !Object.keys(tabIcons).includes(value)) throw new Error('Invalid tab'); handleTab(value); return { activeTab: value }; },
    });
    register({
      name: 'like_current_profile', title: 'Like current profile', description: 'Like the profile currently visible in Discover and open the match state.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: () => { like(); return { liked: current.name, matched: true }; },
    });
    register({
      name: 'send_spark_to_current_profile', title: 'Send a Spark', description: 'Send today’s priority Spark to the profile currently visible.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: () => { spark(); return { recipient: current.name, status: 'sent' }; },
    });
    return () => lifecycle.abort();
  }, [current.name]);

  return (
    <main className="app-shell">
      <div className="phone-frame">
        {tab === 'Discover' && <DiscoverHeader onIncoming={() => setIncomingOpen(true)} />}
        {tab === 'Discover' && <DiscoverScreen profile={current} onOpen={() => { if (!dragged.current) setProfileOpen(true); }} onPass={nextProfile} onLike={like} onSpark={spark} onPointerDown={(x) => { dragStart.current = x; dragged.current = false; }} onPointerUp={(x) => { if (dragStart.current === null) return; const delta = x - dragStart.current; dragged.current = Math.abs(delta) > 12; if (delta > 70) like(); if (delta < -70) nextProfile(); dragStart.current = null; }} />}
        {tab === 'Rooms' && !room && <RoomsHub onOpenRoom={setRoom} />}
        {tab === 'Rooms' && room && <RoomStack room={room} profile={current} onBack={() => setRoom(null)} onOpen={() => setProfileOpen(true)} onPass={nextProfile} onLike={like} onSpark={spark} />}
        {tab === 'Chat' && !chatOpen && <ChatList onOpen={() => setChatOpen(true)} />}
        {tab === 'Chat' && chatOpen && <ChatThread messages={messages} composer={composer} onComposer={setComposer} onSend={sendMessage} onBack={() => setChatOpen(false)} onSafety={() => setSafetyOpen(true)} onUnsend={(id) => setMessages((items) => items.filter((item) => item.id !== id))} />}
        {tab === 'Profile' && !previewCard && <YourProfile freeTonight={freeTonight} onFreeTonight={setFreeTonight} onPreview={() => setPreviewCard(true)} />}
        {tab === 'Profile' && previewCard && <ProfilePreview onBack={() => setPreviewCard(false)} />}
        <TabBar active={tab} onChange={handleTab} />
      </div>

      <FullProfile profile={current} open={profileOpen} onOpenChange={setProfileOpen} onPass={nextProfile} onLike={like} onSpark={spark} />
      <Incoming open={incomingOpen} onOpenChange={setIncomingOpen} onChat={openChatWith} />
      <MatchModal open={matchOpen} onOpenChange={setMatchOpen} profile={current} room={room} onIcebreaker={openChatWith} onBrowse={() => { setMatchOpen(false); nextProfile(); }} />
      <SafetyDialog open={safetyOpen} onOpenChange={setSafetyOpen} onAction={announce} />
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite"><Sparkles size={17} fill="currentColor" />{toast}</div>
    </main>
  );
}

function DiscoverHeader({ onIncoming }: { onIncoming: () => void }) {
  return <header className="topbar"><span className="wordmark">PULSE</span><button className="incoming-button" aria-label="Open incoming likes" onClick={onIncoming}><Heart size={22} strokeWidth={2.2} /><span className="notification-dot">3</span></button></header>;
}

function DiscoverScreen({ profile, onOpen, onPass, onLike, onSpark, onPointerDown, onPointerUp }: { profile: Profile; onOpen: () => void; onPass: () => void; onLike: () => void; onSpark: () => void; onPointerDown: (x: number) => void; onPointerUp: (x: number) => void }) {
  return <section className="discover-screen" aria-label="Discover profiles"><ProfileCard profile={profile} onOpen={onOpen} onPointerDown={onPointerDown} onPointerUp={onPointerUp} /><ActionRow onPass={onPass} onLike={onLike} onSpark={onSpark} /></section>;
}

function ProfileCard({ profile, onOpen, room, preview, onPointerDown, onPointerUp }: { profile: Profile; onOpen?: () => void; room?: string | null; preview?: boolean; onPointerDown?: (x: number) => void; onPointerUp?: (x: number) => void }) {
  return <button className="profile-card" onClick={onOpen} onPointerDown={(e) => onPointerDown?.(e.clientX)} onPointerUp={(e) => onPointerUp?.(e.clientX)} aria-label={preview ? 'Preview of your dating card' : `Open ${profile.name}'s full profile`}>
    <Image src={profile.image} alt="" fill priority sizes="(max-width: 480px) 100vw, 390px" className="profile-photo card-photo-backdrop" aria-hidden="true" />
    <Image src={profile.image} alt={`${profile.name}'s profile`} fill priority sizes="(max-width: 480px) 100vw, 390px" className="profile-photo card-photo" />
    <div className="photo-scrim" />
    <div className="card-content">
      {room && <p className="room-caption">You’re both in {room}</p>}
      {!preview && <p className="tap-hint">Tap the photo for the full profile</p>}
      <div className="name-row"><h1>{profile.name}, {profile.age}</h1><BadgeCheck size={22} fill="#FF4D6D" color="#0E0E10" aria-label="Verified" /></div>
      <p className="distance">{profile.place} · {profile.distance}</p>
      <div className="chips"><span>{profile.intent}</span>{profile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
    </div>
  </button>;
}

function ActionRow({ onPass, onLike, onSpark }: { onPass: () => void; onLike: () => void; onSpark: () => void }) {
  return <div className="action-row" aria-label="Profile actions"><button className="action-button pass" aria-label="Pass" onClick={onPass}><X size={27} /></button><button className="action-button like" aria-label="Like" onClick={onLike}><Heart size={29} fill="currentColor" /></button><button className="action-button spark" aria-label="Send a Spark" onClick={onSpark}><Sparkles size={27} fill="currentColor" /></button></div>;
}

function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return <nav className="tabbar" aria-label="Primary navigation">{(Object.keys(tabIcons) as Tab[]).map((label) => { const Icon = tabIcons[label]; return <button key={label} className={label === active ? 'active' : ''} onClick={() => onChange(label)}><Icon size={21} strokeWidth={2.2} /><span>{label}</span></button>; })}</nav>;
}

function FullProfile({ profile, open, onOpenChange, onPass, onLike, onSpark }: { profile: Profile; open: boolean; onOpenChange: (open: boolean) => void; onPass: () => void; onLike: () => void; onSpark: () => void }) {
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="bottom" showCloseButton={false} className="profile-sheet"><SheetTitle className="sr-only">{profile.name}&apos;s full profile</SheetTitle><SheetDescription className="sr-only">Photos and details for {profile.name}</SheetDescription><button className="sheet-handle" onClick={() => onOpenChange(false)} aria-label="Close full profile"><ChevronDown size={25} /></button><div className="profile-scroll"><div className="profile-film"><Image src={profile.image} alt="" fill sizes="390px" className="profile-photo card-photo-backdrop" aria-hidden="true" /><Image src={profile.image} alt={`${profile.name}'s profile`} fill sizes="390px" className="profile-photo card-photo" /><span className="film-count">1 / 5</span><div className="profile-title"><div className="name-row"><h2>{profile.name}, {profile.age}</h2><BadgeCheck size={21} fill="#FF4D6D" color="#0E0E10" /></div><p>{profile.place} · {profile.distance}</p></div></div><div className="profile-details"><section><span className="section-label">A perfect ordinary Sunday</span><p>{profile.name === 'Maya' ? 'Cold brew, a long walk with no route, then making dinner with a record on.' : profile.prompt}</p></section><section><span className="section-label">The quickest way to my heart</span><p>{profile.prompt}</p></section><section><span className="section-label">THE BASICS</span><div className="detail-chips"><span>Creative lead</span><span>5′6″</span><span>From Austin</span></div></section><section><span className="section-label">SHARED WITH YOU</span><div className="detail-chips coral">{profile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section></div></div><div className="sheet-actions"><ActionRow onPass={onPass} onLike={onLike} onSpark={onSpark} /></div></SheetContent></Sheet>;
}

function RoomsHub({ onOpenRoom }: { onOpenRoom: (name: string) => void }) {
  return <section className="screen scroll-screen"><header className="page-header"><p className="eyebrow">Find your frequency</p><h1>Rooms</h1><p>Walk into a vibe.</p></header><div className="room-grid">{roomData.map((item) => <button key={item.name} className={`room-tile ${item.className ?? ''}`} onClick={() => onOpenRoom(item.name)}><Image src={item.image} alt="" fill sizes="390px" className="profile-photo" /><span className="room-shade" /><span className="room-copy"><strong>{item.name}</strong><small>{item.caption}</small><em>{item.count}</em></span></button>)}</div><p className="stand-note"><Radio size={16} fill="currentColor" /> You can stand in Discover + one Room</p></section>;
}

function RoomStack({ room, profile, onBack, onOpen, onPass, onLike, onSpark }: { room: string; profile: Profile; onBack: () => void; onOpen: () => void; onPass: () => void; onLike: () => void; onSpark: () => void }) {
  return <section className="room-stack"><header className="room-header"><button onClick={onBack} aria-label="Back to rooms"><ArrowLeft size={22} /></button><div><strong>{room}</strong><span>{room === 'Tonight' ? '84 here now' : 'Live now'}</span></div><span className="live-dot" /></header><div className="context-chip">{room === 'Tonight' ? 'Free after 8' : `Into ${room.toLowerCase()}`}</div><div className="room-card-wrap"><ProfileCard profile={profile} room={room} onOpen={onOpen} /></div><ActionRow onPass={onPass} onLike={onLike} onSpark={onSpark} /></section>;
}

function Incoming({ open, onOpenChange, onChat }: { open: boolean; onOpenChange: (open: boolean) => void; onChat: (text?: string) => void }) {
  const rows = [{ name: 'Lena', image: '/lena.png', liked: 'Your “tiny venues” tag', spark: true }, { name: 'Imani', image: '/imani.png', liked: 'Your Sunday prompt', spark: false }, { name: 'Nora', image: '/maya.png', liked: 'Your rooftop photo', spark: false }];
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" showCloseButton={false} className="incoming-sheet"><SheetTitle className="incoming-title">Incoming</SheetTitle><SheetDescription className="incoming-subtitle">People who already chose you.</SheetDescription><button className="close-round" onClick={() => onOpenChange(false)} aria-label="Close incoming"><X size={19} /></button><div className="incoming-list"><p className="list-label"><Sparkles size={14} fill="currentColor" /> SPARKS</p>{rows.map((row, index) => <button className={`incoming-row ${row.spark ? 'spark-row' : ''}`} key={row.name} onClick={() => onChat(`You had me at ${row.liked.toLowerCase()}.`)}><span className="avatar"><Image src={row.image} alt="" fill sizes="58px" className="profile-photo" /></span><span className="incoming-copy"><strong>{row.name} {index < 2 && <BadgeCheck size={15} fill="#FF4D6D" color="#161618" />}</strong><small>{row.spark ? 'Sparked' : 'Liked'} · {row.liked}</small></span><ChevronRight size={18} /></button>)}<button className="plus-link">See 8 more with Pulse+ <ChevronRight size={16} /></button></div></SheetContent></Sheet>;
}

function MatchModal({ open, onOpenChange, profile, room, onIcebreaker, onBrowse }: { open: boolean; onOpenChange: (open: boolean) => void; profile: Profile; room: string | null; onIcebreaker: (text: string) => void; onBrowse: () => void }) {
  const place = room || 'Discover';
  const ideas = room === 'Tonight' ? ['Tacos at 8?', 'Pick the first song', 'Best late-night walk?'] : ['What’s on repeat?', 'Ideal Sunday route?', 'Choose our first bite'];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent showCloseButton={false} className="match-dialog"><button className="match-close" onClick={() => onOpenChange(false)} aria-label="Close match"><X size={19} /></button><div className="match-photos"><span><Image src="/imani.png" alt="Your profile" fill sizes="92px" className="profile-photo" /></span><i><Heart size={20} fill="currentColor" /></i><span><Image src={profile.image} alt={`${profile.name}'s profile`} fill sizes="92px" className="profile-photo" /></span></div><DialogTitle className="match-title">It’s a Pulse</DialogTitle><DialogDescription className="match-sub">You both liked each other in {place}</DialogDescription><div className="icebreakers">{ideas.map((idea) => <button key={idea} onClick={() => onIcebreaker(idea)}>{idea}</button>)}</div><button className="primary-button" onClick={() => onIcebreaker(ideas[0])}><Send size={18} /> Send a spark</button><button className="text-button" onClick={onBrowse}>Keep browsing</button></DialogContent></Dialog>;
}

function ChatList({ onOpen }: { onOpen: () => void }) {
  return <section className="screen scroll-screen"><header className="page-header chat-page-header"><p className="eyebrow">Your connections</p><h1>Chat</h1></header><div className="chat-list"><button className="chat-row" onClick={onOpen}><span className="avatar chat-avatar"><Image src="/maya.png" alt="Maya" fill sizes="62px" className="profile-photo" /><i /></span><span><strong>Maya</strong><small>That rooftop view is undefeated.</small></span><time>Now</time></button><button className="chat-row"><span className="avatar chat-avatar"><Image src="/lena.png" alt="Lena" fill sizes="62px" className="profile-photo" /></span><span><strong>Lena</strong><small>Sent a voice note</small></span><time>12m</time></button><button className="chat-row"><span className="avatar chat-avatar"><Image src="/imani.png" alt="Imani" fill sizes="62px" className="profile-photo" /></span><span><strong>Imani</strong><small>Saturday could work!</small></span><time>2h</time></button></div></section>;
}

function ChatThread({ messages, composer, onComposer, onSend, onBack, onSafety, onUnsend }: { messages: { id: number; text: string; mine: boolean }[]; composer: string; onComposer: (text: string) => void; onSend: () => void; onBack: () => void; onSafety: () => void; onUnsend: (id: number) => void }) {
  return <section className="thread"><header className="thread-header"><button onClick={onBack} aria-label="Back to chats"><ArrowLeft size={22} /></button><span className="avatar small"><Image src="/maya.png" alt="Maya" fill sizes="42px" className="profile-photo" /></span><div><strong>Maya</strong><small><i /> Active now</small></div><button className="shield" onClick={onSafety} aria-label="Safety options"><ShieldCheck size={22} /></button></header><div className="message-body"><div className="day-label">Your Pulse · Today</div>{messages.length === 1 && <div className="icebreakers inline"><button onClick={() => onComposer('What’s the best rooftop in Brooklyn?')}>Best rooftop?</button><button onClick={() => onComposer('Pick our first song 🎵')}>Pick our first song</button></div>}{messages.map((message) => <div key={message.id} className={`bubble-wrap ${message.mine ? 'mine' : ''}`}><div className="bubble">{message.text}</div>{message.mine && <button onClick={() => onUnsend(message.id)}>Unsend · 2m left</button>}</div>)}</div><form className="composer" onSubmit={(e) => { e.preventDefault(); onSend(); }}><input value={composer} onChange={(e) => onComposer(e.target.value)} placeholder="Message Maya" aria-label="Message Maya" /><button type="submit" aria-label="Send message"><Send size={19} /></button></form></section>;
}

function YourProfile({ freeTonight, onFreeTonight, onPreview }: { freeTonight: boolean; onFreeTonight: (checked: boolean) => void; onPreview: () => void }) {
  return <section className="screen scroll-screen profile-page"><header className="page-header profile-header"><p className="eyebrow">Your profile</p><div className="self-row"><span className="self-avatar"><Image src="/imani.png" alt="Your profile" fill sizes="82px" className="profile-photo" /></span><div><h1>Alex</h1><p>82% complete</p></div><button aria-label="Edit profile"><Edit3 size={20} /></button></div><div className="progress"><span /></div></header><div className="settings-list"><section><div className="setting-heading"><span><small>INTENT</small><strong>What you’re looking for</strong></span><Edit3 size={17} /></div><div className="detail-chips coral"><span>Long-term</span><span>Open to short</span></div></section><section><div className="setting-heading"><span><small>PROMPTS · 2 OF 2</small><strong>“My ideal Sunday…”</strong></span><Edit3 size={17} /></div><p>Outside early, somewhere cozy by dinner.</p></section><section><div className="setting-heading"><span><small>INTERESTS · 5 OF 5</small><strong>Your frequency</strong></span><Edit3 size={17} /></div><div className="detail-chips"><span>Live music</span><span>Trail days</span><span>Design</span><span>Cooking</span><span>Films</span></div></section><section className="toggle-row"><span><small>TONIGHT</small><strong>I’m free tonight</strong><p>Show me in the Tonight room.</p></span><Switch checked={freeTonight} onCheckedChange={onFreeTonight} aria-label="I'm free tonight" /></section></div><button className="primary-button preview-button" onClick={onPreview}>Preview my card <ChevronRight size={18} /></button></section>;
}

function ProfilePreview({ onBack }: { onBack: () => void }) {
  const self = { name: 'Alex', age: 28, image: '/imani.png', place: 'Fort Greene', distance: '3 miles away', intent: 'Long-term', tags: ['Live music', 'Trail days'], prompt: 'Outside early, somewhere cozy by dinner.' };
  return <section className="preview-screen"><header className="preview-banner"><button onClick={onBack} aria-label="Back to profile"><ArrowLeft size={21} /></button><span><strong>This is how you appear</strong><small>What people see in Discover</small></span></header><div className="preview-wrap"><ProfileCard profile={self} preview /><button className="edit-card"><Edit3 size={18} /> Edit card</button></div></section>;
}

function SafetyDialog({ open, onOpenChange, onAction }: { open: boolean; onOpenChange: (open: boolean) => void; onAction: (message: string) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="safety-dialog"><DialogTitle>Safety with Maya</DialogTitle><DialogDescription>These tools are always one tap away.</DialogDescription><button onClick={() => { onOpenChange(false); onAction('Date details shared with your contact'); }}><ShieldCheck size={20} /> Share date details <ChevronRight size={17} /></button><button onClick={() => onAction('Maya reported for review')}><MoreHorizontal size={20} /> Report profile <ChevronRight size={17} /></button><button className="danger" onClick={() => { onOpenChange(false); onAction('Maya has been blocked'); }}><X size={20} /> Block Maya <ChevronRight size={17} /></button></DialogContent></Dialog>;
}
