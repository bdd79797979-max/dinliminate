'use strict';

const {spawnSync}=require('node:child_process');
const handler=require('../api/google-usage.js');

function call(method='GET'){
 return new Promise((resolve,reject)=>{
  const out={statusCode:200,body:null,headers:{}};
  const res={
   setHeader(k,v){out.headers[k]=v;return res;},
   status(code){out.statusCode=code;return res;},
   json(body){out.body=body;resolve(out);return res;},
   end(body){out.body=body?JSON.parse(String(body)):null;resolve(out);return res;}
  };
  Promise.resolve(handler({method},res)).catch(reject);
 });
}

(async()=>{
 const get=await call('GET');
 if(get.statusCode!==200||!get.body?.ok)throw new Error('GET /api/google-usage failed: '+JSON.stringify(get.body));
 if(get.body.readOnly!==true)throw new Error('usage endpoint must be read-only');
 const caps={'text-search-pro':4500,'nearby-search-pro':4500,'nearby-search-enterprise':900,'text-search-enterprise':900,'place-details-enterprise':900,'place-details-essentials':9000,'place-photo':900};
 for(const [sku,cap] of Object.entries(caps)){const row=get.body.skus?.find(x=>x.sku===sku);if(!row)throw new Error('missing SKU '+sku);if(Number(row.cap)!==cap)throw new Error('wrong cap for '+sku+': '+row.cap);}
 const post=await call('POST');
 if(post.statusCode!==405)throw new Error('POST should be rejected with 405');
 if(handler.pacificMonthKey(new Date('2026-10-31T06:59:59.000Z'))!=='2026-10'||handler.pacificMonthKey(new Date('2026-11-01T07:00:00.000Z'))!=='2026-11')throw new Error('Pacific billing-month boundary failed');
 if(!Number.isFinite(Date.parse(handler.nextPacificMonthIso(new Date('2026-10-15T12:00:00.000Z')))))throw new Error('next Pacific month reset is invalid');

 const child=[
  "const {reserveGoogleSku}=require('./api/google-usage');",
  "(async()=>{const a=await reserveGoogleSku('text-search-pro',4500);const b=await reserveGoogleSku('text-search-pro',4500);console.log(JSON.stringify({a,b}));})().catch(e=>{console.error(e);process.exit(2)})"
 ].join('');
 const baseEnv={...process.env,DATABASE_URL:'',POSTGRES_URL:'',FAMILY_DATABASE_URL:'',GOOGLE_BUDGET_DATABASE_URL:'',GOOGLE_PHOTO_BUDGET_DATABASE_URL:'',GOOGLE_UNTRACKED_SKU_LIMIT:'0',GOOGLE_MASTER_ENABLED:'true'};
 const blocked=spawnSync(process.execPath,['-e',child],{encoding:'utf8',env:baseEnv});
 if(blocked.status!==0)throw new Error('fail-closed child test crashed: '+blocked.stderr);
 const blockedOut=JSON.parse((blocked.stdout||'{}').trim()||'{}');
 if(blockedOut.a?.ok||blockedOut.a?.reason!=='budget-unconfigured'||blockedOut.b?.ok)throw new Error('fail-closed reservation failed: '+JSON.stringify(blockedOut));

 const capChild=["const {reserveGoogleSku}=require('./api/google-usage');","(async()=>{const x=[];for(let i=0;i<3;i++)x.push(await reserveGoogleSku('text-search-pro',2));console.log(JSON.stringify(x));})().catch(e=>{console.error(e);process.exit(2)})"].join('');
 const capped=spawnSync(process.execPath,['-e',capChild],{encoding:'utf8',env:{...baseEnv,GOOGLE_UNTRACKED_SKU_LIMIT:'2'}});
 if(capped.status!==0)throw new Error('untracked cap child test crashed: '+capped.stderr);
 const xs=JSON.parse((capped.stdout||'[]').trim()||'[]');
 if(xs.length!==3||!xs[0]?.ok||!xs[1]?.ok||xs[2]?.ok)throw new Error('untracked cap enforcement failed: '+JSON.stringify(xs));
 console.log(JSON.stringify({endpointStatus:get.statusCode,trackerStatus:get.body.status,durable:get.body.durable,skuCount:get.body.skus.length,failClosedWithoutDurableBudget:true,untrackedCapEnforced:true,monthBoundary:true}));
})().catch(err=>{console.error(err);process.exit(1)});
