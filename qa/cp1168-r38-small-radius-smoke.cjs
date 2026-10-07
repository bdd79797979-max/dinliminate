'use strict';
const assert=require('node:assert/strict');
const handler=require('../api/restaurants.js');
const t=handler._test;
const lat=36.5298,lon=-87.3595;
function miles(a,b,c,d){const R=3958.7613,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p,z=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(z));}
function sampleCoverage(radius){
 const points=t.providerCenters(lat,lon,radius), tile=points[0].radius;
 for(let r=0;r<=radius;r+=0.25){
  for(let deg=0;deg<360;deg+=2){
   const theta=deg*Math.PI/180;
   const targetLat=lat+Math.sin(theta)*(r/69);
   const targetLon=lon+Math.cos(theta)*(r/(69*Math.max(.35,Math.cos(lat*Math.PI/180))));
   const covered=points.some(c=>miles(targetLat,targetLon,c.lat,c.lon)<=tile+0.15);
   assert.ok(covered,'coverage gap radius='+radius+' target='+r.toFixed(2)+'mi angle='+deg);
  }
 }
}
assert.equal(t.providerCenters(lat,lon,1).length,1);
assert.equal(t.providerCenters(lat,lon,3).length,7);
assert(t.providerCenters(lat,lon,3).every(c=>c.radius===2.1));
assert.equal(t.providerCenters(lat,lon,5).length,7);
assert(t.providerCenters(lat,lon,5).every(c=>c.radius===3.3));
assert.equal(t.providerCenters(lat,lon,10).length,7);
assert(t.providerCenters(lat,lon,10).every(c=>c.radius===6));
sampleCoverage(3);
sampleCoverage(5);
sampleCoverage(10);
console.log('CP1168/r38 small-radius provider tile smoke: PASS');
