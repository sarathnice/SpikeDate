import { Bookmark, Heart, MessageCircle, Plus, Star, X, type LucideProps } from 'lucide-react';

export function SpikeIntroIcon({ size = 24, className, ...props }: LucideProps) {
  const dimension = Number(size);
  return (
    <span className={`spike-intro-icon ${className ?? ''}`} style={{ width: dimension, height: dimension }} aria-hidden="true">
      <MessageCircle size={dimension} {...props} />
      <Star className="spike-intro-star" size={dimension * 0.34} fill="currentColor" strokeWidth={1.4} />
      <Plus className="spike-intro-plus" size={dimension * 0.3} strokeWidth={2} />
    </span>
  );
}

export type ProfileAction = 'pass' | 'like' | 'spike' | 'message' | 'save';

/** One glyph and stroke definition for the same action on every profile surface. */
export function ProfileActionIcon({ action, saved = false, size = 24 }: { action: ProfileAction; saved?: boolean; size?: number }) {
  const props = { size, strokeWidth: 1.8, className: 'profile-action-icon', 'aria-hidden': true as const };
  if (action === 'like') return <Heart {...props} fill="currentColor" />;
  if (action === 'save') return <Bookmark {...props} fill={saved ? 'currentColor' : 'none'} />;
  if (action === 'message') return <MessageCircle {...props} />;
  if (action === 'spike') return <SpikeIntroIcon {...props} />;
  return <X {...props} />;
}
