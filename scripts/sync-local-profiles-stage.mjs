import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {getPlatformProxy} from 'wrangler';

const apply=process.argv.includes('--apply');
const out=resolve('outputs/qa/profile-stage-sync');mkdirSync(out,{recursive:true});
const source=await getPlatformProxy({configPath:'wrangler.profile-demo.local.jsonc',envFiles:[],remoteBindings:false,persist:{path:resolve('outputs/qa/profile-import/local-state/v3')}});
const target=await getPlatformProxy({configPath:'outputs/qa/profile-import/stage-transfer.json',envFiles:[],remoteBindings:true,persist:false});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const batchPattern=/^demo-v2-(?:\d{3}|atl-\d{3})$/;
const tables=['users','profiles','preferences','presence_preferences','entitlement_wallets','profile_connections','profile_prompts','profile_media','user_interests'];
const retry=async fn=>{for(let attempt=0;;attempt++){try{return await fn();}catch(error){if(attempt>=3)throw error;await new Promise(r=>setTimeout(r,500*(attempt+1)));}}};
const oauthPath=process.platform==='win32'
  ? resolve(process.env.APPDATA || resolve(homedir(),'AppData/Roaming'),'xdg.config/.wrangler/config/default.toml')
  : resolve(process.env.XDG_CONFIG_HOME || resolve(homedir(),'.config'),'.wrangler/config/default.toml');
const auth=process.env.CLOUDFLARE_API_TOKEN || (existsSync(oauthPath) ? readFileSync(oauthPath,'utf8').match(/oauth_token\s*=\s*"([^"]+)"/)?.[1] : undefined);
assert.ok(auth,'Cloudflare authentication unavailable');
async function storage(key,bytes){
  const url='https://api.cloudflare.com/client/v4/accounts/d22cf985cee89b0a3aa4618f2cb77370/r2/buckets/spikedate-media-stage/objects/'+key.split('/').map(encodeURIComponent).join('/');
  for(let attempt=0;;attempt++){
    let response;
    try {response=await fetch(url,{method:bytes?'PUT':'GET',headers:{Authorization:'Bearer '+auth,...(bytes?{'Content-Type':'image/webp','cf-r2-data-catalog-check':'true'}:{})},...(bytes?{body:bytes}:{}),signal:AbortSignal.timeout(45000)});}
    catch(error){if(attempt>=8)throw error;await new Promise(r=>setTimeout(r,2000*(attempt+1)));continue;}
    if(response.status===404&&!bytes)return null;
    if(response.ok)return bytes?(await response.arrayBuffer(),true):new Uint8Array(await response.arrayBuffer());
    if((response.status===429||response.status>=500)&&attempt<8){await response.arrayBuffer();await new Promise(r=>setTimeout(r,Math.min(60000,Math.max(2000,Number(response.headers.get('retry-after')||0)*1000,2000*2**attempt))));continue;}
    throw Error(`Storage ${bytes?'upload':'read'} failed (${response.status}) for ${key}`);
  }
}
try {
  const local=source.env.DB,remote=target.env.DB;
  const localProfiles=(await local.prepare("SELECT p.*, u.email FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id LIKE 'demo-v2-%' ORDER BY p.user_id").all()).results;
  assert.ok(localProfiles.length>=500);assert.ok(localProfiles.every(p=>batchPattern.test(p.user_id)));
  const beforeUsers=(await remote.prepare('SELECT id,email FROM users ORDER BY id').all()).results;
  const beforeProfiles=(await remote.prepare('SELECT user_id,verification_status FROM profiles ORDER BY user_id').all()).results;
  const userIds=new Set(beforeUsers.map(u=>u.id)),profileIds=new Set(beforeProfiles.map(p=>p.user_id));
  const missing=localProfiles.filter(p=>!profileIds.has(p.user_id));
  for(const p of missing){assert.ok(!userIds.has(p.user_id),'Existing account without fixture profile needs manual review');assert.ok(!beforeUsers.some(u=>u.email===p.email),'Email collision');}
  const media=(await local.prepare("SELECT * FROM profile_media WHERE user_id LIKE 'demo-v2-%' ORDER BY user_id,position").all()).results;
  for(const p of localProfiles)assert.equal(media.filter(m=>m.user_id===p.user_id).length,5,`Expected five photos: ${p.user_id}`);
  const existingMedia=await remote.prepare("SELECT COUNT(*) AS count FROM profile_media WHERE user_id LIKE 'demo-v2-%'").first();
  const summary={sourceProfiles:localProfiles.length,sourcePhotos:media.length,stagingProfilesBefore:beforeProfiles.length,stagingFixtureProfilesBefore:beforeProfiles.filter(p=>batchPattern.test(p.user_id)).length,stagingFixturePhotosBefore:existingMedia.count,missingProfiles:missing.length,missingPhotos:missing.length*5,apply};
  console.log(JSON.stringify(summary));
  if(!apply)process.exitCode=0;
  else {
    if(!existsSync(resolve(out,'before.json')))writeFileSync(resolve(out,'before.json'),JSON.stringify({users:beforeUsers,profiles:beforeProfiles},null,2));
    const baseline=JSON.parse(readFileSync(resolve(out,'before.json'),'utf8'));
    const columns=new Map();for(const table of [...tables,'interests'])columns.set(table,new Set((await remote.prepare(`PRAGMA table_info(${table})`).all()).results.map(c=>c.name)));
    const remoteInterests=new Map((await remote.prepare('SELECT * FROM interests').all()).results.map(i=>[i.id,i]));
    const insert=(table,row)=>{
      const keys=Object.keys(row);assert.ok(keys.every(k=>columns.get(table).has(k)&&/^[a-z_][a-z0-9_]*$/.test(k)),`Schema differs for ${table}`);
      return remote.prepare(`INSERT OR IGNORE INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).bind(...keys.map(k=>row[k]));
    };
    let uploaded=0,imported=0,verifiedPhotos=0;
    const report=[];
    let cursor=0;
    await Promise.all(Array.from({length:3},async()=>{while(cursor<missing.length){
      const p=missing[cursor++];
      const photos=media.filter(m=>m.user_id===p.user_id),mapped=new Map();
      await Promise.all(photos.map(async photo=>{
        assert.equal(photo.type,'photo');assert.equal(photo.original_object_key,null);assert.equal(photo.card_object_key,null);assert.equal(photo.avatar_object_key,null);
        assert.ok(photo.object_key.startsWith('fictional-local-v2/')||photo.object_key.startsWith('fictional-local-atlanta/'));
        const key=photo.object_key.replace('fictional-local-v2/','fictional-stage-v2/').replace('fictional-local-atlanta/','fictional-stage-atlanta/');
        const object=await source.env.MEDIA.get(photo.object_key);assert.ok(object&&object.customMetadata?.fictional==='true');
        const bytes=new Uint8Array(await object.arrayBuffer()),sha=hash(bytes);
        const existing=await storage(key);
        if(existing){assert.equal(existing.length,bytes.length);assert.equal(hash(existing),sha,'Existing target image conflict');}
        else {await storage(key,bytes);uploaded++;}
        const stored=existing||await storage(key);assert.ok(stored);assert.equal(hash(stored),sha);verifiedPhotos++;
        mapped.set(photo.id,key);
      }));
      const statements=[];
      const interests=(await local.prepare('SELECT i.* FROM interests i JOIN user_interests ui ON ui.interest_id=i.id WHERE ui.user_id=?').bind(p.user_id).all()).results;
      for(const row of interests){const existing=remoteInterests.get(row.id);if(existing){assert.equal(existing.label,row.label);assert.equal(existing.category,row.category);}statements.push(insert('interests',row));}
      for(const table of tables){
        const rows=(await local.prepare(`SELECT * FROM ${table} WHERE ${table==='users'?'id':'user_id'}=?`).bind(p.user_id).all()).results;
        for(const original of rows){const row={...original};
          if(table==='users'){row.terms_version='stage-fictional-fixture';row.last_active_at=null;}
          if(table==='profiles'){row.verification_status='unverified';assert.ok(row.latitude_e6!==null&&row.longitude_e6!==null);}
          if(table==='presence_preferences')row.show_online=0;
          if(table==='profile_media')row.object_key=mapped.get(row.id);
          statements.push(insert(table,row));
        }
      }
      await retry(()=>remote.batch(statements));
      const check=await remote.prepare('SELECT COUNT(*) AS photos FROM profile_media WHERE user_id=?').bind(p.user_id).first();assert.equal(check.photos,5);
      imported++;report.push({id:p.user_id,photos:5});if(imported%10===0)console.log(`Transferred ${imported}/${missing.length} profiles; ${verifiedPhotos} photo hashes verified`);
    }}));
    const afterUsers=(await remote.prepare('SELECT id,email FROM users ORDER BY id').all()).results;
    const afterProfiles=(await remote.prepare('SELECT user_id,verification_status FROM profiles ORDER BY user_id').all()).results;
    assert.ok(beforeUsers.every(old=>afterUsers.some(u=>u.id===old.id&&u.email===old.email)));
    assert.ok(beforeProfiles.every(old=>afterProfiles.some(p=>p.user_id===old.user_id&&p.verification_status===old.verification_status)));
    assert.ok(baseline.users.every(old=>afterUsers.some(u=>u.id===old.id&&u.email===old.email)));
    assert.ok(baseline.profiles.every(old=>afterProfiles.some(p=>p.user_id===old.user_id&&p.verification_status===old.verification_status)));
    const missingAfter=localProfiles.filter(p=>!afterProfiles.some(row=>row.user_id===p.user_id));assert.equal(missingAfter.length,0);
    const totals=await remote.prepare("SELECT COUNT(DISTINCT p.user_id) AS profiles, COUNT(m.id) AS photos FROM profiles p LEFT JOIN profile_media m ON m.user_id=p.user_id WHERE p.user_id GLOB 'demo-v2-[0-9][0-9][0-9]' OR p.user_id GLOB 'demo-v2-atl-[0-9][0-9][0-9]'").first();
    assert.equal(totals.profiles,localProfiles.length);assert.equal(totals.photos,media.length);
    const result={...summary,imported,uploadedPhotos:uploaded,verifiedPhotoHashes:verifiedPhotos,totals,originalStagingProfiles:baseline.profiles.length,totalStagingProfiles:afterProfiles.length,originalAccountsPreserved:true,originalVerificationStatesPreserved:true,profiles:report,completedAt:new Date().toISOString()};
    writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,profiles:undefined}));
  }
}finally{await Promise.all([source.dispose(),target.dispose()]);}
