import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../data/foods.js',import.meta.url),'utf8');
const sandbox={window:{},self:{},globalThis:{}};
vm.createContext(sandbox); vm.runInContext(src,sandbox);
const foods=sandbox.window.DINLIMINATE_FOODS||[];
assert.equal(foods.length,116,'Food image smoke requires the 116-food catalog');
const foodUrls=foods.map(x=>String(x.image||'').trim());
assert.equal(foodUrls.length,116,'Each of the 116 built-in foods should be present in the image audit');
assert.equal(foodUrls.filter(x=>/^https?:\/\//.test(x)).length,116,'Each of the 116 built-in foods should have an external image URL');
const urls=[...new Set(foodUrls.filter(x=>/^https?:\/\//.test(x)))];

const bad=[];
let cursor=0;
async function worker(){
  while(true){
    const i=cursor++; if(i>=urls.length)return;
    const url=urls[i];
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),7000);
    try{
      const res=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'User-Agent':'Dinliminate-Image-QA/1.0'}});
      if(!res.ok)bad.push({url,status:res.status});
      else {
        const type=String(res.headers.get('content-type')||'');
        if(!type.startsWith('image/'))bad.push({url,status:res.status,type});
      }
    }catch(e){bad.push({url,error:String(e?.message||e)});}
    finally{clearTimeout(timer);}
  }
}
await Promise.all(Array.from({length:8},()=>worker()));
assert.equal(bad.length,0,'Broken food image URLs: '+JSON.stringify(bad.slice(0,12)));
console.log(JSON.stringify({foodCount:foods.length,checked:urls.length,broken:bad.length}));

const expected={tacos:/14179985/, 'stir-fry':/31673757/, meatloaf:/2397401/, 'buttermilk-cornbread':/6525832/, 'potato-soup':/29653177\//, 'stuffed-peppers':/goodnes\.com.*stouffers-hwe4pryaocyufr0fchw5/i, stroganoff:/20234576/, 'health-shake':/7974814/, lasagna:/29174061/, 'vegetable-lasagna':/5864352/, 'grilled-salmon':/14542171/, 'bbq-pulled-pork':/7181419/, 'homemade-pizza':/7813574/, 'meatball-subs':/commons.wikimedia.org.*Meatball_Sub/i, 'sausage-peppers':/38085038/, 'pork-chops':/pexels-photo-332784|pexels-photo/i};
for(const [id,re] of Object.entries(expected))assert.match(String((foods.find(x=>x.id===id)||{}).image||''),re,id+' should use its requested image');
assert.equal((foods.find(x=>x.id==='cheerios')||{}).name,'Cereal','Cheerios should be renamed Cereal');
assert.equal(foods.some(x=>x.id==='frozen'||/stouffer/i.test(x.name||'')),false,'Stouffer frozen dinner must be absent');

assert.match(String((foods.find(x=>x.id==='pork-tenderloin')||{}).image||''),/792027/,'Pork Tenderloin should use an accurate photo');
assert.match(String((foods.find(x=>x.id==='white-fish')||{}).image||''),/36378584/,'White Fish should use an accurate photo');
assert.match(String((foods.find(x=>x.id==='sushi')||{}).image||''),/6249504/,'Sushi should use an accurate photo');
assert.match(String((foods.find(x=>x.id==='gumbo')||{}).image||''),/gumbo_with_rice\.jpg/,'Gumbo should use a gumbo image');
assert.equal((foods.find(x=>x.id==='mashed-potatoes')||{}).name,'Mashed Potatoes','Mashed Potatoes should be plain without gravy');

const cp258Ids=['pot-pie','blt','reuben','hot-dog','corn-dog','nachos','orange-chicken','chicken-teriyaki','sushi','pancakes','omelet','oatmeal','shrimp','crab-cakes','gumbo','chicken-nuggets','ramen','pimento-cheese-sandwich','ice-cream','protein-bar','candy-bar','banana','apple'];
for(const id of cp258Ids) assert.equal(/^https?:\/\//.test(String(foods.find(x=>x.id===id)?.image||'')),true,id+' should have an image URL');
