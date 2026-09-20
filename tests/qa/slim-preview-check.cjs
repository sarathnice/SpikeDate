const {chromium}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const out=path.resolve(process.env.SPIKEDATE_PREVIEW_DIR || 'outputs/qa/slim-sharp-preview');
const fragment=process.env.SPIKEDATE_PREVIEW_FRAGMENT || 'C:/Users/sarat/.codex/visualizations/2026/09/07/01a07cc5-af40-7400-ac43-a22e5174ebc9/slim-sharp-typography.html';
(async()=>{
  const browser=await chromium.launch({channel:'msedge'});
  const page=await browser.newPage({viewport:{width:900,height:1100}});
  await page.goto(process.env.SPIKEDATE_PREVIEW_URL || 'http://localhost:5418/');
  for(const [screen,name] of [['Full profile details','full-profile-side-by-side'],['Registration/edit section 1','registration-side-by-side'],['Notifications and reminders','notifications-side-by-side'],['Home','home-side-by-side']]){
    const option=await page.locator('option').evaluateAll((nodes,label)=>nodes.find(n=>n.textContent===label)?.value,screen);
    await page.selectOption('#section',option);
    await page.locator('img').evaluateAll(nodes=>Promise.all(nodes.map(n=>n.decode())));
    await page.screenshot({path:path.join(out,`${name}.png`),fullPage:true});
  }
  await page.setContent(fs.readFileSync(fragment,'utf8'));
  await page.addStyleTag({content:':root{--foreground:#10142d;--background:#fff;--border:#9ca3af}body{margin:20px}'});
  await page.evaluate(()=>document.fonts.ready);
  const optionCount=await page.locator('#spike-study-section option').count();
  let checks=0;
  for(const width of [320,736]){
    await page.setViewportSize({width,height:1000});
    for(let i=0;i<optionCount;i++){
      await page.selectOption('#spike-study-section',String(i));
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)) throw new Error(`Overflow: ${width}, option ${i}`);
      if(!await page.locator('#spike-study-proposed .spike-type-content,#spike-study-proposed input').count())throw new Error(`Empty option ${i}`);
      checks++;
    }
  }
  await page.setViewportSize({width:736,height:1000});
  await page.selectOption('#spike-study-section','6');
  await page.screenshot({path:path.join(out,'inline-study.png'),fullPage:true});
  await browser.close();
  console.log(JSON.stringify({options:optionCount,responsiveChecks:checks,passed:true}));
})().catch(error=>{console.error(error);process.exitCode=1});
