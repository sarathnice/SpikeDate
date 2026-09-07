'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft, BadgeCheck, Camera, Check, ChevronDown, ChevronLeft, ChevronRight,
  Crown, Edit3, Heart, Home, MessageCircle, MoreHorizontal, Play, Radio,
  Send, ShieldCheck, Sparkles, UserRound, X,
} from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

type Tab = 'Discover' | 'Rooms' | 'Chat' | 'Profile';
type MediaItem = { type: 'photo' | 'video'; src: string; poster?: string };
type Profile = { name: string; age: number; image: string; media: MediaItem[]; place: string; distance: string; intent: string; tags: string[]; prompt: string };
type ChatContact = { name: string; image: string; preview: string; time: string; active?: boolean };

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
  { name: 'Maya', age: 27, image: '/maya.png', media: [{ type: 'photo', src: '/maya.png' }, { type: 'photo', src: '/maya-vinyl.png' }, { type: 'photo', src: '/maya-walk.png' }], place: 'Brooklyn', distance: '2 miles away', intent: 'Long-term', tags: ['Live music', 'Night walks'], prompt: 'Be curious. Pick the restaurant. Let me make the playlist.' },
  { name: 'Lena', age: 29, image: '/lena.png', media: [{ type: 'photo', src: '/lena.png' }], place: 'Lower East Side', distance: '3 miles away', intent: 'Serious-ish', tags: ['Vinyl', 'Tiny venues'], prompt: 'Show me the song you never skip.' },
  { name: 'Imani', age: 28, image: '/imani.png', media: [{ type: 'photo', src: '/imani.png' }], place: 'Fort Greene', distance: '4 miles away', intent: 'Long-term', tags: ['Trail days', 'Good coffee'], prompt: 'A sunrise hike is worth the alarm.' },
];

const chatContacts: ChatContact[] = [
  { name: 'Maya', image: '/maya.png', preview: 'That rooftop view is undefeated.', time: 'Now', active: true },
  { name: 'Lena', image: '/lena.png', preview: 'Sent a voice note', time: '12m' },
  { name: 'Imani', image: '/imani.png', preview: 'Saturday could work!', time: '2h' },
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
  const [activeChat, setActiveChat] = useState<ChatContact>(chatContacts[0]);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [matchProfile, setMatchProfile] = useState<Profile>(profiles[0]);
  const [composer, setComposer] = useState('');
  const [messages, setMessages] = useState([{ id: 1, text: 'That rooftop view is undefeated.', mine: false }]);
  const [freeTonight, setFreeTonight] = useState(true);
  const [previewCard, setPreviewCard] = useState(false);
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
    setMatchProfile(current);
    setMatchOpen(true);
  };

  const spark = () => {
    setProfileOpen(false);
    announce(`Spark sent — ${current.name === 'Maya' ? 'she' : 'they'}’ll see you first`);
  };

  const openChatWith = (text = '', profile = matchProfile) => {
    setMatchOpen(false);
    setIncomingOpen(false);
    setActiveChat({ name: profile.name, image: profile.image, preview: text || 'You matched today', time: 'Now', active: true });
    setComposer(text);
    setTab('Chat');
    setChatOpen(true);
  };

  const likeBack = (profile: Profile) => {
    setIncomingOpen(false);
    setMatchProfile(profile);
    setMatchOpen(true);
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
        {tab === 'Discover' && <DiscoverScreen profile={current} onOpen={() => setProfileOpen(true)} onPass={nextProfile} onLike={like} onSpark={spark} />}
        {tab === 'Rooms' && !room && <RoomsHub onOpenRoom={setRoom} />}
        {tab === 'Rooms' && room && <RoomStack room={room} profile={current} onBack={() => setRoom(null)} onOpen={() => setProfileOpen(true)} onPass={nextProfile} onLike={like} onSpark={spark} />}
        {tab === 'Chat' && !chatOpen && <ChatList contacts={chatContacts} onOpen={(contact) => { setActiveChat(contact); setChatOpen(true); }} />}
        {tab === 'Chat' && chatOpen && <ChatThread contact={activeChat} messages={messages} composer={composer} onComposer={setComposer} onSend={sendMessage} onBack={() => setChatOpen(false)} onSafety={() => setSafetyOpen(true)} onUnsend={(id) => setMessages((items) => items.filter((item) => item.id !== id))} />}
        {tab === 'Profile' && !previewCard && <YourProfile freeTonight={freeTonight} onFreeTonight={setFreeTonight} onPreview={() => setPreviewCard(true)} onRegistration={() => setRegistrationOpen(true)} onSubscription={() => setSubscriptionOpen(true)} />}
        {tab === 'Profile' && previewCard && <ProfilePreview onBack={() => setPreviewCard(false)} />}
        <TabBar active={tab} onChange={handleTab} />
      </div>

      <FullProfile profile={current} open={profileOpen} onOpenChange={setProfileOpen} onPass={nextProfile} onLike={like} onSpark={spark} />
      <Incoming open={incomingOpen} onOpenChange={setIncomingOpen} onLikeBack={likeBack} onPass={(name) => announce(`${name} removed from Incoming`)} />
      <MatchModal open={matchOpen} onOpenChange={setMatchOpen} profile={matchProfile} room={room} onIcebreaker={(text) => openChatWith(text, matchProfile)} onBrowse={() => { setMatchOpen(false); nextProfile(); }} />
      <SafetyDialog open={safetyOpen} onOpenChange={setSafetyOpen} onAction={announce} />
      <RegistrationDialog open={registrationOpen} onOpenChange={setRegistrationOpen} />
      <SubscriptionDialog open={subscriptionOpen} onOpenChange={setSubscriptionOpen} onChoose={() => { setSubscriptionOpen(false); announce('Pulse+ selected — checkout is ready to connect'); }} />
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite"><Sparkles size={17} fill="currentColor" />{toast}</div>
    </main>
  );
}

function DiscoverHeader({ onIncoming }: { onIncoming: () => void }) {
  return <header className="topbar"><span className="wordmark">PULSE</span><button className="incoming-button" aria-label="Open incoming likes" onClick={onIncoming}><Heart size={22} strokeWidth={2.2} /><span className="notification-dot">3</span></button></header>;
}

function DiscoverScreen({ profile, onOpen, onPass, onLike, onSpark }: { profile: Profile; onOpen: () => void; onPass: () => void; onLike: () => void; onSpark: () => void }) {
  return <section className="discover-screen" aria-label="Discover profiles"><ProfileCard profile={profile} onOpen={onOpen} onSwipeLeft={onPass} onSwipeRight={onLike} /><ActionRow onPass={onPass} onLike={onLike} onSpark={onSpark} /></section>;
}

function ProfileCard({ profile, onOpen, room, preview, onSwipeLeft, onSwipeRight }: { profile: Profile; onOpen?: () => void; room?: string | null; preview?: boolean; onSwipeLeft?: () => void; onSwipeRight?: () => void }) {
  const [offset, setOffset] = useState(0);
  const gesture = useRef<{ x: number; y: number; moved: boolean; pointerId: number } | null>(null);
  const suppressClick = useRef(false);
  const finishGesture = (clientX: number, clientY: number) => {
    const start = gesture.current;
    if (!start) return;
    const dx = clientX - start.x;
    const dy = clientY - start.y;
    const isSwipe = Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.15;
    gesture.current = null;
    setOffset(0);
    if (isSwipe) {
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 300);
      if (dx > 0) onSwipeRight?.(); else onSwipeLeft?.();
    }
  };
  return <button className={`profile-card ${offset > 18 ? 'swiping-right' : offset < -18 ? 'swiping-left' : ''}`} style={{ transform: `translateX(${offset}px) rotate(${offset / 28}deg)` }} onClick={() => { if (!suppressClick.current) onOpen?.(); }} onPointerDown={(e) => { if (e.pointerType === 'touch' || (!onSwipeLeft && !onSwipeRight)) return; gesture.current = { x: e.clientX, y: e.clientY, moved: false, pointerId: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => { const start = gesture.current; if (e.pointerType === 'touch' || !start || start.pointerId !== e.pointerId) return; const dx = e.clientX - start.x; const dy = e.clientY - start.y; if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) { start.moved = true; setOffset(Math.max(-150, Math.min(150, dx))); } }} onPointerUp={(e) => { if (e.pointerType !== 'touch') finishGesture(e.clientX, e.clientY); }} onPointerCancel={() => { gesture.current = null; setOffset(0); }} onTouchStart={(e) => { if (!onSwipeLeft && !onSwipeRight) return; const touch = e.touches[0]; gesture.current = { x: touch.clientX, y: touch.clientY, moved: false, pointerId: -1 }; }} onTouchMove={(e) => { const start = gesture.current; const touch = e.touches[0]; if (!start || start.pointerId !== -1 || !touch) return; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y; if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) { start.moved = true; setOffset(Math.max(-150, Math.min(150, dx))); } }} onTouchEnd={(e) => { const touch = e.changedTouches[0]; if (touch) finishGesture(touch.clientX, touch.clientY); }} aria-label={preview ? 'Preview of your dating card' : `Open ${profile.name}'s full profile`}>
    <Image src={profile.image} alt="" fill priority sizes="(max-width: 480px) 100vw, 390px" className="profile-photo card-photo-backdrop" aria-hidden="true" />
    <Image src={profile.image} alt={`${profile.name}'s profile`} fill priority sizes="(max-width: 480px) 100vw, 390px" className="profile-photo card-photo" />
    <span className="swipe-label pass-label">PASS</span><span className="swipe-label like-label">LIKE</span>
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
  const photos = profile.media.filter((item) => item.type === 'photo').slice(0, 6);
  const video = profile.media.filter((item) => item.type === 'video').slice(0, 1);
  const media = [...photos, ...video];
  const [mediaIndex, setMediaIndex] = useState(0);
  useEffect(() => { if (open) setMediaIndex(0); }, [open, profile.name]);
  const active = media[mediaIndex] ?? { type: 'photo' as const, src: profile.image };
  const changeMedia = (step: number) => setMediaIndex((index) => (index + step + media.length) % media.length);
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="bottom" showCloseButton={false} className="profile-sheet"><SheetTitle className="sr-only">{profile.name}&apos;s full profile</SheetTitle><SheetDescription className="sr-only">Photos and details for {profile.name}</SheetDescription><button className="sheet-handle" onClick={() => onOpenChange(false)} aria-label="Close full profile"><ChevronDown size={25} /></button><div className="profile-scroll"><div className="profile-film">{active.type === 'video' ? <video src={active.src} poster={active.poster} muted autoPlay loop playsInline aria-label={`${profile.name}'s profile video`} /> : <><Image src={active.src} alt="" fill sizes="390px" className="profile-photo card-photo-backdrop" aria-hidden="true" /><Image src={active.src} alt={`${profile.name}'s profile photo ${mediaIndex + 1}`} fill sizes="390px" className="profile-photo card-photo" /></>}<div className="media-bars" aria-hidden="true">{media.map((_, index) => <span key={index} className={index === mediaIndex ? 'active' : ''} />)}</div><span className="film-count">{active.type === 'video' && <Play size={12} fill="currentColor" />} {mediaIndex + 1} / {media.length}</span>{media.length > 1 && <><button className="media-hit previous" onClick={() => changeMedia(-1)} aria-label="Previous profile photo"><ChevronLeft size={24} /></button><button className="media-hit next" onClick={() => changeMedia(1)} aria-label="Next profile photo"><ChevronRight size={24} /></button><span className="media-hint">Tap right for the next photo</span></>}<div className="profile-title"><div className="name-row"><h2>{profile.name}, {profile.age}</h2><BadgeCheck size={21} fill="#FF4D6D" color="#0E0E10" /></div><p>{profile.place} · {profile.distance}</p></div></div><div className="profile-details"><section><span className="section-label">A perfect ordinary Sunday</span><p>{profile.name === 'Maya' ? 'Cold brew, a long walk with no route, then making dinner with a record on.' : profile.prompt}</p></section><section><span className="section-label">The quickest way to my heart</span><p>{profile.prompt}</p></section><section><span className="section-label">THE BASICS</span><div className="detail-chips"><span>Creative lead</span><span>5′6″</span><span>From Austin</span></div></section><section><span className="section-label">SHARED WITH YOU</span><div className="detail-chips coral">{profile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section></div></div><div className="sheet-actions"><ActionRow onPass={onPass} onLike={onLike} onSpark={onSpark} /></div></SheetContent></Sheet>;
}

function RoomsHub({ onOpenRoom }: { onOpenRoom: (name: string) => void }) {
  return <section className="screen scroll-screen"><header className="page-header"><p className="eyebrow">Find your frequency</p><h1>Rooms</h1><p>Walk into a vibe.</p></header><div className="room-grid">{roomData.map((item) => <button key={item.name} className={`room-tile ${item.className ?? ''}`} onClick={() => onOpenRoom(item.name)}><Image src={item.image} alt="" fill sizes="390px" className="profile-photo" /><span className="room-shade" /><span className="room-copy"><strong>{item.name}</strong><small>{item.caption}</small><em>{item.count}</em></span></button>)}</div><p className="stand-note"><Radio size={16} fill="currentColor" /> You can stand in Discover + one Room</p></section>;
}

function RoomStack({ room, profile, onBack, onOpen, onPass, onLike, onSpark }: { room: string; profile: Profile; onBack: () => void; onOpen: () => void; onPass: () => void; onLike: () => void; onSpark: () => void }) {
  return <section className="room-stack"><header className="room-header"><button onClick={onBack} aria-label="Back to rooms"><ArrowLeft size={22} /></button><div><strong>{room}</strong><span>{room === 'Tonight' ? '84 here now' : 'Live now'}</span></div><span className="live-dot" /></header><div className="context-chip">{room === 'Tonight' ? 'Free after 8' : `Into ${room.toLowerCase()}`}</div><div className="room-card-wrap"><ProfileCard profile={profile} room={room} onOpen={onOpen} onSwipeLeft={onPass} onSwipeRight={onLike} /></div><ActionRow onPass={onPass} onLike={onLike} onSpark={onSpark} /></section>;
}

function Incoming({ open, onOpenChange, onLikeBack, onPass }: { open: boolean; onOpenChange: (open: boolean) => void; onLikeBack: (profile: Profile) => void; onPass: (name: string) => void }) {
  const rows = [{ profile: profiles[1], liked: 'Your “tiny venues” tag', spark: true }, { profile: profiles[2], liked: 'Your Sunday prompt', spark: false }, { profile: profiles[0], liked: 'Your rooftop photo', spark: false }];
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visibleRows = rows.filter((row) => !dismissed.includes(row.profile.name));
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" showCloseButton={false} className="incoming-sheet"><SheetTitle className="incoming-title">Incoming</SheetTitle><SheetDescription className="incoming-subtitle">They liked you first. Like back to match and unlock chat.</SheetDescription><button className="close-round" onClick={() => onOpenChange(false)} aria-label="Close incoming"><X size={19} /></button><div className="incoming-list"><p className="list-label"><Sparkles size={14} fill="currentColor" /> SPARKS APPEAR FIRST</p>{visibleRows.map((row, index) => <div className={`incoming-row ${row.spark ? 'spark-row' : ''}`} key={`${row.profile.name}-${index}`}><span className="avatar"><Image src={row.profile.image} alt={row.profile.name} fill sizes="58px" className="profile-photo" /></span><span className="incoming-copy"><strong>{row.profile.name} {index < 2 && <BadgeCheck size={15} fill="#FF4D6D" color="#161618" />}</strong><small>{row.spark ? 'Sparked' : 'Liked'} · {row.liked}</small></span><span className="incoming-actions"><button onClick={() => { setDismissed((items) => [...items, row.profile.name]); onPass(row.profile.name); }} aria-label={`Pass on ${row.profile.name}`}><X size={18} /></button><button className="like-back" onClick={() => onLikeBack(row.profile)} aria-label={`Like ${row.profile.name} back`}><Heart size={18} fill="currentColor" /></button></span></div>)}{visibleRows.length === 0 && <p className="empty-likes">You’re all caught up.</p>}<p className="likes-note"><Heart size={15} /> A chat opens only after you both like each other.</p><button className="plus-link">See 8 more with Pulse+ <ChevronRight size={16} /></button></div></SheetContent></Sheet>;
}

function MatchModal({ open, onOpenChange, profile, room, onIcebreaker, onBrowse }: { open: boolean; onOpenChange: (open: boolean) => void; profile: Profile; room: string | null; onIcebreaker: (text: string) => void; onBrowse: () => void }) {
  const place = room || 'Discover';
  const ideas = room === 'Tonight' ? ['Tacos at 8?', 'Pick the first song', 'Best late-night walk?'] : ['What’s on repeat?', 'Ideal Sunday route?', 'Choose our first bite'];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent showCloseButton={false} className="match-dialog"><button className="match-close" onClick={() => onOpenChange(false)} aria-label="Close match"><X size={19} /></button><div className="match-photos"><span><Image src="/imani.png" alt="Your profile" fill sizes="92px" className="profile-photo" /></span><i><Heart size={20} fill="currentColor" /></i><span><Image src={profile.image} alt={`${profile.name}'s profile`} fill sizes="92px" className="profile-photo" /></span></div><DialogTitle className="match-title">It’s a Pulse</DialogTitle><DialogDescription className="match-sub">You both liked each other in {place}</DialogDescription><div className="icebreakers">{ideas.map((idea) => <button key={idea} onClick={() => onIcebreaker(idea)}>{idea}</button>)}</div><button className="primary-button" onClick={() => onIcebreaker(ideas[0])}><Send size={18} /> Send a spark</button><button className="text-button" onClick={onBrowse}>Keep browsing</button></DialogContent></Dialog>;
}

function ChatList({ contacts, onOpen }: { contacts: ChatContact[]; onOpen: (contact: ChatContact) => void }) {
  return <section className="screen scroll-screen"><header className="page-header chat-page-header"><p className="eyebrow">Mutual matches only</p><h1>Chat</h1><p>Likes become conversations after you both choose each other.</p></header><div className="chat-list">{contacts.map((contact) => <button className="chat-row" onClick={() => onOpen(contact)} key={contact.name}><span className="avatar chat-avatar"><Image src={contact.image} alt={contact.name} fill sizes="62px" className="profile-photo" />{contact.active && <i />}</span><span><strong>{contact.name}</strong><small>{contact.preview}</small></span><time>{contact.time}</time></button>)}</div></section>;
}

function ChatThread({ contact, messages, composer, onComposer, onSend, onBack, onSafety, onUnsend }: { contact: ChatContact; messages: { id: number; text: string; mine: boolean }[]; composer: string; onComposer: (text: string) => void; onSend: () => void; onBack: () => void; onSafety: () => void; onUnsend: (id: number) => void }) {
  return <section className="thread"><header className="thread-header"><button onClick={onBack} aria-label="Back to chats"><ArrowLeft size={22} /></button><span className="avatar small"><Image src={contact.image} alt={contact.name} fill sizes="42px" className="profile-photo" /></span><div><strong>{contact.name}</strong><small>{contact.active ? <><i /> Active now</> : 'Matched on PULSE'}</small></div><button className="shield" onClick={onSafety} aria-label="Safety options"><ShieldCheck size={22} /></button></header><div className="message-body"><div className="day-label">Your Pulse · Today</div>{messages.length === 1 && <div className="icebreakers inline"><button onClick={() => onComposer('What’s the best rooftop in Brooklyn?')}>Best rooftop?</button><button onClick={() => onComposer('Pick our first song 🎵')}>Pick our first song</button></div>}{messages.map((message) => <div key={message.id} className={`bubble-wrap ${message.mine ? 'mine' : ''}`}><div className="bubble">{message.text}</div>{message.mine && <button onClick={() => onUnsend(message.id)}>Unsend · 2m left</button>}</div>)}</div><form className="composer" onSubmit={(e) => { e.preventDefault(); onSend(); }}><input value={composer} onChange={(e) => onComposer(e.target.value)} placeholder={`Message ${contact.name}`} aria-label={`Message ${contact.name}`} /><button type="submit" aria-label="Send message"><Send size={19} /></button></form></section>;
}

function YourProfile({ freeTonight, onFreeTonight, onPreview, onRegistration, onSubscription }: { freeTonight: boolean; onFreeTonight: (checked: boolean) => void; onPreview: () => void; onRegistration: () => void; onSubscription: () => void }) {
  return <section className="screen scroll-screen profile-page"><header className="page-header profile-header"><p className="eyebrow">Your profile</p><div className="self-row"><span className="self-avatar"><Image src="/imani.png" alt="Your profile" fill sizes="82px" className="profile-photo" /></span><div><h1>Alex</h1><p>82% complete</p></div><button aria-label="Edit profile"><Edit3 size={20} /></button></div><div className="progress"><span /></div></header><div className="profile-quick-actions"><button onClick={onRegistration}><Camera size={19} /><span><strong>Registration</strong><small>Profile, media & verification</small></span><ChevronRight size={17} /></button><button onClick={onSubscription}><Crown size={19} /><span><strong>Pulse+</strong><small>Plans and benefits</small></span><ChevronRight size={17} /></button></div><div className="settings-list"><section><div className="setting-heading"><span><small>INTENT</small><strong>What you’re looking for</strong></span><Edit3 size={17} /></div><div className="detail-chips coral"><span>Long-term</span><span>Open to short</span></div></section><section><div className="setting-heading"><span><small>PROMPTS · 2 OF 2</small><strong>“My ideal Sunday…”</strong></span><Edit3 size={17} /></div><p>Outside early, somewhere cozy by dinner.</p></section><section><div className="setting-heading"><span><small>INTERESTS · 5 OF 5</small><strong>Your frequency</strong></span><Edit3 size={17} /></div><div className="detail-chips"><span>Live music</span><span>Trail days</span><span>Design</span><span>Cooking</span><span>Films</span></div></section><section className="toggle-row"><span><small>TONIGHT</small><strong>I’m free tonight</strong><p>Show me in the Tonight room.</p></span><Switch checked={freeTonight} onCheckedChange={onFreeTonight} aria-label="I'm free tonight" /></section></div><button className="primary-button preview-button" onClick={onPreview}>Preview my card <ChevronRight size={18} /></button></section>;
}

function ProfilePreview({ onBack }: { onBack: () => void }) {
  const self: Profile = { name: 'Alex', age: 28, image: '/imani.png', media: [{ type: 'photo', src: '/imani.png' }], place: 'Fort Greene', distance: '3 miles away', intent: 'Long-term', tags: ['Live music', 'Trail days'], prompt: 'Outside early, somewhere cozy by dinner.' };
  return <section className="preview-screen"><header className="preview-banner"><button onClick={onBack} aria-label="Back to profile"><ArrowLeft size={21} /></button><span><strong>This is how you appear</strong><small>What people see in Discover</small></span></header><div className="preview-wrap"><ProfileCard profile={self} preview /><button className="edit-card"><Edit3 size={18} /> Edit card</button></div></section>;
}

const registrationSteps = [
  { title: 'Your basics', detail: 'Name, birthday (18+), city, pronouns and phone or email.' },
  { title: 'Your media', detail: 'Choose one main photo for Discover. Add up to 6 photos and one 15-second profile video for the full profile.' },
  { title: 'Your intent', detail: 'Choose what you want: long-term, serious-ish, casual, or still figuring it out.' },
  { title: 'Your voice', detail: 'Answer two prompts and add up to five interests. Specific answers start better chats.' },
  { title: 'Your preferences', detail: 'Who you want to meet, age range, distance, and deal-breakers.' },
  { title: 'Safety check', detail: 'Verify with a live selfie. Your verification image is never shown on your profile.' },
];

function RegistrationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => { if (open) setStep(0); }, [open]);
  const item = registrationSteps[step];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent showCloseButton={false} className="flow-dialog"><button className="match-close" onClick={() => onOpenChange(false)} aria-label="Close registration"><X size={19} /></button><div className="flow-kicker">REGISTRATION · {step + 1} OF {registrationSteps.length}</div><div className="flow-progress">{registrationSteps.map((_, index) => <span key={index} className={index <= step ? 'active' : ''} />)}</div><DialogTitle>{item.title}</DialogTitle><DialogDescription>{item.detail}</DialogDescription>{step === 1 && <div className="media-rules"><div><Camera size={20} /><span><strong>Main photo</strong><small>One cinematic portrait on Discover</small></span><Check size={17} /></div><div><Camera size={20} /><span><strong>Full profile</strong><small>Up to 6 photos · tap to advance</small></span><Check size={17} /></div><div><Play size={20} /><span><strong>Profile video</strong><small>One video · maximum 15 seconds</small></span><Check size={17} /></div></div>}<div className="quality-note"><Sparkles size={18} /><span><strong>Cinematic, still honest</strong><small>High resolution, natural skin texture, clear face, no heavy filters or AI identity changes.</small></span></div><div className="flow-actions">{step > 0 && <button className="secondary-button" onClick={() => setStep((value) => value - 1)}>Back</button>}<button className="primary-button" onClick={() => { if (step === registrationSteps.length - 1) onOpenChange(false); else setStep((value) => value + 1); }}>{step === registrationSteps.length - 1 ? 'Finish' : 'Continue'} <ChevronRight size={18} /></button></div></DialogContent></Dialog>;
}

function SubscriptionDialog({ open, onOpenChange, onChoose }: { open: boolean; onOpenChange: (open: boolean) => void; onChoose: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent showCloseButton={false} className="flow-dialog subscription-dialog"><button className="match-close" onClick={() => onOpenChange(false)} aria-label="Close subscription details"><X size={19} /></button><div className="flow-kicker"><Crown size={15} /> PULSE+</div><DialogTitle>More signal. Less noise.</DialogTitle><DialogDescription>Free keeps matching and chat open. Pulse+ adds control and visibility.</DialogDescription><div className="plan-grid"><section><span>FREE</span><strong>$0</strong><ul><li><Check size={15} /> Discover, Rooms and mutual-match chat</li><li><Check size={15} /> 1 Spark each day</li><li><Check size={15} /> See two recent incoming likes</li></ul></section><section className="featured"><span>PULSE+</span><strong>$14.99 <small>/ month</small></strong><ul><li><Check size={15} /> See everyone who liked you</li><li><Check size={15} /> 3 Sparks each day</li><li><Check size={15} /> Rewind your last pass</li><li><Check size={15} /> Advanced intent and lifestyle filters</li></ul></section></div><button className="primary-button plan-button" onClick={onChoose}>Choose Pulse+ <ChevronRight size={18} /></button><p className="billing-note">Prototype pricing · billing is not connected. Cancel anytime when subscriptions launch. Restore purchases will be available.</p></DialogContent></Dialog>;
}

function SafetyDialog({ open, onOpenChange, onAction }: { open: boolean; onOpenChange: (open: boolean) => void; onAction: (message: string) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="safety-dialog"><DialogTitle>Safety with Maya</DialogTitle><DialogDescription>These tools are always one tap away.</DialogDescription><button onClick={() => { onOpenChange(false); onAction('Date details shared with your contact'); }}><ShieldCheck size={20} /> Share date details <ChevronRight size={17} /></button><button onClick={() => onAction('Maya reported for review')}><MoreHorizontal size={20} /> Report profile <ChevronRight size={17} /></button><button className="danger" onClick={() => { onOpenChange(false); onAction('Maya has been blocked'); }}><X size={20} /> Block Maya <ChevronRight size={17} /></button></DialogContent></Dialog>;
}
