import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import sharp from 'sharp';
import { hashPassword } from '../lib/server/crypto.ts';
import { root, readManifest } from './atlanta-profile-assets.mjs';

const configPath = resolve('wrangler.profile-demo.local.jsonc');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
assert.equal(config.name, 'spikedate-profile-demo-local');
assert.equal(config.d1_databases[0].database_id, '22222222-2222-4222-8222-222222222222');
assert.equal(config.vars.SPIKEDATE_LOCAL_PROFILE_DEMO, 'true');
const manifest = readManifest();
assert.equal(manifest.kind, 'local-fictional-atlanta');
assert.equal(manifest.profiles.length, 200);
const ready = manifest.profiles.filter(p=>p.status==='ready');
const hashes = new Set();
for(const p of manifest.profiles) {
  assert.match(p.id, /^demo-v2-atl-\d{3}$/); assert.equal(p.fictional,true); assert.equal(p.verified,false);
  assert.equal(p.region,'GA'); assert.ok(p.age>=18 && p.age<=99);
  if(p.status!=='ready') { assert.equal(p.photos.length,0); continue; }
  assert.equal(p.photos.length,5);
  for(const photo of p.photos) {
    assert.ok(resolve(photo.path).startsWith(root+'\\'));
    const digest=createHash('sha256').update(readFileSync(photo.path)).digest('hex');
    assert.equal(digest,photo.sha256); assert.ok(!hashes.has(digest),'Duplicate batch photo'); hashes.add(digest);
    const meta=await sharp(photo.path).metadata(); assert.ok(meta.width>=512 && meta.height>=512);
  }
}
console.log(JSON.stringify({planned:200,ready:ready.length,distinctPhotos:hashes.size,target:'dedicated-local-only',databaseChanged:false}));
if(!process.argv.includes('--apply')) process.exit(0);
let blocked=[];
if(process.argv.includes('--exclude-safety-blocked')) {
  blocked=JSON.parse(readFileSync(join(root,'generation-blocks.json'),'utf8'));
  assert.equal(new Set(blocked.map(p=>p.number)).size,blocked.length);
  assert.ok(blocked.every(p=>p.status==='provider-safety-rejected' && p.retry===false && p.requestId));
  assert.ok(blocked.every(p=>manifest.profiles.some(item=>item.number===p.number && item.status!=='ready' && item.photos.length===0)));
}
assert.equal(ready.length+blocked.length,200,'Every set must be ready or explicitly recorded as safety-blocked; refusing unfinished import');
const reviewed=JSON.parse(readFileSync(join(root,'visual-review.json'),'utf8'));
assert.ok(ready.every(p=>reviewed.numbers.includes(p.number)),'Visual review must cover every set before import');
const credentials=JSON.parse(readFileSync('outputs/qa/profile-import/login.json','utf8'));
const passwordHash=await hashPassword(credentials.password);
const proxy=await getPlatformProxy({configPath,envFiles:[],remoteBindings:false,persist:{path:resolve('outputs/qa/profile-import/local-state/v3')}});
const digestRows=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
function birthDate(age,n) {
  const now=new Date(); const month=n%12+1; const day=n%28+1;
  const pending=month>now.getUTCMonth()+1 || (month===now.getUTCMonth()+1 && day>now.getUTCDate());
  return `${now.getUTCFullYear()-age-Number(pending)}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
try {
  const {DB:db,MEDIA:bucket}=proxy.env;
  const originals=(await db.prepare("SELECT * FROM profiles WHERE user_id NOT LIKE 'demo-v2-atl-%' ORDER BY user_id").all()).results;
  assert.ok(originals.length>=500,'Expected existing local fixture database');
  const existingNames=new Set(originals.map(p=>p.display_name));
  assert.equal(new Set(ready.map(p=>p.displayName)).size,ready.length,'Duplicate batch display names');
  assert.ok(ready.every(p=>!existingNames.has(p.displayName)),'New name duplicates an existing local profile');
  const oldMedia=(await db.prepare("SELECT COUNT(*) AS count FROM profile_media WHERE user_id NOT LIKE 'demo-v2-atl-%'").first()).count;
  writeFileSync(join(root,'pre-import-snapshot.json'),JSON.stringify({profiles:originals,photos:oldMedia},null,2));
  const now=Date.now();
  for(const [index,p] of ready.entries()) {
    for(const [pos,photo] of p.photos.entries()) {
      const key=`fictional-local-atlanta/${p.id}/${pos}.webp`;
      const existing=await bucket.head(key);
      if(existing) assert.equal(existing.customMetadata?.sourceSha256,photo.sha256,'Conflicting stored image');
      else await bucket.put(key,readFileSync(photo.path),{httpMetadata:{contentType:'image/webp'},customMetadata:{sourceSha256:photo.sha256,fictional:'true',batch:'atlanta-200'}});
    }
    const insert=(table,row)=>{
      const fields=Object.keys(row); return db.prepare(`INSERT OR IGNORE INTO ${table} (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`).bind(...Object.values(row));
    };
    const statements=[
      insert('users',{id:p.id,email:p.email,password_hash:passwordHash,status:'active',birth_date:birthDate(p.age,p.number),terms_version:'local-fictional-fixture',terms_accepted_at:now,last_active_at:null,created_at:now,updated_at:now}),
      insert('profiles',{user_id:p.id,display_name:p.displayName,gender:p.gender,pronouns:p.gender==='woman'?'she/her':'he/him',bio:p.bio,relationship_goal:p.relationshipGoal,city:p.city,region:'GA',country:'US',verification_status:'unverified',discoverable:1,discoverable_requested:1,completed_at:now,discovery_location_mode:'city',discovery_city:p.city,discovery_location_updated_at:now,latitude_e6:p.latitudeE6,longitude_e6:p.longitudeE6,occupation:['Designer','Teacher','Engineer','Chef','Researcher','Writer','Nurse','Architect','Analyst','Consultant'][index%10],education:['Bachelor’s degree','Master’s degree','Trade school','Some college'][index%4],height_cm:(p.gender==='woman'?154:165)+index%26,kids:index%5?'No kids':'Has kids',wants_kids:['Open to children','Wants kids','Does not want kids'][index%3],drinking:index%3?'Socially':'Never',smoking:'No',pets:index%2?'Has a dog':'No pets',created_at:now,updated_at:now}),
      insert('preferences',{user_id:p.id,genders_json:'[]',min_age:18,max_age:99,max_distance_km:161,relationship_goals_json:'[]',dealbreakers_json:'[]',created_at:now,updated_at:now}),
      insert('presence_preferences',{user_id:p.id,show_online:0}),
      insert('entitlement_wallets',{user_id:p.id,super_spikes:3,profile_lifts:2,weekly_lift_available:1,version:0,created_at:now,updated_at:now}),
      insert('profile_connections',{user_id:p.id,relationship_style:'Monogamy',dating_pace:index%2?'Chat first':'Meet when comfortable',communication_preference:index%2?'Texting':'Calls',values_json:JSON.stringify(['Kindness','Curiosity']),rhythm_json:'["A mix of both"]',languages_json:'["English"]',created_at:now,updated_at:now}),
      insert('profile_prompts',{id:`${p.id}-prompt`,user_id:p.id,prompt:'My favorite day off includes…',answer:`${p.interests.join(', ')} around ${p.neighborhood}.`,position:0,created_at:now,updated_at:now}),
    ];
    p.photos.forEach((photo,pos)=>statements.push(insert('profile_media',{id:`${p.id}-media-${pos}`,user_id:p.id,object_key:`fictional-local-atlanta/${p.id}/${pos}.webp`,type:'photo',position:pos,width:photo.width,height:photo.height,source_width:photo.width,source_height:photo.height,moderation_status:'approved',explicit:0,created_at:now,updated_at:now})));
    for(const label of p.interests) {
      const id=`atl-interest-${createHash('sha256').update(label).digest('hex').slice(0,16)}`;
      statements.push(insert('interests',{id,label,category:'interest'}),insert('user_interests',{user_id:p.id,interest_id:id}));
    }
    await db.batch(statements);
    if((index+1)%20===0) console.log(`Imported Atlanta profiles: ${index+1}/${ready.length}`);
  }
  const after=(await db.prepare("SELECT * FROM profiles WHERE user_id NOT LIKE 'demo-v2-atl-%' ORDER BY user_id").all()).results;
  assert.equal(digestRows(after),digestRows(originals),'Existing profiles changed');
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM profile_media WHERE user_id NOT LIKE 'demo-v2-atl-%'").first()).count,oldMedia);
  const batch=await db.prepare("SELECT (SELECT COUNT(*) FROM profiles WHERE user_id LIKE 'demo-v2-atl-%') AS profiles,(SELECT COUNT(*) FROM profile_media WHERE user_id LIKE 'demo-v2-atl-%') AS photos,(SELECT COUNT(*) FROM profiles WHERE user_id LIKE 'demo-v2-atl-%' AND verification_status!='unverified') AS verified").first();
  assert.deepEqual(batch,{profiles:ready.length,photos:ready.length*5,verified:0});
  const report={batch,planned:200,safetyBlocked:blocked.map(p=>p.number),existingProfilesUnchanged:true,localOnly:true,completedAt:new Date().toISOString()};
  writeFileSync(join(root,'import-result.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
} finally { await proxy.dispose(); }
