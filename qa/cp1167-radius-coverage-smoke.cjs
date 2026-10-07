'use strict';
const assert=require('node:assert/strict');
const handler=require('../api/restaurants.js');
const t=handler._test;
const lat=36.5298,lon=-87.3595;

function milesFromCenter(lat1,lon1,lat2,lon2){
  const R=3958.7613,p=Math.PI/180;
  const a=(lat2-lat1)*p,b=(lon2-lon1)*p;
  const z=Math.sin(a/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin(b/2)**2;
  return 2*R*Math.asin(Math.sqrt(z));
}

const wide=t.centers(lat,lon,100);
assert.equal(wide.length,9);
assert.equal(wide[0].radius,50);
for(const c of wide.slice(1)){
  assert.equal(c.radius,50);
  const d=milesFromCenter(lat,lon,c.lat,c.lon);
  assert.ok(Math.abs(d-60.5)<0.8,'ring center should be ~60 miles from origin, got '+d);
}

const plan=t.radiusDiscoveryPlan(lat,lon,100);
assert.equal(plan.mode,'wide');
assert.equal(plan.coveragePoints,9);
assert.equal(plan.groups.length,3);

for(let r=0;r<=100;r+=0.5){
  for(let deg=0;deg<360;deg+=1){
    const theta=deg*Math.PI/180;
    const targetLat=lat+Math.sin(theta)*(r/69);
    const targetLon=lon+Math.cos(theta)*(r/(69*Math.max(.35,Math.cos(lat*Math.PI/180))));
    const covered=wide.some(c=>milesFromCenter(targetLat,targetLon,c.lat,c.lon)<=50.1);
    assert.ok(covered,'coverage gap at radius '+r+' angle '+deg);
  }
}
console.log('CP1167 100-mile radius coverage smoke: PASS');
