import { writeFile } from 'node:fs/promises';

const endpoint = await fetch('http://127.0.0.1:9223/json');
const pages = await endpoint.json();
const target = pages.find((page) => page.type === 'page' && page.url.includes('localhost:3000'));
if (!target) throw new Error('PULSE browser target not found');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let sequence = 0;
const pending = new Map();
const browserEvents = [];
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (!data.id) { if (data.method === 'Runtime.exceptionThrown' || data.method === 'Runtime.consoleAPICalled') browserEvents.push(data); return; }
  const waiter = pending.get(data.id);
  if (!waiter) return;
  pending.delete(data.id);
  if (data.error) waiter.reject(new Error(data.error.message)); else waiter.resolve(data.result);
};
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const wait = (ms = 550) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = async (expression) => {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const click = async (selector, text) => {
  const expression = `(() => { const items = [...document.querySelectorAll(${JSON.stringify(selector)})]; const el = items.find((node) => node.textContent.trim().includes(${JSON.stringify(text)})); if (!el) throw new Error('Missing ${text}'); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`;
  const point = await evaluate(expression);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await wait();
};
const clickSelector = async (selector) => {
  const point = await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Missing ${selector}'); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await wait();
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await command('Page.reload', { ignoreCache: true });
await wait(2600);

const initial = await evaluate(`(() => ({ title: document.title, wordmark: document.querySelector('.wordmark')?.textContent, cards: document.querySelectorAll('.profile-card').length, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }))()`);
assert(initial.title.includes('PULSE'), 'Document title is missing PULSE');
assert(initial.wordmark === 'PULSE', 'Wordmark did not render');
assert(initial.cards === 1, 'Discover card did not render');
assert(!initial.overflow, 'Mobile viewport has horizontal overflow');
const shot = await command('Page.captureScreenshot', { format: 'png', fromSurface: true });
await writeFile('tests/pulse-mobile.png', Buffer.from(shot.data, 'base64'));

await clickSelector('.profile-card');
assert(await evaluate(`document.querySelector('.profile-sheet')?.textContent.includes('Maya, 27')`), 'Tap did not open the full profile sheet');
await clickSelector('.sheet-handle');
assert(await evaluate(`document.querySelector('.profile-card')?.textContent.includes('Maya, 27')`), 'Profile sheet did not return to the same card');
await clickSelector('.discover-screen .action-button.spark');
assert(await evaluate(`document.querySelector('.toast')?.textContent.includes('Spark sent')`), 'Spark confirmation did not appear');
await clickSelector('.discover-screen .action-button.pass');
assert(await evaluate(`document.querySelector('.profile-card')?.textContent.includes('Lena, 29')`), 'Pass did not advance the stack');
await command('Page.reload', { ignoreCache: false });
await wait(900);

await click('.tabbar button', 'Rooms');
const rooms = await evaluate(`document.querySelectorAll('.room-tile').length`);
assert(rooms === 5, 'Expected five Rooms tiles');
const roomsShot = await command('Page.captureScreenshot', { format: 'png', fromSurface: true });
await writeFile('tests/pulse-rooms.png', Buffer.from(roomsShot.data, 'base64'));
await click('.room-tile', 'Tonight');
assert(await evaluate(`document.querySelector('.room-header')?.textContent.includes('84 here now')`), 'Tonight room did not open');
await evaluate(`document.querySelector('button[aria-label="Like"]')?.click()`);
await wait();
assert(await evaluate(`document.querySelector('.match-title')?.textContent === 'It’s a Pulse'`), 'Match modal did not open');
await click('.icebreakers button', 'Tacos at 8?');
assert(await evaluate(`document.querySelector('.composer input')?.value === 'Tacos at 8?'`), 'Icebreaker did not prefill chat');
await clickSelector('.composer button');
assert(await evaluate(`document.querySelectorAll('.bubble-wrap.mine').length === 1`), 'Chat message did not send');
await clickSelector('.bubble-wrap.mine button');
assert(await evaluate(`document.querySelectorAll('.bubble-wrap.mine').length === 0`), 'Unsend did not remove the message');
await evaluate(`document.querySelector('button[aria-label="Safety options"]')?.click()`);
await wait();
assert(await evaluate(`document.body.textContent.includes('Safety with Maya')`), 'Safety menu did not open');
await command('Page.reload', { ignoreCache: false });
await wait(700);
await evaluate(`document.querySelector('button[aria-label="Open incoming likes"]')?.click()`);
await wait();
assert(await evaluate(`document.body.textContent.includes('People who already chose you.')`), 'Incoming did not open');
await command('Page.reload', { ignoreCache: false });
await wait(700);
await click('.tabbar button', 'Profile');
await click('button', 'Preview my card');
assert(await evaluate(`document.body.textContent.includes('This is how you appear')`), 'Profile preview did not open');

await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await command('Page.reload', { ignoreCache: false });
await wait(700);
const desktop = await evaluate(`(() => ({ frameWidth: Math.round(document.querySelector('.phone-frame').getBoundingClientRect().width), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }))()`);
assert(desktop.frameWidth <= 430 && desktop.frameWidth >= 420, 'Desktop phone frame width is incorrect');
assert(!desktop.overflow, 'Desktop viewport has horizontal overflow');

console.log(JSON.stringify({ passed: 19, initial, rooms, desktop, consoleErrors: browserEvents.filter((event) => event.method === 'Runtime.exceptionThrown').length }, null, 2));
ws.close();
