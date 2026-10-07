'use strict';
const assert=require('node:assert/strict');
const handler=require('../api/restaurants.js');
const t=handler._test;
const lat=36.5298,lon=-87.3595;
function miles(a,b,c,d){ const R=3958.7613,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p; const z=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2; return 2*R*Math.asin(Math.sqrt(z)); }
function sampleCoverage(radius,allowedRadius){
 const centers=t.centers(lat,lon,radius);
 for(let r=0;r<=radius;r+=0.5){
  for(let deg=0;deg<360;deg+=2){
   const theta=deg*Math.PI/180;
   const targetLat=lat+Math.sin(theta)*(r/69);
   const targetLon=lon+Math.cos(theta)*(r/(69*Math.max(.35,Math.cos(lat*Math.PI/180))));
   const covered=centers.some(c=>miles(targetLat,targetLon,c.lat,c.lon)<=allowedRadius+0.15);
   assert.ok(covered,'coverage gap radius='+radius+' target='+r.toFixed(1)+'mi angle='+deg);
  }
 }
}
assert.equal(t.centers(lat,lon,10).length,1);
assert.equal(t.centers(lat,lon,25).length,7);
assert(t.centers(lat,lon,25).every(c=>c.radius===15));
assert.equal(t.centers(lat,lon,50).length,7);
assert(t.centers(lat,lon,50).every(c=>c.radius===30));
assert.equal(t.centers(lat,lon,100).length,13);
assert.equal(t.centers(lat,lon,100)[0].radius,40);
assert(t.centers(lat,lon,100).slice(1).every(c=>c.radius===40));
assert(t.centers(lat,lon,100).slice(1).every(c=>Math.abs(miles(lat,lon,c.lat,c.lon)-75)<0.9));
const p10=t.radiusDiscoveryPlan(lat,lon,10);
assert.equal(p10.mode,'tiled'); assert.equal(p10.coveragePoints,1); assert.deepEqual(p10.groups.map(g=>g.length),[1]);
const p25=t.radiusDiscoveryPlan(lat,lon,25);
assert.equal(p25.mode,'tiled'); assert.equal(p25.coveragePoints,7); assert.deepEqual(p25.groups.map(g=>g.length),[3,3,1]);
const p50=t.radiusDiscoveryPlan(lat,lon,50);
assert.equal(p50.mode,'tiled'); assert.equal(p50.coveragePoints,7); assert.deepEqual(p50.groups.map(g=>g.length),[3,3,1]);
const p100=t.radiusDiscoveryPlan(lat,lon,100);
assert.equal(p100.mode,'wide'); assert.equal(p100.coveragePoints,13); assert.deepEqual(p100.groups.map(g=>g.length),[3,3,3,3,1]);
sampleCoverage(25,15); sampleCoverage(50,30); sampleCoverage(100,40);
console.log('CP1168 radius tile geometry smoke: PASS');