'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { PresenceStatus } from '@/components/presence-status';
import { syntheticProfiles } from '@/lib/synthetic-profiles';
import {
  LivePresenceProvider,
  PresencePreferences,
} from '@/components/live-presence';
import { tonightWindow } from '@/lib/today-availability';
import {
  galaxyRoomNames,
  matchesGalaxyRoom,
  type GalaxyRoomName,
} from '@/lib/galaxy-rooms';
import { vibePrompts, vibeSetupSteps } from '@/lib/registration-prompts';
import {
  ProfileConnectionFields,
  ProfileConnectionSummary,
} from '@/components/profile-connection';
import {
  emptyConnection,
  connectionOptions,
  type ProfileConnection,
} from '@/lib/profile-connection';
import {
  isAdult,
  heightToCentimeters,
  passwordSchema,
  type SignupDetails,
} from '@/lib/account-validation';
import {
  ArrowLeft,
  ArrowUp,
  AudioLines,
  BadgeCheck,
  Ban,
  Baby,
  BriefcaseBusiness,
  Cigarette,
  Dumbbell,
  UsersRound,
  Sprout,
  HandHeart,
  Mail,
  Bell,
  Bookmark,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Coffee,
  Compass,
  Edit3,
  Eye,
  Flag,
  Footprints,
  Gamepad2,
  GraduationCap,
  Leaf,
  NotebookPen,
  PawPrint,
  Heart,
  ImagePlus,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircle,
  type LucideProps,
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
import { ChatMediaActions } from '@/components/chat-media-actions';
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
import { DatingGames } from '@/components/dating-games';
import { AstrologyDiscovery } from '@/components/astrology-discovery';
import { zodiacFromBirthDate, type ZodiacSign } from '@/lib/astrology';

type Tab = 'Pulse' | 'Galaxy' | 'Likes' | 'Chat' | 'Profile';
type ThemeName =
  | 'default'
  | 'electric-blue'
  | 'spring-green'
  | 'neon-orchid'
  | 'vermilion';
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
  matchDetails?: ProfileConnection;
  zodiac?: ZodiacSign | null;
  facts?: {
    height: string;
    occupation: string;
    kids: string;
    wantsKids: string;
    smoking: string;
    drinking: string;
    education?: string;
    pets?: string;
  };
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
  prompts?: Array<{ prompt: string; answer: string }>;
  height: string;
  ethnicity: string;
  pets: string;
  kids: string;
  wantsKids: string;
  drinking: string;
  smoking: string;
  verified?: boolean;
  active?: boolean;
  lastActiveAt?: number | null;
  tonight?: {
    plan: string;
    expiresAt: string;
  };
  availability?: DailyAvailability;
};
type DiscoverCandidate = {
  id: string;
  name: string;
  age: number;
  zodiac?: ZodiacSign | null;
  gender?: string;
  facts?: Profile['facts'];
  connection?: ProfileConnection;
  interests?: string[];
  bio?: string;
  prompts?: Array<{ prompt: string; answer: string }>;
  city?: string | null;
  relationshipGoal?: string;
  imageUrl?: string | null;
  media?: Array<{ type: 'photo' | 'video'; url: string }>;
  today?: string | null;
  availableTonight?: boolean;
  availability?: DailyAvailability | null;
  verified?: boolean;
  active?: boolean;
  lastActiveAt?: number | null;
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
  lastActiveAt?: number | null;
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
  datingPace?: string;
  communicationPreference?: string;
  rhythm?: string[];
  loveLanguage: string;
  interests: string[];
  values: string[];
  promptOne: string;
  promptTwo: string;
  promptOneQuestion?: string;
  promptTwoQuestion?: string;
  preferredGenders: Gender[];
  minAge: number;
  maxAge: number;
  maxDistance: number;
};
type ChatMessage = {
  id: number | string;
  text: string;
  mine: boolean;
  deliveredAt?: number | null;
  readAt?: number | null;
  mediaKind?: 'photo' | 'voice' | null;
  mediaDurationMs?: number | null;
};
type InteractionKind = 'like' | 'super';
type NoteTarget = string;
type Membership = 'free' | 'plus';
type BillingPeriod = 'weekly' | 'monthly';
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
  kind: InteractionKind;
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
type DatingPlan = {
  id: number;
  serverId?: string;
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
type ServerGalaxyPlanRow = {
  id: string;
  creator_id: string;
  creator_name: string;
  invitee_id: string | null;
  invitee_name: string | null;
  invite_status: string | null;
  name: string;
  activity: string;
  venue_name: string;
  venue_address: string;
  latitude_e6: number | null;
  longitude_e6: number | null;
  starts_at: number;
  status: string;
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

function SpikeIntroIcon({ size = 24, className, ...props }: LucideProps) {
  const dimension = Number(size);
  return (
    <span
      className={`spike-intro-icon ${className ?? ''}`}
      style={{ width: dimension, height: dimension }}
      aria-hidden="true"
    >
      <MessageCircle size={dimension} {...props} />
      <Star
        className="spike-intro-star"
        size={dimension * 0.34}
        fill="currentColor"
        strokeWidth={1.4}
      />
      <Plus
        className="spike-intro-plus"
        size={dimension * 0.3}
        strokeWidth={2}
      />
    </span>
  );
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
}) {
  return (
    <svg
      className={`brand-heart-mark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M512 837C466 794 226 620 226 396c0-124 91-199 194-169 45 13 75 44 92 82 17-38 47-69 92-82 103-30 194 45 194 169 0 224-240 398-286 441Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="82"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M560 175C548 269 462 314 500 399c34 75 151 68 190 142 48 93-67 192-178 296"
        fill="none"
        stroke="currentColor"
        strokeWidth="86"
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <path d="m560 105 49 151-99-24Z" fill="currentColor" />
    </svg>
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
      <Rocket size={size} fill="currentColor" strokeWidth={1.7} />
    </span>
  );
}

function TodayActionIcon({
  active,
  size = 20,
}: {
  active: boolean;
  size?: number;
}) {
  return active ? <CalendarCheck size={size} /> : <CalendarPlus size={size} />;
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
    active: true,
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
    active: true,
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
    active: true,
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
    active: true,
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
    active: true,
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
      active: index % 4 === 0,
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

function matchesFilters(profile: Profile, filters: Filters) {
  return (
    filters.genders.includes(profile.gender) &&
    profile.age >= filters.minAge &&
    profile.age <= filters.maxAge &&
    profile.distanceMiles <= filters.maxDistance &&
    (filters.intents.length === 0 ||
      filters.intents.includes(profile.intent)) &&
    (filters.smoking === 'Any' || profile.smoking === 'No') &&
    (filters.wantsKids === 'Any' || profile.wantsKids === filters.wantsKids)
  );
}

function filtersFromServerPreferences(
  preferences: Record<string, unknown> | null,
): Filters | null {
  if (!preferences) return null;
  try {
    const serverGenders = JSON.parse(
      typeof preferences.genders_json === 'string'
        ? preferences.genders_json
        : '[]',
    ) as string[];
    const serverGoals = JSON.parse(
      typeof preferences.relationship_goals_json === 'string'
        ? preferences.relationship_goals_json
        : '[]',
    ) as string[];
    const genders = serverGenders
      .map((gender) =>
        gender.toLowerCase() === 'man'
          ? 'Man'
          : gender.toLowerCase() === 'woman'
            ? 'Woman'
            : gender.toLowerCase() === 'nonbinary'
              ? 'Nonbinary'
              : null,
      )
      .filter((gender): gender is Gender => gender !== null);
    return {
      ...defaultFilters,
      genders: genders.length ? genders : ['Woman', 'Man', 'Nonbinary'],
      minAge: Math.max(18, Math.min(60, Number(preferences.min_age) || 18)),
      maxAge: Math.max(18, Math.min(60, Number(preferences.max_age) || 60)),
      maxDistance: Math.max(
        1,
        Math.min(
          50,
          Math.round((Number(preferences.max_distance_km) || 80) / 1.609344),
        ),
      ),
      intents: serverGoals,
    };
  } catch {
    return null;
  }
}
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
  'Indie music',
  'Pop music',
  'Jazz',
  'R&B',
  'Road trips',
  'City breaks',
  'Nature trips',
  'Beach trips',
  'Arts & culture',
  'New in town',
];
const valueOptions = [...connectionOptions.values];
const themeLabels: Record<ThemeName, string> = {
  default: 'Midnight',
  'electric-blue': 'Electric Blue',
  'spring-green': 'Spring Green',
  'neon-orchid': 'Neon Orchid',
  vermilion: 'Vermilion',
};

const midnightAccentThemes: ReadonlySet<ThemeName> = new Set([
  'electric-blue',
  'spring-green',
  'neon-orchid',
  'vermilion',
]);

const roomData = [
  {
    name: 'Tonight',
    caption: 'Free in the next 12 hours',
    image: '/maya.png',
    className: 'wide',
  },
  {
    name: 'Music',
    caption: 'Match on taste',
    image: '/lena.png',
  },
  {
    name: 'Outdoors',
    caption: 'Find your trail person',
    image: '/imani.png',
  },
  {
    name: 'Food lovers',
    caption: 'Try somewhere new together',
    image: '/mateo.png',
  },
  {
    name: 'New in town',
    caption: 'Make the city feel smaller',
    image: '/lena.png',
    className: 'wide',
  },
  {
    name: 'Coffee dates',
    caption: 'Keep the first hello easy',
    image: '/noah.png',
  },
  {
    name: 'Pet people',
    caption: 'Walks are better together',
    image: '/ava.png',
  },
  {
    name: 'Arts & culture',
    caption: 'Galleries, films and ideas',
    image: '/jordan.png',
    className: 'wide',
  },
];

const galaxyPlans = [
  {
    name: 'Coffee',
    detail: 'An easy first hello',
    room: 'Coffee dates',
    icon: Coffee,
  },
  {
    name: 'Dinner',
    detail: 'Share a table',
    room: 'Food lovers',
    icon: Utensils,
  },
  {
    name: 'Music',
    detail: 'Find your sound',
    room: 'Music',
    icon: Music2,
  },
  {
    name: 'Walk',
    detail: 'Take a stroll',
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
  Likes: Heart,
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
    value === 'capture_ready' ||
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

async function serverAccepted(path: string, init: RequestInit): Promise<void> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type'))
    headers.set('content-type', 'application/json');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers,
      signal: controller.signal,
    });
    void response.body?.cancel().catch(() => undefined);
    if (!response.ok)
      throw new Error('SpikeDate could not save that change. Try again.');
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        'Saving took too long. Your text remains here; please try again.',
      );
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
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

function profileFromDiscovery(candidate: DiscoverCandidate): Profile {
  const known = profiles.find((item) => item.name === candidate.name);
  const gender: Gender =
    candidate.gender === 'man'
      ? 'Man'
      : candidate.gender === 'nonbinary'
        ? 'Nonbinary'
        : 'Woman';
  if (known)
    return {
      ...known,
      id: candidate.id,
      zodiac: candidate.zodiac ?? null,
      facts: candidate.facts,
      matchDetails: candidate.connection,
      tags: candidate.interests || [],
      prompt: candidate.bio || '',
      prompts: candidate.prompts || [],
      gender,
      image: candidate.imageUrl || '/profile-placeholder.svg',
      media: candidate.media?.length
        ? candidate.media.map((item) => ({ type: item.type, src: item.url }))
        : candidate.imageUrl
          ? [{ type: 'photo', src: candidate.imageUrl }]
          : [{ type: 'photo', src: '/profile-placeholder.svg' }],
      age: candidate.age,
      place: candidate.city || known.place,
      intent: candidate.relationshipGoal || known.intent,
      verified: candidate.verified,
      active: candidate.active,
      lastActiveAt: candidate.lastActiveAt ?? null,
      availability: candidate.availability ?? undefined,
      tonight:
        candidate.availability && matchesGalaxyRoom('Tonight', candidate)
          ? {
              plan: candidate.today || 'Open to making a plan',
              expiresAt: candidate.availability.endAt,
            }
          : undefined,
    };
  const image = candidate.imageUrl || '/profile-placeholder.svg';
  return {
    id: candidate.id,
    zodiac: candidate.zodiac ?? null,
    facts: candidate.facts,
    matchDetails: candidate.connection,
    name: candidate.name,
    age: candidate.age,
    gender,
    image,
    media: candidate.media?.length
      ? candidate.media.map((item) => ({ type: item.type, src: item.url }))
      : [{ type: 'photo', src: image }],
    place: candidate.city || 'Nearby',
    distance: 'Nearby',
    distanceMiles: 2,
    intent: candidate.relationshipGoal || 'Dating',
    tags: candidate.interests || [],
    prompt: candidate.bio || 'Ask me what I am looking forward to.',
    prompts: candidate.prompts,
    height: 'Not shared',
    ethnicity: 'Not shared',
    pets: 'Not shared',
    kids: 'Not shared',
    wantsKids: 'Not shared',
    drinking: 'Not shared',
    smoking: 'Not shared',
    verified: candidate.verified,
    active: candidate.active,
    lastActiveAt: candidate.lastActiveAt ?? null,
    availability: candidate.availability ?? undefined,
    tonight:
      candidate.availability && matchesGalaxyRoom('Tonight', candidate)
        ? {
            plan: candidate.today || 'Open to making a plan',
            expiresAt: candidate.availability.endAt,
          }
        : undefined,
  };
}

function planFromServer(
  row: ServerGalaxyPlanRow,
  viewerEmail: string,
  viewerId: string,
): DatingPlan {
  const startsAt = new Date(row.starts_at);
  const day = `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, '0')}-${String(startsAt.getDate()).padStart(2, '0')}`;
  const time = `${String(startsAt.getHours()).padStart(2, '0')}:${String(startsAt.getMinutes()).padStart(2, '0')}`;
  let numericId = 2166136261;
  for (const char of row.id)
    numericId = Math.imul(numericId ^ char.charCodeAt(0), 16777619);
  const isCreator = row.creator_id === viewerId;
  const venue: Venue = {
    id: `server-${row.id}`,
    name: row.venue_name,
    address: row.venue_address,
    neighborhood: 'Public venue',
    distance: 'Shared venue',
    price: '$$',
    category: row.activity,
    latitude: row.latitude_e6 == null ? 0 : row.latitude_e6 / 1_000_000,
    longitude: row.longitude_e6 == null ? 0 : row.longitude_e6 / 1_000_000,
  };
  return {
    id: numericId >>> 0,
    serverId: row.id,
    planName: row.name,
    activity: row.activity,
    day,
    time,
    durationMinutes: 45,
    neighborhood: venue.neighborhood,
    venue,
    invitees: isCreator
      ? [row.invitee_name ?? 'Your match']
      : [row.creator_name],
    inviteeEmails: [],
    creatorEmail: isCreator ? viewerEmail : 'matched-member',
    status:
      row.status === 'cancelled'
        ? 'cancelled'
        : row.invite_status === 'declined'
          ? 'declined'
          : row.status === 'accepted' || row.invite_status === 'accepted'
            ? 'accepted'
            : 'sent',
    venueOptions: [venue],
    expiresAt: new Date(row.starts_at + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
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
  const [matchOpen, setMatchOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<NoteTarget>('Lifestyle');
  const [noteMessage, setNoteMessage] = useState('');
  const [noteTodayText, setNoteTodayText] = useState('');
  const [actionProfile, setActionProfile] = useState<Profile>(profiles[0]);
  const [superPulsesRemaining, setSuperPulsesRemaining] = useState(3);
  const [room, setRoom] = useState<GalaxyRoomName | null>(null);
  const [roomIndex, setRoomIndex] = useState(0);
  const [galaxyRefresh, setGalaxyRefresh] = useState(0);
  const [galaxyLoaded, setGalaxyLoaded] = useState(false);
  const [galaxyError, setGalaxyError] = useState(false);
  const [galaxyNow, setGalaxyNow] = useState(() => Date.now());
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | null>(null);
  const superPulseOwner = useRef<string | null>(null);
  const allowanceOwner = useRef<string | null>(null);
  const boostOwner = useRef<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatLoadSequence = useRef(0);
  const [activeChat, setActiveChat] = useState<ChatContact>(chatContacts[0]);
  const [contacts, setContacts] = useState<ChatContact[]>(
    serverDataEnabled ? [] : chatContacts,
  );
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
  const [registrationCameraCheck, setRegistrationCameraCheck] = useState(false);
  const [verificationStatus, setVerificationStatus] =
    useState<PhotoVerificationStatus>('unverified');
  const [theme, setTheme] = useState<ThemeName>('vermilion');
  const [filterOpen, setFilterOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planActivity, setPlanActivity] = useState('Coffee');
  const [datingPlans, setDatingPlans] = useState<DatingPlan[]>([]);
  const [planRefresh, setPlanRefresh] = useState(0);
  const [planSafetyOpen, setPlanSafetyOpen] = useState(false);
  const [safetyPlan, setSafetyPlan] = useState<DatingPlan | null>(null);
  const [matchProfile, setMatchProfile] = useState<Profile>(profiles[0]);
  const [composer, setComposer] = useState('');
  const [messagesByContact, setMessagesByContact] =
    useState<Record<string, ChatMessage[]>>(demoChatMessages);
  const hiddenChatMessages = useRef(new Set<number | string>());
  const [dailyAvailability, setDailyAvailability] =
    useState<DailyAvailability>();
  const [previewCard, setPreviewCard] = useState(false);
  const [ownAccount, setOwnAccount] = useState<{ email: string; id: string }>();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sentLikes, setSentLikes] = useState<Profile[]>([
    profiles.find((profile) => profile.name === 'Noah')!,
  ]);
  const [savedProfileNames, setSavedProfileNames] = useState<string[]>([]);
  const [serverProfiles, setServerProfiles] = useState<Profile[]>([]);
  const [serverGalaxyProfiles, setServerGalaxyProfiles] = useState<Profile[]>(
    [],
  );
  const [serverIncomingRows, setServerIncomingRows] = useState<IncomingRow[]>(
    [],
  );
  const [ownProfileMedia, setOwnProfileMedia] = useState<MediaItem[]>([]);
  const [declinedIncoming, setDeclinedIncoming] = useState<string[]>([]);
  const [registered, setRegistered] = useState(false);
  const [serverZodiac, setServerZodiac] = useState<ZodiacSign | null>(null);
  const [selfName, setSelfName] = useState('Alex');
  const [registrationData, setRegistrationData] =
    useState<RegistrationData>(initialRegistration);
  const [interactions, setInteractions] = useState<ProfileInteraction[]>([]);
  const [outgoingConnections, setOutgoingConnections] = useState<
    Record<string, 'like' | 'super_spike'>
  >({});
  const [sendBusy, setSendBusy] = useState(false);
  const [serverSentLikes, setServerSentLikes] = useState<
    { profile: Profile; status: ProfileInteraction['status'] }[]
  >([]);
  const sendLock = useRef(false);
  const pendingSendKeys = useRef(new Map<string, string>());
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
      saved === 'capture_ready' ||
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
  const profileSource = serverDataEnabled ? serverProfiles : profiles;
  const availableProfiles = profileSource.filter(
    (profile) =>
      !blockedProfiles.includes(profile.name) &&
      profile.name !== signedInIdentity?.profile.name,
  );
  const filteredProfiles = availableProfiles
    .filter((profile) => matchesFilters(profile, filters))
    .sort((a, b) => {
      const aBoosted = (activeBoosts[testEmails[a.name]] ?? 0) > boostClock;
      const bBoosted = (activeBoosts[testEmails[b.name]] ?? 0) > boostClock;
      return Number(bBoosted) - Number(aBoosted);
    });
  const current =
    filteredProfiles[profileIndex % Math.max(filteredProfiles.length, 1)] ??
    profiles[0];
  const galaxyPool = (
    serverDataEnabled
      ? galaxyLoaded && !galaxyError
        ? serverGalaxyProfiles
        : []
      : availableProfiles
  ).filter(
    (profile) =>
      !blockedProfiles.includes(profile.name) &&
      matchesFilters(profile, filters),
  );
  const roomCounts = Object.fromEntries(
    galaxyRoomNames.map((name) => [
      name,
      galaxyPool.filter((profile) =>
        matchesGalaxyRoom(name, profile, galaxyNow),
      ).length,
    ]),
  ) as Record<GalaxyRoomName, number>;
  const roomPreviewImages = Object.fromEntries(
    galaxyRoomNames.map((name) => [
      name,
      galaxyPool.find((profile) => matchesGalaxyRoom(name, profile, galaxyNow))
        ?.image,
    ]),
  ) as Record<GalaxyRoomName, string | undefined>;
  const roomProfiles = room
    ? galaxyPool.filter((profile) =>
        matchesGalaxyRoom(room, profile, galaxyNow),
      )
    : [];
  const roomCurrent = roomProfiles[roomIndex];
  const nextRoomProfile = () => setRoomIndex((index) => index + 1);
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
  const accountIncomingRows: IncomingRow[] = serverDataEnabled
    ? serverIncomingRows
    : interactions
        .filter(
          (interaction) =>
            interaction.toEmail === authEmail &&
            interaction.status === 'pending',
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
                  ? `Sent you a Spike · ${interaction.target}`
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
  const matchedProfiles = [
    ...accountSentLikes
      .filter(({ status }) => status === 'accepted')
      .map(({ profile }) => profile),
    ...contacts.flatMap((contact) => {
      const profile = allProfiles.find((item) => item.name === contact.name);
      return profile
        ? [
            {
              ...profile,
              id: contact.userId ?? profile.id,
              active: contact.active,
              lastActiveAt: contact.lastActiveAt,
            },
          ]
        : [];
    }),
  ].filter(
    (profile, index, list) =>
      list.findIndex((item) => item.name === profile.name) === index,
  );
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
  const incomingLikeCount =
    serverDataEnabled || signedInIdentity ? accountIncomingRows.length : 3;
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
        await serverAccepted('/api/availability', {
          method: 'PUT',
          body: JSON.stringify(next),
        });
        setDailyAvailability(next);
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
        await serverAccepted('/api/availability', { method: 'DELETE' });
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

  const spikeDailyStory = (story: DailyStory) => {
    const profile = identityForEmail(story.authorEmail)?.profile;
    if (!profile) return;
    setViewedDailyStory(null);
    openNote(profile);
    setNoteTarget(`Today · ${story.prompt}`);
    setNoteTodayText(story.caption);
  };

  const likeDailyStory = (story: DailyStory) => {
    const profile = identityForEmail(story.authorEmail)?.profile;
    if (!profile) return;
    setViewedDailyStory(null);
    void completeLike(profile);
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
      openNote(profile);
      setNoteMessage(text);
      setNoteTarget('Today post');
      setNoteTodayText(story.caption);
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

  const connectionState = (profile: Profile) => {
    const recipient = identityForProfile(profile);
    const id = profile.id ?? testUserIdForEmail(recipient?.email);
    if (serverDataEnabled) return id ? outgoingConnections[id] : undefined;
    const prior = interactions.find(
      (item) =>
        item.fromEmail === authEmail && item.toEmail === recipient?.email,
    );
    return prior?.kind === 'super' ? 'super_spike' : prior ? 'like' : undefined;
  };

  const recordInteraction = async (
    profile: Profile,
    kind: InteractionKind,
    note: string,
    target: string,
    upgrade = false,
  ): Promise<'sent' | 'duplicate' | 'matched' | 'failed'> => {
    if (!authEmail || sendLock.current) return 'failed';
    const recipient = identityForProfile(profile);
    const targetUserId = profile.id ?? testUserIdForEmail(recipient?.email);
    const already = connectionState(profile);
    if (
      contacts.some(
        (item) =>
          (recipient && item.email === recipient.email) ||
          (profile.id && item.userId === profile.id) ||
          (!serverDataEnabled && item.name === profile.name),
      )
    ) {
      setProfileOpen(false);
      openChatWith('', profile);
      return 'matched';
    }
    if (already === 'super_spike' || (already === 'like' && kind === 'like')) {
      announce(
        already === 'super_spike'
          ? 'Spike already sent — no allowance used'
          : 'Already liked — no allowance used',
      );
      return 'duplicate';
    }
    if (kind === 'super' && already === 'like' && !upgrade) {
      announce('Confirm the upgrade to use 1 Spike');
      return 'failed';
    }
    sendLock.current = true;
    setSendBusy(true);
    const key = `${authEmail}:${targetUserId ?? recipient?.email}:${kind}`;
    const requestKey = pendingSendKeys.current.get(key) ?? crypto.randomUUID();
    pendingSendKeys.current.set(key, requestKey);
    try {
      if (serverDataEnabled) {
        if (!targetUserId) throw new Error('This profile is unavailable.');
        const result = await serverJson<{
          interaction?: { kind: 'like' | 'super_spike' };
          duplicate?: boolean;
          match?: { id: string } | null;
          superSpikesRemaining?: number;
        }>('/api/interactions', {
          method: 'POST',
          body: JSON.stringify({
            targetUserId,
            kind: kind === 'super' ? 'super_spike' : 'like',
            note: kind === 'super' ? note.trim() || undefined : undefined,
            targetType: target.startsWith('Today')
              ? 'daily_update'
              : target.toLowerCase().includes('photo')
                ? 'photo'
                : target.startsWith('Interest ·')
                  ? 'profile'
                  : 'prompt',
            targetRef: target,
            idempotencyKey: requestKey,
            upgrade,
          }),
        });
        if (typeof result.superSpikesRemaining === 'number')
          setSuperPulsesRemaining(result.superSpikesRemaining);
        if (result.interaction)
          setOutgoingConnections((items) => ({
            ...items,
            [targetUserId]: result.interaction!.kind,
          }));
        if (!result.duplicate && kind === 'like' && membership === 'free')
          setDailyLikesRemaining((count) => Math.max(0, count - 1));
        if (result.match) {
          pendingSendKeys.current.delete(key);
          setProfileOpen(false);
          openChatWith('', profile);
          return 'matched';
        }
        if (result.duplicate) {
          pendingSendKeys.current.delete(key);
          announce(
            result.interaction?.kind === 'super_spike'
              ? 'Spike already sent — no allowance used'
              : 'Already liked — no allowance used',
          );
          return 'duplicate';
        }
      } else {
        if (kind === 'super' && superPulsesRemaining <= 0)
          throw new Error('No Spikes remaining this week');
        if (kind === 'super')
          setSuperPulsesRemaining((count) => Math.max(0, count - 1));
      }
      if (!serverDataEnabled && kind === 'like' && membership === 'free')
        setDailyLikesRemaining((count) => Math.max(0, count - 1));
      if (recipient)
        saveInteractions((items) => [
          ...items.filter(
            (item) =>
              !(
                item.fromEmail === authEmail && item.toEmail === recipient.email
              ),
          ),
          {
            id: requestKey,
            fromEmail: authEmail,
            toEmail: recipient.email,
            kind,
            target,
            note: kind === 'super' ? note.trim() : '',
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ]);
      setSentLikes((items) =>
        items.some(
          (item) => item.id === profile.id && item.name === profile.name,
        )
          ? items
          : [...items, profile],
      );
      pendingSendKeys.current.delete(key);
      announce(
        `${kind === 'super' ? 'Spike' : 'Like'} sent to ${profile.name}`,
      );
      return 'sent';
    } catch (error) {
      // Retain this request ID: retrying an uncertain response must not debit again.
      announce(
        `${(error as Error).message} — could not confirm sending. Check You liked or retry safely.`,
      );
      return 'failed';
    } finally {
      sendLock.current = false;
      setSendBusy(false);
    }
  };

  const completeLike = async (
    profile = actionProfile,
    _voiceNote?: { message: string; target: string },
  ) => {
    const already = connectionState(profile);
    const matched = contacts.some(
      (item) =>
        (profile.id && item.userId === profile.id) ||
        (identityForProfile(profile)?.email &&
          item.email === identityForProfile(profile)?.email) ||
        (!serverDataEnabled && item.name === profile.name),
    );
    if (
      membership === 'free' &&
      dailyLikesRemaining <= 0 &&
      !already &&
      !matched
    ) {
      setNoteOpen(false);
      setSubscriptionOpen(true);
      announce('Daily Likes used — SpikeDate+ keeps Likes unlimited');
      return false;
    }
    const outcome = await recordInteraction(profile, 'like', '', 'Profile');
    if (outcome === 'sent' || outcome === 'duplicate') {
      nextProfile();
      return true;
    }
    return false;
  };

  const openNote = (profile = current) => {
    if (
      contacts.some(
        (item) =>
          (identityForProfile(profile)?.email &&
            item.email === identityForProfile(profile)?.email) ||
          (profile.id && item.userId === profile.id) ||
          (!serverDataEnabled && item.name === profile.name),
      )
    ) {
      setProfileOpen(false);
      openChatWith('', profile);
      return;
    }
    setEngagementNudge(null);
    setProfileOpen(false);
    setActionProfile(profile);
    setNoteTarget(
      profile.prompts?.[0]?.answer?.trim() || profile.prompt?.trim()
        ? 'Prompt'
        : 'Photo 1',
    );
    setNoteMessage('');
    setNoteTodayText('');
    setNoteOpen(true);
  };

  const sendNoteAction = async () => {
    const already = connectionState(actionProfile);
    if (superPulsesRemaining <= 0 && already !== 'super_spike') {
      announce('No Spikes remaining this week');
      setNoteOpen(false);
      setSubscriptionOpen(true);
      return;
    }
    const outcome = await recordInteraction(
      actionProfile,
      'super',
      noteMessage,
      noteTarget,
      already === 'like',
    );
    if (outcome === 'sent' || outcome === 'duplicate') {
      setNoteOpen(false);
      nextProfile();
      if (room && roomCurrent?.id === actionProfile.id) nextRoomProfile();
    } else if (outcome === 'matched') setNoteOpen(false);
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
    openNote(nudge.profile);
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
    const existingContact = contacts.find(
      (item) =>
        (profile.id && item.userId === profile.id) ||
        (identityForProfile(profile)?.email &&
          item.email === identityForProfile(profile)?.email) ||
        (!serverDataEnabled && item.name === profile.name),
    );
    const contact = {
      ...existingContact,
      name: profile.name,
      userId: profile.id ?? existingContact?.userId,
      image: profile.image,
      email: identityForProfile(profile)?.email,
      preview: text || 'You matched today',
      time: 'Now',
      active: profile.active ?? existingContact?.active ?? false,
      lastActiveAt:
        profile.lastActiveAt !== undefined
          ? profile.lastActiveAt
          : existingContact?.lastActiveAt,
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

  const likeBack = async (profile: Profile, interactionId?: string) => {
    const outcome = await recordInteraction(profile, 'like', '', 'Profile');
    if (outcome === 'failed') return;
    setServerIncomingRows((rows) =>
      rows.filter((row) => row.id !== interactionId),
    );
    if (outcome === 'matched') return;
    if (interactionId)
      saveInteractions((current) =>
        current.map((item) =>
          item.id === interactionId ? { ...item, status: 'accepted' } : item,
        ),
      );
    setMatchProfile(profile);
    setMatchOpen(true);
  };

  const sendMessage = (preset?: string) => {
    const text = (preset ?? composer).trim();
    if (!text) return;
    const draftId = Date.now();
    const recipientName = activeChat.name;
    setMessagesByContact((items) => ({
      ...items,
      [activeChat.name]: [
        ...(items[activeChat.name] ?? []),
        { id: draftId, text, mine: true },
      ],
    }));
    setContacts((items) =>
      items.map((item) =>
        item.name === activeChat.name
          ? {
              ...item,
              preview: text,
              time: 'Now',
              unread: serverDataEnabled ? item.unread : 0,
            }
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
      const saved = await serverJson<{ message: { id: string } }>(
        `/api/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ body: text, clientId: crypto.randomUUID() }),
        },
      );
      if (hiddenChatMessages.current.has(draftId))
        hiddenChatMessages.current.add(saved.message.id);
      setMessagesByContact((items) => ({
        ...items,
        [recipientName]: (items[recipientName] ?? []).map((message) =>
          message.id === draftId
            ? { ...message, id: saved.message.id }
            : message,
        ),
      }));
    }, 'Message kept on this device but could not be delivered.');
    setComposer('');
  };

  const sendChatAttachment = async (
    file: Blob,
    kind: 'photo' | 'voice',
    durationMs?: number,
    clientId?: string,
  ) => {
    if (!serverDataEnabled)
      throw new Error('Photo and voice messages need a connected account.');
    const contact = activeChat;
    let conversationId = contact.conversationId;
    if (!conversationId) {
      const targetUserId = contact.userId ?? testUserIdForEmail(contact.email);
      const result = await serverJson<{
        conversations: Array<{ id: string; other_user_id: string }>;
      }>('/api/conversations');
      conversationId = result.conversations.find(
        (item) => item.other_user_id === targetUserId,
      )?.id;
    }
    if (!conversationId)
      throw new Error('Match before starting a conversation.');
    const result = await serverJson<{
      message: {
        id: string;
        body: string;
        deliveredAt: number | null;
        mediaDurationMs: number | null;
      };
    }>(`/api/conversations/${conversationId}/attachments`, {
      method: 'POST',
      headers: {
        'content-type': file.type,
        'x-spikedate-kind': kind,
        'x-spikedate-client-id': clientId || crypto.randomUUID(),
        ...(kind === 'voice'
          ? { 'x-spikedate-duration-ms': String(durationMs ?? 0) }
          : {}),
      },
      body: file,
    });
    const message: ChatMessage = {
      id: result.message.id,
      text: result.message.body,
      mine: true,
      deliveredAt: result.message.deliveredAt,
      mediaKind: kind,
      mediaDurationMs: result.message.mediaDurationMs,
    };
    setMessagesByContact((items) => ({
      ...items,
      [contact.name]: (items[contact.name] ?? []).some(
        (entry) => entry.id === message.id,
      )
        ? (items[contact.name] ?? [])
        : [...(items[contact.name] ?? []), message],
    }));
    setContacts((items) =>
      items.map((item) =>
        item.name === contact.name
          ? {
              ...item,
              preview: kind === 'photo' ? 'Photo' : 'Voice message',
              time: 'Now',
            }
          : item,
      ),
    );
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
    mirrorToServer(async () => {
      const result = await serverJson<{ plan: { id: string } }>(
        '/api/galaxy/plans',
        {
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
            inviteeIds: plan.invitees.flatMap((name) => {
              const contact = contacts.find((item) => item.name === name);
              const id =
                contact?.userId ??
                (contact?.email
                  ? testUserIdForEmail(contact.email)
                  : undefined);
              return id ? [id] : [];
            }),
          }),
        },
      );
      setDatingPlans((items) =>
        items.map((item) =>
          item.id === completePlan.id
            ? { ...item, serverId: result.plan.id }
            : item,
        ),
      );
      setPlanRefresh((value) => value + 1);
    }, 'Plan saved on this device but could not be sent to every match.');
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
    if (plan.serverId)
      mirrorToServer(async () => {
        await serverJson(
          `/api/galaxy/plans/${encodeURIComponent(plan.serverId!)}`,
          {
            method: 'DELETE',
          },
        );
        setPlanRefresh((value) => value + 1);
      });
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
    if (plan.serverId)
      mirrorToServer(async () => {
        await serverJson(
          `/api/galaxy/plans/${encodeURIComponent(plan.serverId!)}/respond`,
          {
            method: 'POST',
            body: JSON.stringify({ response: status }),
          },
        );
        setPlanRefresh((value) => value + 1);
      });
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
    const sequence = ++chatLoadSequence.current;
    setChatLoading(Boolean(serverDataEnabled && contact.conversationId));
    setActiveChat({
      ...contact,
      unread: serverDataEnabled ? contact.unread : 0,
    });
    setContacts((items) =>
      items.map((item) =>
        item.name === contact.name && !serverDataEnabled
          ? { ...item, unread: 0 }
          : item,
      ),
    );
    if (!serverDataEnabled && authEmail && contact.email) {
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
            delivered_at: number | null;
            read_at: number | null;
            media_kind: 'photo' | 'voice' | null;
            media_duration_ms: number | null;
          }>;
        }>(`/api/conversations/${contact.conversationId}/messages`);
        if (sequence !== chatLoadSequence.current) return;
        setMessagesByContact((items) => ({
          ...items,
          [contact.name]: result.messages
            .filter((message) => !hiddenChatMessages.current.has(message.id))
            .map((message) => ({
              id: message.id,
              text: message.body,
              mine: message.sender_id !== contact.userId,
              deliveredAt: message.delivered_at,
              readAt: message.read_at,
              mediaKind: message.media_kind,
              mediaDurationMs: message.media_duration_ms,
            })),
        }));
        const receivedIds = result.messages
          .filter(
            (message) =>
              message.sender_id === contact.userId && !message.delivered_at,
          )
          .map((message) => message.id)
          .slice(0, 80);
        if (receivedIds.length)
          void serverJson(
            `/api/conversations/${contact.conversationId}/messages`,
            {
              method: 'PATCH',
              body: JSON.stringify({ deliveredIds: receivedIds }),
            },
          ).catch(() => {});
      } catch {
        announce('Messages are temporarily unavailable.');
      } finally {
        if (sequence === chatLoadSequence.current) setChatLoading(false);
      }
    }
  };

  useEffect(() => {
    if (
      !serverDataEnabled ||
      !chatOpen ||
      tab !== 'Chat' ||
      !activeChat.conversationId ||
      chatLoading
    )
      return;
    let cancelled = false;
    let busy = false;
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || busy) return;
      busy = true;
      try {
        const result = await serverJson<{
          messages: Array<{
            id: string;
            sender_id: string;
            body: string;
            delivered_at: number | null;
            read_at: number | null;
            media_kind: 'photo' | 'voice' | null;
            media_duration_ms: number | null;
          }>;
        }>(`/api/conversations/${activeChat.conversationId}/messages`);
        if (!cancelled)
          setMessagesByContact((items) => ({
            ...items,
            [activeChat.name]: [
              ...result.messages
                .filter(
                  (message) => !hiddenChatMessages.current.has(message.id),
                )
                .map((message) => ({
                  id: message.id,
                  text: message.body,
                  mine: message.sender_id !== activeChat.userId,
                  deliveredAt: message.delivered_at,
                  readAt: message.read_at,
                  mediaKind: message.media_kind,
                  mediaDurationMs: message.media_duration_ms,
                })),
              ...(items[activeChat.name] ?? []).filter(
                (message) => typeof message.id === 'number',
              ),
            ],
          }));
        const receivedIds = result.messages
          .filter(
            (message) =>
              message.sender_id === activeChat.userId && !message.delivered_at,
          )
          .map((message) => message.id)
          .slice(0, 80);
        if (receivedIds.length)
          await serverJson(
            `/api/conversations/${activeChat.conversationId}/messages`,
            {
              method: 'PATCH',
              body: JSON.stringify({ deliveredIds: receivedIds }),
            },
          );
      } catch {
        /* Keep existing history when the network is unavailable. */
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), 5000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [
    chatOpen,
    tab,
    activeChat.conversationId,
    activeChat.name,
    activeChat.userId,
    chatLoading,
  ]);

  const acknowledgeVisibleMessages = async (ids: string[]) => {
    if (!serverDataEnabled || !activeChat.conversationId) return;
    const name = activeChat.name;
    const result = await serverJson<{
      messages: Array<{
        id: string;
        delivered_at: number | null;
        read_at: number | null;
      }>;
    }>(`/api/conversations/${activeChat.conversationId}/messages`, {
      method: 'PATCH',
      body: JSON.stringify({ messageIds: ids }),
    });
    const receipts = new Map(
      result.messages.map((message) => [message.id, message]),
    );
    setMessagesByContact((items) => ({
      ...items,
      [name]: (items[name] ?? []).map((message) =>
        receipts.has(String(message.id))
          ? {
              ...message,
              readAt: receipts.get(String(message.id))?.read_at,
              deliveredAt: receipts.get(String(message.id))?.delivered_at,
            }
          : message,
      ),
    }));
    const counts = await serverJson<{
      conversations: Array<{ id: string; unread_count: number }>;
    }>('/api/conversations');
    setContacts((items) =>
      items.map((item) => {
        const conversation = counts.conversations.find(
          (entry) => entry.id === item.conversationId,
        );
        return conversation
          ? { ...item, unread: Number(conversation.unread_count) }
          : item;
      }),
    );
  };

  useEffect(() => {
    if (!serverDataEnabled || !authEmail) return;
    let cancelled = false;
    let busy = false;
    const refresh = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const result = await serverJson<{
          conversations: Array<{
            id: string;
            unread_count: number;
            preview?: string | null;
          }>;
        }>('/api/conversations');
        if (!cancelled)
          setContacts((items) =>
            items.map((item) => {
              const conversation = result.conversations.find(
                (entry) => entry.id === item.conversationId,
              );
              return conversation
                ? {
                    ...item,
                    unread: Number(conversation.unread_count),
                    preview: conversation.preview ?? item.preview,
                  }
                : item;
            }),
          );
      } catch {
        /* Keep the last known inbox counts while offline. */
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = window.setInterval(
      () => void refresh(),
      tab === 'Chat' ? 5000 : 15000,
    );
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [authEmail, tab]);

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
        headers: {
          'content-type': photo.blob.type,
          'x-spikedate-width': String(photo.width),
          'x-spikedate-height': String(photo.height),
          'x-spikedate-source-width': String(photo.originalWidth),
          'x-spikedate-source-height': String(photo.originalHeight),
          'x-spikedate-focal-x': String(Math.round(photo.focusX * 100)),
          'x-spikedate-focal-y': String(Math.round(photo.focusY * 100)),
          'x-spikedate-crop-zoom': String(Math.round(photo.zoom * 1000)),
        },
        body: photo.blob,
      });
      const variants = [
        { name: 'card', blob: photo.cardBlob },
        { name: 'avatar', blob: photo.avatarBlob },
        { name: 'original', blob: photo.originalBlob },
      ] as const;
      const variantResults = await Promise.allSettled(
        variants.map(({ name, blob }) =>
          serverJson(`/api/media/${result.media.id}?variant=${name}`, {
            method: 'PUT',
            headers: {
              'content-type': blob.type || 'image/jpeg',
            },
            body: blob,
          }),
        ),
      );
      const missingVariants = variantResults.filter(
        (result) => result.status === 'rejected',
      ).length;
      media = {
        id: result.media.id,
        type: 'photo',
        src: result.media.url,
        moderationStatus: result.media.moderationStatus,
      };
      if (missingVariants)
        announce(
          'Photo saved. Some optimized sizes will be regenerated later.',
        );
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
    const qualityMessage = photo.lowResolution
      ? 'Photo added. Cloud Enhance will improve its display automatically; a larger original will still look sharper.'
      : (photo.qualityWarnings[0] ??
        'Photo cropped and saved with cinematic mobile variants');
    announce(qualityMessage);
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

  const completeRegistration = async (data: RegistrationData) => {
    const newRegistration = !registered || registrationCameraCheck;
    // Do not close setup or start the camera until the server has saved it.
    if (serverDataEnabled)
      await (async () => {
        await serverJson('/api/profile', {
          method: 'PATCH',
          body: JSON.stringify({
            section: 'profile',
            data: {
              displayName: data.name,
              birthDate: data.birthday,
              gender: data.gender,
              bio: data.bio,
              pronouns: data.pronouns || null,
              occupation: data.occupation || null,
              education: data.education || null,
              heightCm: heightToCentimeters(data.height),
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
              {
                prompt: data.promptOneQuestion || 'My ideal Sunday…',
                answer: data.promptOne,
              },
              {
                prompt:
                  data.promptTwoQuestion || 'The quickest way to my heart…',
                answer: data.promptTwo,
              },
            ].filter((item) => item.answer.trim().length >= 2),
          }),
        });
        await serverJson('/api/profile', {
          method: 'PATCH',
          body: JSON.stringify({
            section: 'interests',
            data: data.interests.slice(0, 20),
          }),
        });
        await serverJson('/api/profile', {
          method: 'PATCH',
          body: JSON.stringify({
            section: 'connection',
            data: connectionForRegistration(data),
          }),
        });
      })();
    setSelfName(data.name || 'Alex');
    setRegistered(true);
    setRegistrationData({
      ...data,
      zodiac: zodiacFromBirthDate(data.birthday) ?? '',
    });
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
    setRegistrationOpen(false);
    setProfileIndex(0);
    if (newRegistration) {
      setRegistrationCameraCheck(true);
      setVerificationStatus('unverified');
      setVerificationOpen(true);
      announce(
        'Profile saved. Next, capture your face; your profile stays private until verified.',
      );
    } else announce('Profile updated');
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
    announce('SpikeDate+ active — Likes are unlimited and 3 Spikes are ready');
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
      `Hello ${selfName}. You have ${contacts.length} matches, ${incomingLikeCount} people in Incoming, and ${unreadMessages} unread messages. This week you sent ${sentThisWeek} Spike${sentThisWeek === 1 ? '' : 's'}. You have ${superPulsesRemaining} Spike${superPulsesRemaining === 1 ? '' : 's'} and ${boostsRemaining} Profile Lift${boostsRemaining === 1 ? '' : 's'} remaining.`,
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
      : `${profile.name}, ${profile.age}, is in ${profile.place}, ${profile.distance}. Looking for ${profile.intent.toLowerCase()}. Interests include ${profile.tags.join(', ')}. Would you like to see pictures, hear more, send a Spike, or go to the next profile?`;

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
          void completeLike(action.profile, {
            message: '',
            target: action.profile.tags[0] ?? 'Photo 1',
          });
          speakVoiceResponse(`Like sent to ${action.profile.name}.`);
          return;
        }
        if (action.kind === 'super') {
          setVoiceOpen(false);
          openNote(action.profile);
          speakVoiceResponse(
            'Review your Spike before sending. An upgrade uses 1 Spike.',
          );
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
      handleTab('Likes');
      speakVoiceResponse('Opening Likes and Spikes.');
      return;
    }
    if (
      normalized.includes('send spike') ||
      normalized.includes('super pulse') ||
      normalized.includes('send pulse') ||
      normalized.includes('spark')
    ) {
      setPendingVoiceAction({ kind: 'super', profile: current });
      speakVoiceResponse(
        `Send a Spike to ${current.name}? Say yes to confirm or cancel.`,
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
      'Try saying: show profiles for today, read basics, show pictures, next profile, send a Spike, Profile Lift, or open messages.',
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
    if (!singleSection && authEmail) {
      try {
        if (localStorage.getItem(`spikedate-setup-draft:${authEmail}`))
          setRegistrationCameraCheck(true);
      } catch {
        /* Unavailable local storage does not block the editor. */
      }
    }
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
    details: SignupDetails,
    phoneVerificationToken?: string,
  ) => {
    if (!isAdult(details.birthDate))
      return 'You must be at least 18 to use SpikeDate.';
    if (!['Woman', 'Man', 'Nonbinary'].includes(details.gender))
      return 'Choose your gender.';
    if (!details.termsAccepted)
      return 'Accept the terms and privacy policy to continue.';
    if (!passwordSchema.safeParse(password).success)
      return 'Use 12–128 characters with uppercase, lowercase, and a number.';
    const normalized = email.trim().toLowerCase();
    if (serverDataEnabled) {
      try {
        await serverJson('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: normalized,
            password,
            birthDate: details.birthDate,
            displayName: 'New member',
            gender: details.gender,
            relationshipGoal: 'Dating',
            termsAccepted: details.termsAccepted,
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
    setSelfName('New member');
    setRegistrationData({
      ...initialRegistration,
      name: '',
      birthday: details.birthDate,
      gender: details.gender as Gender,
      city: '',
      pronouns: '',
      height: '',
      ethnicity: '',
      pets: '',
      kids: '',
      wantsKids: '',
      drinking: '',
      smoking: '',
      intents: [],
      interests: [],
      promptOne: '',
      promptTwo: '',
      preferredGenders: [],
    });
    setRegistrationStep(0);
    setRegistrationSingleSection(false);
    setRegistrationCameraCheck(true);
    setRegistrationOpen(true);
    return null;
  };

  const logout = () => {
    setRegistrationCameraCheck(false);
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
    if (saved && themeChoices.some((choice) => choice.id === saved)) {
      setTheme(saved as ThemeName);
    } else if (saved) {
      window.localStorage.setItem('pulse-theme', 'vermilion');
    }
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
    if (!serverDataEnabled || !authEmail || tab !== 'Chat') return;
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const data = await serverJson<{
          conversations: Array<{
            other_user_id: string;
            active: boolean;
            lastActiveAt: number | null;
          }>;
        }>('/api/conversations');
        if (cancelled) return;
        const update = (contact: ChatContact) => {
          const row = data.conversations.find(
            (item) => item.other_user_id === contact.userId,
          );
          return row
            ? { ...contact, active: row.active, lastActiveAt: row.lastActiveAt }
            : { ...contact, active: false, lastActiveAt: null };
        };
        setContacts((current) => current.map(update));
        setActiveChat((current) => (current ? update(current) : current));
      } catch {
        // Keep the last timestamp; the presence component still expires it.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [authEmail, tab]);

  useEffect(() => {
    setServerGalaxyProfiles([]);
    setGalaxyLoaded(false);
    setRoomIndex(0);
  }, [authEmail]);

  useEffect(() => {
    if (!serverDataEnabled || !authEmail || tab !== 'Galaxy') return;
    let cancelled = false;
    setGalaxyLoaded(false);
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const data = await serverJson<{ profiles: DiscoverCandidate[] }>(
          '/api/discover?limit=50&includeMatches=1',
        );
        if (cancelled) return;
        setServerGalaxyProfiles(data.profiles.map(profileFromDiscovery));
        setGalaxyNow(Date.now());
        setGalaxyLoaded(true);
        setGalaxyError(false);
      } catch {
        if (!cancelled) {
          setGalaxyLoaded(true);
          setGalaxyError(true);
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 45_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [authEmail, tab, galaxyRefresh]);

  useEffect(() => {
    if (!serverDataEnabled || !authEmail) {
      setServerProfiles([]);
      setOwnProfileMedia([]);
      return;
    }
    let cancelled = false;
    void Promise.all([
      serverJson<{
        zodiac: ZodiacSign | null;
        connection?: ProfileConnection;
        birthDate: string | null;
        profile: Record<string, unknown> | null;
        prompts: Array<{ prompt: string; answer: string }>;
        interests: Array<{ label: string }>;
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
        dailyUpdate: {
          id: string;
          text: string;
          visibility: DailyStoryVisibility;
          created_at: number;
          expires_at: number;
        } | null;
      }>('/api/profile'),
      serverJson<{ profiles: DiscoverCandidate[] }>('/api/discover?limit=50'),
      serverJson<{
        conversations: Array<{
          id: string;
          other_user_id: string;
          display_name: string;
          preview?: string | null;
          unread_count?: number;
          active?: boolean;
          lastActiveAt?: number | null;
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
        setServerZodiac(account.zodiac ?? null);
        const serverFilters = filtersFromServerPreferences(account.preferences);
        if (serverFilters) setFilters(serverFilters);
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
        const savedStories = readDailyStories().filter(
          (story) => story.authorEmail !== authEmail,
        );
        const serverStory: DailyStory | null = account.dailyUpdate
          ? {
              id: account.dailyUpdate.id,
              authorEmail: authEmail,
              authorName:
                typeof account.profile?.display_name === 'string'
                  ? account.profile.display_name
                  : selfName,
              caption: account.dailyUpdate.text,
              prompt: '',
              visibility: account.dailyUpdate.visibility,
              repliesEnabled: true,
              viewedBy: [],
              createdAt: new Date(account.dailyUpdate.created_at).toISOString(),
              expiresAt: new Date(account.dailyUpdate.expires_at).toISOString(),
            }
          : null;
        const restoredStories = normalizeDailyStories(
          serverStory ? [serverStory, ...savedStories] : savedStories,
        );
        setDailyStories(restoredStories);
        try {
          window.localStorage.setItem(
            'pulse-daily-stories',
            JSON.stringify(restoredStories),
          );
        } catch {
          // The live Today state remains available even if local storage is full.
        }
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
        setServerProfiles(discovery.profiles.map(profileFromDiscovery));
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
                active: conversation.active,
                lastActiveAt: conversation.lastActiveAt ?? null,
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
        if (typeof profile?.user_id === 'string')
          setOwnAccount({ email: authEmail, id: profile.user_id });
        const profileText = (key: string, fallback: string) =>
          typeof profile?.[key] === 'string'
            ? (profile[key] as string)
            : fallback;
        if (profile) {
          const isNewMember = profileText('display_name', '') === 'New member';
          setSelfName(profileText('display_name', 'New member'));
          setRegistered(Boolean(profile.completed_at || profile.bio));
          setRegistrationData((currentData) => ({
            ...currentData,
            name: isNewMember
              ? ''
              : profileText('display_name', currentData.name),
            birthday: account.birthDate ?? currentData.birthday,
            gender: (profileText('gender', currentData.gender) ||
              currentData.gender) as Gender,
            zodiac: account.zodiac ?? '',
            bio: profileText('bio', currentData.bio),
            pronouns: profileText('pronouns', ''),
            height:
              typeof profile.height_cm === 'number' && profile.height_cm > 0
                ? `${profile.height_cm} cm`
                : '',
            ethnicity: profileText('ethnicity', ''),
            pets: profileText('pets', ''),
            kids: profileText('kids', ''),
            wantsKids: profileText('wants_kids', ''),
            drinking: profileText('drinking', ''),
            smoking: profileText('smoking', ''),
            intents: isNewMember
              ? currentData.intents
              : [profileText('relationship_goal', 'Dating')],
            preferredGenders:
              serverFilters?.genders ?? currentData.preferredGenders,
            minAge: serverFilters?.minAge ?? currentData.minAge,
            maxAge: serverFilters?.maxAge ?? currentData.maxAge,
            maxDistance: serverFilters?.maxDistance ?? currentData.maxDistance,
            promptOne: account.prompts?.[0]?.answer ?? profileText('bio', ''),
            promptTwo: account.prompts?.[1]?.answer ?? '',
            promptOneQuestion: account.prompts?.[0]?.prompt,
            promptTwoQuestion: account.prompts?.[1]?.prompt,
            interests:
              account.interests?.map((interest) => interest.label) ?? [],
            city: profileText('city', currentData.city),
            occupation: profileText('occupation', currentData.occupation),
            education: profileText('education', currentData.education),
            ...(account.connection || emptyConnection),
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
    if (!serverDataEnabled || !authEmail) {
      setServerIncomingRows([]);
      setOutgoingConnections({});
      setServerSentLikes([]);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await serverJson<{
          outgoing: Array<{
            target_id: string;
            kind: 'like' | 'super_spike';
            display_name: string;
            gender: string;
            bio: string;
            city: string | null;
            relationship_goal: string;
            age: number;
            media_id: string | null;
            matched: number;
            media: { type: 'photo' | 'video'; src: string }[];
          }>;
          incoming: Array<{
            id: string;
            actor_id: string;
            display_name: string;
            age: number;
            gender: string;
            bio: string;
            city: string | null;
            relationship_goal: string;
            verification_status: string;
            kind: string;
            note: string | null;
            target_ref: string | null;
            imageUrl: string | null;
          }>;
        }>('/api/interactions');
        if (cancelled) return;
        setOutgoingConnections(
          Object.fromEntries(
            data.outgoing.map((row) => [
              row.target_id,
              data.outgoing.some(
                (other) =>
                  other.target_id === row.target_id &&
                  other.kind === 'super_spike',
              )
                ? 'super_spike'
                : row.kind,
            ]),
          ),
        );
        setServerSentLikes(
          data.outgoing.map((row) => ({
            status: row.matched ? 'accepted' : 'pending',
            profile: {
              id: row.target_id,
              media: row.media,
              name: row.display_name,
              age: row.age,
              gender:
                row.gender === 'Woman' || row.gender === 'woman'
                  ? 'Woman'
                  : row.gender === 'Man' || row.gender === 'man'
                    ? 'Man'
                    : 'Nonbinary',
              image: row.media_id
                ? `/api/media/${row.media_id}?variant=full`
                : '/profile-placeholder.svg',
              place: row.city || 'Not shared',
              intent: row.relationship_goal,
              prompt: row.bio,
              distance: 'Not shared',
              distanceMiles: 0,
              tags: [],
              height: 'Not shared',
              ethnicity: 'Not shared',
              pets: 'Not shared',
              kids: 'Not shared',
              wantsKids: 'Not shared',
              drinking: 'Not shared',
              smoking: 'Not shared',
            },
          })),
        );
        setServerIncomingRows(
          data.incoming.map((row) => {
            const suffix = row.actor_id.match(/^test-(\d{3})$/)?.[1];
            const known = suffix
              ? identityForEmail(`test${suffix}@spikedate.test`)?.profile
              : undefined;
            const profile: Profile = {
              ...(known ?? {
                distance: 'Not shared',
                distanceMiles: 0,
                tags: [],
                height: 'Not shared',
                ethnicity: 'Not shared',
                pets: 'Not shared',
                kids: 'Not shared',
                wantsKids: 'Not shared',
                drinking: 'Not shared',
                smoking: 'Not shared',
              }),
              id: row.actor_id,
              name: row.display_name,
              age: row.age,
              gender:
                row.gender === 'woman'
                  ? 'Woman'
                  : row.gender === 'man'
                    ? 'Man'
                    : 'Nonbinary',
              place: row.city || 'Not shared',
              intent: row.relationship_goal,
              prompt: row.bio,
              verified: [
                'verified',
                'photo_verified',
                'identity_verified',
              ].includes(row.verification_status),
              image: row.imageUrl ?? '/profile-placeholder.svg',
              media: row.imageUrl ? [{ type: 'photo', src: row.imageUrl }] : [],
            };
            return {
              id: row.id,
              profile,
              liked:
                row.kind === 'super_spike'
                  ? 'Sent you a Spike'
                  : 'Liked your profile',
              note: row.note ? `“${row.note}”` : '',
              superPulse: row.kind === 'super_spike',
            };
          }),
        );
      } catch {
        if (!cancelled)
          announce('Could not refresh incoming Likes. Try again.');
      }
    };
    void refresh();
    const timer =
      tab === 'Likes'
        ? window.setInterval(() => void refresh(), 15000)
        : undefined;
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [authEmail, tab]);

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
          active: other.profile.active,
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
              serverId: plan.serverId,
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
    if (
      !serverDataEnabled ||
      !authEmail ||
      tab !== 'Galaxy' ||
      ownAccount?.email !== authEmail
    )
      return;
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const data = await serverJson<{ plans: ServerGalaxyPlanRow[] }>(
          '/api/galaxy/plans',
        );
        if (cancelled) return;
        setDatingPlans((current) =>
          data.plans.map((row) => {
            const live = planFromServer(row, authEmail, ownAccount.id);
            const saved = current.find((item) => item.serverId === row.id);
            return saved
              ? {
                  ...live,
                  safetyCheckInEnabled: saved.safetyCheckInEnabled,
                  safetyCheckInMinutes: saved.safetyCheckInMinutes,
                  safetyStatus: saved.safetyStatus,
                  safetyAcknowledgedAt: saved.safetyAcknowledgedAt,
                }
              : live;
          }),
        );
      } catch {
        // Preserve the current plans until connectivity returns.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [authEmail, tab, planRefresh, ownAccount]);

  useEffect(() => {
    const midnightAccent = midnightAccentThemes.has(theme);
    document.documentElement.dataset.pulseTheme = 'default';
    if (midnightAccent) {
      document.documentElement.dataset.pulseAccent = theme;
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
          tab: {
            type: 'string',
            enum: ['Pulse', 'Galaxy', 'Likes', 'Chat', 'Profile'],
          },
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
        void completeLike(current);
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
    <LivePresenceProvider
      key={authEmail}
      enabled={serverDataEnabled}
      account={authEmail}
    >
      <main className="app-shell" data-theme={theme}>
        <div className="phone-frame" data-active-tab={tab}>
          <button
            className={`global-boost-button ${boostActive ? 'active' : ''}`}
            aria-label={
              boostActive ? 'View active Profile Lift' : 'Lift my profile'
            }
            onClick={() => setBoostOpen(true)}
          >
            <ProfileLiftMark size={23} />
            <span className="sr-only">
              {boostActive
                ? 'Profile Lift active'
                : `${boostsRemaining} Profile Lifts left`}
            </span>
          </button>
          {tab === 'Pulse' && (
            <DiscoverHeader
              onFilters={() => setFilterOpen(true)}
              onVoice={openVoice}
              voiceEnabled={voiceAvailable}
              activeFilterCount={activeFilterCount}
            />
          )}
          {tab === 'Pulse' &&
            (filteredProfiles.length ? (
              <DiscoverScreen
                profile={current}
                connection={connectionState(current)}
                busy={sendBusy}
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
                onLike={() => completeLike(current)}
                onSpark={() => {
                  if (
                    matchedProfiles.some((item) => item.name === current.name)
                  )
                    openChatWith('', current);
                  else openNote(current);
                }}
                matched={matchedProfiles.some(
                  (item) => item.name === current.name,
                )}
                onTonight={() => openNote(current)}
                saved={savedProfileNames.includes(current.name)}
                onToggleSaved={() => toggleSavedProfile(current)}
              />
            ) : (
              <EmptyDiscover
                onFilters={() => setFilterOpen(true)}
                availableCount={availableProfiles.length}
                onShowAll={() => {
                  setFilters({
                    ...defaultFilters,
                    genders: ['Woman', 'Man', 'Nonbinary'],
                    minAge: 18,
                    maxAge: 60,
                    maxDistance: 50,
                  });
                  setProfileIndex(0);
                }}
              />
            ))}
          {tab === 'Galaxy' && !room && (
            <RoomsHub
              onGames={() => handleTab('Chat')}
              astrology={
                <AstrologyDiscovery
                  sign={
                    serverDataEnabled
                      ? serverZodiac
                      : zodiacFromBirthDate(
                          registered
                            ? registrationData.birthday
                            : birthdays[selfName],
                        )
                  }
                  people={profileSource.map((person) => ({
                    ...person,
                    zodiac: serverDataEnabled
                      ? person.zodiac
                      : zodiacFromBirthDate(birthdays[person.name]),
                  }))}
                  onProfile={(person) => {
                    const profile = profileSource.find((p) =>
                      person.id ? p.id === person.id : p.name === person.name,
                    );
                    if (profile) openFullProfile(profile);
                  }}
                />
              }
              onOpenRoom={(name) => {
                setRoomIndex(0);
                setRoom(name);
              }}
              roomCounts={roomCounts}
              roomPreviewImages={roomPreviewImages}
              roomsLoading={serverDataEnabled && !galaxyLoaded}
              roomsError={serverDataEnabled && galaxyError}
              onRefreshRooms={() => setGalaxyRefresh((value) => value + 1)}
              matchedContacts={contacts}
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
              profile={roomCurrent}
              count={roomProfiles.length}
              loading={serverDataEnabled && !galaxyLoaded}
              error={serverDataEnabled && galaxyError}
              onBack={() => setRoom(null)}
              onRetry={() => {
                setRoomIndex(0);
                setGalaxyRefresh((value) => value + 1);
              }}
              onStartOver={() => setRoomIndex(0)}
              onOpen={() => roomCurrent && openFullProfile(roomCurrent)}
              onPass={nextRoomProfile}
              onLike={() => {
                if (roomCurrent)
                  void completeLike(roomCurrent).then((advanced) => {
                    if (advanced) nextRoomProfile();
                  });
              }}
              onSpark={() => roomCurrent && openNote(roomCurrent)}
            />
          )}
          {tab === 'Likes' && (
            <LikesScreen
              sentLikes={
                serverDataEnabled
                  ? serverSentLikes
                  : signedInIdentity
                    ? accountSentLikes
                    : sentLikes.map((profile) => ({
                        profile,
                        status:
                          profile.name === 'Maya'
                            ? ('accepted' as const)
                            : ('pending' as const),
                      }))
              }
              incomingRows={
                serverDataEnabled || signedInIdentity
                  ? accountIncomingRows
                  : undefined
              }
              matchedProfiles={matchedProfiles}
              declined={declinedIncoming}
              onLikeBack={likeBack}
              onPass={(name, interactionId) => {
                if (serverDataEnabled) {
                  const row = serverIncomingRows.find(
                    (row) => row.id === interactionId,
                  );
                  if (row?.profile.id)
                    mirrorToServer(() =>
                      serverJson('/api/interactions', {
                        method: 'POST',
                        body: JSON.stringify({
                          targetUserId: row.profile.id,
                          kind: 'pass',
                          idempotencyKey: crypto.randomUUID(),
                        }),
                      }),
                    );
                  setServerIncomingRows((rows) =>
                    rows.filter((row) => row.id !== interactionId),
                  );
                }
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
              onUpgrade={() => setSubscriptionOpen(true)}
              onBrowse={() => handleTab('Pulse')}
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
                if (profile)
                  openFullProfile({
                    ...profile,
                    id: contact.userId ?? profile.id,
                    active: contact.active,
                    lastActiveAt: contact.lastActiveAt,
                  });
              }}
            />
          )}
          {tab === 'Chat' && chatOpen && (
            <ChatThread
              contact={activeChat}
              loading={chatLoading}
              messages={activeMessages}
              onReadVisible={acknowledgeVisibleMessages}
              plan={datingPlans.find(
                (plan) =>
                  plan.invitees.includes(activeChat.name) &&
                  plan.status !== 'declined' &&
                  plan.status !== 'cancelled',
              )}
              composer={composer}
              onComposer={setComposer}
              onSend={sendMessage}
              onSendMedia={sendChatAttachment}
              onPlan={() => openPlanBuilder('Coffee')}
              onBack={() => setChatOpen(false)}
              onProfile={() => {
                const profile = allProfiles.find(
                  (item) => item.name === activeChat.name,
                );
                if (profile)
                  openFullProfile({
                    ...profile,
                    id: activeChat.userId ?? profile.id,
                    active: activeChat.active,
                    lastActiveAt: activeChat.lastActiveAt,
                  });
              }}
              onSafety={() => {
                const profile = allProfiles.find(
                  (item) => item.name === activeChat.name,
                );
                if (profile) openProfileSafety(profile);
              }}
              onUnsend={(id) => {
                hiddenChatMessages.current.add(id);
                setMessagesByContact((items) => ({
                  ...items,
                  [activeChat.name]: (items[activeChat.name] ?? []).filter(
                    (item) => item.id !== id,
                  ),
                }));
              }}
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
              media={effectiveOwnMedia}
              details={registrationData}
              registered={registered}
              theme={theme}
              availability={dailyAvailability}
              onPreview={() => {
                setToast('');
                setPreviewCard(true);
              }}
              onRegistration={() => openRegistrationAt(0, false)}
              onEditSection={openRegistrationAt}
              onTheme={() => setThemeOpen(true)}
              onSubscription={() => setSubscriptionOpen(true)}
              verificationStatus={verificationStatus}
              onVerification={() => {
                setRegistrationCameraCheck(false);
                setVerificationOpen(true);
              }}
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
            />
          )}
          {tab === 'Profile' && previewCard && (
            <ProfilePreview
              name={selfName}
              sourceProfile={signedInIdentity?.profile}
              userId={
                ownAccount?.email === authEmail
                  ? ownAccount.id
                  : (testUserIdForEmail(authEmail) ?? undefined)
              }
              todayCount={visibleDailyStories.length}
              media={effectiveOwnMedia}
              details={registrationData}
              story={ownDailyStory}
              availability={dailyAvailability}
              onBack={() => setPreviewCard(false)}
              onEdit={() => {
                setPreviewCard(false);
                openRegistrationAt(0, false);
              }}
            />
          )}
          {!(tab === 'Chat' && chatOpen) && (
            <TabBar
              active={tab}
              onChange={handleTab}
              unreadCount={unreadMessages}
              incomingLikeCount={incomingLikeCount}
            />
          )}
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
          connection={connectionState(selectedProfile ?? current)}
          busy={sendBusy}
          open={profileOpen}
          onOpenChange={closeOrUpdateFullProfile}
          onPass={
            room && selectedProfile?.id === roomCurrent?.id
              ? nextRoomProfile
              : nextProfile
          }
          onLike={() => {
            const profile = selectedProfile ?? current;
            void completeLike(profile).then((advanced) => {
              if (advanced && room && profile.id === roomCurrent?.id)
                nextRoomProfile();
            });
          }}
          onSpark={() => {
            const profile = selectedProfile ?? current;
            if (matchedProfiles.some((item) => item.name === profile.name))
              openChatWith('', profile);
            else openNote(profile);
          }}
          onBoost={() => {
            setProfileOpen(false);
            setBoostOpen(true);
          }}
          matched={matchedProfiles.some(
            (item) => item.name === (selectedProfile ?? current).name,
          )}
          onShare={() => shareProfile(selectedProfile ?? current)}
          onReport={() =>
            openProfileSafety(selectedProfile ?? current, 'report')
          }
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
          open={noteOpen}
          onOpenChange={setNoteOpen}
          target={noteTarget}
          onTarget={setNoteTarget}
          message={noteMessage}
          todayText={noteTodayText}
          onMessage={setNoteMessage}
          remaining={superPulsesRemaining}
          busy={sendBusy}
          sent={connectionState(actionProfile)}
          onSend={sendNoteAction}
          onCancel={() => setNoteOpen(false)}
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
          draftKey={authEmail ?? ''}
          initialStep={registrationStep}
          editing={registered && !registrationCameraCheck}
          singleSection={registrationSingleSection}
          media={effectiveOwnMedia}
          onAddPhoto={addProfilePhoto}
          onAddVideo={addProfileVideo}
          onMakeMainPhoto={makeMainProfilePhoto}
          onRemovePhoto={removeProfilePhoto}
        />
        <PhotoVerificationDialog
          open={verificationOpen}
          onOpenChange={(open) => {
            setVerificationOpen(open);
            if (!open) setRegistrationCameraCheck(false);
          }}
          status={verificationStatus}
          serverEnabled={serverDataEnabled}
          accountKey={authEmail ?? 'signed-out'}
          registration={registrationCameraCheck}
          onStatusChange={(next) => {
            setVerificationStatus(next);
            announce(
              next === 'photo_verified' || next === 'identity_verified'
                ? 'Your profile is Photo Verified'
                : next === 'capture_ready'
                  ? 'Face capture check complete — photo verification is still required'
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
          availableProfiles={availableProfiles}
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
          onLike={likeDailyStory}
          onSpike={spikeDailyStory}
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
          onBoost={() => {
            setSubscriptionOpen(false);
            setBoostOpen(true);
          }}
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
            handleTab('Likes');
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
        {!verificationOpen && (
          <div
            className={`toast ${toast ? 'show' : ''}`}
            role="status"
            aria-live="polite"
          >
            <BrandHeartMark size={18} />
            {toast}
          </div>
        )}
      </main>
    </LivePresenceProvider>
  );
}

function TodayComposerDialog({
  open,
  onOpenChange,
  existing,
  replacing,
  existingAvailability,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: DailyStory;
  replacing: boolean;
  existingAvailability?: DailyAvailability;
  onPublish: (
    draft: DailyStoryDraft,
    storyId?: string,
    availability?: DailyAvailability | null,
  ) => Promise<string | undefined>;
}) {
  const [caption, setCaption] = useState('');
  const [availableTonight, setAvailableTonight] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const savedDraft = !existing
      ? window.localStorage.getItem('spikedate-today-draft')
      : null;
    const parsedDraft = savedDraft
      ? (JSON.parse(savedDraft) as {
          caption?: string;
          availableTonight?: boolean;
        })
      : null;
    setCaption(existing?.caption || parsedDraft?.caption || '');
    const activeAvailability =
      existingAvailability &&
      new Date(existingAvailability.endAt).getTime() > Date.now()
        ? existingAvailability
        : undefined;
    setAvailableTonight(
      activeAvailability?.localDate === dateInputValue() ||
        parsedDraft?.availableTonight === true,
    );
    setSubmitError('');
    setSaving(false);
  }, [existing, existingAvailability, open]);

  useEffect(() => {
    if (!open || existing) return;
    window.localStorage.setItem(
      'spikedate-today-draft',
      JSON.stringify({ caption, availableTonight }),
    );
  }, [availableTonight, caption, existing, open]);

  const submitToday = async () => {
    let availability: DailyAvailability | null = null;
    if (availableTonight) {
      const now = new Date();
      availability = {
        localDate: dateInputValue(),
        ...tonightWindow(now),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      };
    }
    setSaving(true);
    const message = await onPublish(
      {
        mediaUrl: undefined,
        caption: caption.trim(),
        prompt: existing?.prompt || todayPrompts[0],
        visibility: existing?.visibility || 'discover',
        repliesEnabled: existing?.repliesEnabled ?? true,
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
      <DialogContent
        showCloseButton={false}
        className="today-composer-dialog editorial-popup"
      >
        <button
          type="button"
          className="match-close"
          aria-label="Close Today composer"
          onClick={() => onOpenChange(false)}
        >
          <X size={19} />
        </button>
        <div className="editorial-popup-heading">
          <span className="editorial-popup-icon" aria-hidden="true">
            <Sun size={20} />
          </span>
          <div>
            <p className="today-kicker">24-HOUR MOMENT</p>
            <DialogTitle>Today</DialogTitle>
          </div>
        </div>
        <DialogDescription>
          One little update can start a conversation.
        </DialogDescription>

        <label className="today-field today-simple-update">
          What are you doing today?
          <textarea
            aria-label="Today update"
            value={caption}
            maxLength={140}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Coffee after work, then a walk by the river…"
          />
          <small>{caption.length}/140</small>
        </label>
        <div className="today-tonight-toggle">
          <span>
            <strong>Available tonight</strong>
            <small>Optional · your location stays private</small>
          </span>
          <Switch
            className="today-availability-switch"
            checked={availableTonight}
            onCheckedChange={(checked) => {
              setAvailableTonight(checked);
              setSubmitError('');
            }}
            aria-label="Available tonight"
          />
        </div>
        <button
          type="button"
          className="primary-button today-publish-button editorial-popup-action"
          disabled={
            saving ||
            (!caption.trim() &&
              !availableTonight &&
              !existing &&
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
                ? 'Post new for 24 hours'
                : 'Post for today'}
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
  onSpike,
  onReply,
  onProfile,
  onEdit,
  onDelete,
}: {
  story: DailyStory | null;
  viewerEmail: string | null;
  onOpenChange: (open: boolean) => void;
  onLike: (story: DailyStory) => void;
  onSpike: (story: DailyStory) => void;
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
            <button type="button" onClick={() => onSpike(story)}>
              <SpikeIntroIcon size={20} /> Spike
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
  onFilters,
  onVoice,
  voiceEnabled,
  activeFilterCount,
}: {
  onFilters: () => void;
  onVoice: () => void;
  voiceEnabled: boolean;
  activeFilterCount: number;
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

function EmptyDiscover({
  onFilters,
  onShowAll,
  availableCount,
}: {
  onFilters: () => void;
  onShowAll: () => void;
  availableCount: number;
}) {
  return (
    <section className="empty-discover">
      <SlidersHorizontal size={30} />
      <h1>No profiles match yet</h1>
      <p>
        {availableCount
          ? `${availableCount} profiles are available before your Home filters. Try widening your preferences.`
          : 'No new profiles are available right now. Check again later.'}
      </p>
      <button className="primary-button" onClick={onFilters}>
        Adjust preferences
      </button>
      {availableCount > 0 && (
        <button className="secondary-button" onClick={onShowAll}>
          Show all available profiles
        </button>
      )}
    </section>
  );
}

function DiscoverScreen({
  profile,
  connection,
  busy,
  story,
  todayCount,
  todayActive,
  onOpen,
  onOpenStory,
  onSeeAllToday,
  onPostToday,
  onPass,
  onLike,
  onSpark,
  matched,
  onTonight,
  saved,
  onToggleSaved,
  preview = false,
}: {
  profile: Profile;
  connection?: 'like' | 'super_spike';
  busy: boolean;
  story?: DailyStory;
  todayCount: number;
  todayActive: boolean;
  onOpen: () => void;
  onOpenStory: (story: DailyStory) => void;
  onSeeAllToday: () => void;
  onPostToday: () => void;
  onPass: () => void;
  onLike: () => void;
  onSpark: () => void;
  matched: boolean;
  onTonight: () => void;
  saved: boolean;
  onToggleSaved: () => void;
  preview?: boolean;
}) {
  return (
    <section
      className="discover-screen quiet-rail-home"
      aria-label="SpikeDate profiles"
    >
      <ProfileCard
        profile={profile}
        preview={preview}
        connection={connection}
        story={story}
        onOpen={onOpen}
        onOpenStory={onOpenStory}
        onTonight={onTonight}
        onSwipeLeft={preview ? undefined : onPass}
        onSwipeRight={preview ? undefined : onPass}
        onSwipeUp={preview ? undefined : onOpen}
      />
      <div
        className="home-action-rail"
        aria-label={preview ? 'Profile action preview' : 'Profile actions'}
      >
        <button onClick={onPass} aria-label={`Pass on ${profile.name}`}>
          <X size={21} />
        </button>
        <button
          className="like"
          onClick={onLike}
          disabled={busy}
          aria-label={`Like ${profile.name}`}
        >
          <BrandHeartMark size={20} />
          <Heart
            className="gallery-like-heart"
            size={32}
            fill="currentColor"
            aria-hidden="true"
          />
        </button>
        <button
          className="spark"
          onClick={onSpark}
          aria-label={
            matched
              ? `Message ${profile.name}`
              : `Send ${profile.name} a Spike introduction`
          }
          disabled={busy}
        >
          {matched ? <MessageCircle size={20} /> : <SpikeIntroIcon size={20} />}
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
      </div>
      <div className="home-today-tools" aria-label="Today updates">
        <button
          className={`today-compose ${todayActive ? 'active' : ''}`}
          onClick={onPostToday}
          aria-label="Post or edit your Today update"
        >
          <TodayActionIcon active={todayActive} />
        </button>
        <button
          className="today-feed"
          onClick={onSeeAllToday}
          aria-label={`${todayCount} fresh Today updates. See all`}
        >
          <Sun size={20} />
          <span className="gallery-fresh-label">Fresh</span>
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
  variant = 'full',
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  variant?: 'card' | 'full';
}) {
  const [failed, setFailed] = useState(false);
  const unoptimized = src.startsWith('/') || src.startsWith('data:');
  const imageSource = failed
    ? '/profile-placeholder.svg'
    : src.startsWith('/api/media/')
    ? `${src.split('?')[0]}?variant=${variant}`
    : src;
  useEffect(() => setFailed(false), [src]);
  return (
    <div className="cinematic-photo-stack">
      <Image
        src={imageSource}
        alt={alt}
        fill
        priority={priority}
        draggable={false}
        sizes={sizes}
        quality={95}
        unoptimized={unoptimized}
        onError={() => setFailed(true)}
        className="profile-photo cinematic-photo-main"
      />
      <span className="cinematic-photo-grade" aria-hidden="true" />
    </div>
  );
}

function ProfileCard({
  profile,
  connection,
  story,
  onOpen,
  onOpenStory,
  onTonight,
  room,
  preview,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
}: {
  profile: Profile;
  connection?: 'like' | 'super_spike';
  story?: DailyStory;
  onOpen?: () => void;
  onOpenStory?: (story: DailyStory) => void;
  onTonight?: () => void;
  room?: string | null;
  preview?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
}) {
  const tonight =
    profile.tonight &&
    new Date(profile.tonight.expiresAt).getTime() > Date.now()
      ? profile.tonight
      : undefined;
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [gesturePhase, setGesturePhase] = useState<
    'idle' | 'dragging' | 'exiting'
  >('idle');
  const gesture = useRef<{
    x: number;
    y: number;
    moved: boolean;
    pointerId: number;
    lastX: number;
    lastY: number;
    lastAt: number;
    velocityX: number;
    velocityY: number;
    axis: 'horizontal' | 'vertical' | null;
  } | null>(null);
  const suppressClick = useRef(false);
  const finishGesture = (clientX: number, clientY: number) => {
    const start = gesture.current;
    if (!start) return;
    const dx = clientX - start.x;
    const dy = clientY - start.y;
    const projectedX = dx + start.velocityX * 110;
    const projectedY = dy + start.velocityY * 110;
    const isHorizontal =
      start.axis === 'horizontal' &&
      (Math.abs(dx) > 44 || Math.abs(projectedX) > 72);
    const isSwipeUp =
      start.axis === 'vertical' &&
      dy < 0 &&
      (dy < -52 || projectedY < -82) &&
      Boolean(onSwipeUp);
    gesture.current = null;
    if (start.moved) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 320);
    }
    if (isHorizontal || isSwipeUp) {
      setGesturePhase('exiting');
      setOffset(
        isSwipeUp
          ? { x: 0, y: -Math.max(window.innerHeight * 0.44, 320) }
          : {
              x:
                Math.sign(projectedX || dx) *
                Math.max(window.innerWidth * 1.18, 460),
              y: Math.max(-24, Math.min(24, dy * 0.12)),
            },
      );
      window.setTimeout(() => {
        if (isSwipeUp) onSwipeUp?.();
        else if (projectedX > 0) onSwipeRight?.();
        else onSwipeLeft?.();
        setGesturePhase('idle');
        setOffset({ x: 0, y: 0 });
      }, 190);
      return;
    }
    setGesturePhase('idle');
    setOffset({ x: 0, y: 0 });
  };
  return (
    <div
      className={`profile-card gesture-${gesturePhase} ${offset.x > 18 ? 'swiping-right' : offset.x < -18 ? 'swiping-left' : offset.y < -18 ? 'swiping-up' : ''}`}
      role="presentation"
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${offset.x / 28}deg)`,
      }}
      onClick={() => {
        if (!suppressClick.current) onOpen?.();
      }}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(e) => {
        if (
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
          lastX: e.clientX,
          lastY: e.clientY,
          lastAt: performance.now(),
          velocityX: 0,
          velocityY: 0,
          axis: null,
        };
        setGesturePhase('dragging');
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const start = gesture.current;
        if (!start || start.pointerId !== e.pointerId) return;
        const samples = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
        const sample = samples[samples.length - 1];
        const clientX = sample.clientX;
        const clientY = sample.clientY;
        const now = performance.now();
        const elapsed = Math.max(1, now - start.lastAt);
        const instantVelocityX = (clientX - start.lastX) / elapsed;
        const instantVelocityY = (clientY - start.lastY) / elapsed;
        start.velocityX = start.velocityX * 0.55 + instantVelocityX * 0.45;
        start.velocityY = start.velocityY * 0.55 + instantVelocityY * 0.45;
        start.lastX = clientX;
        start.lastY = clientY;
        start.lastAt = now;
        const dx = clientX - start.x;
        const dy = clientY - start.y;
        if (!start.axis && Math.hypot(dx, dy) > 5) {
          start.axis = Math.abs(dx) >= Math.abs(dy)
            ? 'horizontal'
            : 'vertical';
        }
        if (start.axis === 'horizontal') {
          e.preventDefault();
          start.moved = true;
          setOffset({ x: dx, y: Math.max(-10, Math.min(10, dy * 0.08)) });
        } else if (
          start.axis === 'vertical' &&
          dy < 0 &&
          onSwipeUp
        ) {
          e.preventDefault();
          start.moved = true;
          setOffset({ x: dx * 0.06, y: dy * 0.72 });
        }
      }}
      onPointerUp={(e) => {
        finishGesture(e.clientX, e.clientY);
      }}
      onPointerCancel={() => {
        gesture.current = null;
        setGesturePhase('idle');
        setOffset({ x: 0, y: 0 });
      }}
    >
      <CinematicPortrait
        src={profile.image}
        alt={`${profile.name}'s profile`}
        priority
        variant="card"
        sizes="(max-width: 480px) 100vw, 390px"
      />
      <span className="swipe-label pass-label">NEXT</span>
      <span className="swipe-label like-label">NEXT</span>
      <div className="photo-scrim" />
      <span className="profile-photo-brand" aria-hidden="true">
        <BrandHeartMark size={18} />
      </span>
      <button
        type="button"
        className="profile-card-open"
        aria-label={
          preview
            ? 'Open your full profile preview'
            : `Open ${profile.name}'s full profile`
        }
      />
      <div className={`card-content ${story || tonight ? 'has-today' : ''}`}>
        {room && <p className="room-caption">You’re both in {room}</p>}
        {!preview && (
          <p className="tap-hint">Tap the photo for the full profile</p>
        )}
        <PresenceStatus
          name={profile.name}
          userId={profile.id}
          lastActiveAt={profile.lastActiveAt}
          demoActive={!serverDataEnabled && profile.active}
        />
        <div className="name-row">
          <h1>
            {profile.name}, {profile.age}
          </h1>
          {connection && (
            <small className="connection-sent-state">
              {connection === 'super_spike' ? 'Spike sent' : 'Liked'}
            </small>
          )}
          {profile.verified === true && (
            <BadgeCheck
              size={22}
              fill="#FF4D6D"
              color="#0E0E10"
              aria-label="Photo Verified"
            />
          )}
        </div>
        <p className="distance">
          <MapPin size={13} className="home-detail-icon" aria-hidden="true" />
          {profile.place} · {profile.distance}
        </p>
        <div className="chips">
          <span>
            <Heart size={13} className="home-detail-icon" aria-hidden="true" />
            {profile.intent}
          </span>
          {profile.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <p className="card-story">{profile.prompt}</p>
        {(story || tonight) && (
          <div
            className="today-card-combined"
            aria-label={`${profile.name}'s Today`}
          >
            {story &&
              (preview ? (
                <div className="today-card-pill" aria-label="Your Today post">
                  <span className="today-card-icon" aria-hidden="true">
                    <Sun size={14} />
                  </span>
                  <span>
                    <small>TODAY</small>
                    <strong>{story.caption}</strong>
                  </span>
                </div>
              ) : (
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
              ))}
            {tonight &&
              (preview ? (
                <div
                  className="tonight-card-status"
                  aria-label="Your tonight availability"
                >
                  <Moon size={14} fill="currentColor" aria-hidden="true" />
                  <span>
                    <strong>Available tonight</strong>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className="tonight-card-status"
                  aria-label={`${profile.name} is available tonight. Send a Spike`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onTonight?.();
                  }}
                >
                  <Moon size={14} fill="currentColor" aria-hidden="true" />
                  <span>
                    <strong>Available tonight</strong>
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionRow({
  onPass,
  onLike,
  onSpark,
  saved,
  onToggleSaved,
  matched = false,
  busy = false,
}: {
  onPass: () => void;
  onLike: () => void;
  onSpark?: () => void;
  saved?: boolean;
  onToggleSaved?: () => void;
  matched?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="action-row" aria-label="Profile actions">
      <button className="action-button pass" aria-label="Pass" onClick={onPass}>
        <X size={27} />
      </button>
      <button
        className="action-button like"
        aria-label="Like"
        onClick={onLike}
        disabled={busy}
      >
        <BrandHeartMark size={29} />
      </button>
      {onSpark && (
        <button
          className="action-button spark-action"
          aria-label={matched ? 'Message match' : 'Send a Spike introduction'}
          title={matched ? 'Message' : 'Spike'}
          onClick={onSpark}
          disabled={busy}
        >
          {matched ? <MessageCircle size={25} /> : <SpikeIntroIcon size={25} />}
        </button>
      )}
      {onToggleSaved && (
        <button
          className={`action-button save-action ${saved ? 'saved' : ''}`}
          aria-label={saved ? 'Remove from Saved' : 'Save privately'}
          aria-pressed={saved}
          onClick={onToggleSaved}
        >
          <Bookmark size={24} fill={saved ? 'currentColor' : 'none'} />
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
  preview = false,
}: {
  nudge:
    | { kind: 'today' }
    | { kind: 'boost' }
    | { kind: 'like' }
    | { kind: 'super'; profile: Pick<Profile, 'name'> };
  membership: Membership;
  boostsRemaining: number;
  dailyLikesRemaining: number;
  superPulsesRemaining: number;
  profileCount: number;
  onDismiss: () => void;
  onAction: () => void;
  preview?: boolean;
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
          action: 'Post Today',
        }
      : nudge.kind === 'boost'
        ? {
            icon: ProfileLiftMark,
            tone: 'boost',
            eyebrow: 'PROFILE LIFT',
            title: 'Be seen a little sooner',
            copy: 'Your profile is ready. Profile Lift shows it sooner to compatible people for 30 minutes.',
            meta: `${boostsRemaining} Profile ${boostsRemaining === 1 ? 'Lift' : 'Lifts'} available`,
            action: 'See Profile Lift',
          }
        : nudge.kind === 'like'
          ? {
              icon: Compass,
              tone: 'like',
              eyebrow: 'FRESH PEOPLE',
              title: `${profileCount || 1} new ${profileCount === 1 ? 'person' : 'people'} in Galaxy`,
              copy: 'Take a look when you have a minute. A thoughtful Like goes further.',
              meta:
                membership === 'plus'
                  ? 'Unlimited Likes'
                  : `${dailyLikesRemaining} Likes left today`,
              action: 'Show profiles',
            }
          : {
              icon: SpikeIntroIcon,
              tone: 'super',
              eyebrow: 'HIGH-INTENT MOMENT',
              title: `${nudge.profile.name} stands out`,
              copy: 'A personal Spike puts your intro at the top of their Likes.',
              meta: `${superPulsesRemaining} Spike${superPulsesRemaining === 1 ? '' : 's'} left this week`,
              action: 'Write an intro',
            };
  const Icon = content.icon;

  return (
    <section
      className={`engagement-prompt ${content.tone}${preview ? ' reminder-preview-card' : ''}`}
      role={preview ? 'group' : 'dialog'}
      aria-modal={preview ? undefined : false}
      aria-label={content.title}
    >
      <div className="engagement-prompt-heading">
        <span className="engagement-prompt-icon" aria-hidden="true">
          <Icon
            size={nudge.kind === 'super' ? 27 : 21}
            fill={nudge.kind === 'like' ? 'currentColor' : 'none'}
          />
        </span>
        <span>
          <small>{content.eyebrow}</small>
          <strong>{content.title}</strong>
        </span>
        {preview ? (
          <span className="engagement-prompt-close" aria-hidden="true">
            <X size={18} />
          </span>
        ) : (
          <button
            className="engagement-prompt-close"
            onClick={onDismiss}
            aria-label={`Dismiss ${content.title}`}
          >
            <X size={18} />
          </button>
        )}
      </div>
      <p className="engagement-prompt-copy">{content.copy}</p>
      <p className="engagement-prompt-meta">
        {nudge.kind === 'super' && (
          <Star size={13} fill="currentColor" aria-hidden="true" />
        )}
        {content.meta}
      </p>
      <div className="engagement-prompt-actions">
        <button className="primary" onClick={onAction} disabled={preview}>
          {nudge.kind === 'super' && <SpikeIntroIcon size={17} />}
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
  incomingLikeCount,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  unreadCount: number;
  incomingLikeCount: number;
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
              label === 'Likes' && incomingLikeCount
                ? `Likes, ${incomingLikeCount} new ${incomingLikeCount === 1 ? 'like' : 'likes'}`
                : label === 'Chat' && unreadCount
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
              {label === 'Likes' && incomingLikeCount > 0 && (
                <b className="tab-badge likes" aria-hidden="true">
                  {incomingLikeCount > 9 ? '9+' : incomingLikeCount}
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
  profile: initialProfile,
  connection,
  busy = false,
  open,
  onOpenChange,
  onPass,
  onLike,
  onSpark,
  onBoost,
  matched,
  onShare,
  onReport,
  onBlock,
  saved,
  onToggleSaved,
  todayActive,
  onPostToday,
  readOnly = false,
  detailsOverride,
  story,
}: {
  profile: Profile;
  connection?: 'like' | 'super_spike';
  busy?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPass: () => void;
  onLike: () => void;
  onSpark: () => void;
  onBoost: () => void;
  matched: boolean;
  onShare: () => void;
  onReport: () => void;
  onBlock: () => void;
  saved: boolean;
  onToggleSaved: () => void;
  todayActive: boolean;
  onPostToday: () => void;
  readOnly?: boolean;
  detailsOverride?: RegistrationData;
  story?: DailyStory;
}) {
  const [publicProfile, setPublicProfile] = useState<Partial<Profile> | null>(
    null,
  );
  const profile = {
    ...initialProfile,
    ...(publicProfile?.id === initialProfile.id ? publicProfile : {}),
  };
  const richDetails =
    detailsOverride ??
    (profile.facts ? undefined : identityForProfile(profile)?.registration);
  const savedFacts = profile.facts;
  const [publicConnection, setPublicConnection] =
    useState<ProfileConnection | null>(null);
  useEffect(() => {
    setPublicConnection(null);
    setPublicProfile(null);
    if (!open || !profile.id || detailsOverride || !serverDataEnabled) return;
    let cancelled = false;
    void serverJson<{
      connection: ProfileConnection;
      profile?: Partial<Profile>;
    }>(`/api/profiles/${encodeURIComponent(profile.id)}/connection`)
      .then((data) => {
        if (!cancelled) {
          setPublicConnection(data.connection);
          setPublicProfile(data.profile || null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, profile.id, detailsOverride]);
  const connectionDetails = detailsOverride
    ? connectionForRegistration(detailsOverride)
    : publicConnection || profile.matchDetails || emptyConnection;
  const profileFacts = [
    {
      label: 'Looking for',
      value: richDetails?.intents.join(' · ') || profile.intent,
      Icon: Heart,
    },
    {
      label: 'Height',
      value: richDetails
        ? richDetails.height
        : (savedFacts?.height ?? profile.height),
      Icon: Ruler,
    },
    {
      label: 'Open to kids',
      value: richDetails
        ? richDetails.wantsKids
        : (savedFacts?.wantsKids ?? profile.wantsKids),
      Icon: Sprout,
    },
    {
      label: 'Work',
      value: richDetails ? richDetails.occupation : savedFacts?.occupation,
      Icon: BriefcaseBusiness,
    },
    {
      label: 'Gender',
      value: richDetails?.gender || profile.gender,
      Icon: UserRound,
    },
    {
      label: 'Have kids',
      value: richDetails
        ? richDetails.kids
        : (savedFacts?.kids ?? profile.kids),
      Icon: UsersRound,
    },
    {
      label: 'Smoking',
      value: richDetails
        ? richDetails.smoking
        : (savedFacts?.smoking ?? profile.smoking),
      Icon: Cigarette,
    },
    {
      label: 'Drinking',
      value: richDetails
        ? richDetails.drinking
        : (savedFacts?.drinking ?? profile.drinking),
      Icon: Wine,
    },
    { label: 'Workout', value: richDetails?.exercise, Icon: Dumbbell },
    { label: 'Religion', value: richDetails?.religion, Icon: HandHeart },
    {
      label: 'Education',
      value: richDetails?.education || savedFacts?.education,
      Icon: GraduationCap,
    },
  ];
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
        className={`profile-sheet ${readOnly ? 'profile-preview-sheet' : ''}`}
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
            {!readOnly && (
              <div className="profile-film-tools">
                <button
                  className={`profile-utility profile-today ${todayActive ? 'active' : ''}`}
                  onClick={onPostToday}
                  aria-label="Post or edit your Today update"
                >
                  <TodayActionIcon active={todayActive} />
                </button>
                <button
                  className="profile-utility profile-boost"
                  onClick={onBoost}
                  aria-label="Lift my profile"
                >
                  <ProfileLiftMark size={20} />
                </button>
                <button
                  className="profile-utility profile-share"
                  onClick={onShare}
                  aria-label={`Share ${profile.name}'s profile with friends or family`}
                >
                  <Share2 size={20} />
                </button>
              </div>
            )}
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
                  sizes="(max-width: 430px) 100vw, 430px"
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
            <span className="profile-photo-brand profile-photo-brand-film" aria-hidden="true">
              <BrandHeartMark size={16} />
            </span>
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
                <span className="media-hint">Tap photo edges to browse</span>
              </>
            )}
            <div className="profile-title">
              <PresenceStatus
                name={profile.name}
                userId={profile.id}
                lastActiveAt={profile.lastActiveAt}
                demoActive={!serverDataEnabled && profile.active}
              />
              <div className="profile-title-line">
                <div className="name-row">
                  <h2>
                    {profile.name}, {profile.age}
                  </h2>
                  {connection && (
                    <small className="connection-sent-state">
                      {connection === 'super_spike' ? 'Spike sent' : 'Liked'}
                    </small>
                  )}
                  {profile.verified === true && (
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
          {photos.length > 1 && (
            <div
              className="profile-photo-strip"
              aria-label="Profile photo gallery"
            >
              {photos.map((photo, index) => (
                <button
                  key={photo.id ?? photo.src}
                  type="button"
                  aria-label={`View profile photo ${index + 1}`}
                  aria-pressed={mediaIndex === index}
                  onClick={() => setMediaIndex(index)}
                >
                  <Image
                    src={photo.src}
                    alt={`Profile photo ${index + 1}`}
                    fill
                    sizes="100px"
                    unoptimized
                  />
                </button>
              ))}
            </div>
          )}
          <div className="profile-details full-profile-passport">
            {readOnly && (story || profile.tonight) && (
              <section
                className="full-preview-today"
                aria-label="Your Today and availability"
              >
                {story && (
                  <>
                    <span className="section-label">
                      <CalendarCheck size={17} aria-hidden="true" /> Today
                    </span>
                    <p>{story.caption}</p>
                  </>
                )}
                {profile.tonight && (
                  <p>
                    <Moon size={14} aria-hidden="true" /> Available tonight
                  </p>
                )}
              </section>
            )}
            <section className="atelier-intention">
              <span className="section-label">
                <Heart size={17} aria-hidden="true" /> Looking for
              </span>
              <p>{profileFacts[0].value || 'Not shared'}</p>
            </section>
            {[
              {
                title: 'The essentials',
                Icon: UserRound,
                labels: ['Gender', 'Height', 'Work', 'Education'],
              },
              {
                title: 'Family & future',
                Icon: Baby,
                labels: ['Have kids', 'Open to kids'],
              },
              {
                title: 'Everyday life',
                Icon: Leaf,
                labels: ['Smoking', 'Drinking', 'Workout', 'Religion'],
              },
            ].map(({ title, Icon: CategoryIcon, labels }) => (
              <section
                key={title}
                className="atelier-fact-group"
                aria-label={title}
              >
                <span className="section-label">
                  <CategoryIcon size={17} aria-hidden="true" /> {title}
                </span>
                <div
                  className="full-passport-facts"
                  aria-label={`${profile.name}'s ${title.toLowerCase()}`}
                >
                  {labels
                    .map((label) =>
                      profileFacts.find((fact) => fact.label === label)!,
                    )
                    .map(({ label, value, Icon }) => (
                      <div key={label}>
                        <Icon size={19} strokeWidth={1.5} aria-hidden="true" />
                        <span>
                          <small>{label}</small>
                          <strong>{value?.trim() || 'Not shared'}</strong>
                        </span>
                      </div>
                    ))}
                </div>
              </section>
            ))}
            <section className="passport-story">
              <span className="section-label">
                <NotebookPen size={17} aria-hidden="true" /> A little about me
              </span>
              <p>{richDetails?.bio || profile.prompt}</p>
            </section>
            <ProfileConnectionSummary value={connectionDetails} />
            {detailsOverride?.promptOneQuestion || profile.prompts?.length ? (
              (detailsOverride
                ? [
                    {
                      prompt:
                        detailsOverride.promptOneQuestion || 'My ideal Sunday…',
                      answer: detailsOverride.promptOne,
                    },
                    {
                      prompt:
                        detailsOverride.promptTwoQuestion ||
                        'The quickest way to my heart…',
                      answer: detailsOverride.promptTwo,
                    },
                  ]
                : profile.prompts || []
              )
                .filter((item) => item.answer.trim())
                .map((item) => (
                  <section key={item.prompt}>
                    <span className="section-label">
                      <NotebookPen size={17} aria-hidden="true" /> {item.prompt}
                    </span>
                    <p>{item.answer}</p>
                  </section>
                ))
            ) : (
              <>
                <section>
                  <span className="section-label">
                    <Sun size={17} aria-hidden="true" /> A perfect ordinary
                    Sunday
                  </span>
                  <p>
                    {detailsOverride
                      ? detailsOverride.promptTwo
                      : profile.name === 'Maya'
                        ? 'Cold brew, a long walk with no route, then making dinner with a record on.'
                        : profile.prompt}
                  </p>
                </section>
                <section>
                  <span className="section-label">
                    <Heart size={17} aria-hidden="true" />
                    The quickest way to my heart
                  </span>
                  <p>{profile.prompt}</p>
                </section>
              </>
            )}
            <section>
              <span className="section-label">
                <HandHeart size={17} aria-hidden="true" /> Values & identity
              </span>
              <div className="detail-chips">
                <span>{profile.ethnicity}</span>
                <span>{profile.pets}</span>
                {richDetails?.education && <span>{richDetails.education}</span>}
                {richDetails?.politics && <span>{richDetails.politics}</span>}
                {richDetails?.zodiac && <span>{richDetails.zodiac}</span>}
                {richDetails?.orientation && (
                  <span>{richDetails.orientation}</span>
                )}
                {richDetails?.relationshipStyle && (
                  <span>{richDetails.relationshipStyle}</span>
                )}
                {richDetails?.diet && <span>{richDetails.diet}</span>}
                {richDetails?.languages.map((language) => (
                  <span key={language}>{language}</span>
                ))}
              </div>
            </section>
            <section>
              <span className="section-label">
                <WandSparkles size={17} aria-hidden="true" /> What I’m into
              </span>
              <div className="detail-chips coral">
                {profile.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
                {richDetails?.values.map((value) => (
                  <span key={value}>{value}</span>
                ))}
              </div>
            </section>
            {!readOnly && (
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
            )}
          </div>
        </div>
        {!readOnly && (
          <div className="sheet-actions">
            <ActionRow
              onPass={onPass}
              busy={busy}
              onLike={onLike}
              onSpark={onSpark}
              matched={matched}
              saved={saved}
              onToggleSaved={onToggleSaved}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function NoteDialog({
  profile,
  open,
  onOpenChange,
  target,
  onTarget,
  message,
  onMessage,
  todayText,
  remaining,
  busy,
  sent,
  onSend,
  onCancel,
}: {
  profile: Profile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: NoteTarget;
  onTarget: (target: NoteTarget) => void;
  message: string;
  onMessage: (message: string) => void;
  todayText: string;
  remaining: number;
  busy: boolean;
  sent?: 'like' | 'super_spike';
  onSend: () => void;
  onCancel: () => void;
}) {
  const isToday = target.startsWith('Today');
  const promptText =
    profile.prompts?.[0]?.answer?.trim() || profile.prompt?.trim() || '';
  const interest = profile.tags[0]?.trim() || '';
  const targets = [
    ...(isToday ? [{ value: target, label: 'Today', Icon: Sun }] : []),
    { value: 'Photo 1', label: 'Photo', Icon: Camera },
    ...(promptText
      ? [{ value: 'Prompt', label: 'Prompt', Icon: NotebookPen }]
      : []),
    ...(interest
      ? [
          {
            value: `Interest · ${interest.slice(0, 80)}`,
            label: 'Interest',
            Icon: Heart,
          },
        ]
      : []),
  ];
  const noteContext = isToday
    ? 'today'
    : target === 'Photo 1'
      ? 'photo'
      : target.startsWith('Interest ·')
        ? 'interest'
        : 'prompt';
  const contextText =
    noteContext === 'today'
      ? todayText || `${profile.name}’s Today update`
      : noteContext === 'photo'
        ? `${profile.name}’s main profile photo`
        : noteContext === 'interest'
          ? interest
          : promptText;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="note-dialog note-sheet spark-note spike-focused-sheet"
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
            <SpikeIntroIcon className="note-sheet-spark" size={24} />
          </span>
          <span className="note-sheet-heading">
            <SheetTitle>{`Spike ${profile.name}`}</SheetTitle>
            <SheetDescription>An introduction that stands out</SheetDescription>
          </span>
          <button
            type="button"
            className="note-sheet-close"
            onClick={onCancel}
            aria-label="Close Spike"
          >
            <X size={20} />
          </button>
        </div>
        <div className="spike-recipient">
          <span className="spike-recipient-photo">
            <Image
              src={profile.image}
              alt=""
              fill
              sizes="52px"
              className="profile-photo"
            />
          </span>
          <span>
            <strong>
              {profile.name}, {profile.age}
            </strong>
            <small>
              {remaining} Spike{remaining === 1 ? '' : 's'} left this week
            </small>
          </span>
        </div>
        <div
          className="spike-context-options"
          aria-label="Choose what to mention"
        >
          {targets.map((item) => (
            <button
              type="button"
              key={item.value}
              className={target === item.value ? 'active' : ''}
              aria-pressed={target === item.value}
              onClick={() => onTarget(item.value)}
            >
              <item.Icon size={16} aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
        <div className="spike-context-quote" aria-live="polite">
          <small>
            {noteContext === 'today'
              ? 'TODAY'
              : noteContext === 'photo'
                ? 'THEIR PHOTO'
                : noteContext === 'interest'
                  ? 'SHARED INTEREST'
                  : 'THEIR PROMPT'}
          </small>
          <p>{contextText}</p>
        </div>
        <label className="connect-message">
          <span className="note-input-label">
            <strong>Your message</strong>
            <span>Optional</span>
          </span>
          <textarea
            aria-label="Profile note"
            maxLength={140}
            value={message}
            onChange={(event) => onMessage(event.target.value)}
            placeholder={`Write a thoughtful opener to ${profile.name}…`}
          />
          <small className="note-character-count">{message.length}/140</small>
        </label>
        <div className="note-dialog-actions">
          <button
            className="primary-button"
            onClick={onSend}
            disabled={busy || sent === 'super_spike'}
          >
            <SpikeIntroIcon size={20} />
            {busy
              ? 'Sending…'
              : sent === 'super_spike'
                ? 'Spike already sent'
                : sent === 'like'
                  ? 'Upgrade to Spike · uses 1 Spike'
                  : 'Send Spike'}
          </button>
          <p className="spike-delivery-note">
            Uses 1 Spike · delivered at the top of Likes
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RoomsHub({
  astrology,
  onGames,
  onOpenRoom,
  roomCounts,
  roomPreviewImages,
  roomsLoading,
  roomsError,
  onRefreshRooms,
  matchedContacts,
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
  astrology: React.ReactNode;
  onGames: () => void;
  onOpenRoom: (name: GalaxyRoomName) => void;
  roomCounts: Record<GalaxyRoomName, number>;
  roomPreviewImages: Record<GalaxyRoomName, string | undefined>;
  roomsLoading: boolean;
  roomsError: boolean;
  onRefreshRooms: () => void;
  matchedContacts: ChatContact[];
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
  const [exploreSection, setExploreSection] = useState<
    'browse' | 'plans' | 'connect'
  >('browse');
  const roomIcons: Record<string, typeof Moon> = {
    Tonight: Moon,
    Music: Music2,
    Outdoors: Footprints,
    'Food lovers': Utensils,
    'New in town': MapPin,
    'Coffee dates': Coffee,
    'Pet people': PawPrint,
    'Arts & culture': Palette,
  };
  const [selectedPlan, setSelectedPlan] = useState(galaxyPlans[0]);
  const [suggestingPlanId, setSuggestingPlanId] = useState<number | null>(null);
  const [alternateDay, setAlternateDay] = useState(() => {
    const value = new Date();
    value.setDate(value.getDate() + 2);
    return value.toISOString().slice(0, 10);
  });
  const [alternateTime, setAlternateTime] = useState('19:00');
  const planProfiles = matchedContacts.slice(0, 3);
  return (
    <section className="screen scroll-screen galaxy-hub explore-hub">
      <header className="page-header galaxy-page-header">
        <h1>Galaxy</h1>
      </header>
      <div className="explore-tabs" role="tablist" aria-label="Galaxy sections">
        {(
          [
            ['browse', 'Browse', Orbit],
            ['plans', 'Plans', CalendarDays],
            ['connect', 'Connect', HandHeart],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            type="button"
            role="tab"
            key={value}
            id={`explore-tab-${value}`}
            aria-controls={`explore-panel-${value}`}
            aria-selected={exploreSection === value}
            onClick={() => setExploreSection(value)}
            onKeyDown={(event) => {
              if (
                !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
              )
                return;
              event.preventDefault();
              const sections = ['browse', 'plans', 'connect'] as const;
              const index = sections.indexOf(value);
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? 2
                    : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
              setExploreSection(sections[next]);
              document.getElementById(`explore-tab-${sections[next]}`)?.focus();
            }}
          >
            <Icon size={17} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="explore-panel-connect"
        aria-labelledby="explore-tab-connect"
        hidden={exploreSection !== 'connect'}
      >
        {astrology}
        <button
          className="explore-games-shortcut"
          type="button"
          onClick={onGames}
        >
          <Gamepad2 size={24} aria-hidden="true" />
          <span>
            <strong>Play Together</strong>
            <small>Choose a match in Chat to start a game</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <div
        role="tabpanel"
        id="explore-panel-plans"
        aria-labelledby="explore-tab-plans"
        hidden={exploreSection !== 'plans'}
      >
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
                    <span key={profile.userId ?? profile.name}>
                      <Image
                        src={profile.image}
                        alt=""
                        width={42}
                        height={42}
                      />
                      <ProfileSpikeBadge compact />
                    </span>
                  ))}
                </div>
                <span className="galaxy-fit-badge">Your matches</span>
              </div>
              <div className="galaxy-plan-copy" aria-live="polite">
                <h3>
                  {matchedContacts.length === 0
                    ? 'Match with someone to make a plan'
                    : `Invite a match to ${selectedPlan.name.toLowerCase()}`}
                </h3>
                <p>
                  {matchedContacts.length === 0
                    ? 'When you both connect, choose a venue and time together.'
                    : `Choose from ${matchedContacts.length} ${matchedContacts.length === 1 ? 'match' : 'matches'}, then pick a venue and time.`}
                </p>
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
                      ? plan.creatorEmail && plan.creatorEmail !== viewerEmail
                        ? `Invitation from ${plan.invitees.join(', ')}`
                        : `Invite sent to ${plan.invitees.join(', ')}`
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
                    <div
                      className="plan-venue-vote"
                      aria-label="Vote on a venue"
                    >
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
                        onChange={(event) =>
                          setAlternateDay(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      New time
                      <input
                        aria-label="Alternate plan time"
                        type="time"
                        value={alternateTime}
                        onChange={(event) =>
                          setAlternateTime(event.target.value)
                        }
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
                      {(!plan.creatorEmail ||
                        plan.creatorEmail === viewerEmail) && (
                        <button
                          type="button"
                          className="cancel"
                          onClick={() => onCancelPlan(plan)}
                          aria-label={`Cancel ${plan.planName}`}
                        >
                          <X size={15} /> Cancel
                        </button>
                      )}
                    </div>
                  )}
              </article>
            ))}
          </section>
        )}
      </div>
      <div
        role="tabpanel"
        id="explore-panel-browse"
        aria-labelledby="explore-tab-browse"
        hidden={exploreSection !== 'browse'}
      >
        <div className="galaxy-browse-heading">
          <div>
            <h2>Find your kind of connection</h2>
          </div>
          <span>{roomData.length} spaces</span>
        </div>
        {roomsError && (
          <button
            type="button"
            className="galaxy-retry"
            onClick={onRefreshRooms}
          >
            Could not refresh profiles · Try again
          </button>
        )}
        <div className="room-grid">
          {roomData.map((item) => {
            const Icon = roomIcons[item.name] ?? Orbit;
            return (
              <button
                key={item.name}
                className={`room-tile ${item.className ?? ''}`}
                onClick={() => onOpenRoom(item.name as GalaxyRoomName)}
              >
                {roomPreviewImages[item.name as GalaxyRoomName] ? (
                  <Image
                    src={roomPreviewImages[item.name as GalaxyRoomName]!}
                    alt=""
                    fill
                    sizes="390px"
                    className="profile-photo"
                  />
                ) : (
                  <span className="room-empty-art" aria-hidden="true" />
                )}
                <span className="room-shade" />
                <span className="room-copy">
                  <strong>
                    <Icon size={17} aria-hidden="true" />
                    {item.name}
                  </strong>
                  <small>{item.caption}</small>
                  <em>
                    {roomsError
                      ? 'Unavailable'
                      : roomsLoading
                        ? 'Checking…'
                        : `${roomCounts[item.name as GalaxyRoomName]} ${roomCounts[item.name as GalaxyRoomName] === 1 ? 'person' : 'people'} in your feed`}
                  </em>
                </span>
              </button>
            );
          })}
        </div>
        <p className="stand-note">
          <Radio size={16} fill="currentColor" /> Spaces reflect shared
          interests. You may appear in more than one.
        </p>
      </div>
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
  count,
  loading,
  error,
  onBack,
  onRetry,
  onStartOver,
  onOpen,
  onPass,
  onLike,
  onSpark,
}: {
  room: GalaxyRoomName;
  profile?: Profile;
  count: number;
  loading: boolean;
  error: boolean;
  onBack: () => void;
  onRetry: () => void;
  onStartOver: () => void;
  onOpen: () => void;
  onPass: () => void;
  onLike: () => void;
  onSpark: () => void;
}) {
  const photoFirst = Boolean(profile) && !loading && !error;
  return (
    <section className={`room-stack${photoFirst ? ' photo-first-room' : ''}`}>
      <header className="room-header">
        <button onClick={onBack} aria-label="Back to Galaxy">
          <ArrowLeft size={22} />
        </button>
        <div>
          <strong>{room}</strong>
          <span>
            {loading
              ? 'Checking…'
              : `${count} ${count === 1 ? 'person' : 'people'} in your feed`}
          </span>
        </div>
        <span aria-hidden="true" />
      </header>
      {!photoFirst && (
        <div className="context-chip">
          {room === 'Tonight'
            ? 'Available in the next 12 hours'
            : `Into ${room.toLowerCase()}`}
        </div>
      )}
      {profile && !loading && !error ? (
        <>
          <div className="room-card-wrap">
            <ProfileCard
              profile={profile}
              room={room}
              onOpen={onOpen}
              onSwipeLeft={onPass}
              onSwipeRight={onPass}
            />
          </div>
          <div className="room-action-wrap">
            <ActionRow onPass={onPass} onLike={onLike} onSpark={onSpark} />
          </div>
        </>
      ) : (
        <div className="room-empty" role="status">
          <Orbit size={34} aria-hidden="true" />
          <h2>
            {error
              ? 'Could not load this space'
              : loading
                ? 'Finding your people'
                : count
                  ? 'You’ve seen everyone here'
                  : 'No one in this space yet'}
          </h2>
          <p>
            {error
              ? 'Check your connection and try again.'
              : count
                ? 'You can revisit this space or explore another.'
                : 'Try another space, or check back when more people join.'}
          </p>
          {error ? (
            <button type="button" onClick={onRetry}>
              Try again
            </button>
          ) : count && !loading ? (
            <button type="button" onClick={onStartOver}>
              Start over
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

function LikesScreen({
  sentLikes,
  incomingRows,
  matchedProfiles,
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
  sentLikes: { profile: Profile; status: ProfileInteraction['status'] }[];
  incomingRows?: IncomingRow[];
  matchedProfiles: Profile[];
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
  const [view, setView] = useState<'incoming' | 'sent' | 'matches'>('incoming');
  const [incomingFilter, setIncomingFilter] = useState<
    'all' | 'super' | 'notes'
  >('all');
  const [query, setQuery] = useState('');
  const matchesQuery = (profile: Profile) =>
    profile.name.toLowerCase().includes(query.trim().toLowerCase());
  const demoRows: IncomingRow[] = [
    {
      profile: priyaProfile,
      liked: 'Sent you a Spike · Lifestyle',
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
  const visibleRows = (
    membership === 'plus' ? filteredRows : filteredRows.slice(0, 2)
  ).filter((row) => matchesQuery(row.profile));
  return (
    <section className="screen scroll-screen likes-screen">
      <header className="page-header likes-page-header">
        <p className="eyebrow">YOUR CONNECTIONS</p>
        <h1>Likes</h1>
        <p>Accept a Like to match. Messages unlock after you both connect.</p>
      </header>
      <label className="connections-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a connection"
          aria-label="Search likes"
        />
      </label>
      <div className="likes-tabs" role="tablist">
        <button
          className={view === 'incoming' ? 'active' : ''}
          onClick={() => setView('incoming')}
          role="tab"
          aria-selected={view === 'incoming'}
        >
          <Heart size={15} aria-hidden="true" /> Liked you{' '}
          <span>{availableRows.length}</span>
        </button>
        <button
          className={view === 'sent' ? 'active' : ''}
          onClick={() => setView('sent')}
          role="tab"
          aria-selected={view === 'sent'}
        >
          <Send size={15} aria-hidden="true" /> You liked{' '}
          <span>{sentLikes.length}</span>
        </button>
        <button
          className={view === 'matches' ? 'active' : ''}
          onClick={() => setView('matches')}
          role="tab"
          aria-selected={view === 'matches'}
        >
          <HandHeart size={15} aria-hidden="true" /> Matches{' '}
          <span>{matchedProfiles.length}</span>
        </button>
      </div>
      {view === 'matches' ? (
        <div className="sent-likes matches-list">
          {matchedProfiles.filter(matchesQuery).length ? (
            matchedProfiles.filter(matchesQuery).map((profile) => (
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
                  <small>Matched · ready to message</small>
                </span>
                <button
                  className="sent-message-button"
                  onClick={() => onMessage(profile)}
                  aria-label={`Message ${profile.name}`}
                >
                  <MessageCircle size={16} aria-hidden="true" /> Message
                </button>
              </div>
            ))
          ) : (
            <p className="empty-likes">
              {query
                ? 'No matches found. Try another name.'
                : 'Your mutual matches will appear here.'}
            </p>
          )}
          <p className="likes-note">
            <MessageCircle size={16} /> A mutual Like unlocks private chat.
          </p>
        </div>
      ) : view === 'incoming' ? (
        <div className="incoming-list">
          <p className="list-label">
            <BrandHeartMark size={15} /> RECENT LIKES
          </p>
          <div className="incoming-filters" aria-label="Filter incoming likes">
            {(['all', 'super', 'notes'] as const).map((filter) => (
              <button
                type="button"
                key={filter}
                className={incomingFilter === filter ? 'active' : ''}
                aria-pressed={incomingFilter === filter}
                onClick={() => setIncomingFilter(filter)}
              >
                {filter === 'super' ? (
                  <SpikeIntroIcon size={15} />
                ) : filter === 'notes' ? (
                  <MessageCircle size={15} aria-hidden="true" />
                ) : (
                  <Heart size={15} aria-hidden="true" />
                )}
                {filter === 'all'
                  ? 'All'
                  : filter === 'super'
                    ? 'Spikes'
                    : 'With notes'}
              </button>
            ))}
          </div>
          {visibleRows.map((row, index) => (
            <div className="incoming-row" key={`${row.profile.name}-${index}`}>
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
                    <span aria-label="Spike">
                      <SpikeIntroIcon size={16} />
                    </span>
                  ) : null}
                </button>
                <small>
                  {row.profile.intent} · {row.liked}
                </small>
                {row.note && <em className="incoming-note">{row.note}</em>}
                <span className="decision-actions">
                  <button onClick={() => onPass(row.profile.name, row.id)}>
                    <X size={15} aria-hidden="true" /> Not for me
                  </button>
                  <button
                    className="accept-like"
                    onClick={() => onLikeBack(row.profile, row.id)}
                  >
                    <Heart size={15} aria-hidden="true" /> Accept
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
          {sentLikes.filter(({ profile }) => matchesQuery(profile)).length ? (
            sentLikes
              .filter(({ profile }) => matchesQuery(profile))
              .map(({ profile, status }) => (
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
            <p className="empty-likes">
              {query
                ? 'No sent likes found. Try another name.'
                : 'Profiles you like will appear here.'}
            </p>
          )}
          <div className="saved-profiles-section">
            <div className="saved-profiles-heading">
              <span>
                <Bookmark size={16} /> Saved privately
              </span>
              <small>{savedProfiles.length}</small>
            </div>
            {savedProfiles.filter(matchesQuery).length ? (
              savedProfiles.filter(matchesQuery).map((profile) => (
                <div className="sent-like" key={`saved-${profile.name}`}>
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
                    <small>Saved privately · no notification sent</small>
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
              <p className="empty-likes compact">
                {query
                  ? 'No saved profiles found.'
                  : 'Save a profile to revisit it here.'}
              </p>
            )}
          </div>
        </div>
      )}
      {view === 'incoming' &&
        incomingFilter === 'all' &&
        membership === 'free' &&
        availableRows.length > 2 && (
          <button className="plus-link" onClick={onUpgrade}>
            See {availableRows.length - Math.min(filteredRows.length, 2)} more
            with SpikeDate+ <ChevronRight size={16} />
          </button>
        )}
    </section>
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
  const [unreadOnly, setUnreadOnly] = useState(false);
  const unreadCount = contacts.reduce(
    (total, contact) => total + (contact.unread ?? 0),
    0,
  );
  const visibleContacts = contacts.filter(
    (contact) =>
      (!unreadOnly || (contact.unread ?? 0) > 0) &&
      `${contact.name} ${contact.preview}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="screen scroll-screen chat-screen midnight-chat">
      <header className="page-header chat-page-header">
        <p className="eyebrow">YOUR CONNECTIONS</p>
        <h1>
          Chats{' '}
          <span
            className="chat-total"
            aria-label={`${unreadCount} unread messages`}
          >
            {unreadCount || ''}
          </span>
        </h1>
      </header>
      <label className="chat-search">
        <Search size={18} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations"
          aria-label="Search chats"
        />
      </label>
      <div className="chat-inbox-filters" aria-label="Conversation filters">
        <button
          type="button"
          aria-pressed={!unreadOnly}
          onClick={() => setUnreadOnly(false)}
        >
          <MessageCircle size={15} aria-hidden="true" /> All{' '}
          <span className="conversation-count">{contacts.length}</span>
        </button>
        <button
          type="button"
          aria-pressed={unreadOnly}
          onClick={() => setUnreadOnly(true)}
        >
          <Mail size={15} aria-hidden="true" /> Unread{' '}
          <span>{unreadCount || ''}</span>
        </button>
      </div>
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
                <PresenceStatus
                  name={contact.name}
                  userId={contact.userId}
                  lastActiveAt={contact.lastActiveAt}
                  demoActive={!serverDataEnabled && contact.active}
                  variant="dot"
                />
              </span>
            </button>
            <span className="chat-copy">
              <button
                className="chat-name-link"
                onClick={() => onOpen(contact)}
                aria-label={`Chat with ${contact.name}`}
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
              {query
                ? 'No conversations found'
                : unreadOnly
                  ? 'You’re all caught up'
                  : 'No matches yet'}
            </strong>
            <p>
              {unreadOnly && !query
                ? 'No unread conversations right now.'
                : query
                  ? 'Try a different name or message.'
                  : 'A mutual Like unlocks chat.'}
            </p>
            {!query && !unreadOnly && (
              <button onClick={onBrowse}>Browse profiles</button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ChatThread({
  contact,
  loading,
  messages,
  onReadVisible,
  plan,
  composer,
  onComposer,
  onSend,
  onSendMedia,
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
  loading: boolean;
  messages: ChatMessage[];
  onReadVisible: (ids: string[]) => Promise<void>;
  plan?: DatingPlan;
  composer: string;
  onComposer: (text: string) => void;
  onSend: () => void;
  onSendMedia: (
    file: Blob,
    kind: 'photo' | 'voice',
    durationMs?: number,
    clientId?: string,
  ) => Promise<void>;
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
  const [toolsOpen, setToolsOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
    null,
  );
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const toolsId = useId();
  const messageBody = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);
  const observedMessageCount = useRef(0);
  const threadBody = useRef<HTMLElement>(null);
  const [scrollIndicator, setScrollIndicator] = useState({
    height: 0,
    top: 0,
    visible: false,
  });
  const readHandler = useRef(onReadVisible);
  readHandler.current = onReadVisible;
  useEffect(() => {
    const body = messageBody.current;
    if (!body) return;
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    let busy = false;
    const update = () => {
      const height = Math.max(
        28,
        (body.clientHeight * body.clientHeight) /
          Math.max(1, body.scrollHeight),
      );
      setScrollIndicator({
        height,
        top:
          ((body.clientHeight - height) * body.scrollTop) /
          Math.max(1, body.scrollHeight - body.clientHeight),
        visible: body.scrollHeight > body.clientHeight + 1,
      });
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (
          disposed ||
          busy ||
          loading ||
          threadBody.current?.querySelector('[role="dialog"]') ||
          document.visibilityState !== 'visible'
        )
          return;
        const bounds = body.getBoundingClientRect();
        const ids = messages
          .filter(
            (message) =>
              !message.mine &&
              !message.readAt &&
              typeof message.id === 'string',
          )
          .filter((message) => {
            const element = Array.from(
              body.querySelectorAll<HTMLElement>('[data-message-id]'),
            ).find((el) => el.dataset.messageId === String(message.id));
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            const overlap =
              Math.min(rect.bottom, bounds.bottom) -
              Math.max(rect.top, bounds.top);
            return (
              rect.left < bounds.right &&
              rect.right > bounds.left &&
              overlap >= Math.min(rect.height * 0.5, 80)
            );
          })
          .map((message) => String(message.id))
          .slice(0, 80);
        if (!ids.length) return;
        busy = true;
        try {
          await readHandler.current(ids);
        } catch {
          /* Retry visible messages on the next tick. */
        } finally {
          busy = false;
        }
      }, 600);
    };
    body.addEventListener('scroll', update);
    document.addEventListener('visibilitychange', update);
    const observer = new ResizeObserver(update);
    observer.observe(body);
    update();
    const retry = window.setInterval(update, 2000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.clearInterval(retry);
      observer.disconnect();
      body.removeEventListener('scroll', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [messages, loading, contact.name]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const fitViewport = () => {
      const thread = threadBody.current;
      if (!thread) return;
      const top = thread.getBoundingClientRect().top;
      const frameHeight =
        thread.parentElement?.clientHeight ?? window.innerHeight;
      const viewportBottom =
        (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      thread.style.setProperty(
        '--chat-visible-height',
        `${Math.max(0, Math.min(frameHeight, viewportBottom - top))}px`,
      );
    };
    fitViewport();
    window.addEventListener('resize', fitViewport);
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    return () => {
      window.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
    };
  }, []);
  useEffect(() => {
    setToolsOpen(false);
    pinnedToBottom.current = true;
  }, [contact.name]);
  useEffect(() => {
    const body = messageBody.current;
    const ownNewMessage =
      messages.length > observedMessageCount.current && messages.at(-1)?.mine;
    observedMessageCount.current = messages.length;
    if (body && (pinnedToBottom.current || ownNewMessage))
      body.scrollTop = body.scrollHeight;
  }, [contact.name, messages.length, toolsOpen]);
  return (
    <section
      ref={threadBody}
      className="thread midnight-chat spike-midnight-chat"
      aria-busy={loading}
    >
      <header className="thread-header">
        <button onClick={onBack} aria-label="Back to chats">
          <ChevronLeft size={22} />
        </button>
        <button
          className="thread-profile-link"
          onClick={onProfile}
          aria-label={`Open ${contact.name}'s full profile`}
        >
          <span className="avatar small thread-photo">
            <Image
              src={contact.image}
              alt={contact.name}
              fill
              sizes="42px"
              className="profile-photo"
            />
            <ProfileSpikeBadge compact />
          </span>
        </button>
        <button className="thread-name-link" onClick={onProfile}>
          <strong>{contact.name}</strong>
          <small>
            <PresenceStatus
              name={contact.name}
              userId={contact.userId}
              lastActiveAt={contact.lastActiveAt}
              demoActive={!serverDataEnabled && contact.active}
              variant="chat"
            />
          </small>
        </button>
        <button
          className="shield chat-game-toggle"
          type="button"
          aria-label="Games and date plans"
          aria-expanded={toolsOpen}
          aria-controls={toolsId}
          onClick={() => setToolsOpen((open) => !open)}
        >
          <Gamepad2 size={20} />
        </button>
        <button
          className="shield"
          onClick={onSafety}
          aria-label="Safety options"
        >
          <MoreHorizontal size={22} />
        </button>
      </header>
      <div className="chat-history-shell">
        <div
          className="message-body"
          ref={messageBody}
          onScroll={() => {
            const body = messageBody.current;
            if (body)
              pinnedToBottom.current =
                body.scrollHeight - body.scrollTop - body.clientHeight < 70;
          }}
        >
          <div className="day-label">Your conversation</div>
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
                onClick={() =>
                  onComposer('What’s the best rooftop in Brooklyn?')
                }
              >
                Best rooftop?
              </button>
              <button onClick={() => onComposer('Pick our first song 🎵')}>
                Pick our first song
              </button>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={message.id}
              data-message-id={message.id}
              className={`bubble-wrap ${message.mine ? 'mine' : ''} ${index > 0 && messages[index - 1].mine === message.mine ? 'message-grouped' : ''}`}
            >
              {message.mediaKind === 'photo' ? (
                <button
                  type="button"
                  className="bubble chat-photo-bubble"
                  aria-label={`View ${message.mine ? 'your' : contact.name + '’s'} photo`}
                  onClick={() =>
                    setSelectedPhoto(`/api/chat-media/${message.id}`)
                  }
                >
                  <Image
                    src={`/api/chat-media/${message.id}`}
                    alt={
                      message.mine
                        ? 'Shared by you'
                        : `Shared by ${contact.name}`
                    }
                    width={320}
                    height={240}
                    unoptimized
                  />
                </button>
              ) : message.mediaKind === 'voice' ? (
                <div className="bubble chat-voice-bubble">
                  <AudioLines size={17} aria-hidden="true" />
                  {/* Private voice notes have no generated transcript or caption track. */}
                  {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio
                    controls
                    preload="none"
                    src={`/api/chat-media/${message.id}`}
                    aria-label={`Voice message ${message.mine ? 'sent by you' : `from ${contact.name}`}`}
                  />
                </div>
              ) : message.mine ? (
                <button
                  type="button"
                  className="bubble"
                  aria-label={`Message options: ${message.text}`}
                  aria-haspopup="dialog"
                  onClick={() => setSelectedMessage(message)}
                >
                  {message.text}
                </button>
              ) : (
                <div className="bubble">{message.text}</div>
              )}
              {message.mine &&
                index === messages.findLastIndex((item) => item.mine) && (
                  <span
                    className={`message-status compact-marks ${message.readAt ? 'is-read' : ''}`}
                    aria-label={
                      message.readAt
                        ? `Read at ${new Date(message.readAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                        : message.deliveredAt
                          ? 'Delivered'
                          : typeof message.id === 'number' && serverDataEnabled
                            ? 'Sending'
                            : 'Sent'
                    }
                  >
                    {message.deliveredAt || message.readAt ? (
                      <CheckCheck size={15} aria-hidden="true" />
                    ) : (
                      <Check size={15} aria-hidden="true" />
                    )}
                    {message.readAt
                      ? `Read · ${new Date(message.readAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                      : message.deliveredAt
                        ? 'Delivered'
                        : typeof message.id === 'number' && serverDataEnabled
                          ? 'Sending'
                          : 'Sent'}
                  </span>
                )}
            </div>
          ))}
        </div>
        {scrollIndicator.visible && (
          <div className="chat-scroll-indicator" aria-hidden="true">
            <span
              style={{
                height: scrollIndicator.height,
                transform: `translateY(${scrollIndicator.top}px)`,
              }}
            />
          </div>
        )}
      </div>
      <div
        className="chat-quick-tools"
        id={toolsId}
        hidden={!toolsOpen}
        aria-label="Message tools"
      >
        <DatingGames
          key={contact.conversationId ?? contact.name}
          conversationId={contact.conversationId}
          viewerId={viewerEmail}
          partnerId={contact.email ?? contact.name}
          partnerName={contact.name}
          serverEnabled={serverDataEnabled}
          onPlan={datePlansEnabled ? onPlan : undefined}
        />
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
          if (!loading) onSend();
        }}
      >
        <ChatMediaActions
          key={contact.conversationId ?? contact.name}
          disabled={loading}
          onSend={onSendMedia}
        />
        <label className="chat-compose-field">
          <input
            value={composer}
            disabled={loading}
            onChange={(e) => onComposer(e.target.value)}
            placeholder={
              loading ? 'Loading messages…' : `Message ${contact.name}`
            }
            aria-label={`Message ${contact.name}`}
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={loading || !composer.trim()}
          >
            <ArrowUp size={20} />
          </button>
        </label>
      </form>
      <div className="chat-home-indicator" aria-hidden="true" />
      <Dialog
        open={Boolean(selectedMessage)}
        onOpenChange={(open) => {
          if (!open) setSelectedMessage(null);
        }}
      >
        <DialogContent className="chat-message-options">
          <DialogTitle>Message options</DialogTitle>
          <DialogDescription>
            Remove this message from your view on this device. This does not
            recall the recipient’s copy.
          </DialogDescription>
          <p className="chat-selected-message">{selectedMessage?.text}</p>
          <button
            type="button"
            onClick={() => {
              if (selectedMessage) onUnsend(selectedMessage.id);
              setSelectedMessage(null);
            }}
          >
            Remove from this view
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selectedPhoto)}
        onOpenChange={(open) => {
          if (!open) setSelectedPhoto(null);
        }}
      >
        <DialogContent className="chat-photo-viewer">
          <DialogTitle>Photo message</DialogTitle>
          <DialogDescription>Shared in this conversation.</DialogDescription>
          {selectedPhoto && (
            <Image
              src={selectedPhoto}
              alt="Shared attachment enlarged"
              width={800}
              height={800}
              unoptimized
            />
          )}
        </DialogContent>
      </Dialog>
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
    details: SignupDetails,
    phoneVerificationToken?: string,
  ) => Promise<string | null>;
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
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
    setShowPassword(false);
    setTermsAccepted(false);
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
    if (mode === 'signup' && !passwordSchema.safeParse(password).success) {
      setError(
        'Use 12–128 characters with uppercase, lowercase, and a number.',
      );
      return;
    }
    if (mode === 'signup' && !isAdult(birthDate)) {
      setError(
        'Enter your real birthday. You must be at least 18 to use SpikeDate.',
      );
      return;
    }
    if (mode === 'signup' && !gender) {
      setError('Choose your gender.');
      return;
    }
    if (mode === 'signup' && !termsAccepted) {
      setError('Accept the terms and privacy policy to continue.');
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
        : await onCreate(
            email,
            password,
            { birthDate, gender, termsAccepted },
            phoneToken || undefined,
          );
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
      <section
        className="auth-card"
        data-auth-mode={mode}
        aria-label="SpikeDate account access"
      >
        <div className="auth-brand">
          <SpikeDateWordmark context="auth" />
        </div>
        <div className="auth-copy">
          <p className="eyebrow">REAL CONNECTIONS START HERE</p>
          <h1>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
          <p>
            {mode === 'signin'
              ? 'Sign in to continue matching, messaging, and managing your profile.'
              : 'Secure your account, then build your profile with a few easy choices.'}
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
          <div
            className="auth-account-fields"
            hidden={
              mode === 'signup' && phoneVerificationEnabled && !phoneToken
            }
          >
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
                type={showPassword ? 'text' : 'password'}
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </label>
            {mode === 'signup' && (
              <label className="auth-consent">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                />
                <span>Show password</span>
              </label>
            )}
            {mode === 'signup' && (
              <>
                <p className="auth-phone-privacy">
                  Use 12–128 characters with uppercase, lowercase, and a number.
                </p>
                <label>
                  Birthday
                  <input
                    aria-label="Birthday"
                    type="date"
                    autoComplete="bday"
                    value={birthDate}
                    onChange={(event) => setBirthDate(event.target.value)}
                  />
                </label>
                <label>
                  Gender
                  <select
                    aria-label="Gender"
                    value={gender}
                    onChange={(event) => setGender(event.target.value)}
                  >
                    <option value="">Choose your gender</option>
                    {['Woman', 'Man', 'Nonbinary'].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="auth-consent">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                  />
                  <span>
                    I am 18 or older and agree to SpikeDate’s terms and privacy
                    policy.
                  </span>
                </label>
              </>
            )}
          </div>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={busy}
            hidden={
              mode === 'signup' && phoneVerificationEnabled && !phoneToken
            }
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
                {(serverDataEnabled
                  ? syntheticProfiles.map((fixture) => ({
                      email: fixture.email,
                      profile: {
                        name: fixture.name,
                        gender: fixture.gender === 'woman' ? 'Woman' : 'Man',
                      },
                    }))
                  : testIdentities
                ).map((identity) => (
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
  media,
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
}: {
  name: string;
  email: string;
  image: string;
  media: MediaItem[];
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
}) {
  const [reminderPreview, setReminderPreview] =
    useState<keyof EngagementPreferences>('today');
  const reminderGroups = [
    {
      title: 'SHOW UP',
      description: 'Keep your presence fresh',
      items: [
        {
          key: 'today',
          title: 'Share your Today',
          description: 'Only when you have not posted',
          icon: Sun,
        },
        {
          key: 'like',
          title: 'Galaxy',
          description: 'When fresh profiles appear',
          icon: Compass,
        },
      ],
    },
    {
      title: 'MAKE A MOVE',
      description: 'Always optional',
      items: [
        {
          key: 'super',
          title: 'Send a Spike',
          description: 'A thoughtful introduction idea',
          icon: SpikeIntroIcon,
        },
        {
          key: 'boost',
          title: 'Use Profile Lift',
          description: 'A suggestion when it may help',
          icon: ProfileLiftMark,
        },
      ],
    },
  ] as const;
  const previewNudge =
    reminderPreview === 'super'
      ? { kind: 'super' as const, profile: { name: 'Maya' } }
      : { kind: reminderPreview };
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
          unoptimized={image.startsWith('/') || image.startsWith('data:')}
          className="profile-passport-photo"
        />
        <span className="profile-photo-brand profile-photo-brand-self" aria-hidden="true">
          <BrandHeartMark size={16} />
        </span>
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
            className={`profile-today-trigger ${todayStory || availability ? 'active' : ''}`}
            onClick={() =>
              todayStory ? onEditToday(todayStory) : onCreateToday()
            }
            aria-label="Post or edit your Today update"
          >
            <TodayActionIcon active={Boolean(todayStory || availability)} />
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
      <nav className="profile-section-nav" aria-label="Profile sections">
        <button
          type="button"
          onClick={() =>
            document
              .getElementById('profile-details')
              ?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          <UserRound size={15} aria-hidden="true" /> My profile
        </button>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById('profile-settings')
              ?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          <SlidersHorizontal size={15} aria-hidden="true" /> Settings
        </button>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById('profile-subscription')
              ?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          <Star size={15} aria-hidden="true" /> Subscription
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
      <section className="own-photo-section" aria-label="Your profile photos">
        <div className="own-photo-heading">
          <span>
            <strong>
              <Camera size={18} aria-hidden="true" /> Your photos
            </strong>
            <small>
              {media.filter((item) => item.type === 'photo').length} of 6 photos
            </small>
          </span>
          <button
            type="button"
            className="section-edit"
            onClick={() => onEditSection(7)}
          >
            <Edit3 size={15} /> Edit photos
          </button>
        </div>
        <div
          className="own-photo-grid"
          role="region"
          aria-label="Your photos — swipe left or right"
        >
          {media
            .filter((item) => item.type === 'photo')
            .slice(0, 6)
            .map((photo, index) => (
              <button
                key={photo.id ?? photo.src}
                type="button"
                onClick={() => onEditSection(7)}
                aria-label={`Edit profile photo ${index + 1}`}
              >
                <Image
                  src={photo.src}
                  alt={`Your photo ${index + 1}`}
                  fill
                  sizes="64px"
                  unoptimized
                />
                <span>{index === 0 ? 'Main' : index + 1}</span>
              </button>
            ))}
          {!media.some((item) => item.type === 'photo') && (
            <button
              type="button"
              onClick={() => onEditSection(7)}
              aria-label="Add your first profile photo"
            >
              <ImagePlus size={24} /> Add photo
            </button>
          )}
        </div>
      </section>
      <p className="passport-details-title" id="profile-details">
        <span>
          <UserRound size={17} aria-hidden="true" /> My profile
        </span>
        <small>
          {registered
            ? missingProfileDetails.length
              ? `${profileDepth}% · add ${missingProfileDetails.slice(0, 2).join(' + ')}`
              : `${profileDepth}% complete`
            : `${profileDepth}% · finish required details`}
        </small>
      </p>
      <div
        className="settings-list passport-details-list atelier-categories"
        aria-label="Editable profile categories"
      >
        {[
          {
            title: 'The basics',
            description: `${name} · ${birthday} · ${details.city}`,
            Icon: UserRound,
            edit: 'Edit basics',
          },
          {
            title: 'About you',
            description:
              [details.gender, details.pronouns, details.height]
                .filter(Boolean)
                .join(' · ') || 'Identity, height & languages',
            Icon: UserRound,
            edit: 'Edit about you',
          },
          {
            title: 'Family & future',
            description:
              [details.kids, details.wantsKids, details.pets]
                .filter(Boolean)
                .join(' · ') || 'Kids, family plans & pets',
            Icon: Baby,
            edit: 'Edit family & pets',
          },
          {
            title: 'Everyday life',
            description:
              [
                details.drinking && `${details.drinking} drinking`,
                details.smoking === 'No' ? 'Doesn’t smoke' : details.smoking,
                details.exercise,
                ...(details.rhythm || []),
              ]
                .filter(Boolean)
                .join(' · ') || 'Drinking, smoking & fitness',
            Icon: Wine,
            edit: 'Edit lifestyle',
          },
          {
            title: 'Connection',
            description:
              [
                ...details.intents,
                details.relationshipStyle,
                details.datingPace,
                details.communicationPreference,
              ]
                .filter(Boolean)
                .join(' · ') || 'Intentions, style & communication',
            Icon: Heart,
            edit: 'Edit relationship goals',
          },
          {
            title: 'Interests & values',
            description:
              [...details.interests, ...details.values].join(' · ') ||
              'What makes you, you',
            Icon: WandSparkles,
            edit: 'Edit interests',
          },
          {
            title: 'My story',
            description:
              details.bio || details.promptOne || 'Bio & conversation starters',
            Icon: NotebookPen,
            edit: 'Edit prompts',
          },
          {
            title: 'Discovery preferences',
            description: `${details.preferredGenders.join(', ')} · Ages ${details.minAge}–${details.maxAge} · ${details.maxDistance} mi · Private`,
            Icon: SlidersHorizontal,
            edit: 'Edit preferences & media',
          },
        ].map(({ title, description, Icon, edit }, index) => (
          <button
            key={title}
            type="button"
            className="atelier-category setting-heading"
            aria-label={edit}
            onClick={() => onEditSection(index)}
          >
            <span className="atelier-category-icon">
              <Icon size={19} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="atelier-category-copy">
              <small>{title}</small>
              <strong>{description}</strong>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="profile-account-tools" id="profile-settings">
        <p className="profile-tools-label">
          <SlidersHorizontal size={17} aria-hidden="true" /> APP &amp; ACCOUNT
        </p>
        <PresencePreferences />
        <div className="profile-quick-actions lower-profile-tools">
          <button className="verification-entry" onClick={onVerification}>
            <ShieldCheck size={20} />
            <span>
              <strong>
                {verificationStatus === 'photo_verified' ||
                verificationStatus === 'identity_verified'
                  ? 'Photo Verified'
                  : verificationStatus === 'capture_ready'
                    ? 'Camera check complete'
                    : verificationStatus === 'needs_review' ||
                        verificationStatus === 'pending'
                      ? 'Camera check pending'
                      : 'Verify your photos'}
              </strong>
              <small>
                {verificationStatus === 'photo_verified' ||
                verificationStatus === 'identity_verified'
                  ? 'A live camera check matches this profile'
                  : verificationStatus === 'capture_ready'
                    ? 'Photo matching and liveness are not connected yet'
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
          <button id="profile-subscription" onClick={onSubscription}>
            <Star size={19} fill="currentColor" />
            <span>
              <strong>Subscription</strong>
              <small>
                {membership === 'plus'
                  ? `SpikeDate+ · unlimited Likes · ${superPulsesRemaining} of 3 Spikes`
                  : `Free · ${dailyLikesRemaining} Likes today · ${superPulsesRemaining} Spikes`}
              </small>
            </span>
            <ChevronRight size={17} />
          </button>
          <button onClick={onTheme}>
            <Palette size={19} />
            <span>
              <strong>App theme</strong>
              <small>
                {themeLabels[theme]} · {themeChoices.length} choices
              </small>
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
        <div
          className="communication-settings"
          aria-label="Notifications and reminders"
        >
          <div className="communication-settings-heading">
            <h2>Notifications &amp; reminders</h2>
            <p>Choose your updates, then set the nudges you find useful.</p>
          </div>
          <details className="push-settings-card communication-disclosure">
            <summary className="setting-heading">
              <span>
                <strong>
                  <Bell size={19} aria-hidden="true" /> Notifications
                </strong>
                <small>Choose what reaches you</small>
              </span>
              <ChevronRight size={19} aria-hidden="true" />
            </summary>
            <p className="push-settings-intro">
              Connection updates appear in-app. Push requires an enabled,
              registered device.
            </p>
            {(
              [
                ['newMatches', 'New matches', 'Mutual connections'],
                ['messages', 'New messages', 'Unread conversations'],
                ['newLikes', 'New likes', 'People interested in you'],
                ['planUpdates', 'Date-plan updates', 'Invites and replies'],
                [
                  'activityBriefing',
                  'Daily activity briefing',
                  'One scheduled summary',
                ],
              ] as const
            ).map(([key, title, description]) => (
              <div className="push-setting-toggle" key={key}>
                <span>
                  <strong>{title}</strong>
                  <p>{description}</p>
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
                <strong>Quiet hours · 10 PM–8 AM</strong>
                <p>Pause non-urgent push. In-app updates remain available.</p>
              </span>
              <Switch
                checked={Boolean(pushPreferences.quietHours)}
                onCheckedChange={onQuietHours}
                aria-label="Enable notification quiet hours"
              />
            </div>
          </details>
          <details className="engagement-settings-card communication-disclosure">
            <summary className="setting-heading">
              <span>
                <strong>
                  <WandSparkles size={19} aria-hidden="true" /> Connection
                  reminders
                </strong>
                <small>Small prompts for real connections</small>
              </span>
              <ChevronRight size={19} aria-hidden="true" />
            </summary>
            {reminderGroups.map((group) => (
              <div className="reminder-settings-group" key={group.title}>
                <div className="reminder-settings-group-heading">
                  <strong>{group.title}</strong>
                  <small>{group.description}</small>
                </div>
                {group.items.map(({ key, title, description, icon: Icon }) => (
                  <div className="engagement-setting-toggle" key={key}>
                    <span className="reminder-setting-icon" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <span className="reminder-setting-copy">
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
              </div>
            ))}
            {engagementPreferences.today && (
              <label className="today-reminder-time">
                <span>
                  <strong>Today reminder time</strong>
                  <p>
                    Shown in-app when you return after this time—not an alarm.
                  </p>
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
            <details className="reminder-preview-disclosure">
              <summary>
                <Eye size={16} aria-hidden="true" /> Preview reminders
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <p>Examples only. These buttons will not send anything.</p>
              <div
                className="reminder-preview-switcher"
                role="group"
                aria-label="Choose reminder preview"
              >
                {(
                  [
                    ['today', 'Today'],
                    ['like', 'Galaxy'],
                    ['super', 'Spike'],
                    ['boost', 'Lift'],
                  ] as const
                ).map(([key, title]) => (
                  <button
                    type="button"
                    key={key}
                    aria-pressed={reminderPreview === key}
                    onClick={() => setReminderPreview(key)}
                  >
                    {title}
                  </button>
                ))}
              </div>
              <EngagementPrompt
                nudge={previewNudge}
                membership={membership}
                boostsRemaining={1}
                dailyLikesRemaining={6}
                superPulsesRemaining={2}
                profileCount={3}
                onDismiss={() => {}}
                onAction={() => {}}
                preview
              />
            </details>
          </details>
        </div>
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
  story,
  availability,
  onBack,
  onEdit,
  userId,
  todayCount,
}: {
  name: string;
  sourceProfile?: Profile;
  media: MediaItem[];
  details: RegistrationData;
  story?: DailyStory;
  availability?: DailyAvailability;
  onBack: () => void;
  onEdit: () => void;
  userId?: string;
  todayCount: number;
}) {
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [previewAction, setPreviewAction] = useState('');
  useEffect(() => {
    if (!previewAction) return;
    const timer = window.setTimeout(() => setPreviewAction(''), 3500);
    return () => window.clearTimeout(timer);
  }, [previewAction]);
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
  const portrait: Profile = media.length
    ? {
        ...base,
        image: media.find((item) => item.type === 'photo')?.src ?? base.image,
        media,
      }
    : base;
  const self: Profile = {
    ...portrait,
    id: userId ?? portrait.id,
    name,
    place: details.city || portrait.place,
    intent: details.intents[0] || portrait.intent,
    tags: details.interests,
    prompt: serverDataEnabled
      ? details.promptOne || details.bio
      : details.promptOne || portrait.prompt,
    height: details.height,
    ethnicity: details.ethnicity,
    pets: details.pets,
    kids: details.kids,
    wantsKids: details.wantsKids,
    drinking: details.drinking,
    smoking: details.smoking,
    tonight:
      availability?.localDate === dateInputValue() &&
      new Date(availability.endAt).getTime() > Date.now()
        ? {
            plan: story?.caption || 'Open to making a plan',
            expiresAt: availability.endAt,
          }
        : undefined,
  };
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
        <DiscoverScreen
          profile={self}
          story={story}
          preview
          busy={false}
          matched={false}
          saved={false}
          todayCount={todayCount}
          todayActive={Boolean(story || availability)}
          onOpen={() => setFullPreviewOpen(true)}
          onOpenStory={() => setFullPreviewOpen(true)}
          onTonight={() => setFullPreviewOpen(true)}
          onPass={() =>
            setPreviewAction('Preview only — Pass moves to the next profile.')
          }
          onLike={() =>
            setPreviewAction(
              'Preview only — Like sends interest. Nothing was sent.',
            )
          }
          onSpark={() =>
            setPreviewAction(
              'Preview only — Spike sends an introduction. Nothing was sent.',
            )
          }
          onToggleSaved={() =>
            setPreviewAction(
              'Preview only — Save privately bookmarks a profile.',
            )
          }
          onPostToday={() =>
            setPreviewAction(
              'Preview only — Today lets you write an update and set tonight’s availability.',
            )
          }
          onSeeAllToday={() =>
            setPreviewAction(
              'Preview only — Fresh opens the latest Today updates.',
            )
          }
        />
        {previewAction && (
          <p className="preview-action-feedback" role="status">
            {previewAction}
          </p>
        )}
        <button className="edit-card" onClick={onEdit}>
          <Edit3 size={18} /> Edit card
        </button>
      </div>
      <FullProfile
        profile={self}
        open={fullPreviewOpen}
        onOpenChange={setFullPreviewOpen}
        readOnly
        detailsOverride={details}
        story={story}
        onPass={() => setFullPreviewOpen(false)}
        onLike={() => setFullPreviewOpen(false)}
        onSpark={() => setFullPreviewOpen(false)}
        onBoost={() => setFullPreviewOpen(false)}
        matched={false}
        saved={false}
        onShare={() => setFullPreviewOpen(false)}
        onReport={() => setFullPreviewOpen(false)}
        onBlock={() => setFullPreviewOpen(false)}
        onToggleSaved={() => setFullPreviewOpen(false)}
        todayActive={Boolean(story || availability)}
        onPostToday={() => setFullPreviewOpen(false)}
      />
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

function connectionForRegistration(data: RegistrationData): ProfileConnection {
  return {
    relationshipStyle: data.relationshipStyle || '',
    datingPace: data.datingPace || '',
    communicationPreference: data.communicationPreference || '',
    values: data.values.slice(0, 3),
    rhythm: data.rhythm || [],
    languages: data.languages || [],
  } as ProfileConnection;
}

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
  draftKey,
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
  onComplete: (data: RegistrationData) => Promise<void>;
  initialData: RegistrationData;
  draftKey: string;
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
  const [saving, setSaving] = useState(false);
  const [showOptionalAbout, setShowOptionalAbout] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const registrationBody = useRef<HTMLDivElement>(null);
  const initializedForOpen = useRef(false);
  useEffect(() => {
    if (registrationBody.current) registrationBody.current.scrollTop = 0;
  }, [step]);
  const onboarding = !editing && !singleSection;
  const flowSteps: readonly number[] = onboarding
    ? vibeSetupSteps
    : registrationSteps.map((_, index) => index);
  const position = Math.max(0, flowSteps.indexOf(step));
  useEffect(() => {
    if (!open) {
      initializedForOpen.current = false;
      return;
    }
    // Background profile hydration must not discard edits or close a camera/crop.
    if (initializedForOpen.current) return;
    initializedForOpen.current = true;
    if (open) {
      setStep(Math.max(0, Math.min(registrationSteps.length - 1, initialStep)));
      setData(initialData);
      if (onboarding && draftKey) {
        try {
          const draft = JSON.parse(
            localStorage.getItem(`spikedate-setup-draft:${draftKey}`) || 'null',
          );
          if (draft && Date.now() - draft.savedAt < 7 * 86400000) {
            setData({
              ...initialData,
              ...draft.data,
              birthday: initialData.birthday,
              gender: initialData.gender,
            });
            if (vibeSetupSteps.includes(draft.step)) setStep(draft.step);
          }
        } catch {
          /* A damaged or unavailable draft never blocks registration. */
        }
      }
      setValidationError('');
      setShowOptionalAbout(editing && initialStep === 1);
      setCropFile(null);
      setCropOpen(false);
    }
  }, [open, initialData, initialStep]);
  useEffect(() => {
    if (!open || !onboarding || !draftKey || saving) return;
    try {
      localStorage.setItem(
        `spikedate-setup-draft:${draftKey}`,
        JSON.stringify({ data, step, savedAt: Date.now() }),
      );
    } catch {
      /* Setup still works without local storage. */
    }
  }, [open, onboarding, draftKey, saving, data, step]);
  const vibeStepCopy: Record<number, { title: string; detail: string }> = {
    0: {
      title: 'First, just the basics.',
      detail:
        'Just your name and city. Your birthday and gender are already supplied.',
    },
    4: {
      title: 'Your kind of connection.',
      detail: 'Choose what feels honest right now, and who you’d like to meet.',
    },
    7: {
      title: 'Let them see you.',
      detail:
        'One clear photo to begin. More photos and a video can come later.',
    },
    5: {
      title: 'A little of your vibe.',
      detail: 'Tap a starter. Add optional details now, or come back later.',
    },
    8: {
      title: 'Here’s how they’ll see you.',
      detail: 'Review before sharing. Your camera safety check comes next.',
    },
  };
  // The registration dialog stays mounted while the camera handoff closes.
  // At that instant `editing` can change before the onboarding-only review
  // step (8) is reset, so keep a valid inactive-dialog description available.
  const item =
    (onboarding ? vibeStepCopy[step] : registrationSteps[step]) ??
    registrationSteps[
      Math.max(0, Math.min(registrationSteps.length - 1, step))
    ];
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
      if (!isAdult(data.birthday))
        return 'You must be at least 18 to use SpikeDate.';
    }
    if (step === 1 && !data.gender.trim()) return 'Choose your gender.';
    if (step === 4 && data.intents.length === 0)
      return 'Choose at least one relationship goal.';
    if (
      onboarding &&
      (step === 4 || step === 8) &&
      data.preferredGenders.length === 0
    )
      return 'Choose at least one gender preference.';
    if (onboarding && (step === 7 || step === 8) && photos.length === 0)
      return 'Add one clear profile photo to continue.';
    if (
      onboarding &&
      step === 8 &&
      (!data.name.trim() ||
        !data.city.trim() ||
        !isAdult(data.birthday) ||
        !data.gender ||
        !data.intents.length)
    )
      return 'Check your name, city, adult birthday, gender and relationship goal.';
    if (step === 7 || (onboarding && (step === 4 || step === 8))) {
      if (data.preferredGenders.length === 0)
        return 'Choose at least one gender preference.';
      if (data.minAge > data.maxAge)
        return 'Minimum age cannot be higher than maximum age.';
      if (
        ![data.minAge, data.maxAge].every(
          (age) => Number.isInteger(age) && age >= 18 && age <= 60,
        )
      )
        return 'Choose an age range between 18 and 60.';
      if (
        !Number.isFinite(data.maxDistance) ||
        data.maxDistance < 1 ||
        data.maxDistance > 50
      )
        return 'Choose a distance between 1 and 50 km.';
    }
    return '';
  };
  const saveOrContinue = async () => {
    if (saving) return;
    const error = validateCurrentStep();
    if (error) {
      setValidationError(error);
      return;
    }
    if (singleSection || position === flowSteps.length - 1) {
      setSaving(true);
      try {
        await onComplete(data);
        if (onboarding && draftKey) {
          try {
            localStorage.removeItem(`spikedate-setup-draft:${draftKey}`);
          } catch {
            /* Saving to the server succeeded even if local storage is unavailable. */
          }
        }
      } catch {
        setValidationError(
          'Could not save your profile. Check your connection and try again.',
        );
      } finally {
        setSaving(false);
      }
    } else setStep(flowSteps[position + 1]);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`flow-dialog registration-dialog ${onboarding ? 'vibe-registration' : ''}`}
      >
        <button
          className="match-close"
          onClick={() => onOpenChange(false)}
          aria-label="Close registration"
        >
          <X size={19} />
        </button>
        <div className="flow-kicker">
          {onboarding ? 'YOUR PROFILE' : 'REGISTRATION'} · {position + 1} OF{' '}
          {flowSteps.length}
        </div>
        <div className="flow-progress">
          {flowSteps.map((_, index) => (
            <span key={index} className={index <= position ? 'active' : ''} />
          ))}
        </div>
        <DialogTitle>{item.title}</DialogTitle>
        <DialogDescription>{item.detail}</DialogDescription>
        <div className="field-policy" hidden={onboarding}>
          <ShieldCheck size={15} />
          <span>
            Only fields marked Required block setup. Skip anything else and add
            it later.
          </span>
        </div>
        <div className="registration-body" ref={registrationBody}>
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
              <label className={onboarding ? 'vibe-birthday' : ''}>
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
              {onboarding && (
                <p className="vibe-identity">
                  <ShieldCheck size={16} aria-hidden="true" /> Birthday and
                  gender carried forward · {data.gender}. Change account
                  identity in your profile after setup.
                </p>
              )}
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
                Zodiac · Derived from your birthday
                <select
                  aria-label="Zodiac"
                  value={zodiacFromBirthDate(data.birthday) ?? ''}
                  disabled
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
                  <option value="">Not shared</option>
                  <option>No kids</option>
                  <option>Has kids</option>
                  <option>Prefer not to say</option>
                </select>
              </label>
              <label className="wide-field">
                Want children
                <select
                  aria-label="Want children"
                  value={data.wantsKids}
                  onChange={(event) => update('wantsKids', event.target.value)}
                >
                  <option value="">Not shared</option>
                  <option>Yes</option>
                  <option>No</option>
                  <option>Maybe</option>
                  <option>Open to children</option>
                  <option>Not sure</option>
                  <option>Prefer not to say</option>
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
                  <option value="">Not shared</option>
                  <option>Never</option>
                  <option>Rarely</option>
                  <option>Socially</option>
                  <option>Often</option>
                  <option>Regularly</option>
                  <option>Prefer not to say</option>
                </select>
              </label>
              <label>
                Smoking
                <select
                  aria-label="Smoking"
                  value={data.smoking}
                  onChange={(event) => update('smoking', event.target.value)}
                >
                  <option value="">Not shared</option>
                  <option>No</option>
                  <option>Sometimes</option>
                  <option>Yes</option>
                  <option>Occasionally</option>
                  <option>Regularly</option>
                  <option>Quitting</option>
                  <option>Prefer not to say</option>
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
              <details
                className="vibe-optional"
                open={onboarding ? undefined : true}
              >
                <summary>
                  <HandHeart size={16} aria-hidden="true" />
                  How we connect · Optional
                </summary>
                <ProfileConnectionFields
                  value={connectionForRegistration(data)}
                  onChange={(value) =>
                    setData((current) => ({ ...current, ...value }))
                  }
                  quick={onboarding}
                />
              </details>
              <ChoiceGroup
                label="Relationship goals · Required"
                options={relationshipOptions}
                selected={data.intents}
                onToggle={(value) => toggle('intents', value)}
                showIcons={onboarding}
              />
              {onboarding && (
                <>
                  <ChoiceGroup
                    label="I’d like to meet · Required"
                    options={['Woman', 'Man', 'Nonbinary']}
                    selected={data.preferredGenders}
                    onToggle={(value) => toggle('preferredGenders', value)}
                    showIcons
                  />
                  <details className="vibe-optional">
                    <summary>
                      <SlidersHorizontal size={16} aria-hidden="true" />
                      Adjust discovery preferences
                    </summary>
                    <label>
                      Minimum age
                      <input
                        aria-label="Minimum age"
                        type="number"
                        min={18}
                        max={60}
                        value={data.minAge}
                        onChange={(e) =>
                          update('minAge', Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      Maximum age
                      <input
                        aria-label="Maximum age"
                        type="number"
                        min={18}
                        max={60}
                        value={data.maxAge}
                        onChange={(e) =>
                          update('maxAge', Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      Maximum distance (miles)
                      <input
                        aria-label="Maximum distance"
                        type="number"
                        min={1}
                        max={50}
                        value={data.maxDistance}
                        onChange={(e) =>
                          update('maxDistance', Number(e.target.value))
                        }
                      />
                    </label>
                  </details>
                </>
              )}
            </div>
          )}
          {step === 5 && !onboarding && (
            <div className="stacked-choices">
              <ChoiceGroup
                label={`${data.interests.length} of 5 interests selected · Optional`}
                options={interestOptions}
                selected={data.interests}
                onToggle={(value) => toggle('interests', value, 5)}
              />
              <ChoiceGroup
                label={`${data.values.length} of 3 values selected · Optional`}
                options={valueOptions}
                selected={data.values}
                onToggle={(value) => toggle('values', value, 3)}
              />
            </div>
          )}
          {step === 5 && onboarding && (
            <div className="vibe-prompt-stage">
              <details className="vibe-optional">
                <summary>
                  <Music2 size={16} aria-hidden="true" />
                  Choose interests · Optional
                </summary>
                <ChoiceGroup
                  label={`${data.interests.length} of 5 interests selected`}
                  options={interestOptions}
                  selected={data.interests}
                  onToggle={(value) => toggle('interests', value, 5)}
                  showIcons
                />
              </details>
              <label>
                Conversation starter · Optional
                <select
                  aria-label="Conversation starter"
                  value={data.promptOneQuestion || vibePrompts[0].question}
                  onChange={(event) =>
                    setData((current) => ({
                      ...current,
                      promptOneQuestion: event.target.value,
                      promptOne: '',
                    }))
                  }
                >
                  {vibePrompts.map((prompt) => (
                    <option key={prompt.question}>{prompt.question}</option>
                  ))}
                </select>
              </label>
              <div className="vibe-idea-cards">
                {(
                  vibePrompts.find(
                    (prompt) =>
                      prompt.question ===
                      (data.promptOneQuestion || vibePrompts[0].question),
                  )?.ideas || []
                ).map((idea, index) => {
                  const IdeaIcon = [Coffee, Footprints, Utensils, WandSparkles][
                    index
                  ];
                  return (
                    <button
                      type="button"
                      key={idea}
                      aria-label={idea}
                      aria-pressed={data.promptOne === idea}
                      onClick={() =>
                        setData((current) => ({
                          ...current,
                          promptOne: idea,
                          promptOneQuestion:
                            current.promptOneQuestion ||
                            vibePrompts[0].question,
                        }))
                      }
                    >
                      <IdeaIcon size={16} aria-hidden="true" />
                      <span>
                        {(
                          {
                            'Coffee and an easy conversation.':
                              'Coffee & easy conversation',
                            'A walk somewhere new.': 'A walk somewhere new',
                            'Dinner at a cozy little place.': 'A cozy dinner',
                            'A little adventure together.':
                              'A little adventure',
                          } as Record<string, string>
                        )[idea] || idea}
                      </span>
                    </button>
                  );
                })}
              </div>
              <label>
                Make it yours
                <input
                  aria-label="First prompt"
                  maxLength={180}
                  placeholder="Choose an idea or write a short answer"
                  value={data.promptOne}
                  onChange={(event) =>
                    setData((current) => ({
                      ...current,
                      promptOne: event.target.value,
                      promptOneQuestion:
                        current.promptOneQuestion || vibePrompts[0].question,
                    }))
                  }
                />
              </label>
              <div className="vibe-answer-preview" aria-live="polite">
                <small>
                  {data.promptOneQuestion || vibePrompts[0].question}
                </small>
                <p>
                  {data.promptOne ||
                    'Your selected answer appears here. Nothing is published yet.'}
                </p>
              </div>
              <details className="vibe-optional vibe-depth-card">
                <summary>
                  <GraduationCap size={16} aria-hidden="true" />
                  Life &amp; lifestyle · Optional
                </summary>
                <div className="vibe-depth-fields">
                  {(
                    [
                      [
                        'education',
                        'Education',
                        [
                          'High school',
                          'College',
                          'Bachelor’s degree',
                          'Master’s degree',
                          'Doctorate',
                          'Trade school',
                          'Other',
                        ],
                      ],
                      [
                        'kids',
                        'Have children?',
                        ['No kids', 'Has kids', 'Prefer not to say'],
                      ],
                      [
                        'wantsKids',
                        'Want children?',
                        [
                          'Yes',
                          'No',
                          'Open to children',
                          'Not sure',
                          'Prefer not to say',
                        ],
                      ],
                      [
                        'drinking',
                        'Drinking',
                        [
                          'Never',
                          'Rarely',
                          'Socially',
                          'Regularly',
                          'Prefer not to say',
                        ],
                      ],
                      [
                        'smoking',
                        'Smoking',
                        [
                          'No',
                          'Occasionally',
                          'Regularly',
                          'Quitting',
                          'Prefer not to say',
                        ],
                      ],
                    ] as const
                  ).map(([key, label, options]) => (
                    <label key={key}>
                      {label}
                      <select
                        aria-label={label}
                        value={data[key]}
                        onChange={(event) => update(key, event.target.value)}
                      >
                        <option value="">Not shared</option>
                        {data[key] &&
                          !(options as readonly string[]).includes(
                            data[key],
                          ) && <option>{data[key]}</option>}
                        {options.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <p className="vibe-identity">
                    Share only what feels comfortable. Unanswered details stay
                    unshared.
                  </p>
                </div>
              </details>
              <details className="vibe-optional vibe-depth-card">
                <summary>
                  <NotebookPen size={16} aria-hidden="true" />
                  Your personality · Optional
                </summary>
                <div className="vibe-depth-fields">
                  <label>
                    About me
                    <textarea
                      aria-label="About me"
                      value={data.bio}
                      maxLength={300}
                      onChange={(event) => update('bio', event.target.value)}
                      placeholder="One small thing that feels like you…"
                    />
                    <small>{data.bio.length}/300</small>
                  </label>
                  <ChoiceGroup
                    label="Music & travel · up to 5 interests overall"
                    options={[
                      'Indie music',
                      'Pop music',
                      'Jazz',
                      'R&B',
                      'Live music',
                      'Road trips',
                      'City breaks',
                      'Nature trips',
                      'Beach trips',
                    ]}
                    selected={data.interests}
                    onToggle={(value) => toggle('interests', value, 5)}
                    showIcons
                  />
                  <label>
                    Second conversation starter
                    <select
                      aria-label="Second conversation starter"
                      value={data.promptTwoQuestion || 'My Sunday vibe is…'}
                      onChange={(event) =>
                        setData((current) => ({
                          ...current,
                          promptTwoQuestion: event.target.value,
                          promptTwo: '',
                        }))
                      }
                    >
                      {vibePrompts
                        .filter(
                          (prompt) =>
                            prompt.question !==
                            (data.promptOneQuestion || vibePrompts[0].question),
                        )
                        .map((prompt) => (
                          <option key={prompt.question}>
                            {prompt.question}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="vibe-second-ideas">
                    {(
                      vibePrompts.find(
                        (prompt) =>
                          prompt.question ===
                          (data.promptTwoQuestion || 'My Sunday vibe is…'),
                      )?.ideas || []
                    ).map((idea) => (
                      <button
                        key={idea}
                        type="button"
                        aria-pressed={data.promptTwo === idea}
                        onClick={() =>
                          setData((current) => ({
                            ...current,
                            promptTwo: idea,
                            promptTwoQuestion:
                              current.promptTwoQuestion || 'My Sunday vibe is…',
                          }))
                        }
                      >
                        {idea}
                      </button>
                    ))}
                  </div>
                  <label>
                    Your answer
                    <input
                      aria-label="Second prompt"
                      maxLength={180}
                      value={data.promptTwo}
                      onChange={(event) =>
                        setData((current) => ({
                          ...current,
                          promptTwo: event.target.value,
                          promptTwoQuestion:
                            current.promptTwoQuestion || 'My Sunday vibe is…',
                        }))
                      }
                      placeholder="Choose an idea or make it yours"
                    />
                  </label>
                </div>
              </details>
              <button
                type="button"
                className="vibe-later"
                onClick={() => {
                  setData((current) => ({
                    ...current,
                    promptOne: '',
                  }));
                  setStep(8);
                }}
              >
                Do this later
              </button>
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
                {data.promptOneQuestion || 'My ideal Sunday…'} · Optional
                <select
                  aria-label="First conversation starter"
                  value={data.promptOneQuestion || 'My ideal Sunday…'}
                  onChange={(event) =>
                    update('promptOneQuestion', event.target.value)
                  }
                >
                  {!vibePrompts.some(
                    (prompt) =>
                      prompt.question ===
                      (data.promptOneQuestion || 'My ideal Sunday…'),
                  ) && (
                    <option>
                      {data.promptOneQuestion || 'My ideal Sunday…'}
                    </option>
                  )}
                  {vibePrompts.map((prompt) => (
                    <option key={prompt.question}>{prompt.question}</option>
                  ))}
                </select>
                <textarea
                  aria-label="First prompt"
                  value={data.promptOne}
                  onChange={(event) => update('promptOne', event.target.value)}
                />
              </label>
              <label>
                {data.promptTwoQuestion || 'The quickest way to my heart…'} ·
                Optional
                <select
                  aria-label="Second conversation starter"
                  value={
                    data.promptTwoQuestion || 'The quickest way to my heart…'
                  }
                  onChange={(event) =>
                    update('promptTwoQuestion', event.target.value)
                  }
                >
                  {!vibePrompts.some(
                    (prompt) =>
                      prompt.question ===
                      (data.promptTwoQuestion ||
                        'The quickest way to my heart…'),
                  ) && (
                    <option>
                      {data.promptTwoQuestion ||
                        'The quickest way to my heart…'}
                    </option>
                  )}
                  {vibePrompts.map((prompt) => (
                    <option key={prompt.question}>{prompt.question}</option>
                  ))}
                </select>
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
              <div hidden={onboarding}>
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
              </div>
              <section
                className="profile-media-editor guided-photo-studio"
                aria-label="Profile photos"
              >
                <div className="profile-media-heading">
                  <span>
                    <small className="guided-photo-kicker">
                      GUIDED STUDIO · PROFILE PHOTO
                    </small>
                    <strong>Choose a photo you love</strong>
                    <small>
                      {photos.length} of 6 · first photo is your main photo
                    </small>
                  </span>
                  <Check size={17} />
                </div>
                <div
                  className="guided-photo-steps"
                  aria-label="Photo setup steps"
                >
                  <span>
                    <b>1</b> Upload
                  </span>
                  <span>
                    <b>2</b> Auto frame
                  </span>
                  <span>
                    <b>3</b> Review
                  </span>
                </div>
                {photos.length === 0 && (
                  <label className="guided-photo-upload">
                    <span className="guided-photo-upload-icon">
                      <ImagePlus size={27} aria-hidden="true" />
                    </span>
                    <strong>Add your first photo</strong>
                    <small>
                      Choose a clear, recent picture. We’ll frame your face
                      automatically before it is saved.
                    </small>
                    <span className="guided-photo-upload-action">
                      Choose from library
                    </span>
                    <span className="guided-photo-file-note">
                      JPG, HEIC, PNG or WebP · original quality preserved
                    </span>
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
                          photo.src.startsWith('/') ||
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
                  {photos.length > 0 && photos.length < 6 && (
                    <label className="profile-media-add">
                      <ImagePlus size={25} />
                      <strong>Add photo</strong>
                      <small>Choose from library</small>
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
                  Your selected photo is auto-framed on this device, then you
                  approve the crop. Avoid screenshots and heavy filters.
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
              <div className="media-rules" hidden={onboarding}>
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
          {step === 8 && onboarding && (
            <div className="vibe-profile-review">
              <ProfileConnectionSummary
                value={connectionForRegistration(data)}
              />
              {photos[0] && (
                <Image
                  src={photos[0].src}
                  alt="Your profile preview"
                  width={480}
                  height={600}
                  unoptimized
                  className="vibe-review-photo"
                />
              )}
              <h3>{data.name}</h3>
              <p>
                <MapPin size={14} aria-hidden="true" />
                {data.city}
              </p>
              <p>
                <Heart size={14} aria-hidden="true" />
                {data.intents.join(' · ')}
              </p>
              {data.interests.length > 0 && (
                <p>
                  <Music2 size={14} aria-hidden="true" />
                  {data.interests.join(' · ')}
                </p>
              )}
              {data.promptOne && (
                <div className="vibe-answer-preview">
                  <small>
                    {data.promptOneQuestion || vibePrompts[0].question}
                  </small>
                  <p>{data.promptOne}</p>
                </div>
              )}
              {data.bio && <p className="vibe-review-bio">{data.bio}</p>}
              {[
                data.education,
                data.kids,
                data.wantsKids && `Family plans: ${data.wantsKids}`,
                data.drinking && `Drinking: ${data.drinking}`,
                data.smoking && `Smoking: ${data.smoking}`,
              ].filter(Boolean).length > 0 && (
                <p className="vibe-review-facts">
                  {[
                    data.education,
                    data.kids,
                    data.wantsKids && `Family plans: ${data.wantsKids}`,
                    data.drinking && `Drinking: ${data.drinking}`,
                    data.smoking && `Smoking: ${data.smoking}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              {data.promptTwo && (
                <div className="vibe-answer-preview">
                  <small>
                    {data.promptTwoQuestion || 'My Sunday vibe is…'}
                  </small>
                  <p>{data.promptTwo}</p>
                </div>
              )}
              <div className="vibe-review-edits">
                <button type="button" onClick={() => setStep(0)}>
                  Edit basics
                </button>
                <button type="button" onClick={() => setStep(4)}>
                  Edit connection
                </button>
                <button type="button" onClick={() => setStep(7)}>
                  Edit photos
                </button>
                <button type="button" onClick={() => setStep(5)}>
                  Edit vibe
                </button>
              </div>
              <p className="vibe-identity">
                <ShieldCheck size={16} aria-hidden="true" />
                Your profile stays private until verified. Optional details
                remain editable in Profile. Today and tonight availability are
                not enabled automatically.
              </p>
            </div>
          )}
        </div>
        {validationError && (
          <p className="registration-error" role="alert">
            {validationError}
          </p>
        )}
        <div className="flow-actions">
          {position > 0 && (
            <button
              className="secondary-button"
              disabled={saving}
              onClick={() => {
                setValidationError('');
                setStep(flowSteps[position - 1]);
              }}
            >
              Back
            </button>
          )}
          <button
            className="primary-button"
            onClick={saveOrContinue}
            disabled={saving}
          >
            {saving
              ? 'Saving…'
              : singleSection
                ? 'Save changes'
                : position === flowSteps.length - 1
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
  showIcons = false,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  showIcons?: boolean;
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
            aria-pressed={selected.includes(option)}
          >
            {showIcons ? (
              <VibeChoiceIcon value={option} />
            ) : (
              selected.includes(option) && <Check size={14} />
            )}
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function VibeChoiceIcon({ value }: { value: string }) {
  const Icon = /coffee/i.test(value)
    ? Coffee
    : /music/i.test(value)
      ? Music2
      : /cook|food/i.test(value)
        ? Utensils
        : /pet/i.test(value)
          ? PawPrint
          : /outdoor|hiking/i.test(value)
            ? Leaf
            : /travel/i.test(value)
              ? Orbit
              : /marriage|long-term/i.test(value)
                ? Heart
                : /dating/i.test(value)
                  ? HandHeart
                  : /game/i.test(value)
                    ? Gamepad2
                    : /woman|man|nonbinary/i.test(value)
                      ? UserRound
                      : WandSparkles;
  return <Icon size={18} strokeWidth={1.5} aria-hidden="true" />;
}

function FilterDialog({
  open,
  onOpenChange,
  filters,
  availableProfiles,
  membership,
  onUpgrade,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Filters;
  availableProfiles: Profile[];
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
  const resultCount = availableProfiles.filter((profile) =>
    matchesFilters(profile, draft),
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
  onBoost,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membership: Membership;
  dailyLikesRemaining: number;
  superPulsesRemaining: number;
  onChoose: (billing: BillingPeriod) => void;
  onBoost: () => void;
}) {
  const [billing, setBilling] = useState<BillingPeriod>('monthly');
  const [restoreStatus, setRestoreStatus] = useState('');
  const [showFreeComparison, setShowFreeComparison] = useState(false);
  const likesUsed = membership === 'free' && dailyLikesRemaining <= 0;
  const spikesUsed = membership === 'free' && superPulsesRemaining <= 0;
  const selectedPrice = billing === 'weekly' ? '$1.00' : '$4.00';
  const selectedPeriod = billing === 'weekly' ? 'week' : 'month';
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
          <DialogTitle>
            {likesUsed && spikesUsed
              ? 'Keep connecting today'
              : likesUsed
                ? 'Keep liking today'
                : spikesUsed
                  ? 'Send another Spike'
                  : 'More signal. Less noise.'}
          </DialogTitle>
          <DialogDescription>
            {likesUsed || spikesUsed
              ? 'Your free allowance is used. SpikeDate+ unlocks unlimited Likes now and includes three priority Spikes every week.'
              : 'Likes show interest. A Spike can include a note and appears at the top of their Likes. Chat opens after a mutual match.'}
          </DialogDescription>
        </header>

        <div className="subscription-scroll">
          <div className="plan-usage">
            <span>
              {membership === 'plus' ? 'SPIKEDATE+ ACTIVE' : 'FREE PLAN'}
            </span>
            <strong>
              {membership === 'plus'
                ? `Unlimited Likes · ${superPulsesRemaining}/3 Spikes this week`
                : `${dailyLikesRemaining}/10 Likes today · ${superPulsesRemaining} Spikes available`}
            </strong>
          </div>
          {membership === 'free' && (likesUsed || spikesUsed) && (
            <div className="subscription-limit-nudge" role="status">
              <WandSparkles size={18} />
              <span>
                <strong>
                  {likesUsed && spikesUsed
                    ? 'Likes and Spikes are ready after upgrade'
                    : likesUsed
                      ? 'Unlimited Likes start immediately'
                      : 'Three weekly Spikes become available'}
                </strong>
                <small>You can cancel before the next renewal.</small>
              </span>
            </div>
          )}
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
          </div>
          <div className="plan-grid">
            <section className="featured">
              <span>SpikeDate+</span>
              <strong>
                {selectedPrice} <small>/ {selectedPeriod}</small>
              </strong>
              <ul>
                <li>
                  <Check size={15} /> See everyone who liked you
                </li>
                <li>
                  <Check size={15} /> Unlimited Likes
                </li>
                <li>
                  <Check size={15} /> 3 Spikes each week · delivered first
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
                    <Check size={15} /> 1 Spike each week · delivered first
                  </li>
                  <li>
                    <Check size={15} /> Optional notes with Spikes
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
            Likes and Spikes renew through SpikeDate+. Profile Lifts are
            separate one-time packs you can buy whenever you want.
          </p>
          <button
            type="button"
            className="text-button subscription-boost-link"
            onClick={onBoost}
          >
            Buy Profile Lifts without subscribing
          </button>
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
              : `Continue · ${selectedPrice} / ${selectedPeriod}`}{' '}
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
        className="flow-dialog boost-dialog editorial-popup"
      >
        <button
          className="match-close"
          onClick={() => onOpenChange(false)}
          aria-label="Close Profile Lift"
        >
          <X size={19} />
        </button>
        <div className="editorial-popup-heading">
          <span className="editorial-popup-icon boost-orbit" aria-hidden="true">
            <ProfileLiftMark size={20} />
          </span>
          <div>
            <p className="editorial-popup-kicker">PROFILE LIFT</p>
            <DialogTitle>
              {active ? 'Your Profile Lift is active' : 'Be seen sooner'}
            </DialogTitle>
          </div>
        </div>
        <DialogDescription>
          Profile Lift moves your completed profile toward the front of Spike
          and Galaxy for compatible people nearby for 30 minutes.
        </DialogDescription>
        <div className="boost-dialog-scroll">
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
          <details className="boost-details">
            <summary>How Profile Lift works</summary>
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
                  <small>
                    People see your profile naturally, without a label.
                  </small>
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
          </details>
          {!active && (
            <details
              className="boost-packs"
              aria-label="Profile Lift packs"
              open={boostsRemaining <= 0}
            >
              <summary>Get more Profile Lifts</summary>
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
            </details>
          )}
          {!active && membership !== 'plus' && (
            <button className="text-button boost-plan-link" onClick={onUpgrade}>
              Or see SpikeDate+ plans with one weekly Lift
            </button>
          )}
        </div>
        <div className="editorial-popup-footer">
          <button
            className="primary-button plan-button editorial-popup-action"
            onClick={onActivate}
            disabled={active || boostsRemaining <= 0}
          >
            {active
              ? 'Profile Lift is running'
              : boostsRemaining > 0
                ? 'Start 30-minute Profile Lift'
                : 'Choose a Profile Lift pack'}
          </button>
        </div>
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
            {superPulsesRemaining} Spike
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
    id: 'electric-blue',
    name: 'Electric Blue',
    detail: 'Midnight with vivid blue highlights',
    colors: ['#090b14', '#3978ff', '#7ea7ff'],
  },
  {
    id: 'spring-green',
    name: 'Spring Green',
    detail: 'Midnight with fresh green highlights',
    colors: ['#090b14', '#75eb8a', '#b8f6c2'],
  },
  {
    id: 'neon-orchid',
    name: 'Neon Orchid',
    detail: 'Midnight with luminous orchid highlights',
    colors: ['#090b14', '#c05cff', '#dda3ff'],
  },
  {
    id: 'vermilion',
    name: 'Vermilion',
    detail: 'Midnight with vivid red-orange highlights',
    colors: ['#090b14', '#f45e3f', '#ff9a75'],
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
          Vermilion is the starting theme. Your choice is saved on this device.
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
              {selected === choice.id && <Check size={18} />}
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
