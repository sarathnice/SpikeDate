import { writeFile } from "node:fs/promises";

const debugPort = process.env.PULSE_DEBUG_PORT || "9224";
const baseUrl = process.env.PULSE_BASE_URL || "http://localhost:3001/";
const expectedHost = new URL(baseUrl).host;
const endpoint = await fetch(`http://127.0.0.1:${debugPort}/json`);
const pages = await endpoint.json();
const target = pages.find(
  (page) => page.type === "page" && page.url.includes(expectedHost),
);

if (!target) throw new Error("SpikeDate browser target not found");

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let sequence = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (!data.id) return;
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = async (expression) => {
  const result = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};

const waitFor = async (selector, timeout = 15000) => {
  const deadline = Date.now() + timeout;
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

const signInIfNeeded = async () => {
  if (!(await evaluate(`!!document.querySelector('.auth-card')`))) return;
  await evaluate(`(() => {
    const demo = [...document.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Use general demo'),
    );
    demo?.click();
  })()`);
  await wait(250);
  await evaluate("document.querySelector('.auth-submit')?.click()");
  await waitFor(".profile-card");
};

await command("Page.enable");
await command("Runtime.enable");
await command("Network.enable");
await evaluate("localStorage.clear()");

const devices = [
  {
    name: "iOS",
    width: 390,
    height: 844,
    output: "tests/spikedate-ios.png",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
  },
  {
    name: "Android",
    width: 412,
    height: 915,
    output: "tests/spikedate-android.png",
    userAgent:
      "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  },
];

const results = [];
for (const device of devices) {
  await command("Network.setUserAgentOverride", {
    userAgent: device.userAgent,
  });
  await command("Emulation.setDeviceMetricsOverride", {
    width: device.width,
    height: device.height,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await command("Page.reload", { ignoreCache: true });
  await wait(2200);
  await waitFor(".auth-card, .profile-card");
  await signInIfNeeded();
  await wait(900);
  await evaluate(`(() => {
    const later = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Later',
    );
    later?.click();
  })()`);
  await wait(250);
  await evaluate(`(() => {
    const later = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Later',
    );
    later?.click();
  })()`);
  await wait(200);

  const layout = await evaluate(`(() => {
    const frame = document.querySelector('.phone-frame')?.getBoundingClientRect();
    const card = document.querySelector('.profile-card')?.getBoundingClientRect();
    return {
      title: document.title,
      wordmark: document.querySelector('.wordmark')?.textContent,
      viewport: { width: innerWidth, height: innerHeight },
      frame: frame && { width: Math.round(frame.width), height: Math.round(frame.height) },
      card: card && { width: Math.round(card.width), height: Math.round(card.height) },
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`);

  if (!layout.title.includes("SpikeDate") || !layout.card) {
    throw new Error(`${device.name}: SpikeDate did not render`);
  }
  if (layout.overflow)
    throw new Error(`${device.name}: horizontal overflow detected`);
  if (layout.frame?.width !== device.width) {
    throw new Error(
      `${device.name}: app width ${layout.frame?.width} does not fit ${device.width}`,
    );
  }

  const screenshot = await command("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(device.output, Buffer.from(screenshot.data, "base64"));
  results.push({ name: device.name, ...layout, output: device.output });
}

console.log(JSON.stringify(results, null, 2));
ws.close();
