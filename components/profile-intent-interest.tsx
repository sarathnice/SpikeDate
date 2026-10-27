import { Coffee, Dumbbell, Footprints, Gamepad2, Heart, Music2, Palette, Sparkles, Utensils } from 'lucide-react';

export function primaryProfileInterest(tags: string[], intent: string) {
  // Use only a member's saved interests, never inferred traits or availability.
  return tags.map((tag) => tag.trim()).find((tag) =>
    tag.length > 0 && tag.length <= 40 &&
    tag.toLocaleLowerCase() !== intent.trim().toLocaleLowerCase(),
  ) ?? null;
}

export function ProfileIntentInterest({ intent, tags }: { intent: string; tags: string[] }) {
  const interest = primaryProfileInterest(tags, intent);
  const Icon = interest && /music|guitar|concert|sing/i.test(interest) ? Music2
    : interest && /food|cook|ramen|baking/i.test(interest) ? Utensils
    : interest && /coffee|café|cafe/i.test(interest) ? Coffee
    : interest && /hik|walk|outdoor/i.test(interest) ? Footprints
    : interest && /gam/i.test(interest) ? Gamepad2
    : interest && /fitness|gym|workout/i.test(interest) ? Dumbbell
    : interest && /art|paint|design/i.test(interest) ? Palette
    : Sparkles;
  return <div className="chips profile-intent-interest" aria-label="Relationship goal and interest">
    <span className="profile-goal"><Heart size={13} className="home-detail-icon" aria-hidden="true" />{intent}</span>
    {interest && <span className="profile-primary-interest"><Icon size={13} className="home-detail-icon" aria-hidden="true" />{interest}</span>}
  </div>;
}
