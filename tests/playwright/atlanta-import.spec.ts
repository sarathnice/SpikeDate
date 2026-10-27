import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test.skip(({ baseURL })=>baseURL!=='http://127.0.0.1:3007','Dedicated local fictional fixtures only.');

for(const number of [1,200]) test(`Atlanta imported profile ${number}: login, five stored photos and mobile discovery`,async({page},info)=>{
  const manifest=JSON.parse(readFileSync('outputs/qa/atlanta-profiles/manifest.json','utf8'));
  const ready=manifest.profiles.filter(p=>p.status==='ready');
  const report=JSON.parse(readFileSync('outputs/qa/atlanta-profiles/import-result.json','utf8'));
  expect(ready.length+report.safetyBlocked.length).toBe(200);
  expect(report.batch.profiles).toBe(ready.length);
  expect(report.batch.photos).toBe(ready.length*5);
  const fixture=manifest.profiles.find(p=>p.number===number);
  const credentials=JSON.parse(readFileSync('outputs/qa/profile-import/login.json','utf8'));
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button',{name:'Login',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill(fixture.email);
  await page.getByLabel('Password',{exact:true}).fill(credentials.password);
  await page.getByRole('button',{name:'Sign in to SpikeDate',exact:true}).click();
  await expect(page.getByRole('button',{name:'Open Home tools',exact:true})).toBeVisible({timeout:30000});
  for(const name of [/^Dismiss /i,/^Later$/,/^Maybe later$/]) {
    const button=page.getByRole('button',{name}).first();if(await button.isVisible())await button.click();
  }
  const infoResponse=await page.request.get('/api/demo-info');
  const counts=await infoResponse.json();expect(counts.profiles).toBeGreaterThanOrEqual(500+ready.length);expect(counts.photos).toBeGreaterThanOrEqual(2500+ready.length*5);
  const logins=await (await page.request.get('/api/demo-logins')).json();
  const added=logins.accounts.filter(p=>/^atlanta\d{3}@spikedate\.test$/.test(p.email));
  expect(added).toHaveLength(ready.length);
  expect(added.filter(p=>p.profile.gender==='woman')).toHaveLength(ready.filter(p=>p.gender==='woman').length);
  expect(added.filter(p=>p.profile.gender==='man')).toHaveLength(ready.filter(p=>p.gender==='man').length);
  const account=await (await page.request.get('/api/profile')).json();
  expect(account.user.id).toBe(fixture.id);expect(account.profile.display_name).toBe(fixture.displayName);
  expect(account.profile.verification_status).toBe('unverified');expect(account.media).toHaveLength(5);
  expect(account.profile.latitude_e6).not.toBeNull();expect(account.profile.longitude_e6).not.toBeNull();
  for(let position=0;position<5;position++) {
    const response=await page.request.get(`/api/media/${fixture.id}-media-${position}`);
    expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('image/webp');
    expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(fixture.photos[position].sha256);
  }
  const response=await page.request.get('/api/discover?limit=50');expect(response.ok()).toBe(true);
  const discovery=await response.json();expect(discovery.profiles.length).toBeGreaterThan(0);
  expect(discovery.profiles.every(p=>p.city===fixture.city && p.age>=18)).toBe(true);
  expect(discovery.profiles.some(p=>p.id.startsWith('demo-v2-atl-'))).toBe(true);
  const home=page.locator('.quiet-rail-home').first();await expect(home).toBeVisible();
  await expect.poll(()=>home.locator('.cinematic-photo-main').evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await home.locator('.profile-card-open').click();
  await expect(page.getByRole('button',{name:'Close full profile',exact:true})).toBeVisible();
  const portrait=page.locator('.profile-film .cinematic-photo-main');
  const gallery=page.locator('.profile-photo-strip img');
  await expect(gallery).toHaveCount(5);
  await expect.poll(()=>gallery.evaluateAll(images=>images.every(img=>(img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth>0)),{timeout:30000}).toBe(true);
  for(const position of [1,2,3,4,5,1]) {
    await page.getByRole('button',{name:`View profile photo ${position}`,exact:true}).click();
    await expect(portrait).toHaveAttribute('alt',new RegExp(`photo ${position}$`));
    await expect(portrait).toHaveAttribute('src',/\/api\/media\//);
    await expect.poll(()=>portrait.evaluate(img=>(img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth>0),{timeout:30000}).toBe(true);
  }
  await info.attach(`atlanta-${number}-full-profile`,{body:await page.screenshot(),contentType:'image/png'});
  await page.getByRole('button',{name:'Close full profile',exact:true}).click();
  await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Galaxy',exact:true}).click();
  await expect(page.getByRole('region',{name:'Discovery area'})).toContainText(`Near ${fixture.city}`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});
