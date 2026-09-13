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

let sequence = 0;
const pending = new Map();
const browserErrors = [];
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) {
    if (message.method === 'Runtime.exceptionThrown')
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
const wait = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));
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
const waitFor = async (expression, label) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await evaluate(expression).catch(() => false)) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
};

await command('Page.enable');
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await evaluate('localStorage.clear()');
await command('Page.reload', { ignoreCache: true });
await waitFor(
  `document.readyState==='complete' && document.querySelectorAll('select[aria-label="Test profile"] option').length===50`,
  '50-profile account gate',
);

const profiles = await evaluate(`
  [...document.querySelectorAll('select[aria-label="Test profile"] option')]
    .map((option) => ({ email: option.value, label: option.textContent.trim() }))
`);
if (profiles.length !== 50)
  throw new Error(`Expected 50 test profiles, found ${profiles.length}`);

const results = [];
for (let index = 0; index < profiles.length; index += 1) {
  const profile = profiles[index];
  try {
    await evaluate(`(() => {
      const select=document.querySelector('select[aria-label="Test profile"]');
      const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;
      setter.call(select, ${JSON.stringify(profile.email)});
      select.dispatchEvent(new Event('change',{bubbles:true}));
      return select.value;
    })()`);
    await wait();
    await evaluate(
      `document.querySelector('.test-login-panel .demo-login')?.click()`,
    );
    await wait();
    await evaluate(`document.querySelector('.auth-submit')?.click()`);
    await waitFor(
      `!!document.querySelector('.phone-frame')`,
      `${profile.label} login`,
    );
    await evaluate(`
      [...document.querySelectorAll('.tabbar button')]
        .find((button)=>button.textContent.includes('Profile'))?.click()
    `);
    await waitFor(
      `!!document.querySelector('.self-row')`,
      `${profile.label} profile`,
    );
    await waitFor(
      `[...document.images].every((image)=>image.complete && image.naturalWidth>0)`,
      `${profile.label} profile images`,
    );
    const state = await evaluate(`(() => ({
      identity: document.querySelector('.self-row')?.textContent || '',
      sections: document.querySelectorAll('.settings-list .section-edit').length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      images: [...document.images].filter((image)=>!image.complete || image.naturalWidth===0).map((image)=>image.src),
    }))()`);
    const expectedName = profile.label.split(' · ')[0];
    if (
      !state.identity.includes(profile.email) ||
      !state.identity.includes(expectedName)
    )
      throw new Error(
        'Signed-in profile identity does not match selected account',
      );
    if (state.sections !== 8)
      throw new Error(
        `Expected 8 editable registration sections, found ${state.sections}`,
      );
    if (state.overflow)
      throw new Error('Mobile viewport has horizontal overflow');
    if (state.images.length)
      throw new Error(`Broken images: ${state.images.slice(0, 2).join(', ')}`);
    results.push({ profile: profile.label, status: 'PASS' });
    await evaluate(`document.querySelector('.logout-button')?.click()`);
    await waitFor(
      `!!document.querySelector('.auth-card')`,
      `${profile.label} logout`,
    );
  } catch (error) {
    results.push({
      profile: profile.label,
      status: 'FAIL',
      detail: error.message,
    });
    await evaluate(`localStorage.removeItem('pulse-session')`).catch(() => {});
    await command('Page.reload', { ignoreCache: false });
    await waitFor(
      `!!document.querySelector('.auth-card')`,
      'recovery account gate',
    );
  }
}

const passed = results.filter((item) => item.status === 'PASS').length;
const failed = results.filter((item) => item.status === 'FAIL').length;
console.log(
  JSON.stringify(
    {
      totalProfiles: profiles.length,
      profileJourneys: results.length,
      passed,
      failed,
      browserErrors: browserErrors.length,
      failures: results.filter((item) => item.status === 'FAIL'),
    },
    null,
    2,
  ),
);
ws.close();
if (failed || browserErrors.length) process.exitCode = 1;
