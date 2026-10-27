import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {getPlatformProxy} from 'wrangler';
const before=JSON.parse(readFileSync('outputs/qa/profile-stage-sync/before.json','utf8'));
const manifest=JSON.parse(readFileSync('outputs/qa/atlanta-profiles/manifest.json','utf8'));
const ready=manifest.profiles.filter(p=>p.status==='ready');assert.equal(ready.length,198);
const original=JSON.parse(readFileSync('outputs/qa/profile-import/stage-transfer/bulk.json','utf8'));
const remote=await getPlatformProxy({configPath:'outputs/qa/profile-import/stage-transfer.json',envFiles:[],remoteBindings:true,persist:false});
try{
  const db=remote.env.DB;
  const counts=await db.prepare("SELECT (SELECT COUNT(*) FROM profiles WHERE user_id GLOB 'demo-v2-atl-[0-9][0-9][0-9]') AS atlantaProfiles,(SELECT COUNT(*) FROM profile_media WHERE user_id GLOB 'demo-v2-atl-[0-9][0-9][0-9]') AS atlantaPhotos,(SELECT COUNT(*) FROM profiles WHERE user_id GLOB 'demo-v2-atl-[0-9][0-9][0-9]' AND verification_status!='unverified') AS falseVerified,(SELECT COUNT(*) FROM presence_preferences WHERE user_id GLOB 'demo-v2-atl-[0-9][0-9][0-9]' AND show_online!=0) AS simulatedOnline,(SELECT COUNT(*) FROM profiles) AS allStagingProfiles").first();
  assert.equal(counts.atlantaProfiles,198);assert.equal(counts.atlantaPhotos,990);assert.equal(counts.falseVerified,0);assert.equal(counts.simulatedOnline,0);
  const users=(await db.prepare('SELECT id,email FROM users').all()).results;
  const profiles=(await db.prepare('SELECT user_id,verification_status FROM profiles').all()).results;
  assert.ok(before.users.every(old=>users.some(p=>p.id===old.id&&p.email===old.email)));
  assert.ok(before.profiles.every(old=>profiles.some(p=>p.user_id===old.user_id&&p.verification_status===old.verification_status)));
  console.log('Database counts and preservation checks passed.');
  const objects=[];
  for(const prefix of ['fictional-stage-v2/','fictional-stage-atlanta/']){
    let cursor;do{const page=await remote.env.MEDIA.list({prefix,limit:200,...(cursor?{cursor}:{})});objects.push(...page.objects);console.log(`Listed storage objects: ${objects.length}`);cursor=page.truncated?page.cursor:undefined;}while(cursor);
  }
  const byKey=new Map(objects.map(o=>[o.key,o]));
  const expected=[...original,...ready.flatMap(p=>p.photos.map((photo,index)=>({key:`fictional-stage-atlanta/${p.id}/${index}.webp`,file:photo.path})))];
  assert.equal(expected.length,3490);
  let verified=0;
  for(const photo of expected){const stored=byKey.get(photo.key);assert.ok(stored,`Missing photo: ${photo.key}`);const bytes=readFileSync(photo.file);assert.equal(stored.size,bytes.length);assert.equal(stored.etag,createHash('md5').update(bytes).digest('hex'),`Photo checksum mismatch: ${photo.key}`);if(++verified%500===0)console.log(`Verified photo checksums: ${verified}/${expected.length}`);}
  const distribution=(await db.prepare("SELECT gender,COUNT(*) AS count,COUNT(DISTINCT city) AS cities FROM profiles WHERE user_id GLOB 'demo-v2-atl-[0-9][0-9][0-9]' GROUP BY gender").all()).results;
  const result={...counts,localProfilesOnStage:698,localPhotosOnStage:3490,photoSizesAndChecksumsVerified:expected.length,originalStagingProfiles:before.profiles.length,existingAccountsPreserved:true,existingVerificationPreserved:true,distribution,checkedAt:new Date().toISOString()};
  writeFileSync(resolve('outputs/qa/profile-stage-sync/verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await remote.dispose();}
