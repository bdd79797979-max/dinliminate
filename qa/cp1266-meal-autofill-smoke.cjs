'use strict';

const assert=require('node:assert/strict');
const handler=require('../api/meal-autofill.js');

function makeRes(){
  return {
    statusCode:200,
    headers:{},
    body:'',
    setHeader(key,value){this.headers[key]=value;},
    end(value){this.body=String(value??'');}
  };
}
function parse(res){
  return res.body?JSON.parse(res.body):null;
}
function fakeResponse(payload,status=200,contentType='application/json'){
  return {
    ok:status>=200&&status<300,
    status,
    async json(){return payload;},
    async text(){return contentType==='text/html'?String(payload||''):JSON.stringify(payload);}
  };
}

async function main(){
  const originalFetch=global.fetch;
  const originalToken=process.env.VERCEL_OIDC_TOKEN;
  const originalModel=process.env.AI_GATEWAY_MODEL;
  process.env.VERCEL_OIDC_TOKEN='test-token';
  delete process.env.AI_GATEWAY_MODEL;

  let gatewayCalls=0;
  let photoCalls=0;
  global.fetch=async(url,options={})=>{
    const href=String(url);
    if(href.includes('ai-gateway.vercel.sh')){
      gatewayCalls++;
      const body=JSON.parse(options.body);
      assert.equal(body.model,'google/gemini-3.1-flash-lite');
      return fakeResponse({
        choices:[{message:{content:JSON.stringify({
          cuisine:['American','Not Real Cuisine'],
          mealTimes:['Lunch / Dinner','Not A Meal Time'],
          description:'Creamy chicken Alfredo pasta.',
          ingredients:['fettuccine','chicken breast','heavy cream','Parmesan cheese'],
          recipe:'Cook pasta. Cook chicken. Make the sauce. Combine and serve.',
          nutrition:{calories:650,protein:36,carbs:58,fat:29,sodium:820},
          nutritionBasis:'Typical restaurant-style serving',
          photoQueries:['Chicken Alfredo','chicken Alfredo pasta plated']
        })}}]
      });
    }
    photoCalls++;
    assert.match(href,/pexels\.com\/search\//);
    assert.equal(options.method,'GET');
    return fakeResponse(
      '<html><img src="https://images.pexels.com/photos/1234567/pexels-photo-1234567.jpeg?auto=compress&cs=tinysrgb&w=1200"></html>',
      200,
      'text/html'
    );
  };

  let res=makeRes();
  await handler({
    method:'POST',
    body:{
      name:'Chicken Alfredo',
      section:'all',
      cuisineOptions:['American','Southern','Italian'],
      mealTimeOptions:['Breakfast','Lunch / Dinner','Snacks / Desserts']
    }
  },res);
  assert.equal(res.statusCode,200);
  let data=parse(res);
  assert.equal(data.ok,true);
  assert.deepEqual(data.draft.cuisine,['American']);
  assert.deepEqual(data.draft.mealTimes,['Lunch / Dinner']);
  assert.equal(data.draft.nutrition.calories,650);
  assert.equal(data.draft.ingredients.length,4);
  assert.equal(data.photo.provider,'pexels');
  assert.match(data.photo.url,/images\.pexels\.com\/photos\/1234567/);
  assert.equal(gatewayCalls,1);
  assert.equal(photoCalls,1);

  const gatewayBefore=gatewayCalls;
  res=makeRes();
  await handler({
    method:'POST',
    body:{
      name:'Chicken Alfredo',
      section:'photo',
      cuisineOptions:['American'],
      mealTimeOptions:['Lunch / Dinner']
    }
  },res);
  assert.equal(res.statusCode,200);
  data=parse(res);
  assert.equal(data.ok,true);
  assert.equal(data.photo.provider,'pexels');
  assert.equal(gatewayCalls,gatewayBefore);
  assert.equal(photoCalls,2);

  res=makeRes();
  await handler({method:'GET',body:{}},res);
  assert.equal(res.statusCode,405);
  assert.equal(parse(res).code,'METHOD_NOT_ALLOWED');

  const normalized=handler.__test.normalizeDraft({
    cuisine:['American','Bogus'],
    mealTimes:['Lunch / Dinner','Bogus'],
    nutrition:{calories:-4,protein:20,carbs:30,fat:10,sodium:400}
  },{
    cuisineOptions:['American','Italian'],
    mealTimeOptions:['Lunch / Dinner']
  });
  assert.deepEqual(normalized.cuisine,['American']);
  assert.deepEqual(normalized.mealTimes,['Lunch / Dinner']);
  assert.equal(normalized.nutrition.calories,'');
  assert.equal(normalized.nutrition.protein,20);

  global.fetch=originalFetch;
  if(originalToken===undefined)delete process.env.VERCEL_OIDC_TOKEN;else process.env.VERCEL_OIDC_TOKEN=originalToken;
  if(originalModel===undefined)delete process.env.AI_GATEWAY_MODEL;else process.env.AI_GATEWAY_MODEL=originalModel;

  console.log('CP1266 meal autofill smoke: PASS');
}
main().catch(error=>{
  console.error('CP1266 meal autofill smoke: FAIL');
  console.error(error);
  process.exitCode=1;
});
