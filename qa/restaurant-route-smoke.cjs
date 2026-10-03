const assert=require('assert/strict');

async function callVercel(){
  const handler=require('../api/restaurant-search');
  let status=200, body=null;
  await handler({url:'/?mode=health',headers:{'x-forwarded-for':'qa-route-vercel'}},{
    status(code){status=code;return this;},
    json(payload){body=payload;return payload;}
  });
  return {status,body};
}

async function callNetlify(){
  const fn=require('../netlify/functions/restaurant-search');
  const out=await fn.handler({queryStringParameters:{mode:'health'},headers:{'x-forwarded-for':'qa-route-netlify'}});
  return {status:out.statusCode,body:JSON.parse(out.body)};
}

(async()=>{
  const v=await callVercel(), n=await callNetlify();
  assert.equal(v.status,200); assert.equal(v.body.ok,true); assert.equal(v.body.version,'r25');
  assert.equal(n.status,200); assert.equal(n.body.ok,true); assert.equal(n.body.version,'r25');

  const api=require('../api/restaurants');
  const rq=api._test.requestQuery;
  assert.equal(rq({url:'/?mode=search&lat=36&lon=-87&radius=10'}).get('mode'),'search');
  assert.equal(rq({query:{mode:'search',lat:'36',lon:'-87',radius:'10'}}).get('mode'),'search');
  assert.equal(rq({queryStringParameters:{mode:'suggest',q:'123'}}).get('mode'),'suggest');
  assert.equal(rq({queryStringParameters:{mode:'resolve',q:'Main%20St'}}).get('q'),'Main%20St');
  console.log('restaurant route adapters + query forwarding: PASS');
})();
