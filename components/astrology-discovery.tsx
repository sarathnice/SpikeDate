'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Star, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  zodiacSigns,
  pairingNotes,
  astrologyDisclaimer,
  type ZodiacSign,
} from '@/lib/astrology';

type Person = {
  id?: string;
  name: string;
  image: string;
  zodiac?: ZodiacSign | null;
};
export function AstrologyDiscovery({
  sign,
  people,
  onProfile,
}: {
  sign: ZodiacSign | null;
  people: Person[];
  onProfile: (person: Person) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [enabled, setEnabled] = useState(false);
  const visible = people.filter(
    (person) => person.zodiac && (filter === 'all' || person.zodiac === filter),
  );
  return (
    <section className="astrology-discovery">
      <button className="astrology-tile" onClick={() => setOpen(true)}>
        <Star size={24} />
        <span>
          <strong>Star Connection</strong>
          <small>Explore signs · For fun</small>
        </span>
        <ChevronRight size={18} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="astrology-dialog">
          <DialogTitle>Star Connection</DialogTitle>
          <DialogDescription>
            Optional astrology icebreakers—not a compatibility score.
          </DialogDescription>
          <p>
            Your sign:{' '}
            <strong>
              {sign ?? 'Not available—complete your birthday in registration'}
            </strong>
          </p>
          <p className="astrology-disclaimer">
            For entertainment only—not a scientifically validated measure of
            compatibility or safety. The supplied charts may disagree.
          </p>
          <details className="astrology-method">
            <summary>How signs and pairing notes work</summary>
            <p>{astrologyDisclaimer}</p>
          </details>
          <label className="astrology-opt-in">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{' '}
            Show astrology pairings in this view
          </label>
          {enabled && (
            <>
              <label className="astrology-filter">
                Explore a sign
                <select
                  aria-label="Explore zodiac sign"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All signs</option>
                  {zodiacSigns.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <p>{visible.length} profiles in your current discovery results</p>
              <div className="astrology-people">
                {visible.map((person) => {
                  const notes =
                    sign && person.zodiac
                      ? pairingNotes(sign, person.zodiac)
                      : null;
                  return (
                    <article key={person.id ?? person.name}>
                      <Image
                        src={person.image}
                        alt=""
                        width={56}
                        height={72}
                        unoptimized
                      />
                      <div>
                        <strong>
                          {person.name} · {person.zodiac}
                        </strong>
                        {notes && (
                          <>
                            <small>Chart 1: {notes.chartOne}</small>
                            <small>
                              Chart 2:{' '}
                              {notes.chartTwo.join(' · ') || 'Not listed'}
                            </small>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setOpen(false);
                            onProfile(person);
                          }}
                        >
                          View profile <ChevronRight size={14} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!visible.length && (
                <p>
                  No profiles with this sign in your current results. Try All
                  signs.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
