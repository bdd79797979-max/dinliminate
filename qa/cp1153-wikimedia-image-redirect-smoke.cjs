const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const imageProxy=fs.readFileSync('api/image.js','utf8');
const foods=fs.readFileSync('data/foods.js','utf8');

new vm.Script(imageProxy,{filename:'api/image.js'});
assert.match(imageProxy,/redirect:'manual'/);
assert.match(imageProxy,/current.protocol!=='https:'\|\|!ALLOWED_HOSTS.has(current.hostname)/);
assert.match(imageProxy,/current=new URL(location,current.href)/);
assert.match(imageProxy,/redirectCount<=3/);
assert.match(imageProxy,/['"]upload\.wikimedia\.org['"]/);
const specialFilePathCount=(foods.match(/https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//g)||[]).length;
assert.ok(specialFilePathCount>0,'Expected Wikimedia Special:FilePath meal images to exercise the redirect-safe proxy.');
console.log('CP1153 Wikimedia image redirect smoke: PASS ('+specialFilePathCount+' Special:FilePath meal images)');
