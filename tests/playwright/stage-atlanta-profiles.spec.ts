import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';

test.skip(({baseURL})=>baseURL!=='https://spikedate-stage.sarathnice.workers.dev','Staging fictional fixtures only.');
for(const number of [1,200]){
  test(`Atlanta staging profile ${number}: saved details and five working photos`,async({page},info)=>{
    test.setTimeout(120000);
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    const credentials=JSON.parse(readFileSync('outputs/qa/profile-import/login.json','utf8'));
    await page.goto('/');await page.getByRole('button',{name:'Login',exact:true}).click();
    await page.getByLabel('Email',{exact:true}).fill(`atlanta${String(number).padStart(3,'0')}@spikedate.test`);
    await page.getByLabel('Password',{exact:true}).fill(credentials.password);
    await page.getByRole('button',{name:'Sign in to SpikeDate',exact:true}).click();
    await expect(page.getByRole('button',{name:'Open Home tools',exact:true})).toBeVisible({timeout:30000});
    const response=await page.request.get('/api/profile');expect(response.ok()).toBe(true);
    const own=await response.json();expect(own.user.id).toBe(`demo-v2-atl-${String(number).padStart(3,'0')}`);
    expect(own.profile.verification_status).toBe('unverified');expect(own.profile.region).toBe('GA');expect(own.media).toHaveLength(5);
    for(const photo of own.media){const image=await page.request.get(photo.url);expect(image.ok()).toBe(true);expect(image.headers()['content-type']).toMatch(/^image\//);expect((await image.body()).length).toBeGreaterThan(10000);}
    const discovery=await page.request.get('/api/discover?limit=50');expect(discovery.ok()).toBe(true);
    const candidates=(await discovery.json()).profiles;
    expect(candidates.some((p:{id:string})=>p.id.startsWith('demo-v2-atl-'))).toBe(true);
    await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Profile',exact:true}).click();
    await page.getByRole('button',{name:'Preview my profile card',exact:true}).click();
    await page.getByRole('button',{name:'Open your full profile preview',exact:true}).click();
    const sheet=page.locator('.profile-preview-sheet');await expect(sheet.locator('.profile-photo-strip button')).toHaveCount(5);
    await sheet.getByRole('button',{name:'View profile photo 5',exact:true}).click();
    await expect(sheet.locator('.cinema-photo-count')).toHaveText('Photo 5 of 5');
    await expect.poll(()=>sheet.locator('.cinematic-photo-main').evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await info.attach(`atlanta-staging-${number}`,{body:await page.screenshot(),contentType:'image/png'});
    expect(errors).toEqual([]);
  });
}
