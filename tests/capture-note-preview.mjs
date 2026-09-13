import { writeFile } from 'node:fs/promises';

const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
const target = pages.find(
  (page) => page.type === 'page' && page.url.includes('localhost:3001'),
);
if (!target) throw new Error('SpikeDate preview target not found');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let sequence = 0;
const pending = new Map();
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
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
const evaluate = async (expression) => {
  const result = await command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description || 'Evaluation failed',
    );
  return result.result.value;
};
const wait = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (selector) => {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (
      await evaluate(
        `!!document.querySelector(${JSON.stringify(selector)})`,
      ).catch(() => false)
    )
      return;
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${selector}`);
};
const click = async (selector, text = '') => {
  await evaluate(
    `(() => { const nodes=[...document.querySelectorAll(${JSON.stringify(selector)})]; const node=${text ? `nodes.find((item)=>item.textContent.includes(${JSON.stringify(text)}))` : 'nodes[0]'}; if(!node) throw new Error('Missing ${selector}'); node.click(); })()`,
  );
  await wait();
};
const fill = async (selector, value) =>
  evaluate(
    `(() => { const node=document.querySelector(${JSON.stringify(selector)}); const setter=Object.getOwnPropertyDescriptor(node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set; setter.call(node,${JSON.stringify(value)}); node.dispatchEvent(new Event('input',{bubbles:true})); })()`,
  );
const capture = async (path) => {
  const shot = await command('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(path, Buffer.from(shot.data, 'base64'));
};

await command('Page.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await evaluate('localStorage.clear()');
await command('Page.reload', { ignoreCache: true });
await waitFor('.auth-card');
await fill('input[aria-label="Email"]', 'demo@spikedate.app');
await fill('input[aria-label="Password"]', 'SpikeDate2026!');
await click('.auth-submit');
await click('.action-button.super-pulse');
await click('.note-targets button', 'Lifestyle');
await fill(
  'textarea[aria-label="Profile note"]',
  'Your live-music answer made me smile.',
);
await capture('tests/spikedate-super-note.png');
await click('.note-dialog .primary-button');
await click('.incoming-button');
await capture('tests/spikedate-incoming-notes.png');
await click('.close-round');
await click('.tabbar button', 'Profile');
await capture('tests/spikedate-super-balance.png');
await click('.tabbar button', 'Spike');
await click('.profile-card');
await capture('tests/spikedate-full-profile-actions.png');
await click('.sheet-actions .action-button.like');
await capture('tests/spikedate-like-note.png');
ws.close();
