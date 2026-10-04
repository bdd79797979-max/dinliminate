const fs=require('fs'),assert=require('assert');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
const css=fs.readFileSync(require.resolve('../styles.css'),'utf8');
const rel=JSON.parse(fs.readFileSync(require.resolve('../app-release.json'),'utf8'));
for(const p of [/function mealPhotoList\(item\)/,/function mealPhotoStorageKey\(id,index=0\)/,/async function storeMealPhotoSet\(id,photos\)/,/mealPhotoFile\.multiple=true/,/data-meal-photo-main/,/data-meal-photo-remove/,/images:savedPhotos/])assert.match(app,p);
assert.match(css,/\.meal-photo-editor-grid/);
assert.equal(rel.build,862);assert.equal(rel.checkpoint,'CP862');
new Function(app);
console.log('CP862 meal-photo static smoke PASS');