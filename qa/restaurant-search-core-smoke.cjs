'use strict';

const handler=require('../api/restaurants.js');

function assert(name,condition,detail=''){
 if(!condition)throw new Error(name+(detail?': '+detail:''));
}

const t=handler._test||{};
assert('test hooks available',typeof t.dedupe==='function'&&typeof t.restaurantSearchMatches==='function');

const excellRows=[
 {name:'Excell Market & BBQ',address:'100 Main St, Clarksville, TN',lat:36.5,lon:-87.3,source:'OpenStreetMap',category:'BBQ',cuisine:'bbq'},
 {name:'Excell Bar-B-Q',address:'100 Main St, Clarksville, TN',lat:36.5001,lon:-87.3001,source:'Photon POI',category:'BBQ',cuisine:'bbq'}
];
const excellDeduped=t.dedupe(excellRows);
assert('Excell naming variants dedupe',excellDeduped.length===1,excellDeduped.map(x=>x.name).join(' | '));

const supplier={name:'Larson Enterprises',address:'101 Main St, Clarksville, TN',lat:36.51,lon:-87.31,source:'ArcGIS POI',category:'Restaurant'};
assert('known supplier rejected',t.isClearlyNonDiningBusiness(supplier));

assert('pizza category match',t.restaurantSearchMatches({name:"Joe's Pizza",category:'Pizza',cuisine:'pizza'},'pizza'));
assert('name match',t.restaurantSearchMatches({name:"Joe's Pizza",category:'Restaurant'},'joe pizza'));
assert('filler words do not over-filter',t.restaurantSearchMatches({name:"Joe's Pizza",category:'Restaurant'},'pizza restaurant near me'));
assert('wrong category rejected',!t.restaurantSearchMatches({name:"Joe's Sushi",category:'Asian',cuisine:'sushi'},'pizza'));
assert('burger includes fast food',t.restaurantSearchMatches({name:'Burger King',category:'Fast Food',fastFood:true},'burgers'));

const radiusSummary=[1,3,5,10,25,50,100].map(radius=>{
 const plan=t.radiusDiscoveryPlan(36.5,-87.3,radius);
 assert('radius plan '+radius,plan.coveragePoints>=1&&plan.groups.length>=1);
 return {radius,mode:plan.mode,coveragePoints:plan.coveragePoints,groups:plan.groups.length};
});
assert('100-mile uses wide coverage',radiusSummary.find(x=>x.radius===100).coveragePoints===13);
assert('50-mile stays single local circle',radiusSummary.find(x=>x.radius===50).coveragePoints===1);
const clause=t.searchQueryClause(36.5,-87.3,100,'pizza');
assert('Overpass center query capped at 50 miles',clause.includes('around:80467,'));

console.log(JSON.stringify({ok:true,excellRowsAfterDedupe:excellDeduped.map(x=>x.name),radiusSummary,searchMatching:'strict',staleTargetProtection:'enabled'},null,2));
