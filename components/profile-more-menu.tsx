'use client';

import { useState } from 'react';
import { Ban, Flag, MoreHorizontal, Share2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';

export function ProfileMoreMenu({ name, readOnly, onShare, onReport, onBlock }: {
  name: string;
  readOnly: boolean;
  onShare: () => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  const [open,setOpen]=useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<button type="button" className="cinema-more" aria-label="More profile options" />}>
      <MoreHorizontal size={23} aria-hidden="true" />
    </PopoverTrigger>
    <PopoverContent align="end" sideOffset={10} className="cinema-profile-menu">
      <PopoverTitle>{readOnly ? 'Your profile preview' : 'Profile options'}</PopoverTitle>
      {readOnly && <p>Preview only. No sharing or safety action is performed.</p>}
      {[
        {label:'Share profile',Icon:Share2,action:onShare},
        {label:'Report profile',Icon:Flag,action:onReport},
        {label:'Block profile',Icon:Ban,action:onBlock},
      ].map(({label,Icon,action})=><button key={label} type="button" disabled={readOnly} aria-label={`${label}: ${name}`} onClick={()=>{setOpen(false);action();}}><Icon size={19} aria-hidden="true" />{label}</button>)}
    </PopoverContent>
  </Popover>;
}
