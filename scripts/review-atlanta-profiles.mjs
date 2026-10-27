import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { readManifest, root } from './atlanta-profile-assets.mjs';

const reviewedPath=join(root,'visual-review.json');
const reviewed=existsSync(reviewedPath)?JSON.parse(readFileSync(reviewedPath,'utf8')):{numbers:[1,2,3,4,5,6,101,102,103,104],note:'First ten sets reviewed in prior batches; not biometric verification.'};
const pending=readManifest().profiles.filter(p=>p.status==='ready' && !reviewed.numbers.includes(p.number));
if(process.argv.includes('--accept')) {
  const list=JSON.parse(readFileSync(join(root,'review-pages.json'),'utf8'));
  reviewed.numbers=[...new Set([...reviewed.numbers,...list.flatMap(p=>p.rows)])].sort((a,b)=>a-b);
  reviewed.updatedAt=new Date().toISOString();
  writeFileSync(reviewedPath,JSON.stringify(reviewed,null,2));
  console.log(JSON.stringify({visuallyReviewed:reviewed.numbers.length}));
} else {
  const out=join(root,'review-pages');mkdirSync(out,{recursive:true});
  const pages=[];
  for(let offset=0;offset<pending.length;offset+=8) {
    const rows=pending.slice(offset,offset+8);const tiles=[];
    for(const [r,p] of rows.entries()) for(const [c,photo] of p.photos.entries()) tiles.push({input:await sharp(photo.path).resize(160,160).toBuffer(),left:c*160,top:r*160});
    const path=join(out,`sets-${rows.map(p=>p.number).join('-')}.jpg`);
    await sharp({create:{width:800,height:rows.length*160,channels:3,background:'#161821'}}).composite(tiles).jpeg({quality:94}).toFile(path);
    pages.push({path,rows:rows.map(p=>p.number)});
  }
  writeFileSync(join(root,'review-pages.json'),JSON.stringify(pages,null,2));
  console.log(JSON.stringify(pages));
}
