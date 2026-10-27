import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const root = resolve('outputs/qa/atlanta-profiles');
const manifestPath = join(root, 'manifest.json');
const places = [
  ['Atlanta', 'Midtown', 33.78, -84.38, 'Piedmont Park', 'Atlanta BeltLine public art'],
  ['Atlanta', 'Old Fourth Ward', 33.76, -84.36, 'Historic Fourth Ward Park', 'a brick-lined neighborhood street'],
  ['Atlanta', 'Inman Park', 33.76, -84.35, 'a leafy Inman Park street', 'a neighborhood outdoor market'],
  ['Atlanta', 'Grant Park', 33.73, -84.37, 'Grant Park walking paths', 'a neighborhood picnic lawn'],
  ['Decatur', 'Downtown Decatur', 33.77, -84.30, 'Decatur town square', 'a quiet independent bookshop patio'],
  ['Avondale Estates', 'Avondale Estates', 33.77, -84.27, 'a leafy neighborhood lake path', 'a public arts event'],
  ['Brookhaven', 'Brookhaven', 33.87, -84.34, 'Blackburn Park', 'a neighborhood farmers market'],
  ['Chamblee', 'Chamblee', 33.89, -84.30, 'a vintage market courtyard', 'a public rail-trail path'],
  ['Dunwoody', 'Dunwoody', 33.94, -84.33, 'Brook Run Park', 'a community outdoor concert'],
  ['Sandy Springs', 'Sandy Springs', 33.93, -84.38, 'a Chattahoochee riverside path', 'an outdoor arts festival'],
  ['Roswell', 'Historic Roswell', 34.02, -84.36, 'a historic Roswell sidewalk', 'a shaded riverside park'],
  ['Alpharetta', 'Downtown Alpharetta', 34.08, -84.29, 'a downtown pedestrian square', 'a greenway walking trail'],
  ['Johns Creek', 'Johns Creek', 34.03, -84.20, 'a public garden path', 'an outdoor food festival'],
  ['Marietta', 'Marietta Square', 33.95, -84.55, 'Marietta Square', 'a shaded public garden'],
  ['Smyrna', 'Smyrna', 33.88, -84.51, 'a village green', 'the Silver Comet Trail'],
  ['Vinings', 'Vinings', 33.86, -84.47, 'a tree-lined village street', 'a riverside overlook'],
  ['Kennesaw', 'Kennesaw', 34.02, -84.62, 'a mountain-area walking trail', 'a community park'],
  ['Duluth', 'Duluth', 34.00, -84.14, 'Duluth Town Green', 'a neighborhood food market'],
  ['Peachtree Corners', 'Peachtree Corners', 33.97, -84.22, 'a public town green', 'a shaded riverside park'],
  ['Lawrenceville', 'Lawrenceville', 33.96, -83.99, 'a historic downtown square', 'a local arts courtyard'],
  ['Tucker', 'Tucker', 33.85, -84.22, 'a neighborhood walking trail', 'an outdoor community market'],
  ['Stone Mountain', 'Stone Mountain', 33.81, -84.17, 'a wooded lakeside path', 'a quiet village sidewalk'],
  ['East Point', 'East Point', 33.68, -84.44, 'a downtown mural-lined street', 'a leafy community park'],
  ['College Park', 'College Park', 33.65, -84.45, 'a historic neighborhood sidewalk', 'a local brunch patio'],
  ['Hapeville', 'Hapeville', 33.66, -84.41, 'an outdoor sculpture walk', 'a neighborhood art market'],
];
const women = 'Arielle Naomi Keisha Simone Tessa Priya Imani Elena Grace Hannah Jasmine Nia Rhea Maya Clara Leah Sophia Amara Zoe Amina Audrey Brooke Camila Daphne Elise Farah Gabrielle Hazel Iris Janelle Kira Lauren Mina Nadia Olivia Paige Quinn Renee Sabrina Tara Uma Vivian Willa Yasmin Zara Bianca Celeste Dana Eden Fiona Gloria Harper Isabel Jordan Kayla Lena Morgan Noelle Opal Parker Rachel Serena Talia Vanessa Whitney Yara Adeline Beatrice Cora Dahlia Erica Frances Giselle Helena Ingrid Joy Kiara Laila Maeve Nina Odessa Pearl Ramona Sienna Thea Valerie Willow Zuri Alexis Brianna Chloe Delia Eva Felicity Georgia Heidi Ivana Juniper Kara Lilah'.split(' ');
const men = 'Andre Marcus Devon Julian Ethan Arjun Daniel Omar Miles Wesley Adrian Bennett Caleb Darius Elliot Felix Gabriel Henry Isaac Jamal Kai Leo Mateo Nathan Oscar Peter Quincy Rafael Samuel Theo Victor Wyatt Xavier Yusuf Zachary Aaron Blake Cameron Dominic Emmett Finn Gavin Hassan Ian Joel Kevin Landon Malcolm Nolan Oliver Preston Reid Sebastian Tristan Umar Vincent Warren Zane Adrian Brooks Carter Donovan Ellis Franklin Graham Hugo Idris Jonas Kendrick Lawrence Maxwell Nico Orion Philip Raymond Silas Tobias Vaughn William Yusuf Asher Bryce Colin Desmond Ezra Forrest Grant Holden Imran Jared Kellan Luis Micah Noel Owen Paxton Remy Stefan Troy Wesley'.split(' ');
const interests = ['Live music', 'Hiking', 'Cooking', 'Art', 'Reading', 'Cycling', 'Photography', 'Tennis', 'Food markets', 'Movies', 'Gardening', 'Dancing', 'Travel', 'Board games', 'Coffee', 'Running', 'Pets', 'Museums', 'Volunteering', 'Yoga'];
const appearances = ['Black with deep brown skin', 'white with freckled fair skin', 'South Asian with warm medium-brown skin', 'Latino with olive skin', 'East Asian with light-medium skin', 'Black with golden-brown skin', 'white with warm olive skin', 'Southeast Asian with warm tan skin', 'Middle Eastern with medium olive skin', 'mixed heritage with light-brown skin'];
const shapes = ['oval face and a small tooth gap', 'square jaw and wide-set eyes', 'round face and a dimple', 'long face and prominent brows', 'heart-shaped face and light freckles', 'broad face and a distinctive nose', 'angular cheekbones and deep-set eyes', 'soft jaw and a slightly crooked smile'];
const palettes = ['ivory', 'rust', 'indigo', 'sage', 'plum', 'mustard', 'cobalt', 'forest green', 'burgundy', 'terracotta', 'teal', 'dusty rose', 'chocolate', 'navy', 'charcoal', 'pale blue', 'olive', 'lavender', 'sand', 'coral'];
const garments = ['linen shirt', 'textured cardigan', 'light rain jacket', 'striped knit top', 'casual denim jacket', 'cotton sweater', 'chambray button-up', 'sporty windbreaker', 'crewneck sweatshirt', 'casual overshirt', 'lightweight blazer', 'patterned short-sleeve shirt', 'cable-knit sweater', 'cotton polo', 'casual utility jacket'];
const scenes = ['clear shoulder-up portrait with a relaxed smile', 'full-length candid walking, looking off to one side', 'seated candid laughing naturally', 'three-quarter candid browsing a local stall', 'half-body portrait with a calm thoughtful expression'];
const hobbies = ['finding a new walking route', 'trying a new recipe', 'catching a small live show', 'exploring a weekend market', 'a relaxed museum afternoon', 'a neighborhood bike ride', 'a good board-game night', 'working on a photography project', 'an early tennis game', 'a long chat over coffee'];

export function generateManifest() {
  assert.ok(women.length >= 100 && men.length >= 100);
  return { kind: 'local-fictional-atlanta', count: 200, photosPerProfile: 5, profiles: Array.from({ length: 200 }, (_, i) => {
    const woman = i < 100;
    const n = i + 1;
    const [city, neighborhood, lat, lon, sceneA, sceneB] = places[i % places.length];
    const age = n === 1 ? 32 : 24 + ((i * 17) % 42);
    const name = ({ 42: 'Vivian Beckham', 45: 'Zara Bellamy', 57: 'Morgan Clarke', 78: 'Laila Dawson', 180: 'Yusuf Hassan' })[n]
      || `${(woman ? women : men)[i % 100]} ${String.fromCharCode(65 + Math.floor(i / 25))}.`;
    const identity = n === 1 ? '32-year-old Black woman with a short natural curly tapered haircut, warm deep brown skin, oval face, prominent cheekbones, small gap between front teeth and average build'
      : `${age}-year-old ${appearances[(i * 7) % appearances.length]} ${woman ? 'woman' : 'man'} with ${shapes[(i * 3) % shapes.length]}, ${woman ? ['long braids', 'a cropped curly haircut', 'a chin-length bob', 'shoulder-length waves', 'a loose bun', 'short silver curls', 'a side-parted pixie cut', 'a long dark braid'][Math.floor(i / 3) % 8] : ['a close crop and neat beard', 'short curls and no beard', 'a shaved head and a moustache', 'wavy hair and light stubble', 'salt-and-pepper hair and glasses', 'long hair tied back', 'short straight hair and no beard', 'receding hairline and a short beard'][Math.floor(i / 3) % 8]}, ${['lean', 'average', 'athletic', 'curvy', 'stocky', 'tall broad-shouldered', 'petite', 'soft rounded'][Math.floor(i / 5) % 8]} build, ${i % 4 === 0 ? 'subtle wireframe glasses' : 'no glasses'}`;
    const outfit = Array.from({ length: 5 }, (_, p) => `${palettes[(i * 7 + p * 3) % palettes.length]} ${garments[(i * 3 + p * 4) % garments.length]}, with different appropriate trousers or skirt and shoes`);
    const locations = [sceneA, sceneB, `${neighborhood} outdoor seating`, 'an Atlanta metro public garden', 'an Atlanta metro outdoor music event'];
    const photoBriefs = scenes.map((scene, p) => `${p + 1}. ${scene} at ${locations[(p + i) % 5]}; ${outfit[p]}; ${['morning daylight', 'bright overcast light', 'warm afternoon sunlight', 'soft indoor window light', 'blue-hour ambient light'][(p + i) % 5]}`);
    const prompt = `Use case: photorealistic-natural. Create ONE vertical contact sheet, exactly TWO equal columns and THREE equal rows of square cells. No borders, gutters, labels or text. The first FIVE cells in reading order are distinct natural personal photographs of the SAME entirely fictional ${identity}. Sixth bottom-right cell completely blank flat charcoal.\n${photoBriefs.join('\n')}\nKeep exactly the same recognizable face, adult age, hair and build in every occupied cell. Different days, clothes, poses, settings, angles and camera distances. Atlanta metropolitan Georgia settings, everyday phone-camera realism, skin texture and fabric wrinkles. Mostly candid friend-shot images; at most one selfie. No glamour filters, real-person likenesses, prominent other people, logos or watermarks. Local fictional dating-app test assets, not real members.`;
    return { number: n, id: `demo-v2-atl-${String(n).padStart(3, '0')}`, email: `atlanta${String(n).padStart(3, '0')}@spikedate.test`, displayName: name, gender: woman ? 'woman' : 'man', age, city, neighborhood, region: 'GA', latitudeE6: Math.round(lat * 1e6), longitudeE6: Math.round(lon * 1e6), relationshipGoal: ['Long-term', 'Dating', 'Marriage', 'Short-term'][i % 4], bio: `${neighborhood} is home. My kind of weekend is ${hobbies[i % hobbies.length]} and ${hobbies[(i + 3) % hobbies.length]}. ${['I appreciate curiosity and a good sense of humor.', 'Looking for easy conversation and shared adventures.', 'Tell me about a place you love around Atlanta.', 'A little kindness goes a long way with me.'][Math.floor(i / 4) % 4]}`, interests: [interests[i % 20], interests[(i + 5) % 20], interests[(i + 11) % 20]], fictional: true, verified: false, status: 'awaiting-images', photos: [], prompt };
  }).map(p => ({ ...p, bio: `I'm ${p.displayName} — ${p.bio}` })) };
}

export function readManifest() { return JSON.parse(readFileSync(manifestPath, 'utf8')); }

async function main() {
  const [command, number, file] = process.argv.slice(2);
  if (command === 'prepare') {
    mkdirSync(root, { recursive: true });
    if (!existsSync(manifestPath)) writeFileSync(manifestPath, JSON.stringify(generateManifest(), null, 2));
    const m = readManifest();
    console.log(JSON.stringify({ profiles: m.profiles.length, ready: m.profiles.filter(p => p.status === 'ready').length, root }));
  } else if (command === 'refresh-metadata') {
    const m = readManifest(); const fresh = generateManifest();
    for (const p of m.profiles) {
      const next = fresh.profiles.find(item => item.id === p.id);
      p.displayName = next.displayName; p.bio = next.bio;
    }
    writeFileSync(manifestPath, JSON.stringify(m, null, 2));
    console.log(JSON.stringify({ profiles: m.profiles.length, distinctBios: new Set(m.profiles.map(p=>p.bio)).size }));
  } else if (command === 'prompt') {
    const p = readManifest().profiles.find(p => p.number === Number(number));
    assert.ok(p); console.log(p.prompt);
  } else if (command === 'ingest') {
    const m = readManifest(); const p = m.profiles.find(p => p.number === Number(number)); assert.ok(p);
    if (p.status === 'ready') { console.log(JSON.stringify({ number: p.number, skipped: 'already ready' })); return; }
    const source = resolve(file); assert.ok(source.startsWith(resolve('C:/Users/sarat/.codex/generated_images') + '\\'));
    const out = join(root, p.id); mkdirSync(out, { recursive: true });
    const sourceHash = createHash('sha256').update(readFileSync(source)).digest('hex').slice(0, 12);
    const sheet = join(out, `contact-sheet-${sourceHash}.png`); if (!existsSync(sheet)) copyFileSync(source, sheet);
    const meta = await sharp(sheet).metadata();
    assert.ok(meta.width >= 1024 && meta.height >= 1536);
    assert.equal(meta.width / 2, meta.height / 3, 'Expected 2 by 3 square cells');
    const size = meta.width / 2; p.photos = [];
    for (let pos = 0; pos < 5; pos++) {
      const bytes = await sharp(sheet).extract({ left: (pos % 2) * size, top: Math.floor(pos / 2) * size, width: size, height: size }).webp({ quality: 92 }).toBuffer();
      const path = join(out, `${pos + 1}.webp`); writeFileSync(path, bytes);
      p.photos.push({ path, sha256: createHash('sha256').update(bytes).digest('hex'), width: size, height: size });
    }
    p.status = 'ready'; p.contactSheetPath = sheet; writeFileSync(manifestPath, JSON.stringify(m, null, 2));
    console.log(JSON.stringify({ number: p.number, ready: m.profiles.filter(p => p.status === 'ready').length, photos: p.photos.length }));
  } else if (command === 'pending') {
    const m = readManifest();
    const women = m.profiles.filter(p => p.status !== 'ready' && p.gender === 'woman');
    const men = m.profiles.filter(p => p.status !== 'ready' && p.gender === 'man');
    const ordered = []; while (women.length || men.length) { if (men.length) ordered.push(men.shift().number); if (women.length) ordered.push(women.shift().number); }
    console.log(JSON.stringify(ordered));
  } else if (command === 'status') {
    const m = readManifest(); console.log(JSON.stringify({ planned: m.profiles.length, ready: m.profiles.filter(p => p.status === 'ready').length, photos: m.profiles.reduce((n,p)=>n+p.photos.length,0) }));
  } else throw new Error('Use prepare, prompt NUMBER, ingest NUMBER GENERATED_IMAGE, or status.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
