export type VerificationPhotoMatch = {
  mediaId: string;
  position: number;
  similarityBps: number | null;
  decision: 'matched' | 'mismatched' | 'not_comparable';
};

export function decidePhotoVerification(matches: VerificationPhotoMatch[]) {
  const primary = matches.find((match) => match.position === 0);
  if (primary?.decision !== 'matched') return 'needs_retry' as const;
  if (
    matches.some(
      (match) => match.position !== 0 && match.decision !== 'matched',
    )
  )
    return 'needs_review' as const;
  return 'photo_verified' as const;
}
