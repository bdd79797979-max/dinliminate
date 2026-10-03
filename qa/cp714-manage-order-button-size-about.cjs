const fs=require('fs');
const assert=require('assert');

const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const release=fs.readFileSync('app-release.json','utf8');

new Function(app);

const manageStart=app.indexOf('const rowMarkup=(item,deleted=false)=>');
const manageEnd=app.indexOf('const body=\'<div class="manage-meals-view"',manageStart);
assert(manageStart>=0 && manageEnd>manageStart,'Manage Meals row renderer missing');
const row=app.slice(manageStart,manageEnd);
assert(row.includes('const extra=deleted?\'\':\'<button class="manage-row-action manage-edit"'),'Edit action must be present');
assert(row.includes('const primary=deleted'),'Hide/Restore action must be present');
assert(row.includes('const deleteAction=deleted?'), 'Delete action must be present');
assert(row.includes('>\'+extra+primary+deleteAction+\'</span>') || row.includes('food-row-actions\'>\'+extra+primary+deleteAction'), 'Active row order must be Edit -> Hide/Restore -> Delete');
assert(row.includes('data-food-deleted-restore') && !row.includes('data-food-delete') || row.includes('const deleteAction=deleted?'), 'Deleted rows must not render Delete');

assert(!app.includes('<div class="settings-about-copy"><h3>Dinliminate</h3>'),'White About Dinliminate heading should be removed');
const cp=css.slice(css.indexOf('/* CP714 — management order + selective decision-button enlargement. */'));
assert(cp.includes('.round-cut') && cp.includes('.round-maybe'),'CP714 decision sizing rules missing');
assert(cp.includes('width:68px!important;height:68px!important'),'Desktop Cut/Maybe size should be 68px');
assert(cp.includes('width:64px!important;height:64px!important'),'Narrow Cut/Maybe size should be 64px');
assert(!cp.includes('.round-back{width'),'CP714 must not resize Back');

assert(release.includes('"build": 714') && release.includes('"checkpoint": "CP714"'),'Release metadata must be CP714');

console.log('CP714 QA PASS');
console.log('Manage Meals order: Edit -> Hide/Restore -> Delete');
console.log('Cut/Maybe: enlarged only');
console.log('About: white Dinliminate heading removed');
