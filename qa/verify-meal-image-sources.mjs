#!/usr/bin/env node
import fs from 'node:fs/promises';

const text=await fs.readFile(new URL('../data/foods.js',import.meta.url),'utf8');
const source=text.replace(/^\s*window\.DINLIMINATE_FOODS\s*=\s*/,'').replace(/;\s*$/,'');
const foods=JSON.parse(source);

const allowedHosts=new Set(['images.pexels.com','images.unsplash.com']);
const fields=['officialImage','image','backupImage','images'];

function values(item){
  const out=[];
  for(const key of fields){
    const value=item?.[key];
    if(Array.isArray(value))out.push(...value);
    else if(typeof value==='string')out.push(value);
  }
  return out.map(v=>String(v||'').trim()).filter(Boolean);
}

function host(url){
  return String(url||'').match(/^https?:\/\/([^/]+)/i)?.[1].toLowerCase().replace(/^www\./,'')||'';
}

const violations=[];
for(const item of foods){
  for(const url of values(item)){
    if(/^https?:\/\//i.test(url)&&!allowedHosts.has(host(url))){
      violations.push({id:item.id,name:item.name,host:host(url),url});
    }
  }
}

const mealsWithViolation=new Set(violations.map(x=>x.id));
console.log(JSON.stringify({
  meals:foods.length,
  approvedHosts:[...allowedHosts],
  mealsWithUnapprovedSources:mealsWithViolation.size,
  unapprovedCandidateUrls:violations.length,
  violations
},null,2));

if(violations.length)process.exitCode=1;
