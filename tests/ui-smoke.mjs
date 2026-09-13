import { writeFile } from 'node:fs/promises';

const debugPort = process.env.PULSE_DEBUG_PORT || '9223';
const baseUrl = process.env.PULSE_BASE_URL || 'http://127.0.0.1:3000/';
const expectedHost = new URL(baseUrl).host;
const endpoint = await fetch(`http://127.0.0.1:${debugPort}/json`);
const pages = await endpoint.json();
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
const browserEvents = [];
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (!data.id) {
    if (
      data.method === 'Runtime.exceptionThrown' ||
      data.method === 'Runtime.consoleAPICalled'
    )
      browserEvents.push(data);
    return;
  }
  const waiter = pending.get(data.id);
  if (!waiter) return;
  pending.delete(data.id);
  if (data.error) waiter.reject(new Error(data.error.message));
  else waiter.resolve(data.result);
};
const command = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const wait = (ms = 550) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = async (expression) => {
  const result = await command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const click = async (selector, text) => {
  const expression = `(() => { const items = [...document.querySelectorAll(${JSON.stringify(selector)})]; const el = items.find((node) => node.textContent.trim().includes(${JSON.stringify(text)})); if (!el) throw new Error('Missing ${text}'); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`;
  const point = await evaluate(expression);
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  });
  await command('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  });
  await wait();
};
const clickSelector = async (selector) => {
  const point = await evaluate(
    `(() => { const el=document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Missing ${selector}'); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`,
  );
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  });
  await command('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  });
  await wait();
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await evaluate(`localStorage.clear(); localStorage.setItem('pulse-session', 'demo@spikedate.app')`);
await command('Page.reload', { ignoreCache: true });
await wait(8000);

const initial = await evaluate(
  `(() => ({ title: document.title, wordmark: document.querySelector('.wordmark')?.getAttribute('aria-label'), cards: document.querySelectorAll('.profile-card').length, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }))()`,
);
assert(
  initial.title.includes('SpikeDate'),
  'Document title is missing SpikeDate',
);
assert(initial.wordmark === 'SpikeDate', 'Wordmark did not render');
assert(initial.cards === 1, 'Discover card did not render');
assert(!initial.overflow, 'Mobile viewport has horizontal overflow');
const shot = await command('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
});
await writeFile('tests/spikedate-mobile.png', Buffer.from(shot.data, 'base64'));

await clickSelector('.profile-card');
assert(
  await evaluate(
    `document.querySelector('.profile-sheet')?.textContent.includes('Maya, 27')`,
  ),
  'Tap did not open the full profile sheet',
);
await clickSelector('.sheet-handle');
assert(
  await evaluate(
    `document.querySelector('.profile-card')?.textContent.includes('Maya, 27')`,
  ),
  'Profile sheet did not return to the same card',
);
await clickSelector('.home-action-rail .super');
assert(
  await evaluate(
    `document.querySelector('.note-dialog')?.textContent.includes('Super Spike Maya')`,
  ),
  'Super Spike composer did not appear',
);
await clickSelector('.note-dialog .note-cancel');
await clickSelector('.home-action-rail button[aria-label^="Pass on"]');
assert(
  await evaluate(
    `document.querySelector('.profile-card')?.textContent.includes('Lena, 29')`,
  ),
  'Pass did not advance the stack',
);
await command('Page.reload', { ignoreCache: false });
await wait(5000);

await click('.tabbar button', 'Galaxy');
const rooms = await evaluate(`document.querySelectorAll('.room-tile').length`);
assert(rooms >= 1, 'Expected Galaxy browse tiles');
const roomsShot = await command('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
});
await writeFile(
  'tests/spikedate-galaxy.png',
  Buffer.from(roomsShot.data, 'base64'),
);
assert(
  await evaluate(
    `document.body.textContent.includes('Start with a plan') && document.body.textContent.includes('Browse the Galaxy')`,
  ),
  'Galaxy did not show plan-first navigation',
);
await command('Page.reload', { ignoreCache: false });
await wait(5000);
await evaluate(
  `document.querySelector('button[aria-label^="Open likes center"]')?.click()`,
);
await wait();
assert(
  await evaluate(
    `document.body.textContent.includes('Accept a like to match')`,
  ),
  'Incoming did not open',
);
await command('Page.reload', { ignoreCache: false });
await wait(5000);
await click('.tabbar button', 'Profile');
await wait(1500);
await evaluate(`document.querySelector('.preview-button')?.click()`);
await wait(700);
assert(
  await evaluate(
    `document.body.textContent.includes('This is how you appear')`,
  ),
  'Profile preview did not open',
);

await command('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await command('Page.reload', { ignoreCache: false });
await wait(5000);
const desktop = await evaluate(
  `(() => ({ frameWidth: Math.round(document.querySelector('.phone-frame').getBoundingClientRect().width), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }))()`,
);
assert(
  desktop.frameWidth <= 430 && desktop.frameWidth >= 420,
  'Desktop phone frame width is incorrect',
);
assert(!desktop.overflow, 'Desktop viewport has horizontal overflow');

console.log(
  JSON.stringify(
    {
      passed: 14,
      initial,
      rooms,
      desktop,
      consoleErrors: browserEvents.filter(
        (event) => event.method === 'Runtime.exceptionThrown',
      ).length,
    },
    null,
    2,
  ),
);
ws.close();
