import { expect, test } from '@playwright/test';

test.skip(({baseURL})=>baseURL!=='http://127.0.0.1:3007','Local fixtures only.');
test('Own preview matches Home geometry and controls without sending actions',async({page},info)=>{
  test.setTimeout(180000);
  await page.goto('/');
  await page.getByRole('button',{name:'Login',exact:true}).click();
  await page.getByLabel('Test profile').selectOption('atlanta001@spikedate.test');
  await page.getByRole('button',{name:/Fill selected test login/i}).click();
  await page.getByRole('button',{name:'Sign in to SpikeDate',exact:true}).click();
  const nav=page.getByRole('navigation',{name:'Primary navigation'});
  await expect(page.getByRole('button',{name:'Open Home tools',exact:true})).toBeVisible();
  const account=await (await page.request.get('/api/profile')).json();
  const birth=new Date(`${account.birthDate}T00:00:00`),now=new Date();
  const age=now.getFullYear()-birth.getFullYear()-Number(now.getMonth()<birth.getMonth() || (now.getMonth()===birth.getMonth() && now.getDate()<birth.getDate()));
  let writes=0;
  page.on('request',request=>{if(request.method()==='POST' && /\/api\/(interactions|conversations|billing|daily-update|availability)/.test(request.url()))writes++;});
  const measure=async()=>page.locator('.quiet-rail-home').evaluate(root=>{
    const selectors=['.profile-card','.card-content','.name-row h1','.home-action-rail','.home-action-rail button','.cinematic-photo-main'];
    return selectors.map(selector=>{
      const el=root.querySelector(selector)!;const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
      return {selector,x:rect.x,y:selector==='.name-row h1'?0:rect.y,bottom:rect.bottom,width:selector==='.name-row h1'?0:rect.width,height:selector==='.card-content'||selector==='.name-row h1'?0:rect.height,fontSize:style.fontSize,borderRadius:style.borderRadius,objectFit:style.objectFit};
    });
  });
  for(const width of [320,390,430]){
    await page.setViewportSize({width,height:844});
    await nav.getByRole('button',{name:'Spike',exact:true}).click();
    await expect(page.locator('.quiet-rail-home')).toBeVisible();
    const home=await measure();
    await nav.getByRole('button',{name:'Profile',exact:true}).click();
    await page.getByRole('button',{name:'Preview my profile card',exact:true}).click();
    const preview=page.locator('.preview-screen');await expect(preview).toBeVisible();
    await expect(preview.locator('.name-row h1')).toHaveText(`${account.profile.display_name}, ${age}`);
    await expect(preview.getByLabel('Photo Verified',{exact:true})).toHaveCount(['photo_verified','identity_verified'].includes(account.profile.verification_status)?1:0);
    const actual=await measure();
    // Content height differs naturally with bio length; align its bottom edge instead.
    for(let i=0;i<home.length;i++){
      for(const key of ['x','width','height'] as const)expect(actual[i][key],`${width} ${home[i].selector} ${key}`).toBeCloseTo(home[i][key],0);
      if(home[i].selector!=='.card-content')expect(actual[i].y,`${width} ${home[i].selector} y`).toBeCloseTo(home[i].y,0);
      if(home[i].selector==='.card-content')expect(actual[i].bottom).toBeCloseTo(home[i].bottom,0);
      for(const key of ['fontSize','borderRadius','objectFit'] as const)expect(actual[i][key]).toBe(home[i][key]);
    }
    await expect(preview.locator('.home-today-tools')).toHaveCount(0);
    await expect(preview.locator('.profile-photo-brand')).toHaveCount(0);
    const edit=await preview.getByRole('button',{name:'Edit card',exact:true}).boundingBox();
    const tools=preview.getByRole('button',{name:'Open Home tools',exact:true});
    const toolsBox=await tools.boundingBox();expect(edit!.x+edit!.width).toBeLessThanOrEqual(toolsBox!.x);
    for(const button of await preview.locator('.home-action-rail button').all()){
      await button.click();await expect(preview.locator('.preview-action-feedback')).toContainText('Preview only');
    }
    for(const label of ['Filters','Announcements','Boost / Profile Lift','Calendar & Today','Fresh Moments']){
      await tools.click();await page.locator('.home-tools-list > button').filter({hasText:label}).click();
      await expect(preview.locator('.preview-action-feedback')).toContainText('Preview only');
    }
    await expect.poll(()=>preview.locator('.cinematic-photo-main').evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await info.attach(`preview-${width}`,{body:await page.screenshot(),contentType:'image/png'});
    await preview.getByRole('button',{name:'Open your full profile preview',exact:true}).click();
    await expect(page.locator('.profile-preview-sheet')).toBeVisible();
    await page.getByRole('button',{name:'Close full profile',exact:true}).click();
    await preview.getByRole('button',{name:'Back to profile',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  expect(writes).toBe(0);
});
