'use client';

import { useRef, useState } from 'react';
import { CalendarPlus, ChevronRight, MoreHorizontal, Rocket, SlidersHorizontal, Sun, Volume2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function HomeTools({ onFilters, onAnnouncements, announcementsEnabled, onLift, liftActive, onToday, todayActive, onFresh, filterCount, freshCount }: {
  onFilters: () => void;
  onAnnouncements: () => void;
  announcementsEnabled: boolean;
  onLift: () => void;
  liftActive: boolean;
  onToday: () => void;
  todayActive: boolean;
  onFresh: () => void;
  filterCount: number;
  freshCount: number;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 72, left: 12, width: 304 });
  const rows = [
    { label: 'Filters', detail: 'Refine who you see', icon: SlidersHorizontal, action: onFilters, count: filterCount },
    { label: 'Announcements', detail: announcementsEnabled ? 'Activity briefing and updates' : 'Enable activity briefings in Settings', icon: Volume2, action: onAnnouncements, disabled: !announcementsEnabled },
    { label: 'Boost / Profile Lift', detail: liftActive ? 'Your Lift is active' : 'Be seen by more people', icon: Rocket, action: onLift, solid: true },
    { label: 'Calendar & Today', detail: todayActive ? 'Edit Today and tonight’s availability' : 'Post Today · available tonight', icon: CalendarPlus, action: onToday },
    { label: 'Fresh Moments', detail: 'Recent Today updates', icon: Sun, action: onFresh, count: freshCount },
  ];
  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (next && trigger.current) {
        const rect = trigger.current.getBoundingClientRect();
        const width = Math.min(304, window.innerWidth - 24);
        setPosition({ top: rect.bottom + 10, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), width });
      }
      setOpen(next);
    }}>
      <DialogTrigger render={<button ref={trigger} type="button" className="home-tools-trigger" aria-label="Open Home tools" />}>
        <MoreHorizontal size={25} aria-hidden="true" />
      </DialogTrigger>
      <DialogContent className="home-tools-dialog translate-x-0 translate-y-0 duration-0 data-open:animate-none data-closed:animate-none" overlayClassName="home-tools-backdrop" showCloseButton={false} style={{ top: position.top, left: position.left, width: position.width }}>
        <header className="home-tools-heading">
          <DialogTitle>Tools</DialogTitle>
          <button type="button" className="home-tools-close" aria-label="Close Home tools" onClick={() => setOpen(false)}><X size={19} /></button>
        </header>
        <DialogDescription className="sr-only">Shortcuts for discovery, updates, and profile visibility.</DialogDescription>
        <div className="home-tools-list">
          {rows.map(({ label, detail, icon: Icon, action, count, disabled, solid }) => (
            <button key={label} type="button" disabled={disabled} onClick={() => { setOpen(false); action(); }}>
              <Icon size={21} aria-hidden="true" fill={solid ? 'currentColor' : 'none'} />
              <span className="home-tool-copy"><strong>{label}</strong><small>{detail}</small></span>
              {typeof count === 'number' && count > 0 ? <span className="home-tool-count">{count}</span> : <ChevronRight size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
