'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft, BadgeCheck, Camera, Check, ChevronDown, ChevronLeft, ChevronRight,
  Crown, Edit3, Heart, Home, Mail, MessageCircle, MoreHorizontal, Play, Radio,
  Send, Share2, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, Users, X,
} from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

type Tab = 'Discover' | 'Rooms' | 'Chat' | 'Profile';
type Gender = 'Woman' | 'Man' | 'Nonbinary';
type MediaItem = { type: 'photo' | 'video'; src: string; poster?: string };
type Profile = { name: string; age: number; gender: Gender; image: string; media: MediaItem[]; place: string; distance: string; distanceMiles: number; intent: string; tags: string[]; prompt: string; height: string; ethnicity: string; pets: string; kids: string; wantsKids: string; drinking: string; smoking: string };
type ChatContact = { name: string; image: string; preview: string; time: string; active?: boolean; unread?: number };
type Filters = { genders: Gender[]; minAge: number; maxAge: number; maxDistance: number; intents: string[]; smoking: 'Any' | 'No'; wantsKids: 'Any' | 'Yes' | 'No' };
type RegistrationData = { name: string; birthday: string; city: string; gender: Gender; pronouns: string; height: string; ethnicity: string; pets: string; kids: string; wantsKids: string; drinking: string; smoking: string; intents: string[]; interests: string[]; promptOne: string; promptTwo: string; preferredGenders: Gender[]; minAge: number; maxAge: number; maxDistance: number };
type ChatMessage = { id: number; text: string; mine: boolean };

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
  { name: 'Maya', age: 27, gender: 'Woman', image: '/maya.png', media: [{ type: 'photo', src: '/maya.png' }, { type: 'photo', src: '/maya-vinyl.png' }, { type: 'photo', src: '/maya-walk.png' }], place: 'Brooklyn', distance: '2 miles away', distanceMiles: 2, intent: 'Long-term', tags: ['Live music', 'Night walks'], prompt: 'Be curious. Pick the restaurant. Let me make the playlist.', height: '5′6″', ethnicity: 'South Asian', pets: 'Likes dogs', kids: 'No kids', wantsKids: 'Yes', drinking: 'Socially', smoking: 'No' },
  { name: 'Lena', age: 29, gender: 'Woman', image: '/lena.png', media: [{ type: 'photo', src: '/lena.png' }], place: 'Lower East Side', distance: '3 miles away', distanceMiles: 3, intent: 'Marriage', tags: ['Vinyl', 'Tiny venues'], prompt: 'Show me the song you never skip.', height: '5′8″', ethnicity: 'White', pets: 'Has a cat', kids: 'No kids', wantsKids: 'Yes', drinking: 'Socially', smoking: 'No' },
  { name: 'Imani', age: 28, gender: 'Woman', image: '/imani.png', media: [{ type: 'photo', src: '/imani.png' }], place: 'Fort Greene', distance: '4 miles away', distanceMiles: 4, intent: 'Short-term', tags: ['Trail days', 'Good coffee'], prompt: 'A sunrise hike is worth the alarm.', height: '5′7″', ethnicity: 'Black', pets: 'Dog person', kids: 'Has kids', wantsKids: 'Maybe', drinking: 'Rarely', smoking: 'No' },
  { name: 'Noah', age: 31, gender: 'Man', image: '/noah.png', media: [{ type: 'photo', src: '/noah.png' }], place: 'East Village', distance: '5 miles away', distanceMiles: 5, intent: 'Long-term', tags: ['Coffee walks', 'Design'], prompt: 'A bookstore, a long coffee, and nowhere else to be.', height: '5′11″', ethnicity: 'East Asian', pets: 'Likes dogs', kids: 'No kids', wantsKids: 'Yes', drinking: 'Socially', smoking: 'No' },
  { name: 'Mateo', age: 30, gender: 'Man', image: '/mateo.png', media: [{ type: 'photo', src: '/mateo.png' }], place: 'Astoria', distance: '7 miles away', distanceMiles: 7, intent: 'Marriage', tags: ['Cooking', 'Going out'], prompt: 'Fresh pasta is my love language. You pick the wine.', height: '6′0″', ethnicity: 'Latino', pets: 'No pets', kids: 'No kids', wantsKids: 'Yes', drinking: 'Socially', smoking: 'No' },
  { name: 'Jordan', age: 29, gender: 'Man', image: '/jordan.png', media: [{ type: 'photo', src: '/jordan.png' }], place: 'Harlem', distance: '9 miles away', distanceMiles: 9, intent: 'Serious-ish', tags: ['Rescue dogs', 'Live jazz'], prompt: 'Let’s find the city’s best park bench and people-watch.', height: '6′1″', ethnicity: 'Black', pets: 'Has a dog', kids: 'Has kids', wantsKids: 'No', drinking: 'Rarely', smoking: 'No' },
];

const chatContacts: ChatContact[] = [
  { name: 'Maya', image: '/maya.png', preview: 'That rooftop view is undefeated.', time: 'Now', active: true },
  { name: 'Lena', image: '/lena.png', preview: 'Sent a voice note', time: '12m', unread: 2 },
  { name: 'Imani', image: '/imani.png', preview: 'Saturday could work!', time: '2h' },
];

const defaultFilters: Filters = { genders: ['Woman', 'Man'], minAge: 24, maxAge: 36, maxDistance: 15, intents: [], smoking: 'Any', wantsKids: 'Any' };
const relationshipOptions = ['Long-term', 'Marriage', 'Serious-ish', 'Short-term'];
const interestOptions = ['Cooking', 'Going out', 'Live music', 'Pets', 'Travel', 'Films', 'Trail days', 'Coffee'];

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
  const [contacts, setContacts] = useState<ChatContact[]>(chatContacts);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [matchProfile, setMatchProfile] = useState<Profile>(profiles[0]);
  const [composer, setComposer] = useState('');
  const [messagesByContact, setMessagesByContact] = useState<Record<string, ChatMessage[]>>({
    Maya: [{ id: 1, text: 'That rooftop view is undefeated.', mine: false }],
    Lena: [{ id: 2, text: 'I sent you a voice note — your music prompt got me.', mine: false }],
    Imani: [{ id: 3, text: 'Saturday could work!', mine: false }],
  });
  const [freeTonight, setFreeTonight] = useState(true);
  const [previewCard, setPreviewCard] = useState(false);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sentLikes, setSentLikes] = useState<Profile[]>([profiles[3]]);
  const [declinedIncoming, setDeclinedIncoming] = useState<string[]>([]);
  const [registered, setRegistered] = useState(false);
  const [selfName, setSelfName] = useState('Alex');
  const filteredProfiles = profiles.filter((profile) => filters.genders.includes(profile.gender) && profile.age >= filters.minAge && profile.age <= filters.maxAge && profile.distanceMiles <= filters.maxDistance && (filters.intents.length === 0 || filters.intents.includes(profile.intent)) && (filters.smoking === 'Any' || profile.smoking === 'No') && (filters.wantsKids === 'Any' || profile.wantsKids === filters.wantsKids));
  const current = filteredProfiles[profileIndex % Math.max(filteredProfiles.length, 1)] ?? profiles[0];
  const activeMessages = messagesByContact[activeChat.name] ?? [];
  const activeFilterCount = (filters.genders.length !== 2 ? 1 : 0) + (filters.intents.length ? 1 : 0) + (filters.maxDistance !== 15 ? 1 : 0) + (filters.smoking !== 'Any' ? 1 : 0) + (filters.wantsKids !== 'Any' ? 1 : 0);

  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const nextProfile = () => {
    setProfileOpen(false);
    if (filteredProfiles.length) setProfileIndex((value) => (value + 1) % filteredProfiles.length);
  };

  const like = () => {
    setProfileOpen(false);
    setSentLikes((items) => items.some((item) => item.name === current.name) ? items : [...items, current]);
    if (current.name === 'Maya') {
      setMatchProfile(current);
      setMatchOpen(true);
    } else {
      announce(`Like sent to ${current.name} — track it in You liked`);
      nextProfile();
    }
  };

  const spark = () => {
    setProfileOpen(false);
    announce(`Spark sent — ${current.name === 'Maya' ? 'she' : 'they'}’ll see you first`);
  };

  const openChatWith = (text = '', profile = matchProfile) => {
    setMatchOpen(false);
    setIncomingOpen(false);
    const contact = { name: profile.name, image: profile.image, preview: text || 'You matched today', time: 'Now', active: true, unread: 0 };
    setActiveChat(contact);
    setContacts((items) => items.some((item) => item.name === profile.name) ? items.map((item) => item.name === profile.name ? { ...item, unread: 0 } : item) : [contact, ...items]);
    setMessagesByContact((items) => items[profile.name] ? items : { ...items, [profile.name]: [] });
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
    setMessagesByContact((items) => ({ ...items, [activeChat.name]: [...(items[activeChat.name] ?? []), { id: Date.now(), text, mine: true }] }));
    setContacts((items) => items.map((item) => item.name === activeChat.name ? { ...item, preview: text, time: 'Now', unread: 0 } : item));
    setComposer('');
  };

  const openExistingChat = (contact: ChatContact) => {
    setActiveChat({ ...contact, unread: 0 });
    setContacts((items) => items.map((item) => item.name === contact.name ? { ...item, unread: 0 } : item));
    setChatOpen(true);
  };

  const shareProfile = async (profile: Profile) => {
    const shareData = { title: `${profile.name} on PULSE`, text: `Take a look at ${profile.name}'s PULSE profile.`, url: `${window.location.origin}/?profile=${profile.name.toLowerCase()}` };
    announce(`Share link ready for ${profile.name}`);
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard?.writeText(`${shareData.text} ${shareData.url}`);
    } catch { /* The user can dismiss the native share sheet without changing the profile. */ }
  };

  const completeRegistration = (data: RegistrationData) => {
    setSelfName(data.name || 'Alex');
    setRegistered(true);
    setFilters((value) => ({ ...value, genders: data.preferredGenders, minAge: data.minAge, maxAge: data.maxAge, maxDistance: data.maxDistance, intents: data.intents }));
    window.localStorage.setItem('pulse-registration', JSON.stringify(data));
    setRegistrationOpen(false);
    setProfileIndex(0);
    announce('Profile registered — you’re ready to be discovered');
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
        {tab === 'Discover' && <DiscoverHeader onIncoming={() => setIncomingOpen(true)} onFilters={() => setFilterOpen(true)} activeFilterCount={activeFilterCount} />}
        {tab === 'Discover' && (filteredProfiles.length ? <DiscoverScreen profile={current} onOpen={() => setProfileOpen(true)} onPass={nextProfile} onLike={like} onSpark={spark} /> : <EmptyDiscover onFilters={() => setFilterOpen(true)} />)}
        {tab === 'Rooms' && !room && <RoomsHub onOpenRoom={setRoom} />}
        {tab === 'Rooms' && room && <RoomStack room={room} profile={current} onBack={() => setRoom(null)} onOpen={() => setProfileOpen(true)} onPass={nextProfile} onLike={like} onSpark={spark} />}
        {tab === 'Chat' && !chatOpen && <ChatList contacts={contacts} onOpen={openExistingChat} />}
        {tab === 'Chat' && chatOpen && <ChatThread contact={activeChat} messages={activeMessages} composer={composer} onComposer={setComposer} onSend={sendMessage} onBack={() => setChatOpen(false)} onSafety={() => setSafetyOpen(true)} onUnsend={(id) => setMessagesByContact((items) => ({ ...items, [activeChat.name]: (items[activeChat.name] ?? []).filter((item) => item.id !== id) }))} />}
        {tab === 'Profile' && !previewCard && <YourProfile name={selfName} registered={registered} freeTonight={freeTonight} onFreeTonight={setFreeTonight} onPreview={() => setPreviewCard(true)} onRegistration={() => setRegistrationOpen(true)} onSubscription={() => setSubscriptionOpen(true)} />}
        {tab === 'Profile' && previewCard && <ProfilePreview name={selfName} onBack={() => setPreviewCard(false)} />}
        <TabBar active={tab} onChange={handleTab} />
      </div>

      <FullProfile profile={current} open={profileOpen} onOpenChange={setProfileOpen} onPass={nextProfile} onLike={like} onSpark={spark} onShare={() => shareProfile(current)} />
      <Incoming open={incomingOpen} onOpenChange={setIncomingOpen} sentLikes={sentLikes} declined={declinedIncoming} onLikeBack={likeBack} onPass={(name) => { setDeclinedIncoming((items) => [...items, name]); announce(`${name} marked Not for me`); }} onMessage={(profile) => openChatWith('', profile)} />
      <MatchModal open={matchOpen} onOpenChange={setMatchOpen} profile={matchProfile} room={room} onIcebreaker={(text) => openChatWith(text, matchProfile)} onBrowse={() => { setMatchOpen(false); nextProfile(); }} />
      <SafetyDialog open={safetyOpen} onOpenChange={setSafetyOpen} onAction={announce} />
      <RegistrationDialog open={registrationOpen} onOpenChange={setRegistrationOpen} onComplete={completeRegistration} />
      <FilterDialog open={filterOpen} onOpenChange={setFilterOpen} filters={filters} onApply={(next) => { setFilters(next); setProfileIndex(0); setFilterOpen(false); announce('Preferences applied'); }} />
      <SubscriptionDialog open={subscriptionOpen} onOpenChange={setSubscriptionOpen} onChoose={() => { setSubscriptionOpen(false); announce('Pulse+ selected — checkout is ready to connect'); }} />
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite"><Sparkles size={17} fill="currentColor" />{toast}</div>
    </main>
  );
}

function DiscoverHeader({ onIncoming, onFilters, activeFilterCount }: { onIncoming: () => void; onFilters: () => void; activeFilterCount: number }) {
  return <header className="topbar"><button className="filter-button" aria-label="Filter profiles" onClick={onFilters}><SlidersHorizontal size={21} />{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button><span className="wordmark">PULSE</span><button className="incoming-button" aria-label="Open likes center" onClick={onIncoming}><Heart size={22} strokeWidth={2.2} /><span className="notification-dot">3</span></button></header>;
}

function EmptyDiscover({ onFilters }: { onFilters: () => void }) {
  return <section className="empty-discover"><SlidersHorizontal size={30} /><h1>No profiles match yet</h1><p>Try widening your age, distance or lifestyle preferences.</p><button className="primary-button" onClick={onFilters}>Adjust preferences</button></section>;
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
  return <button className={`profile-card ${offset > 18 ? 'swiping-right' : offset < -18 ? 'swiping-left' : ''}`} style={{ transform: `translateX(${offset}px) rotate(${offset / 28}deg)` }} onClick={() => { if (!suppressClick.current) onOpen?.(); }} onDragStart={(event) => event.preventDefault()} onPointerDown={(e) => { if (e.pointerType === 'touch' || (!onSwipeLeft && !onSwipeRight)) return; gesture.current = { x: e.clientX, y: e.clientY, moved: false, pointerId: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => { const start = gesture.current; if (e.pointerType === 'touch' || !start || start.pointerId !== e.pointerId) return; const dx = e.clientX - start.x; const dy = e.clientY - start.y; if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) { start.moved = true; setOffset(Math.max(-150, Math.min(150, dx))); } }} onPointerUp={(e) => { if (e.pointerType !== 'touch') finishGesture(e.clientX, e.clientY); }} onMouseUp={(e) => { if (gesture.current?.pointerId !== -1) finishGesture(e.clientX, e.clientY); }} onPointerCancel={() => { gesture.current = null; setOffset(0); }} onTouchStart={(e) => { if (!onSwipeLeft && !onSwipeRight) return; const touch = e.touches[0]; gesture.current = { x: touch.clientX, y: touch.clientY, moved: false, pointerId: -1 }; }} onTouchMove={(e) => { const start = gesture.current; const touch = e.touches[0]; if (!start || start.pointerId !== -1 || !touch) return; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y; if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) { start.moved = true; setOffset(Math.max(-150, Math.min(150, dx))); } }} onTouchEnd={(e) => { const touch = e.changedTouches[0]; if (touch) finishGesture(touch.clientX, touch.clientY); }} aria-label={preview ? 'Preview of your dating card' : `Open ${profile.name}'s full profile`}>
    <Image src={profile.image} alt="" fill priority draggable={false} sizes="(max-width: 480px) 100vw, 390px" className="profile-photo card-photo-backdrop" aria-hidden="true" />
    <Image src={profile.image} alt={`${profile.name}'s profile`} fill priority draggable={false} sizes="(max-width: 480px) 100vw, 390px" className="profile-photo card-photo" />
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

function FullProfile({ profile, open, onOpenChange, onPass, onLike, onSpark, onShare }: { profile: Profile; open: boolean; onOpenChange: (open: boolean) => void; onPass: () => void; onLike: () => void; onSpark: () => void; onShare: () => void }) {
  const photos = profile.media.filter((item) => item.type === 'photo').slice(0, 6);
  const video = profile.media.filter((item) => item.type === 'video').slice(0, 1);
  const media = [...photos, ...video];
  const [mediaIndex, setMediaIndex] = useState(0);
  useEffect(() => { if (open) setMediaIndex(0); }, [open, profile.name]);
  const active = media[mediaIndex] ?? { type: 'photo' as const, src: profile.image };
  const changeMedia = (step: number) => setMediaIndex((index) => (index + step + media.length) % media.length);
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="bottom" showCloseButton={false} className="profile-sheet"><SheetTitle className="sr-only">{profile.name}&apos;s full profile</SheetTitle><SheetDescription className="sr-only">Photos and details for {profile.name}</SheetDescription><button className="sheet-handle" onClick={() => onOpenChange(false)} aria-label="Close full profile"><ChevronDown size={25} /></button><button className="profile-share" onClick={onShare} aria-label={`Share ${profile.name}'s profile with friends or family`}><Share2 size={17} /> Share</button><div className="profile-scroll"><div className="profile-film">{active.type === 'video' ? <video src={active.src} poster={active.poster} muted autoPlay loop playsInline aria-label={`${profile.name}'s profile video`} /> : <><Image src={active.src} alt="" fill sizes="390px" className="profile-photo card-photo-backdrop" aria-hidden="true" /><Image src={active.src} alt={`${profile.name}'s profile photo ${mediaIndex + 1}`} fill sizes="390px" className="profile-photo card-photo" /></>}<div className="media-bars" aria-hidden="true">{media.map((_, index) => <span key={index} className={index === mediaIndex ? 'active' : ''} />)}</div><span className="film-count">{active.type === 'video' && <Play size={12} fill="currentColor" />} {mediaIndex + 1} / {media.length}</span>{media.length > 1 && <><button className="media-hit previous" onClick={() => changeMedia(-1)} aria-label="Previous profile photo"><ChevronLeft size={24} /></button><button className="media-hit next" onClick={() => changeMedia(1)} aria-label="Next profile photo"><ChevronRight size={24} /></button><span className="media-hint">Tap right for the next photo</span></>}<div className="profile-title"><div className="name-row"><h2>{profile.name}, {profile.age}</h2><BadgeCheck size={21} fill="#FF4D6D" color="#0E0E10" /></div><p>{profile.place} · {profile.distance}</p></div></div><div className="profile-details"><section><span className="section-label">A perfect ordinary Sunday</span><p>{profile.name === 'Maya' ? 'Cold brew, a long walk with no route, then making dinner with a record on.' : profile.prompt}</p></section><section><span className="section-label">The quickest way to my heart</span><p>{profile.prompt}</p></section><section><span className="section-label">ABOUT {profile.name.toUpperCase()}</span><div className="detail-chips"><span>{profile.intent}</span><span>{profile.height}</span><span>{profile.ethnicity}</span><span>{profile.pets}</span><span>{profile.kids}</span><span>Wants kids: {profile.wantsKids}</span><span>Drinks: {profile.drinking}</span><span>Smokes: {profile.smoking}</span></div></section><section><span className="section-label">SHARED WITH YOU</span><div className="detail-chips coral">{profile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section></div></div><div className="sheet-actions"><ActionRow onPass={onPass} onLike={onLike} onSpark={onSpark} /></div></SheetContent></Sheet>;
}

function RoomsHub({ onOpenRoom }: { onOpenRoom: (name: string) => void }) {
  return <section className="screen scroll-screen"><header className="page-header"><p className="eyebrow">Find your frequency</p><h1>Rooms</h1><p>Walk into a vibe.</p></header><div className="room-grid">{roomData.map((item) => <button key={item.name} className={`room-tile ${item.className ?? ''}`} onClick={() => onOpenRoom(item.name)}><Image src={item.image} alt="" fill sizes="390px" className="profile-photo" /><span className="room-shade" /><span className="room-copy"><strong>{item.name}</strong><small>{item.caption}</small><em>{item.count}</em></span></button>)}</div><p className="stand-note"><Radio size={16} fill="currentColor" /> You can stand in Discover + one Room</p></section>;
}

function RoomStack({ room, profile, onBack, onOpen, onPass, onLike, onSpark }: { room: string; profile: Profile; onBack: () => void; onOpen: () => void; onPass: () => void; onLike: () => void; onSpark: () => void }) {
  return <section className="room-stack"><header className="room-header"><button onClick={onBack} aria-label="Back to rooms"><ArrowLeft size={22} /></button><div><strong>{room}</strong><span>{room === 'Tonight' ? '84 here now' : 'Live now'}</span></div><span className="live-dot" /></header><div className="context-chip">{room === 'Tonight' ? 'Free after 8' : `Into ${room.toLowerCase()}`}</div><div className="room-card-wrap"><ProfileCard profile={profile} room={room} onOpen={onOpen} onSwipeLeft={onPass} onSwipeRight={onLike} /></div><ActionRow onPass={onPass} onLike={onLike} onSpark={onSpark} /></section>;
}

function Incoming({ open, onOpenChange, sentLikes, declined, onLikeBack, onPass, onMessage }: { open: boolean; onOpenChange: (open: boolean) => void; sentLikes: Profile[]; declined: string[]; onLikeBack: (profile: Profile) => void; onPass: (name: string) => void; onMessage: (profile: Profile) => void }) {
  const [view, setView] = useState<'incoming' | 'sent'>('incoming');
  const rows = [{ profile: profiles[1], liked: 'Your “tiny venues” tag', spark: true }, { profile: profiles[4], liked: 'Your cooking prompt', spark: false }, { profile: profiles[2], liked: 'Your Sunday prompt', spark: false }];
  const visibleRows = rows.filter((row) => !declined.includes(row.profile.name));
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" showCloseButton={false} className="incoming-sheet"><SheetTitle className="incoming-title">Likes</SheetTitle><SheetDescription className="incoming-subtitle">Accept a like to match. Messages unlock only after a match.</SheetDescription><button className="close-round" onClick={() => onOpenChange(false)} aria-label="Close likes center"><X size={19} /></button><div className="likes-tabs" role="tablist"><button className={view === 'incoming' ? 'active' : ''} onClick={() => setView('incoming')} role="tab">Liked you <span>{visibleRows.length}</span></button><button className={view === 'sent' ? 'active' : ''} onClick={() => setView('sent')} role="tab">You liked <span>{sentLikes.length}</span></button></div>{view === 'incoming' ? <div className="incoming-list"><p className="list-label"><Sparkles size={14} fill="currentColor" /> SPARKS APPEAR FIRST</p>{visibleRows.map((row, index) => <div className={`incoming-row ${row.spark ? 'spark-row' : ''}`} key={`${row.profile.name}-${index}`}><span className="avatar"><Image src={row.profile.image} alt={row.profile.name} fill sizes="58px" className="profile-photo" /></span><span className="incoming-copy"><strong>{row.profile.name} {index < 2 && <BadgeCheck size={15} fill="#FF4D6D" color="#161618" />}</strong><small>{row.profile.intent} · {row.liked}</small><span className="decision-actions"><button onClick={() => onPass(row.profile.name)}>Not for me</button><button className="accept-like" onClick={() => onLikeBack(row.profile)}>Accept</button></span></span></div>)}{visibleRows.length === 0 && <p className="empty-likes">You’re all caught up.</p>}<p className="likes-note"><Heart size={15} /> Accept creates a match. “Not for me” removes the like privately.</p></div> : <div className="sent-likes">{sentLikes.length ? sentLikes.map((profile) => <div className="sent-like" key={profile.name}><span className="avatar"><Image src={profile.image} alt={profile.name} fill sizes="58px" className="profile-photo" /></span><span><strong>{profile.name}</strong><small>{profile.name === 'Maya' ? 'Matched — you can message now' : 'Waiting for them to like you back'}</small></span>{profile.name === 'Maya' ? <button onClick={() => onMessage(profile)}>Message</button> : <span className="waiting-pill">Waiting</span>}</div>) : <p className="empty-likes">Profiles you like will appear here.</p>}</div>}<button className="plus-link">See every incoming like with Pulse+ <ChevronRight size={16} /></button></SheetContent></Sheet>;
}

function MatchModal({ open, onOpenChange, profile, room, onIcebreaker, onBrowse }: { open: boolean; onOpenChange: (open: boolean) => void; profile: Profile; room: string | null; onIcebreaker: (text: string) => void; onBrowse: () => void }) {
  const place = room || 'Discover';
  const ideas = room === 'Tonight' ? ['Tacos at 8?', 'Pick the first song', 'Best late-night walk?'] : ['What’s on repeat?', 'Ideal Sunday route?', 'Choose our first bite'];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent showCloseButton={false} className="match-dialog"><button className="match-close" onClick={() => onOpenChange(false)} aria-label="Close match"><X size={19} /></button><div className="match-photos"><span><Image src="/imani.png" alt="Your profile" fill sizes="92px" className="profile-photo" /></span><i><Heart size={20} fill="currentColor" /></i><span><Image src={profile.image} alt={`${profile.name}'s profile`} fill sizes="92px" className="profile-photo" /></span></div><DialogTitle className="match-title">It’s a Pulse</DialogTitle><DialogDescription className="match-sub">You both liked each other in {place}</DialogDescription><div className="icebreakers">{ideas.map((idea) => <button key={idea} onClick={() => onIcebreaker(idea)}>{idea}</button>)}</div><button className="primary-button" onClick={() => onIcebreaker(ideas[0])}><Send size={18} /> Send a spark</button><button className="text-button" onClick={onBrowse}>Keep browsing</button></DialogContent></Dialog>;
}

function ChatList({ contacts, onOpen }: { contacts: ChatContact[]; onOpen: (contact: ChatContact) => void }) {
  return <section className="screen scroll-screen"><header className="page-header chat-page-header"><p className="eyebrow">Mutual matches only</p><h1>Chat</h1><p>New messages are marked in coral. Tap a conversation to read and reply.</p></header><div className="chat-list">{contacts.map((contact) => <button className="chat-row" onClick={() => onOpen(contact)} key={contact.name}><span className="avatar chat-avatar"><Image src={contact.image} alt={contact.name} fill sizes="62px" className="profile-photo" />{contact.active && <i />}</span><span><strong>{contact.name}</strong><small className={contact.unread ? 'unread-copy' : ''}>{contact.preview}</small></span><span className="chat-meta"><time>{contact.time}</time>{contact.unread ? <b aria-label={`${contact.unread} unread messages`}>{contact.unread}</b> : null}</span></button>)}</div></section>;
}

function ChatThread({ contact, messages, composer, onComposer, onSend, onBack, onSafety, onUnsend }: { contact: ChatContact; messages: { id: number; text: string; mine: boolean }[]; composer: string; onComposer: (text: string) => void; onSend: () => void; onBack: () => void; onSafety: () => void; onUnsend: (id: number) => void }) {
  return <section className="thread"><header className="thread-header"><button onClick={onBack} aria-label="Back to chats"><ArrowLeft size={22} /></button><span className="avatar small"><Image src={contact.image} alt={contact.name} fill sizes="42px" className="profile-photo" /></span><div><strong>{contact.name}</strong><small>{contact.active ? <><i /> Active now</> : 'Matched on PULSE'}</small></div><button className="shield" onClick={onSafety} aria-label="Safety options"><ShieldCheck size={22} /></button></header><div className="message-body"><div className="day-label">Your Pulse · Today</div>{messages.length === 1 && <div className="icebreakers inline"><button onClick={() => onComposer('What’s the best rooftop in Brooklyn?')}>Best rooftop?</button><button onClick={() => onComposer('Pick our first song 🎵')}>Pick our first song</button></div>}{messages.map((message) => <div key={message.id} className={`bubble-wrap ${message.mine ? 'mine' : ''}`}><div className="bubble">{message.text}</div>{message.mine && <button onClick={() => onUnsend(message.id)}>Unsend · 2m left</button>}</div>)}</div><form className="composer" onSubmit={(e) => { e.preventDefault(); onSend(); }}><input value={composer} onChange={(e) => onComposer(e.target.value)} placeholder={`Message ${contact.name}`} aria-label={`Message ${contact.name}`} /><button type="submit" aria-label="Send message"><Send size={19} /></button></form></section>;
}

function YourProfile({ name, registered, freeTonight, onFreeTonight, onPreview, onRegistration, onSubscription }: { name: string; registered: boolean; freeTonight: boolean; onFreeTonight: (checked: boolean) => void; onPreview: () => void; onRegistration: () => void; onSubscription: () => void }) {
  return <section className="screen scroll-screen profile-page"><header className="page-header profile-header"><p className="eyebrow">Your profile</p><div className="self-row"><span className="self-avatar"><Image src="/imani.png" alt="Your profile" fill sizes="82px" className="profile-photo" /></span><div><h1>{name}</h1><p>{registered ? '100% complete · verified later' : '82% complete'}</p></div><button aria-label="Edit profile" onClick={onRegistration}><Edit3 size={20} /></button></div><div className={`progress ${registered ? 'complete' : ''}`}><span /></div></header><div className="profile-quick-actions"><button onClick={onRegistration}><Camera size={19} /><span><strong>{registered ? 'Edit registration' : 'Finish registration'}</strong><small>Basics, interests & preferences</small></span><ChevronRight size={17} /></button><button onClick={onSubscription}><Crown size={19} /><span><strong>Pulse+</strong><small>Plans and benefits</small></span><ChevronRight size={17} /></button></div><div className="settings-list"><section><div className="setting-heading"><span><small>INTENT</small><strong>What you’re looking for</strong></span><Edit3 size={17} /></div><div className="detail-chips coral"><span>Long-term</span><span>Marriage</span></div></section><section><div className="setting-heading"><span><small>PROMPTS · 2 OF 2</small><strong>“My ideal Sunday…”</strong></span><Edit3 size={17} /></div><p>Outside early, somewhere cozy by dinner.</p></section><section><div className="setting-heading"><span><small>INTERESTS · 5 OF 5</small><strong>Your frequency</strong></span><Edit3 size={17} /></div><div className="detail-chips"><span>Live music</span><span>Pets</span><span>Travel</span><span>Cooking</span><span>Films</span></div></section><section className="toggle-row"><span><small>TONIGHT</small><strong>I’m free tonight</strong><p>Show me in the Tonight room.</p></span><Switch checked={freeTonight} onCheckedChange={onFreeTonight} aria-label="I'm free tonight" /></section></div><button className="primary-button preview-button" onClick={onPreview}>Preview my card <ChevronRight size={18} /></button></section>;
}

function ProfilePreview({ name, onBack }: { name: string; onBack: () => void }) {
  const self: Profile = { name, age: 28, gender: 'Nonbinary', image: '/imani.png', media: [{ type: 'photo', src: '/imani.png' }], place: 'Fort Greene', distance: '3 miles away', distanceMiles: 3, intent: 'Long-term', tags: ['Live music', 'Pets'], prompt: 'Outside early, somewhere cozy by dinner.', height: '5′9″', ethnicity: 'Multiracial', pets: 'Has a dog', kids: 'No kids', wantsKids: 'Yes', drinking: 'Socially', smoking: 'No' };
  return <section className="preview-screen"><header className="preview-banner"><button onClick={onBack} aria-label="Back to profile"><ArrowLeft size={21} /></button><span><strong>This is how you appear</strong><small>What people see in Discover</small></span></header><div className="preview-wrap"><ProfileCard profile={self} preview /><button className="edit-card"><Edit3 size={18} /> Edit card</button></div></section>;
}

const registrationSteps = [
  { title: 'The basics', detail: 'Start with the details people need to know.' },
  { title: 'About you', detail: 'Identity details are optional and always editable.' },
  { title: 'Family & pets', detail: 'Be clear about the life you have and the one you want.' },
  { title: 'Lifestyle', detail: 'Small habits can matter in a relationship.' },
  { title: 'Relationship goals', detail: 'Choose every direction that feels honest right now.' },
  { title: 'Your interests', detail: 'Pick up to five things that make you light up.' },
  { title: 'Two prompts', detail: 'Specific answers give matches something real to message.' },
  { title: 'Preferences & media', detail: 'Choose who you see, then finish your profile media.' },
];

const initialRegistration: RegistrationData = { name: 'Alex', birthday: '1998-04-18', city: 'Brooklyn', gender: 'Nonbinary', pronouns: 'they/them', height: '5′9″', ethnicity: 'Multiracial', pets: 'Has a dog', kids: 'No kids', wantsKids: 'Yes', drinking: 'Socially', smoking: 'No', intents: ['Long-term', 'Marriage'], interests: ['Cooking', 'Live music', 'Pets'], promptOne: 'Outside early, somewhere cozy by dinner.', promptTwo: 'Teach me the recipe you never write down.', preferredGenders: ['Woman', 'Man'], minAge: 25, maxAge: 36, maxDistance: 15 };

function RegistrationDialog({ open, onOpenChange, onComplete }: { open: boolean; onOpenChange: (open: boolean) => void; onComplete: (data: RegistrationData) => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<RegistrationData>(initialRegistration);
  useEffect(() => { if (open) setStep(0); }, [open]);
  const item = registrationSteps[step];
  const update = <K extends keyof RegistrationData,>(key: K, value: RegistrationData[K]) => setData((current) => ({ ...current, [key]: value }));
  const toggle = (key: 'intents' | 'interests' | 'preferredGenders', value: string, max = 99) => setData((current) => { const items = current[key] as string[]; const next = items.includes(value) ? items.filter((item) => item !== value) : items.length < max ? [...items, value] : items; return { ...current, [key]: next }; });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent showCloseButton={false} className="flow-dialog registration-dialog"><button className="match-close" onClick={() => onOpenChange(false)} aria-label="Close registration"><X size={19} /></button><div className="flow-kicker">REGISTRATION · {step + 1} OF {registrationSteps.length}</div><div className="flow-progress">{registrationSteps.map((_, index) => <span key={index} className={index <= step ? 'active' : ''} />)}</div><DialogTitle>{item.title}</DialogTitle><DialogDescription>{item.detail}</DialogDescription><div className="registration-body">{step === 0 && <div className="field-grid"><label>First name<input aria-label="First name" value={data.name} onChange={(event) => update('name', event.target.value)} /></label><label>Birthday<input aria-label="Birthday" type="date" value={data.birthday} onChange={(event) => update('birthday', event.target.value)} /></label><label className="wide-field">City<input aria-label="City" value={data.city} onChange={(event) => update('city', event.target.value)} /></label></div>}{step === 1 && <div className="field-grid"><label>Gender<select aria-label="Gender" value={data.gender} onChange={(event) => update('gender', event.target.value as Gender)}><option>Woman</option><option>Man</option><option>Nonbinary</option></select></label><label>Pronouns<input aria-label="Pronouns" value={data.pronouns} onChange={(event) => update('pronouns', event.target.value)} /></label><label>Height<input aria-label="Height" value={data.height} onChange={(event) => update('height', event.target.value)} /></label><label>Ethnicity<select aria-label="Ethnicity" value={data.ethnicity} onChange={(event) => update('ethnicity', event.target.value)}><option>Multiracial</option><option>Asian</option><option>Black</option><option>Latino</option><option>Middle Eastern</option><option>Native</option><option>White</option><option>Prefer not to say</option></select></label></div>}{step === 2 && <div className="field-grid"><label>Pets<select aria-label="Pets" value={data.pets} onChange={(event) => update('pets', event.target.value)}><option>Has a dog</option><option>Has a cat</option><option>Other pets</option><option>No pets</option><option>Loves pets</option></select></label><label>Children<select aria-label="Children" value={data.kids} onChange={(event) => update('kids', event.target.value)}><option>No kids</option><option>Has kids</option></select></label><label className="wide-field">Want children<select aria-label="Want children" value={data.wantsKids} onChange={(event) => update('wantsKids', event.target.value)}><option>Yes</option><option>No</option><option>Maybe</option><option>Not sure</option></select></label></div>}{step === 3 && <div className="field-grid"><label>Drinking<select aria-label="Drinking" value={data.drinking} onChange={(event) => update('drinking', event.target.value)}><option>Never</option><option>Rarely</option><option>Socially</option><option>Often</option></select></label><label>Smoking<select aria-label="Smoking" value={data.smoking} onChange={(event) => update('smoking', event.target.value)}><option>No</option><option>Sometimes</option><option>Yes</option></select></label></div>}{step === 4 && <ChoiceGroup label="Select relationship goals" options={relationshipOptions} selected={data.intents} onToggle={(value) => toggle('intents', value)} />}{step === 5 && <ChoiceGroup label={`${data.interests.length} of 5 interests selected`} options={interestOptions} selected={data.interests} onToggle={(value) => toggle('interests', value, 5)} />}{step === 6 && <div className="prompt-fields"><label>My ideal Sunday…<textarea aria-label="First prompt" value={data.promptOne} onChange={(event) => update('promptOne', event.target.value)} /></label><label>The quickest way to my heart…<textarea aria-label="Second prompt" value={data.promptTwo} onChange={(event) => update('promptTwo', event.target.value)} /></label></div>}{step === 7 && <><ChoiceGroup label="Show me" options={['Woman', 'Man', 'Nonbinary']} selected={data.preferredGenders} onToggle={(value) => toggle('preferredGenders', value)} /><div className="range-fields"><label>Age range <strong>{data.minAge}–{data.maxAge}</strong><input aria-label="Minimum age" type="range" min="18" max="60" value={data.minAge} onChange={(event) => update('minAge', Number(event.target.value))} /><input aria-label="Maximum age" type="range" min="18" max="60" value={data.maxAge} onChange={(event) => update('maxAge', Number(event.target.value))} /></label><label>Maximum distance <strong>{data.maxDistance} miles</strong><input aria-label="Maximum distance" type="range" min="1" max="50" value={data.maxDistance} onChange={(event) => update('maxDistance', Number(event.target.value))} /></label></div><div className="media-rules"><div><Camera size={20} /><span><strong>Main photo</strong><small>One cinematic portrait on Discover</small></span><Check size={17} /></div><div><Camera size={20} /><span><strong>Full profile</strong><small>Up to 6 photos · tap to advance</small></span><Check size={17} /></div><div><Play size={20} /><span><strong>Profile video</strong><small>One video · maximum 15 seconds</small></span><Check size={17} /></div></div></>}</div><div className="flow-actions">{step > 0 && <button className="secondary-button" onClick={() => setStep((value) => value - 1)}>Back</button>}<button className="primary-button" onClick={() => { if (step === registrationSteps.length - 1) onComplete(data); else setStep((value) => value + 1); }}>{step === registrationSteps.length - 1 ? 'Register profile' : 'Continue'} <ChevronRight size={18} /></button></div></DialogContent></Dialog>;
}

function ChoiceGroup({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <div className="choice-group"><p>{label}</p><div>{options.map((option) => <button type="button" key={option} className={selected.includes(option) ? 'selected' : ''} onClick={() => onToggle(option)}>{selected.includes(option) && <Check size={14} />}{option}</button>)}</div></div>;
}

function FilterDialog({ open, onOpenChange, filters, onApply }: { open: boolean; onOpenChange: (open: boolean) => void; filters: Filters; onApply: (filters: Filters) => void }) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => { if (open) setDraft(filters); }, [open, filters]);
  const toggleGender = (gender: Gender) => setDraft((current) => ({ ...current, genders: current.genders.includes(gender) ? current.genders.filter((item) => item !== gender) : [...current.genders, gender] }));
  const toggleIntent = (intent: string) => setDraft((current) => ({ ...current, intents: current.intents.includes(intent) ? current.intents.filter((item) => item !== intent) : [...current.intents, intent] }));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent showCloseButton={false} className="flow-dialog filter-dialog"><button className="match-close" onClick={() => onOpenChange(false)} aria-label="Close filters"><X size={19} /></button><div className="flow-kicker"><SlidersHorizontal size={15} /> DISCOVER PREFERENCES</div><DialogTitle>Who do you want to meet?</DialogTitle><DialogDescription>These controls immediately change the profiles in Discover.</DialogDescription><div className="filter-body"><ChoiceGroup label="Gender preference" options={['Woman', 'Man', 'Nonbinary']} selected={draft.genders} onToggle={(value) => toggleGender(value as Gender)} /><ChoiceGroup label="Relationship goals" options={relationshipOptions} selected={draft.intents} onToggle={toggleIntent} /><div className="range-fields"><label>Age range <strong>{draft.minAge}–{draft.maxAge}</strong><input aria-label="Filter minimum age" type="range" min="18" max="60" value={draft.minAge} onChange={(event) => setDraft({ ...draft, minAge: Number(event.target.value) })} /><input aria-label="Filter maximum age" type="range" min="18" max="60" value={draft.maxAge} onChange={(event) => setDraft({ ...draft, maxAge: Number(event.target.value) })} /></label><label>Distance <strong>Within {draft.maxDistance} miles</strong><input aria-label="Filter maximum distance" type="range" min="1" max="50" value={draft.maxDistance} onChange={(event) => setDraft({ ...draft, maxDistance: Number(event.target.value) })} /></label></div><div className="field-grid"><label>Smoking<select aria-label="Smoking preference" value={draft.smoking} onChange={(event) => setDraft({ ...draft, smoking: event.target.value as Filters['smoking'] })}><option>Any</option><option>No</option></select></label><label>Wants kids<select aria-label="Kids preference" value={draft.wantsKids} onChange={(event) => setDraft({ ...draft, wantsKids: event.target.value as Filters['wantsKids'] })}><option>Any</option><option>Yes</option><option>No</option></select></label></div></div><div className="flow-actions"><button className="secondary-button" onClick={() => setDraft(defaultFilters)}>Reset</button><button className="primary-button apply-filters" onClick={() => onApply(draft)}>Show matching profiles</button></div></DialogContent></Dialog>;
}

function SubscriptionDialog({ open, onOpenChange, onChoose }: { open: boolean; onOpenChange: (open: boolean) => void; onChoose: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent showCloseButton={false} className="flow-dialog subscription-dialog"><button className="match-close" onClick={() => onOpenChange(false)} aria-label="Close subscription details"><X size={19} /></button><div className="flow-kicker"><Crown size={15} /> PULSE+</div><DialogTitle>More signal. Less noise.</DialogTitle><DialogDescription>Free keeps matching and chat open. Pulse+ adds control and visibility.</DialogDescription><div className="plan-grid"><section><span>FREE</span><strong>$0</strong><ul><li><Check size={15} /> Discover, Rooms and mutual-match chat</li><li><Check size={15} /> 1 Spark each day</li><li><Check size={15} /> See two recent incoming likes</li></ul></section><section className="featured"><span>PULSE+</span><strong>$14.99 <small>/ month</small></strong><ul><li><Check size={15} /> See everyone who liked you</li><li><Check size={15} /> 3 Sparks each day</li><li><Check size={15} /> Rewind your last pass</li><li><Check size={15} /> Advanced intent and lifestyle filters</li></ul></section></div><button className="primary-button plan-button" onClick={onChoose}>Choose Pulse+ <ChevronRight size={18} /></button><p className="billing-note">Prototype pricing · billing is not connected. Cancel anytime when subscriptions launch. Restore purchases will be available.</p></DialogContent></Dialog>;
}

function SafetyDialog({ open, onOpenChange, onAction }: { open: boolean; onOpenChange: (open: boolean) => void; onAction: (message: string) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="safety-dialog"><DialogTitle>Safety with Maya</DialogTitle><DialogDescription>These tools are always one tap away.</DialogDescription><button onClick={() => { onOpenChange(false); onAction('Date details shared with your contact'); }}><ShieldCheck size={20} /> Share date details <ChevronRight size={17} /></button><button onClick={() => onAction('Maya reported for review')}><MoreHorizontal size={20} /> Report profile <ChevronRight size={17} /></button><button className="danger" onClick={() => { onOpenChange(false); onAction('Maya has been blocked'); }}><X size={20} /> Block Maya <ChevronRight size={17} /></button></DialogContent></Dialog>;
}
