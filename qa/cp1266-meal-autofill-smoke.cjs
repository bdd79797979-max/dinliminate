'use strict';

const fs=require('node:fs');
const path=require('node:path');
function staticAudit(){
 const root=path.resolve(__dirname,'..');
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
 const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
 const required=[
  'function requestMealAutofill',
  'id="editFoodAutoFill"',
  'data-meal-autofill-refresh="nutrition"',
  'data-meal-autofill-refresh="ingredients"',
  'data-meal-autofill-refresh="recipe"',
  'data-meal-autofill-refresh="cuisine"',
  'data-meal-autofill-refresh="mealTimes"',
  'data-meal-autofill-refresh="photo"',
  'Similar meal already in your library'
 ];
 for(const value of required)assert(app.includes(value),'missing frontend contract: '+value);
 for(const value of ['.meal-editor-name-row','.meal-autofill-action','.meal-autofill-refresh','.meal-autofill-status','.meal-editor-duplicate-hint'])assert(css.includes(value),'missing quiet autofill style: '+value);
 assert(!/min-height:\s*6[4-9]px/.test(css.slice(css.lastIndexOf('/* CP1266'))),'autofill controls are too large');
 assert(index.includes('?v=1269'),'index cache version');
 assert(sw.includes("dinliminate-shell-v1269"),'service worker cache version');
 assert(sw.includes('./app.js?v=1269'),'service worker app asset');
 assert(vercel.functions&&vercel.functions['api/meal-autofill.js'],'Vercel function config');
}


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
  staticAudit();

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
      '<html><img src="https://images.pexels.com/photos/1234567/pexels-photo-1234567.jpeg?auto=compress&cs=tinysrgb&w=1200"><img src="https://images.pexels.com/photos/7654321/pexels-photo-7654321.jpeg?auto=compress&cs=tinysrgb&w=1200"></html>',
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
      mealTimeOptions:['Lunch / Dinner'],
      current:{photo:'https://images.pexels.com/photos/1234567/pexels-photo-1234567.jpeg?auto=compress&cs=tinysrgb&w=1200'}
    }
  },res);
  assert.equal(res.statusCode,200);
  data=parse(res);
  assert.equal(data.ok,true);
  assert.equal(data.photo.provider,'pexels');
  assert.match(data.photo.url,/images\.pexels\.com\/photos\/7654321/);
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
