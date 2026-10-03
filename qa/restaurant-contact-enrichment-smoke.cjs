const assert=require('assert/strict');
const api=require('../api/restaurants.js');
const t=api._test||{};
assert.equal(typeof t.applyGoogleContactPatches,'function','Google contact patch helper must be exported for regression testing');

const target={id:'provider-1',name:'Sample Grill',address:'1 Main St, Clarksville, TN',phone:'',website:'',googlePlaceId:''};
const other={id:'provider-2',name:'Other Grill',address:'2 Main St, Clarksville, TN',phone:'',website:''};
const patch={
  _targetId:'provider-1',
  address:'1 Main Street, Clarksville, TN 37040',
  phone:'931-555-0111',
  website:'https://samplegrill.example',
  googlePlaceId:'ChIJCONTACT123456',
  openNow:true
};
const rows=t.applyGoogleContactPatches([target,other],[patch]);
assert.strictEqual(rows[0],target,'Patch should mutate the existing target row rather than replace it');
assert.equal(target.phone,'931-555-0111');
assert.equal(target.website,'https://samplegrill.example');
assert.equal(target.googlePlaceId,'ChIJCONTACT123456');
assert.equal(target.openNow,true);
assert.equal(target.contactEnriched,true);
assert.equal(rows.length,2,'Google contact enrichment must not create an extra restaurant row');
console.log('restaurant contact enrichment merge smoke: PASS');
