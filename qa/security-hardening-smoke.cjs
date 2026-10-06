'use strict';

const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const family=fs.readFileSync(path.join(root,'api','family.js'),'utf8');
const familyStore=fs.readFileSync(path.join(root,'api','family-store.js'),'utf8');
const image=fs.readFileSync(path.join(root,'api','image.js'),'utf8');
const googlePhoto=fs.readFileSync(path.join(root,'api','google-restaurant-photo.js'),'utf8');
const restaurantPhoto=fs.readFileSync(path.join(root,'api','restaurant-photo.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const release=JSON.parse(fs.readFileSync(path.join(root,'app-release.json'),'utf8'));

function assert(name,condition,detail=''){
 if(!condition)throw new Error(name+(detail?': '+detail:''));
}

for(const [name,src] of Object.entries({family,familyStore,image,googlePhoto,restaurantPhoto})){
 try{new Function(src);}catch(e){throw new Error(name+' syntax: '+e.message);}
}

assert('Family POST-only boundary',family.includes("toUpperCase()!=='POST'"));
assert('Family JSON-only boundary',family.includes("JSON_REQUIRED")&&family.includes("application/json"));
assert('Family body size limit',family.includes("contentLength")&&family.includes("64*1024"));
assert('Family authenticated/state throttling',
 family.includes("['state'].includes(action)?120:30")&&family.includes("limited(req,action,actionLimit)")
);
assert('Family security headers',
 family.includes("Referrer-Policy','no-referrer")&&family.includes("X-Frame-Options','DENY")
);

assert('Family snapshot safe URL sanitizer',
 familyStore.includes("function safeHttpUrl")&&
 familyStore.includes("['https:','http:'].includes(u.protocol)")
);
assert('Family snapshot image sanitized',
 familyStore.includes("image: safeHttpUrl(item && item.image || '', 2000)")
);
assert('Family snapshot website sanitized',
 familyStore.includes("website: safeHttpUrl(item && item.website || '', 1200)")
);

assert('Image proxy forbids redirects',image.includes("redirect:'error'"));
assert('Image proxy has security response header',image.includes("Referrer-Policy','no-referrer"));

assert('Google restaurant photo is GET-only',googlePhoto.includes("toUpperCase()!=='GET'"));
assert('Google photo endpoint throttled',googlePhoto.includes("photoRateLimited(req"));
assert('Restaurant photo endpoint is GET-only',restaurantPhoto.includes("toUpperCase()!=='GET'"));
assert('Restaurant photo endpoint throttled',restaurantPhoto.includes("restaurantPhotoRateLimited(req"));

assert('CP1085 asset sync',
 index.includes('./app.js?v=1085')&&index.includes('./styles.css?v=1085')&&index.includes('./viewport.js?v=1085')&&
 sw.includes('dinliminate-shell-v1085')&&sw.includes('./app.js?v=1085')
);
assert('CP1085 release metadata',release.build===1085&&release.checkpoint==='CP1085'&&release.vercelProductionVerified===false);

console.log(JSON.stringify({
 ok:true,
 requestBounds:true,
 familyThrottling:true,
 safeSnapshotUrls:true,
 imageRedirectsBlocked:true,
 photoEndpointThrottling:true,
 cacheVersion:1085,
 deploymentCreated:false
},null,2));
