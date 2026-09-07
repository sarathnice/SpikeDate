import { writeFile } from 'node:fs/promises';

const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
const target = pages.find((page) => page.type === 'page' && page.url.includes('localhost:3000'));
if (!target) throw new Error('PULSE browser target not found');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let sequence = 0;
const pending = new Map();
const browserErrors = [];
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) { if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message); return; }
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
};
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const wait = (ms = 520) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = async (expression) => {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Evaluation failed');
  return result.result.value;
};
const point = (selector, text) => evaluate(`(() => { const nodes=[...document.querySelectorAll(${JSON.stringify(selector)})]; const e=${text ? `nodes.find(n=>n.textContent.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}))` : 'nodes[0]'}; if(!e) throw new Error('Missing target'); e.scrollIntoView({block:'center',inline:'center'}); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
const click = async (selector, text) => {
  const p = await point(selector, text);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1, clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', buttons: 0, clickCount: 1 });
  await wait();
};
const fill = async (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e) throw new Error('Missing input'); const setter=Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set; setter.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); return e.value; })()`);
const mouseSwipe = async (selector, direction) => {
  const p = await point(selector);
  const startX = p.x + (direction === 'left' ? 96 : -96);
  const endX = p.x + (direction === 'left' ? -96 : 96);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: p.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 5; i += 1) await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX + ((endX - startX) * i) / 5, y: p.y, button: 'left', buttons: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: endX, y: p.y, button: 'left', buttons: 0, clickCount: 1 });
  await wait(700);
};
const touchSwipe = async (selector, direction) => {
  const p = await point(selector);
  const startX = p.x + (direction === 'left' ? 96 : -96);
  const endX = p.x + (direction === 'left' ? -96 : 96);
  await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: p.y, radiusX: 4, radiusY: 4, force: 1, id: 0 }] });
  for (let i = 1; i <= 5; i += 1) { await command('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX + ((endX - startX) * i) / 5, y: p.y, radiusX: 4, radiusY: 4, force: 1, id: 0 }] }); await wait(30); }
  await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(700);
};
const reload = async () => { await command('Page.reload', { ignoreCache: true }); await wait(3000); };

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
await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await command('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 });
await reload();

await verify('App title renders', () => evaluate(`document.title.includes('PULSE')`));
await verify('Mobile layout has no horizontal overflow', () => evaluate(`document.documentElement.scrollWidth===document.documentElement.clientWidth`));
await verify('Discover starts with Maya', () => evaluate(`document.querySelector('.profile-card')?.textContent.includes('Maya, 27')`));
await mouseSwipe('.profile-card', 'left');
await verify('Mouse drag left advances profile', () => evaluate(`document.querySelector('.profile-card')?.textContent.includes('Lena, 29')`));
await reload();
await command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await touchSwipe('.profile-card', 'left');
await verify('Touch swipe left advances profile', () => evaluate(`document.querySelector('.profile-card')?.textContent.includes('Lena, 29')`));
await command('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 });
await reload();

await click('.tabbar button', 'Chat');
await verify('Chat list explains mutual matches', () => evaluate(`document.body.textContent.includes('Mutual matches only')`));
await verify('Received message shows unread badge', () => evaluate(`document.querySelector('.chat-meta b')?.textContent==='2'`));
await click('.chat-row', 'Lena');
await verify('Received message opens correct thread', () => evaluate(`document.querySelector('.thread-header strong')?.textContent==='Lena'`));
await verify('Incoming message content is readable', () => evaluate(`document.querySelector('.bubble')?.textContent.includes('voice note')`));
await click('.thread-header button[aria-label="Back to chats"]');
await verify('Opening chat clears unread badge', () => evaluate(`![...document.querySelectorAll('.chat-row')].find(n=>n.textContent.includes('Lena'))?.querySelector('.chat-meta b')`));
await click('.tabbar button', 'Discover');

await click('.filter-button');
await verify('Preference filters open', () => evaluate(`document.querySelector('.filter-dialog')?.textContent.includes('Who do you want to meet?')`));
await click('.filter-dialog .choice-group button', 'Woman');
await click('.apply-filters');
await verify('Gender preference filters to men', () => evaluate(`document.querySelector('.profile-card')?.textContent.includes('Noah, 31')`));
await click('.filter-button');
await click('.filter-dialog .choice-group:nth-of-type(2) button', 'Marriage');
await click('.apply-filters');
await verify('Relationship goal filter returns Mateo', () => evaluate(`document.querySelector('.profile-card')?.textContent.includes('Mateo, 30')`));
await click('.filter-button');
await click('.filter-dialog .secondary-button', 'Reset');
await click('.apply-filters');
await verify('Reset filters restores mixed profiles', () => evaluate(`document.querySelector('.profile-card')?.textContent.includes('Maya, 27')`));

await click('.profile-card');
await verify('Full profile opens from photo tap', () => evaluate(`document.querySelector('.profile-details')?.textContent.includes('ABOUT MAYA')`));
await verify('Full profile shows family and lifestyle details', () => evaluate(`document.querySelector('.profile-details')?.textContent.includes('Wants kids') && document.querySelector('.profile-details')?.textContent.includes('Smokes')`));
await click('.media-hit.next');
await verify('Full profile advances to second photo', () => evaluate(`document.querySelector('.film-count')?.textContent.includes('2 / 3')`));
await click('.profile-share');
await verify('Share profile gives confirmation', () => evaluate(`document.querySelector('.toast.show')?.textContent.includes('Share link ready')`));
await click('.sheet-handle');

await click('.discover-screen .action-button.like');
await verify('Mutual like opens match modal', () => evaluate(`document.querySelector('.match-title')?.textContent==='It’s a Pulse'`));
await click('.match-close');
await click('.discover-screen .action-button.pass');
await click('.discover-screen .action-button.like');
await verify('Non-mutual like advances to next profile', () => evaluate(`document.querySelector('.profile-card')?.textContent.includes('Imani, 28')`));
await verify('Non-mutual like confirms sent status', () => evaluate(`document.querySelector('.toast.show')?.textContent.includes('track it in You liked')`));
await click('.incoming-button');
await verify('Likes Center shows incoming likes', () => evaluate(`document.querySelector('.likes-tabs')?.textContent.includes('Liked you')`));
await click('.likes-tabs button', 'You liked');
await verify('Sent likes history includes liked profiles', () => evaluate(`document.querySelector('.sent-likes')?.textContent.includes('Noah') && document.querySelector('.sent-likes')?.textContent.includes('Lena')`));
await click('.likes-tabs button', 'Liked you');
await click('.decision-actions button', 'Not for me');
await verify('Not for me removes incoming profile', () => evaluate(`!document.querySelector('.incoming-list')?.textContent.includes('Lena')`));
await click('.decision-actions button', 'Accept');
await verify('Accept incoming like creates match', () => evaluate(`document.querySelector('.match-title')?.textContent==='It’s a Pulse'`));
await verify('Accepted match uses correct profile', () => evaluate(`document.querySelector('.match-dialog img[alt*="Mateo"]')!==null`));
await click('.icebreakers button');
await verify('Match opens message thread', () => evaluate(`document.querySelector('.thread-header strong')?.textContent==='Mateo'`));
await verify('Icebreaker prefills message composer', () => evaluate(`document.querySelector('.composer input')?.value.length>0`));
await click('.composer button');
await verify('Message sends as outgoing bubble', () => evaluate(`document.querySelectorAll('.bubble-wrap.mine').length===1`));
await click('.bubble-wrap.mine button');
await verify('Sent message can be unsent', () => evaluate(`document.querySelectorAll('.bubble-wrap.mine').length===0`));
await click('.thread-header .shield');
await verify('Chat safety tools are one tap away', () => evaluate(`document.querySelector('.safety-dialog')?.textContent.includes('Share date details')`));
await click('[data-slot="dialog-close"]');

await click('.tabbar button', 'Profile');
await click('.profile-quick-actions button', 'registration');
await verify('Registration step 1 collects basics', () => evaluate(`!!document.querySelector('input[aria-label="First name"]') && !!document.querySelector('input[aria-label="Birthday"]')`));
await fill('input[aria-label="First name"]', 'Sam');
await click('.flow-actions .primary-button');
await verify('Registration step 2 collects identity', () => evaluate(`!!document.querySelector('select[aria-label="Ethnicity"]') && !!document.querySelector('input[aria-label="Height"]')`));
await click('.flow-actions .primary-button');
await verify('Registration step 3 collects pets and children', () => evaluate(`!!document.querySelector('select[aria-label="Pets"]') && !!document.querySelector('select[aria-label="Want children"]')`));
await click('.flow-actions .primary-button');
await verify('Registration step 4 collects lifestyle', () => evaluate(`!!document.querySelector('select[aria-label="Drinking"]') && !!document.querySelector('select[aria-label="Smoking"]')`));
await click('.flow-actions .primary-button');
await verify('Registration step 5 collects relationship goals', () => evaluate(`document.querySelector('.choice-group')?.textContent.includes('Marriage')`));
await click('.flow-actions .primary-button');
await verify('Registration step 6 limits interests', () => evaluate(`document.querySelector('.choice-group')?.textContent.includes('of 5 interests selected')`));
await click('.flow-actions .primary-button');
await verify('Registration step 7 collects two prompts', () => evaluate(`document.querySelectorAll('.prompt-fields textarea').length===2`));
await click('.flow-actions .primary-button');
await verify('Registration step 8 collects preferences', () => evaluate(`!!document.querySelector('input[aria-label="Maximum distance"]') && document.querySelector('.registration-dialog')?.textContent.includes('Show me')`));
await verify('Registration explains media limits', () => evaluate(`document.querySelector('.registration-dialog')?.textContent.includes('Up to 6 photos') && document.querySelector('.registration-dialog')?.textContent.includes('maximum 15 seconds')`));
await click('.flow-actions .primary-button');
await verify('Registration finishes end to end', () => evaluate(`document.querySelector('.self-row h1')?.textContent==='Sam' && document.querySelector('.self-row p')?.textContent.includes('100% complete')`));
await click('.primary-button.preview-button');
await verify('Card preview uses registered name', () => evaluate(`document.querySelector('.profile-card')?.textContent.includes('Sam, 28')`));
await click('.preview-banner button');
await click('.profile-quick-actions button', 'Pulse+');
await verify('Subscription details remain accessible', () => evaluate(`document.querySelector('.subscription-dialog')?.textContent.includes('$14.99')`));
await click('.match-close');

await click('.tabbar button', 'Rooms');
await click('.room-tile', 'Tonight');
await verify('Room opens filtered profile stack', () => evaluate(`document.querySelector('.room-header')?.textContent.includes('84 here now')`));
await touchSwipe('.room-card-wrap .profile-card', 'left');
await verify('Touch swipe works inside Rooms', () => evaluate(`document.querySelector('.room-card-wrap .profile-card')!==null`));
await click('.room-stack .action-button.spark');
await verify('Spark gives priority confirmation', () => evaluate(`document.querySelector('.toast.show')?.textContent.includes('Spark sent')`));

await command('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 1, mobile: true });
await reload();
await verify('Android viewport fits without overflow', () => evaluate(`document.documentElement.scrollWidth===document.documentElement.clientWidth && Math.round(document.querySelector('.phone-frame').getBoundingClientRect().width)===412`));
const shot = await command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
await writeFile('tests/pulse-complete-android.png', Buffer.from(shot.data, 'base64'));

const passed = results.filter((item) => item.status === 'PASS').length;
const failed = results.filter((item) => item.status === 'FAIL').length;
console.log(JSON.stringify({ total: results.length, passed, failed, browserErrors: browserErrors.length, failures: results.filter((item) => item.status === 'FAIL') }, null, 2));
ws.close();
if (failed || browserErrors.length) process.exitCode = 1;
