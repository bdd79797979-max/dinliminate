#!/usr/bin/env node
import fs from 'node:fs/promises';
import sharp from 'sharp';

const REQUIRE_TWO=process.argv.includes('--require-two');
const text=await fs.readFile(new URL('../data/foods.js',import.meta.url),'utf8');
const source=text.replace(/^\s*window\.DINLIMINATE_FOODS\s*=\s*/,'').replace(/;\s*$/,'');
const foods=JSON.parse(source);

const allowedHosts=new Set([
  'irp.cdn-website.com','www.banquet.com','images.pexels.com','images.unsplash.com',
  'commons.wikimedia.org','upload.wikimedia.org','thumb.wikimedia.org','static.spotapps.co','www.goodnes.com',
  'hips.hearstapps.com','calliesbiscuits.com','vinovoss.com','southernbite.com',
  'snapcalorie-webflow-website.s3.us-east-2.amazonaws.com','butterhearth.com',
  'slicelife.imgix.net','cdn.shopify.com','savouryflavor.com','resizer.otstatic.com',
  'kookycrunch.com','cdn.apartmenttherapy.info','www.southernliving.com',
  'shop.barebells.com','b1880159.assetcdn.net','www.mybakingaddiction.com',
  'a.fsimg.co.nz','ourstate.s3.amazonaws.com','whitneybond.com','thedailymeal.com',
  'crockncle.com','www.africanbites.com','www.foodrepublic.com','shop.camelliabrand.com',
  'parade.com','sweetasirem.com','www.sugardale.com','myhomemaderecipe.com',
  'www.finedininglovers.com','img.staticmb.com'
]);

function candidates(item){
  const out=[];
  for(const value of [item?.officialImage,item?.image,item?.backupImage,...(Array.isArray(item?.images)?item.images:[])]){
    const v=String(value||'').trim();
    if(/^https:\/\//i.test(v)&&!out.includes(v))out.push(v);
  }
  return out;
}
function looksGeneric(url=''){
  return /fallback-food|QUICK_IMAGES|hungry|neutral|placeholder|category/i.test(url);
}
async function check(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    let response=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{Accept:'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8'}});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const finalUrl=response.url||url;
    const final=new URL(finalUrl);
    if(final.protocol!=='https:'||!allowedHosts.has(final.hostname))throw new Error('redirected to unapproved host '+final.hostname);
    const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
    if(!type.startsWith('image/'))throw new Error('not an image: '+type);
    const bytes=Buffer.from(await response.arrayBuffer());
    const meta=await sharp(bytes).metadata();
    if(!meta.width||!meta.height||meta.width<240||meta.height<240)throw new Error('image too small');
    return {ok:true,finalUrl,width:meta.width,height:meta.height,bytes:bytes.length,type};
  }catch(error){return {ok:false,error:String(error?.message||error)}}
  finally{clearTimeout(timer);}
}

if(foods.length!==116)throw new Error('Expected 116 built-in meals; found '+foods.length);
if(foods.some(x=>String(x.id)==='chili-cheese-baked-potato'))throw new Error('Retired Chili Cheese Baked Potato must not return to the built-in catalog.');
if(new Set(foods.map(x=>String(x.id))).size!==foods.length)throw new Error('Duplicate built-in meal ID detected.');

let broken=0,mealsWithoutUsablePhoto=0,missingSecond=0,checked=0;
for(const item of foods){
  const list=candidates(item);
  if(!list.length){
    mealsWithoutUsablePhoto++;
    console.error('NO PHOTO\\t'+item.id+'\\t'+item.name);
    continue;
  }
  let usable=0;
  for(const url of list){
    if(looksGeneric(url)){
      broken++;
      console.error('GENERIC PHOTO\\t'+item.id+'\\t'+item.name+'\\t'+url);
      continue;
    }
    const result=await check(url);checked++;
    if(result.ok)usable++;
    else {
      broken++;
      console.error('BROKEN\\t'+item.id+'\\t'+item.name+'\\t'+url+'\\t'+result.error);
    }
  }
  if(usable===0){
    mealsWithoutUsablePhoto++;
    console.error('NO USABLE PHOTO\\t'+item.id+'\\t'+item.name);
  }
  if(usable<2)missingSecond++;
}
console.log(JSON.stringify({
 meals:foods.length,
 checked,
 brokenCandidateUrls:broken,
 mealsWithoutUsablePhoto,
 mealsWithAtLeastTwoUsableCandidates:foods.length-missingSecond,
 missingSecond,
 requireTwo:REQUIRE_TWO
},null,2));
if(mealsWithoutUsablePhoto>0)process.exitCode=1;
if(REQUIRE_TWO&&missingSecond>0)process.exitCode=2;
