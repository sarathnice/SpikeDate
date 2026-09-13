import { writeFile } from 'node:fs/promises';

const debugPort = process.env.PULSE_DEBUG_PORT || '9223';
const baseUrl = process.env.PULSE_BASE_URL || 'http://127.0.0.1:3000/';
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
let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) {
    if (message.method === 'Runtime.exceptionThrown') errors.push(message);
    return;
  }
  const item = pending.get(message.id);
  if (!item) return;
  pending.delete(message.id);
  message.error
    ? item.reject(new Error(message.error.message))
    : item.resolve(message.result);
};
const command = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const nextId = ++id;
    pending.set(nextId, { resolve, reject });
    ws.send(JSON.stringify({ id: nextId, method, params }));
  });
const wait = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = async (expression) =>
  (
    await command('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
  ).result.value;
const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const point = (selector) =>
  evaluate(
    `(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e) throw new Error('Missing ${selector}'); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`,
  );
const click = async (selector) => {
  const p = await point(selector);
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: p.x,
    y: p.y,
    button: 'left',
    clickCount: 1,
  });
  await command('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: p.x,
    y: p.y,
    button: 'left',
    clickCount: 1,
  });
  await wait();
};
const clickText = async (selector, text) => {
  const p = await evaluate(
    `(() => { const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>n.textContent.includes(${JSON.stringify(text)})); if(!e) throw new Error('Missing ${text}'); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`,
  );
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: p.x,
    y: p.y,
    button: 'left',
    clickCount: 1,
  });
  await command('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: p.x,
    y: p.y,
    button: 'left',
    clickCount: 1,
  });
  await wait();
};
const swipe = async (selector, direction) => {
  const p = await point(selector);
  const startX = p.x + (direction === 'left' ? 95 : -95);
  const endX = p.x + (direction === 'left' ? -95 : 95);
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: startX,
    y: p.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  for (let step = 1; step <= 5; step += 1) {
    await command('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: startX + ((endX - startX) * step) / 5,
      y: p.y,
      button: 'left',
      buttons: 1,
    });
  }
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
  const startX = p.x + (direction === 'left' ? 95 : -95);
  const endX = p.x + (direction === 'left' ? -95 : 95);
  await command('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: startX, y: p.y, radiusX: 4, radiusY: 4, force: 1, id: 0 },
    ],
  });
  for (let step = 1; step <= 5; step += 1) {
    await command('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: startX + ((endX - startX) * step) / 5,
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
  await wait(8000);
};

await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setTouchEmulationEnabled', {
  enabled: false,
  maxTouchPoints: 1,
});
await command('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await evaluate(`localStorage.clear(); localStorage.setItem('pulse-session', 'demo@spikedate.app')`);
await reload();

assert(
  (
    await evaluate(`document.querySelector('.profile-card')?.textContent`)
  ).includes('Maya, 27'),
  'Maya card missing',
);
await swipe('.profile-card', 'left');
assert(
  (
    await evaluate(`document.querySelector('.profile-card')?.textContent`)
  ).includes('Lena, 29'),
  'Left swipe did not advance to Lena',
);
await reload();
await command('Emulation.setTouchEmulationEnabled', {
  enabled: true,
  maxTouchPoints: 5,
});
await touchSwipe('.profile-card', 'left');
assert(
  (
    await evaluate(`document.querySelector('.profile-card')?.textContent`)
  ).includes('Lena, 29'),
  'Touch swipe did not advance to Lena',
);
await command('Emulation.setTouchEmulationEnabled', {
  enabled: false,
  maxTouchPoints: 1,
});
await reload();
await click('.profile-card');
assert(
  (
    await evaluate(`document.querySelector('.film-count')?.textContent`)
  ).includes('1 / 3'),
  'Full profile media count is wrong',
);
await click('.media-hit.next');
assert(
  (
    await evaluate(`document.querySelector('.film-count')?.textContent`)
  ).includes('2 / 3'),
  'Photo tap did not advance',
);
assert(
  await evaluate(
    `!!document.querySelector('.profile-film img[src*="maya-vinyl"]')`,
  ),
  'Second cinematic photo did not render',
);
await click('.sheet-handle');

await click('.incoming-button');
assert(
  (
    await evaluate(`document.querySelector('.incoming-subtitle')?.textContent`)
  ).includes('Accept a like to match'),
  'Likes explanation missing',
);
await click('.decision-actions .accept-like');
assert(
  (await evaluate(`document.querySelector('.match-title')?.textContent`)) ===
    'It’s a Spike',
  'Like back did not create a match',
);
await click('.icebreakers button');
assert(
  (await evaluate(
    `document.querySelector('.thread-header strong')?.textContent`,
  )) === 'Priya',
  'Match did not open the correct chat',
);
await clickText('.tabbar button', 'Profile');
await click('.profile-intent-card');
assert(
  (
    await evaluate(`document.querySelector('.flow-dialog')?.textContent`)
  ).includes('Relationship goals'),
  'Editable profile section did not open the matching registration step',
);
await click('.match-close');
await evaluate(
  `document.querySelector('.profile-account-tools .profile-quick-actions button')?.click()`,
);
await wait(800);
const planText = await evaluate(
  `document.querySelector('.subscription-dialog')?.textContent`,
);
assert(
  planText.toLowerCase().includes('mutual-match chat') &&
    planText.includes('$14.99') &&
    planText.includes('no payment is collected'),
  'Subscription details incomplete',
);
await click('.match-close');

const layout = await evaluate(
  `(() => ({overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,frame:Math.round(document.querySelector('.phone-frame').getBoundingClientRect().width)}))()`,
);
assert(
  !layout.overflow && layout.frame === 390,
  'Mobile layout overflow or width failure',
);
await clickText('.tabbar button', 'Spike');
const shot = await command('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false,
});
await writeFile(
  'tests/spikedate-expanded-mobile.png',
  Buffer.from(shot.data, 'base64'),
);
await click('.profile-card');
await click('.media-hit.next');
const galleryShot = await command('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false,
});
await writeFile(
  'tests/spikedate-profile-gallery.png',
  Buffer.from(galleryShot.data, 'base64'),
);
await click('.sheet-handle');
await clickText('.tabbar button', 'Profile');
await evaluate(
  `document.querySelector('.profile-account-tools .profile-quick-actions button')?.click()`,
);
await wait(800);
const planShot = await command('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false,
});
await writeFile(
  'tests/spikedate-subscription.png',
  Buffer.from(planShot.data, 'base64'),
);
console.log(
  JSON.stringify({ passed: 14, layout, consoleErrors: errors.length }, null, 2),
);
ws.close();
