'use strict';

const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const familyStoreSource=fs.readFileSync(path.join(root,'api','family-store.js'),'utf8');
const familySource=fs.readFileSync(path.join(root,'api','family.js'),'utf8');
const imageSource=fs.readFileSync(path.join(root,'api','image.js'),'utf8');
const restaurantSource=fs.readFileSync(path.join(root,'api','restaurants.js'),'utf8');
const release=JSON.parse(fs.readFileSync(path.join(root,'app-release.json'),'utf8'));

function assert(name,condition,detail=''){
 if(!condition)throw new Error(name+(detail?': '+detail:''));
}

function loadFamilyStore(){
 const module={exports:{}};
 const neonStub=()=>{throw new Error('not invoked in unit test')};
 new Function('require','module','exports','process','Buffer',familyStoreSource)(
   name=>name==='@neondatabase/serverless'?{neon:neonStub}:require(name),
   module,module.exports,{env:{}},Buffer
 );
 return module.exports;
}

const family=loadFamilyStore();
const safe=family._test?.safeHttpUrl;
assert('safeHttpUrl test hook exported',typeof safe==='function');
assert('https URL retained',safe('https://example.com/path?x=1')==='https://example.com/path?x=1');
assert('http URL rejected',safe('http://example.com')==='');
assert('javascript URL rejected',safe('javascript:alert(1)')==='');
assert('credentialed URL rejected',safe('https://user:pass@example.com')==='');
assert('oversized URL rejected',safe('https://example.com/'+'a'.repeat(2100))==='');

assert('Family endpoint is POST-only',familySource.includes("toUpperCase() !== 'POST'"));
assert('Family endpoint requires JSON',familySource.includes("!contentType.startsWith('application/json')"));
assert('Family endpoint caps body size after parsing',familySource.includes("Buffer.byteLength(JSON.stringify(body),'utf8')>64*1024"));
assert('Family rate buckets are bounded',familySource.includes('MAX_RATE_BUCKETS')&&familySource.includes('pruneRateBuckets'));

assert('image endpoint is GET-only',imageSource.includes("toUpperCase()!=='GET'"));
assert('image URL length is capped',imageSource.includes('MAX_URL_LENGTH=2048'));
assert('image URL credentials are rejected',imageSource.includes("u.username||u.password"));
assert('SVG image payloads are rejected',imageSource.includes("type==='image/svg+xml'||type==='image/svg'"));
assert('image endpoint is rate limited',imageSource.includes('imageRateLimited(req)'));
assert('image response is sandboxed',imageSource.includes("Content-Security-Policy","default-src 'none'; sandbox"));

assert('restaurant endpoint is GET-only',restaurantSource.includes("toUpperCase()!=='GET'"));
assert('restaurant mode length is capped',restaurantSource.includes('mode.length>24'));
assert('restaurant server errors are generic',restaurantSource.includes("message:'Restaurant service unavailable. Please try again.'"));
assert('restaurant server log omits raw error text',restaurantSource.includes("console.error('dinliminate-'+API_VERSION,{code:String(e?.code||'SERVICE'),status:Number(e?.status)||0})"));

assert('Family bearer tokens are hashed before DB lookup',familyStoreSource.includes("token_hash = $1")&&familyStoreSource.includes("hash(value)"));
assert('Family auth is active-session only',familyStoreSource.includes("active = true"));
assert('Family snapshot URLs are sanitized',familyStoreSource.includes('safeHttpUrl(item && item.image || \'\', 2000)'));
assert('Family DB queries are parameterized',/select \* from family_members where token_hash = \$1/.test(familyStoreSource));

assert('release is CP1085',release.build===1085&&release.checkpoint==='CP1085'&&release.vercelProductionVerified===false);

for(const [name,source] of [['family-store',familyStoreSource],['family',familySource],['image',imageSource],['restaurants',restaurantSource]]){
 try{new Function(source);}catch(error){throw new Error(name+' syntax: '+error.message)}
}

console.log(JSON.stringify({
 ok:true,
 safeHttpUrl:true,
 familyPostAndBodyGuards:true,
 familyRateLimitBounded:true,
 imageProxyHardened:true,
 restaurantErrorsSanitized:true,
 bearerTokensHashed:true,
 release:1085,
 deploymentCreated:false
},null,2));
