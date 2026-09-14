import { writeFile } from 'node:fs/promises';

const debugPort = process.env.PULSE_DEBUG_PORT || '9223';
const baseUrl = process.env.PULSE_BASE_URL || 'http://localhost:3000/';
const expectedHost = new URL(baseUrl).host;
const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
const target = pages.find(
  (page) => page.type === 'page' && page.url.includes(expectedHost),
);
if (!target) throw new Error('SpikeDate browser target not found');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let sequence = 0;
const pending = new Map();
const browserErrors = [];
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) {
    if (
      message.method === 'Runtime.exceptionThrown' &&
      !message.params?.exceptionDetails?.url?.startsWith('chrome-extension://')
    )
      browserErrors.push(message);
    return;
  }
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  message.error
    ? waiter.reject(new Error(message.error.message))
    : waiter.resolve(message.result);
};
const command = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const wait = (ms = 520) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = async (expression) => {
  const result = await command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        'Evaluation failed',
    );
  return result.result.value;
};
const point = (selector, text) =>
  evaluate(
    `(() => { const nodes=[...document.querySelectorAll(${JSON.stringify(selector)})]; const e=${text ? `nodes.find(n=>n.textContent.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}))` : 'nodes[0]'}; if(!e) throw new Error('Missing target'); e.scrollIntoView({block:'center',inline:'center'}); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`,
  );
const click = async (selector, text) => {
  const p = await point(selector, text);
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: p.x,
    y: p.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await command('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: p.x,
    y: p.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  await wait();
};
const fill = async (selector, value) =>
  evaluate(
    `(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e) throw new Error('Missing input'); const setter=Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set; setter.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); return e.value; })()`,
  );
const mouseSwipe = async (selector, direction) => {
  const p = await point(selector);
  const startX = p.x + (direction === 'left' ? 96 : -96);
  const endX = p.x + (direction === 'left' ? -96 : 96);
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: startX,
    y: p.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  for (let i = 1; i <= 5; i += 1)
    await command('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: startX + ((endX - startX) * i) / 5,
      y: p.y,
      button: 'left',
      buttons: 1,
    });
  await command('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: endX,
    y: p.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  await wait(700);
};
const touchSwipe = async (selector, direction) => {
  const p = await point(selector);
  const startX = p.x + (direction === 'left' ? 96 : -96);
  const endX = p.x + (direction === 'left' ? -96 : 96);
  await command('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: startX, y: p.y, radiusX: 4, radiusY: 4, force: 1, id: 0 },
    ],
  });
  for (let i = 1; i <= 5; i += 1) {
    await command('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: startX + ((endX - startX) * i) / 5,
          y: p.y,
          radiusX: 4,
          radiusY: 4,
          force: 1,
          id: 0,
        },
      ],
    });
    await wait(30);
  }
  await command('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await wait(700);
};
const reload = async () => {
  await command('Page.reload', { ignoreCache: true });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    await wait(250);
    const ready = await evaluate(
      `document.readyState !== 'loading' && !!document.querySelector('.auth-card, .app-shell')`,
    ).catch(() => false);
    if (ready) return;
  }
  throw new Error('SpikeDate did not become interactive after reload');
};

const results = [];
const verify = async (name, check) => {
  try {
    const value = typeof check === 'function' ? await check() : check;
    if (!value) throw new Error('condition was false');
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({ name, status: 'FAIL', detail: error.message });
  }
};

await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await command('Emulation.setTouchEmulationEnabled', {
  enabled: false,
  maxTouchPoints: 1,
});
await evaluate(`localStorage.clear()`);
await reload();

await verify('App title renders', () =>
  evaluate(`document.title.includes('SpikeDate')`),
);
await verify('Signed-out users see the account gate', () =>
  evaluate(
    `document.querySelector('.auth-card')?.textContent.includes('Welcome back')`,
  ),
);
await verify('Test catalog exposes exactly 50 complete profiles', () =>
  evaluate(
    `document.querySelectorAll('select[aria-label="Test profile"] option').length===50`,
  ),
);
await verify('Test catalog includes women, men, and nonbinary profiles', () =>
  evaluate(
    `(() => { const text=[...document.querySelectorAll('select[aria-label="Test profile"] option')].map(option=>option.textContent).join(' '); return text.includes('Woman') && text.includes('Man') && text.includes('Nonbinary'); })()`,
  ),
);
const authShot = await command('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false,
});
await writeFile(
  'tests/spikedate-auth-mobile.png',
  Buffer.from(authShot.data, 'base64'),
);
await click('.auth-tabs button', 'Create account');
await fill('input[aria-label="Email"]', 'not-an-email');
await fill('input[aria-label="Password"]', 'Weakpass1');
await fill('input[aria-label="Confirm password"]', 'Weakpass1');
await click('.auth-submit');
await verify('Registration rejects invalid email', () =>
  evaluate(
    `document.querySelector('[role="alert"]')?.textContent.includes('valid email')`,
  ),
);
await fill('input[aria-label="Email"]', 'qa@spikedate.app');
await fill('input[aria-label="Password"]', 'weak');
await fill('input[aria-label="Confirm password"]', 'weak');
await click('.auth-submit');
await verify('Registration rejects weak password', () =>
  evaluate(
    `document.querySelector('[role="alert"]')?.textContent.includes('8+ characters')`,
  ),
);
await fill('input[aria-label="Password"]', 'Strongpass1');
await fill('input[aria-label="Confirm password"]', 'Strongpass2');
await click('.auth-submit');
await verify('Registration rejects password mismatch', () =>
  evaluate(
    `document.querySelector('[role="alert"]')?.textContent.includes('do not match')`,
  ),
);
await click('.auth-tabs button', 'Sign in');
await fill('input[aria-label="Email"]', 'demo@spikedate.app');
await fill('input[aria-label="Password"]', 'WrongPassword1');
await click('.auth-submit');
await verify('Sign in rejects incorrect password', () =>
  evaluate(
    `document.querySelector('[role="alert"]')?.textContent.includes('incorrect')`,
  ),
);
await fill('input[aria-label="Password"]', 'SpikeDate2026!');
await click('.auth-submit');
await verify('Valid demo credentials sign in', () =>
  evaluate(
    `!!document.querySelector('.phone-frame') && !document.querySelector('.auth-card')`,
  ),
);
await verify('Mobile layout has no horizontal overflow', () =>
  evaluate(
    `document.documentElement.scrollWidth===document.documentElement.clientWidth`,
  ),
);
await verify('Spike starts with Maya', () =>
  evaluate(
    `document.querySelector('.profile-card')?.textContent.includes('Maya, 27')`,
  ),
);
await verify('Home Likes badge shows the real incoming count', () =>
  evaluate(
    `document.querySelector('.incoming-button')?.getAttribute('aria-label')==='Open likes center, 3 new likes' && document.querySelector('.notification-dot')?.textContent==='3'`,
  ),
);
await verify('Home header controls have unclipped mobile touch targets', () =>
  evaluate(
    `(() => { const filter=document.querySelector('.filter-button'); const likes=document.querySelector('.incoming-button'); if(!filter||!likes)return false; const fs=getComputedStyle(filter); const ls=getComputedStyle(likes); const fr=filter.getBoundingClientRect(); const lr=likes.getBoundingClientRect(); return fr.width>=44 && fr.height>=44 && lr.width>=44 && lr.height>=44 && fs.overflow==='visible' && ls.overflow==='visible' && fs.backgroundImage==='none' && parseFloat(fs.borderTopWidth)===0; })()`,
  ),
);
await verify('Chat navigation shows the total unread-message count', () =>
  evaluate(
    `document.querySelector('.tab-badge')?.textContent==='2' && !!document.querySelector('.tabbar button[aria-label="Chat, 2 unread messages"]')`,
  ),
);
await verify(
  'Profiles with an active Today post show a compact home indicator',
  () =>
    evaluate(
      `document.querySelector('.today-card-pill')?.textContent.includes('Attempting homemade pasta tonight')`,
    ),
);
await verify(
  'Home provides a compact all-updates entry without covering the photo',
  () =>
    evaluate(
      `Number(document.querySelector('.today-count-badge')?.textContent)>=3 && document.querySelector('.home-action-rail .today-feed')?.getAttribute('aria-label')?.includes('fresh Today')`,
    ),
);
await click('.home-action-rail .today-feed');
await verify('See all Today lists each active person only once', () =>
  evaluate(
    `(()=>{const rows=[...document.querySelectorAll('.today-feed-list > button')]; const names=rows.map(row=>row.querySelector('.today-feed-copy small')?.textContent.split(' · ')[0]); return rows.length>=3 && new Set(names).size===rows.length;})()`,
  ),
);
await click('button[aria-label="View Maya\'s Today update"]');
await verify('Tapping Today opens the post without opening the profile', () =>
  evaluate(
    `document.querySelector('.today-viewer-dialog')?.textContent.includes('Maya') && document.querySelector('.today-viewer-dialog')?.textContent.includes('homemade pasta') && !document.querySelector('.profile-sheet')`,
  ),
);
await verify('Viewing a Today post records one unique viewer', () =>
  evaluate(
    `JSON.parse(localStorage.getItem('pulse-daily-stories')).find(story=>story.authorName==='Maya').viewedBy.includes('demo@spikedate.app')`,
  ),
);
await verify('Today offers Like, Super Spike, and a 140-character reply', () =>
  evaluate(
    `document.querySelectorAll('.today-viewer-actions > button').length===2 && document.querySelector('[aria-label="Reply to Today post"]')?.maxLength===140`,
  ),
);
await click('.today-viewer-actions > button', 'Like');
await verify(
  'A Today Like opens the existing note flow with story context',
  () =>
    evaluate(
      `document.querySelector('.note-dialog')?.textContent.includes('Like Maya') && document.querySelector('.note-dialog')?.textContent.includes('Today · My current food craving')`,
    ),
);
await click('.note-dialog .note-sheet-close');
await click('.today-card-pill');
await fill(
  '[aria-label="Reply to Today post"]',
  'That pasta looks great—what sauce did you make?',
);
await click('button[aria-label="Send Today reply"]');
await verify('A matched Today reply is delivered into Chat', () =>
  evaluate(
    `JSON.parse(localStorage.getItem('pulse-messages')).some(message=>message.toEmail==='maya@spikedate.test' && message.text.includes('Replied to your Today'))`,
  ),
);
await verify('Today reply confirms delivery without changing profiles', () =>
  evaluate(
    `document.querySelector('.toast')?.textContent.includes('Reply sent to Maya') && document.querySelector('.profile-card')?.textContent.includes('Maya, 27')`,
  ),
);
await verify('Spike and Galaxy use meaningful navigation icons', () =>
  evaluate(
    `!!document.querySelector('.tabbar .tab-brand-symbol') && !!document.querySelector('.tabbar .lucide-orbit')`,
  ),
);
await verify('Active navigation is visually highlighted and announced', () =>
  evaluate(
    `document.querySelector('.tabbar button.active')?.getAttribute('aria-current')==='page' && getComputedStyle(document.querySelector('.tabbar button.active')).backgroundImage!=='none'`,
  ),
);
await verify('Inactive navigation remains high contrast', () =>
  evaluate(
    `getComputedStyle([...document.querySelectorAll('.tabbar button')].find(node=>node.textContent.includes('Galaxy'))).color==='rgb(189, 189, 198)'`,
  ),
);
await verify('Navigation targets meet mobile touch sizing', () =>
  evaluate(
    `[...document.querySelectorAll('.tabbar button')].every(node=>node.getBoundingClientRect().height>=48)`,
  ),
);
await verify('Chat navigation announces unread messages', () =>
  evaluate(
    `document.querySelector('.tabbar button[aria-label*="unread messages"]')?.textContent.includes('Chat')`,
  ),
);
await verify('Red heart is the normal Like action', () =>
  evaluate(
    `document.querySelector('.home-action-rail .like')?.getAttribute('aria-label')?.startsWith('Like ') && getComputedStyle(document.querySelector('.home-action-rail .like')).backgroundColor==='rgb(227, 27, 54)'`,
  ),
);
await verify('Branded heart-S Super Spike signal appears on Spike', () =>
  evaluate(
    `document.querySelectorAll('.home-action-rail button').length===6 && !!document.querySelector('.home-action-rail .super .super-spike-mark')`,
  ),
);
await verify('Home exposes Profile Lift next to the top Incoming heart', () =>
  evaluate(
    `document.querySelector('.global-boost-button.with-incoming')?.getAttribute('aria-label')==='Lift my profile' && !!document.querySelector('.global-boost-button .profile-lift-mark') && !document.querySelector('.discover-screen .action-button.boost-action')`,
  ),
);
await click('.global-boost-button');
await verify('Home Profile Lift opens the visibility flow', () =>
  evaluate(
    `document.querySelector('.boost-dialog')?.textContent.includes('Be seen sooner')`,
  ),
);
await click('.boost-dialog .match-close');
await verify('Home name and navigation use lighter font weights', () =>
  evaluate(
    `getComputedStyle(document.querySelector('.profile-card .name-row h1')).fontWeight==='500' && [...document.querySelectorAll('.tabbar button')].every((button)=>getComputedStyle(button).fontWeight==='400')`,
  ),
);
await click('.home-action-rail .super');
await verify('Heart-S signal opens Super Spike note composer', () =>
  evaluate(
    `document.querySelector('.note-dialog')?.textContent.includes('Super Spike Maya')`,
  ),
);
await verify('Free Super Spike composer shows weekly balance', () =>
  evaluate(
    `document.querySelector('.note-dialog')?.textContent.includes('1 Super Spike left this week')`,
  ),
);
await verify(
  'Like and Super Spike composer identifies the profile with the heart-S badge',
  () =>
    evaluate(
      `!!document.querySelector('.note-context-photo .profile-spike-badge')`,
    ),
);
await verify('Super Spike uses a mobile bottom sheet', () =>
  evaluate(
    `Math.abs((document.querySelector('.note-sheet')?.getBoundingClientRect().bottom ?? 0)-innerHeight)<=1`,
  ),
);
await verify('Super Spike can be sent without a note', () =>
  evaluate(
    `document.querySelector('.note-skip')?.textContent.includes('Super Spike without a note')`,
  ),
);
await click('.note-targets button', 'Lifestyle');
await fill(
  'textarea[aria-label="Profile note"]',
  'Your music taste sounds great — favorite live show?',
);
await click('.note-dialog .primary-button');
await verify('Super Spike gets priority Incoming placement', () =>
  evaluate(
    `document.querySelector('.toast.show')?.textContent.includes('front of their Incoming')`,
  ),
);
await reload();
await mouseSwipe('.profile-card', 'left');
await verify('Mouse drag left advances profile', () =>
  evaluate(
    `document.querySelector('.profile-card')?.textContent.includes('Lena, 29')`,
  ),
);
await reload();
await command('Emulation.setTouchEmulationEnabled', {
  enabled: true,
  maxTouchPoints: 5,
});
await touchSwipe('.profile-card', 'left');
await verify('Touch swipe left advances profile', () =>
  evaluate(
    `document.querySelector('.profile-card')?.textContent.includes('Lena, 29')`,
  ),
);
await command('Emulation.setTouchEmulationEnabled', {
  enabled: false,
  maxTouchPoints: 1,
});
await reload();
await mouseSwipe('.profile-card', 'left');
await mouseSwipe('.profile-card', 'left');
await mouseSwipe('.profile-card', 'left');
await verify('Four women profiles are available', () =>
  evaluate(
    `document.querySelector('.profile-card')?.textContent.includes('Ava, 30')`,
  ),
);
await reload();

await click('.tabbar button', 'Chat');
await verify('Chat list explains mutual matches', () =>
  evaluate(`document.body.textContent.includes('Mutual matches only')`),
);
await verify('Received message shows unread badge', () =>
  evaluate(`document.querySelector('.chat-meta b')?.textContent==='2'`),
);
await verify('Every chat profile avatar carries the heart-S badge', () =>
  evaluate(
    `document.querySelectorAll('.chat-row').length===document.querySelectorAll('.chat-row .profile-spike-badge').length`,
  ),
);
await verify('Online state remains separate from the profile badge', () =>
  evaluate(
    `(() => { const avatar=document.querySelector('.chat-avatar'); const online=avatar?.querySelector('i'); const badge=avatar?.querySelector('.profile-spike-badge'); if(!online||!badge)return false; const o=online.getBoundingClientRect(); const b=badge.getBoundingClientRect(); return o.top < b.top && b.right >= o.right-3; })()`,
  ),
);
await click('.chat-profile-link');
await verify('Chat avatar or name opens the full profile', () =>
  evaluate(
    `document.querySelector('.profile-title')?.textContent.includes('Maya, 27')`,
  ),
);
await click('.sheet-handle');
await click('.chat-conversation', 'Sent a voice note');
await verify('Received message opens correct thread', () =>
  evaluate(
    `document.querySelector('.thread-header strong')?.textContent==='Lena'`,
  ),
);
await verify('Chat thread avatar carries the compact heart-S badge', () =>
  evaluate(
    `!!document.querySelector('.thread-profile-link .profile-spike-badge.compact')`,
  ),
);
await verify('Incoming message content is readable', () =>
  evaluate(
    `document.querySelector('.bubble')?.textContent.includes('voice note')`,
  ),
);
await verify('Message composer has a contrasting silver surface', () =>
  evaluate(
    `(() => { const composer=getComputedStyle(document.querySelector('.composer')); const screen=getComputedStyle(document.querySelector('.thread')); return composer.backgroundColor!==screen.backgroundColor && parseFloat(composer.borderTopWidth)>=1; })()`,
  ),
);
await verify('Message field uses mobile-readable text size', () =>
  evaluate(
    `getComputedStyle(document.querySelector('.composer input')).fontSize==='16px'`,
  ),
);
await click('.thread-name-link', 'Lena');
await verify('Chat thread name opens the same full profile', () =>
  evaluate(
    `document.querySelector('.profile-title')?.textContent.includes('Lena, 29')`,
  ),
);
await click('.sheet-handle');
await click('.thread-header button[aria-label="Back to chats"]');
await verify('Opening chat clears unread badge', () =>
  evaluate(
    `![...document.querySelectorAll('.chat-row')].find(n=>n.textContent.includes('Lena'))?.querySelector('.chat-meta b')`,
  ),
);
await verify('Opening the unread chat clears the Chat navigation badge', () =>
  evaluate(
    `!document.querySelector('.tab-badge') && !!document.querySelector('.tabbar button[aria-label="Chat"]')`,
  ),
);
await click('.tabbar button', 'Spike');

await click('.filter-button');
await verify('Preference filters open', () =>
  evaluate(
    `document.querySelector('.filter-dialog')?.textContent.includes('Preferences') && document.querySelector('.filter-dialog')?.textContent.includes('Dealbreakers')`,
  ),
);
await verify('Quick Sheet typography matches the selected preview', () =>
  evaluate(
    `getComputedStyle(document.querySelector('.quick-filter-header [data-slot="dialog-title"]')).fontWeight==='500' && getComputedStyle(document.querySelector('.quick-filter-group h3')).fontWeight==='500' && getComputedStyle(document.querySelector('.quick-filter-scroll')).fontFamily.toLowerCase().includes('inter')`,
  ),
);
await click('.filter-dialog .choice-group button', 'Women');
await click('.apply-filters');
await verify('Gender preference filters to men', () =>
  evaluate(
    `document.querySelector('.profile-card')?.textContent.includes('Noah, 31')`,
  ),
);
await mouseSwipe('.profile-card', 'left');
await mouseSwipe('.profile-card', 'left');
await mouseSwipe('.profile-card', 'left');
await verify('Four men profiles are available', () =>
  evaluate(
    `document.querySelector('.profile-card')?.textContent.includes('Elias, 32')`,
  ),
);
await click('.filter-button');
await click('.quick-filter-advanced');
await verify('Free plan gates advanced preference filters', () =>
  evaluate(
    `document.querySelector('.filter-upgrade')?.textContent.includes('Advanced filters with SpikeDate+')`,
  ),
);
await click('.filter-upgrade');
await click('.plan-button');
await verify('SpikeDate+ upgrade activates unlimited Likes', () =>
  evaluate(
    `document.querySelector('.toast.show')?.textContent.includes('Likes are unlimited')`,
  ),
);
await click('.filter-button');
await click('.quick-filter-advanced');
await click('.advanced-filter-fields .choice-group button', 'Marriage');
await click('.apply-filters');
await verify('Relationship goal filter returns Mateo', () =>
  evaluate(
    `document.querySelector('.profile-card')?.textContent.includes('Mateo, 30')`,
  ),
);
await click('.filter-button');
await click('.filter-dialog .secondary-button', 'Reset');
await click('.apply-filters');
await verify('Reset filters restores mixed profiles', () =>
  evaluate(
    `document.querySelector('.profile-card')?.textContent.includes('Maya, 27')`,
  ),
);

await click('.profile-card');
await verify('Full profile opens from photo tap', () =>
  evaluate(
    `document.querySelector('.full-profile-passport')?.textContent.includes('PROFILE STORY')`,
  ),
);
await verify('Full profile uses compact Profile Story highlights', () =>
  evaluate(
    `document.querySelector('.full-passport-facts')?.textContent.includes('Looking for') && document.querySelector('.full-passport-facts')?.textContent.includes('Family plans') && document.querySelectorAll('.full-passport-facts > div').length===4`,
  ),
);
await verify('Full profile shows family and lifestyle details', () =>
  evaluate(
    `document.querySelector('.profile-details')?.textContent.includes('Family plans') && document.querySelector('.profile-details')?.textContent.includes('Smokes')`,
  ),
);
await verify('Full profile keeps the existing X, Like and Spike controls', () =>
  evaluate(
    `document.querySelectorAll('.sheet-actions .action-row > button').length===3 && !!document.querySelector('.sheet-actions .action-button.pass') && !!document.querySelector('.sheet-actions .action-button.like') && !!document.querySelector('.sheet-actions .action-button.super-pulse')`,
  ),
);
await verify('Full profile keeps one Reply Spike and its safety options', () =>
  evaluate(
    `document.querySelectorAll('.profile-reply-pulse').length===1 && !!document.querySelector('.profile-title-line > .profile-reply-pulse') && !document.querySelector('.profile-end-reply') && document.querySelector('.profile-end-actions')?.textContent.includes('Report') && document.querySelector('.profile-end-actions')?.textContent.includes('Block')`,
  ),
);
await verify('Full profile typography matches Profile Story', () =>
  evaluate(
    `getComputedStyle(document.querySelector('.profile-sheet .profile-title h2')).fontWeight==='500' && getComputedStyle(document.querySelector('.full-profile-passport .section-label')).fontWeight==='500' && getComputedStyle(document.querySelector('.full-profile-passport p')).fontWeight==='400'`,
  ),
);
await click('.media-hit.next');
await verify('Full profile advances to second photo', () =>
  evaluate(
    `document.querySelector('.film-count')?.textContent.includes('2 / 3')`,
  ),
);
await click('.profile-share');
await verify('Share profile gives confirmation', () =>
  evaluate(
    `document.querySelector('.toast.show')?.textContent.includes('Share link ready')`,
  ),
);
await click('.sheet-handle');

await click('.home-action-rail .like');
await verify('Like opens optional 140 character note flow', () =>
  evaluate(
    `document.querySelector('textarea[aria-label="Profile note"]')?.maxLength===140 && document.querySelector('.note-dialog')?.textContent.includes('Like without a note')`,
  ),
);
await verify('Like sheet has a cancel-without-sending action', () =>
  evaluate(
    `document.querySelector('.note-cancel')?.textContent.includes('don’t send anything')`,
  ),
);
await click('.note-cancel');
await verify('Cancel closes the note sheet without advancing', () =>
  evaluate(
    `!document.querySelector('.note-dialog') && document.querySelector('.profile-card')?.textContent.includes('Maya, 27')`,
  ),
);
await click('.home-action-rail .like');
await verify('Like sheet keeps a coral primary action', () =>
  evaluate(
    `document.querySelector('.note-dialog .primary-button')?.textContent.trim()==='Send Like'`,
  ),
);
await click('.note-targets button', 'Two truths');
await fill(
  'textarea[aria-label="Profile note"]',
  'Your prompt feels exactly like my kind of Sunday.',
);
await click('.note-dialog .primary-button');
await verify('Mutual like opens match modal', () =>
  evaluate(
    `document.querySelector('.match-title')?.textContent==='It’s a Spike'`,
  ),
);
await verify(
  'Match confirmation identifies the matched profile with the heart-S badge',
  () =>
    evaluate(
      `!!document.querySelector('.match-profile-badged .profile-spike-badge')`,
    ),
);
await click('.match-close');
await click('.home-action-rail button[aria-label^="Pass on"]');
await click('.home-action-rail .like');
await click('.note-skip');
await verify('Non-mutual like advances to next profile', () =>
  evaluate(
    `document.querySelector('.profile-card')?.textContent.includes('Imani, 28')`,
  ),
);
await verify('Non-mutual like confirms sent status', () =>
  evaluate(
    `document.querySelector('.toast.show')?.textContent.includes('track it in You liked')`,
  ),
);
await click('.incoming-button');
await verify('Likes Center shows incoming likes', () =>
  evaluate(
    `document.querySelector('.likes-tabs')?.textContent.includes('Liked you')`,
  ),
);
await verify('Incoming notifications carry the heart-S profile badge', () =>
  evaluate(
    `document.querySelectorAll('.incoming-row').length===document.querySelectorAll('.incoming-row .profile-spike-badge').length`,
  ),
);
await verify('Incoming distinguishes Super Spike and photo notes', () =>
  evaluate(
    `document.querySelector('.incoming-list')?.textContent.includes('Priya') && document.querySelector('.incoming-list')?.textContent.includes('Super Spiked you') && document.querySelector('.incoming-list')?.textContent.includes('Leo') && document.querySelector('.incoming-list')?.textContent.includes('note on your photo')`,
  ),
);
await click('.incoming-name-link', 'Priya');
await verify('Incoming name opens full profile', () =>
  evaluate(
    `document.querySelector('.profile-title')?.textContent.includes('Priya, 28')`,
  ),
);
await click('.sheet-handle');
await click('.likes-tabs button', 'You liked');
await verify('Sent likes history includes liked profiles', () =>
  evaluate(
    `document.querySelector('.sent-likes')?.textContent.includes('Noah') && document.querySelector('.sent-likes')?.textContent.includes('Lena')`,
  ),
);
await click('.likes-tabs button', 'Liked you');
await click('.decision-actions button', 'Not for me');
await verify('Not for me removes incoming profile', () =>
  evaluate(
    `!document.querySelector('.incoming-list')?.textContent.includes('Priya')`,
  ),
);
await click('.decision-actions button', 'Accept');
await verify('Accept incoming like creates match', () =>
  evaluate(
    `document.querySelector('.match-title')?.textContent==='It’s a Spike'`,
  ),
);
await verify('Accepted match uses correct profile', () =>
  evaluate(`document.querySelector('.match-dialog img[alt*="Leo"]')!==null`),
);
await click('.icebreakers button');
await verify('Match opens message thread', () =>
  evaluate(
    `document.querySelector('.thread-header strong')?.textContent==='Leo'`,
  ),
);
await click('.thread-name-link', 'Leo');
await verify('Newly matched chat profile also opens in full', () =>
  evaluate(
    `document.querySelector('.profile-title')?.textContent.includes('Leo, 31')`,
  ),
);
await click('.sheet-handle');
await verify('Icebreaker prefills message composer', () =>
  evaluate(`document.querySelector('.composer input')?.value.length>0`),
);
await click('.composer button');
await verify('Message sends as outgoing bubble', () =>
  evaluate(`document.querySelectorAll('.bubble-wrap.mine').length===1`),
);
await click('.bubble-wrap.mine button');
await verify('Sent message can be unsent', () =>
  evaluate(`document.querySelectorAll('.bubble-wrap.mine').length===0`),
);
await evaluate(`document.querySelector('.thread-header .shield')?.click()`);
await wait();
await verify('Chat safety tools are one tap away', () =>
  evaluate(
    `document.querySelector('.safety-dialog')?.textContent.includes('Share date details')`,
  ),
);
await evaluate(
  `[...document.querySelectorAll('.safety-dialog button')].find((button)=>button.textContent.includes('Share date details'))?.click()`,
);
await wait();

await evaluate(
  `[...document.querySelectorAll('.tabbar button')].find((button)=>button.textContent.includes('Profile'))?.click()`,
);
await wait();
await verify('Profile exposes app theme choices', () =>
  evaluate(
    `document.querySelector('.profile-quick-actions')?.textContent.includes('App theme')`,
  ),
);
await verify('Profile shows SpikeDate+ Like and Super Spike allowances', () =>
  evaluate(
    `document.querySelector('.profile-quick-actions')?.textContent.includes('Unlimited Likes') && document.querySelector('.profile-quick-actions')?.textContent.includes('3 of 3 Super Spikes')`,
  ),
);
await verify('Profile exposes the weekly Profile Lift', () =>
  evaluate(
    `document.querySelector('.global-boost-button')?.getAttribute('aria-label')==='Lift my profile'`,
  ),
);
await verify('Profile exposes configurable activity briefings', () =>
  evaluate(
    `document.querySelector('.profile-quick-actions')?.textContent.includes('Activity briefing') && document.querySelector('.voice-settings-card')?.textContent.includes('Daily announcements')`,
  ),
);
await verify('Profile exposes granular push controls and quiet hours', () =>
  evaluate(
    `document.querySelector('.push-settings-card')?.textContent.includes('New matches') && document.querySelector('.push-settings-card')?.textContent.includes('Quiet hours')`,
  ),
);
await click('.profile-quick-actions button', 'Activity briefing');
await verify('Voice briefing summarizes matching activity', () =>
  evaluate(
    `document.querySelector('.voice-briefing-dialog')?.textContent.includes('Incoming') && document.querySelector('.voice-briefing-dialog')?.textContent.includes('Unread') && document.querySelector('.voice-briefing-dialog')?.textContent.includes('Matches')`,
  ),
);
await verify('Briefing removes microphone and conversational controls', () =>
  evaluate(
    `!document.querySelector('.voice-mode-picker') && !document.querySelector('.voice-mic-button') && !document.querySelector('input[aria-label="Voice command"]')`,
  ),
);
await verify(
  'Voice briefing offers review shortcuts without auto-sending',
  () =>
    evaluate(
      `document.querySelector('.voice-next-actions')?.textContent.includes('Messages') && document.querySelector('.voice-consent-note')?.textContent.includes('read-only')`,
    ),
);
await click('.voice-schedule-grid button', 'Evening');
await verify('Voice schedule can be changed and selected', () =>
  evaluate(
    `document.querySelector('.voice-schedule-grid button[aria-pressed="true"]')?.textContent.includes('Evening')`,
  ),
);
await evaluate(
  `document.querySelector('.voice-briefing-dialog .match-close')?.click()`,
);
await wait();
await evaluate(
  `[...document.querySelectorAll('.tabbar button')].find((button)=>button.textContent.includes('Profile'))?.click()`,
);
await wait();
await click('[aria-label="Enable activity briefings"]');
await verify('User briefing switch hides the activity entry point', () =>
  evaluate(
    `!document.querySelector('.profile-quick-actions')?.textContent.includes('Activity briefing') && document.querySelector('[aria-label="Enable activity briefings"]')?.getAttribute('aria-checked')==='false'`,
  ),
);
await click('[aria-label="Enable activity briefings"]');
await verify('User can re-enable activity briefings', () =>
  evaluate(
    `document.querySelector('.profile-quick-actions')?.textContent.includes('Activity briefing') && document.querySelector('[aria-label="Enable activity briefings"]')?.getAttribute('aria-checked')==='true'`,
  ),
);
await click('.global-boost-button');
await verify('Profile Lift clearly explains ranking and duration', () =>
  evaluate(
    `document.querySelector('.boost-dialog')?.textContent.includes('30 minutes') && document.querySelector('.boost-dialog')?.textContent.includes('No guaranteed matches')`,
  ),
);
await click('.boost-dialog .primary-button');
await verify('Activating Profile Lift updates the profile status', () =>
  evaluate(
    `document.querySelector('.global-boost-button')?.getAttribute('aria-label')==='View active Profile Lift'`,
  ),
);
await evaluate(
  `[...document.querySelectorAll('.tabbar button')].find((button)=>button.textContent.includes('Profile'))?.click()`,
);
await wait();
await click('.profile-quick-actions button', 'App theme');
await verify('Theme picker includes default and five alternatives', () =>
  evaluate(
    `document.querySelectorAll('.theme-option').length===6 && document.querySelector('.theme-dialog')?.textContent.includes('Solar Minimal') && document.querySelector('.theme-dialog')?.textContent.includes('Liquid Mono') && document.querySelector('.theme-dialog')?.textContent.includes('Liquid Lime')`,
  ),
);
await verify('Default SpikeDate remains the starting theme', () =>
  evaluate(
    `document.querySelector('.theme-option[data-theme-choice="default"]')?.getAttribute('aria-pressed')==='true'`,
  ),
);
await click('.theme-option', 'Aurora');
await verify('Aurora theme applies immediately', () =>
  evaluate(`document.documentElement.dataset.pulseTheme==='aurora'`),
);
await click('.profile-quick-actions button', 'App theme');
await click('.theme-option', 'Velvet Galaxy');
await verify('Velvet Galaxy theme applies immediately', () =>
  evaluate(`document.documentElement.dataset.pulseTheme==='velvet'`),
);
await click('.profile-quick-actions button', 'App theme');
await click('.theme-option', 'Solar Minimal');
await verify('Solar Minimal applies its light palette', () =>
  evaluate(
    `document.documentElement.dataset.pulseTheme==='solar' && getComputedStyle(document.querySelector('.phone-frame')).backgroundColor==='rgb(247, 243, 235)'`,
  ),
);
await click('.profile-quick-actions button', 'App theme');
await click('.theme-option', 'Liquid Mono');
await verify('Liquid Mono applies monochrome glass styling', () =>
  evaluate(
    `document.documentElement.dataset.pulseTheme==='liquid' && getComputedStyle(document.documentElement).getPropertyValue('--coral').trim()==='#ffffff' && getComputedStyle(document.querySelector('.tabbar')).backdropFilter!=='none'`,
  ),
);
await reload();
await verify('Selected theme persists after reload', () =>
  evaluate(`document.documentElement.dataset.pulseTheme==='liquid'`),
);
await click('.tabbar button', 'Profile');
await click('.profile-quick-actions button', 'App theme');
await click('.theme-option', 'Midnight');
await verify('User can restore Default SpikeDate', () =>
  evaluate(`document.documentElement.dataset.pulseTheme==='default'`),
);
await click('.self-row button');
await verify('Registration step 1 collects basics', () =>
  evaluate(
    `!!document.querySelector('input[aria-label="First name"]') && !!document.querySelector('input[aria-label="Birthday"]')`,
  ),
);
await fill('input[aria-label="First name"]', 'Sam');
await click('.flow-actions .primary-button');
await verify('Registration step 2 collects identity', () =>
  evaluate(
    `!!document.querySelector('select[aria-label="Ethnicity"]') && !!document.querySelector('input[aria-label="Height"]') && !!document.querySelector('select[aria-label="Orientation"]') && !!document.querySelector('input[aria-label="Languages"]')`,
  ),
);
await click('.flow-actions .primary-button');
await verify('Registration step 3 collects pets and children', () =>
  evaluate(
    `!!document.querySelector('select[aria-label="Pets"]') && !!document.querySelector('select[aria-label="Want children"]')`,
  ),
);
await click('.flow-actions .primary-button');
await verify('Registration step 4 collects lifestyle', () =>
  evaluate(
    `!!document.querySelector('select[aria-label="Drinking"]') && !!document.querySelector('select[aria-label="Smoking"]') && !!document.querySelector('select[aria-label="Exercise"]')`,
  ),
);
await click('.flow-actions .primary-button');
await verify('Registration step 5 collects relationship goals', () =>
  evaluate(
    `document.querySelector('.choice-group')?.textContent.includes('Marriage')`,
  ),
);
await click('.flow-actions .primary-button');
await verify('Registration step 6 limits interests', () =>
  evaluate(
    `document.querySelector('.choice-group')?.textContent.includes('of 5 interests selected')`,
  ),
);
await click('.flow-actions .primary-button');
await verify('Registration step 7 collects a bio and two prompts', () =>
  evaluate(
    `!!document.querySelector('textarea[aria-label="About me"]') && !!document.querySelector('textarea[aria-label="First prompt"]') && !!document.querySelector('textarea[aria-label="Second prompt"]')`,
  ),
);
await click('.flow-actions .primary-button');
await verify('Registration step 8 collects preferences', () =>
  evaluate(
    `!!document.querySelector('input[aria-label="Maximum distance"]') && document.querySelector('.registration-dialog')?.textContent.includes('Show me')`,
  ),
);
await verify('Registration explains media limits', () =>
  evaluate(
    `document.querySelector('.registration-dialog')?.textContent.includes('Up to 6 photos') && document.querySelector('.registration-dialog')?.textContent.includes('maximum 15 seconds')`,
  ),
);
await click('.flow-actions .primary-button');
await verify('Registration finishes end to end', () =>
  evaluate(
    `document.querySelector('.self-row h1')?.textContent.includes('Sam') && document.querySelector('.passport-details-title')?.textContent.includes('%')`,
  ),
);
await verify('Profile displays all eight registration sections', () =>
  evaluate(
    `document.querySelectorAll('.settings-list .section-edit').length===8`,
  ),
);
await click('.profile-passport-topbar button', 'Post Today');
await verify('Profile opens Today with prompt and privacy controls', () =>
  evaluate(
    `document.querySelectorAll('[aria-label="Today prompt"] option').length===5 && document.querySelectorAll('[aria-label="Today visibility"] option').length===3 && document.querySelector('[aria-label="Allow Today replies"]')?.getAttribute('aria-checked')==='true'`,
  ),
);
await fill(
  '[aria-label="Today update"]',
  'Trying the new farmers market before lunch.',
);
await click('.today-publish-button');
await verify('Publishing creates one 24-hour post on Profile', () =>
  evaluate(
    `document.querySelector('.today-profile-manager .has-story')?.textContent.includes('farmers market') && (()=>{const story=JSON.parse(localStorage.getItem('pulse-daily-stories')).find(item=>item.authorEmail==='demo@spikedate.app'); return story && new Date(story.expiresAt)-new Date(story.createdAt)===86400000;})()`,
  ),
);
await evaluate(
  `window.__todayOriginal=JSON.parse(localStorage.getItem('pulse-daily-stories')).find(item=>item.authorEmail==='demo@spikedate.app')`,
);
await click('.today-profile-manager > button');
await verify('Authors see private view count, edit, and delete controls', () =>
  evaluate(
    `document.querySelector('.today-owner-actions')?.textContent.includes('unique views') && document.querySelector('.today-owner-actions')?.textContent.includes('Edit') && document.querySelector('.today-owner-actions')?.textContent.includes('Delete')`,
  ),
);
await click('button[aria-label="Close Today post"]');
await click('.today-profile-actions button', 'Edit');
await verify('Editing Today preloads the existing post', () =>
  evaluate(
    `document.querySelector('[data-slot="dialog-title"]')?.textContent.includes('Edit your Today') && document.querySelector('[aria-label="Today update"]')?.value.includes('farmers market') && document.querySelector('.today-publish-button')?.textContent.includes('Save changes')`,
  ),
);
await fill(
  '[aria-label="Today update"]',
  'Farmers market done — trying a new coffee spot next.',
);
await click('.today-publish-button', 'Save changes');
await verify('Editing preserves Today identity, views, and expiration', () =>
  evaluate(
    `(()=>{const story=JSON.parse(localStorage.getItem('pulse-daily-stories')).find(item=>item.authorEmail==='demo@spikedate.app'); return story.caption.includes('coffee spot') && story.id===window.__todayOriginal.id && story.createdAt===window.__todayOriginal.createdAt && story.expiresAt===window.__todayOriginal.expiresAt && JSON.stringify(story.viewedBy)===JSON.stringify(window.__todayOriginal.viewedBy);})()`,
  ),
);
await click('.today-profile-actions button', 'Replace');
await verify('Post new opens a blank replacement composer', () =>
  evaluate(
    `document.querySelector('[data-slot="dialog-title"]')?.textContent.includes('Post a new Today') && document.querySelector('[aria-label="Today update"]')?.value==='' && document.querySelector('.today-composer-dialog')?.textContent.includes('fresh 24-hour window')`,
  ),
);
await fill('[aria-label="Today update"]', 'Sunset walk after work.');
await click('.today-publish-button', 'Post new for 24 hours');
await verify('Posting new replaces Today and restarts its 24-hour window', () =>
  evaluate(
    `(()=>{const stories=JSON.parse(localStorage.getItem('pulse-daily-stories')); const mine=stories.filter(item=>item.authorEmail==='demo@spikedate.app'); const story=mine[0]; return mine.length===1 && story.caption==='Sunset walk after work.' && story.id!==window.__todayOriginal.id && story.viewedBy.length===0 && new Date(story.expiresAt)-new Date(story.createdAt)===86400000;})()`,
  ),
);
await click('.today-profile-actions button', 'Delete');
await verify('Deleting Today asks for an explicit confirmation', () =>
  evaluate(
    `document.querySelector('.today-delete-confirm')?.textContent.includes('It will disappear for everyone') && document.querySelector('.today-delete-confirm')?.textContent.includes('Keep post') && document.querySelector('.today-delete-confirm')?.textContent.includes('Delete now')`,
  ),
);
await click('.today-delete-confirm button', 'Delete now');
await verify('Deleting Today removes it and restores the post action', () =>
  evaluate(
    `!JSON.parse(localStorage.getItem('pulse-daily-stories')).some(item=>item.authorEmail==='demo@spikedate.app') && document.querySelector('.profile-passport-topbar button')?.textContent.includes('Post Today') && !document.querySelector('.today-profile-actions')`,
  ),
);
await verify('Daily Today reminders are optional and time-configurable', () =>
  evaluate(
    `document.querySelector('[aria-label="Enable Daily Today idea"]')?.getAttribute('aria-checked')==='true' && document.querySelectorAll('[aria-label="Today reminder time"] option').length===3 && document.querySelector('.today-reminder-time')?.textContent.includes('Shown only when you open SpikeDate')`,
  ),
);
await click('.section-edit', 'Edit prompts');
await verify('Each profile section opens its matching edit step', () =>
  evaluate(
    `document.querySelector('.registration-dialog')?.textContent.includes('REGISTRATION · 7 OF 8') && document.querySelector('.registration-dialog')?.textContent.includes('Save changes')`,
  ),
);
await click('button[aria-label="Close registration"]');
await click('.primary-button.preview-button');
await verify('Card preview uses registered name', () =>
  evaluate(
    `document.querySelector('.profile-card')?.textContent.includes('Sam, 28')`,
  ),
);
await click('.preview-banner button');
await click('.profile-quick-actions button', 'SpikeDate+');
await verify('Subscription details remain accessible', () =>
  evaluate(
    `document.querySelector('.subscription-dialog')?.textContent.includes('$4.00')`,
  ),
);
await click('.match-close');

await click('.tabbar button', 'Galaxy');
await verify('Galaxy leads with the activity-first Plan Builder', () =>
  evaluate(
    `document.querySelector('.galaxy-plan-builder')?.textContent.includes('What sounds good?') && document.querySelectorAll('.galaxy-plan-tile').length===4`,
  ),
);
await click('.galaxy-plan-tile', 'Music');
await verify('Plan choice updates its suggested matches', () =>
  evaluate(
    `document.querySelector('.galaxy-plan-result')?.textContent.includes('music plan') && document.querySelector('.galaxy-plan-tile[aria-pressed="true"]')?.textContent.includes('Music')`,
  ),
);
await verify(
  'Galaxy suggested-profile icons carry compact heart-S badges',
  () =>
    evaluate(
      `document.querySelectorAll('.galaxy-plan-faces > span').length===document.querySelectorAll('.galaxy-plan-faces > span > .profile-spike-badge.compact').length`,
    ),
);
await click('.galaxy-plan-action');
await verify('Plan a Date opens date, time and place details', () =>
  evaluate(
    `document.querySelector('.plan-dialog')?.textContent.includes('Plan a music date') && !!document.querySelector('input[aria-label="Plan date"]') && !!document.querySelector('input[aria-label="Plan time"]')`,
  ),
);
await verify('Plan builder offers an opt-in private safety check-in', () =>
  evaluate(
    `document.querySelector('[aria-label="Enable safety check-in"]')?.getAttribute('aria-checked')==='true' && !!document.querySelector('[aria-label="Safety check-in time"]')`,
  ),
);
await fill('.plan-details-fields input', 'Prospect Park bandshell');
await click('.plan-dialog-actions .primary-button', 'Browse venues');
await verify('Galaxy plan builder provides public venue browsing', () =>
  evaluate(
    `document.querySelector('.venue-browser')?.textContent.includes('Public places near') && document.querySelectorAll('.venue-results button').length>0`,
  ),
);
await click('.venue-results button');
await click('.venue-results button:nth-child(2)');
await verify('A public venue can be selected for the plan', () =>
  evaluate(
    `document.querySelectorAll('.venue-results button.selected').length>=2`,
  ),
);
await click('.plan-dialog-actions .primary-button', 'Choose a match');
await verify('Plan invitations are limited to mutual matches', () =>
  evaluate(
    `document.querySelector('.plan-match-picker')?.textContent.includes('Mutual match') && document.querySelectorAll('.plan-match-picker > button').length===3`,
  ),
);
await verify('Every Galaxy plan invite profile carries a heart-S badge', () =>
  evaluate(
    `document.querySelectorAll('.plan-match-picker > button').length===document.querySelectorAll('.plan-match-picker .plan-match-avatar .profile-spike-badge').length`,
  ),
);
await verify('Galaxy compares availability before inviting a match', () =>
  evaluate(
    `document.querySelectorAll('.plan-match-availability').length===document.querySelectorAll('.plan-match-picker > button').length`,
  ),
);
await click('.plan-match-picker > button', 'Maya');
await click('.plan-dialog-actions .primary-button', 'Review invitation');
await verify('Plan review shows the selected match and details', () =>
  evaluate(
    `document.querySelector('.plan-review')?.textContent.includes('Prospect Park bandshell') && document.querySelector('.plan-review')?.textContent.includes('Maya')`,
  ),
);
await verify(
  'Plan review includes venue voting and safety reminder details',
  () =>
    evaluate(
      `document.querySelector('.plan-review')?.textContent.includes('can vote before accepting') && document.querySelector('.plan-review')?.textContent.includes('PRIVATE SAFETY CHECK-IN')`,
    ),
);
await verify('Plan invite is blocked until the safety acknowledgement', () =>
  evaluate(
    `document.querySelector('.send-plan-invites')?.disabled===true && document.querySelector('.plan-safety-consent')?.textContent.includes('public-place plan')`,
  ),
);
await click('.plan-safety-consent input');
await verify('Safety acknowledgement enables the private invite', () =>
  evaluate(`document.querySelector('.send-plan-invites')?.disabled===false`),
);
await click('.send-plan-invites');
await verify('Sent plan appears in Galaxy', () =>
  evaluate(
    `document.querySelector('.galaxy-upcoming-card')?.textContent.includes('Prospect Park bandshell') && document.querySelector('.galaxy-upcoming-card')?.textContent.includes('Maya')`,
  ),
);
await verify(
  'Sent plan exposes venue choices with the creator vote recorded',
  () =>
    evaluate(
      `document.querySelectorAll('.plan-venue-vote button').length===2 && document.querySelectorAll('.plan-venue-vote button.selected').length===1`,
    ),
);
await verify('Sent plan displays the scheduled safety check-in', () =>
  evaluate(
    `document.querySelector('.galaxy-upcoming-card')?.textContent.includes('Safety check-in 30 min after start')`,
  ),
);
await verify('Galaxy keeps a rich picture-based browse section', () =>
  evaluate(
    `document.querySelectorAll('.galaxy-hub .room-tile').length===8 && document.querySelector('.galaxy-hub')?.textContent.includes('Food lovers') && document.querySelector('.galaxy-hub')?.textContent.includes('Arts & culture')`,
  ),
);
await click('.room-tile', 'Tonight');
await verify('Galaxy opens filtered profile stack', () =>
  evaluate(
    `document.querySelector('.room-header')?.textContent.includes('84 here now')`,
  ),
);
await touchSwipe('.room-card-wrap .profile-card', 'left');
await verify('Touch swipe works inside Galaxy', () =>
  evaluate(`document.querySelector('.room-card-wrap .profile-card')!==null`),
);
await verify('Galaxy profiles keep Like and Super Spike actions', () =>
  evaluate(
    `document.querySelectorAll('.room-stack .action-button').length===3 && !!document.querySelector('.room-stack .action-button.like') && !!document.querySelector('.room-stack .action-button.priority')`,
  ),
);

await command('Emulation.setDeviceMetricsOverride', {
  width: 412,
  height: 915,
  deviceScaleFactor: 1,
  mobile: true,
});
await reload();
await verify('Android viewport fits without overflow', () =>
  evaluate(
    `document.documentElement.scrollWidth===document.documentElement.clientWidth && Math.round(document.querySelector('.phone-frame').getBoundingClientRect().width)===412`,
  ),
);
const shot = await command('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false,
});
await writeFile(
  'tests/spikedate-complete-android.png',
  Buffer.from(shot.data, 'base64'),
);

await click('.tabbar button', 'Profile');
await verify('Signed-in email appears on Profile', () =>
  evaluate(
    `document.querySelector('.self-row')?.textContent.includes('demo@spikedate.app')`,
  ),
);
await click('.logout-button');
await verify('Logout returns to sign in', () =>
  evaluate(
    `document.querySelector('.auth-card')?.textContent.includes('Welcome back')`,
  ),
);
await fill('input[aria-label="Email"]', 'demo@spikedate.app');
await fill('input[aria-label="Password"]', 'SpikeDate2026!');
await click('.auth-submit');
await reload();
await verify('Authenticated session persists after reload', () =>
  evaluate(
    `!!document.querySelector('.phone-frame') && !document.querySelector('.auth-card')`,
  ),
);
await click('.tabbar button', 'Profile');
await click('.logout-button');
await click('.auth-tabs button', 'Create account');
await fill('input[aria-label="Email"]', 'new.user@spikedate.app');
await fill('input[aria-label="Password"]', 'NewSpike1');
await fill('input[aria-label="Confirm password"]', 'NewSpike1');
await fill('input[aria-label="Mobile number"]', '+1 202 555 0198');
await click('.auth-phone-row button', 'Send code');
await fill('input[aria-label="Six-digit verification code"]', '123456');
await click('.auth-phone-row.code button', 'Verify');
await click('.auth-submit');
await verify('New account opens profile registration', () =>
  evaluate(
    `document.querySelector('.registration-dialog')?.textContent.includes('REGISTRATION · 1 OF 8')`,
  ),
);
await click('button[aria-label="Close registration"]');
await click('.tabbar button', 'Profile');
await verify('New account identity is displayed', () =>
  evaluate(
    `document.querySelector('.self-row')?.textContent.includes('new.user@spikedate.app')`,
  ),
);

await evaluate(`(() => {
  const plans=JSON.parse(localStorage.getItem('pulse-all-plans')||'[]');
  if(!plans[0]) throw new Error('Expected shared Galaxy plan');
  const plan=plans[0];
  const options=plan.venueOptions?.length>1
    ? plan.venueOptions
    : [plan.venue,{...plan.venue,id:plan.venue.id+'-alternate',name:'Match choice café'}];
  plans[0]={...plan,creatorEmail:'demo@spikedate.app',inviteeEmails:['maya@spikedate.test'],venueOptions:options,venueVotes:{'demo@spikedate.app':options[0].id},status:'sent',safetyCheckInEnabled:true,safetyCheckInMinutes:30,safetyStatus:'scheduled'};
  localStorage.setItem('pulse-all-plans',JSON.stringify(plans));
  localStorage.setItem('pulse-session','maya@spikedate.test');
})()`);
await reload();
await click('.tabbar button', 'Galaxy');
await verify('Plan recipient sees Accept, suggest, and decline choices', () =>
  evaluate(
    `document.querySelector('.galaxy-plan-response-tools')?.textContent.includes('Accept') && document.querySelector('.galaxy-plan-response-tools')?.textContent.includes('Suggest change') && document.querySelector('.galaxy-plan-response-tools')?.textContent.includes('Not this time')`,
  ),
);
await click('.plan-venue-vote button:nth-child(2)');
await verify('Plan recipient can vote for a meeting place', () =>
  evaluate(
    `document.querySelector('.plan-venue-vote button:nth-child(2)')?.classList.contains('selected')`,
  ),
);
await click('.galaxy-plan-response-tools button', 'Suggest change');
await verify('Recipient can enter an alternate date and time', () =>
  evaluate(
    `!!document.querySelector('[aria-label="Alternate plan date"]') && !!document.querySelector('[aria-label="Alternate plan time"]')`,
  ),
);
const alternateDate = new Date();
alternateDate.setDate(alternateDate.getDate() + 3);
await fill(
  '[aria-label="Alternate plan date"]',
  alternateDate.toISOString().slice(0, 10),
);
await fill('[aria-label="Alternate plan time"]', '19:15');
await click('.plan-alternate-editor button', 'Send option');
await verify('Alternate-time proposal appears on the shared plan', () =>
  evaluate(
    `document.querySelector('.plan-alternate-proposal')?.textContent.includes('7:15 PM')`,
  ),
);

await evaluate(`localStorage.setItem('pulse-session','demo@spikedate.app')`);
await reload();
await click('.tabbar button', 'Galaxy');
await verify('Plan creator can accept the alternate time', () =>
  evaluate(
    `document.querySelector('.plan-alternate-proposal button')?.textContent.includes('Accept new time')`,
  ),
);
await click('.plan-alternate-proposal button', 'Accept new time');
await verify('Accepted plan offers the private safety completion action', () =>
  evaluate(
    `document.querySelector('.plan-status')?.textContent.toLowerCase().includes('accepted') && document.querySelector('.plan-safe-button')?.textContent.includes('I’m safe')`,
  ),
);
await verify('Accepted plan keeps safety options one tap away', () =>
  evaluate(
    `document.querySelector('.plan-safety-options')?.textContent.includes('Safety options')`,
  ),
);
await click('.plan-safe-button');
await verify('Safety check-in can be completed from Galaxy', () =>
  evaluate(
    `document.querySelector('.galaxy-upcoming-card')?.textContent.includes('Safety check-in completed')`,
  ),
);

const passed = results.filter((item) => item.status === 'PASS').length;
const failed = results.filter((item) => item.status === 'FAIL').length;
console.log(
  JSON.stringify(
    {
      total: results.length,
      passed,
      failed,
      browserErrors: browserErrors.length,
      browserErrorDetails: browserErrors.map(
        (item) =>
          item.params?.exceptionDetails?.exception?.description ||
          item.params?.exceptionDetails?.text ||
          'Unknown runtime exception',
      ),
      failures: results.filter((item) => item.status === 'FAIL'),
    },
    null,
    2,
  ),
);
ws.close();
if (failed || browserErrors.length) process.exitCode = 1;
