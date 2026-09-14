'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  AudioLines,
  BadgeCheck,
  Ban,
  Baby,
  Bell,
  Bookmark,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Coffee,
  Edit3,
  Flag,
  Footprints,
  ImagePlus,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircle,
  MessageCircleReply,
  Mic,
  Moon,
  Music2,
  MoreHorizontal,
  Orbit,
  Play,
  Plus,
  Palette,
  CalendarDays,
  CalendarCheck,
  CalendarPlus,
  ExternalLink,
  Radio,
  Rocket,
  Ruler,
  Search,
  Send,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Sun,
  Trash2,
  Utensils,
  UserRound,
  Volume2,
  WandSparkles,
  Wine,
  CigaretteOff,
  X,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { PhotoCropper, type CroppedPhoto } from '@/components/photo-cropper';
import {
  PhotoVerificationDialog,
  type PhotoVerificationStatus,
} from '@/components/photo-verification-dialog';
import {
  defaultVoiceMode,
  type VoiceMode,
  voiceDeployment,
} from '@/lib/voice-config';
import { initializeMobileRuntime } from '@/lib/mobile-runtime';

type Tab = 'Pulse' | 'Galaxy' | 'Chat' | 'Profile';
type ThemeName = 'default' | 'aurora' | 'velvet' | 'solar' | 'liquid' | 'lime';
type VoiceSchedule = 'off' | 'morning' | 'evening' | 'twice';
type VoiceMicStatus =
  | 'unknown'
  | 'requesting'
  | 'ready'
  | 'blocked'
  | 'unavailable';
type VoiceAction =
  | { kind: 'like'; profile: Profile }
  | { kind: 'super'; profile: Profile }
  | { kind: 'boost'; profile: Profile }
  | { kind: 'message'; contact: ChatContact; text: string };
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: {
        results: ArrayLike<{
          0: { transcript: string };
          isFinal?: boolean;
        }>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type Gender = 'Woman' | 'Man' | 'Nonbinary';
type MediaItem = {
  id?: string;
  type: 'photo' | 'video';
  src: string;
  poster?: string;
  moderationStatus?: string;
};
type DailyAvailability = {
  localDate: string;
  startAt: string;
  endAt: string;
  timezone: string;
};
type Profile = {
  id?: string;
  name: string;
  age: number;
  gender: Gender;
  image: string;
  media: MediaItem[];
  place: string;
  distance: string;
  distanceMiles: number;
  intent: string;
  tags: string[];
  prompt: string;
  height: string;
  ethnicity: string;
  pets: string;
  kids: string;
  wantsKids: string;
  drinking: string;
  smoking: string;
  verified?: boolean;
  tonight?: {
    plan: string;
    expiresAt: string;
  };
  availability?: DailyAvailability;
};
type ChatContact = {
  userId?: string;
  conversationId?: string;
  name: string;
  image: string;
  email?: string;
  preview: string;
  time: string;
  active?: boolean;
  unread?: number;
  availability?: DailyAvailability;
};
type Filters = {
  genders: Gender[];
  minAge: number;
  maxAge: number;
  maxDistance: number;
  intents: string[];
  smoking: 'Any' | 'No';
  wantsKids: 'Any' | 'Yes' | 'No';
};
type RegistrationData = {
  name: string;
  birthday: string;
  city: string;
  gender: Gender;
  pronouns: string;
  orientation: string;
  bio: string;
  height: string;
  ethnicity: string;
  languages: string[];
  occupation: string;
  education: string;
  religion: string;
  politics: string;
  zodiac: string;
  pets: string;
  kids: string;
  wantsKids: string;
  drinking: string;
  smoking: string;
  exercise: string;
  diet: string;
  socialStyle: string;
  intents: string[];
  relationshipStyle: string;
  loveLanguage: string;
  interests: string[];
  values: string[];
  promptOne: string;
  promptTwo: string;
  preferredGenders: Gender[];
  minAge: number;
  maxAge: number;
  maxDistance: number;
};
type ChatMessage = { id: number | string; text: string; mine: boolean };
type NoteMode = 'like' | 'super';
type NoteTarget = string;
type Membership = 'free' | 'plus';
type BillingPeriod = 'weekly' | 'monthly' | 'annual';
type EngagementNudge =
  | { kind: 'today' }
  | { kind: 'boost' }
  | { kind: 'like' }
  | { kind: 'super'; profile: Profile };
type EngagementPreferences = {
  today: boolean;
  like: boolean;
  super: boolean;
  boost: boolean;
};
type PushPreferences = {
  newLikes: boolean;
  newMatches: boolean;
  messages: boolean;
  planUpdates: boolean;
  activityBriefing: boolean;
  quietHours: { start: string; end: string; timeZone?: string } | null;
};
type TodayReminderTime = 'morning' | 'afternoon' | 'evening';
type ActiveBoosts = Record<string, number>;
type AuthAccount = { email: string; passwordHash: string; createdAt: string };
type TestIdentity = {
  email: string;
  profile: Profile;
  registration: RegistrationData;
};
type ProfileInteraction = {
  id: string;
  fromEmail: string;
  toEmail: string;
  kind: NoteMode;
  target: string;
  note: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
};
type StoredMessage = {
  id: number;
  fromEmail: string;
  toEmail: string;
  text: string;
  createdAt: string;
  readAt?: string;
};
type DailyStoryVisibility = 'discover' | 'liked' | 'matches';
type DailyStory = {
  id: string;
  authorEmail: string;
  authorName: string;
  mediaUrl?: string;
  caption: string;
  prompt: string;
  visibility: DailyStoryVisibility;
  repliesEnabled: boolean;
  viewedBy: string[];
  createdAt: string;
  expiresAt: string;
};
type DailyStoryDraft = Pick<
  DailyStory,
  'mediaUrl' | 'caption' | 'prompt' | 'visibility' | 'repliesEnabled'
>;
type TodayAvailabilityChoice = 'none' | 'tonight' | 'tomorrow' | 'custom';
type DatingPlan = {
  id: number;
  planName: string;
  activity: string;
  day: string;
  time: string;
  durationMinutes: number;
  neighborhood: string;
  venue: Venue;
  place?: string;
  invitees: string[];
  inviteeEmails?: string[];
  creatorEmail?: string;
  status: 'sent' | 'accepted' | 'declined' | 'cancelled' | 'completed';
  venueOptions?: Venue[];
  venueVotes?: Record<string, string>;
  alternateDay?: string;
  alternateTime?: string;
  alternateSuggestedBy?: string;
  safetyCheckInEnabled?: boolean;
  safetyCheckInMinutes?: number;
  safetyStatus?: 'scheduled' | 'safe' | 'ended';
  safetyAcknowledgedAt?: string;
  expiresAt?: string;
};
type Venue = {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  distance: string;
  price: '$' | '$$' | '$$$';
  category: string;
  latitude: number;
  longitude: number;
  openNow?: boolean;
  provider?: 'demo' | 'mapbox';
};
type IncomingRow = {
  id?: string;
  profile: Profile;
  liked: string;
  note: string;
  superPulse: boolean;
};

const defaultEngagementPreferences: EngagementPreferences = {
  today: true,
  like: true,
  super: true,
  boost: true,
};
const defaultPushPreferences: PushPreferences = {
  newLikes: true,
  newMatches: true,
  messages: true,
  planUpdates: true,
  activityBriefing: false,
  quietHours: { start: '22:00', end: '08:00' },
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: object;
          annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
          execute: (input: unknown) => unknown;
        },
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

function ProfileSpikeBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`profile-spike-badge ${compact ? 'compact' : ''}`}
      aria-hidden="true"
    >
      <BrandHeartMark size={compact ? 14 : 17} />
    </span>
  );
}

function BrandHeartMark({
  size = 24,
  className = '',
}: {
  size?: number;
  className?: string;
  fill?: string;
}) {
  const maskId = `spikedate-heart-${useId().replace(/:/g, '')}`;
  return (
    <svg
      className={`brand-heart-mark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask id={maskId}>
          <rect width="1024" height="1024" fill="white" />
          <path
            d="M555 197C540 300 456 330 500 417c35 70 151 69 186 146 38 84-55 170-169 270"
            fill="none"
            stroke="black"
            strokeWidth="112"
            strokeLinecap="round"
          />
        </mask>
      </defs>
      <path
        d="M512 873C452 813 183 628 183 377c0-150 113-236 241-197 40 12 68 35 88 69 20-34 48-57 88-69 128-39 241 47 241 197 0 251-269 436-329 496Z"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
      <path d="m557 70 72 216-143-38Z" fill="currentColor" />
    </svg>
  );
}

function SuperSpikeMark({
  size = 28,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`super-spike-mark ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <WandSparkles size={size} strokeWidth={2.15} />
    </span>
  );
}

function ProfileLiftMark({
  size = 24,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`profile-lift-mark ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Rocket size={size} strokeWidth={2.15} />
    </span>
  );
}

function nextMorningAtFive() {
  const now = new Date();
  const expires = new Date(now);
  if (now.getHours() >= 5) expires.setDate(expires.getDate() + 1);
  expires.setHours(5, 0, 0, 0);
  return expires.toISOString();
}

function dateInputValue(offsetDays = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatAvailabilityTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function availabilityTimeInput(value: string) {
  const time = new Date(value);
  return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
}

function availabilitySummary(availability?: DailyAvailability) {
  if (!availability || new Date(availability.endAt).getTime() <= Date.now())
    return 'Not shared';
  const day =
    availability.localDate === dateInputValue()
      ? 'Today'
      : availability.localDate === dateInputValue(1)
        ? 'Tomorrow'
        : new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }).format(new Date(`${availability.localDate}T12:00:00`));
  return `${day} · ${formatAvailabilityTime(availability.startAt)}–${formatAvailabilityTime(availability.endAt)}`;
}

const seedProfiles: Profile[] = [
  {
    name: 'Maya',
    age: 27,
    gender: 'Woman',
    image: '/maya.png',
    media: [
      { type: 'photo', src: '/maya.png' },
      { type: 'photo', src: '/maya-vinyl.png' },
      { type: 'photo', src: '/maya-walk.png' },
    ],
    place: 'Brooklyn',
    distance: '2 miles away',
    distanceMiles: 2,
    intent: 'Long-term',
    tags: ['Live music', 'Night walks'],
    prompt: 'Be curious. Pick the restaurant. Let me make the playlist.',
    height: '5′6″',
    ethnicity: 'South Asian',
    pets: 'Likes dogs',
    kids: 'No kids',
    wantsKids: 'Yes',
    drinking: 'Socially',
    smoking: 'No',
    tonight: {
      plan: 'Coffee or drinks',
      expiresAt: nextMorningAtFive(),
    },
  },
  {
    name: 'Lena',
    age: 29,
    gender: 'Woman',
    image: '/lena.png',
    media: [{ type: 'photo', src: '/lena.png' }],
    place: 'Lower East Side',
    distance: '3 miles away',
    distanceMiles: 3,
    intent: 'Marriage',
    tags: ['Vinyl', 'Tiny venues'],
    prompt: 'Show me the song you never skip.',
    height: '5′8″',
    ethnicity: 'White',
    pets: 'Has a cat',
    kids: 'No kids',
    wantsKids: 'Yes',
    drinking: 'Socially',
    smoking: 'No',
    tonight: {
      plan: 'Vinyl bar after 7',
      expiresAt: nextMorningAtFive(),
    },
  },
  {
    name: 'Imani',
    age: 28,
    gender: 'Woman',
    image: '/imani.png',
    media: [{ type: 'photo', src: '/imani.png' }],
    place: 'Fort Greene',
    distance: '4 miles away',
    distanceMiles: 4,
    intent: 'Short-term',
    tags: ['Trail days', 'Good coffee'],
    prompt: 'A sunrise hike is worth the alarm.',
    height: '5′7″',
    ethnicity: 'Black',
    pets: 'Dog person',
    kids: 'Has kids',
    wantsKids: 'Maybe',
    drinking: 'Rarely',
    smoking: 'No',
  },
  {
    name: 'Ava',
    age: 30,
    gender: 'Woman',
    image: '/ava.png',
    media: [{ type: 'photo', src: '/ava.png' }],
    place: 'Williamsburg',
    distance: '4 miles away',
    distanceMiles: 4,
    intent: 'Serious-ish',
    tags: ['Ceramics', 'Bookstores'],
    prompt: 'I’ll make the mugs if you choose the Sunday read.',
    height: '5′5″',
    ethnicity: 'East Asian',
    pets: 'Has a cat',
    kids: 'No kids',
    wantsKids: 'Maybe',
    drinking: 'Rarely',
    smoking: 'No',
  },
  {
    name: 'Noah',
    age: 31,
    gender: 'Man',
    image: '/noah.png',
    media: [{ type: 'photo', src: '/noah.png' }],
    place: 'East Village',
    distance: '5 miles away',
    distanceMiles: 5,
    intent: 'Long-term',
    tags: ['Coffee walks', 'Design'],
    prompt: 'A bookstore, a long coffee, and nowhere else to be.',
    height: '5′11″',
    ethnicity: 'East Asian',
    pets: 'Likes dogs',
    kids: 'No kids',
    wantsKids: 'Yes',
    drinking: 'Socially',
    smoking: 'No',
  },
  {
    name: 'Mateo',
    age: 30,
    gender: 'Man',
    image: '/mateo.png',
    media: [{ type: 'photo', src: '/mateo.png' }],
    place: 'Astoria',
    distance: '7 miles away',
    distanceMiles: 7,
    intent: 'Marriage',
    tags: ['Cooking', 'Going out'],
    prompt: 'Fresh pasta is my love language. You pick the wine.',
    height: '6′0″',
    ethnicity: 'Latino',
    pets: 'No pets',
    kids: 'No kids',
    wantsKids: 'Yes',
    drinking: 'Socially',
    smoking: 'No',
  },
  {
    name: 'Jordan',
    age: 29,
    gender: 'Man',
    image: '/jordan.png',
    media: [{ type: 'photo', src: '/jordan.png' }],
    place: 'Harlem',
    distance: '9 miles away',
    distanceMiles: 9,
    intent: 'Serious-ish',
    tags: ['Rescue dogs', 'Live jazz'],
    prompt: 'Let’s find the city’s best park bench and people-watch.',
    height: '6′1″',
    ethnicity: 'Black',
    pets: 'Has a dog',
    kids: 'Has kids',
    wantsKids: 'No',
    drinking: 'Rarely',
    smoking: 'No',
  },
  {
    name: 'Elias',
    age: 32,
    gender: 'Man',
    image: '/elias.png',
    media: [{ type: 'photo', src: '/elias.png' }],
    place: 'Crown Heights',
    distance: '6 miles away',
    distanceMiles: 6,
    intent: 'Long-term',
    tags: ['Film photos', 'Cooking'],
    prompt: 'A slow dinner and one very good question.',
    height: '6′0″',
    ethnicity: 'Middle Eastern',
    pets: 'Likes dogs',
    kids: 'No kids',
    wantsKids: 'Yes',
    drinking: 'Socially',
    smoking: 'No',
  },
];

const generatedProfileNames: { name: string; gender: Gender }[] = [
  { name: 'Sofia', gender: 'Woman' },
  { name: 'Amara', gender: 'Woman' },
  { name: 'Chloe', gender: 'Woman' },
  { name: 'Nina', gender: 'Woman' },
  { name: 'Zoe', gender: 'Woman' },
  { name: 'Layla', gender: 'Woman' },
  { name: 'Camila', gender: 'Woman' },
  { name: 'Mei', gender: 'Woman' },
  { name: 'Fatima', gender: 'Woman' },
  { name: 'Grace', gender: 'Woman' },
  { name: 'Elena', gender: 'Woman' },
  { name: 'Tara', gender: 'Woman' },
  { name: 'Jade', gender: 'Woman' },
  { name: 'Rhea', gender: 'Woman' },
  { name: 'Mila', gender: 'Woman' },
  { name: 'Daniel', gender: 'Man' },
  { name: 'Arjun', gender: 'Man' },
  { name: 'Marcus', gender: 'Man' },
  { name: 'Theo', gender: 'Man' },
  { name: 'Liam', gender: 'Man' },
  { name: 'Omar', gender: 'Man' },
  { name: 'Kenji', gender: 'Man' },
  { name: 'Andre', gender: 'Man' },
  { name: 'Samuel', gender: 'Man' },
  { name: 'Rafael', gender: 'Man' },
  { name: 'Ethan', gender: 'Man' },
  { name: 'Dev', gender: 'Man' },
  { name: 'Isaac', gender: 'Man' },
  { name: 'Gabriel', gender: 'Man' },
  { name: 'Mason', gender: 'Man' },
  { name: 'Alexis', gender: 'Nonbinary' },
  { name: 'River', gender: 'Nonbinary' },
  { name: 'Quinn', gender: 'Nonbinary' },
  { name: 'Sage', gender: 'Nonbinary' },
  { name: 'Rowan', gender: 'Nonbinary' },
  { name: 'Avery', gender: 'Nonbinary' },
  { name: 'Jamie', gender: 'Nonbinary' },
  { name: 'Morgan', gender: 'Nonbinary' },
  { name: 'Taylor', gender: 'Nonbinary' },
  { name: 'Casey', gender: 'Nonbinary' },
  { name: 'Skyler', gender: 'Nonbinary' },
  { name: 'Reese', gender: 'Nonbinary' },
  { name: 'Anika', gender: 'Woman' },
  { name: 'Bianca', gender: 'Woman' },
  { name: 'Leila', gender: 'Woman' },
  { name: 'Nora', gender: 'Woman' },
  { name: 'Adrian', gender: 'Man' },
  { name: 'Caleb', gender: 'Man' },
  { name: 'Julian', gender: 'Man' },
  { name: 'Malik', gender: 'Man' },
  { name: 'Emery', gender: 'Nonbinary' },
  { name: 'Phoenix', gender: 'Nonbinary' },
];

const generatedPlaces = [
  'Greenpoint',
  'Park Slope',
  'SoHo',
  'Chelsea',
  'Queens',
  'Hoboken',
  'Bushwick',
  'Upper West Side',
];
const generatedIntents = ['Long-term', 'Marriage', 'Serious-ish', 'Short-term'];
const generatedTags = [
  ['Coffee', 'Bookstores'],
  ['Cooking', 'Travel'],
  ['Live music', 'Films'],
  ['Trail days', 'Pets'],
  ['Going out', 'Art'],
  ['Fitness', 'Food lovers'],
];
const generatedEthnicities = [
  'Asian',
  'Black',
  'Latino',
  'Middle Eastern',
  'White',
  'Multiracial',
];

const generatedProfiles: Profile[] = generatedProfileNames.map(
  ({ name, gender }, index) => {
    const visual = seedProfiles[index % seedProfiles.length];
    const age = 24 + (index % 15);
    const place = generatedPlaces[index % generatedPlaces.length];
    const tags = generatedTags[index % generatedTags.length];
    const distanceMiles = 1 + (index % 15);
    return {
      name,
      age,
      gender,
      image: visual.image,
      media: visual.media,
      place,
      distance: `${distanceMiles} ${distanceMiles === 1 ? 'mile' : 'miles'} away`,
      distanceMiles,
      intent: generatedIntents[index % generatedIntents.length],
      tags,
      prompt: `My ideal first date includes ${tags[0].toLowerCase()}, an easy conversation, and time to discover something new.`,
      height: [`5′4″`, `5′7″`, `5′10″`, `6′0″`][index % 4],
      ethnicity: generatedEthnicities[index % generatedEthnicities.length],
      pets: ['Has a dog', 'Has a cat', 'Likes pets', 'No pets'][index % 4],
      kids: index % 5 === 0 ? 'Has kids' : 'No kids',
      wantsKids: ['Yes', 'Maybe', 'No'][index % 3],
      drinking: ['Socially', 'Rarely', 'No'][index % 3],
      smoking: index % 7 === 0 ? 'Occasionally' : 'No',
    };
  },
);

const profiles: Profile[] = [...seedProfiles, ...generatedProfiles];

const priyaProfile: Profile = {
  ...profiles[2],
  name: 'Priya',
  age: 28,
  place: 'Fort Greene',
  tags: ['Sunday markets', 'Live music'],
  prompt: 'Let’s trade favorite neighborhood spots.',
};
const leoProfile: Profile = {
  ...profiles[4],
  name: 'Leo',
  age: 31,
  place: 'East Village',
  tags: ['Film photos', 'Coffee walks'],
  prompt: 'Tell me the last place that surprised you.',
};
const allProfiles = [...profiles, priyaProfile, leoProfile];

const chatContacts: ChatContact[] = [
  {
    name: 'Maya',
    image: '/maya.png',
    preview: 'That rooftop view is undefeated.',
    time: 'Now',
    active: true,
  },
  {
    name: 'Lena',
    image: '/lena.png',
    preview: 'Sent a voice note',
    time: '12m',
    unread: 2,
  },
  {
    name: 'Imani',
    image: '/imani.png',
    preview: 'Saturday could work!',
    time: '2h',
  },
];

const demoChatMessages: Record<string, ChatMessage[]> = {
  Maya: [{ id: 1, text: 'That rooftop view is undefeated.', mine: false }],
  Lena: [
    {
      id: 2,
      text: 'I sent you a voice note — your music prompt got me.',
      mine: false,
    },
  ],
  Imani: [{ id: 3, text: 'Saturday could work!', mine: false }],
};

const defaultFilters: Filters = {
  genders: ['Woman', 'Man'],
  minAge: 24,
  maxAge: 36,
  maxDistance: 15,
  intents: [],
  smoking: 'Any',
  wantsKids: 'Any',
};
const relationshipOptions = [
  'Long-term',
  'Marriage',
  'Serious-ish',
  'Short-term',
];
const interestOptions = [
  'Cooking',
  'Going out',
  'Live music',
  'Pets',
  'Travel',
  'Films',
  'Trail days',
  'Coffee',
];
const valueOptions = [
  'Kindness',
  'Curiosity',
  'Communication',
  'Family',
  'Growth',
  'Humor',
  'Adventure',
  'Stability',
];
const themeLabels: Record<ThemeName, string> = {
  default: 'Midnight',
  aurora: 'Aurora',
  velvet: 'Velvet Galaxy',
  solar: 'Solar Minimal',
  liquid: 'Liquid Mono',
  lime: 'Liquid Lime',
};

const roomData = [
  {
    name: 'Tonight',
    caption: 'Free in the next 12 hours',
    count: '84 here now',
    image: '/maya.png',
    className: 'wide',
  },
  {
    name: 'Music',
    caption: 'Match on taste',
    count: '126 listening',
    image: '/lena.png',
  },
  {
    name: 'Outdoors',
    caption: 'Find your trail person',
    count: '67 exploring',
    image: '/imani.png',
  },
  {
    name: 'Food lovers',
    caption: 'Try somewhere new together',
    count: '92 making plans',
    image: '/mateo.png',
  },
  {
    name: 'New in town',
    caption: 'Make the city feel smaller',
    count: '43 new faces',
    image: '/lena.png',
    className: 'wide',
  },
  {
    name: 'Coffee dates',
    caption: 'Keep the first hello easy',
    count: '58 nearby',
    image: '/noah.png',
  },
  {
    name: 'Pet people',
    caption: 'Walks are better together',
    count: '74 animal lovers',
    image: '/ava.png',
  },
  {
    name: 'Arts & culture',
    caption: 'Galleries, films and ideas',
    count: '39 exploring',
    image: '/jordan.png',
    className: 'wide',
  },
];

const galaxyPlans = [
  {
    name: 'Coffee',
    detail: '18 nearby',
    room: 'Coffee dates',
    icon: Coffee,
  },
  {
    name: 'Dinner',
    detail: '12 nearby',
    room: 'Food lovers',
    icon: Utensils,
  },
  {
    name: 'Music',
    detail: '9 nearby',
    room: 'Music',
    icon: Music2,
  },
  {
    name: 'Walk',
    detail: '15 nearby',
    room: 'Outdoors',
    icon: Footprints,
  },
];

const demoVenues: Venue[] = [
  {
    id: 'demo-northlight-coffee',
    name: 'Northlight Coffee',
    address: '74 Berry Street, Brooklyn',
    neighborhood: 'Williamsburg',
    distance: '0.4 mi',
    price: '$$',
    category: 'Coffee shop',
    latitude: 40.7195,
    longitude: -73.9582,
    openNow: true,
    provider: 'demo',
  },
  {
    id: 'demo-ember-oak',
    name: 'Ember & Oak Café',
    address: '118 Bedford Avenue, Brooklyn',
    neighborhood: 'Williamsburg',
    distance: '0.7 mi',
    price: '$$',
    category: 'Café',
    latitude: 40.7181,
    longitude: -73.9571,
    openNow: true,
    provider: 'demo',
  },
  {
    id: 'demo-juniper-table',
    name: 'Juniper Table',
    address: '212 Lafayette Street, New York',
    neighborhood: 'SoHo',
    distance: '1.2 mi',
    price: '$$$',
    category: 'Restaurant',
    latitude: 40.7225,
    longitude: -73.9973,
    openNow: true,
    provider: 'demo',
  },
  {
    id: 'demo-blue-note-room',
    name: 'The Blue Note Room',
    address: '41 East 7th Street, New York',
    neighborhood: 'East Village',
    distance: '1.5 mi',
    price: '$$',
    category: 'Live music',
    latitude: 40.7279,
    longitude: -73.9888,
    openNow: false,
    provider: 'demo',
  },
  {
    id: 'demo-riverside-promenade',
    name: 'Riverside Promenade',
    address: 'Brooklyn Bridge Park, Brooklyn',
    neighborhood: 'DUMBO',
    distance: '2.1 mi',
    price: '$',
    category: 'Public park',
    latitude: 40.7024,
    longitude: -73.9969,
    openNow: true,
    provider: 'demo',
  },
  {
    id: 'demo-lantern-kitchen',
    name: 'Lantern Kitchen',
    address: '86 North 6th Street, Brooklyn',
    neighborhood: 'Williamsburg',
    distance: '0.6 mi',
    price: '$$',
    category: 'Restaurant',
    latitude: 40.7187,
    longitude: -73.9601,
    openNow: true,
    provider: 'demo',
  },
  {
    id: 'demo-common-table',
    name: 'Common Table',
    address: '159 Grand Street, Brooklyn',
    neighborhood: 'Williamsburg',
    distance: '0.9 mi',
    price: '$$',
    category: 'Restaurant',
    latitude: 40.7142,
    longitude: -73.9611,
    openNow: false,
    provider: 'demo',
  },
  {
    id: 'demo-small-hours',
    name: 'Small Hours',
    address: '95 Avenue A, New York',
    neighborhood: 'East Village',
    distance: '1.4 mi',
    price: '$$',
    category: 'Live music',
    latitude: 40.7255,
    longitude: -73.9837,
    openNow: false,
    provider: 'demo',
  },
  {
    id: 'demo-orbit-stage',
    name: 'Orbit Stage',
    address: '44 Wythe Avenue, Brooklyn',
    neighborhood: 'Williamsburg',
    distance: '0.8 mi',
    price: '$$',
    category: 'Live music',
    latitude: 40.7211,
    longitude: -73.9573,
    openNow: true,
    provider: 'demo',
  },
  {
    id: 'demo-mccarren-loop',
    name: 'McCarren Park Loop',
    address: '776 Lorimer Street, Brooklyn',
    neighborhood: 'Greenpoint',
    distance: '1.0 mi',
    price: '$',
    category: 'Public park',
    latitude: 40.7208,
    longitude: -73.9514,
    openNow: true,
    provider: 'demo',
  },
  {
    id: 'demo-domino-waterfront',
    name: 'Domino Waterfront Walk',
    address: '15 River Street, Brooklyn',
    neighborhood: 'Williamsburg',
    distance: '1.1 mi',
    price: '$',
    category: 'Public park',
    latitude: 40.7153,
    longitude: -73.9673,
    openNow: true,
    provider: 'demo',
  },
];

const tabIcons = {
  Pulse: BrandHeartMark,
  Galaxy: Orbit,
  Chat: MessageCircle,
  Profile: UserRound,
};
const demoAccount: AuthAccount = {
  email: 'demo@spikedate.app',
  passwordHash:
    'f71a046283df27157168ec2da077779aea0dca62a7e4eb18ca97161918c3882f',
  createdAt: '2026-09-07T00:00:00.000Z',
};

const testPassword = 'SpikeDate2026!';
const testEmails: Record<string, string> = Object.fromEntries(
  profiles.map((profile, index) => [
    profile.name,
    `test${String(index + 1).padStart(3, '0')}@spikedate.test`,
  ]),
);
const birthdays: Record<string, string> = Object.fromEntries(
  profiles.map((profile, index) => [
    profile.name,
    `${2026 - profile.age}-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
  ]),
);
const normalizedEthnicity: Record<string, string> = {
  'South Asian': 'Asian',
  'East Asian': 'Asian',
};

const testIdentities: TestIdentity[] = profiles.map((profile) => ({
  email: testEmails[profile.name],
  profile,
  registration: {
    name: profile.name,
    birthday: birthdays[profile.name],
    city: profile.place,
    gender: profile.gender,
    pronouns:
      profile.gender === 'Woman'
        ? 'she/her'
        : profile.gender === 'Man'
          ? 'he/him'
          : 'they/them',
    orientation: 'Straight',
    bio: `${profile.prompt} I’m happiest around ${profile.tags.join(' and ').toLowerCase()}.`,
    height: profile.height,
    ethnicity: normalizedEthnicity[profile.ethnicity] ?? profile.ethnicity,
    languages: ['English'],
    occupation: profile.tags.includes('Design')
      ? 'Product designer'
      : 'Creative professional',
    education: 'Bachelor’s degree',
    religion: 'Open-minded',
    politics: 'Moderate',
    zodiac: 'Ask me',
    pets: profile.pets,
    kids: profile.kids,
    wantsKids: profile.wantsKids,
    drinking: profile.drinking,
    smoking: profile.smoking,
    exercise: profile.tags.includes('Trail days') ? 'Often' : 'Sometimes',
    diet: 'No preference',
    socialStyle: 'A mix of both',
    intents: [profile.intent],
    relationshipStyle: 'Monogamy',
    loveLanguage: 'Quality time',
    interests: [
      ...profile.tags,
      profile.pets.includes('cat') ? 'Pets' : 'Travel',
    ]
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, 5),
    values: ['Kindness', 'Curiosity', 'Communication'],
    promptOne: profile.prompt,
    promptTwo: `Ask me about ${profile.tags[0].toLowerCase()} and our ideal first date.`,
    preferredGenders:
      profile.gender === 'Woman'
        ? ['Man']
        : profile.gender === 'Man'
          ? ['Woman']
          : ['Woman', 'Man', 'Nonbinary'],
    minAge: 24,
    maxAge: 36,
    maxDistance: 15,
  },
}));
const testAccounts: AuthAccount[] = testIdentities.map((identity) => ({
  email: identity.email,
  passwordHash: demoAccount.passwordHash,
  createdAt: '2026-09-08T00:00:00.000Z',
}));

const serverDataEnabled =
  process.env.NEXT_PUBLIC_SPIKEDATE_SERVER_DATA_ENABLED === 'true';
const datePlansEnabled =
  process.env.NEXT_PUBLIC_SPIKEDATE_DATE_PLANS_ENABLED !== 'false';
const phoneVerificationEnabled =
  process.env.NEXT_PUBLIC_SPIKEDATE_PHONE_VERIFICATION_ENABLED !== 'false';

function normalizeVerificationStatus(value: unknown): PhotoVerificationStatus {
  if (value === 'verified') return 'photo_verified';
  if (
    value === 'pending' ||
    value === 'needs_review' ||
    value === 'needs_retry' ||
    value === 'photo_verified' ||
    value === 'identity_verified'
  )
    return value;
  return 'unverified';
}

type ApiErrorBody = { error?: string };

async function serverJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('content-type'))
    headers.set('content-type', 'application/json');
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  });
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok)
    throw new Error(body.error || 'SpikeDate could not save that change.');
  return body;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The photo could not be read.'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('The photo could not be read.'));
    reader.readAsDataURL(blob);
  });
}

function testUserIdForEmail(email?: string) {
  const match = email?.match(/^test(\d{3})@spikedate\.test$/);
  return match ? `test-${match[1]}` : null;
}

function heightToCm(value: string) {
  const match = value.match(/^(\d)'\s*(\d{1,2})/);
  if (!match) return null;
  return Math.round((Number(match[1]) * 12 + Number(match[2])) * 2.54);
}

const todayPrompts = [
  'What are you doing today?',
  'A small win from my day…',
  'Tonight I’m hoping to…',
  'My current food craving…',
  'Would you join me for…',
];

function createSeedDailyStories(): DailyStory[] {
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const examples: Record<string, [string, string]> = {
    Maya: ['My current food craving…', 'Attempting homemade pasta tonight 🍝'],
    Lena: ['Tonight I’m hoping to…', 'Find a cozy vinyl bar after 7 🎶'],
    Jordan: ['A small win from my day…', 'Finally finished my first 10K.'],
    Priya: ['Would you join me for…', 'A sunset walk and an iced coffee?'],
    Leo: ['Tonight I’m hoping to…', 'Catch a tiny jazz set downtown.'],
  };
  return Object.entries(examples).flatMap(([name, [prompt, caption]]) => {
    const identity = testIdentities.find((item) => item.profile.name === name);
    if (!identity) return [];
    return [
      {
        id: `seed-today-${name.toLowerCase()}`,
        authorEmail: identity.email,
        authorName: name,
        mediaUrl: identity.profile.image,
        caption,
        prompt,
        visibility: 'discover' as const,
        repliesEnabled: true,
        viewedBy: [],
        createdAt,
        expiresAt,
      },
    ];
  });
}

function normalizeDailyStories(stories: DailyStory[]) {
  const now = Date.now();
  const newestByAuthor = new Map<string, DailyStory>();
  stories
    .filter((story) => new Date(story.expiresAt).getTime() > now)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .forEach((story) => {
      if (!newestByAuthor.has(story.authorEmail))
        newestByAuthor.set(story.authorEmail, story);
    });
  return [...newestByAuthor.values()];
}

function identityForEmail(email: string | null) {
  return testIdentities.find((identity) => identity.email === email);
}

function identityForProfile(profile: Profile) {
  return testIdentities.find(
    (identity) => identity.profile.name === profile.name,
  );
}

async function hashPassword(password: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function readAccounts(): AuthAccount[] {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem('pulse-accounts') || '[]',
    ) as AuthAccount[];
    return [demoAccount, ...testAccounts, ...saved].filter(
      (account, index, accounts) =>
        accounts.findIndex((item) => item.email === account.email) === index,
    );
  } catch {
    return [demoAccount, ...testAccounts];
  }
}

function readInteractions(): ProfileInteraction[] {
  try {
    return JSON.parse(
      window.localStorage.getItem('pulse-interactions') || '[]',
    ) as ProfileInteraction[];
  } catch {
    return [];
  }
}

function readStoredMessages(): StoredMessage[] {
  try {
    return JSON.parse(
      window.localStorage.getItem('pulse-messages') || '[]',
    ) as StoredMessage[];
  } catch {
    return [];
  }
}

function readDailyStories(): DailyStory[] {
  try {
    const saved = window.localStorage.getItem('pulse-daily-stories');
    let stories = saved
      ? (JSON.parse(saved) as DailyStory[])
      : createSeedDailyStories();
    const seedVersion = 'profile-card-v3';
    if (
      window.localStorage.getItem('pulse-daily-seed-version') !== seedVersion
    ) {
      const activeAuthors = new Set(
        normalizeDailyStories(stories).map((story) => story.authorEmail),
      );
      stories = [
        ...stories,
        ...createSeedDailyStories().filter(
          (story) => !activeAuthors.has(story.authorEmail),
        ),
      ];
      window.localStorage.setItem('pulse-daily-seed-version', seedVersion);
    }
    const active = normalizeDailyStories(stories);
    window.localStorage.setItem('pulse-daily-stories', JSON.stringify(active));
    return active;
  } catch {
    return createSeedDailyStories();
  }
}

function defaultMembership(email: string): Membership {
  return identityForEmail(email) ? 'plus' : 'free';
}

function readMembership(email: string): Membership {
  const saved = window.localStorage.getItem(`pulse-membership:${email}`);
  return saved === 'free' || saved === 'plus'
    ? saved
    : defaultMembership(email);
}

function readSuperPulses(email: string, membership: Membership) {
  const allowance = membership === 'plus' ? 3 : 1;
  const saved = Number(
    window.localStorage.getItem(`pulse-super-pulses-v3:${email}`) ?? allowance,
  );
  return Number.isInteger(saved) && saved >= 0 && saved <= allowance
    ? saved
    : allowance;
}

function readDailyLikes(email: string) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const saved = JSON.parse(
      window.localStorage.getItem(`pulse-daily-likes:${email}`) || 'null',
    ) as { date: string; remaining: number } | null;
    return saved?.date === today && Number.isInteger(saved.remaining)
      ? Math.max(0, Math.min(10, saved.remaining))
      : 10;
  } catch {
    return 10;
  }
}

function currentWeekKey() {
  const date = new Date();
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function readBoostsRemaining(email: string, membership: Membership) {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(`pulse-boosts:${email}`) || 'null',
    ) as { week: string; included?: number; remaining?: number } | null;
    const includedAllowance = membership === 'plus' ? 1 : 0;
    const included =
      saved?.week === currentWeekKey()
        ? Math.max(0, Math.min(1, saved.included ?? saved.remaining ?? 0))
        : includedAllowance;
    return included + readPurchasedBoosts(email);
  } catch {
    return membership === 'plus' ? 1 : 0;
  }
}

function readPurchasedBoosts(email: string) {
  const saved = Number(
    window.localStorage.getItem(`pulse-purchased-boosts:${email}`) ?? 0,
  );
  return Number.isInteger(saved) ? Math.max(0, Math.min(99, saved)) : 0;
}

function readActiveBoosts(): ActiveBoosts {
  try {
    return JSON.parse(
      window.localStorage.getItem('pulse-active-boosts') || '{}',
    ) as ActiveBoosts;
  } catch {
    return {};
  }
}

export default function HomePage() {
  useEffect(() => {
    initializeMobileRuntime().catch((error) =>
      console.warn('Mobile runtime initialization failed', error),
    );
  }, []);
  const [authReady, setAuthReady] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Pulse');
  const [profileIndex, setProfileIndex] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [incomingOpen, setIncomingOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteMode, setNoteMode] = useState<NoteMode>('like');
  const [noteTarget, setNoteTarget] = useState<NoteTarget>('Lifestyle');
  const [noteMessage, setNoteMessage] = useState('');
  const [actionProfile, setActionProfile] = useState<Profile>(profiles[0]);
  const [superPulsesRemaining, setSuperPulsesRemaining] = useState(3);
  const [room, setRoom] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | null>(null);
  const superPulseOwner = useRef<string | null>(null);
  const allowanceOwner = useRef<string | null>(null);
  const boostOwner = useRef<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<ChatContact>(chatContacts[0]);
  const [contacts, setContacts] = useState<ChatContact[]>(chatContacts);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyProfile, setSafetyProfile] = useState<Profile>(profiles[0]);
  const [safetyMode, setSafetyMode] = useState<'menu' | 'report' | 'block'>(
    'menu',
  );
  const [blockedProfiles, setBlockedProfiles] = useState<string[]>([]);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [todayComposerOpen, setTodayComposerOpen] = useState(false);
  const [todayComposerStory, setTodayComposerStory] =
    useState<DailyStory | null>(null);
  const [dailyStories, setDailyStories] = useState<DailyStory[]>([]);
  const [todayFeedOpen, setTodayFeedOpen] = useState(false);
  const [viewedDailyStory, setViewedDailyStory] = useState<DailyStory | null>(
    null,
  );
  const [engagementNudge, setEngagementNudge] =
    useState<EngagementNudge | null>(null);
  const [engagementPreferences, setEngagementPreferences] =
    useState<EngagementPreferences>(defaultEngagementPreferences);
  const [pushPreferences, setPushPreferences] = useState<PushPreferences>(
    defaultPushPreferences,
  );
  const [todayReminderTime, setTodayReminderTime] =
    useState<TodayReminderTime>('morning');
  const engagementPrompted = useRef(false);
  const profileOpenedAt = useRef(0);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(defaultVoiceMode);
  const [voiceUserEnabled, setVoiceUserEnabled] = useState(true);
  const [voiceLiveUserEnabled, setVoiceLiveUserEnabled] = useState(true);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [cloudVoiceRecording, setCloudVoiceRecording] = useState(false);
  const [voiceMicStatus, setVoiceMicStatus] =
    useState<VoiceMicStatus>('unknown');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceResponse, setVoiceResponse] = useState(
    'Ask me to show today’s profiles, read details, open photos, or manage connections.',
  );
  const [voiceBrowseMode, setVoiceBrowseMode] = useState(false);
  const [pendingVoiceAction, setPendingVoiceAction] =
    useState<VoiceAction | null>(null);
  const [voicePromptVisible, setVoicePromptVisible] = useState(false);
  const [voiceSchedule, setVoiceSchedule] = useState<VoiceSchedule>('morning');
  const voiceRun = useRef(0);
  const voiceRecognition = useRef<BrowserSpeechRecognition | null>(null);
  const voiceLiveActive = useRef(false);
  const voiceLivePaused = useRef(false);
  const cloudVoiceRecorder = useRef<MediaRecorder | null>(null);
  const cloudVoiceStream = useRef<MediaStream | null>(null);
  const cloudVoiceChunks = useRef<Blob[]>([]);
  const cloudVoiceCanceled = useRef(false);
  const [membership, setMembership] = useState<Membership>('free');
  const [dailyLikesRemaining, setDailyLikesRemaining] = useState(10);
  const [registrationStep, setRegistrationStep] = useState(0);
  const [registrationSingleSection, setRegistrationSingleSection] =
    useState(false);
  const [boostsRemaining, setBoostsRemaining] = useState(0);
  const [purchasedBoosts, setPurchasedBoosts] = useState(0);
  const [activeBoosts, setActiveBoosts] = useState<ActiveBoosts>({});
  const [boostClock, setBoostClock] = useState(() => Date.now());
  const [themeOpen, setThemeOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationStatus, setVerificationStatus] =
    useState<PhotoVerificationStatus>('unverified');
  const [theme, setTheme] = useState<ThemeName>('default');
  const [filterOpen, setFilterOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planActivity, setPlanActivity] = useState('Coffee');
  const [datingPlans, setDatingPlans] = useState<DatingPlan[]>([]);
  const [planSafetyOpen, setPlanSafetyOpen] = useState(false);
  const [safetyPlan, setSafetyPlan] = useState<DatingPlan | null>(null);
  const [matchProfile, setMatchProfile] = useState<Profile>(profiles[0]);
  const [composer, setComposer] = useState('');
  const [messagesByContact, setMessagesByContact] =
    useState<Record<string, ChatMessage[]>>(demoChatMessages);
  const [dailyAvailability, setDailyAvailability] =
    useState<DailyAvailability>();
  const [previewCard, setPreviewCard] = useState(false);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sentLikes, setSentLikes] = useState<Profile[]>([
    profiles.find((profile) => profile.name === 'Noah')!,
  ]);
  const [savedProfileNames, setSavedProfileNames] = useState<string[]>([]);
  const [serverProfiles, setServerProfiles] = useState<Profile[]>([]);
  const [ownProfileMedia, setOwnProfileMedia] = useState<MediaItem[]>([]);
  const [declinedIncoming, setDeclinedIncoming] = useState<string[]>([]);
  const [registered, setRegistered] = useState(false);
  const [selfName, setSelfName] = useState('Alex');
  const [registrationData, setRegistrationData] =
    useState<RegistrationData>(initialRegistration);
  const [interactions, setInteractions] = useState<ProfileInteraction[]>([]);
  const [storedMessages, setStoredMessages] = useState<StoredMessage[]>([]);
  const signedInIdentity = identityForEmail(authEmail);
  const effectiveOwnMedia = ownProfileMedia.length
    ? ownProfileMedia
    : (signedInIdentity?.profile.media ?? []);
  const ownProfileImage =
    effectiveOwnMedia.find((item) => item.type === 'photo')?.src ??
    signedInIdentity?.profile.image ??
    '/imani.png';
  useEffect(() => {
    if (!authEmail) {
      setVerificationStatus('unverified');
      return;
    }
    if (serverDataEnabled) return;
    const saved = window.localStorage.getItem(
      `spikedate-photo-verification:${authEmail}`,
    );
    if (
      saved === 'unverified' ||
      saved === 'pending' ||
      saved === 'needs_review' ||
      saved === 'needs_retry' ||
      saved === 'photo_verified' ||
      saved === 'identity_verified'
    ) {
      setVerificationStatus(saved);
      return;
    }
    setVerificationStatus(
      identityForEmail(authEmail) ? 'photo_verified' : 'unverified',
    );
  }, [authEmail]);
  useEffect(() => {
    if (!authEmail || serverDataEnabled) return;
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(
          `spikedate-daily-availability:${authEmail}`,
        ) || 'null',
      ) as DailyAvailability | null;
      setDailyAvailability(
        stored && new Date(stored.endAt).getTime() > Date.now()
          ? stored
          : undefined,
      );
    } catch {
      setDailyAvailability(undefined);
    }
  }, [authEmail]);
  const profileSource =
    serverDataEnabled && serverProfiles.length ? serverProfiles : profiles;
  const filteredProfiles = profileSource
    .filter(
      (profile) =>
        !blockedProfiles.includes(profile.name) &&
        profile.name !== signedInIdentity?.profile.name &&
        filters.genders.includes(profile.gender) &&
        profile.age >= filters.minAge &&
        profile.age <= filters.maxAge &&
        profile.distanceMiles <= filters.maxDistance &&
        (filters.intents.length === 0 ||
          filters.intents.includes(profile.intent)) &&
        (filters.smoking === 'Any' || profile.smoking === 'No') &&
        (filters.wantsKids === 'Any' ||
          profile.wantsKids === filters.wantsKids),
    )
    .sort((a, b) => {
      const aBoosted = (activeBoosts[testEmails[a.name]] ?? 0) > boostClock;
      const bBoosted = (activeBoosts[testEmails[b.name]] ?? 0) > boostClock;
      return Number(bBoosted) - Number(aBoosted);
    });
  const current =
    filteredProfiles[profileIndex % Math.max(filteredProfiles.length, 1)] ??
    profiles[0];
  useEffect(() => {
    if (filteredProfiles.length < 2) return;
    const next =
      filteredProfiles[(profileIndex + 1) % filteredProfiles.length]?.image;
    if (!next) return;
    const image = new window.Image();
    image.src = next;
  }, [filteredProfiles, profileIndex]);
  const canViewDailyStory = (story: DailyStory) => {
    if (story.authorEmail === authEmail || story.visibility === 'discover')
      return true;
    if (story.visibility === 'matches')
      return contacts.some((contact) => contact.email === story.authorEmail);
    return interactions.some(
      (interaction) =>
        interaction.fromEmail === story.authorEmail &&
        interaction.toEmail === authEmail &&
        interaction.status !== 'declined',
    );
  };
  const storyForProfile = (profile: Profile) => {
    const email = identityForProfile(profile)?.email;
    return dailyStories.find(
      (story) => story.authorEmail === email && canViewDailyStory(story),
    );
  };
  const ownDailyStory = dailyStories.find(
    (story) => story.authorEmail === authEmail,
  );
  const visibleDailyStories = dailyStories
    .filter((story) => canViewDailyStory(story))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const activeMessages = messagesByContact[activeChat.name] ?? [];
  const activeFilterCount =
    (filters.genders.length !== 2 ? 1 : 0) +
    (filters.intents.length ? 1 : 0) +
    (filters.maxDistance !== 15 ? 1 : 0) +
    (filters.smoking !== 'Any' ? 1 : 0) +
    (filters.wantsKids !== 'Any' ? 1 : 0);
  const accountIncomingRows: IncomingRow[] = interactions
    .filter(
      (interaction) =>
        interaction.toEmail === authEmail && interaction.status === 'pending',
    )
    .sort((a, b) =>
      a.kind === b.kind
        ? b.createdAt.localeCompare(a.createdAt)
        : a.kind === 'super'
          ? -1
          : 1,
    )
    .flatMap((interaction) => {
      const sender = identityForEmail(interaction.fromEmail);
      if (!sender) return [];
      return [
        {
          id: interaction.id,
          profile: sender.profile,
          liked:
            interaction.kind === 'super'
              ? `Super Spiked you · ${interaction.target}`
              : `Liked your ${interaction.target.toLowerCase()}`,
          note: interaction.note ? `“${interaction.note}”` : '',
          superPulse: interaction.kind === 'super',
        },
      ];
    });
  const accountSentLikes = interactions
    .filter((interaction) => interaction.fromEmail === authEmail)
    .flatMap((interaction) => {
      const recipient = identityForEmail(interaction.toEmail);
      return recipient
        ? [{ profile: recipient.profile, status: interaction.status }]
        : [];
    });
  const savedProfiles = savedProfileNames.flatMap((name) => {
    const profile = allProfiles.find((item) => item.name === name);
    return profile ? [profile] : [];
  });
  const ownBoostEndsAt = authEmail ? (activeBoosts[authEmail] ?? 0) : 0;
  const boostActive = ownBoostEndsAt > boostClock;
  const voiceAvailable = voiceDeployment.enabled && voiceUserEnabled;
  const liveVoiceAvailable =
    voiceDeployment.enabled &&
    voiceDeployment.liveEnabled &&
    voiceLiveUserEnabled;
  const unreadMessages = contacts.reduce(
    (total, contact) => total + (contact.unread ?? 0),
    0,
  );
  const incomingLikeCount = signedInIdentity ? accountIncomingRows.length : 3;
  const sentThisWeek = signedInIdentity
    ? accountSentLikes.length
    : sentLikes.length;

  const announce = (message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => {
      setToast('');
      toastTimer.current = null;
    }, 2400);
  };

  const mirrorToServer = (
    operation: () => Promise<unknown>,
    failureMessage = 'Could not sync this change. Check your connection and try again.',
  ) => {
    if (!serverDataEnabled) return;
    void operation().catch(() => announce(failureMessage));
  };

  const toggleSavedProfile = (profile: Profile) => {
    setSavedProfileNames((current) => {
      const isSaved = current.includes(profile.name);
      const next = isSaved
        ? current.filter((name) => name !== profile.name)
        : [...current, profile.name].slice(-10);
      if (authEmail)
        window.localStorage.setItem(
          `spikedate-saved:${authEmail}`,
          JSON.stringify(next),
        );
      announce(
        isSaved
          ? `${profile.name} removed from Saved`
          : `${profile.name} saved privately`,
      );
      const targetUserId =
        profile.id ?? testUserIdForEmail(testEmails[profile.name]);
      if (targetUserId)
        mirrorToServer(() =>
          serverJson('/api/interactions', {
            method: 'POST',
            body: JSON.stringify({
              targetUserId,
              kind: isSaved ? 'rewind' : 'save',
              targetType: 'profile',
              idempotencyKey: crypto.randomUUID(),
            }),
          }),
        );
      return next;
    });
  };

  const saveDailyStories = (stories: DailyStory[]) => {
    const normalized = normalizeDailyStories(stories);
    setDailyStories(normalized);
    try {
      window.localStorage.setItem(
        'pulse-daily-stories',
        JSON.stringify(normalized),
      );
      return true;
    } catch {
      announce('That photo is too large. Try a smaller image.');
      return false;
    }
  };

  useEffect(() => {
    if (!dailyStories.length) return;
    const nextExpiry = Math.min(
      ...dailyStories.map((story) => new Date(story.expiresAt).getTime()),
    );
    const timer = window.setTimeout(
      () => {
        const active = normalizeDailyStories(dailyStories);
        setDailyStories(active);
        window.localStorage.setItem(
          'pulse-daily-stories',
          JSON.stringify(active),
        );
        setViewedDailyStory((story) =>
          story && new Date(story.expiresAt).getTime() <= Date.now()
            ? null
            : story,
        );
      },
      Math.max(0, nextExpiry - Date.now()) + 100,
    );
    return () => window.clearTimeout(timer);
  }, [dailyStories]);

  const openNewToday = () => {
    setTodayComposerStory(null);
    setTodayComposerOpen(true);
  };

  const saveDailyAvailability = async (next: DailyAvailability) => {
    try {
      if (serverDataEnabled) {
        const result = await serverJson<{
          availability: DailyAvailability;
        }>('/api/availability', {
          method: 'PUT',
          body: JSON.stringify(next),
        });
        setDailyAvailability(result.availability);
      } else {
        window.localStorage.setItem(
          `spikedate-daily-availability:${authEmail}`,
          JSON.stringify(next),
        );
        setDailyAvailability(next);
      }
      announce('Your availability is visible to your matches');
      return '';
    } catch (reason) {
      return (reason as Error).message;
    }
  };

  const clearDailyAvailability = async () => {
    try {
      if (serverDataEnabled) {
        await serverJson('/api/availability', { method: 'DELETE' });
      } else {
        window.localStorage.removeItem(
          `spikedate-daily-availability:${authEmail}`,
        );
      }
      setDailyAvailability(undefined);
      announce('Daily availability cleared');
      return '';
    } catch (reason) {
      return (reason as Error).message;
    }
  };

  const openEditToday = (story: DailyStory) => {
    setViewedDailyStory(null);
    setTodayComposerStory(story);
    setTodayComposerOpen(true);
  };

  const publishDailyStory = async (
    draft: DailyStoryDraft,
    storyId?: string,
    availability?: DailyAvailability | null,
  ) => {
    if (!authEmail) return 'Sign in to share your Today.';
    const availabilityError = availability
      ? await saveDailyAvailability(availability)
      : await clearDailyAvailability();
    if (availabilityError) return availabilityError;
    const storyBeingEdited = storyId
      ? dailyStories.find(
          (story) => story.id === storyId && story.authorEmail === authEmail,
        )
      : undefined;
    const hasPost = Boolean(draft.caption.trim() || draft.mediaUrl);
    if (storyBeingEdited && !hasPost) {
      if (
        !saveDailyStories(
          dailyStories.filter((story) => story.id !== storyBeingEdited.id),
        )
      )
        return 'Could not remove the Today update.';
      mirrorToServer(() =>
        serverJson('/api/daily-update', { method: 'DELETE' }),
      );
      setTodayComposerOpen(false);
      setTodayComposerStory(null);
      announce(
        availability
          ? 'Today availability saved; the written update was removed'
          : 'Your Today status was cleared',
      );
      return '';
    }
    if (storyBeingEdited) {
      const updatedStory = { ...storyBeingEdited, ...draft };
      const next = dailyStories.map((story) =>
        story.id === storyBeingEdited.id ? updatedStory : story,
      );
      if (!saveDailyStories(next)) return;
      setViewedDailyStory((story) =>
        story?.id === updatedStory.id ? updatedStory : story,
      );
      setTodayComposerOpen(false);
      setTodayComposerStory(null);
      mirrorToServer(() =>
        serverJson('/api/daily-update', {
          method: 'POST',
          body: JSON.stringify({
            text: updatedStory.caption,
            visibility: updatedStory.visibility,
            availableTonight: false,
          }),
        }),
      );
      announce('Your Today post was updated');
      return '';
    }
    if (!hasPost) {
      setTodayComposerOpen(false);
      setTodayComposerStory(null);
      announce(
        availability
          ? 'Your Today availability is now visible to matches'
          : 'Your Today status is not shared',
      );
      return '';
    }
    const nextStory: DailyStory = {
      ...draft,
      id: `today-${Date.now()}-${authEmail}`,
      authorEmail: authEmail,
      authorName: selfName,
      viewedBy: [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    const next = [
      nextStory,
      ...dailyStories.filter((story) => story.authorEmail !== authEmail),
    ];
    if (!saveDailyStories(next)) return;
    setTodayComposerOpen(false);
    setTodayComposerStory(null);
    mirrorToServer(() =>
      serverJson('/api/daily-update', {
        method: 'POST',
        body: JSON.stringify({
          text: nextStory.caption,
          visibility: nextStory.visibility,
          availableTonight: false,
        }),
      }),
    );
    announce('Your new Today post is live for 24 hours');
    return '';
  };

  const openDailyStory = (story: DailyStory) => {
    setViewedDailyStory(story);
    if (!authEmail || story.authorEmail === authEmail) return;
    if (story.viewedBy.includes(authEmail)) return;
    const next = dailyStories.map((item) =>
      item.id === story.id
        ? { ...item, viewedBy: [...item.viewedBy, authEmail] }
        : item,
    );
    saveDailyStories(next);
    setViewedDailyStory(next.find((item) => item.id === story.id) ?? story);
  };

  const reactToDailyStory = (story: DailyStory, mode: NoteMode) => {
    const profile = identityForEmail(story.authorEmail)?.profile;
    if (!profile) return;
    setViewedDailyStory(null);
    openNote(mode, profile);
    setNoteTarget(`Today · ${story.prompt}`);
  };

  const replyToDailyStory = (story: DailyStory, message: string) => {
    const text = message.trim();
    const profile = identityForEmail(story.authorEmail)?.profile;
    if (!text || !profile || !authEmail) return;
    // Older demo contacts predate account emails, but they still represent an
    // established match. Keep those conversations connected by name while all
    // newly created contacts continue to use the stable email identifier.
    const contact = contacts.find(
      (item) =>
        item.email === story.authorEmail ||
        item.name.toLocaleLowerCase() === profile.name.toLocaleLowerCase(),
    );
    setViewedDailyStory(null);
    if (!contact) {
      recordInteraction(profile, 'like', text, 'Today post');
      announce(`Introduction sent to ${profile.name} with their Today post`);
      return;
    }
    const stored: StoredMessage = {
      id: Date.now(),
      fromEmail: authEmail,
      toEmail: story.authorEmail,
      text: `Replied to your Today: ${text}`,
      createdAt: new Date().toISOString(),
    };
    setStoredMessages((items) => {
      const next = [...items, stored];
      window.localStorage.setItem('pulse-messages', JSON.stringify(next));
      return next;
    });
    setMessagesByContact((items) => ({
      ...items,
      [profile.name]: [
        ...(items[profile.name] ?? []),
        { id: stored.id, text: stored.text, mine: true },
      ],
    }));
    setContacts((items) =>
      items.map((item) =>
        item.email === story.authorEmail
          ? { ...item, preview: stored.text, time: 'Now' }
          : item,
      ),
    );
    announce(`Reply sent to ${profile.name}`);
  };

  const deleteOwnDailyStory = () => {
    if (!authEmail) return;
    saveDailyStories(
      dailyStories.filter((story) => story.authorEmail !== authEmail),
    );
    setViewedDailyStory(null);
    setTodayComposerOpen(false);
    setTodayComposerStory(null);
    mirrorToServer(() => serverJson('/api/daily-update', { method: 'DELETE' }));
    announce('Today post deleted');
  };

  const nextProfile = () => {
    setProfileOpen(false);
    if (filteredProfiles.length)
      setProfileIndex((value) => (value + 1) % filteredProfiles.length);
  };

  const saveInteractions = (
    update: (current: ProfileInteraction[]) => ProfileInteraction[],
  ) => {
    setInteractions((current) => {
      const next = update(current);
      window.localStorage.setItem('pulse-interactions', JSON.stringify(next));
      return next;
    });
  };

  const recordInteraction = (
    profile: Profile,
    kind: NoteMode,
    note: string,
    target: string,
  ) => {
    const recipient = identityForProfile(profile);
    if (!authEmail) return false;
    if (!serverDataEnabled && (!signedInIdentity || !recipient)) return false;
    if (recipient)
      saveInteractions((current) => [
        ...current.filter(
          (item) =>
            !(item.fromEmail === authEmail && item.toEmail === recipient.email),
        ),
        {
          id: `${Date.now()}-${authEmail}-${recipient.email}`,
          fromEmail: authEmail,
          toEmail: recipient.email,
          kind,
          target,
          note: note.trim(),
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ]);
    const targetUserId = profile.id ?? testUserIdForEmail(recipient?.email);
    if (targetUserId)
      mirrorToServer(() =>
        serverJson('/api/interactions', {
          method: 'POST',
          body: JSON.stringify({
            targetUserId,
            kind: kind === 'super' ? 'super_spike' : 'like',
            note: note.trim() || undefined,
            targetType: target.startsWith('Today')
              ? 'daily_update'
              : target.toLowerCase().includes('photo')
                ? 'photo'
                : 'prompt',
            targetRef: target,
            idempotencyKey: crypto.randomUUID(),
          }),
        }),
      );
    return true;
  };

  const completeLike = (
    profile = actionProfile,
    voiceNote?: { message: string; target: string },
  ) => {
    const actionMessage = voiceNote?.message ?? noteMessage;
    const actionTarget = voiceNote?.target ?? noteTarget;
    const recipient = identityForProfile(profile);
    const alreadySent = recipient
      ? interactions.some(
          (item) =>
            item.fromEmail === authEmail && item.toEmail === recipient.email,
        )
      : sentLikes.some((item) => item.name === profile.name);
    if (membership === 'free' && dailyLikesRemaining <= 0 && !alreadySent) {
      setNoteOpen(false);
      setSubscriptionOpen(true);
      announce('Daily Likes used — SpikeDate+ keeps Likes unlimited');
      return;
    }
    setProfileOpen(false);
    setSentLikes((items) =>
      items.some((item) => item.name === profile.name)
        ? items
        : [...items, profile],
    );
    if (membership === 'free' && !alreadySent)
      setDailyLikesRemaining((remaining) => Math.max(0, remaining - 1));
    if (recordInteraction(profile, 'like', actionMessage, actionTarget)) {
      announce(`Like sent to ${profile.name} — they’ll see it in Incoming`);
      nextProfile();
    } else if (profile.name === 'Maya') {
      setMatchProfile(profile);
      setMatchOpen(true);
    } else {
      announce(`Like sent to ${profile.name} — track it in You liked`);
      nextProfile();
    }
  };

  const openNote = (mode: NoteMode, profile = current) => {
    setEngagementNudge(null);
    setProfileOpen(false);
    setActionProfile(profile);
    setNoteMode(mode);
    setNoteTarget(mode === 'super' ? 'Lifestyle' : profile.tags[0]);
    setNoteMessage('');
    setNoteOpen(true);
  };

  const sendNoteAction = () => {
    if (noteMode === 'like') {
      setNoteOpen(false);
      completeLike(actionProfile);
      return;
    }
    if (superPulsesRemaining <= 0) {
      announce('No Super Spikes remaining this week');
      setNoteOpen(false);
      setSubscriptionOpen(true);
      return;
    }
    recordInteraction(actionProfile, 'super', noteMessage, noteTarget);
    setSentLikes((items) =>
      items.some((item) => item.name === actionProfile.name)
        ? items
        : [...items, actionProfile],
    );
    setSuperPulsesRemaining((count) => Math.max(0, count - 1));
    setNoteOpen(false);
    announce(
      `Super Spike sent to ${actionProfile.name}${noteMessage.trim() ? ` with a note on ${noteTarget}` : ''} — you’re at the front of their Incoming`,
    );
    nextProfile();
  };

  const openFullProfile = (profile: Profile) => {
    setEngagementNudge(null);
    profileOpenedAt.current = Date.now();
    setSelectedProfile(profile);
    setProfileOpen(true);
  };

  const closeOrUpdateFullProfile = (open: boolean) => {
    setProfileOpen(open);
    if (open || !selectedProfile) return;
    const viewedLongEnough = Date.now() - profileOpenedAt.current >= 3000;
    const dismissedAt = Number(
      window.localStorage.getItem(
        `pulse-engagement-super-dismissed:${authEmail}:${selectedProfile.name}`,
      ) || '0',
    );
    if (
      viewedLongEnough &&
      engagementPreferences.super &&
      superPulsesRemaining > 0 &&
      Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000
    ) {
      window.setTimeout(
        () => setEngagementNudge({ kind: 'super', profile: selectedProfile }),
        220,
      );
    }
  };

  const dismissEngagementNudge = () => {
    if (!engagementNudge || !authEmail) return;
    const suffix =
      engagementNudge.kind === 'super'
        ? `:${engagementNudge.profile.name}`
        : '';
    window.localStorage.setItem(
      `pulse-engagement-${engagementNudge.kind}-dismissed:${authEmail}${suffix}`,
      String(Date.now()),
    );
    setEngagementNudge(null);
  };

  const useEngagementNudge = () => {
    if (!engagementNudge) return;
    const nudge = engagementNudge;
    dismissEngagementNudge();
    if (nudge.kind === 'today') {
      openNewToday();
      return;
    }
    if (nudge.kind === 'boost') {
      setBoostOpen(true);
      return;
    }
    if (nudge.kind === 'like') {
      setTab('Pulse');
      setRoom(null);
      announce('Profiles ready — take your time and choose thoughtfully');
      return;
    }
    openNote('super', nudge.profile);
  };

  const updateTodayReminderTime = (time: TodayReminderTime) => {
    setTodayReminderTime(time);
    if (authEmail)
      window.localStorage.setItem(
        `pulse-today-reminder-time:${authEmail}`,
        time,
      );
  };

  const updateEngagementPreference = (
    key: keyof EngagementPreferences,
    checked: boolean,
  ) => {
    const next = { ...engagementPreferences, [key]: checked };
    setEngagementPreferences(next);
    if (authEmail)
      window.localStorage.setItem(
        `pulse-engagement-preferences:${authEmail}`,
        JSON.stringify(next),
      );
    if (!checked && engagementNudge?.kind === key) setEngagementNudge(null);
  };

  const updatePushPreference = (
    key: Exclude<keyof PushPreferences, 'quietHours'>,
    checked: boolean,
  ) => {
    const next = { ...pushPreferences, [key]: checked };
    setPushPreferences(next);
    if (authEmail)
      window.localStorage.setItem(
        `spikedate-push-preferences:${authEmail}`,
        JSON.stringify(next),
      );
    if (serverDataEnabled)
      mirrorToServer(() =>
        serverJson('/api/notifications/preferences', {
          method: 'PATCH',
          body: JSON.stringify(next),
        }),
      );
  };

  const updateQuietHours = (enabled: boolean) => {
    const next = {
      ...pushPreferences,
      quietHours: enabled
        ? {
            start: '22:00',
            end: '08:00',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }
        : null,
    };
    setPushPreferences(next);
    if (authEmail)
      window.localStorage.setItem(
        `spikedate-push-preferences:${authEmail}`,
        JSON.stringify(next),
      );
    if (serverDataEnabled)
      mirrorToServer(() =>
        serverJson('/api/notifications/preferences', {
          method: 'PATCH',
          body: JSON.stringify(next),
        }),
      );
  };

  const openProfileSafety = (
    profile: Profile,
    mode: 'menu' | 'report' | 'block' = 'menu',
  ) => {
    setSafetyProfile(profile);
    setSafetyMode(mode);
    setSafetyOpen(true);
  };

  const removePlansWithProfile = (profile: Profile) => {
    const targetEmail = identityForProfile(profile)?.email;
    const belongsToProfile = (plan: DatingPlan) =>
      plan.invitees.includes(profile.name) ||
      Boolean(targetEmail && plan.inviteeEmails?.includes(targetEmail));
    setDatingPlans((items) => {
      const next = items.filter((plan) => !belongsToProfile(plan));
      if (authEmail)
        window.localStorage.setItem(
          `pulse-plans:${authEmail}`,
          JSON.stringify(next),
        );
      return next;
    });
    const allPlans = JSON.parse(
      window.localStorage.getItem('pulse-all-plans') || '[]',
    ) as DatingPlan[];
    window.localStorage.setItem(
      'pulse-all-plans',
      JSON.stringify(
        allPlans.map((plan) =>
          belongsToProfile(plan) ? { ...plan, status: 'cancelled' } : plan,
        ),
      ),
    );
  };

  const blockProfile = (profile: Profile) => {
    setBlockedProfiles((current) => {
      const next = current.includes(profile.name)
        ? current
        : [...current, profile.name];
      window.localStorage.setItem(
        'pulse-blocked-profiles',
        JSON.stringify(next),
      );
      return next;
    });
    setSafetyOpen(false);
    setProfileOpen(false);
    removePlansWithProfile(profile);
    const targetUserId =
      profile.id ?? testUserIdForEmail(testEmails[profile.name]);
    if (targetUserId)
      mirrorToServer(() =>
        serverJson('/api/safety', {
          method: 'POST',
          body: JSON.stringify({ targetUserId, action: 'block' }),
        }),
      );
    announce(`${profile.name} has been blocked and removed from SpikeDate`);
  };

  const reportProfile = (profile: Profile) => {
    const targetUserId =
      profile.id ?? testUserIdForEmail(testEmails[profile.name]);
    if (targetUserId)
      mirrorToServer(() =>
        serverJson('/api/safety', {
          method: 'POST',
          body: JSON.stringify({
            targetUserId,
            action: 'report',
            reason: 'Profile concern',
          }),
        }),
      );
    setSafetyOpen(false);
    removePlansWithProfile(profile);
    announce(`${profile.name} reported; shared date plans were removed`);
  };

  const openChatWith = (text = '', profile = matchProfile) => {
    setMatchOpen(false);
    setIncomingOpen(false);
    const contact = {
      name: profile.name,
      image: profile.image,
      email: identityForProfile(profile)?.email,
      preview: text || 'You matched today',
      time: 'Now',
      active: true,
      unread: 0,
    };
    setActiveChat(contact);
    setContacts((items) =>
      items.some((item) => item.name === profile.name)
        ? items.map((item) =>
            item.name === profile.name ? { ...item, unread: 0 } : item,
          )
        : [contact, ...items],
    );
    setMessagesByContact((items) =>
      items[profile.name] ? items : { ...items, [profile.name]: [] },
    );
    setComposer(text);
    setTab('Chat');
    setChatOpen(true);
  };

  const likeBack = (profile: Profile, interactionId?: string) => {
    if (interactionId)
      saveInteractions((current) =>
        current.map((item) =>
          item.id === interactionId ? { ...item, status: 'accepted' } : item,
        ),
      );
    setIncomingOpen(false);
    setMatchProfile(profile);
    setMatchOpen(true);
  };

  const sendMessage = (preset?: string) => {
    const text = (preset ?? composer).trim();
    if (!text) return;
    setMessagesByContact((items) => ({
      ...items,
      [activeChat.name]: [
        ...(items[activeChat.name] ?? []),
        { id: Date.now(), text, mine: true },
      ],
    }));
    setContacts((items) =>
      items.map((item) =>
        item.name === activeChat.name
          ? { ...item, preview: text, time: 'Now', unread: 0 }
          : item,
      ),
    );
    if (authEmail && activeChat.email) {
      const stored: StoredMessage = {
        id: Date.now(),
        fromEmail: authEmail,
        toEmail: activeChat.email,
        text,
        createdAt: new Date().toISOString(),
      };
      setStoredMessages((items) => {
        const next = [...items, stored];
        window.localStorage.setItem('pulse-messages', JSON.stringify(next));
        return next;
      });
    }
    mirrorToServer(async () => {
      let conversationId = activeChat.conversationId;
      if (!conversationId) {
        const targetUserId =
          activeChat.userId ?? testUserIdForEmail(activeChat.email);
        const result = await serverJson<{
          conversations: Array<{ id: string; other_user_id: string }>;
        }>('/api/conversations');
        conversationId = result.conversations.find(
          (item) => item.other_user_id === targetUserId,
        )?.id;
      }
      if (!conversationId)
        throw new Error('Match before starting a conversation.');
      await serverJson(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: text, clientId: crypto.randomUUID() }),
      });
    }, 'Message kept on this device but could not be delivered.');
    setComposer('');
  };

  const openPlanBuilder = (activity: string) => {
    if (!datePlansEnabled) {
      announce('Date planning is currently unavailable');
      return;
    }
    setPlanActivity(activity);
    setPlanOpen(true);
  };

  const sendPlanInvites = (plan: DatingPlan) => {
    const startsAt = new Date(`${plan.day}T${plan.time}`).getTime();
    const completePlan: DatingPlan = {
      ...plan,
      creatorEmail: authEmail ?? undefined,
      venueOptions: plan.venueOptions?.length
        ? plan.venueOptions
        : [plan.venue],
      venueVotes: authEmail ? { [authEmail]: plan.venue.id } : {},
      safetyStatus: plan.safetyCheckInEnabled ? 'scheduled' : undefined,
      safetyAcknowledgedAt:
        plan.safetyAcknowledgedAt ?? new Date().toISOString(),
      expiresAt:
        plan.expiresAt ??
        new Date(startsAt + 30 * 24 * 60 * 60 * 1000).toISOString(),
      inviteeEmails: plan.invitees.flatMap((name) => {
        const email = contacts.find((contact) => contact.name === name)?.email;
        return email ? [email] : [];
      }),
    };
    const inviteText = `Plan invite · ${plan.planName} · ${new Date(
      `${plan.day}T${plan.time}`,
    ).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })} · ${plan.venue.name}, ${plan.venue.neighborhood}`;
    setDatingPlans((items) => {
      const next = [completePlan, ...items];
      if (authEmail)
        window.localStorage.setItem(
          `pulse-plans:${authEmail}`,
          JSON.stringify(next),
        );
      const allPlans = JSON.parse(
        window.localStorage.getItem('pulse-all-plans') || '[]',
      ) as DatingPlan[];
      window.localStorage.setItem(
        'pulse-all-plans',
        JSON.stringify([
          completePlan,
          ...allPlans.filter((item) => item.id !== completePlan.id),
        ]),
      );
      return next;
    });
    setMessagesByContact((items) => {
      const next = { ...items };
      plan.invitees.forEach((name, index) => {
        next[name] = [
          ...(next[name] ?? []),
          { id: plan.id + index, text: inviteText, mine: true },
        ];
      });
      return next;
    });
    setContacts((items) =>
      items.map((contact) =>
        plan.invitees.includes(contact.name)
          ? { ...contact, preview: inviteText, time: 'Now', unread: 0 }
          : contact,
      ),
    );
    if (authEmail) {
      const inviteMessages: StoredMessage[] = plan.invitees.flatMap(
        (name, index) => {
          const contact = contacts.find((item) => item.name === name);
          if (!contact?.email) return [];
          return [
            {
              id: plan.id + index,
              fromEmail: authEmail,
              toEmail: contact.email,
              text: inviteText,
              createdAt: new Date().toISOString(),
            },
          ];
        },
      );

      if (inviteMessages.length)
        setStoredMessages((items) => {
          const next = [...items, ...inviteMessages];
          window.localStorage.setItem('pulse-messages', JSON.stringify(next));
          return next;
        });
    }
    mirrorToServer(
      () =>
        serverJson('/api/galaxy/plans', {
          method: 'POST',
          body: JSON.stringify({
            name: plan.planName,
            activity: plan.activity,
            venue: {
              name: plan.venue.name,
              address: plan.venue.address,
              latitude: plan.venue.latitude,
              longitude: plan.venue.longitude,
            },
            startsAt: new Date(`${plan.day}T${plan.time}`).getTime(),
            publicVenueConfirmed: true,
            safetyAcknowledged: Boolean(completePlan.safetyAcknowledgedAt),
            inviteeIds: completePlan.inviteeEmails?.flatMap((email) => {
              const id = testUserIdForEmail(email);
              return id ? [id] : [];
            }),
          }),
        }),
      'Plan saved on this device but could not be sent to every match.',
    );
    setPlanOpen(false);
    announce(
      `Plan sent to ${plan.invitees.length} ${plan.invitees.length === 1 ? 'match' : 'matches'}`,
    );
  };

  const saveDatingPlans = (next: DatingPlan[]) => {
    setDatingPlans(next);
    if (authEmail)
      window.localStorage.setItem(
        `pulse-plans:${authEmail}`,
        JSON.stringify(next),
      );
    const changed = new Map(next.map((plan) => [plan.id, plan]));
    const allPlans = JSON.parse(
      window.localStorage.getItem('pulse-all-plans') || '[]',
    ) as DatingPlan[];
    window.localStorage.setItem(
      'pulse-all-plans',
      JSON.stringify(allPlans.map((plan) => changed.get(plan.id) ?? plan)),
    );
  };

  const cancelDatingPlan = (plan: DatingPlan) => {
    saveDatingPlans(
      datingPlans.map((item) =>
        item.id === plan.id ? { ...item, status: 'cancelled' } : item,
      ),
    );
    announce(`${plan.planName} cancelled`);
  };

  const respondToDatingPlan = (
    plan: DatingPlan,
    status: 'accepted' | 'declined',
  ) => {
    saveDatingPlans(
      datingPlans.map((item) =>
        item.id === plan.id ? { ...item, status } : item,
      ),
    );
    announce(
      status === 'accepted'
        ? `${plan.planName} confirmed`
        : 'Invitation declined privately',
    );
  };

  const suggestPlanChange = (plan: DatingPlan, day?: string, time?: string) => {
    const fallbackDay = new Date(`${plan.day}T12:00:00`);
    fallbackDay.setDate(fallbackDay.getDate() + 1);
    const nextDay = day ?? fallbackDay.toISOString().slice(0, 10);
    const nextTime = time ?? plan.time;
    saveDatingPlans(
      datingPlans.map((item) =>
        item.id === plan.id
          ? {
              ...item,
              alternateDay: nextDay,
              alternateTime: nextTime,
              alternateSuggestedBy: authEmail || undefined,
            }
          : item,
      ),
    );
    announce('Alternate time sent to your match');
  };

  const acceptAlternatePlan = (plan: DatingPlan) => {
    if (!plan.alternateDay || !plan.alternateTime) return;
    saveDatingPlans(
      datingPlans.map((item) =>
        item.id === plan.id
          ? {
              ...item,
              day: plan.alternateDay!,
              time: plan.alternateTime!,
              alternateDay: undefined,
              alternateTime: undefined,
              alternateSuggestedBy: undefined,
              status: 'accepted',
            }
          : item,
      ),
    );
    announce(`${plan.planName} updated and confirmed`);
  };

  const voteForPlanVenue = (plan: DatingPlan, venueId: string) => {
    if (!authEmail) return;
    const venue = (plan.venueOptions ?? [plan.venue]).find(
      (item) => item.id === venueId,
    );
    saveDatingPlans(
      datingPlans.map((item) =>
        item.id === plan.id
          ? {
              ...item,
              venue: venue ?? item.venue,
              venueVotes: { ...item.venueVotes, [authEmail]: venueId },
            }
          : item,
      ),
    );
    announce(`Your vote for ${venue?.name ?? 'the venue'} was saved`);
  };

  const markPlanSafe = (plan: DatingPlan) => {
    saveDatingPlans(
      datingPlans.map((item) =>
        item.id === plan.id ? { ...item, safetyStatus: 'safe' } : item,
      ),
    );
    announce('Safety check-in completed');
  };

  const endDatingPlan = (plan: DatingPlan) => {
    saveDatingPlans(
      datingPlans.map((item) =>
        item.id === plan.id
          ? { ...item, status: 'completed', safetyStatus: 'ended' }
          : item,
      ),
    );
    setPlanSafetyOpen(false);
    announce(`${plan.planName} ended`);
  };

  const openPlanSafety = (plan: DatingPlan) => {
    setSafetyPlan(plan);
    setPlanSafetyOpen(true);
  };

  const openPlanDirections = (plan: DatingPlan) => {
    const query = encodeURIComponent(
      `${plan.venue.name}, ${plan.venue.address}`,
    );
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${query}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const shareDatingPlan = async (plan: DatingPlan) => {
    const match = plan.invitees[0] ? `Meeting ${plan.invitees[0]}\n` : '';
    const text = `SpikeDate date plan\n${match}${plan.planName}\n${new Date(
      `${plan.day}T${plan.time}`,
    ).toLocaleString()}\n${plan.venue.name}\n${plan.venue.address}\n\nShared with you as my trusted contact. This is not live location tracking.`;
    try {
      if (navigator.share)
        await navigator.share({ title: plan.planName, text });
      else {
        await navigator.clipboard.writeText(text);
        announce('Plan details copied');
      }
    } catch {
      /* sharing was cancelled */
    }
  };

  const addPlanToCalendar = (plan: DatingPlan) => {
    const start = new Date(`${plan.day}T${plan.time}`);
    const end = new Date(start.getTime() + plan.durationMinutes * 60_000);
    const stamp = (value: Date) =>
      value
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
    const calendar = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SpikeDate//Galaxy Plan//EN',
      'BEGIN:VEVENT',
      `UID:${plan.id}@spikedate.app`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${plan.planName.replace(/[,;\\]/g, ' ')}`,
      `LOCATION:${`${plan.venue.name}, ${plan.venue.address}`.replace(/[,;\\]/g, ' ')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(
      new Blob([calendar], { type: 'text/calendar;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${plan.planName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    announce('Calendar event created');
  };

  const openExistingChat = async (contact: ChatContact) => {
    setActiveChat({ ...contact, unread: 0 });
    setContacts((items) =>
      items.map((item) =>
        item.name === contact.name ? { ...item, unread: 0 } : item,
      ),
    );
    if (authEmail && contact.email) {
      setStoredMessages((items) => {
        const readAt = new Date().toISOString();
        const next = items.map((message) =>
          message.fromEmail === contact.email &&
          message.toEmail === authEmail &&
          !message.readAt
            ? { ...message, readAt }
            : message,
        );
        window.localStorage.setItem('pulse-messages', JSON.stringify(next));
        return next;
      });
    }
    setChatOpen(true);
    if (serverDataEnabled && contact.conversationId) {
      try {
        const result = await serverJson<{
          messages: Array<{
            id: string;
            sender_id: string;
            body: string;
          }>;
        }>(`/api/conversations/${contact.conversationId}/messages`);
        setMessagesByContact((items) => ({
          ...items,
          [contact.name]: result.messages.map((message) => ({
            id: message.id,
            text: message.body,
            mine: message.sender_id !== contact.userId,
          })),
        }));
      } catch {
        announce('Messages are temporarily unavailable.');
      }
    }
  };

  const shareProfile = async (profile: Profile) => {
    const shareData = {
      title: `${profile.name} on SpikeDate`,
      text: `Take a look at ${profile.name}'s SpikeDate profile.`,
      url: `${window.location.origin}/?profile=${profile.name.toLowerCase()}`,
    };
    announce(`Share link ready for ${profile.name}`);
    try {
      if (navigator.share) await navigator.share(shareData);
      else
        await navigator.clipboard?.writeText(
          `${shareData.text} ${shareData.url}`,
        );
    } catch {
      /* The user can dismiss the native share sheet without changing the profile. */
    } finally {
      announce(`Share link ready for ${profile.name}`);
    }
  };

  const addProfilePhoto = async (photo: CroppedPhoto) => {
    let media: MediaItem;
    if (serverDataEnabled) {
      const result = await serverJson<{
        media: {
          id: string;
          type: 'photo';
          url: string;
          moderationStatus: string;
        };
      }>('/api/media', {
        method: 'POST',
        headers: { 'content-type': photo.blob.type },
        body: photo.blob,
      });
      media = {
        id: result.media.id,
        type: 'photo',
        src: result.media.url,
        moderationStatus: result.media.moderationStatus,
      };
    } else {
      media = {
        id: `local-photo-${Date.now()}`,
        type: 'photo',
        src: await blobToDataUrl(photo.blob),
        moderationStatus: 'local',
      };
    }
    setOwnProfileMedia((current) => {
      const base = current.length
        ? current
        : (signedInIdentity?.profile.media ?? []);
      const existingPhotos = base
        .filter((item) => item.type === 'photo')
        .slice(0, 5);
      const video = base.find((item) => item.type === 'video');
      return [...existingPhotos, media, ...(video ? [video] : [])];
    });
    announce(
      photo.lowResolution
        ? 'Photo added. A higher-resolution original will look sharper.'
        : 'Photo cropped and saved in high quality',
    );
  };

  const addProfileVideo = async (file: File) => {
    if (file.size > 30 * 1024 * 1024) {
      announce('Choose a video smaller than 30 MB');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    let duration = 0;
    try {
      duration = await new Promise<number>((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => resolve(video.duration);
        video.onerror = () => reject(new Error('Video metadata unavailable'));
        video.src = objectUrl;
      });
    } catch {
      URL.revokeObjectURL(objectUrl);
      announce('This video could not be read. Try MP4, MOV, or WebM.');
      return;
    }
    if (!Number.isFinite(duration) || duration > 15.25) {
      URL.revokeObjectURL(objectUrl);
      announce('Profile videos can be up to 15 seconds');
      return;
    }
    let media: MediaItem;
    if (serverDataEnabled) {
      const result = await serverJson<{
        media: {
          id: string;
          type: 'video';
          url: string;
          moderationStatus: string;
        };
      }>('/api/media', {
        method: 'POST',
        headers: {
          'content-type': file.type || 'video/mp4',
          'x-spikedate-duration-seconds': duration.toFixed(3),
        },
        body: file,
      });
      URL.revokeObjectURL(objectUrl);
      media = {
        id: result.media.id,
        type: 'video',
        src: result.media.url,
        moderationStatus: result.media.moderationStatus,
      };
    } else {
      media = {
        id: `local-video-${Date.now()}`,
        type: 'video',
        src: objectUrl,
        moderationStatus: 'local',
      };
    }
    setOwnProfileMedia((current) => {
      const base = current.length
        ? current
        : (signedInIdentity?.profile.media ?? []);
      return [
        ...base.filter((item) => item.type === 'photo').slice(0, 6),
        media,
      ];
    });
    announce('15-second profile video added');
  };

  const makeMainProfilePhoto = (media: MediaItem) => {
    setOwnProfileMedia((current) => {
      const source = current.length
        ? current
        : (signedInIdentity?.profile.media ?? []);
      const next = [media, ...source.filter((item) => item !== media)];
      const ids = next.flatMap((item) => (item.id ? [item.id] : []));
      if (serverDataEnabled && ids.length === next.length)
        mirrorToServer(() =>
          serverJson('/api/media', {
            method: 'PATCH',
            body: JSON.stringify({ mediaIds: ids }),
          }),
        );
      return next;
    });
    announce('Main profile photo updated');
  };

  const removeProfilePhoto = (media: MediaItem) => {
    setOwnProfileMedia((current) => current.filter((item) => item !== media));
    if (serverDataEnabled && media.id)
      mirrorToServer(() =>
        serverJson(`/api/media/${media.id}`, { method: 'DELETE' }),
      );
    announce(media.type === 'video' ? 'Video removed' : 'Photo removed');
  };

  const completeRegistration = (data: RegistrationData) => {
    setSelfName(data.name || 'Alex');
    setRegistered(true);
    setRegistrationData(data);
    setFilters((value) => ({
      ...value,
      genders: data.preferredGenders,
      minAge: data.minAge,
      maxAge: data.maxAge,
      maxDistance: data.maxDistance,
      intents: data.intents,
    }));
    if (authEmail)
      window.localStorage.setItem(
        `pulse-registration:${authEmail}`,
        JSON.stringify(data),
      );
    mirrorToServer(async () => {
      await serverJson('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          section: 'profile',
          data: {
            displayName: data.name,
            bio: data.bio,
            pronouns: data.pronouns || null,
            occupation: data.occupation || null,
            education: data.education || null,
            heightCm: heightToCm(data.height),
            ethnicity: data.ethnicity || null,
            relationshipGoal: data.intents[0] || 'Dating',
            kids: data.kids || null,
            wantsKids: data.wantsKids || null,
            drinking: data.drinking || null,
            smoking: data.smoking || null,
            pets: data.pets || null,
            city: data.city || null,
            country: 'US',
            discoverable: true,
          },
        }),
      });
      await serverJson('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          section: 'preferences',
          data: {
            genders: data.preferredGenders,
            minAge: data.minAge,
            maxAge: data.maxAge,
            maxDistanceKm: data.maxDistance,
            relationshipGoals: data.intents,
            dealbreakers: [],
          },
        }),
      });
      await serverJson('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          section: 'prompts',
          data: [
            { prompt: 'A little more about me', answer: data.promptOne },
            { prompt: 'Ask me about', answer: data.promptTwo },
          ].filter((item) => item.answer.trim().length >= 2),
        }),
      });
      await serverJson('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          section: 'interests',
          data: [...data.interests, ...data.values].slice(0, 20),
        }),
      });
    }, 'Profile saved on this device but could not sync yet.');
    setRegistrationOpen(false);
    setProfileIndex(0);
    announce('Profile registered — you’re ready to be discovered');
  };

  const handleTab = (value: Tab) => {
    setTab(value);
    setRoom(null);
    setChatOpen(false);
    setPreviewCard(false);
  };

  const chooseTheme = (nextTheme: ThemeName) => {
    setTheme(nextTheme);
    setThemeOpen(false);
    window.localStorage.setItem('pulse-theme', nextTheme);
    announce(`${themeLabels[nextTheme]} theme applied`);
  };

  const choosePulsePlus = (billing: BillingPeriod) => {
    if (!authEmail) return;
    setMembership('plus');
    setSuperPulsesRemaining(3);
    setBoostsRemaining(purchasedBoosts + 1);
    window.localStorage.setItem(`pulse-membership:${authEmail}`, 'plus');
    window.localStorage.setItem(`pulse-billing:${authEmail}`, billing);
    window.localStorage.setItem(`pulse-super-pulses-v3:${authEmail}`, '3');
    window.localStorage.setItem(
      `pulse-boosts:${authEmail}`,
      JSON.stringify({ week: currentWeekKey(), included: 1 }),
    );
    mirrorToServer(() =>
      serverJson('/api/billing/purchase', {
        method: 'POST',
        body: JSON.stringify({
          productId: `spikedate.plus.${billing}`,
          provider: 'mock',
          transactionId: `web-${billing}-${crypto.randomUUID()}`,
        }),
      }),
    );
    setSubscriptionOpen(false);
    announce(
      'SpikeDate+ active — Likes are unlimited and 3 Super Spikes are ready',
    );
  };

  const purchaseBoosts = (quantity: number) => {
    if (!authEmail) return;
    setPurchasedBoosts((current) => current + quantity);
    setBoostsRemaining((current) => current + quantity);
    const pack = quantity >= 10 ? 10 : quantity >= 3 ? 3 : 1;
    mirrorToServer(() =>
      serverJson('/api/billing/purchase', {
        method: 'POST',
        body: JSON.stringify({
          productId: `spikedate.lifts.${pack}`,
          provider: 'mock',
          transactionId: `web-lift-${crypto.randomUUID()}`,
        }),
      }),
    );
    announce(
      `${quantity} Profile ${quantity === 1 ? 'Lift' : 'Lifts'} added — use anytime`,
    );
  };

  const activateBoost = () => {
    if (!authEmail) return;
    if (boostsRemaining <= 0) {
      announce('Choose a Profile Lift pack to continue');
      return;
    }
    mirrorToServer(() =>
      serverJson('/api/billing/lift', {
        method: 'POST',
        body: JSON.stringify({
          source: purchasedBoosts > 0 ? 'purchased' : 'weekly',
          idempotencyKey: crypto.randomUUID(),
        }),
      }),
    );
    const endsAt = Date.now() + 30 * 60 * 1000;
    setActiveBoosts((current) => {
      const next = { ...current, [authEmail]: endsAt };
      window.localStorage.setItem('pulse-active-boosts', JSON.stringify(next));
      return next;
    });
    setBoostClock(Date.now());
    const includedRemaining = Math.max(0, boostsRemaining - purchasedBoosts);
    setBoostsRemaining((remaining) => Math.max(0, remaining - 1));
    if (includedRemaining <= 0)
      setPurchasedBoosts((remaining) => Math.max(0, remaining - 1));
    setBoostOpen(false);
    announce(
      'Profile Lift active for 30 minutes — your profile ranks higher nearby',
    );
  };

  const stopVoiceBriefing = () => {
    voiceRun.current += 1;
    window.speechSynthesis?.cancel();
    setVoicePlaying(false);
  };

  const stopVoiceListening = () => {
    voiceLiveActive.current = false;
    voiceLivePaused.current = false;
    voiceRecognition.current?.stop();
    voiceRecognition.current = null;
    setVoiceListening(false);
  };

  const stopCloudVoice = (cancel = false) => {
    cloudVoiceCanceled.current = cancel;
    const recorder = cloudVoiceRecorder.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    cloudVoiceStream.current?.getTracks().forEach((track) => track.stop());
    cloudVoiceStream.current = null;
    if (cancel) setCloudVoiceRecording(false);
  };

  const toggleCloudVoice = async () => {
    if (cloudVoiceRecording) {
      stopCloudVoice();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
      setVoiceResponse(
        'Audio recording is unavailable on this device. Use a typed command below.',
      );
      return;
    }
    stopVoiceListening();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      cloudVoiceStream.current = stream;
      cloudVoiceRecorder.current = recorder;
      cloudVoiceChunks.current = [];
      cloudVoiceCanceled.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size) cloudVoiceChunks.current.push(event.data);
      };
      recorder.onstop = async () => {
        setCloudVoiceRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        cloudVoiceStream.current = null;
        if (cloudVoiceCanceled.current) return;
        const audio = new Blob(cloudVoiceChunks.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        setVoiceResponse('Cloudflare is transcribing your request…');
        try {
          const response = await fetch('/api/voice/transcribe', {
            method: 'POST',
            headers: { 'content-type': audio.type },
            body: audio,
          });
          const result = (await response.json()) as {
            transcript?: string;
            error?: string;
          };
          if (!response.ok || !result.transcript)
            throw new Error(result.error || 'Transcription failed.');
          setVoiceMicStatus('ready');
          processVoiceCommand(result.transcript);
        } catch (error) {
          setVoiceMicStatus('unavailable');
          setVoiceResponse(
            error instanceof Error
              ? `${error.message} Use a typed command or Run voice demo.`
              : 'Cloud transcription failed. Use a typed command or Run voice demo.',
          );
        }
      };
      recorder.start();
      setCloudVoiceRecording(true);
      setVoiceResponse('Recording for Cloudflare… speak now, then tap Stop.');
    } catch {
      setVoiceMicStatus('blocked');
      setVoiceResponse(
        'Microphone access is blocked. Allow it in browser or app settings, then try again.',
      );
    }
  };

  const restartLiveRecognition = () => {
    if (!voiceLiveActive.current || voiceLivePaused.current) return;
    const recognition = voiceRecognition.current;
    if (!recognition) return;
    window.setTimeout(() => {
      if (!voiceLiveActive.current || voiceLivePaused.current) return;
      try {
        recognition.start();
        setVoiceListening(true);
        setVoiceResponse('Live conversation is listening…');
      } catch {
        setVoiceListening(false);
      }
    }, 220);
  };

  const speakVoiceResponse = (message: string) => {
    setVoiceResponse(message);
    setVoicePlaying(false);
    if (!('speechSynthesis' in window)) return;
    const resumeLive = voiceMode === 'live' && voiceLiveActive.current;
    if (resumeLive) {
      voiceLivePaused.current = true;
      voiceRecognition.current?.stop();
      setVoiceListening(false);
    }
    voiceRun.current += 1;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.96;
    utterance.pitch = 1.02;
    utterance.onend = () => {
      if (!resumeLive) return;
      voiceLivePaused.current = false;
      restartLiveRecognition();
    };
    utterance.onerror = () => {
      if (!resumeLive) return;
      voiceLivePaused.current = false;
      restartLiveRecognition();
    };
    window.speechSynthesis.speak(utterance);
  };

  const playVoiceBriefing = () => {
    if (!('speechSynthesis' in window)) {
      announce('Voice playback is not supported on this device');
      return;
    }
    const runId = voiceRun.current + 1;
    voiceRun.current = runId;
    window.speechSynthesis.cancel();
    setVoicePromptVisible(false);
    setVoicePlaying(true);
    const summary = new SpeechSynthesisUtterance(
      `Hello ${selfName}. You have ${contacts.length} matches, ${incomingLikeCount} people in Incoming, and ${unreadMessages} unread messages. This week you sent ${sentThisWeek} Spike${sentThisWeek === 1 ? '' : 's'}. You have ${superPulsesRemaining} Super Spike${superPulsesRemaining === 1 ? '' : 's'} and ${boostsRemaining} Profile Lift${boostsRemaining === 1 ? '' : 's'} remaining.`,
    );
    summary.rate = 0.96;
    summary.pitch = 1.02;
    summary.onend = () => {
      if (voiceRun.current !== runId) return;
      setVoicePromptVisible(true);
      const question = new SpeechSynthesisUtterance(
        'What would you like to review? Incoming likes, messages, Profile Lift, or your profile?',
      );
      question.rate = 0.96;
      question.onend = () => {
        if (voiceRun.current === runId) setVoicePlaying(false);
      };
      window.speechSynthesis.speak(question);
    };
    summary.onerror = () => {
      if (voiceRun.current === runId) setVoicePlaying(false);
    };
    window.speechSynthesis.speak(summary);
  };

  const chooseVoiceSchedule = (schedule: VoiceSchedule) => {
    setVoiceSchedule(schedule);
    if (authEmail)
      window.localStorage.setItem(
        `pulse-voice-schedule:${authEmail}`,
        schedule,
      );
    announce(
      schedule === 'off'
        ? 'Activity briefing schedule turned off'
        : 'Activity briefing schedule saved',
    );
  };

  const deliverVoiceMessage = (contact: ChatContact, text: string) => {
    setMessagesByContact((items) => ({
      ...items,
      [contact.name]: [
        ...(items[contact.name] ?? []),
        { id: Date.now(), text, mine: true },
      ],
    }));
    setContacts((items) =>
      items.map((item) =>
        item.name === contact.name
          ? { ...item, preview: text, time: 'Now', unread: 0 }
          : item,
      ),
    );
    if (authEmail && contact.email) {
      const stored: StoredMessage = {
        id: Date.now(),
        fromEmail: authEmail,
        toEmail: contact.email,
        text,
        createdAt: new Date().toISOString(),
      };
      setStoredMessages((items) => {
        const next = [...items, stored];
        window.localStorage.setItem('pulse-messages', JSON.stringify(next));
        return next;
      });
    }
    announce(`Message sent to ${contact.name}`);
  };

  const describeVoiceProfile = (profile: Profile, detailed = false) =>
    detailed
      ? `${profile.name} is ${profile.age}, ${profile.height}, and ${profile.ethnicity}. ${profile.intent}. ${profile.prompt} They are ${profile.drinking.toLowerCase()} about drinking, ${profile.smoking.toLowerCase()} about smoking, and said: ${profile.pets}.`
      : `${profile.name}, ${profile.age}, is in ${profile.place}, ${profile.distance}. Looking for ${profile.intent.toLowerCase()}. Interests include ${profile.tags.join(', ')}. Would you like to see pictures, hear more, like, Super Spike, or go to the next profile?`;

  const processVoiceCommand = (rawCommand: string) => {
    const command = rawCommand.trim();
    const normalized = command.toLowerCase();
    if (!command) return;
    setVoiceTranscript(command);

    if (/^(stop listening|pause listening|end conversation)$/i.test(command)) {
      stopVoiceListening();
      setVoiceResponse('Live conversation paused. Nothing was sent.');
      return;
    }

    if (pendingVoiceAction) {
      if (
        /^(yes|confirm|do it|send it|confirm like|confirm spike|confirm pulse|confirm boost|confirm lift)$/i.test(
          command,
        )
      ) {
        const action = pendingVoiceAction;
        setPendingVoiceAction(null);
        if (action.kind === 'like') {
          setVoiceOpen(false);
          completeLike(action.profile, {
            message: '',
            target: action.profile.tags[0] ?? 'Photo 1',
          });
          speakVoiceResponse(`Like sent to ${action.profile.name}.`);
          return;
        }
        if (action.kind === 'super') {
          if (superPulsesRemaining <= 0) {
            speakVoiceResponse('You have no Super Spikes remaining this week.');
            return;
          }
          recordInteraction(
            action.profile,
            'super',
            '',
            action.profile.tags[0] ?? 'Photo 1',
          );
          setSentLikes((items) =>
            items.some((item) => item.name === action.profile.name)
              ? items
              : [...items, action.profile],
          );
          setSuperPulsesRemaining((count) => Math.max(0, count - 1));
          setVoiceOpen(false);
          nextProfile();
          announce(`Super Spike sent to ${action.profile.name}`);
          speakVoiceResponse(`Super Spike sent to ${action.profile.name}.`);
          return;
        }
        if (action.kind === 'boost') {
          setVoiceOpen(false);
          activateBoost();
          speakVoiceResponse(
            membership === 'plus' && boostsRemaining > 0
              ? 'Your thirty minute Profile Lift is active.'
              : 'Profile Lift requires SpikeDate Plus or an available weekly Lift. I opened your options.',
          );
          return;
        }
        deliverVoiceMessage(action.contact, action.text);
        setVoiceOpen(false);
        speakVoiceResponse(`Message sent to ${action.contact.name}.`);
        return;
      }
      if (/^(no|cancel|never mind|don't|do not)$/i.test(command)) {
        setPendingVoiceAction(null);
        speakVoiceResponse('Canceled. Nothing was sent.');
        return;
      }
      speakVoiceResponse('Please say yes to confirm, or say cancel.');
      return;
    }

    if (
      normalized.includes('show profiles') ||
      normalized.includes("today's profiles") ||
      normalized.includes('profiles for today')
    ) {
      const first = filteredProfiles[0] ?? profiles[0];
      setTab('Pulse');
      setProfileIndex(0);
      setVoiceBrowseMode(true);
      speakVoiceResponse(describeVoiceProfile(first));
      return;
    }
    if (normalized.includes('next profile') || normalized === 'next') {
      const nextIndex = filteredProfiles.length
        ? (profileIndex + 1) % filteredProfiles.length
        : 0;
      const next = filteredProfiles[nextIndex] ?? profiles[0];
      setProfileIndex(nextIndex);
      setVoiceBrowseMode(true);
      speakVoiceResponse(describeVoiceProfile(next));
      return;
    }
    if (
      normalized.includes('show picture') ||
      normalized.includes('show photo') ||
      normalized.includes('open profile')
    ) {
      setVoiceOpen(false);
      openFullProfile(current);
      speakVoiceResponse(`Opening ${current.name}'s photos and full profile.`);
      return;
    }
    if (
      normalized.includes('read basics') ||
      normalized.includes('tell me about')
    ) {
      setVoiceBrowseMode(true);
      speakVoiceResponse(describeVoiceProfile(current));
      return;
    }
    if (
      normalized.includes('read more') ||
      normalized.includes('more details')
    ) {
      setVoiceBrowseMode(true);
      speakVoiceResponse(describeVoiceProfile(current, true));
      return;
    }
    const messageMatch = command.match(
      /(?:send )?(?:a )?message (?:to )?([a-z]+)(?: saying| say) (.+)/i,
    );
    if (messageMatch) {
      const contact = contacts.find(
        (item) => item.name.toLowerCase() === messageMatch[1].toLowerCase(),
      );
      if (!contact) {
        speakVoiceResponse(
          `I couldn't find a matched chat named ${messageMatch[1]}.`,
        );
        return;
      }
      setPendingVoiceAction({
        kind: 'message',
        contact,
        text: messageMatch[2],
      });
      speakVoiceResponse(
        `Send this message to ${contact.name}: “${messageMatch[2]}” Say yes to confirm or cancel.`,
      );
      return;
    }
    if (normalized.includes('message') || normalized.includes('chat')) {
      setVoiceOpen(false);
      handleTab('Chat');
      speakVoiceResponse('Opening your messages.');
      return;
    }
    if (normalized.includes('incoming') || normalized.includes('who liked')) {
      setVoiceOpen(false);
      setIncomingOpen(true);
      speakVoiceResponse('Opening Incoming likes and Super Spikes.');
      return;
    }
    if (
      normalized.includes('super spike') ||
      normalized.includes('send spike') ||
      normalized.includes('super pulse') ||
      normalized.includes('send pulse') ||
      normalized.includes('spark')
    ) {
      setPendingVoiceAction({ kind: 'super', profile: current });
      speakVoiceResponse(
        `Send a Super Spike to ${current.name}? Say yes to confirm or cancel.`,
      );
      return;
    }
    if (
      normalized.includes('profile lift') ||
      normalized.includes('lift my profile') ||
      normalized.includes('boost')
    ) {
      setPendingVoiceAction({ kind: 'boost', profile: current });
      speakVoiceResponse(
        'Start a thirty minute Profile Lift? Say yes to confirm or cancel.',
      );
      return;
    }
    if (normalized.includes('like')) {
      setPendingVoiceAction({ kind: 'like', profile: current });
      speakVoiceResponse(
        `Send a Like to ${current.name}? Say yes to confirm or cancel.`,
      );
      return;
    }
    if (normalized.includes('profile') && normalized.includes('my')) {
      setVoiceOpen(false);
      handleTab('Profile');
      speakVoiceResponse('Opening your profile.');
      return;
    }
    speakVoiceResponse(
      'Try saying: show profiles for today, read basics, show pictures, next profile, like, Super Spike, Profile Lift, or open messages.',
    );
  };

  const toggleVoiceListening = async () => {
    if (voiceListening) {
      stopVoiceListening();
      if (voiceMode === 'live')
        setVoiceResponse('Live conversation paused. Tap to continue.');
      return;
    }
    if (voiceMicStatus !== 'ready' && navigator.mediaDevices?.getUserMedia) {
      setVoiceMicStatus('requesting');
      setVoiceResponse('Allow microphone access to start SpikeDate Voice.');
      let permissionTimedOut = false;
      let permissionTimer = 0;
      const permissionRequest = navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      try {
        const stream = await Promise.race([
          permissionRequest,
          new Promise<never>((_, reject) => {
            permissionTimer = window.setTimeout(() => {
              permissionTimedOut = true;
              reject(new Error('Microphone permission timed out'));
            }, 7000);
          }),
        ]);
        window.clearTimeout(permissionTimer);
        stream.getTracks().forEach((track) => track.stop());
        setVoiceMicStatus('ready');
      } catch {
        window.clearTimeout(permissionTimer);
        setVoiceMicStatus(permissionTimedOut ? 'unavailable' : 'blocked');
        setVoiceResponse(
          permissionTimedOut
            ? 'The embedded preview did not provide microphone access. Open SpikeDate in Chrome or the mobile app, or use Run voice demo below.'
            : 'Microphone access is blocked. Allow it in your browser or app settings, then tap Ask SpikeDate again. Typed commands still work.',
        );
        if (permissionTimedOut)
          void permissionRequest
            .then((stream) =>
              stream.getTracks().forEach((track) => track.stop()),
            )
            .catch(() => undefined);
        return;
      }
    }
    const speechWindow = window as typeof window & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceMicStatus('unavailable');
      setVoiceResponse(
        'Speech recognition is unavailable in this browser or embedded preview. Use a command below, or test Voice in Chrome, iOS, or Android.',
      );
      return;
    }
    stopVoiceBriefing();
    const recognition = new Recognition();
    voiceRecognition.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = voiceMode === 'live';
    recognition.interimResults = voiceMode === 'live';
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      setVoiceTranscript(transcript);
      if (voiceMode === 'live' && result.isFinal === false) {
        setVoiceResponse('Listening…');
        return;
      }
      if (voiceMode !== 'live') setVoiceListening(false);
      processVoiceCommand(transcript);
    };
    recognition.onerror = (event) => {
      setVoiceListening(false);
      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed'
      ) {
        setVoiceMicStatus('blocked');
        setVoiceResponse(
          'Microphone access is blocked. Allow it in your browser or app settings, then try again. Typed commands still work.',
        );
      } else if (event.error === 'audio-capture') {
        setVoiceMicStatus('unavailable');
        setVoiceResponse(
          'No microphone was found. Connect or enable a microphone, or use the command box below.',
        );
      } else if (event.error === 'network') {
        setVoiceMicStatus('unavailable');
        setVoiceResponse(
          'The embedded device speech service could not connect. Use the Cloudflare microphone below, then tap Stop and transcribe.',
        );
      } else if (event.error === 'no-speech') {
        setVoiceMicStatus('ready');
        setVoiceResponse(
          'I did not hear speech. Tap Ask SpikeDate, wait for “Listening,” then speak close to the microphone.',
        );
      } else {
        setVoiceResponse(
          'Voice stopped unexpectedly. Tap Ask SpikeDate to retry or use a typed command.',
        );
      }
    };
    recognition.onend = () => {
      setVoiceListening(false);
      if (voiceMode === 'live') restartLiveRecognition();
    };
    voiceLiveActive.current = voiceMode === 'live';
    voiceLivePaused.current = false;
    setVoiceListening(true);
    setVoiceResponse(
      voiceMode === 'live'
        ? 'Live conversation is listening. Speak naturally or tap to pause.'
        : 'Listening…',
    );
    try {
      recognition.start();
      setVoiceMicStatus('ready');
    } catch {
      setVoiceListening(false);
      setVoiceResponse(
        'Voice is already starting. Wait a moment, then tap Ask SpikeDate again.',
      );
    }
  };

  const chooseVoiceMode = (mode: VoiceMode) => {
    if (mode === 'command' && !voiceDeployment.commandEnabled) return;
    if (mode === 'live' && !liveVoiceAvailable) return;
    stopVoiceListening();
    stopVoiceBriefing();
    setPendingVoiceAction(null);
    setVoiceMode(mode);
    setVoiceResponse(
      mode === 'live'
        ? 'Live conversation stays ready between requests. Tap Start live conversation, then speak naturally.'
        : 'Push to talk listens for one request at a time and uses the least processing.',
    );
  };

  const openVoice = () => {
    if (!voiceAvailable) return;
    if (voiceMode === 'live' && !liveVoiceAvailable)
      setVoiceMode(voiceDeployment.commandEnabled ? 'command' : 'live');
    setVoiceOpen(true);
  };

  const closeVoiceBriefing = (open: boolean) => {
    setVoiceOpen(open);
    if (!open) {
      stopVoiceListening();
      stopCloudVoice(true);
      setPendingVoiceAction(null);
      stopVoiceBriefing();
    }
  };

  const openRegistrationAt = (step: number, singleSection = true) => {
    setRegistrationStep(step);
    setRegistrationSingleSection(singleSection);
    setRegistrationOpen(true);
  };

  const restoreProfile = (email: string) => {
    try {
      const saved = window.localStorage.getItem(`pulse-registration:${email}`);
      const seeded = identityForEmail(email)?.registration;
      if (!saved && !seeded) {
        setRegistered(false);
        setSelfName('Alex');
        setRegistrationData(initialRegistration);
        return;
      }
      const savedData = saved
        ? (JSON.parse(saved) as Partial<RegistrationData>)
        : {};
      const data = normalizeRegistration({ ...seeded, ...savedData });
      if (!saved)
        window.localStorage.setItem(
          `pulse-registration:${email}`,
          JSON.stringify(data),
        );
      setSelfName(data.name || 'Alex');
      setRegistered(true);
      setRegistrationData(data);
      setFilters((value) => ({
        ...value,
        genders: data.preferredGenders,
        minAge: data.minAge,
        maxAge: data.maxAge,
        maxDistance: data.maxDistance,
        intents: data.intents,
      }));
    } catch {
      setRegistered(false);
      setSelfName('Alex');
      setRegistrationData(initialRegistration);
    }
  };

  const signIn = async (email: string, password: string) => {
    const normalized = email.trim().toLowerCase();
    if (serverDataEnabled) {
      try {
        await serverJson('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: normalized, password }),
        });
      } catch (error) {
        return (error as Error).message;
      }
      window.localStorage.setItem('pulse-session', normalized);
      const nextMembership = readMembership(normalized);
      superPulseOwner.current = normalized;
      allowanceOwner.current = normalized;
      boostOwner.current = normalized;
      setMembership(nextMembership);
      setDailyLikesRemaining(readDailyLikes(normalized));
      setSuperPulsesRemaining(readSuperPulses(normalized, nextMembership));
      setPurchasedBoosts(readPurchasedBoosts(normalized));
      setBoostsRemaining(readBoostsRemaining(normalized, nextMembership));
      setAuthEmail(normalized);
      setProfileIndex(0);
      restoreProfile(normalized);
      return null;
    }
    const account = readAccounts().find((item) => item.email === normalized);
    if (!account || account.passwordHash !== (await hashPassword(password)))
      return 'Email or password is incorrect.';
    window.localStorage.setItem('pulse-session', normalized);
    const nextMembership = readMembership(normalized);
    superPulseOwner.current = normalized;
    allowanceOwner.current = normalized;
    boostOwner.current = normalized;
    setMembership(nextMembership);
    setDailyLikesRemaining(readDailyLikes(normalized));
    setSuperPulsesRemaining(readSuperPulses(normalized, nextMembership));
    setPurchasedBoosts(readPurchasedBoosts(normalized));
    setBoostsRemaining(readBoostsRemaining(normalized, nextMembership));
    setAuthEmail(normalized);
    setProfileIndex(0);
    restoreProfile(normalized);
    return null;
  };

  const createAccount = async (
    email: string,
    password: string,
    phoneVerificationToken?: string,
  ) => {
    const normalized = email.trim().toLowerCase();
    if (serverDataEnabled) {
      try {
        await serverJson('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: normalized,
            password,
            birthDate: '1990-01-01',
            displayName: 'New member',
            gender: 'Prefer not to say',
            relationshipGoal: 'Dating',
            termsAccepted: true,
            phoneVerificationToken,
          }),
        });
      } catch (error) {
        return (error as Error).message;
      }
    }
    const accounts = readAccounts();
    if (
      !serverDataEnabled &&
      accounts.some((item) => item.email === normalized)
    )
      return 'An account already exists for this email.';
    const account: AuthAccount = {
      email: normalized,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    if (!accounts.some((item) => item.email === normalized))
      window.localStorage.setItem(
        'pulse-accounts',
        JSON.stringify([...accounts, account]),
      );
    window.localStorage.setItem('pulse-session', normalized);
    superPulseOwner.current = normalized;
    allowanceOwner.current = normalized;
    boostOwner.current = normalized;
    setMembership('free');
    setDailyLikesRemaining(10);
    setSuperPulsesRemaining(1);
    setPurchasedBoosts(0);
    setBoostsRemaining(0);
    setAuthEmail(normalized);
    setProfileIndex(0);
    setRegistered(false);
    setSelfName('Alex');
    setRegistrationData(initialRegistration);
    setRegistrationOpen(true);
    return null;
  };

  const logout = () => {
    if (serverDataEnabled)
      void serverJson('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.localStorage.removeItem('pulse-session');
    superPulseOwner.current = null;
    allowanceOwner.current = null;
    boostOwner.current = null;
    setAuthEmail(null);
    setVerificationStatus('unverified');
    setVerificationOpen(false);
    setPurchasedBoosts(0);
    setRegistered(false);
    setSelfName('Alex');
    setTab('Pulse');
    setProfileIndex(0);
    setRoom(null);
    setChatOpen(false);
    setPreviewCard(false);
    setTodayComposerOpen(false);
    setViewedDailyStory(null);
  };

  useEffect(() => {
    const saved = window.localStorage.getItem('pulse-theme');
    if (
      saved === 'default' ||
      saved === 'aurora' ||
      saved === 'velvet' ||
      saved === 'solar' ||
      saved === 'liquid' ||
      saved === 'lime'
    )
      setTheme(saved);
  }, []);

  useEffect(() => {
    if (!authEmail) {
      setSavedProfileNames([]);
      return;
    }
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(`spikedate-saved:${authEmail}`) || '[]',
      ) as string[];
      setSavedProfileNames(
        saved.filter(
          (name, index, names) =>
            typeof name === 'string' && names.indexOf(name) === index,
        ),
      );
    } catch {
      setSavedProfileNames([]);
    }
  }, [authEmail]);

  useEffect(() => {
    if (!serverDataEnabled || !authEmail) {
      setServerProfiles([]);
      setOwnProfileMedia([]);
      return;
    }
    let cancelled = false;
    void Promise.all([
      serverJson<{
        profile: Record<string, unknown> | null;
        preferences: Record<string, unknown> | null;
        media: Array<{
          id: string;
          type: 'photo' | 'video';
          url: string;
          moderation_status?: string;
        }>;
        wallet: {
          super_spikes?: number;
          profile_lifts?: number;
          weekly_lift_available?: number;
        } | null;
        subscription: { status?: string } | null;
        availability: DailyAvailability | null;
      }>('/api/profile'),
      serverJson<{
        profiles: Array<{
          id: string;
          name: string;
          age: number;
          gender?: string;
          bio?: string;
          city?: string | null;
          relationshipGoal?: string;
          imageUrl?: string | null;
          today?: string | null;
          availableTonight?: boolean;
          availability?: DailyAvailability | null;
          verified?: boolean;
        }>;
      }>('/api/discover?limit=50'),
      serverJson<{
        conversations: Array<{
          id: string;
          other_user_id: string;
          display_name: string;
          preview?: string | null;
          unread_count?: number;
          availability_local_date?: string | null;
          availability_start_at?: number | null;
          availability_end_at?: number | null;
          availability_timezone?: string | null;
        }>;
      }>('/api/conversations'),
      serverJson<{
        wallet: {
          super_spikes?: number;
          profile_lifts?: number;
          weekly_lift_available?: number;
        } | null;
        active: { ends_at?: number } | null;
      }>('/api/billing/lift'),
    ])
      .then(([account, discovery, conversationData, liftData]) => {
        if (cancelled) return;
        const wallet = liftData.wallet ?? account.wallet;
        setSuperPulsesRemaining(wallet?.super_spikes ?? 0);
        setPurchasedBoosts(wallet?.profile_lifts ?? 0);
        setBoostsRemaining(
          (wallet?.profile_lifts ?? 0) +
            (wallet?.weekly_lift_available ? 1 : 0),
        );
        setMembership(
          account.subscription?.status === 'active' ? 'plus' : 'free',
        );
        setDailyAvailability(account.availability ?? undefined);
        setOwnProfileMedia(
          account.media.map((item) => ({
            id: item.id,
            type: item.type,
            src: item.url,
            moderationStatus: item.moderation_status,
          })),
        );
        if (liftData.active?.ends_at) {
          setActiveBoosts((currentBoosts) => ({
            ...currentBoosts,
            [authEmail]: liftData.active?.ends_at ?? 0,
          }));
          setBoostClock(Date.now());
        }
        setServerProfiles(
          discovery.profiles.map((candidate, index) => {
            const known = profiles.find((item) => item.name === candidate.name);
            if (known)
              return {
                ...known,
                id: candidate.id,
                image: candidate.imageUrl || known.image,
                media: candidate.imageUrl
                  ? [{ type: 'photo', src: candidate.imageUrl }]
                  : known.media,
                age: candidate.age,
                place: candidate.city || known.place,
                intent: candidate.relationshipGoal || known.intent,
                verified: candidate.verified,
                availability: candidate.availability ?? undefined,
                tonight:
                  candidate.availability?.localDate === dateInputValue()
                    ? {
                        plan: candidate.today || 'Open to making a plan',
                        expiresAt: candidate.availability.endAt,
                      }
                    : undefined,
              };
            const gender: Gender =
              candidate.gender === 'man'
                ? 'Man'
                : candidate.gender === 'nonbinary'
                  ? 'Nonbinary'
                  : 'Woman';
            const image =
              candidate.imageUrl ||
              profiles[index % profiles.length]?.image ||
              '/imani.png';
            return {
              id: candidate.id,
              name: candidate.name,
              age: candidate.age,
              gender,
              image,
              media: [{ type: 'photo', src: image }],
              place: candidate.city || 'Nearby',
              distance: 'Nearby',
              distanceMiles: 2,
              intent: candidate.relationshipGoal || 'Dating',
              tags: [],
              prompt: candidate.bio || 'Ask me what I am looking forward to.',
              height: 'Not shared',
              ethnicity: 'Not shared',
              pets: 'Not shared',
              kids: 'Not shared',
              wantsKids: 'Not shared',
              drinking: 'Not shared',
              smoking: 'Not shared',
              verified: candidate.verified,
              availability: candidate.availability ?? undefined,
              tonight:
                candidate.availability?.localDate === dateInputValue()
                  ? {
                      plan: candidate.today || 'Open to making a plan',
                      expiresAt: candidate.availability.endAt,
                    }
                  : undefined,
            };
          }),
        );
        setContacts(
          conversationData.conversations.flatMap((conversation) => {
            const emailMatch =
              conversation.other_user_id.match(/^test-(\d{3})$/);
            const email = emailMatch
              ? `test${emailMatch[1]}@spikedate.test`
              : undefined;
            const known = email ? identityForEmail(email)?.profile : undefined;
            return [
              {
                userId: conversation.other_user_id,
                conversationId: conversation.id,
                name: conversation.display_name,
                image: known?.image ?? '/imani.png',
                email,
                preview: conversation.preview || 'You matched on SpikeDate',
                time: 'Recent',
                unread: Number(conversation.unread_count ?? 0),
                availability:
                  conversation.availability_local_date &&
                  conversation.availability_start_at &&
                  conversation.availability_end_at &&
                  conversation.availability_timezone
                    ? {
                        localDate: conversation.availability_local_date,
                        startAt: new Date(
                          Number(conversation.availability_start_at),
                        ).toISOString(),
                        endAt: new Date(
                          Number(conversation.availability_end_at),
                        ).toISOString(),
                        timezone: conversation.availability_timezone,
                      }
                    : undefined,
              },
            ];
          }),
        );
        const profile = account.profile;
        const profileText = (key: string, fallback: string) =>
          typeof profile?.[key] === 'string'
            ? (profile[key] as string)
            : fallback;
        if (profile && profileText('display_name', '') !== 'New member') {
          setSelfName(profileText('display_name', 'Alex'));
          setRegistered(Boolean(profile.completed_at || profile.bio));
          setRegistrationData((currentData) => ({
            ...currentData,
            name: profileText('display_name', currentData.name),
            bio: profileText('bio', currentData.bio),
            city: profileText('city', currentData.city),
            occupation: profileText('occupation', currentData.occupation),
            education: profileText('education', currentData.education),
          }));
        }
        if (profile)
          setVerificationStatus(
            normalizeVerificationStatus(profile.verification_status),
          );
      })
      .catch(() => announce('Server data is temporarily unavailable.'));
    return () => {
      cancelled = true;
    };
  }, [authEmail]);

  useEffect(() => {
    setDailyStories(readDailyStories());
  }, [authEmail]);

  useEffect(() => {
    if (!authEmail) return;
    const saved = window.localStorage.getItem(
      `pulse-voice-schedule:${authEmail}`,
    );
    if (
      saved === 'off' ||
      saved === 'morning' ||
      saved === 'evening' ||
      saved === 'twice'
    )
      setVoiceSchedule(saved);
    else setVoiceSchedule('morning');
  }, [authEmail]);

  useEffect(() => {
    if (!authEmail) return;
    engagementPrompted.current = false;
    setEngagementNudge(null);
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(
          `pulse-engagement-preferences:${authEmail}`,
        ) || 'null',
      ) as Partial<EngagementPreferences> | null;
      setEngagementPreferences({
        today: saved?.today ?? true,
        like: saved?.like ?? true,
        super: saved?.super ?? true,
        boost: saved?.boost ?? true,
      });
    } catch {
      setEngagementPreferences(defaultEngagementPreferences);
    }
    const savedReminderTime = window.localStorage.getItem(
      `pulse-today-reminder-time:${authEmail}`,
    );
    setTodayReminderTime(
      savedReminderTime === 'afternoon' || savedReminderTime === 'evening'
        ? savedReminderTime
        : 'morning',
    );
  }, [authEmail]);

  useEffect(() => {
    if (!authEmail) return;
    let cancelled = false;
    const local = window.localStorage.getItem(
      `spikedate-push-preferences:${authEmail}`,
    );
    if (local) {
      try {
        setPushPreferences({
          ...defaultPushPreferences,
          ...(JSON.parse(local) as Partial<PushPreferences>),
        });
      } catch {
        setPushPreferences(defaultPushPreferences);
      }
    }
    if (serverDataEnabled)
      void serverJson<{ preferences: PushPreferences }>(
        '/api/notifications/preferences',
      )
        .then(({ preferences }) => {
          if (cancelled) return;
          setPushPreferences(preferences);
          window.localStorage.setItem(
            `spikedate-push-preferences:${authEmail}`,
            JSON.stringify(preferences),
          );
        })
        .catch(() => {
          /* Retain device preferences while the server is unavailable. */
        });
    return () => {
      cancelled = true;
    };
  }, [authEmail]);

  useEffect(() => {
    if (
      !authEmail ||
      engagementPrompted.current ||
      engagementNudge ||
      tab !== 'Pulse' ||
      profileOpen ||
      noteOpen ||
      incomingOpen ||
      matchOpen ||
      subscriptionOpen ||
      boostOpen
    )
      return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      const boostDismissedAt = Number(
        window.localStorage.getItem(
          `pulse-engagement-boost-dismissed:${authEmail}`,
        ) || '0',
      );
      const likeDismissedAt = Number(
        window.localStorage.getItem(
          `pulse-engagement-like-dismissed:${authEmail}`,
        ) || '0',
      );
      const todayDismissedAt = Number(
        window.localStorage.getItem(
          `pulse-engagement-today-dismissed:${authEmail}`,
        ) || '0',
      );
      const reminderHour =
        todayReminderTime === 'evening'
          ? 18
          : todayReminderTime === 'afternoon'
            ? 12
            : 8;
      const dismissedToday =
        todayDismissedAt > 0 &&
        new Date(todayDismissedAt).toDateString() === new Date().toDateString();
      if (
        engagementPreferences.today &&
        !ownDailyStory &&
        !dismissedToday &&
        new Date().getHours() >= reminderHour
      ) {
        engagementPrompted.current = true;
        setEngagementNudge({ kind: 'today' });
        return;
      }
      if (
        engagementPreferences.boost &&
        membership === 'plus' &&
        boostsRemaining > 0 &&
        !boostActive &&
        now - boostDismissedAt > 7 * 24 * 60 * 60 * 1000
      ) {
        engagementPrompted.current = true;
        setEngagementNudge({ kind: 'boost' });
        return;
      }
      if (
        engagementPreferences.like &&
        dailyLikesRemaining > 0 &&
        now - likeDismissedAt > 24 * 60 * 60 * 1000
      ) {
        engagementPrompted.current = true;
        setEngagementNudge({ kind: 'like' });
      }
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [
    authEmail,
    boostActive,
    boostOpen,
    boostsRemaining,
    dailyLikesRemaining,
    engagementNudge,
    engagementPreferences,
    incomingOpen,
    matchOpen,
    membership,
    noteOpen,
    ownDailyStory,
    profileOpen,
    subscriptionOpen,
    tab,
    todayReminderTime,
  ]);

  useEffect(() => {
    if (!authEmail) return;
    setVoiceUserEnabled(
      window.localStorage.getItem(`pulse-voice-enabled:${authEmail}`) !==
        'false',
    );
    setVoiceLiveUserEnabled(
      window.localStorage.getItem(`pulse-voice-live:${authEmail}`) !== 'false',
    );
  }, [authEmail]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  useEffect(() => {
    if (!pendingVoiceAction) return;
    const timer = window.setTimeout(() => {
      setPendingVoiceAction(null);
      setVoiceResponse('That confirmation expired. Nothing was sent.');
    }, 30000);
    return () => window.clearTimeout(timer);
  }, [pendingVoiceAction]);

  useEffect(() => {
    if (!authEmail || superPulseOwner.current !== authEmail) return;
    window.localStorage.setItem(
      `pulse-super-pulses-v3:${authEmail}`,
      String(superPulsesRemaining),
    );
  }, [authEmail, superPulsesRemaining]);

  useEffect(() => {
    if (!authEmail || allowanceOwner.current !== authEmail) return;
    window.localStorage.setItem(
      `pulse-daily-likes:${authEmail}`,
      JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        remaining: dailyLikesRemaining,
      }),
    );
  }, [authEmail, dailyLikesRemaining]);

  useEffect(() => {
    if (!authEmail || boostOwner.current !== authEmail) return;
    window.localStorage.setItem(
      `pulse-boosts:${authEmail}`,
      JSON.stringify({
        week: currentWeekKey(),
        included: Math.max(0, boostsRemaining - purchasedBoosts),
      }),
    );
    window.localStorage.setItem(
      `pulse-purchased-boosts:${authEmail}`,
      String(purchasedBoosts),
    );
  }, [authEmail, boostsRemaining, purchasedBoosts]);

  useEffect(() => {
    const accounts = readAccounts();
    setInteractions(readInteractions());
    setStoredMessages(readStoredMessages());
    setActiveBoosts(readActiveBoosts());
    try {
      setBlockedProfiles(
        JSON.parse(
          window.localStorage.getItem('pulse-blocked-profiles') || '[]',
        ) as string[],
      );
    } catch {
      setBlockedProfiles([]);
    }
    if (serverDataEnabled) {
      void serverJson<{ user: { email: string } }>('/api/auth/session')
        .then(({ user }) => {
          const session = user.email.toLowerCase();
          window.localStorage.setItem('pulse-session', session);
          const nextMembership = readMembership(session);
          superPulseOwner.current = session;
          allowanceOwner.current = session;
          boostOwner.current = session;
          setMembership(nextMembership);
          setDailyLikesRemaining(readDailyLikes(session));
          setSuperPulsesRemaining(readSuperPulses(session, nextMembership));
          setPurchasedBoosts(readPurchasedBoosts(session));
          setBoostsRemaining(readBoostsRemaining(session, nextMembership));
          setAuthEmail(session);
          restoreProfile(session);
        })
        .catch(() => window.localStorage.removeItem('pulse-session'))
        .finally(() => setAuthReady(true));
      return;
    }
    const storedSession = window.localStorage.getItem('pulse-session');
    const session =
      storedSession === 'demo@pulse.app' ? 'demo@spikedate.app' : storedSession;
    if (session && session !== storedSession)
      window.localStorage.setItem('pulse-session', session);
    if (session && accounts.some((account) => account.email === session)) {
      const nextMembership = readMembership(session);
      superPulseOwner.current = session;
      allowanceOwner.current = session;
      boostOwner.current = session;
      setMembership(nextMembership);
      setDailyLikesRemaining(readDailyLikes(session));
      setSuperPulsesRemaining(readSuperPulses(session, nextMembership));
      setPurchasedBoosts(readPurchasedBoosts(session));
      setBoostsRemaining(readBoostsRemaining(session, nextMembership));
      setAuthEmail(session);
      restoreProfile(session);
    }
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!Object.values(activeBoosts).some((endsAt) => endsAt > Date.now()))
      return;
    const timer = window.setInterval(() => setBoostClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [activeBoosts]);

  useEffect(() => {
    if (!authEmail) return;
    if (serverDataEnabled) return;
    if (!identityForEmail(authEmail)) {
      setContacts([...chatContacts]);
      setMessagesByContact(demoChatMessages);
      return;
    }
    const matches = interactions.filter(
      (item) =>
        item.status === 'accepted' &&
        (item.fromEmail === authEmail || item.toEmail === authEmail),
    );
    const nextContacts: ChatContact[] = matches.flatMap((match) => {
      const otherEmail =
        match.fromEmail === authEmail ? match.toEmail : match.fromEmail;
      const other = identityForEmail(otherEmail);
      if (!other) return [];
      const conversation = storedMessages.filter(
        (message) =>
          (message.fromEmail === authEmail && message.toEmail === otherEmail) ||
          (message.fromEmail === otherEmail && message.toEmail === authEmail),
      );
      const latest = conversation.at(-1);
      return [
        {
          name: other.profile.name,
          image: other.profile.image,
          email: otherEmail,
          preview: latest?.text ?? 'You matched today',
          time: latest ? 'Now' : 'Today',
          active: true,
          unread: conversation.filter(
            (message) =>
              message.toEmail === authEmail &&
              message.fromEmail === otherEmail &&
              !message.readAt,
          ).length,
        },
      ];
    });
    setContacts(
      nextContacts.filter(
        (contact, index, items) =>
          items.findIndex((item) => item.email === contact.email) === index,
      ),
    );
    const nextMessages: Record<string, ChatMessage[]> = {};
    nextContacts.forEach((contact) => {
      nextMessages[contact.name] = storedMessages
        .filter(
          (message) =>
            (message.fromEmail === authEmail &&
              message.toEmail === contact.email) ||
            (message.fromEmail === contact.email &&
              message.toEmail === authEmail),
        )
        .map((message) => ({
          id: message.id,
          text: message.text,
          mine: message.fromEmail === authEmail,
        }));
    });
    setMessagesByContact(nextMessages);
  }, [authEmail, interactions, storedMessages]);

  useEffect(() => {
    if (!authEmail) {
      setDatingPlans([]);
      return;
    }
    try {
      const shared = JSON.parse(
        window.localStorage.getItem('pulse-all-plans') || '[]',
      ) as Partial<DatingPlan>[];
      const own = JSON.parse(
        window.localStorage.getItem(`pulse-plans:${authEmail}`) || '[]',
      ) as Partial<DatingPlan>[];
      const saved = (shared.length ? shared : own).filter(
        (plan) =>
          (!plan.expiresAt ||
            new Date(plan.expiresAt).getTime() > Date.now()) &&
          (plan.creatorEmail === authEmail ||
            plan.inviteeEmails?.includes(authEmail) ||
            (!plan.creatorEmail && own.some((item) => item.id === plan.id))),
      );
      setDatingPlans(
        saved.flatMap((plan) => {
          if (!plan.id || !plan.activity || !plan.day || !plan.time) return [];
          const venue =
            plan.venue ??
            ({
              id: `legacy-${plan.id}`,
              name: plan.place || 'Meeting place',
              address: plan.place || 'Confirm the address in Chat',
              neighborhood: 'Nearby',
              distance: 'Nearby',
              price: '$$',
              category: plan.activity,
              latitude: 40.7128,
              longitude: -74.006,
              provider: 'demo',
            } satisfies Venue);
          return [
            {
              id: plan.id,
              planName: plan.planName || `${plan.activity} date`,
              activity: plan.activity,
              day: plan.day,
              time: plan.time,
              durationMinutes: plan.durationMinutes || 45,
              neighborhood: plan.neighborhood || venue.neighborhood,
              venue,
              invitees: plan.invitees || [],
              inviteeEmails: plan.inviteeEmails,
              creatorEmail: plan.creatorEmail,
              status: plan.status || 'sent',
              venueOptions: plan.venueOptions?.length
                ? plan.venueOptions
                : [venue],
              venueVotes: plan.venueVotes || {},
              alternateDay: plan.alternateDay,
              alternateTime: plan.alternateTime,
              alternateSuggestedBy: plan.alternateSuggestedBy,
              safetyCheckInEnabled: plan.safetyCheckInEnabled,
              safetyCheckInMinutes: plan.safetyCheckInMinutes,
              safetyStatus: plan.safetyStatus,
              safetyAcknowledgedAt: plan.safetyAcknowledgedAt,
              expiresAt: plan.expiresAt,
            },
          ];
        }),
      );
    } catch {
      setDatingPlans([]);
    }
  }, [authEmail]);

  useEffect(() => {
    document.documentElement.dataset.pulseTheme =
      theme === 'lime' ? 'liquid' : theme;
    if (theme === 'lime') {
      document.documentElement.dataset.pulseAccent = 'lime';
    } else {
      delete document.documentElement.dataset.pulseAccent;
    }
    return () => {
      delete document.documentElement.dataset.pulseTheme;
      delete document.documentElement.dataset.pulseAccent;
    };
  }, [theme]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<typeof context.registerTool>[0]) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => undefined);
      } catch {
        /* unsupported preview */
      }
    };
    register({
      name: 'navigate_pulse',
      title: 'Navigate SpikeDate',
      description: 'Open a main area of the SpikeDate dating app.',
      inputSchema: {
        type: 'object',
        properties: {
          tab: { type: 'string', enum: ['Pulse', 'Galaxy', 'Chat', 'Profile'] },
        },
        required: ['tab'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const value = (input as { tab?: Tab }).tab;
        if (!value || !Object.keys(tabIcons).includes(value))
          throw new Error('Invalid tab');
        handleTab(value);
        return { activeTab: value };
      },
    });
    register({
      name: 'like_current_profile',
      title: 'Like current profile',
      description:
        'Like the profile currently visible in SpikeDate and open the match state.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: () => {
        completeLike(current);
        return { liked: current.name, sentToIncoming: true };
      },
    });
    return () => lifecycle.abort();
  }, [current.name]);

  if (!authReady)
    return (
      <main className="auth-shell">
        <div className="auth-loading">
          <BrandHeartMark size={34} />
          Loading SpikeDate…
        </div>
      </main>
    );
  if (!authEmail)
    return <AuthScreen onSignIn={signIn} onCreate={createAccount} />;

  return (
    <main className="app-shell" data-theme={theme}>
      <div className="phone-frame">
        <button
          className={`global-boost-button ${tab === 'Pulse' ? 'with-incoming' : ''}`}
          aria-label={
            boostActive ? 'View active Profile Lift' : 'Lift my profile'
          }
          onClick={() => setBoostOpen(true)}
        >
          <ProfileLiftMark size={21} />
          <span className="sr-only">
            {boostActive
              ? 'Profile Lift active'
              : `${boostsRemaining} Profile Lifts left`}
          </span>
        </button>
        {tab === 'Pulse' && (
          <DiscoverHeader
            onIncoming={() => setIncomingOpen(true)}
            onFilters={() => setFilterOpen(true)}
            onVoice={openVoice}
            voiceEnabled={voiceAvailable}
            activeFilterCount={activeFilterCount}
            incomingLikeCount={incomingLikeCount}
          />
        )}
        {tab === 'Pulse' &&
          (filteredProfiles.length ? (
            <DiscoverScreen
              profile={current}
              story={storyForProfile(current)}
              todayCount={visibleDailyStories.length}
              todayActive={Boolean(ownDailyStory || dailyAvailability)}
              onOpen={() => openFullProfile(current)}
              onOpenStory={openDailyStory}
              onSeeAllToday={() => setTodayFeedOpen(true)}
              onPostToday={() =>
                ownDailyStory ? openEditToday(ownDailyStory) : openNewToday()
              }
              onPass={nextProfile}
              onLike={() => openNote('like', current)}
              onPriority={() => openNote('super', current)}
              onTonight={() => openNote('super', current)}
              saved={savedProfileNames.includes(current.name)}
              onToggleSaved={() => toggleSavedProfile(current)}
            />
          ) : (
            <EmptyDiscover onFilters={() => setFilterOpen(true)} />
          ))}
        {tab === 'Galaxy' && !room && (
          <RoomsHub
            onOpenRoom={setRoom}
            onCreatePlan={openPlanBuilder}
            plans={datingPlans}
            onDirections={openPlanDirections}
            onCalendar={addPlanToCalendar}
            onSharePlan={shareDatingPlan}
            onCancelPlan={cancelDatingPlan}
            viewerEmail={authEmail}
            onRespondPlan={respondToDatingPlan}
            onSuggestPlan={suggestPlanChange}
            onAcceptAlternate={acceptAlternatePlan}
            onVoteVenue={voteForPlanVenue}
            onMarkSafe={markPlanSafe}
            onSafetyOptions={openPlanSafety}
          />
        )}
        {tab === 'Galaxy' && room && (
          <RoomStack
            room={room}
            profile={current}
            onBack={() => setRoom(null)}
            onOpen={() => openFullProfile(current)}
            onPass={nextProfile}
            onLike={() => openNote('like', current)}
            onPriority={() => openNote('super', current)}
          />
        )}
        {tab === 'Chat' && !chatOpen && (
          <ChatList
            contacts={contacts}
            onBrowse={() => handleTab('Pulse')}
            onOpen={openExistingChat}
            onProfile={(contact) => {
              const profile = allProfiles.find(
                (item) => item.name === contact.name,
              );
              if (profile) openFullProfile(profile);
            }}
          />
        )}
        {tab === 'Chat' && chatOpen && (
          <ChatThread
            contact={activeChat}
            messages={activeMessages}
            plan={datingPlans.find(
              (plan) =>
                plan.invitees.includes(activeChat.name) &&
                plan.status !== 'declined' &&
                plan.status !== 'cancelled',
            )}
            composer={composer}
            onComposer={setComposer}
            onSend={sendMessage}
            onSendPreset={sendMessage}
            onPlan={() => openPlanBuilder('Coffee')}
            onBack={() => setChatOpen(false)}
            onProfile={() => {
              const profile = allProfiles.find(
                (item) => item.name === activeChat.name,
              );
              if (profile) openFullProfile(profile);
            }}
            onSafety={() => {
              const profile = allProfiles.find(
                (item) => item.name === activeChat.name,
              );
              if (profile) openProfileSafety(profile);
            }}
            onUnsend={(id) =>
              setMessagesByContact((items) => ({
                ...items,
                [activeChat.name]: (items[activeChat.name] ?? []).filter(
                  (item) => item.id !== id,
                ),
              }))
            }
            onPlanDirections={openPlanDirections}
            onPlanCalendar={addPlanToCalendar}
            onPlanShare={shareDatingPlan}
            onPlanRespond={respondToDatingPlan}
            onPlanSuggest={suggestPlanChange}
            viewerEmail={authEmail}
          />
        )}
        {tab === 'Profile' && !previewCard && (
          <YourProfile
            name={selfName}
            email={authEmail}
            image={ownProfileImage}
            details={registrationData}
            registered={registered}
            theme={theme}
            availability={dailyAvailability}
            onPreview={() => setPreviewCard(true)}
            onRegistration={() => openRegistrationAt(0, false)}
            onEditSection={openRegistrationAt}
            onTheme={() => setThemeOpen(true)}
            onSubscription={() => setSubscriptionOpen(true)}
            verificationStatus={verificationStatus}
            onVerification={() => setVerificationOpen(true)}
            superPulsesRemaining={superPulsesRemaining}
            membership={membership}
            dailyLikesRemaining={dailyLikesRemaining}
            engagementPreferences={engagementPreferences}
            onEngagementPreference={updateEngagementPreference}
            pushPreferences={pushPreferences}
            onPushPreference={updatePushPreference}
            onQuietHours={updateQuietHours}
            todayReminderTime={todayReminderTime}
            onTodayReminderTime={updateTodayReminderTime}
            onVoice={openVoice}
            voiceDeploymentEnabled={voiceDeployment.enabled}
            voiceEnabled={voiceUserEnabled}
            onVoiceEnabled={(checked) => {
              setVoiceUserEnabled(checked);
              window.localStorage.setItem(
                `pulse-voice-enabled:${authEmail}`,
                String(checked),
              );
              if (!checked) closeVoiceBriefing(false);
            }}
            onLogout={logout}
            todayStory={ownDailyStory}
            onCreateToday={openNewToday}
            onEditToday={openEditToday}
            onDeleteToday={deleteOwnDailyStory}
          />
        )}
        {tab === 'Profile' && previewCard && (
          <ProfilePreview
            name={selfName}
            sourceProfile={signedInIdentity?.profile}
            media={effectiveOwnMedia}
            details={registrationData}
            onBack={() => setPreviewCard(false)}
          />
        )}
        <TabBar
          active={tab}
          onChange={handleTab}
          unreadCount={unreadMessages}
        />
        {engagementNudge && (
          <EngagementPrompt
            nudge={engagementNudge}
            membership={membership}
            boostsRemaining={boostsRemaining}
            dailyLikesRemaining={dailyLikesRemaining}
            superPulsesRemaining={superPulsesRemaining}
            profileCount={Math.min(3, filteredProfiles.length)}
            onDismiss={dismissEngagementNudge}
            onAction={useEngagementNudge}
          />
        )}
      </div>

      <FullProfile
        profile={selectedProfile ?? current}
        open={profileOpen}
        onOpenChange={closeOrUpdateFullProfile}
        onPass={nextProfile}
        onLike={() => openNote('like', selectedProfile ?? current)}
        onPriority={() => openNote('super', selectedProfile ?? current)}
        onShare={() => shareProfile(selectedProfile ?? current)}
        onReport={() => openProfileSafety(selectedProfile ?? current, 'report')}
        onBlock={() => openProfileSafety(selectedProfile ?? current, 'block')}
        saved={savedProfileNames.includes((selectedProfile ?? current).name)}
        onToggleSaved={() => toggleSavedProfile(selectedProfile ?? current)}
        todayActive={Boolean(ownDailyStory || dailyAvailability)}
        onPostToday={() => {
          setProfileOpen(false);
          if (ownDailyStory) openEditToday(ownDailyStory);
          else openNewToday();
        }}
      />
      <NoteDialog
        profile={actionProfile}
        mode={noteMode}
        open={noteOpen}
        onOpenChange={setNoteOpen}
        target={noteTarget}
        onTarget={setNoteTarget}
        message={noteMessage}
        onMessage={setNoteMessage}
        remaining={superPulsesRemaining}
        onSend={sendNoteAction}
        onCancel={() => setNoteOpen(false)}
      />
      <Incoming
        open={incomingOpen}
        onOpenChange={setIncomingOpen}
        sentLikes={
          signedInIdentity
            ? accountSentLikes
            : sentLikes.map((profile) => ({
                profile,
                status:
                  profile.name === 'Maya'
                    ? ('accepted' as const)
                    : ('pending' as const),
              }))
        }
        incomingRows={signedInIdentity ? accountIncomingRows : undefined}
        declined={declinedIncoming}
        onLikeBack={likeBack}
        onPass={(name, interactionId) => {
          if (interactionId)
            saveInteractions((current) =>
              current.map((item) =>
                item.id === interactionId
                  ? { ...item, status: 'declined' }
                  : item,
              ),
            );
          setDeclinedIncoming((items) => [...items, name]);
          announce(`${name} marked Not for me`);
        }}
        onMessage={(profile) => openChatWith('', profile)}
        onProfile={openFullProfile}
        savedProfiles={savedProfiles}
        onToggleSaved={toggleSavedProfile}
        membership={membership}
        onUpgrade={() => {
          setIncomingOpen(false);
          setSubscriptionOpen(true);
        }}
        onBrowse={() => {
          setIncomingOpen(false);
          handleTab('Pulse');
        }}
      />
      <MatchModal
        open={matchOpen}
        onOpenChange={setMatchOpen}
        profile={matchProfile}
        room={room}
        onIcebreaker={(text) => openChatWith(text, matchProfile)}
        onBrowse={() => {
          setMatchOpen(false);
          nextProfile();
        }}
      />
      <SafetyDialog
        open={safetyOpen}
        onOpenChange={setSafetyOpen}
        profile={safetyProfile}
        mode={safetyMode}
        onAction={announce}
        onReport={() => reportProfile(safetyProfile)}
        onBlock={() => blockProfile(safetyProfile)}
      />
      <RegistrationDialog
        open={registrationOpen}
        onOpenChange={setRegistrationOpen}
        onComplete={completeRegistration}
        initialData={registrationData}
        initialStep={registrationStep}
        editing={registered}
        singleSection={registrationSingleSection}
        media={effectiveOwnMedia}
        onAddPhoto={addProfilePhoto}
        onAddVideo={addProfileVideo}
        onMakeMainPhoto={makeMainProfilePhoto}
        onRemovePhoto={removeProfilePhoto}
      />
      <PhotoVerificationDialog
        open={verificationOpen}
        onOpenChange={setVerificationOpen}
        status={verificationStatus}
        serverEnabled={serverDataEnabled}
        accountKey={authEmail ?? 'signed-out'}
        onStatusChange={(next) => {
          setVerificationStatus(next);
          announce(
            next === 'photo_verified' || next === 'identity_verified'
              ? 'Your profile is Photo Verified'
              : next === 'needs_review'
                ? 'Your camera check is ready for review'
                : 'Photo verification updated',
          );
        }}
      />
      <FilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        membership={membership}
        onUpgrade={() => {
          setFilterOpen(false);
          setSubscriptionOpen(true);
        }}
        onApply={(next) => {
          setFilters(next);
          setProfileIndex(0);
          setFilterOpen(false);
          announce('Preferences applied');
        }}
      />
      {datePlansEnabled && (
        <PlanDialog
          open={planOpen}
          onOpenChange={setPlanOpen}
          activity={planActivity}
          matchedContacts={contacts}
          onSend={sendPlanInvites}
        />
      )}
      <PlanSafetyDialog
        open={planSafetyOpen}
        onOpenChange={setPlanSafetyOpen}
        plan={safetyPlan}
        onShare={shareDatingPlan}
        onEnd={endDatingPlan}
      />
      <TodayComposerDialog
        open={todayComposerOpen}
        onOpenChange={(open) => {
          setTodayComposerOpen(open);
          if (!open) setTodayComposerStory(null);
        }}
        existing={todayComposerStory ?? undefined}
        replacing={Boolean(ownDailyStory && !todayComposerStory)}
        profileImage={ownProfileImage}
        existingAvailability={dailyAvailability}
        onPublish={publishDailyStory}
      />
      <TodayFeedDialog
        open={todayFeedOpen}
        stories={visibleDailyStories}
        viewerEmail={authEmail}
        onOpenChange={setTodayFeedOpen}
        onOpenStory={(story) => {
          setTodayFeedOpen(false);
          openDailyStory(story);
        }}
      />
      <TodayViewerDialog
        story={viewedDailyStory}
        viewerEmail={authEmail}
        onOpenChange={(open) => {
          if (!open) setViewedDailyStory(null);
        }}
        onLike={(story) => reactToDailyStory(story, 'like')}
        onSuper={(story) => reactToDailyStory(story, 'super')}
        onReply={replyToDailyStory}
        onProfile={(story) => {
          const profile = identityForEmail(story.authorEmail)?.profile;
          setViewedDailyStory(null);
          if (profile) openFullProfile(profile);
        }}
        onEdit={openEditToday}
        onDelete={deleteOwnDailyStory}
      />
      <SubscriptionDialog
        open={subscriptionOpen}
        onOpenChange={setSubscriptionOpen}
        membership={membership}
        dailyLikesRemaining={dailyLikesRemaining}
        superPulsesRemaining={superPulsesRemaining}
        onChoose={choosePulsePlus}
      />
      <BoostDialog
        open={boostOpen}
        onOpenChange={setBoostOpen}
        membership={membership}
        boostsRemaining={boostsRemaining}
        activeUntil={ownBoostEndsAt}
        now={boostClock}
        onActivate={activateBoost}
        onPurchase={purchaseBoosts}
        onUpgrade={() => {
          setBoostOpen(false);
          setSubscriptionOpen(true);
        }}
      />
      <VoiceBriefingDialog
        open={voiceOpen}
        onOpenChange={closeVoiceBriefing}
        name={selfName}
        matchCount={contacts.length}
        incomingLikeCount={incomingLikeCount}
        unreadMessages={unreadMessages}
        sentThisWeek={sentThisWeek}
        superPulsesRemaining={superPulsesRemaining}
        boostsRemaining={boostsRemaining}
        mode={voiceMode}
        onMode={chooseVoiceMode}
        commandEnabled={voiceDeployment.commandEnabled}
        liveEnabled={liveVoiceAvailable}
        testMode={voiceDeployment.testMode}
        cloudEnabled={voiceDeployment.cloudEnabled}
        schedule={voiceSchedule}
        onSchedule={chooseVoiceSchedule}
        playing={voicePlaying}
        promptVisible={voicePromptVisible}
        listening={voiceListening}
        micStatus={voiceMicStatus}
        cloudRecording={cloudVoiceRecording}
        transcript={voiceTranscript}
        response={voiceResponse}
        browseMode={voiceBrowseMode}
        profile={current}
        onPlay={playVoiceBriefing}
        onStop={stopVoiceBriefing}
        onListen={toggleVoiceListening}
        onCloudListen={toggleCloudVoice}
        onTranscript={setVoiceTranscript}
        onCommand={processVoiceCommand}
        onIncoming={() => {
          closeVoiceBriefing(false);
          setIncomingOpen(true);
        }}
        onMessages={() => {
          closeVoiceBriefing(false);
          handleTab('Chat');
        }}
        onBoost={() => {
          closeVoiceBriefing(false);
          setBoostOpen(true);
        }}
        onProfile={() => {
          closeVoiceBriefing(false);
          handleTab('Profile');
        }}
      />
      <ThemeDialog
        open={themeOpen}
        onOpenChange={setThemeOpen}
        selected={theme}
        onChoose={chooseTheme}
      />
      <div
        className={`toast ${toast ? 'show' : ''}`}
        role="status"
        aria-live="polite"
      >
        <BrandHeartMark size={18} />
        {toast}
      </div>
    </main>
  );
}

function TodayComposerDialog({
  open,
  onOpenChange,
  existing,
  replacing,
  profileImage,
  existingAvailability,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: DailyStory;
  replacing: boolean;
  profileImage: string;
  existingAvailability?: DailyAvailability;
  onPublish: (
    draft: DailyStoryDraft,
    storyId?: string,
    availability?: DailyAvailability | null,
  ) => Promise<string | undefined>;
}) {
  const [prompt, setPrompt] = useState(todayPrompts[0]);
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | undefined>();
  const [visibility, setVisibility] =
    useState<DailyStoryVisibility>('discover');
  const [repliesEnabled, setRepliesEnabled] = useState(true);
  const [mediaError, setMediaError] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [availabilityChoice, setAvailabilityChoice] =
    useState<TodayAvailabilityChoice>('none');
  const [availableDay, setAvailableDay] = useState(dateInputValue());
  const [availableFrom, setAvailableFrom] = useState('19:00');
  const [availableUntil, setAvailableUntil] = useState('22:00');
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const savedDraft = !existing
      ? window.localStorage.getItem('spikedate-today-draft')
      : null;
    const parsedDraft = savedDraft
      ? (JSON.parse(savedDraft) as Partial<DailyStoryDraft>)
      : null;
    setPrompt(existing?.prompt || parsedDraft?.prompt || todayPrompts[0]);
    setCaption(existing?.caption || parsedDraft?.caption || '');
    setMediaUrl(existing?.mediaUrl || parsedDraft?.mediaUrl);
    setVisibility(
      existing?.visibility || parsedDraft?.visibility || 'discover',
    );
    setRepliesEnabled(
      existing?.repliesEnabled ?? parsedDraft?.repliesEnabled ?? true,
    );
    setMediaError('');
    setCropFile(null);
    setCropOpen(false);
    const activeAvailability =
      existingAvailability &&
      new Date(existingAvailability.endAt).getTime() > Date.now()
        ? existingAvailability
        : undefined;
    setAvailabilityChoice(
      !activeAvailability
        ? 'none'
        : activeAvailability.localDate === dateInputValue()
          ? 'tonight'
          : activeAvailability.localDate === dateInputValue(1)
            ? 'tomorrow'
            : 'custom',
    );
    setAvailableDay(activeAvailability?.localDate ?? dateInputValue());
    setAvailableFrom(
      activeAvailability
        ? availabilityTimeInput(activeAvailability.startAt)
        : '19:00',
    );
    setAvailableUntil(
      activeAvailability
        ? availabilityTimeInput(activeAvailability.endAt)
        : '22:00',
    );
    setSubmitError('');
    setSaving(false);
  }, [existing, existingAvailability, open]);

  useEffect(() => {
    if (!open || existing) return;
    window.localStorage.setItem(
      'spikedate-today-draft',
      JSON.stringify({ prompt, caption, mediaUrl, visibility, repliesEnabled }),
    );
  }, [caption, existing, mediaUrl, open, prompt, repliesEnabled, visibility]);

  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMediaError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setMediaError('Choose a photo smaller than 15 MB.');
      return;
    }
    setCropFile(file);
    setCropOpen(true);
    setMediaError('');
  };

  const chooseAvailability = (choice: TodayAvailabilityChoice) => {
    setAvailabilityChoice(choice);
    if (choice === 'tonight') setAvailableDay(dateInputValue());
    if (choice === 'tomorrow') setAvailableDay(dateInputValue(1));
    setSubmitError('');
  };

  const submitToday = async () => {
    let availability: DailyAvailability | null = null;
    if (availabilityChoice !== 'none') {
      const startAt = new Date(`${availableDay}T${availableFrom}:00`);
      const endAt = new Date(`${availableDay}T${availableUntil}:00`);
      if (
        !availableDay ||
        !availableFrom ||
        !availableUntil ||
        !Number.isFinite(startAt.getTime()) ||
        endAt <= startAt ||
        endAt.getTime() <= Date.now()
      ) {
        setSubmitError('Choose an upcoming end time after your start time.');
        return;
      }
      availability = {
        localDate: availableDay,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      };
    }
    setSaving(true);
    const message = await onPublish(
      {
        mediaUrl,
        caption: caption.trim(),
        prompt,
        visibility,
        repliesEnabled,
      },
      existing?.id,
      availability,
    );
    setSaving(false);
    if (message) setSubmitError(message);
    else window.localStorage.removeItem('spikedate-today-draft');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="today-composer-dialog">
        <button
          type="button"
          className="match-close"
          aria-label="Close Today composer"
          onClick={() => onOpenChange(false)}
        >
          <X size={19} />
        </button>
        <p className="today-kicker">TODAY · 24 HOURS</p>
        <DialogTitle>
          {existing
            ? 'Edit your Today'
            : replacing
              ? 'Post a new Today'
              : 'Share your Today'}
        </DialogTitle>
        <DialogDescription>
          {existing
            ? 'Update the post without resetting its views or expiration time.'
            : replacing
              ? 'This replaces your current post and starts a fresh 24-hour window.'
              : 'Give people a natural reason to start a conversation.'}
        </DialogDescription>

        <div className="today-composer-preview">
          <Image
            src={mediaUrl || profileImage}
            alt="Today preview"
            fill
            sizes="150px"
            className="profile-photo"
          />
          <label className="today-photo-picker">
            <Camera size={17} /> {mediaUrl ? 'Change photo' : 'Add photo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              aria-label="Choose Today photo"
              onChange={(event) => choosePhoto(event.target.files?.[0])}
            />
          </label>
          {mediaUrl && (
            <button
              type="button"
              className="today-photo-remove"
              onClick={() => setMediaUrl(undefined)}
            >
              <Trash2 size={14} /> Remove
            </button>
          )}
        </div>
        {mediaError && <p className="today-media-error">{mediaError}</p>}

        <PhotoCropper
          file={cropFile}
          open={cropOpen}
          onOpenChange={setCropOpen}
          onConfirm={async (photo) => {
            setMediaUrl(await blobToDataUrl(photo.blob));
            setMediaError(
              photo.lowResolution
                ? 'This photo may look soft. A higher-resolution original is recommended.'
                : '',
            );
          }}
        />

        <label className="today-field">
          Daily prompt
          <select
            aria-label="Today prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          >
            {todayPrompts.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="today-field">
          Your update
          <textarea
            aria-label="Today update"
            value={caption}
            maxLength={140}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Example: Attempting homemade pasta tonight 🍝"
          />
          <small>{caption.length}/140</small>
        </label>
        <section className="today-availability-composer">
          <header>
            <span>
              <CalendarDays size={17} />
              <span>
                <strong>When are you available?</strong>
                <small>Optional · shown only to mutual matches</small>
              </span>
            </span>
          </header>
          <div
            className="today-availability-choices"
            role="group"
            aria-label="Today availability"
          >
            {(
              [
                ['none', 'Not available'],
                ['tonight', 'Tonight'],
                ['tomorrow', 'Tomorrow'],
                ['custom', 'Choose date'],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={availabilityChoice === value ? 'selected' : ''}
                aria-pressed={availabilityChoice === value}
                onClick={() => chooseAvailability(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {availabilityChoice !== 'none' && (
            <div className="today-availability-fields">
              {availabilityChoice === 'custom' && (
                <label>
                  Date
                  <input
                    type="date"
                    aria-label="Available date"
                    value={availableDay}
                    min={dateInputValue()}
                    max={dateInputValue(7)}
                    onChange={(event) => setAvailableDay(event.target.value)}
                  />
                </label>
              )}
              <div>
                <label>
                  From
                  <input
                    type="time"
                    aria-label="Available from"
                    value={availableFrom}
                    onChange={(event) => setAvailableFrom(event.target.value)}
                  />
                </label>
                <label>
                  Until
                  <input
                    type="time"
                    aria-label="Available until"
                    value={availableUntil}
                    onChange={(event) => setAvailableUntil(event.target.value)}
                  />
                </label>
              </div>
            </div>
          )}
          <p>
            <ShieldCheck size={15} /> Your time is shared without your current
            or home location.
          </p>
        </section>
        <label className="today-field">
          Who can see this?
          <select
            aria-label="Today visibility"
            value={visibility}
            onChange={(event) =>
              setVisibility(event.target.value as DailyStoryVisibility)
            }
          >
            <option value="discover">People matching my preferences</option>
            <option value="liked">Only people I liked</option>
            <option value="matches">Matches only</option>
          </select>
        </label>
        <div className="today-replies-control">
          <span>
            <strong>Allow replies</strong>
            <small>Unmatched replies arrive as introductions.</small>
          </span>
          <Switch
            checked={repliesEnabled}
            onCheckedChange={setRepliesEnabled}
            aria-label="Allow Today replies"
          />
        </div>
        <button
          type="button"
          className="primary-button today-publish-button"
          disabled={
            saving ||
            (!caption.trim() &&
              !mediaUrl &&
              availabilityChoice === 'none' &&
              !existingAvailability)
          }
          onClick={submitToday}
        >
          <Send size={17} />
          {saving
            ? 'Sharing…'
            : existing || existingAvailability
              ? 'Save Today'
              : replacing
                ? 'Share new Today'
                : 'Share Today'}
        </button>
        {submitError && <p className="today-submit-error">{submitError}</p>}
      </DialogContent>
    </Dialog>
  );
}

function TodayFeedDialog({
  open,
  stories,
  viewerEmail,
  onOpenChange,
  onOpenStory,
}: {
  open: boolean;
  stories: DailyStory[];
  viewerEmail: string | null;
  onOpenChange: (open: boolean) => void;
  onOpenStory: (story: DailyStory) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="today-feed-dialog">
        <header className="today-feed-header">
          <span>
            <small>FRESH FOR 24 HOURS</small>
            <DialogTitle>Today</DialogTitle>
            <DialogDescription>
              {stories.length} active{' '}
              {stories.length === 1 ? 'update' : 'updates'}
            </DialogDescription>
          </span>
          <button
            type="button"
            aria-label="Close all Today updates"
            onClick={() => onOpenChange(false)}
          >
            <X size={19} />
          </button>
        </header>
        <div className="today-feed-list">
          {stories.map((story) => {
            const own = story.authorEmail === viewerEmail;
            const hoursLeft = Math.max(
              1,
              Math.ceil(
                (new Date(story.expiresAt).getTime() - Date.now()) /
                  (60 * 60 * 1000),
              ),
            );
            const image =
              story.mediaUrl ||
              identityForEmail(story.authorEmail)?.profile.image;
            return (
              <button
                type="button"
                key={story.id}
                onClick={() => onOpenStory(story)}
                aria-label={`View ${own ? 'your' : story.authorName + "'s"} Today update`}
              >
                <span className="today-feed-avatar">
                  {image ? (
                    <Image src={image} alt="" fill sizes="62px" />
                  ) : (
                    <ProfileSpikeBadge compact />
                  )}
                </span>
                <span className="today-feed-copy">
                  <small>
                    {own ? 'YOU' : story.authorName} · {hoursLeft}h left
                  </small>
                  <strong>{story.caption}</strong>
                  <em>{story.prompt}</em>
                </span>
                <ChevronRight size={18} />
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TodayViewerDialog({
  story,
  viewerEmail,
  onOpenChange,
  onLike,
  onSuper,
  onReply,
  onProfile,
  onEdit,
  onDelete,
}: {
  story: DailyStory | null;
  viewerEmail: string | null;
  onOpenChange: (open: boolean) => void;
  onLike: (story: DailyStory) => void;
  onSuper: (story: DailyStory) => void;
  onReply: (story: DailyStory, message: string) => void;
  onProfile: (story: DailyStory) => void;
  onEdit: (story: DailyStory) => void;
  onDelete: () => void;
}) {
  const [reply, setReply] = useState('');
  useEffect(() => setReply(''), [story?.id]);
  if (!story) return null;
  const own = story.authorEmail === viewerEmail;
  const hoursLeft = Math.max(
    1,
    Math.ceil(
      (new Date(story.expiresAt).getTime() - Date.now()) / (60 * 60 * 1000),
    ),
  );
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="today-viewer-dialog">
        {story.mediaUrl ? (
          <Image
            src={story.mediaUrl}
            alt={`${story.authorName}'s Today post`}
            fill
            priority
            sizes="(max-width: 480px) 100vw, 410px"
            className="today-viewer-media"
          />
        ) : (
          <div className="today-viewer-gradient" />
        )}
        <div className="today-viewer-scrim" />
        <header className="today-viewer-header">
          <button type="button" onClick={() => onProfile(story)}>
            <span className="today-viewer-avatar">
              {story.mediaUrl ? (
                <Image src={story.mediaUrl} alt="" fill sizes="38px" />
              ) : (
                <ProfileSpikeBadge compact />
              )}
            </span>
            <span>
              <strong>{own ? 'Your Today' : story.authorName}</strong>
              <small>{hoursLeft}h left · Tap for profile</small>
            </span>
          </button>
          <button
            type="button"
            aria-label="Close Today post"
            onClick={() => onOpenChange(false)}
          >
            <X size={20} />
          </button>
        </header>
        <div className="today-viewer-copy">
          <small>{story.prompt}</small>
          <h2>{story.caption}</h2>
        </div>
        {own ? (
          <div className="today-owner-actions">
            <span>{story.viewedBy.length} unique views</span>
            <button type="button" onClick={() => onEdit(story)}>
              <Edit3 size={16} /> Edit
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Delete this Today post? It will disappear for everyone.',
                  )
                )
                  onDelete();
              }}
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        ) : (
          <div className="today-viewer-actions">
            <button type="button" onClick={() => onLike(story)}>
              <BrandHeartMark size={20} /> Like
            </button>
            <button type="button" onClick={() => onSuper(story)}>
              <SuperSpikeMark size={20} /> Super Spike
            </button>
            {story.repliesEnabled && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (reply.trim()) onReply(story, reply);
                }}
              >
                <input
                  aria-label="Reply to Today post"
                  value={reply}
                  maxLength={140}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Reply to this Today…"
                />
                <button type="submit" aria-label="Send Today reply">
                  <Send size={18} />
                </button>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DiscoverHeader({
  onIncoming,
  onFilters,
  onVoice,
  voiceEnabled,
  activeFilterCount,
  incomingLikeCount,
}: {
  onIncoming: () => void;
  onFilters: () => void;
  onVoice: () => void;
  voiceEnabled: boolean;
  activeFilterCount: number;
  incomingLikeCount: number;
}) {
  return (
    <header className="topbar">
      <button
        className="filter-button"
        aria-label="Filter profiles"
        onClick={onFilters}
      >
        <SlidersHorizontal size={21} />
        {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
      </button>
      {voiceEnabled && (
        <button
          className="voice-briefing-button"
          aria-label="Open activity briefing"
          onClick={onVoice}
        >
          <Volume2 size={20} />
        </button>
      )}
      <SpikeDateWordmark context="header" />
      <button
        className="incoming-button"
        aria-label={
          incomingLikeCount > 0
            ? `Open likes center, ${incomingLikeCount} new ${incomingLikeCount === 1 ? 'like' : 'likes'}`
            : 'Open likes center'
        }
        onClick={onIncoming}
      >
        <BrandHeartMark size={25} />
        {incomingLikeCount > 0 && (
          <span className="notification-dot" aria-hidden="true">
            {incomingLikeCount > 9 ? '9+' : incomingLikeCount}
          </span>
        )}
      </button>
    </header>
  );
}

function SpikeDateWordmark({ context }: { context: 'header' | 'auth' }) {
  return (
    <span
      className={`brand-wordmark ${context} ${context === 'header' ? 'wordmark' : ''}`}
      aria-label="SpikeDate"
    >
      <BrandHeartMark size={40} className="brand-symbol" />
      <span className="brand-spike-text">
        Sp
        <span className="brand-spike-i">
          ı<span aria-hidden="true" />
        </span>
        ke
      </span>
      <span className="brand-date">Date</span>
    </span>
  );
}

function EmptyDiscover({ onFilters }: { onFilters: () => void }) {
  return (
    <section className="empty-discover">
      <SlidersHorizontal size={30} />
      <h1>No profiles match yet</h1>
      <p>Try widening your age, distance or lifestyle preferences.</p>
      <button className="primary-button" onClick={onFilters}>
        Adjust preferences
      </button>
    </section>
  );
}

function DiscoverScreen({
  profile,
  story,
  todayCount,
  todayActive,
  onOpen,
  onOpenStory,
  onSeeAllToday,
  onPostToday,
  onPass,
  onLike,
  onPriority,
  onTonight,
  saved,
  onToggleSaved,
}: {
  profile: Profile;
  story?: DailyStory;
  todayCount: number;
  todayActive: boolean;
  onOpen: () => void;
  onOpenStory: (story: DailyStory) => void;
  onSeeAllToday: () => void;
  onPostToday: () => void;
  onPass: () => void;
  onLike: () => void;
  onPriority: () => void;
  onTonight: () => void;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  return (
    <section className="discover-screen" aria-label="SpikeDate profiles">
      <ProfileCard
        profile={profile}
        story={story}
        onOpen={onOpen}
        onOpenStory={onOpenStory}
        onTonight={onTonight}
        onSwipeLeft={onPass}
        onSwipeRight={onLike}
      />
      <div className="home-action-rail" aria-label="Profile actions">
        <button onClick={onPass} aria-label={`Pass on ${profile.name}`}>
          <X size={21} />
        </button>
        <button
          className="like"
          onClick={onLike}
          aria-label={`Like ${profile.name}`}
        >
          <BrandHeartMark size={20} />
        </button>
        <button
          className="super"
          onClick={onPriority}
          aria-label={`Send ${profile.name} a Super Spike`}
        >
          <SuperSpikeMark size={21} />
        </button>
        <button
          className={saved ? 'saved' : ''}
          onClick={onToggleSaved}
          aria-label={
            saved
              ? `Remove ${profile.name} from Saved`
              : `Save ${profile.name} privately`
          }
          aria-pressed={saved}
        >
          <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} />
        </button>
        <button
          className={`today-compose ${todayActive ? 'active' : ''}`}
          onClick={onPostToday}
          aria-label="Post or edit your Today update"
        >
          {todayActive ? (
            <CalendarCheck size={18} />
          ) : (
            <CalendarPlus size={18} />
          )}
          <span>{todayActive ? 'Edit' : 'Today'}</span>
        </button>
        <button
          className="today-feed"
          onClick={onSeeAllToday}
          aria-label={`${todayCount} fresh Today updates. See all`}
        >
          <Sun size={20} />
          <span className="today-count-badge">{todayCount}</span>
        </button>
      </div>
    </section>
  );
}

function CinematicPortrait({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  const unoptimized = src.startsWith('/api/media/') || src.startsWith('data:');
  return (
    <div className="cinematic-photo-stack">
      <Image
        src={src}
        alt=""
        fill
        priority={priority}
        draggable={false}
        sizes={sizes}
        quality={95}
        unoptimized={unoptimized}
        className="profile-photo cinematic-photo-backdrop"
        aria-hidden="true"
      />
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        draggable={false}
        sizes={sizes}
        quality={95}
        unoptimized={unoptimized}
        className="profile-photo cinematic-photo-main"
      />
      <span className="cinematic-photo-grade" aria-hidden="true" />
    </div>
  );
}

function ProfileCard({
  profile,
  story,
  onOpen,
  onOpenStory,
  onTonight,
  room,
  preview,
  onSwipeLeft,
  onSwipeRight,
}: {
  profile: Profile;
  story?: DailyStory;
  onOpen?: () => void;
  onOpenStory?: (story: DailyStory) => void;
  onTonight?: () => void;
  room?: string | null;
  preview?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}) {
  const tonight =
    profile.tonight &&
    new Date(profile.tonight.expiresAt).getTime() > Date.now()
      ? profile.tonight
      : undefined;
  const [offset, setOffset] = useState(0);
  const gesture = useRef<{
    x: number;
    y: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);
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
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 300);
      if (dx > 0) onSwipeRight?.();
      else onSwipeLeft?.();
    }
  };
  return (
    <div
      className={`profile-card ${offset > 18 ? 'swiping-right' : offset < -18 ? 'swiping-left' : ''}`}
      role="presentation"
      style={{ transform: `translateX(${offset}px) rotate(${offset / 28}deg)` }}
      onClick={() => {
        if (!suppressClick.current) onOpen?.();
      }}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(e) => {
        if (
          e.pointerType === 'touch' ||
          (!onSwipeLeft && !onSwipeRight) ||
          (e.target as Element).closest(
            '.today-card-pill, .tonight-card-status',
          )
        )
          return;
        gesture.current = {
          x: e.clientX,
          y: e.clientY,
          moved: false,
          pointerId: e.pointerId,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const start = gesture.current;
        if (
          e.pointerType === 'touch' ||
          !start ||
          start.pointerId !== e.pointerId
        )
          return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) {
          start.moved = true;
          setOffset(Math.max(-150, Math.min(150, dx)));
        }
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== 'touch') finishGesture(e.clientX, e.clientY);
      }}
      onMouseUp={(e) => {
        if (gesture.current?.pointerId !== -1)
          finishGesture(e.clientX, e.clientY);
      }}
      onPointerCancel={() => {
        gesture.current = null;
        setOffset(0);
      }}
      onTouchStart={(e) => {
        if (!onSwipeLeft && !onSwipeRight) return;
        const touch = e.touches[0];
        gesture.current = {
          x: touch.clientX,
          y: touch.clientY,
          moved: false,
          pointerId: -1,
        };
      }}
      onTouchMove={(e) => {
        const start = gesture.current;
        const touch = e.touches[0];
        if (!start || start.pointerId !== -1 || !touch) return;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) {
          start.moved = true;
          setOffset(Math.max(-150, Math.min(150, dx)));
        }
      }}
      onTouchEnd={(e) => {
        const touch = e.changedTouches[0];
        if (touch) finishGesture(touch.clientX, touch.clientY);
      }}
    >
      <CinematicPortrait
        src={profile.image}
        alt={`${profile.name}'s profile`}
        priority
        sizes="(max-width: 480px) 100vw, 390px"
      />
      <span className="swipe-label pass-label">PASS</span>
      <span className="swipe-label like-label">LIKE</span>
      <div className="photo-scrim" />
      <button
        type="button"
        className="profile-card-open"
        aria-label={
          preview
            ? 'Preview of your dating card'
            : `Open ${profile.name}'s full profile`
        }
      />
      <div className={`card-content ${story || tonight ? 'has-today' : ''}`}>
        {room && <p className="room-caption">You’re both in {room}</p>}
        {!preview && (
          <p className="tap-hint">Tap the photo for the full profile</p>
        )}
        <div className="name-row">
          <h1>
            {profile.name}, {profile.age}
          </h1>
          {profile.verified !== false && (
            <BadgeCheck
              size={22}
              fill="#FF4D6D"
              color="#0E0E10"
              aria-label="Photo Verified"
            />
          )}
        </div>
        <p className="distance">
          {profile.place} · {profile.distance}
        </p>
        <div className="chips">
          <span>{profile.intent}</span>
          {profile.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <p className="card-story">{profile.prompt}</p>
        {(story || tonight) && !preview && (
          <div
            className="today-card-combined"
            aria-label={`${profile.name}'s Today`}
          >
            {story && (
              <button
                type="button"
                className="today-card-pill"
                aria-label={`View ${profile.name}'s Today post`}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenStory?.(story);
                }}
              >
                <span className="today-card-icon" aria-hidden="true">
                  <Sun size={14} />
                </span>
                <span>
                  <small>TODAY</small>
                  <strong>{story.caption}</strong>
                </span>
                <ChevronRight size={14} />
              </button>
            )}
            {tonight && (
              <button
                type="button"
                className="tonight-card-status"
                aria-label={`${profile.name} is available tonight. Send a Super Spike`}
                onClick={(event) => {
                  event.stopPropagation();
                  onTonight?.();
                }}
              >
                <Moon size={14} fill="currentColor" aria-hidden="true" />
                <span>
                  <strong>Available tonight</strong>
                  {profile.availability && (
                    <small>
                      {formatAvailabilityTime(profile.availability.startAt)}–
                      {formatAvailabilityTime(profile.availability.endAt)}
                    </small>
                  )}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionRow({
  onPass,
  onLike,
  onBoost,
  onPriority,
}: {
  onPass: () => void;
  onLike: () => void;
  onBoost?: () => void;
  onPriority?: () => void;
}) {
  return (
    <div className="action-row" aria-label="Profile actions">
      <button className="action-button pass" aria-label="Pass" onClick={onPass}>
        <X size={27} />
      </button>
      <button className="action-button like" aria-label="Like" onClick={onLike}>
        <BrandHeartMark size={29} />
      </button>
      {onBoost && (
        <button
          className="action-button boost-action"
          aria-label="Lift my profile"
          title="Profile Lift"
          onClick={onBoost}
        >
          <ProfileLiftMark size={27} />
        </button>
      )}
      {onPriority && (
        <button
          className="action-button priority super-pulse"
          aria-label="Super Spike"
          onClick={onPriority}
        >
          <SuperSpikeMark className="super-pulse-glyph" size={30} />
        </button>
      )}
    </div>
  );
}

function EngagementPrompt({
  nudge,
  membership,
  boostsRemaining,
  dailyLikesRemaining,
  superPulsesRemaining,
  profileCount,
  onDismiss,
  onAction,
}: {
  nudge: EngagementNudge;
  membership: Membership;
  boostsRemaining: number;
  dailyLikesRemaining: number;
  superPulsesRemaining: number;
  profileCount: number;
  onDismiss: () => void;
  onAction: () => void;
}) {
  const promptOfTheDay =
    todayPrompts[Math.floor(Date.now() / 86_400_000) % todayPrompts.length];
  const content =
    nudge.kind === 'today'
      ? {
          icon: Sun,
          tone: 'today',
          eyebrow: 'YOUR TODAY',
          title: 'Share one fresh moment',
          copy: promptOfTheDay,
          meta: 'One active post · disappears in 24 hours',
          dismiss: 'Maybe later',
          action: 'Post Today',
        }
      : nudge.kind === 'boost'
        ? {
            icon: ProfileLiftMark,
            tone: 'boost',
            eyebrow: 'VISIBILITY OPPORTUNITY',
            title: 'A good moment for Profile Lift',
            copy: 'Your profile is ready. Profile Lift shows it sooner to compatible people for 30 minutes.',
            meta: `${boostsRemaining} Profile ${boostsRemaining === 1 ? 'Lift' : 'Lifts'} available`,
            dismiss: 'Not now',
            action: 'See Profile Lift',
          }
        : nudge.kind === 'like'
          ? {
              icon: BrandHeartMark,
              tone: 'like',
              eyebrow: 'TODAY’S PROFILES',
              title: `${profileCount || 1} strong ${profileCount === 1 ? 'match' : 'matches'} today`,
              copy: 'Review them when you have a minute. A thoughtful Like is better than rushing.',
              meta:
                membership === 'plus'
                  ? 'Unlimited Likes'
                  : `${dailyLikesRemaining} Likes left today`,
              dismiss: 'Later',
              action: 'Show profiles',
            }
          : {
              icon: SuperSpikeMark,
              tone: 'super',
              eyebrow: 'HIGH-INTENT MOMENT',
              title: `${nudge.profile.name} stands out`,
              copy: 'Use a Super Spike only when you genuinely want to be seen first. Add a personal note.',
              meta: `${superPulsesRemaining} left this week`,
              dismiss: 'Keep browsing',
              action: 'Write an intro',
            };
  const Icon = content.icon;

  return (
    <section
      className={`engagement-prompt ${content.tone}`}
      role="dialog"
      aria-modal="false"
      aria-label={content.title}
    >
      <div className="engagement-prompt-heading">
        <span className="engagement-prompt-icon" aria-hidden="true">
          <Icon
            size={21}
            fill={nudge.kind === 'like' ? 'currentColor' : 'none'}
          />
        </span>
        <span>
          <small>{content.eyebrow}</small>
          <strong>{content.title}</strong>
        </span>
        <button
          className="engagement-prompt-close"
          onClick={onDismiss}
          aria-label={`Dismiss ${content.title}`}
        >
          <X size={18} />
        </button>
      </div>
      <p className="engagement-prompt-copy">{content.copy}</p>
      <p className="engagement-prompt-meta">{content.meta}</p>
      <div className="engagement-prompt-actions">
        <button className="secondary" onClick={onDismiss}>
          {content.dismiss}
        </button>
        <button className="primary" onClick={onAction}>
          {content.action}
        </button>
      </div>
    </section>
  );
}

function TabBar({
  active,
  onChange,
  unreadCount,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  unreadCount: number;
}) {
  return (
    <nav className="tabbar" aria-label="Primary navigation">
      {(Object.keys(tabIcons) as Tab[]).map((label) => {
        const Icon = tabIcons[label];
        const displayLabel = label === 'Pulse' ? 'Spike' : label;
        return (
          <button
            key={label}
            className={label === active ? 'active' : ''}
            onClick={() => onChange(label)}
            aria-current={label === active ? 'page' : undefined}
            aria-label={
              label === 'Chat' && unreadCount
                ? `Chat, ${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}`
                : displayLabel
            }
          >
            <span className="tab-icon">
              {label === 'Pulse' ? (
                <BrandHeartMark size={24} className="tab-brand-symbol" />
              ) : (
                <Icon size={22} strokeWidth={2.35} />
              )}
              {label === 'Chat' && unreadCount > 0 && (
                <b className="tab-badge" aria-hidden="true">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </b>
              )}
            </span>
            <span className="tab-label">{displayLabel}</span>
          </button>
        );
      })}
    </nav>
  );
}

function FullProfile({
  profile,
  open,
  onOpenChange,
  onPass,
  onLike,
  onPriority,
  onShare,
  onReport,
  onBlock,
  saved,
  onToggleSaved,
  todayActive,
  onPostToday,
}: {
  profile: Profile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPass: () => void;
  onLike: () => void;
  onPriority: () => void;
  onShare: () => void;
  onReport: () => void;
  onBlock: () => void;
  saved: boolean;
  onToggleSaved: () => void;
  todayActive: boolean;
  onPostToday: () => void;
}) {
  const richDetails = identityForProfile(profile)?.registration;
  const photos = profile.media
    .filter((item) => item.type === 'photo')
    .slice(0, 6);
  const video = profile.media
    .filter((item) => item.type === 'video')
    .slice(0, 1);
  const media = [...photos, ...video];
  const [mediaIndex, setMediaIndex] = useState(0);
  useEffect(() => {
    if (open) setMediaIndex(0);
  }, [open, profile.name]);
  const active = media[mediaIndex] ?? {
    type: 'photo' as const,
    src: profile.image,
  };
  const changeMedia = (step: number) =>
    setMediaIndex((index) => (index + step + media.length) % media.length);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="profile-sheet"
      >
        <SheetTitle className="sr-only">
          {profile.name}&apos;s full profile
        </SheetTitle>
        <SheetDescription className="sr-only">
          Photos and details for {profile.name}
        </SheetDescription>
        <button
          className="sheet-handle"
          onClick={() => onOpenChange(false)}
          aria-label="Close full profile"
        >
          <ChevronDown size={25} />
        </button>
        <div className="profile-scroll">
          <div className="profile-film">
            <div className="profile-film-tools">
              <button
                className="profile-share"
                onClick={onShare}
                aria-label={`Share ${profile.name}'s profile with friends or family`}
              >
                <Share2 size={17} /> Share
              </button>
              <button
                className={`profile-today ${todayActive ? 'active' : ''}`}
                onClick={onPostToday}
                aria-label="Post or edit your Today update"
              >
                {todayActive ? (
                  <CalendarCheck size={17} />
                ) : (
                  <CalendarPlus size={17} />
                )}
                {todayActive ? 'Edit Today' : 'Today'}
              </button>
              <button
                className={`profile-save ${saved ? 'saved' : ''}`}
                onClick={onToggleSaved}
                aria-label={
                  saved
                    ? `Remove ${profile.name} from Saved`
                    : `Save ${profile.name} privately`
                }
                aria-pressed={saved}
              >
                <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
            {active.type === 'video' ? (
              <video
                src={active.src}
                poster={active.poster}
                muted
                autoPlay
                loop
                playsInline
                aria-label={`${profile.name}'s profile video`}
              />
            ) : (
              <>
                <CinematicPortrait
                  src={active.src}
                  alt={`${profile.name}'s profile photo ${mediaIndex + 1}`}
                  sizes="390px"
                />
              </>
            )}
            <div className="media-bars" aria-hidden="true">
              {media.map((_, index) => (
                <span
                  key={index}
                  className={index === mediaIndex ? 'active' : ''}
                />
              ))}
            </div>
            <span className="film-count">
              {active.type === 'video' && (
                <Play size={12} fill="currentColor" />
              )}{' '}
              {mediaIndex + 1} / {media.length}
            </span>
            {media.length > 1 && (
              <>
                <button
                  className="media-hit previous"
                  onClick={() => changeMedia(-1)}
                  aria-label="Previous profile photo"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  className="media-hit next"
                  onClick={() => changeMedia(1)}
                  aria-label="Next profile photo"
                >
                  <ChevronRight size={24} />
                </button>
                <span className="media-hint">Tap right for the next photo</span>
              </>
            )}
            <div className="profile-title">
              <div className="profile-title-line">
                <div className="name-row">
                  <h2>
                    {profile.name}, {profile.age}
                  </h2>
                  {profile.verified !== false && (
                    <BadgeCheck
                      size={21}
                      fill="#FF4D6D"
                      color="#0E0E10"
                      aria-label="Photo Verified"
                    />
                  )}
                </div>
              </div>
              <p>
                {profile.place} · {profile.distance}
              </p>
            </div>
          </div>
          <div className="profile-details full-profile-passport">
            <div
              className="full-passport-facts"
              aria-label={`${profile.name}'s profile highlights`}
            >
              <div>
                <BrandHeartMark size={18} />
                <span>
                  <small>Looking for</small>
                  <strong>{profile.intent}</strong>
                </span>
              </div>
              <div>
                <Ruler size={17} />
                <span>
                  <small>Height</small>
                  <strong>{profile.height}</strong>
                </span>
              </div>
              <div>
                <Baby size={17} />
                <span>
                  <small>Family plans</small>
                  <strong>{profile.wantsKids}</strong>
                </span>
              </div>
              <div>
                <UserRound size={17} />
                <span>
                  <small>Work</small>
                  <strong>{richDetails?.occupation || profile.place}</strong>
                </span>
              </div>
            </div>
            <section className="passport-story">
              <span className="section-label">PROFILE STORY</span>
              <p>{richDetails?.bio || profile.prompt}</p>
            </section>
            <section>
              <span className="section-label">A perfect ordinary Sunday</span>
              <p>
                {profile.name === 'Maya'
                  ? 'Cold brew, a long walk with no route, then making dinner with a record on.'
                  : profile.prompt}
              </p>
            </section>
            <section>
              <span className="section-label">
                The quickest way to my heart
              </span>
              <p>{profile.prompt}</p>
            </section>
            <section>
              <span className="section-label">LIFESTYLE & BASICS</span>
              <div className="detail-chips">
                <span>{profile.ethnicity}</span>
                <span>{profile.pets}</span>
                <span>{profile.kids}</span>
                <span>Drinks: {profile.drinking}</span>
                <span>Smokes: {profile.smoking}</span>
                {richDetails?.education && <span>{richDetails.education}</span>}
                {richDetails?.religion && <span>{richDetails.religion}</span>}
                {richDetails?.politics && <span>{richDetails.politics}</span>}
                {richDetails?.zodiac && <span>{richDetails.zodiac}</span>}
                {richDetails?.orientation && (
                  <span>{richDetails.orientation}</span>
                )}
                {richDetails?.relationshipStyle && (
                  <span>{richDetails.relationshipStyle}</span>
                )}
                {richDetails?.exercise && (
                  <span>Exercise: {richDetails.exercise}</span>
                )}
                {richDetails?.diet && <span>{richDetails.diet}</span>}
                {richDetails?.languages.map((language) => (
                  <span key={language}>{language}</span>
                ))}
              </div>
            </section>
            <section>
              <span className="section-label">INTERESTS & VALUES</span>
              <div className="detail-chips coral">
                {profile.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
                {richDetails?.values.map((value) => (
                  <span key={value}>{value}</span>
                ))}
              </div>
            </section>
            <div className="profile-end-actions">
              <span>Safety options</span>
              <div>
                <button onClick={onReport}>
                  <Flag size={16} /> Report
                </button>
                <button className="block-profile" onClick={onBlock}>
                  <Ban size={17} /> Block
                </button>
              </div>
            </div>
          </div>
        </div>
        <button
          className="profile-reply-spike-float"
          onClick={onLike}
          aria-label={`Reply to ${profile.name} with a Spike`}
        >
          <MessageCircleReply size={19} aria-hidden="true" />
          <span>Reply Spike</span>
        </button>
        <div className="sheet-actions">
          <ActionRow onPass={onPass} onLike={onLike} onPriority={onPriority} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NoteDialog({
  profile,
  mode,
  open,
  onOpenChange,
  target,
  onTarget,
  message,
  onMessage,
  remaining,
  onSend,
  onCancel,
}: {
  profile: Profile;
  mode: NoteMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: NoteTarget;
  onTarget: (target: NoteTarget) => void;
  message: string;
  onMessage: (message: string) => void;
  remaining: number;
  onSend: () => void;
  onCancel: () => void;
}) {
  const isSuper = mode === 'super';
  const targets: NoteTarget[] = isSuper
    ? ['Photo 1', 'Lifestyle', 'Sunday morning']
    : ['Photo 1', profile.tags[0], 'Two truths'];
  const noteContext = target === 'Photo 1' ? 'photo' : 'prompt';
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={`note-dialog note-sheet ${isSuper ? 'super-note' : 'like-note'}`}
      >
        <button
          className="note-sheet-handle"
          onClick={() => onOpenChange(false)}
          aria-label="Close note sheet"
        >
          <span />
        </button>
        <div className="note-sheet-header">
          <span className="note-sheet-action-mark" aria-hidden="true">
            {isSuper ? (
              <SuperSpikeMark className="note-sheet-star" size={27} />
            ) : (
              <BrandHeartMark className="note-sheet-heart" size={23} />
            )}
          </span>
          <span className="note-sheet-heading">
            <SheetTitle>
              {isSuper ? `Super Spike ${profile.name}` : `Like ${profile.name}`}
            </SheetTitle>
            <SheetDescription>
              {isSuper
                ? `${remaining} Super Spike${remaining === 1 ? '' : 's'} left this week · they’ll see you first`
                : 'Add something personal to stand out.'}
            </SheetDescription>
          </span>
          <button
            type="button"
            className="note-sheet-close"
            onClick={onCancel}
            aria-label={`Close ${isSuper ? 'Super Spike' : 'Like'}`}
          >
            <X size={20} />
          </button>
        </div>
        <div className="note-context-card">
          <span className="note-context-photo">
            <Image
              src={profile.image}
              alt=""
              fill
              sizes="66px"
              className="profile-photo"
            />
            <ProfileSpikeBadge />
          </span>
          <span>
            <small>COMMENTING ON</small>
            <strong>{target}</strong>
            <p>
              {noteContext === 'photo'
                ? `${profile.name}’s main profile photo`
                : profile.prompt}
            </p>
          </span>
        </div>
        <div
          className="connect-suggestions note-targets"
          aria-label="Choose what to note"
        >
          {targets.map((item) => (
            <button
              type="button"
              key={item}
              className={target === item ? 'active' : ''}
              aria-pressed={target === item}
              onClick={() => onTarget(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="connect-message">
          <span className="note-input-label">
            <strong>Your note</strong>
            <span>Optional · commenting on this {noteContext}</span>
          </span>
          <textarea
            aria-label="Profile note"
            maxLength={140}
            value={message}
            onChange={(event) => onMessage(event.target.value)}
            placeholder={
              isSuper
                ? `A Super Spike note for ${profile.name}…`
                : `Say something about this ${noteContext}…`
            }
          />
          <small className="note-character-count">{message.length}/140</small>
        </label>
        <div className="note-dialog-actions">
          <button className="primary-button" onClick={onSend}>
            {isSuper ? (
              <SuperSpikeMark className="super-pulse-glyph" size={22} />
            ) : (
              <BrandHeartMark size={20} />
            )}
            {isSuper ? 'Send Super Spike' : 'Send Like'}
          </button>
          <button className="text-button note-skip" onClick={onSend}>
            {isSuper ? 'Super Spike without a note' : 'Like without a note'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RoomsHub({
  onOpenRoom,
  onCreatePlan,
  plans,
  onDirections,
  onCalendar,
  onSharePlan,
  onCancelPlan,
  viewerEmail,
  onRespondPlan,
  onSuggestPlan,
  onAcceptAlternate,
  onVoteVenue,
  onMarkSafe,
  onSafetyOptions,
}: {
  onOpenRoom: (name: string) => void;
  onCreatePlan: (activity: string) => void;
  plans: DatingPlan[];
  onDirections: (plan: DatingPlan) => void;
  onCalendar: (plan: DatingPlan) => void;
  onSharePlan: (plan: DatingPlan) => void;
  onCancelPlan: (plan: DatingPlan) => void;
  viewerEmail: string;
  onRespondPlan: (plan: DatingPlan, status: 'accepted' | 'declined') => void;
  onSuggestPlan: (plan: DatingPlan, day: string, time: string) => void;
  onAcceptAlternate: (plan: DatingPlan) => void;
  onVoteVenue: (plan: DatingPlan, venueId: string) => void;
  onMarkSafe: (plan: DatingPlan) => void;
  onSafetyOptions: (plan: DatingPlan) => void;
}) {
  const [selectedPlan, setSelectedPlan] = useState(galaxyPlans[0]);
  const [suggestingPlanId, setSuggestingPlanId] = useState<number | null>(null);
  const [alternateDay, setAlternateDay] = useState(() => {
    const value = new Date();
    value.setDate(value.getDate() + 2);
    return value.toISOString().slice(0, 10);
  });
  const [alternateTime, setAlternateTime] = useState('19:00');
  const planProfiles =
    selectedPlan.name === 'Dinner'
      ? [profiles[5], profiles[2], profiles[0]]
      : selectedPlan.name === 'Music'
        ? [profiles[1], profiles[0], profiles[6]]
        : selectedPlan.name === 'Walk'
          ? [profiles[2], profiles[4], profiles[0]]
          : [profiles[0], profiles[3], profiles[1]];
  return (
    <section className="screen scroll-screen galaxy-hub">
      <header className="page-header galaxy-page-header">
        <p className="eyebrow">Start with a plan</p>
        <h1>Galaxy</h1>
        <p>Choose the kind of date you’d enjoy.</p>
      </header>

      {datePlansEnabled ? (
        <section
          className="galaxy-plan-builder"
          aria-labelledby="galaxy-plan-title"
        >
          <div className="galaxy-section-heading">
            <div>
              <p>MAKE A CONNECTION</p>
              <h2 id="galaxy-plan-title">What sounds good?</h2>
            </div>
            <span>Today</span>
          </div>
          <div className="galaxy-plan-grid">
            {galaxyPlans.map((plan) => {
              const Icon = plan.icon;
              const active = selectedPlan.name === plan.name;
              return (
                <button
                  type="button"
                  key={plan.name}
                  className={`galaxy-plan-tile ${active ? 'selected' : ''}`}
                  aria-pressed={active}
                  onClick={() => setSelectedPlan(plan)}
                >
                  <Icon size={20} />
                  <strong>{plan.name}</strong>
                  <small>{plan.detail}</small>
                </button>
              );
            })}
          </div>

          <article className="galaxy-plan-result">
            <div className="galaxy-plan-result-top">
              <div className="galaxy-plan-faces" aria-hidden="true">
                {planProfiles.map((profile) => (
                  <span key={profile.name}>
                    <Image src={profile.image} alt="" width={42} height={42} />
                    <ProfileSpikeBadge compact />
                  </span>
                ))}
              </div>
              <span className="galaxy-fit-badge">Best fit</span>
            </div>
            <div className="galaxy-plan-copy" aria-live="polite">
              <h3>
                3 people match your {selectedPlan.name.toLowerCase()} plan
              </h3>
              <p>Available soon, nearby, and aligned with your preferences.</p>
            </div>
            <button
              type="button"
              className="primary-button galaxy-plan-action"
              onClick={() => onCreatePlan(selectedPlan.name)}
            >
              Plan a {selectedPlan.name.toLowerCase()} date
              <ChevronRight size={17} />
            </button>
          </article>
        </section>
      ) : (
        <section className="galaxy-plan-builder plan-feature-paused">
          <ShieldCheck size={24} />
          <div>
            <h2>Date planning is paused</h2>
            <p>
              You can still browse Galaxy spaces and chat with your matches.
            </p>
          </div>
        </section>
      )}

      {plans.length > 0 && (
        <section
          className="galaxy-upcoming"
          aria-labelledby="galaxy-upcoming-title"
        >
          <div className="galaxy-browse-heading">
            <div>
              <p>PRIVATE DATE INVITES</p>
              <h2 id="galaxy-upcoming-title">Your date plans</h2>
            </div>
            <span>{plans.length}</span>
          </div>
          {plans.slice(0, 2).map((plan) => (
            <article key={plan.id} className="galaxy-upcoming-card">
              <span className="galaxy-upcoming-icon">
                {plan.activity === 'Coffee' ? (
                  <Coffee size={18} />
                ) : plan.activity === 'Dinner' ? (
                  <Utensils size={18} />
                ) : plan.activity === 'Music' ? (
                  <Music2 size={18} />
                ) : (
                  <Footprints size={18} />
                )}
              </span>
              <span>
                <strong>{plan.planName}</strong>
                <small>
                  {new Date(`${plan.day}T${plan.time}`).toLocaleString(
                    undefined,
                    {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    },
                  )}{' '}
                  · {plan.durationMinutes} min
                </small>
                <em>
                  <MapPin size={12} /> {plan.venue.name} ·{' '}
                  {plan.venue.neighborhood}
                </em>
                <em>
                  {plan.status === 'sent'
                    ? `Invite sent to ${plan.invitees.join(', ')}`
                    : plan.status}
                </em>
                {plan.safetyCheckInEnabled && (
                  <em className="plan-safety-status">
                    <ShieldCheck size={12} /> Safety check-in{' '}
                    {plan.safetyStatus === 'safe'
                      ? 'completed'
                      : `${plan.safetyCheckInMinutes ?? 30} min after start`}
                  </em>
                )}
              </span>
              <span className={`plan-status ${plan.status}`}>
                {plan.status === 'sent' ? 'Sent' : plan.status}
              </span>
              {(plan.venueOptions?.length ?? 0) > 1 &&
                plan.status === 'sent' && (
                  <div className="plan-venue-vote" aria-label="Vote on a venue">
                    <strong>Vote on a meeting place</strong>
                    <p>Your choice is shared only with this match.</p>
                    <div>
                      {plan.venueOptions!.map((venue) => {
                        const selected =
                          plan.venueVotes?.[viewerEmail] === venue.id;
                        const votes = Object.values(
                          plan.venueVotes ?? {},
                        ).filter((venueId) => venueId === venue.id).length;
                        return (
                          <button
                            type="button"
                            key={venue.id}
                            className={selected ? 'selected' : ''}
                            aria-pressed={selected}
                            onClick={() => onVoteVenue(plan, venue.id)}
                          >
                            <MapPin size={13} /> {venue.name}
                            <small>{votes || ''}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              {plan.alternateDay && plan.alternateTime && (
                <div className="plan-alternate-proposal">
                  <span>
                    <CalendarDays size={15} /> Alternate suggested:{' '}
                    <strong>
                      {new Date(
                        `${plan.alternateDay}T${plan.alternateTime}`,
                      ).toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </strong>
                  </span>
                  {plan.alternateSuggestedBy !== viewerEmail && (
                    <button
                      type="button"
                      onClick={() => onAcceptAlternate(plan)}
                    >
                      Accept new time
                    </button>
                  )}
                </div>
              )}
              {suggestingPlanId === plan.id && (
                <div className="plan-alternate-editor">
                  <label>
                    New date
                    <input
                      aria-label="Alternate plan date"
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={alternateDay}
                      onChange={(event) => setAlternateDay(event.target.value)}
                    />
                  </label>
                  <label>
                    New time
                    <input
                      aria-label="Alternate plan time"
                      type="time"
                      value={alternateTime}
                      onChange={(event) => setAlternateTime(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!alternateDay || !alternateTime}
                    onClick={() => {
                      onSuggestPlan(plan, alternateDay, alternateTime);
                      setSuggestingPlanId(null);
                    }}
                  >
                    Send option
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuggestingPlanId(null)}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {plan.status === 'sent' &&
                plan.creatorEmail &&
                plan.creatorEmail !== viewerEmail && (
                  <div className="galaxy-plan-response-tools">
                    <button
                      type="button"
                      className="accept"
                      onClick={() => onRespondPlan(plan, 'accepted')}
                    >
                      <Check size={15} /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuggestingPlanId(plan.id)}
                    >
                      Suggest change
                    </button>
                    <button
                      type="button"
                      onClick={() => onRespondPlan(plan, 'declined')}
                    >
                      Not this time
                    </button>
                  </div>
                )}
              {plan.status === 'accepted' &&
                plan.safetyCheckInEnabled &&
                plan.safetyStatus !== 'safe' && (
                  <div className="plan-check-in-actions">
                    <button
                      type="button"
                      className="plan-safe-button"
                      onClick={() => onMarkSafe(plan)}
                    >
                      <ShieldCheck size={15} /> I’m safe
                    </button>
                  </div>
                )}
              {plan.status === 'accepted' && (
                <button
                  type="button"
                  className="plan-safety-options"
                  onClick={() => onSafetyOptions(plan)}
                >
                  <ShieldCheck size={15} /> Safety options
                </button>
              )}
              {plan.status !== 'cancelled' &&
                !(
                  plan.status === 'sent' &&
                  plan.creatorEmail &&
                  plan.creatorEmail !== viewerEmail
                ) && (
                  <div className="galaxy-plan-tools">
                    <button
                      type="button"
                      onClick={() => onDirections(plan)}
                      aria-label={`Directions to ${plan.venue.name}`}
                    >
                      <ExternalLink size={15} /> Directions
                    </button>
                    <button
                      type="button"
                      onClick={() => onCalendar(plan)}
                      aria-label={`Add ${plan.planName} to calendar`}
                    >
                      <CalendarDays size={15} /> Calendar
                    </button>
                    <button
                      type="button"
                      onClick={() => onSharePlan(plan)}
                      aria-label={`Share ${plan.planName} with a trusted contact`}
                    >
                      <Share2 size={15} /> Trusted contact
                    </button>
                    <button
                      type="button"
                      className="cancel"
                      onClick={() => onCancelPlan(plan)}
                      aria-label={`Cancel ${plan.planName}`}
                    >
                      <X size={15} /> Cancel
                    </button>
                  </div>
                )}
            </article>
          ))}
        </section>
      )}

      <div className="galaxy-browse-heading">
        <div>
          <p>EXPLORE BY ENERGY</p>
          <h2>Browse the Galaxy</h2>
        </div>
        <span>{roomData.length} spaces</span>
      </div>
      <div className="room-grid">
        {roomData.map((item) => (
          <button
            key={item.name}
            className={`room-tile ${item.className ?? ''}`}
            onClick={() => onOpenRoom(item.name)}
          >
            <Image
              src={item.image}
              alt=""
              fill
              sizes="390px"
              className="profile-photo"
            />
            <span className="room-shade" />
            <span className="room-copy">
              <strong>{item.name}</strong>
              <small>{item.caption}</small>
              <em>{item.count}</em>
            </span>
          </button>
        ))}
      </div>
      <p className="stand-note">
        <Radio size={16} fill="currentColor" /> You can appear in Spike + one
        Galaxy
      </p>
    </section>
  );
}

function PlanDialog({
  open,
  onOpenChange,
  activity,
  matchedContacts,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: string;
  matchedContacts: ChatContact[];
  onSend: (plan: DatingPlan) => void;
}) {
  const venueMatchesActivity = (venue: Venue) =>
    activity === 'Coffee'
      ? /coffee|café/i.test(venue.category)
      : activity === 'Dinner'
        ? /restaurant/i.test(venue.category)
        : activity === 'Music'
          ? /music/i.test(venue.category)
          : /park/i.test(venue.category);
  const [step, setStep] = useState(0);
  const [planName, setPlanName] = useState(`${activity} date`);
  const [day, setDay] = useState(() => {
    const value = new Date();
    value.setDate(value.getDate() + 1);
    return value.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState('18:30');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [neighborhood, setNeighborhood] = useState('Williamsburg');
  const [venueQuery, setVenueQuery] = useState('');
  const [venues, setVenues] = useState<Venue[]>(demoVenues);
  const [selectedVenues, setSelectedVenues] = useState<Venue[]>([]);
  const [venueLoading, setVenueLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'requesting' | 'ready' | 'blocked'
  >('idle');
  const [proximity, setProximity] = useState('');
  const [invitees, setInvitees] = useState<string[]>([]);
  const [safetyCheckInEnabled, setSafetyCheckInEnabled] = useState(true);
  const [safetyCheckInMinutes, setSafetyCheckInMinutes] = useState(30);
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(false);
  const selectedVenue = selectedVenues[0] ?? null;

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setPlanName(`${activity} date`);
    const value = new Date();
    value.setDate(value.getDate() + 1);
    setDay(value.toISOString().slice(0, 10));
    setTime('18:30');
    setDurationMinutes(activity === 'Dinner' ? 90 : 45);
    setNeighborhood('Williamsburg');
    setVenueQuery('');
    setVenues(demoVenues.filter(venueMatchesActivity));
    setSelectedVenues([]);
    setLocationStatus('idle');
    setProximity('');
    setInvitees([]);
    setSafetyCheckInEnabled(true);
    setSafetyCheckInMinutes(30);
    setSafetyAcknowledged(false);
  }, [open, activity]);

  useEffect(() => {
    if (!open || step !== 1) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setVenueLoading(true);
      try {
        const search = new URLSearchParams({ activity, neighborhood });
        if (venueQuery.trim()) search.set('q', venueQuery.trim());
        if (proximity) search.set('proximity', proximity);
        const response = await fetch(`/api/places/search?${search}`, {
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          venues?: Venue[];
          configured?: boolean;
        };
        const fallback = demoVenues.filter((venue) => {
          const haystack =
            `${venue.name} ${venue.category} ${venue.neighborhood}`.toLowerCase();
          return (
            venueMatchesActivity(venue) &&
            (!venueQuery.trim() || haystack.includes(venueQuery.toLowerCase()))
          );
        });
        setVenues(result.venues?.length ? result.venues : fallback);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setVenues(demoVenues);
      } finally {
        if (!controller.signal.aborted) setVenueLoading(false);
      }
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activity, neighborhood, open, proximity, step, venueQuery]);

  const useMyArea = () => {
    if (!navigator.geolocation) {
      setLocationStatus('blocked');
      return;
    }
    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setProximity(`${coords.longitude},${coords.latitude}`);
        setLocationStatus('ready');
      },
      () => setLocationStatus('blocked'),
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 8000 },
    );
  };

  const toggleInvitee = (name: string) =>
    setInvitees((items) => (items.includes(name) ? [] : [name]));
  const toggleVenue = (venue: Venue) =>
    setSelectedVenues((items) => {
      if (items.some((item) => item.id === venue.id))
        return items.filter((item) => item.id !== venue.id);
      return items.length < 3 ? [...items, venue] : items;
    });
  const availabilityFor = (contact?: ChatContact) => {
    const availability = contact?.availability;
    if (!availability || new Date(availability.endAt).getTime() <= Date.now())
      return { text: 'Availability not shared', status: 'unknown' };
    const range = `${formatAvailabilityTime(availability.startAt)}–${formatAvailabilityTime(availability.endAt)}`;
    if (availability.localDate !== day)
      return {
        text: `Shared ${availabilitySummary(availability)}`,
        status: 'unknown',
      };
    const planStart = new Date(`${day}T${time}:00`).getTime();
    const planEnd = planStart + durationMinutes * 60_000;
    const fits =
      planStart >= new Date(availability.startAt).getTime() &&
      planEnd <= new Date(availability.endAt).getTime();
    return {
      text: fits ? `Available ${range}` : `Shared ${range} · time conflict`,
      status: fits ? 'match' : 'conflict',
    };
  };
  const canContinue =
    step === 0
      ? planName.trim().length > 1 && Boolean(day) && Boolean(time)
      : step === 1
        ? Boolean(selectedVenue)
        : step === 2
          ? invitees.length === 1
          : safetyAcknowledged;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="plan-dialog">
        <button
          type="button"
          className="match-close"
          onClick={() => onOpenChange(false)}
          aria-label="Close plan builder"
        >
          <X size={19} />
        </button>
        <div className="plan-dialog-kicker">
          <ShieldCheck size={15} /> PRIVATE DATE PLAN
        </div>
        <div
          className="plan-dialog-progress"
          aria-label={`Step ${step + 1} of 4`}
        >
          {[0, 1, 2, 3].map((item) => (
            <span key={item} className={item <= step ? 'active' : ''} />
          ))}
        </div>
        <DialogTitle>
          {step === 0
            ? `Plan a ${activity.toLowerCase()} date`
            : step === 1
              ? 'Choose a public place'
              : step === 2
                ? 'Invite one match'
                : 'Review your date plan'}
        </DialogTitle>
        <DialogDescription>
          {step === 0
            ? 'Name the plan and choose a date, time, and comfortable duration.'
            : step === 1
              ? 'Choose up to three public places. Your match can vote before confirming.'
              : step === 2
                ? 'Only people you mutually matched with can be invited.'
                : 'Your match can accept or suggest a change in Chat.'}
        </DialogDescription>

        {step === 0 && (
          <div className="plan-details-fields">
            <label>
              Plan name
              <input
                aria-label="Plan name"
                value={planName}
                maxLength={48}
                onChange={(event) => setPlanName(event.target.value)}
                placeholder="Example: Coffee with Noah"
              />
            </label>
            <div className="plan-date-time-grid">
              <label>
                Date
                <input
                  type="date"
                  aria-label="Plan date"
                  value={day}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setDay(event.target.value)}
                />
              </label>
              <label>
                Time
                <input
                  type="time"
                  aria-label="Plan time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </label>
            </div>
            <label>
              Duration
              <select
                aria-label="Plan duration"
                value={durationMinutes}
                onChange={(event) =>
                  setDurationMinutes(Number(event.target.value))
                }
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
              </select>
            </label>
            <label>
              Search area
              <input
                aria-label="Plan neighborhood"
                value={neighborhood}
                onChange={(event) => setNeighborhood(event.target.value)}
                placeholder="Neighborhood or city"
              />
            </label>
            <div className="plan-safety-control">
              <span>
                <ShieldCheck size={17} />
                <span>
                  <strong>Safety check-in</strong>
                  <small>Get a private reminder after the date starts.</small>
                </span>
              </span>
              <Switch
                checked={safetyCheckInEnabled}
                onCheckedChange={setSafetyCheckInEnabled}
                aria-label="Enable safety check-in"
              />
            </div>
            {safetyCheckInEnabled && (
              <label>
                Check in after
                <select
                  aria-label="Safety check-in time"
                  value={safetyCheckInMinutes}
                  onChange={(event) =>
                    setSafetyCheckInMinutes(Number(event.target.value))
                  }
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                </select>
              </label>
            )}
            <p className="plan-safety-note">
              <ShieldCheck size={16} /> Only the public venue you select will be
              shared. Your current or home location stays private.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="venue-browser">
            <div className="venue-search-row">
              <label>
                <span className="sr-only">Search venues</span>
                <input
                  aria-label="Search venues"
                  value={venueQuery}
                  onChange={(event) => setVenueQuery(event.target.value)}
                  placeholder={`Search ${activity.toLowerCase()} places`}
                />
              </label>
              <button
                type="button"
                className={locationStatus === 'ready' ? 'location-ready' : ''}
                onClick={useMyArea}
                disabled={locationStatus === 'requesting'}
              >
                <MapPin size={17} />
                {locationStatus === 'requesting'
                  ? 'Locating…'
                  : locationStatus === 'ready'
                    ? 'Area set'
                    : 'Use my area'}
              </button>
            </div>
            {locationStatus === 'blocked' && (
              <p className="venue-location-note">
                Location is unavailable. Search by neighborhood instead.
              </p>
            )}
            <div className="venue-browser-heading">
              <span>
                <strong>Public places near {neighborhood || 'you'}</strong>
                <small>
                  {venueLoading ? 'Searching…' : `${venues.length} places`}
                </small>
              </span>
              <ShieldCheck size={18} />
            </div>
            <div className="venue-results" aria-live="polite">
              {venues.map((venue) => {
                const selected = selectedVenues.some(
                  (item) => item.id === venue.id,
                );
                return (
                  <button
                    type="button"
                    key={venue.id}
                    className={selected ? 'selected' : ''}
                    aria-pressed={selected}
                    onClick={() => toggleVenue(venue)}
                  >
                    <span className="venue-result-pin">
                      <MapPin size={18} />
                    </span>
                    <span>
                      <strong>{venue.name}</strong>
                      <small>{venue.address}</small>
                      <em>
                        {venue.category} · {venue.distance} · {venue.price}
                        {venue.openNow === true ? ' · Open now' : ''}
                      </em>
                    </span>
                    <i>
                      {selected
                        ? selectedVenues.findIndex(
                            (item) => item.id === venue.id,
                          ) + 1
                        : null}
                    </i>
                  </button>
                );
              })}
              {!venueLoading && venues.length === 0 && (
                <div className="venue-empty">
                  <MapPin size={24} />
                  <strong>No places found</strong>
                  <p>Try a venue name or another neighborhood.</p>
                </div>
              )}
            </div>
            <p className="plan-safety-note">
              <ShieldCheck size={16} /> {selectedVenues.length}/3 selected. The
              first is your preferred venue; your match can vote on all choices.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="plan-match-picker">
            {matchedContacts.length ? (
              matchedContacts.map((contact) => {
                const selected = invitees.includes(contact.name);
                const availability = availabilityFor(contact);
                return (
                  <button
                    type="button"
                    key={contact.name}
                    className={selected ? 'selected' : ''}
                    aria-pressed={selected}
                    onClick={() => toggleInvitee(contact.name)}
                  >
                    <span className="plan-match-avatar">
                      <Image
                        src={contact.image}
                        alt=""
                        width={48}
                        height={48}
                      />
                      <ProfileSpikeBadge compact />
                    </span>
                    <span>
                      <strong>{contact.name}</strong>
                      <small>Mutual match · Chat open</small>
                      <em
                        className={`plan-match-availability ${availability.status}`}
                      >
                        <CalendarDays size={12} /> {availability.text}
                      </em>
                    </span>
                    <i>{selected ? <Check size={16} /> : null}</i>
                  </button>
                );
              })
            ) : (
              <div className="plan-no-matches">
                <BrandHeartMark size={29} />
                <strong>No mutual matches yet</strong>
                <p>When you both like each other, they’ll appear here.</p>
              </div>
            )}
          </div>
        )}

        {step === 3 && selectedVenue && (
          <div className="plan-review">
            <span className="plan-review-icon">
              {activity === 'Coffee' ? (
                <Coffee size={22} />
              ) : activity === 'Dinner' ? (
                <Utensils size={22} />
              ) : activity === 'Music' ? (
                <Music2 size={22} />
              ) : (
                <Footprints size={22} />
              )}
            </span>
            <div>
              <small>{activity.toUpperCase()} PLAN</small>
              <h3>{planName}</h3>
              <p>
                {new Date(`${day}T${time}`).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}{' '}
                · {durationMinutes} min
              </p>
            </div>
            <section className="plan-review-venue">
              <span>
                MEETING PLACE{selectedVenues.length > 1 ? ' OPTIONS' : ''}
              </span>
              <strong>
                {selectedVenues.map((venue) => venue.name).join(' · ')}
              </strong>
              <p>
                {selectedVenues.length > 1
                  ? 'Your match can vote before accepting.'
                  : selectedVenue.address}
              </p>
            </section>
            <section>
              <span>INVITING</span>
              <strong>{invitees.join(', ')}</strong>
              <p>
                {invitees[0]
                  ? availabilityFor(
                      matchedContacts.find(
                        (contact) => contact.name === invitees[0],
                      ),
                    ).text
                  : ''}
              </p>
            </section>
            {safetyCheckInEnabled && (
              <section>
                <span>PRIVATE SAFETY CHECK-IN</span>
                <strong>{safetyCheckInMinutes} minutes after the start</strong>
              </section>
            )}
            <p className="plan-review-note">
              Your match must accept before this plan is confirmed. Any time or
              venue change requires confirmation again.
            </p>
            <label className="plan-safety-consent">
              <input
                type="checkbox"
                checked={safetyAcknowledged}
                onChange={(event) =>
                  setSafetyAcknowledged(event.target.checked)
                }
              />
              <span>
                I understand this is a public-place plan with one mutual match.
                I control my transportation, and SpikeDate cannot guarantee
                personal safety.
              </span>
            </label>
          </div>
        )}

        <div className="plan-dialog-actions">
          {step > 0 && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setStep((value) => value - 1)}
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              className="primary-button"
              disabled={!canContinue}
              onClick={() => setStep((value) => value + 1)}
            >
              {step === 0
                ? 'Browse venues'
                : step === 1
                  ? 'Choose a match'
                  : 'Review invitation'}
            </button>
          ) : (
            <button
              type="button"
              className="primary-button send-plan-invites"
              disabled={!canContinue}
              onClick={() =>
                onSend({
                  id: Date.now(),
                  planName: planName.trim(),
                  activity,
                  day,
                  time,
                  durationMinutes,
                  neighborhood,
                  venue: selectedVenue!,
                  venueOptions: selectedVenues,
                  invitees,
                  status: 'sent',
                  safetyCheckInEnabled,
                  safetyCheckInMinutes,
                  safetyAcknowledgedAt: new Date().toISOString(),
                })
              }
            >
              <Send size={17} /> Send private invite
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoomStack({
  room,
  profile,
  onBack,
  onOpen,
  onPass,
  onLike,
  onPriority,
}: {
  room: string;
  profile: Profile;
  onBack: () => void;
  onOpen: () => void;
  onPass: () => void;
  onLike: () => void;
  onPriority: () => void;
}) {
  return (
    <section className="room-stack">
      <header className="room-header">
        <button onClick={onBack} aria-label="Back to Galaxy">
          <ArrowLeft size={22} />
        </button>
        <div>
          <strong>{room}</strong>
          <span>{room === 'Tonight' ? '84 here now' : 'Live now'}</span>
        </div>
        <span className="live-dot" />
      </header>
      <div className="context-chip">
        {room === 'Tonight' ? 'Free after 8' : `Into ${room.toLowerCase()}`}
      </div>
      <div className="room-card-wrap">
        <ProfileCard
          profile={profile}
          room={room}
          onOpen={onOpen}
          onSwipeLeft={onPass}
          onSwipeRight={onLike}
        />
      </div>
      <ActionRow onPass={onPass} onLike={onLike} onPriority={onPriority} />
    </section>
  );
}

function Incoming({
  open,
  onOpenChange,
  sentLikes,
  incomingRows,
  declined,
  onLikeBack,
  onPass,
  onMessage,
  onProfile,
  savedProfiles,
  onToggleSaved,
  membership,
  onUpgrade,
  onBrowse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sentLikes: { profile: Profile; status: ProfileInteraction['status'] }[];
  incomingRows?: IncomingRow[];
  declined: string[];
  onLikeBack: (profile: Profile, interactionId?: string) => void;
  onPass: (name: string, interactionId?: string) => void;
  onMessage: (profile: Profile) => void;
  onProfile: (profile: Profile) => void;
  savedProfiles: Profile[];
  onToggleSaved: (profile: Profile) => void;
  membership: Membership;
  onUpgrade: () => void;
  onBrowse: () => void;
}) {
  const [view, setView] = useState<'incoming' | 'sent' | 'saved'>('incoming');
  const [incomingFilter, setIncomingFilter] = useState<
    'all' | 'new' | 'super' | 'notes'
  >('all');
  const demoRows: IncomingRow[] = [
    {
      profile: priyaProfile,
      liked: 'Super Spiked you · Lifestyle',
      note: '“Your live-music answer made me smile.”',
      superPulse: true,
    },
    {
      profile: leoProfile,
      liked: 'Sent a note on your photo',
      note: '“This looks like my favorite corner of Brooklyn.”',
      superPulse: false,
    },
    {
      profile: profiles.find((profile) => profile.name === 'Mateo')!,
      liked: 'Liked your cooking prompt',
      note: '',
      superPulse: false,
    },
  ];
  const rows = incomingRows ?? demoRows;
  const availableRows = rows.filter(
    (row) => !declined.includes(row.profile.name),
  );
  const filteredRows = availableRows.filter((row) => {
    if (incomingFilter === 'super') return row.superPulse;
    if (incomingFilter === 'notes') return Boolean(row.note);
    return true;
  });
  const visibleRows =
    membership === 'plus' ? filteredRows : filteredRows.slice(0, 2);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="incoming-sheet"
      >
        <SheetTitle className="incoming-title">Likes</SheetTitle>
        <SheetDescription className="incoming-subtitle">
          Accept a like to match. Messages unlock only after a match.
        </SheetDescription>
        <button
          className="close-round"
          onClick={() => onOpenChange(false)}
          aria-label="Close likes center"
        >
          <X size={19} />
        </button>
        <div className="likes-tabs" role="tablist">
          <button
            className={view === 'incoming' ? 'active' : ''}
            onClick={() => setView('incoming')}
            role="tab"
            aria-selected={view === 'incoming'}
          >
            Liked you <span>{availableRows.length}</span>
          </button>
          <button
            className={view === 'sent' ? 'active' : ''}
            onClick={() => setView('sent')}
            role="tab"
            aria-selected={view === 'sent'}
          >
            You liked <span>{sentLikes.length}</span>
          </button>
          <button
            className={view === 'saved' ? 'active' : ''}
            onClick={() => setView('saved')}
            role="tab"
            aria-selected={view === 'saved'}
          >
            Saved <span>{savedProfiles.length}</span>
          </button>
        </div>
        {view === 'saved' ? (
          <div className="sent-likes saved-profiles-list">
            {savedProfiles.length ? (
              savedProfiles.map((profile) => (
                <div className="sent-like" key={profile.name}>
                  <button
                    className="avatar incoming-profile-link"
                    onClick={() => onProfile(profile)}
                    aria-label={`Open ${profile.name}'s full profile`}
                  >
                    <Image
                      src={profile.image}
                      alt={profile.name}
                      fill
                      sizes="58px"
                      className="profile-photo"
                    />
                    <ProfileSpikeBadge />
                  </button>
                  <span>
                    <button
                      className="incoming-name-link"
                      onClick={() => onProfile(profile)}
                    >
                      {profile.name}
                    </button>
                    <small>
                      {profile.intent} · {profile.distance}
                    </small>
                  </span>
                  <button
                    className="saved-remove-button"
                    onClick={() => onToggleSaved(profile)}
                    aria-label={`Remove ${profile.name} from Saved`}
                  >
                    <Bookmark size={17} fill="currentColor" />
                  </button>
                </div>
              ))
            ) : (
              <p className="empty-likes">
                Profiles you save privately will appear here.
              </p>
            )}
            <p className="likes-note">
              <Bookmark size={16} /> Saved profiles are private. Nobody is
              notified.
            </p>
          </div>
        ) : view === 'incoming' ? (
          <div className="incoming-list">
            <p className="list-label">
              <BrandHeartMark size={15} /> RECENT LIKES
            </p>
            <div
              className="incoming-filters"
              aria-label="Filter incoming likes"
            >
              {(['all', 'new', 'super', 'notes'] as const).map((filter) => (
                <button
                  type="button"
                  key={filter}
                  className={incomingFilter === filter ? 'active' : ''}
                  aria-pressed={incomingFilter === filter}
                  onClick={() => setIncomingFilter(filter)}
                >
                  {filter === 'all'
                    ? 'All'
                    : filter === 'new'
                      ? 'New'
                      : filter === 'super'
                        ? 'Super Spikes'
                        : 'With notes'}
                </button>
              ))}
            </div>
            {visibleRows.map((row, index) => (
              <div
                className="incoming-row"
                key={`${row.profile.name}-${index}`}
              >
                <button
                  className="avatar incoming-profile-link"
                  onClick={() => onProfile(row.profile)}
                  aria-label={`Open ${row.profile.name}'s full profile`}
                >
                  <Image
                    src={row.profile.image}
                    alt={row.profile.name}
                    fill
                    sizes="58px"
                    className="profile-photo"
                  />
                  <ProfileSpikeBadge />
                </button>
                <span className="incoming-copy">
                  <button
                    className="incoming-name-link"
                    onClick={() => onProfile(row.profile)}
                  >
                    {row.profile.name}{' '}
                    {row.superPulse ? (
                      <span aria-label="Super Spike">
                        <SuperSpikeMark size={16} />
                      </span>
                    ) : index < 2 ? (
                      <BadgeCheck size={15} fill="#FF4D6D" color="#161618" />
                    ) : null}
                  </button>
                  <small>
                    {row.profile.intent} · {row.liked}
                  </small>
                  {row.note && <em className="incoming-note">{row.note}</em>}
                  <span className="decision-actions">
                    <button onClick={() => onPass(row.profile.name, row.id)}>
                      Not for me
                    </button>
                    <button
                      className="accept-like"
                      onClick={() => onLikeBack(row.profile, row.id)}
                    >
                      Accept
                    </button>
                  </span>
                </span>
              </div>
            ))}
            {visibleRows.length === 0 && (
              <div className="empty-likes-state">
                <p className="empty-likes">No likes match this filter.</p>
                <button type="button" onClick={onBrowse}>
                  Browse profiles
                </button>
              </div>
            )}
            <p className="likes-note">
              <BrandHeartMark size={16} /> Accept creates a match. “Not for me”
              removes the like privately.
            </p>
          </div>
        ) : (
          <div className="sent-likes">
            {sentLikes.length ? (
              sentLikes.map(({ profile, status }) => (
                <div className="sent-like" key={profile.name}>
                  <button
                    className="avatar incoming-profile-link"
                    onClick={() => onProfile(profile)}
                    aria-label={`Open ${profile.name}'s full profile`}
                  >
                    <Image
                      src={profile.image}
                      alt={profile.name}
                      fill
                      sizes="58px"
                      className="profile-photo"
                    />
                    <ProfileSpikeBadge />
                  </button>
                  <span>
                    <button
                      className="incoming-name-link"
                      onClick={() => onProfile(profile)}
                    >
                      {profile.name}
                    </button>
                    <small>
                      {status === 'accepted'
                        ? 'Matched — you can message now'
                        : 'Waiting for them to like you back'}
                    </small>
                  </span>
                  {status === 'accepted' ? (
                    <button
                      className="sent-message-button"
                      onClick={() => onMessage(profile)}
                    >
                      Message
                    </button>
                  ) : (
                    <span className="waiting-pill">Waiting</span>
                  )}
                </div>
              ))
            ) : (
              <p className="empty-likes">Profiles you like will appear here.</p>
            )}
          </div>
        )}
        {view === 'incoming' &&
          incomingFilter === 'all' &&
          membership === 'free' &&
          availableRows.length > visibleRows.length && (
            <button className="plus-link" onClick={onUpgrade}>
              See {availableRows.length - visibleRows.length} more with
              SpikeDate+ <ChevronRight size={16} />
            </button>
          )}
      </SheetContent>
    </Sheet>
  );
}

function MatchModal({
  open,
  onOpenChange,
  profile,
  room,
  onIcebreaker,
  onBrowse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  room: string | null;
  onIcebreaker: (text: string) => void;
  onBrowse: () => void;
}) {
  const place = room || 'Spike';
  const ideas =
    room === 'Tonight'
      ? ['Tacos at 8?', 'Pick the first song', 'Best late-night walk?']
      : ['What’s on repeat?', 'Ideal Sunday route?', 'Choose our first bite'];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="match-dialog">
        <button
          className="match-close"
          onClick={() => onOpenChange(false)}
          aria-label="Close match"
        >
          <X size={19} />
        </button>
        <div className="match-photos">
          <span>
            <Image
              src="/imani.png"
              alt="Your profile"
              fill
              sizes="92px"
              className="profile-photo"
            />
          </span>
          <i>
            <BrandHeartMark size={22} />
          </i>
          <span className="match-profile-badged">
            <Image
              src={profile.image}
              alt={`${profile.name}'s profile`}
              fill
              sizes="92px"
              className="profile-photo"
            />
            <ProfileSpikeBadge />
          </span>
        </div>
        <DialogTitle className="match-title">It’s a Spike</DialogTitle>
        <DialogDescription className="match-sub">
          You both liked each other in {place}
        </DialogDescription>
        <div className="icebreakers">
          {ideas.map((idea) => (
            <button key={idea} onClick={() => onIcebreaker(idea)}>
              {idea}
            </button>
          ))}
        </div>
        <button
          className="primary-button"
          onClick={() => onIcebreaker(ideas[0])}
        >
          <Send size={18} /> Send an opener
        </button>
        <button className="text-button" onClick={onBrowse}>
          Keep browsing
        </button>
      </DialogContent>
    </Dialog>
  );
}

function ChatList({
  contacts,
  onOpen,
  onProfile,
  onBrowse,
}: {
  contacts: ChatContact[];
  onOpen: (contact: ChatContact) => void;
  onProfile: (contact: ChatContact) => void;
  onBrowse: () => void;
}) {
  const [query, setQuery] = useState('');
  const visibleContacts = contacts.filter((contact) =>
    `${contact.name} ${contact.preview}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="screen scroll-screen chat-screen">
      <header className="page-header chat-page-header">
        <p className="eyebrow">YOUR SPIKES</p>
        <h1>Chats</h1>
        <p>
          Mutual matches only. Tap a photo for their profile or a message to
          continue the conversation.
        </p>
      </header>
      <label className="chat-search">
        <Search size={18} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search matches and messages"
          aria-label="Search chats"
        />
      </label>
      <div className="chat-list">
        {visibleContacts.map((contact) => (
          <div className="chat-row" key={contact.name}>
            <button
              className="chat-profile-link"
              onClick={() => onProfile(contact)}
              aria-label={`Open ${contact.name}'s full profile`}
            >
              <span className="avatar chat-avatar">
                <Image
                  src={contact.image}
                  alt={contact.name}
                  fill
                  sizes="62px"
                  className="profile-photo"
                />
                <ProfileSpikeBadge />
                {contact.active && <i />}
              </span>
            </button>
            <span className="chat-copy">
              <button
                className="chat-name-link"
                onClick={() => onProfile(contact)}
                aria-label={`Open ${contact.name}'s full profile`}
              >
                <strong>{contact.name}</strong>
              </button>
              <button
                className="chat-conversation"
                onClick={() => onOpen(contact)}
              >
                <small className={contact.unread ? 'unread-copy' : ''}>
                  {contact.preview}
                </small>
              </button>
            </span>
            <span className="chat-meta">
              <time>{contact.time}</time>
              {contact.unread ? (
                <b aria-label={`${contact.unread} unread messages`}>
                  {contact.unread}
                </b>
              ) : null}
            </span>
          </div>
        ))}
        {visibleContacts.length === 0 && (
          <div className="chat-empty-state">
            <MessageCircle size={24} />
            <strong>
              {query ? 'No conversations found' : 'No matches yet'}
            </strong>
            <p>
              {query
                ? 'Try a different name or message.'
                : 'A mutual Like unlocks chat.'}
            </p>
            {!query && <button onClick={onBrowse}>Browse profiles</button>}
          </div>
        )}
      </div>
    </section>
  );
}

function ChatThread({
  contact,
  messages,
  plan,
  composer,
  onComposer,
  onSend,
  onSendPreset,
  onPlan,
  onBack,
  onProfile,
  onSafety,
  onUnsend,
  onPlanDirections,
  onPlanCalendar,
  onPlanShare,
  onPlanRespond,
  onPlanSuggest,
  viewerEmail,
}: {
  contact: ChatContact;
  messages: ChatMessage[];
  plan?: DatingPlan;
  composer: string;
  onComposer: (text: string) => void;
  onSend: () => void;
  onSendPreset: (text: string) => void;
  onPlan: () => void;
  onBack: () => void;
  onProfile: () => void;
  onSafety: () => void;
  onUnsend: (id: number | string) => void;
  onPlanDirections: (plan: DatingPlan) => void;
  onPlanCalendar: (plan: DatingPlan) => void;
  onPlanShare: (plan: DatingPlan) => void;
  onPlanRespond: (plan: DatingPlan, status: 'accepted' | 'declined') => void;
  onPlanSuggest: (plan: DatingPlan) => void;
  viewerEmail: string;
}) {
  return (
    <section className="thread">
      <header className="thread-header">
        <button onClick={onBack} aria-label="Back to chats">
          <ArrowLeft size={22} />
        </button>
        <button
          className="avatar small thread-profile-link"
          onClick={onProfile}
          aria-label={`Open ${contact.name}'s full profile`}
        >
          <Image
            src={contact.image}
            alt={contact.name}
            fill
            sizes="42px"
            className="profile-photo"
          />
          <ProfileSpikeBadge compact />
        </button>
        <button className="thread-name-link" onClick={onProfile}>
          <strong>{contact.name}</strong>
          <small>
            {contact.active ? (
              <>
                <i /> Active now
              </>
            ) : (
              'Matched on SpikeDate'
            )}
          </small>
        </button>
        <button
          className="shield"
          onClick={onSafety}
          aria-label="Safety options"
        >
          <ShieldCheck size={22} />
        </button>
      </header>
      <div className="message-body">
        <div className="day-label">Your Spike · Today</div>
        {plan && (
          <article className="chat-plan-card">
            <div className="chat-plan-card-heading">
              <span>
                <MapPin size={19} />
              </span>
              <div>
                <small>
                  {plan.status === 'accepted'
                    ? 'CONFIRMED PLAN'
                    : 'PLAN INVITE'}
                </small>
                <strong>{plan.planName}</strong>
              </div>
              <em>{plan.status}</em>
            </div>
            <p>
              <CalendarDays size={15} />
              {new Date(`${plan.day}T${plan.time}`).toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}{' '}
              · {plan.durationMinutes} min
            </p>
            <p>
              <MapPin size={15} /> {plan.venue.name} · {plan.venue.address}
            </p>
            {plan.status === 'sent' &&
            plan.creatorEmail &&
            plan.creatorEmail !== viewerEmail ? (
              <div className="chat-plan-response-actions">
                <button onClick={() => onPlanRespond(plan, 'accepted')}>
                  Accept
                </button>
                <button onClick={() => onPlanSuggest(plan)}>
                  Suggest change
                </button>
                <button onClick={() => onPlanRespond(plan, 'declined')}>
                  Decline
                </button>
              </div>
            ) : (
              <div className="chat-plan-actions">
                <button onClick={() => onPlanDirections(plan)}>
                  Directions
                </button>
                <button onClick={() => onPlanCalendar(plan)}>Calendar</button>
                <button onClick={() => onPlanShare(plan)}>Share</button>
              </div>
            )}
          </article>
        )}
        {messages.length === 1 && (
          <div className="icebreakers inline">
            <button
              onClick={() => onComposer('What’s the best rooftop in Brooklyn?')}
            >
              Best rooftop?
            </button>
            <button onClick={() => onComposer('Pick our first song 🎵')}>
              Pick our first song
            </button>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`bubble-wrap ${message.mine ? 'mine' : ''}`}
          >
            <div className="bubble">{message.text}</div>
            <span className="message-status">
              {message.mine ? 'Delivered · now' : 'Today'}
            </span>
            {message.mine && (
              <button onClick={() => onUnsend(message.id)}>
                Unsend · 2m left
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="chat-quick-tools" aria-label="Message tools">
        <button type="button" onClick={() => onComposer('📷 Photo: ')}>
          <ImagePlus size={16} /> Photo
        </button>
        <button type="button" onClick={() => onSendPreset('🎙️ Voice message')}>
          <AudioLines size={16} /> Voice
        </button>
        {datePlansEnabled && (
          <button type="button" onClick={onPlan}>
            <CalendarPlus size={16} /> Plan a date
          </button>
        )}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <input
          value={composer}
          onChange={(e) => onComposer(e.target.value)}
          placeholder={`Message ${contact.name}`}
          aria-label={`Message ${contact.name}`}
        />
        <button type="submit" aria-label="Send message">
          <Send size={19} />
        </button>
      </form>
    </section>
  );
}

function AuthScreen({
  onSignIn,
  onCreate,
}: {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onCreate: (
    email: string,
    password: string,
    phoneVerificationToken?: string,
  ) => Promise<string | null>;
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [testEmail, setTestEmail] = useState(testIdentities[0].email);
  const [phone, setPhone] = useState('+1 ');
  const [phoneChallengeId, setPhoneChallengeId] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneToken, setPhoneToken] = useState('');
  const [phoneMasked, setPhoneMasked] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    if (!resendAt || resendAt <= Date.now()) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);
  const resendSeconds = Math.max(0, Math.ceil((resendAt - clock) / 1000));
  const chooseMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirm('');
    setPhoneChallengeId('');
    setPhoneCode('');
    setPhoneToken('');
    setPhoneMessage('');
  };
  const requestPhoneCode = async () => {
    setPhoneBusy(true);
    setError('');
    setPhoneMessage('');
    try {
      if (!serverDataEnabled) {
        setPhoneChallengeId('local-preview-phone');
        setPhoneMasked(`••• ••• ${phone.replace(/\D/g, '').slice(-4)}`);
        setPhoneMessage('Preview code: 123456');
      } else {
        const result = await serverJson<{
          challengeId: string;
          maskedPhone: string;
          testCode?: string;
        }>('/api/auth/phone/start', {
          method: 'POST',
          body: JSON.stringify({ phoneNumber: phone }),
        });
        setPhoneChallengeId(result.challengeId);
        setPhoneMasked(result.maskedPhone);
        setPhoneMessage(
          result.testCode ? `Local test code: ${result.testCode}` : 'Code sent',
        );
      }
      setClock(Date.now());
      setResendAt(Date.now() + 30_000);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setPhoneBusy(false);
    }
  };
  const verifyPhoneCode = async () => {
    setPhoneBusy(true);
    setError('');
    try {
      if (!serverDataEnabled) {
        if (phoneCode !== '123456')
          throw new Error('That code does not match.');
        setPhoneToken('local-preview-verified');
      } else {
        const result = await serverJson<{
          registrationToken: string;
          maskedPhone: string;
        }>('/api/auth/phone/verify', {
          method: 'POST',
          body: JSON.stringify({
            challengeId: phoneChallengeId,
            code: phoneCode,
          }),
        });
        setPhoneToken(result.registrationToken);
        setPhoneMasked(result.maskedPhone);
      }
      setPhoneMessage('Mobile number verified');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setPhoneBusy(false);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (
      mode === 'signup' &&
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)
    ) {
      setError('Use 8+ characters with uppercase, lowercase, and a number.');
      return;
    }
    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (mode === 'signup' && phoneVerificationEnabled && !phoneToken) {
      setError('Verify your mobile number before creating your account.');
      return;
    }
    setBusy(true);
    const message =
      mode === 'signin'
        ? await onSignIn(email, password)
        : await onCreate(email, password, phoneToken || undefined);
    if (message) setError(message);
    setBusy(false);
  };
  const useDemo = () => {
    setEmail('demo@spikedate.app');
    setPassword('SpikeDate2026!');
    setError('');
  };
  const useTestProfile = () => {
    setEmail(testEmail);
    setPassword(testPassword);
    setError('');
  };
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-label="SpikeDate account access">
        <div className="auth-brand">
          <SpikeDateWordmark context="auth" />
        </div>
        <div className="auth-copy">
          <p className="eyebrow">REAL CONNECTIONS START HERE</p>
          <h1>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
          <p>
            {mode === 'signin'
              ? 'Sign in to continue matching, messaging, and managing your profile.'
              : 'Your registration starts right after your account is secured.'}
          </p>
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Account action">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => chooseMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => chooseMode('signup')}
          >
            Create account
          </button>
        </div>
        <form className="auth-form" noValidate onSubmit={submit}>
          {mode === 'signup' && phoneVerificationEnabled && (
            <section className="auth-phone-verification">
              <div className="auth-phone-heading">
                <span>
                  <small>SECURE YOUR ACCOUNT</small>
                  <strong>Verify your mobile</strong>
                </span>
                {phoneToken && <BadgeCheck size={21} aria-label="Verified" />}
              </div>
              {!phoneToken && (
                <label>
                  Mobile number
                  <div className="auth-phone-row">
                    <input
                      aria-label="Mobile number"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+1 212 555 0188"
                    />
                    <button
                      type="button"
                      onClick={requestPhoneCode}
                      disabled={phoneBusy || resendSeconds > 0}
                    >
                      {resendSeconds
                        ? `${resendSeconds}s`
                        : phoneChallengeId
                          ? 'Resend'
                          : 'Send code'}
                    </button>
                  </div>
                </label>
              )}
              {phoneChallengeId && !phoneToken && (
                <label>
                  Code sent to {phoneMasked}
                  <div className="auth-phone-row code">
                    <input
                      aria-label="Six-digit verification code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={phoneCode}
                      onChange={(event) =>
                        setPhoneCode(event.target.value.replace(/\D/g, ''))
                      }
                      placeholder="000000"
                    />
                    <button
                      type="button"
                      onClick={verifyPhoneCode}
                      disabled={phoneBusy || phoneCode.length !== 6}
                    >
                      Verify
                    </button>
                  </div>
                </label>
              )}
              {phoneToken && (
                <div className="auth-phone-success">
                  <BadgeCheck size={18} />
                  <span>
                    <strong>{phoneMasked}</strong>
                    <small>Verified and kept private</small>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneToken('');
                      setPhoneChallengeId('');
                      setPhoneCode('');
                    }}
                  >
                    Change
                  </button>
                </div>
              )}
              {phoneMessage && !phoneToken && (
                <p className="auth-phone-message" role="status">
                  {phoneMessage}
                </p>
              )}
              <p className="auth-phone-privacy">
                <LockKeyhole size={14} /> Your number never appears on your
                profile.
              </p>
            </section>
          )}
          <label>
            Email
            <input
              aria-label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              aria-label="Password"
              type="password"
              autoComplete={
                mode === 'signin' ? 'current-password' : 'new-password'
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </label>
          {mode === 'signup' && (
            <label>
              Confirm password
              <input
                aria-label="Confirm password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="••••••••"
              />
            </label>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={busy}
          >
            {busy
              ? 'Please wait…'
              : mode === 'signin'
                ? 'Sign in to SpikeDate'
                : 'Create account'}
          </button>
        </form>
        {mode === 'signin' && (
          <div className="test-login-panel">
            <label>
              Test as a registered profile
              <select
                aria-label="Test profile"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
              >
                {testIdentities.map((identity) => (
                  <option key={identity.email} value={identity.email}>
                    {identity.profile.name} · {identity.profile.gender}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="demo-login"
              type="button"
              onClick={useTestProfile}
            >
              <UserRound size={17} />
              <span>
                <strong>Fill selected test login</strong>
                <small>
                  {testEmail} · {testPassword}
                </small>
              </span>
            </button>
            <button
              className="demo-login compact"
              type="button"
              onClick={useDemo}
            >
              <LockKeyhole size={17} />
              <span>
                <strong>Use general demo</strong>
                <small>demo@spikedate.app · {testPassword}</small>
              </span>
            </button>
          </div>
        )}
        <p className="auth-privacy">
          <ShieldCheck size={15} /> Passwords are hashed in this
          production-style prototype.
        </p>
      </section>
    </main>
  );
}

function YourProfile({
  name,
  email,
  image,
  details,
  registered,
  theme,
  availability,
  onPreview,
  onRegistration,
  onEditSection,
  onTheme,
  onSubscription,
  verificationStatus,
  onVerification,
  superPulsesRemaining,
  membership,
  dailyLikesRemaining,
  engagementPreferences,
  onEngagementPreference,
  pushPreferences,
  onPushPreference,
  onQuietHours,
  todayReminderTime,
  onTodayReminderTime,
  onVoice,
  voiceDeploymentEnabled,
  voiceEnabled,
  onVoiceEnabled,
  onLogout,
  todayStory,
  onCreateToday,
  onEditToday,
  onDeleteToday,
}: {
  name: string;
  email: string;
  image: string;
  details: RegistrationData;
  registered: boolean;
  theme: ThemeName;
  availability?: DailyAvailability;
  onPreview: () => void;
  onRegistration: () => void;
  onEditSection: (step: number) => void;
  onTheme: () => void;
  onSubscription: () => void;
  verificationStatus: PhotoVerificationStatus;
  onVerification: () => void;
  superPulsesRemaining: number;
  membership: Membership;
  dailyLikesRemaining: number;
  engagementPreferences: EngagementPreferences;
  onEngagementPreference: (
    key: keyof EngagementPreferences,
    checked: boolean,
  ) => void;
  pushPreferences: PushPreferences;
  onPushPreference: (
    key: Exclude<keyof PushPreferences, 'quietHours'>,
    checked: boolean,
  ) => void;
  onQuietHours: (enabled: boolean) => void;
  todayReminderTime: TodayReminderTime;
  onTodayReminderTime: (time: TodayReminderTime) => void;
  onVoice: () => void;
  voiceDeploymentEnabled: boolean;
  voiceEnabled: boolean;
  onVoiceEnabled: (checked: boolean) => void;
  onLogout: () => void;
  todayStory?: DailyStory;
  onCreateToday: () => void;
  onEditToday: (story: DailyStory) => void;
  onDeleteToday: () => void;
}) {
  const [todayDeleteConfirm, setTodayDeleteConfirm] = useState(false);
  useEffect(() => setTodayDeleteConfirm(false), [todayStory?.id]);
  const birthday = new Date(`${details.birthday}T00:00:00`).toLocaleDateString(
    undefined,
    { month: 'long', day: 'numeric', year: 'numeric' },
  );
  const optionalProfileDetails = [
    details.pronouns,
    details.orientation,
    details.bio,
    details.height,
    details.ethnicity,
    details.occupation,
    details.education,
    details.religion,
    details.politics,
    details.zodiac,
    details.exercise,
    details.diet,
    details.socialStyle,
    details.relationshipStyle,
    details.loveLanguage,
    details.promptOne,
    details.promptTwo,
  ];
  const profileDepth = Math.round(
    ((optionalProfileDetails.filter(Boolean).length +
      Math.min(details.languages.length, 1) +
      Math.min(details.interests.length, 1) +
      Math.min(details.values.length, 1)) /
      (optionalProfileDetails.length + 3)) *
      100,
  );
  const birthDate = new Date(`${details.birthday}T00:00:00`);
  const today = new Date();
  const profileAge =
    today.getFullYear() -
    birthDate.getFullYear() -
    (today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate())
      ? 1
      : 0);
  const todayHoursLeft = todayStory
    ? Math.max(
        1,
        Math.ceil(
          (new Date(todayStory.expiresAt).getTime() - Date.now()) /
            (60 * 60 * 1000),
        ),
      )
    : 0;
  const dailyPrompt =
    todayPrompts[Math.floor(Date.now() / 86_400_000) % todayPrompts.length];
  const missingProfileDetails = [
    !details.bio && 'bio',
    !details.occupation && 'work',
    !details.education && 'education',
    !details.promptOne && 'first prompt',
    !details.promptTwo && 'second prompt',
    details.interests.length === 0 && 'interests',
  ].filter(Boolean) as string[];
  return (
    <section className="screen scroll-screen profile-page">
      <header className="profile-passport-hero">
        <Image
          src={image}
          alt="Your profile"
          fill
          priority
          sizes="(max-width: 560px) 100vw, 460px"
          quality={90}
          unoptimized={
            image.startsWith('/api/media/') || image.startsWith('data:')
          }
          className="profile-passport-photo"
        />
        <div className="profile-passport-topbar">
          <button
            type="button"
            className="profile-preview-trigger"
            onClick={onPreview}
            aria-label="Preview my profile card"
          >
            <UserRound size={15} /> Profile preview
          </button>
          <button
            type="button"
            onClick={() =>
              todayStory ? onEditToday(todayStory) : onCreateToday()
            }
          >
            <Plus size={15} /> Today
          </button>
        </div>
        <div className="profile-passport-identity self-row">
          <div>
            <h1>
              {name}, {profileAge}{' '}
              {(verificationStatus === 'photo_verified' ||
                verificationStatus === 'identity_verified') && (
                <BadgeCheck size={19} aria-label="Photo Verified" />
              )}
            </h1>
            <p>
              {details.city}
              {details.occupation ? ` · ${details.occupation}` : ''}
            </p>
            <p>{email}</p>
          </div>
          <button aria-label="Edit profile" onClick={onRegistration}>
            <Edit3 size={19} />
          </button>
        </div>
      </header>
      <section className="today-profile-manager" aria-label="Your Today status">
        <button
          type="button"
          className={`today-profile-card ${todayStory || availability ? 'has-story' : ''}`}
          onClick={() =>
            todayStory ? onEditToday(todayStory) : onCreateToday()
          }
        >
          <span className="today-profile-preview">
            <Image
              src={todayStory?.mediaUrl || image}
              alt=""
              fill
              sizes="56px"
              className="profile-photo"
            />
            {!todayStory && <Plus size={19} />}
          </span>
          <span>
            <small>YOUR TODAY</small>
            <strong>
              {todayStory?.caption ||
                (availability
                  ? availabilitySummary(availability)
                  : dailyPrompt)}
            </strong>
            <em>
              {[
                todayStory
                  ? `${todayStory.viewedBy.length} views · ${todayHoursLeft}h left`
                  : '',
                availability ? availabilitySummary(availability) : '',
              ]
                .filter(Boolean)
                .join(' · ') || 'Share an update, your availability, or both'}
            </em>
          </span>
          <ChevronRight size={17} />
        </button>
        {(todayStory || availability) && (
          <div className="today-profile-actions" aria-label="Manage Today post">
            <button
              type="button"
              onClick={() =>
                todayStory ? onEditToday(todayStory) : onCreateToday()
              }
            >
              <Edit3 size={15} /> Edit Today
            </button>
            {todayStory && (
              <button
                type="button"
                className="danger"
                onClick={() => setTodayDeleteConfirm(true)}
              >
                <Trash2 size={15} /> Delete update
              </button>
            )}
          </div>
        )}
        {todayStory && todayDeleteConfirm && (
          <div className="today-delete-confirm" role="alert">
            <span>
              <strong>Delete this post?</strong>
              <small>It will disappear for everyone.</small>
            </span>
            <button type="button" onClick={() => setTodayDeleteConfirm(false)}>
              Keep post
            </button>
            <button type="button" className="danger" onClick={onDeleteToday}>
              Delete now
            </button>
          </div>
        )}
      </section>
      <nav className="profile-section-nav" aria-label="Profile sections">
        <button
          type="button"
          onClick={() =>
            document
              .getElementById('profile-details')
              ?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          My profile
        </button>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById('profile-settings')
              ?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          Settings
        </button>
      </nav>
      <button className="profile-intent-card" onClick={() => onEditSection(4)}>
        <BrandHeartMark size={21} />
        <span>
          <small>Dating intention</small>
          <strong>{details.intents.join(' · ') || 'Add what you want'}</strong>
        </span>
        <Edit3 size={16} />
      </button>
      <div className="profile-passport-facts" aria-label="Profile highlights">
        <button onClick={() => onEditSection(1)}>
          <Ruler size={18} />
          <small>Height</small>
          <strong>{details.height || 'Add'}</strong>
        </button>
        <button onClick={() => onEditSection(2)}>
          <Baby size={18} />
          <small>Family</small>
          <strong>
            {details.wantsKids ? `Kids: ${details.wantsKids}` : 'Add'}
          </strong>
        </button>
        <button onClick={() => onEditSection(3)}>
          <Wine size={18} />
          <small>Drinking</small>
          <strong>{details.drinking || 'Add'}</strong>
        </button>
        <button onClick={() => onEditSection(3)}>
          <CigaretteOff size={18} />
          <small>Smoking</small>
          <strong>
            {details.smoking === 'No' ? 'Never' : details.smoking || 'Add'}
          </strong>
        </button>
      </div>
      <button className="profile-story-card" onClick={() => onEditSection(6)}>
        <span>
          <small>MY STORY</small>
          <strong>{details.bio || 'Add a short story about yourself'}</strong>
        </span>
        <Edit3 size={16} />
      </button>
      <button
        className="profile-interest-strip"
        onClick={() => onEditSection(5)}
        aria-label="Edit interests"
      >
        {details.interests.slice(0, 4).map((interest) => (
          <span key={interest}>{interest}</span>
        ))}
        {details.interests.length > 4 && (
          <span>+{details.interests.length - 4}</span>
        )}
        <Edit3 size={15} />
      </button>
      <p className="passport-details-title" id="profile-details">
        <span>PROFILE DETAILS</span>
        <small>
          {registered
            ? missingProfileDetails.length
              ? `${profileDepth}% · add ${missingProfileDetails.slice(0, 2).join(' + ')}`
              : `${profileDepth}% complete`
            : `${profileDepth}% · finish required details`}
        </small>
      </p>
      <div className="settings-list passport-details-list">
        <section>
          <div className="setting-heading">
            <span>
              <small>1 · THE BASICS</small>
              <strong>
                {name} · {birthday} · {details.city}
              </strong>
            </span>
          </div>
          <p>{details.city}</p>
          <button className="section-edit" onClick={() => onEditSection(0)}>
            <Edit3 size={15} /> Edit basics
          </button>
        </section>
        <section>
          <div className="setting-heading">
            <span>
              <small>2 · ABOUT YOU</small>
              <strong>
                {[
                  details.gender,
                  details.pronouns,
                  details.height,
                  details.ethnicity,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </strong>
            </span>
          </div>
          <p>
            {[details.orientation, details.height, details.ethnicity]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="profile-detail-lines">
            {details.occupation && <span>{details.occupation}</span>}
            {details.education && <span>{details.education}</span>}
            {details.languages.length > 0 && (
              <span>{details.languages.join(', ')}</span>
            )}
          </div>
          <div className="detail-chips">
            {details.religion && <span>{details.religion}</span>}
            {details.politics && <span>{details.politics}</span>}
            {details.zodiac && <span>{details.zodiac}</span>}
          </div>
          <button className="section-edit" onClick={() => onEditSection(1)}>
            <Edit3 size={15} /> Edit about you
          </button>
        </section>
        <section>
          <div className="setting-heading">
            <span>
              <small>3 · FAMILY & PETS</small>
              <strong>
                {details.pets} · {details.kids} · Wants kids:{' '}
                {details.wantsKids}
              </strong>
            </span>
          </div>
          <p>Wants children: {details.wantsKids}</p>
          <button className="section-edit" onClick={() => onEditSection(2)}>
            <Edit3 size={15} /> Edit family & pets
          </button>
        </section>
        <section>
          <div className="setting-heading">
            <span>
              <small>4 · LIFESTYLE</small>
              <strong>
                {details.drinking} drinking ·{' '}
                {details.smoking === 'No'
                  ? 'Doesn’t smoke'
                  : `${details.smoking} smoking`}
              </strong>
            </span>
          </div>
          <div className="detail-chips">
            {details.exercise && <span>Exercise: {details.exercise}</span>}
            {details.diet && <span>{details.diet}</span>}
            {details.socialStyle && <span>{details.socialStyle}</span>}
          </div>
          <button className="section-edit" onClick={() => onEditSection(3)}>
            <Edit3 size={15} /> Edit lifestyle
          </button>
        </section>
        <section>
          <div className="setting-heading">
            <span>
              <small>5 · RELATIONSHIP GOALS</small>
              <strong>{details.intents.join(' · ')}</strong>
            </span>
          </div>
          <div className="detail-chips coral">
            {details.intents.map((intent) => (
              <span key={intent}>{intent}</span>
            ))}
          </div>
          <div className="profile-detail-lines">
            {details.relationshipStyle && (
              <span>{details.relationshipStyle}</span>
            )}
            {details.loveLanguage && (
              <span>Love language: {details.loveLanguage}</span>
            )}
          </div>
          <button className="section-edit" onClick={() => onEditSection(4)}>
            <Edit3 size={15} /> Edit relationship goals
          </button>
        </section>
        <section>
          <div className="setting-heading">
            <span>
              <small>6 · INTERESTS · {details.interests.length} OF 5</small>
              <strong>
                {details.interests.join(' · ') || 'Add interests'}
              </strong>
            </span>
          </div>
          <div className="detail-chips">
            {details.interests.map((interest) => (
              <span key={interest}>{interest}</span>
            ))}
          </div>
          {details.values.length > 0 && (
            <div className="detail-chips coral">
              {details.values.map((value) => (
                <span key={value}>{value}</span>
              ))}
            </div>
          )}
          <button className="section-edit" onClick={() => onEditSection(5)}>
            <Edit3 size={15} /> Edit interests
          </button>
        </section>
        <section>
          <div className="setting-heading">
            <span>
              <small>7 · STORY & PROMPTS</small>
              <strong>
                {details.bio || details.promptOne || 'Add your story'}
              </strong>
            </span>
          </div>
          {details.bio && <p className="profile-bio">{details.bio}</p>}
          <strong className="second-prompt">“My ideal Sunday…”</strong>
          <p>{details.promptOne}</p>
          <strong className="second-prompt">
            “The quickest way to my heart…”
          </strong>
          <p>{details.promptTwo}</p>
          <button className="section-edit" onClick={() => onEditSection(6)}>
            <Edit3 size={15} /> Edit prompts
          </button>
        </section>
        <section>
          <div className="setting-heading">
            <span>
              <small>8 · PREFERENCES & MEDIA</small>
              <strong>
                {details.preferredGenders.join(', ')} · Ages {details.minAge}–
                {details.maxAge} · {details.maxDistance} mi
              </strong>
            </span>
          </div>
          <p>
            Ages {details.minAge}–{details.maxAge} · within{' '}
            {details.maxDistance} miles
          </p>
          <div className="detail-chips">
            <span>1 main photo</span>
            <span>Up to 6 photos</span>
            <span>1 video</span>
          </div>
          <button className="section-edit" onClick={() => onEditSection(7)}>
            <Edit3 size={15} /> Edit preferences & media
          </button>
        </section>
      </div>
      <div className="profile-account-tools" id="profile-settings">
        <p className="profile-tools-label">APP &amp; ACCOUNT</p>
        <div className="profile-quick-actions lower-profile-tools">
          <button className="verification-entry" onClick={onVerification}>
            <ShieldCheck size={20} />
            <span>
              <strong>
                {verificationStatus === 'photo_verified' ||
                verificationStatus === 'identity_verified'
                  ? 'Photo Verified'
                  : verificationStatus === 'needs_review' ||
                      verificationStatus === 'pending'
                    ? 'Camera check pending'
                    : 'Verify your photos'}
              </strong>
              <small>
                {verificationStatus === 'photo_verified' ||
                verificationStatus === 'identity_verified'
                  ? 'A live camera check matches this profile'
                  : 'Private camera check · no selfie on your profile'}
              </small>
            </span>
            {verificationStatus === 'photo_verified' ||
            verificationStatus === 'identity_verified' ? (
              <BadgeCheck size={19} className="verification-entry-badge" />
            ) : (
              <ChevronRight size={17} />
            )}
          </button>
          <button onClick={onSubscription}>
            <Star size={19} fill="currentColor" />
            <span>
              <strong>
                {membership === 'plus' ? 'SpikeDate+' : 'Free plan'}
              </strong>
              <small>
                {membership === 'plus'
                  ? `Unlimited Likes · ${superPulsesRemaining} of 3 Super Spikes`
                  : `${dailyLikesRemaining} Likes today · ${superPulsesRemaining} Super Spikes available`}
              </small>
            </span>
            <ChevronRight size={17} />
          </button>
          <button onClick={onTheme}>
            <Palette size={19} />
            <span>
              <strong>App theme</strong>
              <small>{themeLabels[theme]} · 6 choices</small>
            </span>
            <ChevronRight size={17} />
          </button>
          {voiceDeploymentEnabled && voiceEnabled && (
            <button onClick={onVoice}>
              <Volume2 size={19} />
              <span>
                <strong>Activity briefing</strong>
                <small>Likes, matches, messages, and profile picks</small>
              </span>
              <ChevronRight size={17} />
            </button>
          )}
        </div>
        <section className="engagement-settings-card">
          <div className="setting-heading">
            <span>
              <small>CONNECTION REMINDERS</small>
              <strong>Thoughtful nudges</strong>
            </span>
            <Bell size={19} />
          </div>
          {(
            [
              [
                'today',
                'Daily Today idea',
                'One gentle reminder only when you have no active post.',
              ],
              [
                'like',
                'Profile review',
                'Remind me when fresh profiles are ready.',
              ],
              [
                'boost',
                'Profile Lift opportunities',
                'Only when your profile and nearby activity make it useful.',
              ],
              [
                'super',
                'Super Spike suggestions',
                'After you spend time on a full profile.',
              ],
            ] as const
          ).map(([key, title, description]) => (
            <div className="engagement-setting-toggle" key={key}>
              <span>
                <strong>{title}</strong>
                <p>{description}</p>
              </span>
              <Switch
                checked={engagementPreferences[key]}
                onCheckedChange={(checked) =>
                  onEngagementPreference(key, checked)
                }
                aria-label={`Enable ${title}`}
              />
            </div>
          ))}
          {engagementPreferences.today && (
            <label className="today-reminder-time">
              <span>
                <strong>Preferred reminder time</strong>
                <p>Shown only when you open SpikeDate after this time.</p>
              </span>
              <select
                aria-label="Today reminder time"
                value={todayReminderTime}
                onChange={(event) =>
                  onTodayReminderTime(event.target.value as TodayReminderTime)
                }
              >
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </select>
            </label>
          )}
        </section>
        <section className="push-settings-card">
          <div className="setting-heading">
            <span>
              <small>NOTIFICATIONS</small>
              <strong>Only the updates that matter</strong>
            </span>
            <Bell size={19} />
          </div>
          {(
            [
              ['newMatches', 'New matches'],
              ['messages', 'New messages'],
              ['newLikes', 'New likes'],
              ['planUpdates', 'Date-plan updates'],
              ['activityBriefing', 'Daily activity briefing'],
            ] as const
          ).map(([key, title]) => (
            <div className="push-setting-toggle" key={key}>
              <span>
                <strong>{title}</strong>
                <p>
                  {key === 'activityBriefing'
                    ? 'One scheduled summary instead of repeated prompts.'
                    : 'Delivered in-app; push is used only on registered devices.'}
                </p>
              </span>
              <Switch
                checked={pushPreferences[key]}
                onCheckedChange={(checked) => onPushPreference(key, checked)}
                aria-label={`Enable ${title} notifications`}
              />
            </div>
          ))}
          <div className="push-setting-toggle">
            <span>
              <strong>Quiet hours</strong>
              <p>Silence non-urgent push alerts from 10 PM to 8 AM.</p>
            </span>
            <Switch
              checked={Boolean(pushPreferences.quietHours)}
              onCheckedChange={onQuietHours}
              aria-label="Enable notification quiet hours"
            />
          </div>
        </section>
        {voiceDeploymentEnabled && (
          <section className="voice-settings-card">
            <div className="setting-heading">
              <span>
                <small>ACTIVITY BRIEFING</small>
                <strong>Daily announcements</strong>
              </span>
              <Volume2 size={19} />
            </div>
            <div className="voice-setting-toggle">
              <span>
                <strong>Spoken activity summary</strong>
                <p>
                  Hear your new likes, matches, messages, and profile picks.
                </p>
              </span>
              <Switch
                checked={voiceEnabled}
                onCheckedChange={onVoiceEnabled}
                aria-label="Enable activity briefings"
              />
            </div>
          </section>
        )}
      </div>
      <button className="primary-button preview-button" onClick={onPreview}>
        Preview my card <ChevronRight size={18} />
      </button>
      <button className="logout-button" onClick={onLogout}>
        <LogOut size={18} /> Log out
      </button>
    </section>
  );
}

function ProfilePreview({
  name,
  sourceProfile,
  media,
  details,
  onBack,
}: {
  name: string;
  sourceProfile?: Profile;
  media: MediaItem[];
  details: RegistrationData;
  onBack: () => void;
}) {
  const base: Profile = sourceProfile ?? {
    name,
    age: 28,
    gender: 'Nonbinary',
    image: '/imani.png',
    media: [{ type: 'photo', src: '/imani.png' }],
    place: 'Fort Greene',
    distance: '3 miles away',
    distanceMiles: 3,
    intent: details.intents[0] ?? 'Long-term',
    tags: details.interests.slice(0, 2),
    prompt: details.promptOne,
    height: details.height,
    ethnicity: details.ethnicity,
    pets: details.pets,
    kids: details.kids,
    wantsKids: details.wantsKids,
    drinking: details.drinking,
    smoking: details.smoking,
  };
  const self: Profile = media.length
    ? {
        ...base,
        image: media.find((item) => item.type === 'photo')?.src ?? base.image,
        media,
      }
    : base;
  return (
    <section className="preview-screen">
      <header className="preview-banner">
        <button onClick={onBack} aria-label="Back to profile">
          <ArrowLeft size={21} />
        </button>
        <span>
          <strong>This is how you appear</strong>
          <small>What people see in Spike</small>
        </span>
      </header>
      <div className="preview-wrap">
        <ProfileCard profile={self} preview />
        <button className="edit-card">
          <Edit3 size={18} /> Edit card
        </button>
      </div>
    </section>
  );
}

const registrationSteps = [
  {
    title: 'The basics',
    detail: 'Required: your first name, adult birthday, and city.',
  },
  {
    title: 'About you',
    detail: 'Gender is required. Everything else here is optional.',
  },
  {
    title: 'Family & pets',
    detail: 'Optional details that help surface real-life compatibility.',
  },
  {
    title: 'Lifestyle',
    detail: 'Optional habits that can matter in a relationship.',
  },
  {
    title: 'Relationship goals',
    detail: 'Required: choose at least one honest relationship goal.',
  },
  {
    title: 'Your interests',
    detail: 'Optional: add up to five interests and five values.',
  },
  {
    title: 'Your story',
    detail: 'Optional details give matches something real to message.',
  },
  {
    title: 'Preferences & media',
    detail: 'Required discovery preferences, plus your profile media.',
  },
];

const initialRegistration: RegistrationData = {
  name: 'Alex',
  birthday: '1998-04-18',
  city: 'Brooklyn',
  gender: 'Nonbinary',
  pronouns: 'they/them',
  orientation: '',
  bio: '',
  height: '5′9″',
  ethnicity: 'Multiracial',
  languages: [],
  occupation: '',
  education: '',
  religion: '',
  politics: '',
  zodiac: '',
  pets: 'Has a dog',
  kids: 'No kids',
  wantsKids: 'Yes',
  drinking: 'Socially',
  smoking: 'No',
  exercise: '',
  diet: '',
  socialStyle: '',
  intents: ['Long-term', 'Marriage'],
  relationshipStyle: '',
  loveLanguage: '',
  interests: ['Cooking', 'Live music', 'Pets'],
  values: [],
  promptOne: 'Outside early, somewhere cozy by dinner.',
  promptTwo: 'Teach me the recipe you never write down.',
  preferredGenders: ['Woman', 'Man'],
  minAge: 25,
  maxAge: 36,
  maxDistance: 15,
};

function normalizeRegistration(
  value: Partial<RegistrationData>,
): RegistrationData {
  return {
    ...initialRegistration,
    ...value,
    intents: value.intents ?? initialRegistration.intents,
    interests: value.interests ?? initialRegistration.interests,
    values: value.values ?? [],
    languages: value.languages ?? [],
    preferredGenders:
      value.preferredGenders ?? initialRegistration.preferredGenders,
  };
}

function RegistrationDialog({
  open,
  onOpenChange,
  onComplete,
  initialData,
  initialStep,
  editing,
  singleSection,
  media,
  onAddPhoto,
  onAddVideo,
  onMakeMainPhoto,
  onRemovePhoto,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (data: RegistrationData) => void;
  initialData: RegistrationData;
  initialStep: number;
  editing: boolean;
  singleSection: boolean;
  media: MediaItem[];
  onAddPhoto: (photo: CroppedPhoto) => Promise<void>;
  onAddVideo: (file: File) => Promise<void>;
  onMakeMainPhoto: (media: MediaItem) => void;
  onRemovePhoto: (media: MediaItem) => void;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<RegistrationData>(initialData);
  const [validationError, setValidationError] = useState('');
  const [showOptionalAbout, setShowOptionalAbout] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  useEffect(() => {
    if (open) {
      setStep(Math.max(0, Math.min(registrationSteps.length - 1, initialStep)));
      setData(initialData);
      setValidationError('');
      setShowOptionalAbout(editing && initialStep === 1);
      setCropFile(null);
      setCropOpen(false);
    }
  }, [open, initialData, initialStep]);
  const item = registrationSteps[step];
  const photos = media.filter((item) => item.type === 'photo').slice(0, 6);
  const profileVideo = media.find((item) => item.type === 'video');
  const chooseProfilePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setValidationError('Choose a photo from your library or camera.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setValidationError('Choose a photo smaller than 15 MB.');
      return;
    }
    setValidationError('');
    setCropFile(file);
    setCropOpen(true);
  };
  const update = <K extends keyof RegistrationData>(
    key: K,
    value: RegistrationData[K],
  ) => {
    setValidationError('');
    setData((current) => ({ ...current, [key]: value }));
  };
  const toggle = (
    key: 'intents' | 'interests' | 'values' | 'preferredGenders',
    value: string,
    max = 99,
  ) => {
    setValidationError('');
    setData((current) => {
      const items = current[key] as string[];
      const next = items.includes(value)
        ? items.filter((item) => item !== value)
        : items.length < max
          ? [...items, value]
          : items;
      return { ...current, [key]: next };
    });
  };
  const validateCurrentStep = () => {
    if (step === 0) {
      if (!data.name.trim() || !data.birthday || !data.city.trim())
        return 'First name, birthday, and city are required.';
      const birthday = new Date(`${data.birthday}T00:00:00`);
      const adultDate = new Date();
      adultDate.setFullYear(adultDate.getFullYear() - 18);
      if (Number.isNaN(birthday.valueOf()) || birthday > adultDate)
        return 'You must be at least 18 to use SpikeDate.';
    }
    if (step === 4 && data.intents.length === 0)
      return 'Choose at least one relationship goal.';
    if (step === 7) {
      if (data.preferredGenders.length === 0)
        return 'Choose at least one gender preference.';
      if (data.minAge > data.maxAge)
        return 'Minimum age cannot be higher than maximum age.';
    }
    return '';
  };
  const saveOrContinue = () => {
    const error = validateCurrentStep();
    if (error) {
      setValidationError(error);
      return;
    }
    if (singleSection || step === registrationSteps.length - 1)
      onComplete(data);
    else setStep((value) => value + 1);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flow-dialog registration-dialog"
      >
        <button
          className="match-close"
          onClick={() => onOpenChange(false)}
          aria-label="Close registration"
        >
          <X size={19} />
        </button>
        <div className="flow-kicker">
          REGISTRATION · {step + 1} OF {registrationSteps.length}
        </div>
        <div className="flow-progress">
          {registrationSteps.map((_, index) => (
            <span key={index} className={index <= step ? 'active' : ''} />
          ))}
        </div>
        <DialogTitle>{item.title}</DialogTitle>
        <DialogDescription>{item.detail}</DialogDescription>
        <div className="field-policy">
          <ShieldCheck size={15} />
          <span>
            Only fields marked Required block setup. Skip anything else and add
            it later.
          </span>
        </div>
        <div className="registration-body">
          {step === 0 && (
            <div className="field-grid">
              <label>
                <span className="field-label">
                  First name <b>Required</b>
                </span>
                <input
                  aria-label="First name"
                  value={data.name}
                  onChange={(event) => update('name', event.target.value)}
                />
              </label>
              <label>
                <span className="field-label">
                  Birthday <b>Required</b>
                </span>
                <input
                  aria-label="Birthday"
                  type="date"
                  value={data.birthday}
                  onChange={(event) => update('birthday', event.target.value)}
                />
              </label>
              <label className="wide-field">
                <span className="field-label">
                  City <b>Required</b>
                </span>
                <input
                  aria-label="City"
                  value={data.city}
                  onChange={(event) => update('city', event.target.value)}
                />
              </label>
            </div>
          )}
          {step === 1 && (
            <div
              className={`field-grid about-fields ${showOptionalAbout ? 'expanded' : ''}`}
            >
              <label>
                <span className="field-label">
                  Gender <b>Required</b>
                </span>
                <select
                  aria-label="Gender"
                  value={data.gender}
                  onChange={(event) =>
                    update('gender', event.target.value as Gender)
                  }
                >
                  <option>Woman</option>
                  <option>Man</option>
                  <option>Nonbinary</option>
                </select>
              </label>
              <button
                type="button"
                className="optional-fields-toggle"
                aria-expanded={showOptionalAbout}
                onClick={() => setShowOptionalAbout((value) => !value)}
              >
                <Plus size={16} />
                {showOptionalAbout
                  ? 'Hide optional details'
                  : 'Add optional details'}
                <small>Pronouns, orientation, work, education and more</small>
              </button>
              <label>
                Pronouns
                <input
                  aria-label="Pronouns"
                  value={data.pronouns}
                  onChange={(event) => update('pronouns', event.target.value)}
                />
              </label>
              <label>
                Orientation · Optional
                <select
                  aria-label="Orientation"
                  value={data.orientation}
                  onChange={(event) =>
                    update('orientation', event.target.value)
                  }
                >
                  <option value="">Prefer not to say</option>
                  <option>Straight</option>
                  <option>Gay</option>
                  <option>Lesbian</option>
                  <option>Bisexual</option>
                  <option>Pansexual</option>
                  <option>Queer</option>
                  <option>Questioning</option>
                </select>
              </label>
              <label>
                Height
                <input
                  aria-label="Height"
                  value={data.height}
                  onChange={(event) => update('height', event.target.value)}
                />
              </label>
              <label>
                Ethnicity
                <select
                  aria-label="Ethnicity"
                  value={data.ethnicity}
                  onChange={(event) => update('ethnicity', event.target.value)}
                >
                  <option>Multiracial</option>
                  <option>Asian</option>
                  <option>Black</option>
                  <option>Latino</option>
                  <option>Middle Eastern</option>
                  <option>Native</option>
                  <option>White</option>
                  <option>Prefer not to say</option>
                </select>
              </label>
              <label>
                Work or role · Optional
                <input
                  aria-label="Work"
                  value={data.occupation}
                  onChange={(event) => update('occupation', event.target.value)}
                  placeholder="Designer, teacher, founder…"
                />
              </label>
              <label>
                Education · Optional
                <input
                  aria-label="Education"
                  value={data.education}
                  onChange={(event) => update('education', event.target.value)}
                  placeholder="School or education"
                />
              </label>
              <label className="wide-field">
                Languages · Optional
                <input
                  aria-label="Languages"
                  value={data.languages.join(', ')}
                  onChange={(event) =>
                    update(
                      'languages',
                      event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="English, Spanish"
                />
              </label>
              <label>
                Faith or beliefs · Optional
                <select
                  aria-label="Faith or beliefs"
                  value={data.religion}
                  onChange={(event) => update('religion', event.target.value)}
                >
                  <option value="">Skip</option>
                  <option>Agnostic</option>
                  <option>Atheist</option>
                  <option>Buddhist</option>
                  <option>Christian</option>
                  <option>Hindu</option>
                  <option>Jewish</option>
                  <option>Muslim</option>
                  <option>Open-minded</option>
                  <option>Spiritual</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Politics · Optional
                <select
                  aria-label="Politics"
                  value={data.politics}
                  onChange={(event) => update('politics', event.target.value)}
                >
                  <option value="">Skip</option>
                  <option>Liberal</option>
                  <option>Moderate</option>
                  <option>Conservative</option>
                  <option>Not political</option>
                  <option>Prefer not to say</option>
                </select>
              </label>
              <label className="wide-field">
                Zodiac · Optional
                <select
                  aria-label="Zodiac"
                  value={data.zodiac}
                  onChange={(event) => update('zodiac', event.target.value)}
                >
                  <option value="">Skip</option>
                  <option>Aries</option>
                  <option>Taurus</option>
                  <option>Gemini</option>
                  <option>Cancer</option>
                  <option>Leo</option>
                  <option>Virgo</option>
                  <option>Libra</option>
                  <option>Scorpio</option>
                  <option>Sagittarius</option>
                  <option>Capricorn</option>
                  <option>Aquarius</option>
                  <option>Pisces</option>
                  <option>Ask me</option>
                </select>
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="field-grid">
              <label>
                Pets
                <select
                  aria-label="Pets"
                  value={data.pets}
                  onChange={(event) => update('pets', event.target.value)}
                >
                  <option>Has a dog</option>
                  <option>Has a cat</option>
                  <option>Other pets</option>
                  <option>No pets</option>
                  <option>Loves pets</option>
                </select>
              </label>
              <label>
                Children
                <select
                  aria-label="Children"
                  value={data.kids}
                  onChange={(event) => update('kids', event.target.value)}
                >
                  <option>No kids</option>
                  <option>Has kids</option>
                </select>
              </label>
              <label className="wide-field">
                Want children
                <select
                  aria-label="Want children"
                  value={data.wantsKids}
                  onChange={(event) => update('wantsKids', event.target.value)}
                >
                  <option>Yes</option>
                  <option>No</option>
                  <option>Maybe</option>
                  <option>Not sure</option>
                </select>
              </label>
            </div>
          )}
          {step === 3 && (
            <div className="field-grid">
              <label>
                Drinking
                <select
                  aria-label="Drinking"
                  value={data.drinking}
                  onChange={(event) => update('drinking', event.target.value)}
                >
                  <option>Never</option>
                  <option>Rarely</option>
                  <option>Socially</option>
                  <option>Often</option>
                </select>
              </label>
              <label>
                Smoking
                <select
                  aria-label="Smoking"
                  value={data.smoking}
                  onChange={(event) => update('smoking', event.target.value)}
                >
                  <option>No</option>
                  <option>Sometimes</option>
                  <option>Yes</option>
                </select>
              </label>
              <label>
                Exercise · Optional
                <select
                  aria-label="Exercise"
                  value={data.exercise}
                  onChange={(event) => update('exercise', event.target.value)}
                >
                  <option value="">Skip</option>
                  <option>Never</option>
                  <option>Sometimes</option>
                  <option>Often</option>
                  <option>Daily</option>
                </select>
              </label>
              <label>
                Food style · Optional
                <select
                  aria-label="Food style"
                  value={data.diet}
                  onChange={(event) => update('diet', event.target.value)}
                >
                  <option value="">Skip</option>
                  <option>No preference</option>
                  <option>Vegetarian</option>
                  <option>Vegan</option>
                  <option>Pescatarian</option>
                  <option>Halal</option>
                  <option>Kosher</option>
                </select>
              </label>
              <label className="wide-field">
                Social energy · Optional
                <select
                  aria-label="Social energy"
                  value={data.socialStyle}
                  onChange={(event) =>
                    update('socialStyle', event.target.value)
                  }
                >
                  <option value="">Skip</option>
                  <option>Homebody</option>
                  <option>Always out</option>
                  <option>A mix of both</option>
                </select>
              </label>
            </div>
          )}
          {step === 4 && (
            <div className="stacked-choices">
              <ChoiceGroup
                label="Relationship goals · Required"
                options={relationshipOptions}
                selected={data.intents}
                onToggle={(value) => toggle('intents', value)}
              />
              <div className="field-grid">
                <label>
                  Relationship style · Optional
                  <select
                    aria-label="Relationship style"
                    value={data.relationshipStyle}
                    onChange={(event) =>
                      update('relationshipStyle', event.target.value)
                    }
                  >
                    <option value="">Skip</option>
                    <option>Monogamy</option>
                    <option>Ethical non-monogamy</option>
                    <option>Open relationship</option>
                    <option>Figuring it out</option>
                  </select>
                </label>
                <label>
                  Love language · Optional
                  <select
                    aria-label="Love language"
                    value={data.loveLanguage}
                    onChange={(event) =>
                      update('loveLanguage', event.target.value)
                    }
                  >
                    <option value="">Skip</option>
                    <option>Quality time</option>
                    <option>Words of affirmation</option>
                    <option>Acts of service</option>
                    <option>Physical touch</option>
                    <option>Gifts</option>
                  </select>
                </label>
              </div>
            </div>
          )}
          {step === 5 && (
            <div className="stacked-choices">
              <ChoiceGroup
                label={`${data.interests.length} of 5 interests selected · Optional`}
                options={interestOptions}
                selected={data.interests}
                onToggle={(value) => toggle('interests', value, 5)}
              />
              <ChoiceGroup
                label={`${data.values.length} of 5 values selected · Optional`}
                options={valueOptions}
                selected={data.values}
                onToggle={(value) => toggle('values', value, 5)}
              />
            </div>
          )}
          {step === 6 && (
            <div className="prompt-fields">
              <label>
                About me · Optional
                <textarea
                  aria-label="About me"
                  value={data.bio}
                  onChange={(event) => update('bio', event.target.value)}
                  maxLength={300}
                  placeholder="A short, specific introduction…"
                />
                <small>{data.bio.length}/300</small>
              </label>
              <label>
                My ideal Sunday… · Optional
                <textarea
                  aria-label="First prompt"
                  value={data.promptOne}
                  onChange={(event) => update('promptOne', event.target.value)}
                />
              </label>
              <label>
                The quickest way to my heart… · Optional
                <textarea
                  aria-label="Second prompt"
                  value={data.promptTwo}
                  onChange={(event) => update('promptTwo', event.target.value)}
                />
              </label>
            </div>
          )}
          {step === 7 && (
            <>
              <ChoiceGroup
                label="Show me · Required"
                options={['Woman', 'Man', 'Nonbinary']}
                selected={data.preferredGenders}
                onToggle={(value) => toggle('preferredGenders', value)}
              />
              <div className="range-fields">
                <label>
                  Age range{' '}
                  <strong>
                    {data.minAge}–{data.maxAge}
                  </strong>
                  <input
                    aria-label="Minimum age"
                    type="range"
                    min="18"
                    max="60"
                    value={data.minAge}
                    onChange={(event) =>
                      update('minAge', Number(event.target.value))
                    }
                  />
                  <input
                    aria-label="Maximum age"
                    type="range"
                    min="18"
                    max="60"
                    value={data.maxAge}
                    onChange={(event) =>
                      update('maxAge', Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  Maximum distance <strong>{data.maxDistance} miles</strong>
                  <input
                    aria-label="Maximum distance"
                    type="range"
                    min="1"
                    max="50"
                    value={data.maxDistance}
                    onChange={(event) =>
                      update('maxDistance', Number(event.target.value))
                    }
                  />
                </label>
              </div>
              <section
                className="profile-media-editor"
                aria-label="Profile photos"
              >
                <div className="profile-media-heading">
                  <span>
                    <strong>Your photos</strong>
                    <small>
                      {photos.length} of 6 · first photo is your main photo
                    </small>
                  </span>
                  <Check size={17} />
                </div>
                <div className="profile-media-grid">
                  {photos.map((photo, index) => (
                    <div
                      className="profile-media-tile"
                      key={photo.id ?? photo.src}
                    >
                      <Image
                        src={photo.src}
                        alt={`Profile photo ${index + 1}`}
                        fill
                        sizes="112px"
                        quality={90}
                        unoptimized={
                          photo.src.startsWith('/api/media/') ||
                          photo.src.startsWith('data:')
                        }
                      />
                      <span className="profile-media-number">{index + 1}</span>
                      {index === 0 ? (
                        <span className="profile-media-main">Main</span>
                      ) : (
                        <button
                          type="button"
                          className="profile-media-main-action"
                          onClick={() => onMakeMainPhoto(photo)}
                        >
                          Make main
                        </button>
                      )}
                      {photo.id && (
                        <button
                          type="button"
                          className="profile-media-remove"
                          aria-label={`Remove profile photo ${index + 1}`}
                          onClick={() => onRemovePhoto(photo)}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {photos.length < 6 && (
                    <label className="profile-media-add">
                      <ImagePlus size={25} />
                      <strong>Add photo</strong>
                      <small>Crop &amp; enhance</small>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        aria-label="Add and crop profile photo"
                        onChange={(event) => {
                          chooseProfilePhoto(event.target.files?.[0]);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
                <p className="profile-media-guidance">
                  Use a clear original with your face in the safe area. Avoid
                  screenshots, heavy filters, and re-uploaded social-media
                  copies.
                </p>
                <div className="profile-video-editor">
                  {profileVideo ? (
                    <>
                      <video
                        src={profileVideo.src}
                        muted
                        playsInline
                        controls
                        preload="metadata"
                        aria-label="Your profile video"
                      />
                      <span>
                        <strong>Profile video ready</strong>
                        <small>
                          Shown after your photos · maximum 15 seconds
                        </small>
                      </span>
                      <button
                        type="button"
                        aria-label="Remove profile video"
                        onClick={() => onRemovePhoto(profileVideo)}
                      >
                        <Trash2 size={15} /> Remove
                      </button>
                    </>
                  ) : (
                    <label>
                      <Play size={21} />
                      <span>
                        <strong>Add profile video</strong>
                        <small>MP4, MOV, or WebM · 15 sec · 30 MB max</small>
                      </span>
                      <Plus size={18} />
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm"
                        aria-label="Add 15-second profile video"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void onAddVideo(file);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              </section>
              <div className="media-rules">
                <div>
                  <Camera size={20} />
                  <span>
                    <strong>Main photo</strong>
                    <small>One cinematic portrait on Spike</small>
                  </span>
                  <Check size={17} />
                </div>
                <div>
                  <Camera size={20} />
                  <span>
                    <strong>Full profile</strong>
                    <small>Up to 6 photos · tap to advance</small>
                  </span>
                  <Check size={17} />
                </div>
                <div>
                  <Play size={20} />
                  <span>
                    <strong>Profile video</strong>
                    <small>One video · maximum 15 seconds</small>
                  </span>
                  <Check size={17} />
                </div>
              </div>
              <PhotoCropper
                file={cropFile}
                open={cropOpen}
                onOpenChange={setCropOpen}
                onConfirm={onAddPhoto}
              />
            </>
          )}
        </div>
        {validationError && (
          <p className="registration-error" role="alert">
            {validationError}
          </p>
        )}
        <div className="flow-actions">
          {step > 0 && (
            <button
              className="secondary-button"
              onClick={() => {
                setValidationError('');
                setStep((value) => value - 1);
              }}
            >
              Back
            </button>
          )}
          <button className="primary-button" onClick={saveOrContinue}>
            {singleSection
              ? 'Save changes'
              : step === registrationSteps.length - 1
                ? 'Save profile'
                : 'Continue'}{' '}
            {!singleSection && <ChevronRight size={18} />}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="choice-group">
      <p>{label}</p>
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className={selected.includes(option) ? 'selected' : ''}
            onClick={() => onToggle(option)}
          >
            {selected.includes(option) && <Check size={14} />}
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterDialog({
  open,
  onOpenChange,
  filters,
  membership,
  onUpgrade,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Filters;
  membership: Membership;
  onUpgrade: () => void;
  onApply: (filters: Filters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(filters);
      setAdvancedOpen(false);
    }
  }, [open, filters]);
  const toggleGender = (gender: Gender) =>
    setDraft((current) => ({
      ...current,
      genders: current.genders.includes(gender)
        ? current.genders.filter((item) => item !== gender)
        : [...current.genders, gender],
    }));
  const toggleIntent = (intent: string) =>
    setDraft((current) => ({
      ...current,
      intents: current.intents.includes(intent)
        ? current.intents.filter((item) => item !== intent)
        : [...current.intents, intent],
    }));
  const resultCount = profiles.filter(
    (profile) =>
      draft.genders.includes(profile.gender) &&
      profile.age >= draft.minAge &&
      profile.age <= draft.maxAge &&
      profile.distanceMiles <= draft.maxDistance &&
      (draft.intents.length === 0 || draft.intents.includes(profile.intent)) &&
      (draft.smoking === 'Any' || profile.smoking === 'No') &&
      (draft.wantsKids === 'Any' || profile.wantsKids === draft.wantsKids),
  ).length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="filter-dialog quick-filter-sheet"
      >
        <button
          className="quick-filter-handle"
          onClick={() => onOpenChange(false)}
          aria-label="Close filters"
        >
          <span />
        </button>
        <div className="quick-filter-header">
          <DialogTitle>Preferences</DialogTitle>
          <button
            type="button"
            className="secondary-button quick-filter-reset"
            onClick={() => {
              setDraft(defaultFilters);
              setAdvancedOpen(false);
            }}
          >
            Reset
          </button>
        </div>
        <DialogDescription className="sr-only">
          Choose who appears in Spike.
        </DialogDescription>
        <div className="quick-filter-scroll">
          <section className="quick-filter-group">
            <div className="quick-filter-label-row">
              <div>
                <UserRound size={17} />
                <h3>Show me</h3>
              </div>
              <span>{draft.genders.join(', ') || 'Choose at least one'}</span>
            </div>
            <div className="quick-filter-pills choice-group">
              {(['Woman', 'Man', 'Nonbinary'] as Gender[]).map((gender) => (
                <button
                  type="button"
                  key={gender}
                  className={draft.genders.includes(gender) ? 'selected' : ''}
                  onClick={() => toggleGender(gender)}
                >
                  {gender === 'Woman'
                    ? 'Women'
                    : gender === 'Man'
                      ? 'Men'
                      : gender}
                </button>
              ))}
            </div>
          </section>

          <section className="quick-filter-group quick-filter-range">
            <div className="quick-filter-label-row">
              <h3>Age range</h3>
              <strong>
                {draft.minAge}–{draft.maxAge}
              </strong>
            </div>
            <div className="dual-range" aria-label="Preferred age range">
              <input
                aria-label="Filter minimum age"
                type="range"
                min="18"
                max="60"
                value={draft.minAge}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    minAge: Math.min(Number(event.target.value), draft.maxAge),
                  })
                }
              />
              <input
                aria-label="Filter maximum age"
                type="range"
                min="18"
                max="60"
                value={draft.maxAge}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    maxAge: Math.max(Number(event.target.value), draft.minAge),
                  })
                }
              />
            </div>
          </section>

          <section className="quick-filter-group quick-filter-range">
            <div className="quick-filter-label-row">
              <h3>Distance</h3>
              <strong>{draft.maxDistance} miles</strong>
            </div>
            <input
              aria-label="Filter maximum distance"
              type="range"
              min="1"
              max="50"
              value={draft.maxDistance}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  maxDistance: Number(event.target.value),
                })
              }
            />
          </section>

          <section className="quick-filter-group quick-filter-dealbreakers">
            <h3>Dealbreakers</h3>
            <button
              type="button"
              className={draft.smoking === 'No' ? 'active' : ''}
              aria-pressed={draft.smoking === 'No'}
              onClick={() =>
                setDraft({
                  ...draft,
                  smoking: draft.smoking === 'No' ? 'Any' : 'No',
                })
              }
            >
              <span className="quick-filter-dealbreaker-copy">
                <CigaretteOff size={18} />
                <span>
                  <strong>Non-smoker</strong>
                  <small>Only show people who don’t smoke</small>
                </span>
              </span>
              <span className="quick-filter-switch" aria-hidden="true">
                <i />
              </span>
            </button>
            <button
              type="button"
              className={draft.wantsKids === 'Yes' ? 'active' : ''}
              aria-pressed={draft.wantsKids === 'Yes'}
              onClick={() =>
                setDraft({
                  ...draft,
                  wantsKids: draft.wantsKids === 'Yes' ? 'Any' : 'Yes',
                })
              }
            >
              <span className="quick-filter-dealbreaker-copy">
                <Baby size={18} />
                <span>
                  <strong>Wants children</strong>
                  <small>Match on future family plans</small>
                </span>
              </span>
              <span className="quick-filter-switch" aria-hidden="true">
                <i />
              </span>
            </button>
          </section>

          <section className="quick-filter-group quick-filter-more">
            <button
              type="button"
              className="quick-filter-advanced"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((value) => !value)}
            >
              <span>
                <SlidersHorizontal size={17} />
                More preferences
              </span>
              <ChevronDown size={18} />
            </button>
            {advancedOpen &&
              (membership === 'plus' ? (
                <div className="advanced-filter-fields">
                  <ChoiceGroup
                    label="Relationship goals · SpikeDate+"
                    options={relationshipOptions}
                    selected={draft.intents}
                    onToggle={toggleIntent}
                  />
                  <label className="quick-filter-select">
                    Family plans
                    <select
                      aria-label="Kids preference"
                      value={draft.wantsKids}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          wantsKids: event.target.value as Filters['wantsKids'],
                        })
                      }
                    >
                      <option value="Any">Open to any</option>
                      <option value="Yes">Wants children</option>
                      <option value="No">Doesn’t want children</option>
                    </select>
                  </label>
                </div>
              ) : (
                <button className="filter-upgrade" onClick={onUpgrade}>
                  <Crown size={19} />
                  <span>
                    <strong>Advanced filters with SpikeDate+</strong>
                    <small>Relationship goals and family plans</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
          </section>
        </div>
        <div className="quick-filter-action">
          <button
            className="primary-button apply-filters"
            onClick={() => onApply(draft)}
            disabled={draft.genders.length === 0}
          >
            Show {resultCount} {resultCount === 1 ? 'profile' : 'profiles'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionDialog({
  open,
  onOpenChange,
  membership,
  dailyLikesRemaining,
  superPulsesRemaining,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membership: Membership;
  dailyLikesRemaining: number;
  superPulsesRemaining: number;
  onChoose: (billing: BillingPeriod) => void;
}) {
  const [billing, setBilling] = useState<BillingPeriod>('monthly');
  const [restoreStatus, setRestoreStatus] = useState('');
  const [showFreeComparison, setShowFreeComparison] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flow-dialog subscription-dialog"
      >
        <header className="subscription-header">
          <button
            className="match-close"
            onClick={() => onOpenChange(false)}
            aria-label="Close subscription details"
          >
            <X size={19} />
          </button>
          <div className="flow-kicker">
            <Crown size={15} /> SpikeDate+
          </div>
          <DialogTitle>More signal. Less noise.</DialogTitle>
          <DialogDescription>
            Likes show interest. Super Spikes move you to the front. Chat opens
            after a mutual match.
          </DialogDescription>
        </header>

        <div className="subscription-scroll">
          <div className="plan-usage">
            <span>
              {membership === 'plus' ? 'SPIKEDATE+ ACTIVE' : 'FREE PLAN'}
            </span>
            <strong>
              {membership === 'plus'
                ? `Unlimited Likes · ${superPulsesRemaining}/3 Super Spikes this week`
                : `${dailyLikesRemaining}/10 Likes today · ${superPulsesRemaining} Super Spikes available`}
            </strong>
          </div>
          <div className="billing-toggle" aria-label="Billing period">
            <button
              type="button"
              className={billing === 'weekly' ? 'active' : ''}
              aria-pressed={billing === 'weekly'}
              onClick={() => setBilling('weekly')}
            >
              Weekly
            </button>
            <button
              type="button"
              className={billing === 'monthly' ? 'active' : ''}
              aria-pressed={billing === 'monthly'}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={billing === 'annual' ? 'active' : ''}
              aria-pressed={billing === 'annual'}
              onClick={() => setBilling('annual')}
            >
              Annual · save 33%
            </button>
          </div>
          <div className="plan-grid">
            <section className="featured">
              <span>SpikeDate+</span>
              <strong>
                {billing === 'weekly'
                  ? '$5.99'
                  : billing === 'monthly'
                    ? '$14.99'
                    : '$119.99'}{' '}
                <small>
                  {billing === 'weekly'
                    ? '/ week'
                    : billing === 'monthly'
                      ? '/ month'
                      : '/ year'}
                </small>
              </strong>
              {billing === 'annual' && <em>$9.99/month billed annually</em>}
              <ul>
                <li>
                  <Check size={15} /> See everyone who liked you
                </li>
                <li>
                  <Check size={15} /> Unlimited Likes
                </li>
                <li>
                  <Check size={15} /> 3 Super Spikes each week
                </li>
                <li>
                  <Check size={15} /> 1 thirty-minute Profile Lift each week
                </li>
                <li>
                  <Check size={15} /> Rewind your last pass
                </li>
                <li>
                  <Check size={15} /> Advanced intent and lifestyle filters
                </li>
              </ul>
            </section>
            <button
              type="button"
              className="subscription-comparison-toggle"
              aria-expanded={showFreeComparison}
              onClick={() => setShowFreeComparison((current) => !current)}
            >
              {showFreeComparison
                ? 'Hide Free-plan comparison'
                : 'View Free-plan comparison'}
              <ChevronDown size={17} />
            </button>
            {showFreeComparison && (
              <section className="free-plan">
                <span>FREE {membership === 'free' ? '· CURRENT' : ''}</span>
                <strong>$0</strong>
                <ul>
                  <li>
                    <Check size={15} /> 10 Likes each day
                  </li>
                  <li>
                    <Check size={15} /> 1 Super Spike each week
                  </li>
                  <li>
                    <Check size={15} /> Optional notes on Likes and Super Spikes
                  </li>
                  <li>
                    <Check size={15} /> Two recent incoming Likes
                  </li>
                  <li>
                    <Check size={15} /> Mutual-match chat and profile sharing
                  </li>
                </ul>
              </section>
            )}
          </div>
          <p className="billing-note">
            Prototype pricing · no payment is collected. Allowances reset daily
            for Likes and every Monday for Super Spikes and Profile Lift.
          </p>
          <div className="subscription-links">
            <button
              type="button"
              onClick={() =>
                setRestoreStatus(
                  'No store purchase is connected in this local prototype.',
                )
              }
            >
              Restore purchases
            </button>
            <button
              type="button"
              onClick={() =>
                setRestoreStatus(
                  'Subscription management opens after store billing is connected.',
                )
              }
            >
              Manage subscription
            </button>
          </div>
          {restoreStatus && (
            <p className="restore-status" role="status">
              {restoreStatus}
            </p>
          )}
          <p className="subscription-legal">
            No charge occurs in this local build. Store terms and privacy
            details will appear before purchase.
          </p>
        </div>

        <footer className="subscription-footer">
          <button
            className="primary-button plan-button"
            onClick={() => onChoose(billing)}
            disabled={membership === 'plus'}
          >
            {membership === 'plus'
              ? 'SpikeDate+ is active'
              : `Choose ${billing} SpikeDate+`}{' '}
            {membership === 'free' && <ChevronRight size={18} />}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function BoostDialog({
  open,
  onOpenChange,
  membership,
  boostsRemaining,
  activeUntil,
  now,
  onActivate,
  onPurchase,
  onUpgrade,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membership: Membership;
  boostsRemaining: number;
  activeUntil: number;
  now: number;
  onActivate: () => void;
  onPurchase: (quantity: number) => void;
  onUpgrade: () => void;
}) {
  const active = activeUntil > now;
  const minutes = Math.max(1, Math.ceil((activeUntil - now) / 60000));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flow-dialog boost-dialog"
      >
        <button
          className="match-close"
          onClick={() => onOpenChange(false)}
          aria-label="Close Profile Lift"
        >
          <X size={19} />
        </button>
        <div className="boost-orbit">
          <ProfileLiftMark size={42} />
        </div>
        <DialogTitle>
          {active ? 'Your Profile Lift is active' : 'Be seen sooner'}
        </DialogTitle>
        <DialogDescription>
          Profile Lift moves your completed profile toward the front of Spike
          and Galaxy for compatible people nearby for 30 minutes.
        </DialogDescription>
        <div className="boost-steps">
          <div>
            <span>1</span>
            <p>
              <strong>Your preferences still apply</strong>
              <small>Only compatible people can see you.</small>
            </p>
          </div>
          <div>
            <span>2</span>
            <p>
              <strong>No paid-placement badge</strong>
              <small>People see your profile naturally, without a label.</small>
            </p>
          </div>
          <div>
            <span>3</span>
            <p>
              <strong>No guaranteed matches</strong>
              <small>
                Profile Lift improves visibility, never compatibility.
              </small>
            </p>
          </div>
        </div>
        {active ? (
          <div className="boost-status">
            <Radio size={17} />
            <span>
              <strong>{minutes} minutes remaining</strong>
              <small>Your ranking returns to normal automatically.</small>
            </span>
          </div>
        ) : (
          <div className="boost-status">
            <ProfileLiftMark size={22} />
            <span>
              <strong>
                {boostsRemaining} Profile{' '}
                {boostsRemaining === 1 ? 'Lift' : 'Lifts'} ready
              </strong>
              <small>
                {membership === 'plus'
                  ? 'Your plan includes one each week; purchased Lifts do not expire.'
                  : 'Purchase a Lift anytime without subscribing.'}
              </small>
            </span>
          </div>
        )}
        <button
          className="primary-button plan-button"
          onClick={onActivate}
          disabled={active || boostsRemaining <= 0}
        >
          {active
            ? 'Profile Lift is running'
            : boostsRemaining > 0
              ? 'Start 30-minute Profile Lift'
              : 'Choose a Profile Lift pack'}
        </button>
        {!active && (
          <section className="boost-packs" aria-label="Profile Lift packs">
            <strong>Get more Profile Lifts</strong>
            <div>
              {[
                { quantity: 1, price: '$3.99' },
                { quantity: 3, price: '$9.99', label: 'Popular' },
                { quantity: 10, price: '$24.99', label: 'Best value' },
              ].map((pack) => (
                <button
                  type="button"
                  key={pack.quantity}
                  onClick={() => onPurchase(pack.quantity)}
                >
                  {pack.label && <small>{pack.label}</small>}
                  <strong>{pack.quantity}</strong>
                  <span>{pack.quantity === 1 ? 'Lift' : 'Lifts'}</span>
                  <em>{pack.price}</em>
                </button>
              ))}
            </div>
            <p>Prototype purchase · no payment is collected.</p>
          </section>
        )}
        {!active && membership !== 'plus' && (
          <button className="text-button boost-plan-link" onClick={onUpgrade}>
            Or see SpikeDate+ plans with one weekly Lift
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}

const voiceScheduleChoices: {
  id: VoiceSchedule;
  label: string;
  detail: string;
}[] = [
  { id: 'off', label: 'Off', detail: 'Play only when you choose' },
  { id: 'morning', label: 'Morning', detail: 'Daily at 8:00 AM' },
  { id: 'evening', label: 'Evening', detail: 'Daily at 6:00 PM' },
  { id: 'twice', label: 'Twice daily', detail: '8:00 AM and 6:00 PM' },
];

function VoiceBriefingDialog({
  open,
  onOpenChange,
  name,
  matchCount,
  incomingLikeCount,
  unreadMessages,
  sentThisWeek,
  superPulsesRemaining,
  boostsRemaining,
  mode,
  onMode,
  commandEnabled,
  liveEnabled,
  testMode,
  cloudEnabled,
  schedule,
  onSchedule,
  playing,
  promptVisible,
  listening,
  micStatus,
  cloudRecording,
  transcript,
  response,
  browseMode,
  profile,
  onPlay,
  onStop,
  onListen,
  onCloudListen,
  onTranscript,
  onCommand,
  onIncoming,
  onMessages,
  onBoost,
  onProfile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  matchCount: number;
  incomingLikeCount: number;
  unreadMessages: number;
  sentThisWeek: number;
  superPulsesRemaining: number;
  boostsRemaining: number;
  mode: VoiceMode;
  onMode: (mode: VoiceMode) => void;
  commandEnabled: boolean;
  liveEnabled: boolean;
  testMode: boolean;
  cloudEnabled: boolean;
  schedule: VoiceSchedule;
  onSchedule: (schedule: VoiceSchedule) => void;
  playing: boolean;
  promptVisible: boolean;
  listening: boolean;
  micStatus: VoiceMicStatus;
  cloudRecording: boolean;
  transcript: string;
  response: string;
  browseMode: boolean;
  profile: Profile;
  onPlay: () => void;
  onStop: () => void;
  onListen: () => void;
  onCloudListen: () => void;
  onTranscript: (value: string) => void;
  onCommand: (command: string) => void;
  onIncoming: () => void;
  onMessages: () => void;
  onBoost: () => void;
  onProfile: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flow-dialog voice-briefing-dialog"
      >
        <button
          className="match-close"
          onClick={() => onOpenChange(false)}
          aria-label="Close voice briefing"
        >
          <X size={19} />
        </button>
        <div className={`voice-orb ${playing ? 'is-speaking' : ''}`}>
          <Volume2 size={28} />
          <i />
          <i />
        </div>
        <DialogTitle>Activity Briefing</DialogTitle>
        <DialogDescription>
          A short spoken summary of what changed since your last visit.
        </DialogDescription>

        {(commandEnabled || liveEnabled) && (
          <>
            <div className="voice-mode-picker" aria-label="Voice mode">
              {commandEnabled && (
                <button
                  className={mode === 'command' ? 'selected' : ''}
                  onClick={() => onMode('command')}
                  aria-pressed={mode === 'command'}
                >
                  <Mic size={17} />
                  <span>
                    <strong>Push to talk</strong>
                    <small>Lowest cost</small>
                  </span>
                </button>
              )}
              {liveEnabled && (
                <button
                  className={mode === 'live' ? 'selected' : ''}
                  onClick={() => onMode('live')}
                  aria-pressed={mode === 'live'}
                >
                  <Radio size={17} />
                  <span>
                    <strong>Live conversation</strong>
                    <small>Continuous</small>
                  </span>
                </button>
              )}
            </div>
            <div className="voice-runtime-badge">
              <span />
              {testMode
                ? micStatus === 'unavailable' && cloudEnabled
                  ? 'Device voice unavailable · Cloudflare fallback ready'
                  : 'Test mode · device voice · no AI usage charge'
                : 'Production mode · Cloudflare adapter required'}
            </div>

            <button
              className={`voice-mic-button ${listening ? 'listening' : ''}`}
              onClick={onListen}
              disabled={micStatus === 'requesting'}
              aria-label={
                listening ? 'Stop listening' : 'Ask SpikeDate with microphone'
              }
            >
              <Mic size={23} />
              <span>
                <strong>
                  {micStatus === 'requesting'
                    ? 'Checking microphone…'
                    : listening
                      ? 'Listening…'
                      : mode === 'live'
                        ? 'Start live conversation'
                        : 'Ask SpikeDate'}
                </strong>
                <small>
                  {micStatus === 'requesting'
                    ? 'Use the browser prompt to allow access'
                    : listening
                      ? mode === 'live'
                        ? 'Tap to pause live conversation'
                        : 'Say your command now'
                      : mode === 'live'
                        ? 'Keeps listening between requests'
                        : 'Tap, then speak naturally'}
                </small>
              </span>
            </button>

            {micStatus !== 'unknown' && (
              <div className={`voice-mic-status ${micStatus}`} role="status">
                <span />
                {micStatus === 'requesting' && 'Waiting for permission'}
                {micStatus === 'ready' && 'Microphone ready'}
                {micStatus === 'blocked' &&
                  'Microphone blocked · check settings'}
                {micStatus === 'unavailable' && 'Speech service unavailable'}
              </div>
            )}
            {testMode &&
              (micStatus === 'blocked' || micStatus === 'unavailable') && (
                <div className="voice-fallback-actions">
                  {cloudEnabled && (
                    <button
                      className={`voice-cloud-button ${cloudRecording ? 'recording' : ''}`}
                      onClick={onCloudListen}
                    >
                      {cloudRecording ? <X size={15} /> : <Mic size={15} />}
                      {cloudRecording
                        ? 'Stop and transcribe'
                        : 'Use Cloudflare microphone'}
                    </button>
                  )}
                  <button
                    className="voice-demo-button"
                    onClick={() =>
                      onCommand(transcript.trim() || 'Show profiles for today')
                    }
                  >
                    <Play size={15} fill="currentColor" /> Run voice demo
                  </button>
                </div>
              )}

            <form
              className="voice-command-box"
              onSubmit={(event) => {
                event.preventDefault();
                onCommand(transcript);
              }}
            >
              <input
                value={transcript}
                onChange={(event) => onTranscript(event.target.value)}
                aria-label="Voice command"
                placeholder="Try “show profiles for today”"
              />
              <button type="submit" aria-label="Run voice command">
                <Send size={17} />
              </button>
            </form>
            <div className="voice-command-chips" aria-label="Example commands">
              {[
                'Show profiles for today',
                'Read basics',
                'Next profile',
                'Like this profile',
              ].map((command) => (
                <button key={command} onClick={() => onCommand(command)}>
                  {command}
                </button>
              ))}
            </div>

            <div className="voice-response" role="status" aria-live="polite">
              <span className={listening ? 'listening-dot' : ''} />
              <p>{response}</p>
            </div>

            {browseMode && (
              <button
                className="voice-profile-preview"
                onClick={() => onCommand('show pictures')}
              >
                <span>
                  <Image
                    src={profile.image}
                    alt={profile.name}
                    fill
                    sizes="58px"
                    className="profile-photo"
                  />
                </span>
                <p>
                  <strong>
                    {profile.name}, {profile.age}
                  </strong>
                  <small>
                    {profile.place} · {profile.distance}
                  </small>
                  <small>{profile.intent}</small>
                </p>
                <ChevronRight size={18} />
              </button>
            )}
          </>
        )}

        <div className="voice-stats" aria-label="Dating activity summary">
          <button onClick={onIncoming}>
            <BrandHeartMark size={19} />
            <strong>{incomingLikeCount}</strong>
            <span>Incoming</span>
          </button>
          <button onClick={onMessages}>
            <MessageCircle size={18} />
            <strong>{unreadMessages}</strong>
            <span>Unread</span>
          </button>
          <div>
            <BadgeCheck size={18} />
            <strong>{matchCount}</strong>
            <span>Matches</span>
          </div>
        </div>

        <div className="voice-this-week">
          <span>This week</span>
          <p>
            {sentThisWeek} Spike{sentThisWeek === 1 ? '' : 's'} sent
          </p>
          <p>
            {superPulsesRemaining} Super Spike
            {superPulsesRemaining === 1 ? '' : 's'} left
          </p>
          <p>{boostsRemaining} Profile Lifts left</p>
        </div>

        <button
          className={`primary-button voice-play-button ${playing ? 'playing' : ''}`}
          onClick={playing ? onStop : onPlay}
        >
          {playing ? <X size={18} /> : <Play size={18} fill="currentColor" />}
          {playing ? 'Stop briefing' : `Play ${name}'s briefing`}
        </button>

        <div className={`voice-next-actions ${promptVisible ? 'ready' : ''}`}>
          <strong>What would you like to review?</strong>
          <div>
            <button onClick={onIncoming}>
              <BrandHeartMark size={17} /> Incoming
            </button>
            <button onClick={onMessages}>
              <MessageCircle size={16} /> Messages
            </button>
            <button onClick={onBoost}>
              <ProfileLiftMark size={19} /> Profile Lift
            </button>
            <button onClick={onProfile}>
              <UserRound size={16} /> Profile
            </button>
          </div>
        </div>

        <section className="voice-schedule">
          <div>
            <Bell size={18} />
            <span>
              <strong>Briefing schedule</strong>
              <small>Choose when SpikeDate should remind you to play it.</small>
            </span>
          </div>
          <div className="voice-schedule-grid">
            {voiceScheduleChoices.map((choice) => (
              <button
                key={choice.id}
                className={schedule === choice.id ? 'selected' : ''}
                onClick={() => onSchedule(choice.id)}
                aria-pressed={schedule === choice.id}
              >
                <strong>{choice.label}</strong>
                <small>{choice.detail}</small>
              </button>
            ))}
          </div>
        </section>
        <p className="voice-consent-note">
          Briefings are read-only. They never send Likes, messages, Super
          Spikes, or Profile Lifts. You can change or turn off the schedule at
          any time.
        </p>
      </DialogContent>
    </Dialog>
  );
}

const themeChoices: {
  id: ThemeName;
  name: string;
  detail: string;
  colors: string[];
}[] = [
  {
    id: 'default',
    name: 'Midnight',
    detail: 'Near-black, romantic red and warm orange',
    colors: ['#0b0c12', '#e31b36', '#f47a1f'],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    detail: 'Deep ocean, teal and mint',
    colors: ['#07151c', '#27d9ca', '#8cf59a'],
  },
  {
    id: 'velvet',
    name: 'Velvet Galaxy',
    detail: 'Plum, orchid and champagne',
    colors: ['#170b1c', '#ea5ca9', '#f5c451'],
  },
  {
    id: 'solar',
    name: 'Solar Minimal',
    detail: 'Clean ivory, vermilion and bronze',
    colors: ['#f7f3eb', '#e65039', '#8a5d16'],
  },
  {
    id: 'liquid',
    name: 'Liquid Mono',
    detail: 'Obsidian glass, frost and soft graphite',
    colors: ['#050505', '#ffffff', '#8d8d92'],
  },
  {
    id: 'lime',
    name: 'Liquid Lime',
    detail: 'Obsidian glass with fresh electric lime',
    colors: ['#050505', '#92fa73', '#ffffff'],
  },
];

function ThemeDialog({
  open,
  onOpenChange,
  selected,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: ThemeName;
  onChoose: (theme: ThemeName) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flow-dialog theme-dialog"
      >
        <button
          className="match-close"
          onClick={() => onOpenChange(false)}
          aria-label="Close theme choices"
        >
          <X size={19} />
        </button>
        <div className="flow-kicker">
          <Palette size={15} /> APPEARANCE
        </div>
        <DialogTitle>Choose your SpikeDate look</DialogTitle>
        <DialogDescription>
          Midnight is the starting theme. Your choice is saved on this device.
        </DialogDescription>
        <div className="theme-grid">
          {themeChoices.map((choice) => (
            <button
              type="button"
              key={choice.id}
              data-theme-choice={choice.id}
              className={`theme-option ${selected === choice.id ? 'selected' : ''}`}
              onClick={() => onChoose(choice.id)}
              aria-pressed={selected === choice.id}
            >
              <span className="theme-swatches">
                {choice.colors.map((color) => (
                  <i key={color} style={{ backgroundColor: color }} />
                ))}
              </span>
              <span>
                <strong>{choice.name}</strong>
                <small>{choice.detail}</small>
              </span>
              {selected === choice.id ? (
                <Check size={18} />
              ) : choice.id === 'solar' ? (
                <Sun size={18} />
              ) : choice.id === 'liquid' ? (
                <WandSparkles size={18} />
              ) : choice.id === 'lime' ? (
                <Star size={18} />
              ) : null}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlanSafetyDialog({
  open,
  onOpenChange,
  plan,
  onShare,
  onEnd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: DatingPlan | null;
  onShare: (plan: DatingPlan) => void;
  onEnd: (plan: DatingPlan) => void;
}) {
  if (!plan) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="safety-dialog plan-safety-dialog">
        <DialogTitle>Safety options</DialogTitle>
        <DialogDescription>
          SpikeDate does not monitor dates or guarantee personal safety. If you
          are in immediate danger, contact local emergency services.
        </DialogDescription>
        <button
          type="button"
          onClick={() => {
            onShare(plan);
            onOpenChange(false);
          }}
        >
          <Share2 size={20} /> Share with a trusted contact{' '}
          <ChevronRight size={17} />
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            window.location.href = 'tel:911';
          }}
        >
          <ShieldCheck size={20} /> Call 911 <ChevronRight size={17} />
        </button>
        <button
          type="button"
          className="safety-cancel"
          onClick={() => onEnd(plan)}
        >
          <X size={20} /> End this date plan <ChevronRight size={17} />
        </button>
      </DialogContent>
    </Dialog>
  );
}

function SafetyDialog({
  open,
  onOpenChange,
  profile,
  mode,
  onAction,
  onReport,
  onBlock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  mode: 'menu' | 'report' | 'block';
  onAction: (message: string) => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  if (mode === 'report')
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="safety-dialog safety-confirm">
          <DialogTitle>Report {profile.name}?</DialogTitle>
          <DialogDescription>
            SpikeDate will review the profile. Reporting does not automatically
            block them.
          </DialogDescription>
          <button className="danger" onClick={onReport}>
            <Flag size={19} /> Submit report <ChevronRight size={17} />
          </button>
          <button className="safety-cancel" onClick={() => onOpenChange(false)}>
            <X size={19} /> Cancel <ChevronRight size={17} />
          </button>
        </DialogContent>
      </Dialog>
    );
  if (mode === 'block')
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="safety-dialog safety-confirm">
          <DialogTitle>Block {profile.name}?</DialogTitle>
          <DialogDescription>
            You will no longer see each other on SpikeDate. They won’t be
            notified.
          </DialogDescription>
          <button className="danger" onClick={onBlock}>
            <Ban size={19} /> Block {profile.name} <ChevronRight size={17} />
          </button>
          <button className="safety-cancel" onClick={() => onOpenChange(false)}>
            <X size={19} /> Keep profile <ChevronRight size={17} />
          </button>
        </DialogContent>
      </Dialog>
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="safety-dialog">
        <DialogTitle>Safety with {profile.name}</DialogTitle>
        <DialogDescription>
          These tools are always one tap away.
        </DialogDescription>
        <button
          onClick={() => {
            onOpenChange(false);
            onAction('Date details shared with your contact');
          }}
        >
          <ShieldCheck size={20} /> Share date details{' '}
          <ChevronRight size={17} />
        </button>
        <button onClick={onReport}>
          <MoreHorizontal size={20} /> Report profile <ChevronRight size={17} />
        </button>
        <button className="danger" onClick={onBlock}>
          <Ban size={20} /> Block {profile.name} <ChevronRight size={17} />
        </button>
      </DialogContent>
    </Dialog>
  );
}
