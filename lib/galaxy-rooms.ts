export const galaxyRoomNames = [
  'Tonight',
  'Music',
  'Outdoors',
  'Food lovers',
  'New in town',
  'Coffee dates',
  'Pet people',
  'Arts & culture',
] as const;

export type GalaxyRoomName = (typeof galaxyRoomNames)[number];

export type GalaxyRoomCandidate = {
  tags?: readonly string[];
  interests?: readonly string[];
  pets?: string | null;
  facts?: { pets?: string | null } | null;
  availability?: {
    startAt: string;
    endAt: string;
  } | null;
};

function hasInterest(profile: GalaxyRoomCandidate, pattern: RegExp) {
  return (profile.tags ?? profile.interests ?? []).some((label) =>
    pattern.test(label),
  );
}

export function matchesGalaxyRoom(
  room: GalaxyRoomName,
  profile: GalaxyRoomCandidate,
  now = Date.now(),
) {
  switch (room) {
    case 'Tonight': {
      // The API must enforce visibility before it sends an availability window.
      const start = Date.parse(profile.availability?.startAt ?? '');
      const end = Date.parse(profile.availability?.endAt ?? '');
      return (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        end > now &&
        start < now + 12 * 60 * 60 * 1000
      );
    }
    case 'Music':
      return hasInterest(profile, /music|concert|jazz|r&b|vinyl|festival/i);
    case 'Outdoors':
      return hasInterest(
        profile,
        /outdoor|trail|hiking|nature|camp|walk|beach/i,
      );
    case 'Food lovers':
      return hasInterest(
        profile,
        /food|cook|dinner|restaurant|baking|cuisine/i,
      );
    case 'New in town':
      return hasInterest(profile, /\bnew in town\b/i);
    case 'Coffee dates':
      return hasInterest(profile, /coffee|caf[eé]/i);
    case 'Pet people': {
      const pets = profile.facts?.pets ?? profile.pets ?? '';
      return (
        hasInterest(profile, /pets?|dogs?|cats?/i) ||
        (Boolean(pets.trim()) &&
          !/^(no pets?|none|not shared|no)$/i.test(pets.trim()))
      );
    }
    case 'Arts & culture':
      return hasInterest(
        profile,
        /art|cultur|film|cinema|museum|galler|theat/i,
      );
  }
}
