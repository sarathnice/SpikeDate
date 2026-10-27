import {expect,test} from '@playwright/test';

test.skip(({baseURL})=>baseURL!=='http://127.0.0.1:3007','Local fictional fixtures only.');
test('Immersive full profile: uncluttered photo, media navigation, menu, dock and safe preview',async({page},info)=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Login',exact:true}).click();
 await page.getByLabel('Test profile').selectOption('atlanta001@spikedate.test');
 await page.getByRole('button',{name:/Fill selected test login/i}).click();
 await page.getByRole('button',{name:'Sign in to SpikeDate',exact:true}).click();
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(page.getByRole('button',{name:'Open Home tools',exact:true})).toBeVisible();
 let sends=0;page.on('request',request=>{if(request.method()==='POST'&&/\/api\/(interactions|conversations|billing|daily-update|availability)/.test(request.url()))sends++;});
 for(const [width,height,native] of [[320,568,false],[390,844,false],[430,932,true]] as const){
  await page.setViewportSize({width,height});
  await page.evaluate(native=>{if(native)document.documentElement.dataset.nativePlatform='ios';else delete document.documentElement.dataset.nativePlatform;},native);
  await page.locator('.quiet-rail-home .profile-card-open').click();
  const sheet=page.locator('.immersive-cinema');await expect(sheet).toBeVisible();
  await expect(sheet.locator('.profile-film-tools,.media-hint,.media-bars,.film-count')).toHaveCount(0);
  await expect(sheet.locator('.cinema-photo-count')).toHaveText('Photo 1 of 5');
  await sheet.getByRole('button',{name:'Next profile photo',exact:true}).click();
  await expect(sheet.locator('.cinema-photo-count')).toHaveText('Photo 2 of 5');
  await sheet.getByRole('button',{name:'Previous profile photo',exact:true}).click();
  await expect(sheet.locator('.cinema-photo-count')).toHaveText('Photo 1 of 5');
  await sheet.getByRole('button',{name:'View profile photo 5',exact:true}).click();
  await expect(sheet.locator('.cinema-photo-count')).toHaveText('Photo 5 of 5');
  await expect(sheet.locator('.cinema-photo-dots span.active')).toHaveCount(1);
  await sheet.getByRole('button',{name:'View profile photo 1',exact:true}).click();
  const more=sheet.getByRole('button',{name:'More profile options',exact:true});await more.click();
  const menu=page.locator('.cinema-profile-menu');await expect(menu).toBeVisible();
  await expect(menu.getByRole('button')).toHaveCount(3);
  await expect(menu.getByRole('button',{name:/Share profile:/})).toBeEnabled();
  await expect(menu.getByRole('button',{name:/Report profile:/})).toBeEnabled();
  await expect(menu.getByRole('button',{name:/Block profile:/})).toBeEnabled();
  await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);
  await sheet.locator('.profile-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  const dock=await sheet.locator('.sheet-actions').boundingBox();
  const scroll=await sheet.locator('.profile-scroll').boundingBox();
  expect(scroll!.y+scroll!.height).toBeLessThanOrEqual(dock!.y+1);
  const last=await sheet.locator('.profile-end-actions').boundingBox();expect(last!.y+last!.height).toBeLessThanOrEqual(dock!.y+1);
  await expect(sheet.getByRole('button',{name:'Close full profile',exact:true})).toBeVisible();
  expect((await more.boundingBox())!.y).toBeGreaterThanOrEqual(native?59:0);
  await sheet.locator('.profile-scroll').evaluate(el=>{el.scrollTop=0;});
  await expect.poll(()=>sheet.locator('.cinematic-photo-main').evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await info.attach(`immersive-${width}`,{body:await page.screenshot(),contentType:'image/png'});
  await sheet.getByRole('button',{name:'Close full profile',exact:true}).click();
  await expect(sheet).toHaveCount(0);
 }
 await page.evaluate(()=>{delete document.documentElement.dataset.nativePlatform;});
 await nav.getByRole('button',{name:'Profile',exact:true}).click();
 await page.getByRole('button',{name:'Preview my profile card',exact:true}).click();
 await page.getByRole('button',{name:'Open your full profile preview',exact:true}).click();
 const preview=page.locator('.profile-preview-sheet.immersive-cinema');await expect(preview).toBeVisible();
 await preview.getByRole('button',{name:'More profile options',exact:true}).click();
 await expect(page.locator('.cinema-profile-menu')).toContainText('Your profile preview');
 for(const button of await page.locator('.cinema-profile-menu button').all())await expect(button).toBeDisabled();
 await page.keyboard.press('Escape');
 for(const button of await preview.locator('.sheet-actions button').all()){
  await button.click();await expect(preview.locator('.cinema-preview-notice')).toContainText('Preview only');
 }
 expect(sends).toBe(0);expect(errors).toEqual([]);
});
