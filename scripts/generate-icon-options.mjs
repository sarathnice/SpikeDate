import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "public/brand/icon-options");
await mkdir(output, { recursive: true });
const originalPath = resolve(output, "original-gradient-1024.png");
let sourceIcon;
try {
  sourceIcon = await readFile(originalPath);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  sourceIcon = await readFile(resolve(root, "public/brand/app-icon-1024.png"));
  await writeFile(originalPath, sourceIcon);
}
const sourceDataUrl = `data:image/png;base64,${sourceIcon.toString("base64")}`;
const selectedSlug = process.argv.find((argument) => argument.startsWith("--apply="))?.split("=")[1];

const options = [
  { slug: "neon-orchid", label: "Neon Orchid", color: "#D955FF" },
  { slug: "electric-blue", label: "Electric Blue", color: "#2F6BFF" },
  { slug: "vermilion", label: "Vermilion", color: "#FF4B32" },
];

if (selectedSlug && !options.some((option) => option.slug === selectedSlug)) {
  throw new Error(`Unknown icon option: ${selectedSlug}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 980 }, deviceScaleFactor: 1 });

try {
  for (const option of options) {
    const dataUrl = await page.evaluate(async ({ sourceDataUrl, color }) => {
      const source = new Image();
      source.src = sourceDataUrl;
      await source.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1024;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(source, 0, 0);
      const image = context.getImageData(0, 0, 1024, 1024);
      const target = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
      const background = [11, 12, 18];
      for (let i = 0; i < image.data.length; i += 4) {
        const coverage = Math.max(0, Math.min(1, (image.data[i] - background[0]) / 210));
        for (let channel = 0; channel < 3; channel++) {
          image.data[i + channel] = Math.round(background[channel] * (1 - coverage) + target[channel] * coverage);
        }
        image.data[i + 3] = 255;
      }
      context.putImageData(image, 0, 0);
      return canvas.toDataURL("image/png");
    }, { sourceDataUrl, color: option.color });
    option.dataUrl = dataUrl;
    await writeFile(resolve(output, `${option.slug}-1024.png`), Buffer.from(dataUrl.split(",")[1], "base64"));
  }

  const cards = options.map(({ label, color, dataUrl }) => `
    <article class="card">
      <img class="large" src="${dataUrl}" alt="${label} icon">
      <div class="name">${label}</div>
      <div class="hex">${color} · Midnight #0B0C12</div>
      <div class="mini"><img src="${dataUrl}" alt=""><span>SpikeDate</span></div>
    </article>`).join("");

  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box} body{margin:0;background:#11131d;color:#fff;font-family:Arial,sans-serif}
    main{width:1600px;height:980px;padding:70px 82px;background:radial-gradient(circle at 50% 0%,#262239,#11131d 55%)}
    h1{margin:0;font-size:42px;font-weight:600;letter-spacing:-.04em}
    p{margin:16px 0 54px;color:#b4b8c8;font-size:20px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
    .card{min-height:660px;padding:42px 32px;border:1px solid #343743;border-radius:30px;background:#191b27;text-align:center}
    .large{width:330px;height:330px;border-radius:72px;box-shadow:0 24px 55px #0008}
    .name{margin-top:35px;font-size:28px;font-weight:600}
    .hex{margin-top:12px;color:#b9bdcb;font-size:17px}
    .mini{margin:36px auto 0;padding:20px 30px;display:flex;align-items:center;gap:20px;width:max-content;max-width:100%;background:#252936;border-radius:24px;color:#e7e8ef;font-size:20px}
    .mini img{width:70px;height:70px;border-radius:16px}
  </style></head><body><main><h1>SpikeDate · iOS icon shortlist</h1>
    <p>One solid logo color per icon · exact current silhouette · preview at large and home screen sizes</p>
    <section class="grid">${cards}</section></main></body></html>`);
  await page.screenshot({ path: resolve(output, "comparison.png") });

  if (selectedSlug) {
    const selected = options.find((option) => option.slug === selectedSlug);
    const icon1024 = Buffer.from(selected.dataUrl.split(",")[1], "base64");
    await writeFile(resolve(root, "public/brand/app-icon-1024.png"), icon1024);
    await writeFile(resolve(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"), icon1024);
    for (const size of [24, 48, 192, 512]) {
      const resized = await page.evaluate(async ({ dataUrl, size }) => {
        const source = new Image();
        source.src = dataUrl;
        await source.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const context = canvas.getContext("2d");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(source, 0, 0, size, size);
        return canvas.toDataURL("image/png");
      }, { dataUrl: selected.dataUrl, size });
      await writeFile(resolve(root, `public/brand/app-icon-${size}.png`), Buffer.from(resized.split(",")[1], "base64"));
    }
    console.log(`Applied ${selected.label} to iOS and web app icons.`);
  }
} finally {
  await browser.close();
}

console.log(`Created ${options.length} iOS icon variants and comparison preview in ${output}`);
