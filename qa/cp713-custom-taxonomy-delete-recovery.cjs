const fs=require('fs');
const assert=require('assert');

const app=fs.readFileSync('app.js','utf8');
const foods=fs.readFileSync('data/foods.js','utf8');

new Function(app);
const ids=[...foods.matchAll(/"id":"([^"]+)"/g)].map(m=>m[1]);
assert.strictEqual(ids.length,116,'Built-in catalog must contain 116 meals');
assert.strictEqual(new Set(ids).size,116,'Built-in meal IDs must be unique');

const required=[
  ['Custom Quick Cut state','customQuickCuts:[]','S.customQuickCuts = Array.isArray(d.customQuickCuts) ? d.customQuickCuts : []'],
  ['Deleted archive state','deletedCustomMeals:[]','S.deletedCustomMeals = Array.isArray(d.deletedCustomMeals) ? d.deletedCustomMeals : []'],
  ['Custom creation tile','id="addCustomQuickCut"','S.customQuickCuts.push({id,name,image:''})'],
  ['Custom rename','data-custom-qc-rename','qc.name=next'],
  ['Custom photo upload','data-custom-qc-file','putStoredPhoto(storageId,data)'],
  ['Custom delete','data-custom-qc-delete','S.customQuickCuts=S.customQuickCuts.filter'],
  ['Meal delete','function deleteMealFromLibrary','manage-delete'],
  ['Meal recovery','function restoreDeletedMeal','Deleted Meals'],
  ['Combined reset','settingsActionButton(\'resetRestore\'','resetRestoreView'],
  ['Restore Defaults','function systemRestoreFlow','S.deleted.clear()'],
  ['Full reset','function resetAppDataFlow','S.deletedCustomMeals=[]'],
  ['Photo preservation','let photo=photoInput||(isEdit&&item?.image?String(item.image):'')','!String(item.image).startsWith(\'data:image/\')'],
  ['Immediate uploaded QC photo','qc.image=data','foodQuick();renderEditorQuickCuts(id)']
];
for(const [label,...tokens] of required){
  for(const token of tokens) assert.ok(app.includes(token),label+' missing: '+token);
}
assert.ok(!app.includes("settingsActionButton('systemRestore'"),'Separate System Restore settings button should be gone');
assert.ok(!app.includes("settingsActionButton('resetAppData'"),'Separate Reset App Data settings button should be gone');

const resetRound=app.slice(app.indexOf('function resetRound(){'),app.indexOf('function resetRestoreView(){'));
assert.ok(!resetRound.includes('S.deleted.clear()'),'Reset Round must not revive permanently deleted meals');

console.log('CP713 QA PASS');
console.log('Built-in meals:',ids.length);
console.log('Unique built-in IDs:',new Set(ids).size);
console.log('Custom Quick Cuts: creation / rename / photo / delete / persistence verified by source contract');
console.log('Meal Delete + recovery + Reset & Restore verified by source contract');
