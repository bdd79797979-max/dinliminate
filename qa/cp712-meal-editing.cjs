const fs=require('fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');

const app=fs.readFileSync('app.js','utf8');
const foodsSource=fs.readFileSync('data/foods.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
const release=JSON.parse(fs.readFileSync('app-release.json','utf8'));

new vm.Script(app);
new vm.Script(foodsSource);

const foodsMatch=foodsSource.match(/window\.DINLIMINATE_FOODS=(\[[\s\S]*\]);/);
assert(foodsMatch,'Built-in food catalog must be parseable');
const foods=JSON.parse(foodsMatch[1]);
assert.equal(foods.length,116,'Built-in catalog must remain 116 meals');
assert.equal(new Set(foods.map(x=>x.id)).size,116,'Built-in IDs must remain unique');

const fnStart=app.indexOf('const allFoods = () => {');
const fnEnd=app.indexOf('\n};',fnStart)+3;
assert(fnStart>=0&&fnEnd>fnStart,'allFoods override merge must exist');
const getAll=new Function('S','getDefaultFoods',app.slice(fnStart,fnEnd)+'; return allFoods;')(
  {custom:[{id:foods[0].id,builtInEdit:true,builtInId:foods[0].id,name:'Edited Test Meal',category:'Pasta',quickCuts:['Other'],image:'idb:'+foods[0].id}]},
  ()=>foods
);
const merged=getAll();
assert.equal(merged.length,116,'Editing a built-in must not duplicate the meal');
assert.equal(merged[0].id,foods[0].id,'Built-in edit must preserve the original meal ID');
assert.equal(merged[0].name,'Edited Test Meal','Built-in override must replace the meal name');
assert.deepEqual(merged[0].quickCuts,['Other'],'Built-in override must replace Quick Cut associations');
assert.equal(merged[0].builtInEdit,true,'Edited built-ins must be identifiable');

assert(app.includes('if(isEdit&&isBuiltInEdit){'),'Built-in meals must have a dedicated edit-save path');
assert(app.includes('const id=String(item.id);'),'Built-in edits must keep a stable ID');
assert(app.includes('readImageFile($(\'editFoodFile\').files?.[0])'),'Meal editor must use the existing image-upload pipeline');
assert(app.includes('putStoredPhoto(id,photo)'),'Edited photos must use device photo storage');
assert(app.includes('hydrateCustomPhotos'),'Stored edited photos must be rehydrated');
assert(app.includes('builtInEdit:true'),'Edited built-ins must persist as local overrides');
assert(app.includes("S.custom.push(updated)")||app.includes('S.custom[idx]=updated'),'Built-in overrides must be persisted in custom storage');
assert(app.includes("custom:S.custom.map"),'Save state must persist edited built-in records');
assert(app.includes("S.custom = Array.isArray(d.custom) ? d.custom : [];"),'Load state must restore edited built-in records');

assert(app.includes('data-food-edit'),'Manage Meals must expose Edit actions');
assert(app.includes("primaryAction+'<button class=\"manage-row-action manage-edit\""),'Edit must sit beside Hide/Restore in each Manage Meals row');
assert(app.includes("stateLabel=state+(edited?' · Edited'"),'Built-in edits must display an Edited state');
assert(app.includes("data-food-delete"),'Custom meal Delete must remain available');
assert(app.includes("customOnly?"),'Delete must be limited to custom-only meals');

assert(html.includes('id="manage"'),'Manage Meals entry must remain available');
assert(css.includes('.meal-editor-photo-section'),'Photo replacement UI must be styled');
assert(css.includes('#manageFoodsModal .manage-edit'),'Manage Meals Edit styling must exist');
assert.equal(release.build,712,'CP712 build metadata must be set');

console.log('CP712 meal editing QA: PASS');
console.log(JSON.stringify({builtInMeals:foods.length,mergedMeals:merged.length,duplicateEditedIds:merged.filter(x=>x.id===foods[0].id).length,build:release.build}));
