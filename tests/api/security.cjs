'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {isForbiddenIp}=require('../../api/_lib/ssrf');
const {clientIp}=require('../../api/_lib/rateLimit');
const {HOSTS,isAllowedImageHost}=require('../../api/_lib/imageHosts');

for(const ip of ['10.0.0.8','100.64.0.8','127.0.0.1','169.254.1.1','172.16.0.1','192.168.1.1','::1','fc00::1','fd12:3456::1','fe80::1','::ffff:127.0.0.1'])assert.equal(isForbiddenIp(ip),true,ip+' must be blocked');
for(const ip of ['8.8.8.8','2001:4860:4860::8888'])assert.equal(isForbiddenIp(ip),false,ip+' must remain public');

assert.equal(clientIp({headers:{'x-vercel-forwarded-for':'203.0.113.7, 10.0.0.2'}}),'203.0.113.7');
assert.equal(clientIp({headers:{'x-forwarded-for':'203.0.113.8'},socket:{remoteAddress:'203.0.113.9'}}),'203.0.113.9');

assert.equal(isAllowedImageHost('images.pexels.com'),true);
assert.equal(isAllowedImageHost('evil.example'),false);
assert.ok(HOSTS.length>=40);

const root=path.resolve(__dirname,'../..');
const productionFiles=[];
const walk=(dir)=>{for(const name of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,name.name);if(name.isDirectory())walk(full);else if(/\.(?:js|mjs)$/.test(name.name))productionFiles.push(full);}};
walk(path.join(root,'src'));
const inner=productionFiles.flatMap(file=>fs.readFileSync(file,'utf8').split(/\\r?\\n/).filter(line=>line.includes('innerHTML')).map(line=>({file,line})));
const unsafe=inner.filter(({line})=>/\+\s*(?:String\()?\s*(?:row|item|x|m)\.(?:name|notes|message)\b/.test(line)&&!line.includes('esc('));
assert.equal(unsafe.length,0,'user-controlled innerHTML interpolation must use esc()');
const familyMain=fs.readFileSync(path.join(root,'src/features/family/index.js'),'utf8');
assert.ok(familyMain.includes(".querySelector('.family-member-copy b').textContent=String(m.name||'Family member')"));
console.log('API/UI security audit: PASS');
