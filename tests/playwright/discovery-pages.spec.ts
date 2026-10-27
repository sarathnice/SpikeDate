import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
test.skip(({baseURL})=>!['http://127.0.0.1:3007','https://spikedate-stage.sarathnice.workers.dev'].includes(baseURL??''),'Dedicated fictional fixtures only.');
test('Any adult age and Anywhere browse beyond 100 and restore after reload',async({page,baseURL},info)=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Login',exact:true}).click();
 if(baseURL?.includes('workers.dev')){const credentials=JSON.parse(readFileSync('outputs/qa/profile-import/login.json','utf8'));await page.getByLabel('Email',{exact:true}).fill('atlanta001@spikedate.test');await page.getByLabel('Password',{exact:true}).fill(credentials.password);}
 else{await page.getByLabel('Test profile').selectOption('atlanta001@spikedate.test');await page.getByRole('button',{name:/Fill selected test login/i}).click();}
 await page.getByRole('button',{name:'Sign in to SpikeDate',exact:true}).click();
 const tools=page.getByRole('button',{name:'Open Home tools',exact:true});await expect(tools).toBeVisible();
 await expect(page.locator('.quiet-rail-home .profile-card')).toBeVisible({timeout:60000});
 const account=await(await page.request.get('/api/profile')).json();
 const location=(await(await page.request.get('/api/discovery-location')).json()).location;
 const old=account.preferences;
 try{
  await tools.click();await page.getByRole('dialog',{name:'Tools',exact:true}).getByRole('button',{name:/^Filters/}).click();
  const filters=page.getByRole('dialog',{name:'Preferences',exact:true});
  await filters.getByRole('button',{name:'Any adult age (18+)',exact:true}).click();
  await filters.getByRole('checkbox',{name:'Anywhere · all locations'}).check();
  const pages:string[]=[];page.on('request',r=>{if(r.url().includes('/api/discover?'))pages.push(r.url());});
  await filters.getByRole('button',{name:'Apply preferences',exact:true}).click();await expect(filters).toBeHidden({timeout:60000});
  expect(pages.some(url=>url.includes('cursor='))).toBe(true);
  let total=0,cursor:string|null=null;const ids=new Set<string>();
  do{const response=await page.request.get('/api/discover?limit=50'+(cursor?'&cursor='+encodeURIComponent(cursor):''));expect(response.ok()).toBe(true);const data=await response.json();expect(data.profiles.length).toBeLessThanOrEqual(50);for(const p of data.profiles){expect(ids.has(p.id)).toBe(false);ids.add(p.id);}total+=data.profiles.length;cursor=data.nextCursor;}while(cursor);
  expect(total).toBeGreaterThan(500);
  let writes=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/interactions'))writes++;});
  const names=new Set<string>();
  for(let i=0;i<120;i++){
   const name=await page.locator('.quiet-rail-home .name-row h1').textContent();expect(names.has(name!)).toBe(false);names.add(name!);
   await page.locator('.home-action-rail').getByRole('button',{name:/^Pass on /}).click();
  }
  expect(names.size).toBe(120);expect(writes).toBe(0);
  await page.reload();await expect(page.locator('.quiet-rail-home .profile-card')).toBeVisible({timeout:60000});
  await tools.click();await page.getByRole('dialog',{name:'Tools',exact:true}).getByRole('button',{name:/^Filters/}).click();
  await expect(page.getByRole('checkbox',{name:'Anywhere · all locations'})).toBeChecked();
  await expect(page.getByRole('button',{name:'Any adult age (18+)',exact:true})).toHaveAttribute('aria-pressed','true');
  await info.attach('all-profiles-filters',{body:await page.screenshot(),contentType:'image/png'});
  expect(errors).toEqual([]);
 }finally{
  if(old)await page.request.patch('/api/profile',{data:{section:'preferences',data:{genders:JSON.parse(old.genders_json),minAge:old.min_age,maxAge:old.max_age,maxDistanceKm:old.max_distance_km,relationshipGoals:JSON.parse(old.relationship_goals_json),dealbreakers:JSON.parse(old.dealbreakers_json||'[]')}}});
  if(location.mode==='city')await page.request.put('/api/discovery-location',{data:{mode:'city',city:location.city}});
  else if(location.mode==='device')await page.request.put('/api/discovery-location',{data:{mode:'device',latitude:account.profile.latitude_e6/1e6,longitude:account.profile.longitude_e6/1e6}});
  else if(location.mode==='unset')await page.request.delete('/api/discovery-location');
  else await page.request.put('/api/discovery-location',{data:{mode:location.mode}});
 }
});
