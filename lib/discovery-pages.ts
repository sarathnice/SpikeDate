export type DiscoveryPage<T> = {
  profiles: T[];
  nextCursor?: string | null;
  hasMore?: boolean;
};

// Load bounded pages of metadata, not hundreds of photos. Images remain lazy.
// Retain compatibility with older servers and isolated UI fixtures without cursors.
export async function collectDiscoveryPages<
  T extends {
    id: string;
    profileLiftActive?: boolean;
    sharedInterestCount?: number;
    lastActiveAt?: number | null;
  },
>(
  fetchPage: (path: string) => Promise<DiscoveryPage<T>>,
  includeMatches = false,
  cancelled: () => boolean = () => false,
) {
  const profiles: T[] = [];
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    if (cancelled())
      throw new DOMException('Discovery refresh cancelled', 'AbortError');
    const params = new URLSearchParams({ limit: '50' });
    if (includeMatches) params.set('includeMatches', '1');
    if (cursor) params.set('cursor', cursor);
    const page = await fetchPage('/api/discover?' + params.toString());
    if (cancelled())
      throw new DOMException('Discovery refresh cancelled', 'AbortError');
    for (const profile of page.profiles)
      if (!ids.has(profile.id)) {
        ids.add(profile.id);
        profiles.push(profile);
      }
    cursor = page.nextCursor ?? null;
    if (cursor && cursors.has(cursor))
      throw new Error('Discovery did not advance. Please retry.');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  profiles.sort(
    (a, b) =>
      Number(Boolean(b.profileLiftActive)) -
        Number(Boolean(a.profileLiftActive)) ||
      (b.sharedInterestCount ?? 0) - (a.sharedInterestCount ?? 0) ||
      (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0),
  );
  return { profiles };
}
