const assert=require('assert/strict');
const handler=require('../api/restaurants');
const t=handler._test||{};
assert.equal(typeof t.dedupe,'function','dedupe test hook required');
assert.equal(typeof t.nameVariantMatch,'function','name variant test hook required');
assert.equal(typeof t.normAddress,'function','normAddress test hook required');

const rows=[
 {id:'osm-heads',name:"Head's BBQ",address:'100 Main Rd, Clarksville, TN 37043',lat:36.5300,lon:-87.3400,distance:.2,source:'OpenStreetMap',fastFood:false,menuItems:[],photo:''},
 {id:'arc-robert-heads',name:'Robert Head’s BBQ',address:'100 Main Rd, Clarksville, TN 37043',lat:36.5307,lon:-87.3403,distance:.2,source:'ArcGIS POI',fastFood:false,menuItems:[],photo:'better'},
 {id:'osm-chris',name:"Chris Pizza",address:'200 College St, Clarksville, TN 37043',lat:36.5310,lon:-87.3390,distance:.3,source:'OpenStreetMap',fastFood:false,menuItems:[],photo:''},
 {id:'pho-chris',name:"Chris's Pizza",address:'200 College St, Clarksville, TN 37043',lat:36.5314,lon:-87.3392,distance:.3,source:'Photon POI',fastFood:false,menuItems:['pizza'],photo:''},
 {id:'other',name:'Heads BBQ Express',address:'500 Rural Rd, Clarksville, TN 37043',lat:36.5400,lon:-87.3500,distance:.8,source:'ArcGIS POI',fastFood:false,menuItems:[],photo:''},
 {id:'heads-road-spelling',name:"Head's BBQ",address:'100 Main Rd, Clarksville, TN 37043',lat:36.5450,lon:-87.3500,distance:1.1,source:'Photon POI',fastFood:false,menuItems:[],photo:''},
 {id:'far-variant',name:"Head's BBQ",address:'900 River Rd, Clarksville, TN 37043',lat:36.7200,lon:-87.3500,distance:12,source:'ArcGIS POI',fastFood:false,menuItems:[],photo:''}
];
assert.equal(t.nameVariantMatch("Head's BBQ",'Robert Head’s BBQ'),true,'Robert Head’s BBQ should be recognized as a nearby name variant');
assert.equal(t.nameVariantMatch('Heads BBQ','Heads BBQ Express'),false,'Format/location modifiers such as Express must not trigger a name-variant merge');
assert.equal(t.nameVariantMatch('Chris Pizza',"Chris's Pizza"),true,'Chris Pizza and Chris’s Pizza should normalize to the same name family');
assert.equal(t.classifyRestaurant({name:'The Thirsty Goat',category:'Fast Food',providerType:'Pizza restaurant'}).primary,'Pizza','The Thirsty Goat primary classification must be Pizza');
assert.deepEqual(t.classifyRestaurant({name:'The Thirsty Goat',category:'Fast Food',providerType:'Pizza restaurant'}).tags,['Pizza'],'The Thirsty Goat must not retain Fast Food taxonomy tagging');
assert.equal(typeof t.restaurantIdentityKey,'function','restaurantIdentityKey test hook required');
assert.equal(t.restaurantIdentityKey({name:'Heads BBQ'}),t.restaurantIdentityKey({name:'Robert Heads BBQ'}),'Heads BBQ name variants must share one canonical local identity');
assert.equal(t.restaurantIdentityKey({name:'Heads BBQ Express'}),'','Heads BBQ Express must not inherit the Heads BBQ canonical identity');
assert.equal(t.restaurantIdentityKey({name:'Excell BBQ'}),'excell-bbq-clarksville','Excell BBQ must have a canonical local identity');

const out=t.dedupe(rows);
assert.equal(t.normAddress('100 Main Road, Clarksville, TN 37043'),t.normAddress('100 Main Rd, Clarksville, TN 37043'),'Road/Rd address variants should normalize together');
assert.equal(out.length,4,'Three duplicate-provider cases should collapse while distinct venues remain');
assert.equal(out.some(x=>/Robert Head/i.test(x.name)),false,'Provider variant should not survive as a duplicate');
assert.equal(out.some(x=>/Chris.?s? Pizza/i.test(x.name)),true,'One Chris Pizza record should remain');
assert.equal(out.some(x=>x.id==='other'),true,'Distinct nearby restaurant should remain');
const namedVariants=t.dedupe([
 {id:'h1',name:'Heads BBQ',address:'801 Iron Workers Rd, Clarksville, TN 37043',lat:36.5304,lon:-87.3601,distance:0.2,source:'Photon'},
 {id:'h2',name:'Robert Heads BBQ',address:'Iron Workers Rd, Clarksville, TN 37043',lat:36.5311,lon:-87.3602,distance:0.21,source:'ArcGIS'},
 {id:'e1',name:'Excell BBQ',address:'500 College St, Clarksville, TN 37043',lat:36.531,lon:-87.34,distance:0.5,source:'Photon'},
 {id:'e2',name:'Excell BBQ',address:'500 College Street, Clarksville, TN 37043',lat:36.5312,lon:-87.3401,distance:0.5,source:'ArcGIS'},
 {id:'m1',name:"McDonald's - Sango",address:'2798 Highway 76, Clarksville, TN 37043',lat:36.52,lon:-87.22,distance:7.1,source:'Photon'},
 {id:'m2',name:'McDonalds - Sango',address:'2798 Hwy 76, Clarksville, TN 37043',lat:36.5202,lon:-87.2201,distance:7.12,source:'ArcGIS'},
 {id:'e3',name:'Heads BBQ Express',address:'801 Iron Workers Rd, Clarksville, TN 37043',lat:36.5304,lon:-87.3601,distance:0.2,source:'Google'}
]);
assert.equal(namedVariants.filter(x=>/heads bbq/i.test(x.name)).length,2,'Heads BBQ should remain separate from the intentionally distinct Heads BBQ Express venue');
assert.equal(namedVariants.filter(x=>/^(excell bbq)$/i.test(x.name)).length,1,'Duplicate Excell BBQ provider rows should collapse');
assert.equal(namedVariants.filter(x=>/mcdonald/i.test(x.name)).length,1,'Duplicate McDonalds Sango provider rows should collapse');
const chainStores=t.dedupe([
 {id:'m1',name:"McDonald's",address:'100 Main St, Clarksville, TN 37040',lat:36.5304,lon:-87.3601,distance:1,source:'Photon',website:'https://www.mcdonalds.com'},
 {id:'m2',name:"McDonald's",address:'500 Tiny Town Rd, Clarksville, TN 37042',lat:36.6204,lon:-87.2601,distance:8,source:'ArcGIS POI',website:'https://www.mcdonalds.com'}
]);
assert.equal(chainStores.length,2,'Two same-chain locations with the same corporate website must remain separate');
console.log('restaurant dedupe smoke: PASS',JSON.stringify(out.map(x=>({name:x.name,address:x.address,id:x.id}))));


const wendysNameForms=[
 {id:'w1',name:"Wendy's",address:'2330 Madison St, Clarksville, TN 37043',lat:36.53,lon:-87.36,source:'Google'},
 {id:'w2',name:'Wendys',address:'2330 Madison Street, Clarksville, TN 37043',lat:36.5303,lon:-87.3602,source:'Photon'},
 {id:'w3',name:"WENDY'S",address:'2330 Madison St, Clarksville, TN 37043',lat:36.5302,lon:-87.3601,source:'ArcGIS'}
];
const wendysNameMerged=t.dedupe(wendysNameForms);
assert.equal(wendysNameMerged.length,1,"Wendy's, Wendys, and WENDY'S at the same address must resolve to one venue");

const wendyAddressVariants=[
 {id:'wa',name:"Wendy's",address:'2330 Madison St, Clarksville, TN 37043',lat:36.5300,lon:-87.3600,source:'Google'},
 {id:'wb',name:'Wendys',address:'2330 Madison Street, Clarksville, Tennessee, 37043',lat:36.5302,lon:-87.3601,source:'Photon'},
 {id:'wc',name:"WENDY'S",address:'2330 Madison St., Clarksville, TN 37043, USA',lat:36.5301,lon:-87.36005,source:'ArcGIS'}
];
assert.equal(t.dedupe(wendyAddressVariants).length,1,"Equivalent Wendy's addresses with state/road formatting differences must collapse to one venue");


const countryAddressVariants=[
 {id:'ca',name:"Wendy's",address:'2330 Madison St, Clarksville, TN 37043',lat:36.5300,lon:-87.3600},
 {id:'cb',name:"Wendys",address:'2330 Madison Street, Clarksville, Tennessee, 37043 United States',lat:36.5302,lon:-87.3601},
 {id:'cc',name:"WENDY'S",address:'2330 Madison St., Clarksville, TN 37043, USA',lat:36.5301,lon:-87.36005}
];
assert.equal(t.dedupe(countryAddressVariants).length,1,"Country/state/road-format variants of the same Wendy's venue must collapse to one result");


const sameStreetPartialAddress=[
 {id:'ws1',name:"Wendy's",address:'2330 Madison St, Clarksville, TN 37043',lat:36.53,lon:-87.36,distance:6.90,source:'Google'},
 {id:'ws2',name:'Wendys',address:'Madison St, Clarksville, TN 37043',lat:36.5312,lon:-87.3590,distance:6.91,source:'Photon'}
];
assert.equal(t.dedupe(sameStreetPartialAddress).length,1,"Same-name restaurants on the same street with one partial street address and matching search distance must collapse to one venue");

const sameStreetTwoFullAddresses=[
 {id:'sf1',name:"Wendy's",address:'2330 Madison St, Clarksville, TN 37043',lat:36.53,lon:-87.36,distance:6.90,source:'Google'},
 {id:'sf2',name:"Wendy's",address:'2500 Madison St, Clarksville, TN 37043',lat:36.5312,lon:-87.3590,distance:6.91,source:'Photon'}
];
assert.equal(t.dedupe(sameStreetTwoFullAddresses).length,2,"Two separately numbered same-name locations on the same street must remain separate");


const sameWendysStreetDistance=[
 {id:'wd1',name:"Wendy's",address:'2330 Madison St, Clarksville, TN 37043',lat:36.53,lon:-87.36,distance:6.90,source:'Google'},
 {id:'wd2',name:'Wendys',address:'Madison St, Clarksville, TN 37043',lat:36.59,lon:-87.30,distance:6.91,source:'Photon'}
];
assert.equal(t.dedupe(sameWendysStreetDistance).length,1,"Same-name Wendy's on the same street with matching reported search distance must collapse even when provider coordinates differ");

const sameStreetDifferentDistance=[
 {id:'wd3',name:"Wendy's",address:'2330 Madison St, Clarksville, TN 37043',lat:36.53,lon:-87.36,distance:6.90,source:'Google'},
 {id:'wd4',name:"Wendy's",address:'2500 Madison St, Clarksville, TN 37043',lat:36.60,lon:-87.29,distance:8.20,source:'Photon'}
];
assert.equal(t.dedupe(sameStreetDifferentDistance).length,2,"Same-name restaurants on the same street must remain separate when their displayed distances materially differ");

const sameNameSameStreetDistance=[
 {id:'sd1',name:"Wendy's",address:'2330 Madison St, Clarksville, TN 37043',lat:36.5300,lon:-87.3600,distance:6.90,source:'Google'},
 {id:'sd2',name:"Wendy's",address:'Madison St, Clarksville, TN 37043',lat:36.7000,lon:-87.2000,distance:6.91,source:'Photon'}
];
assert.equal(t.dedupe(sameNameSameStreetDistance).length,1,"Same-name Wendy's on the same street with matching displayed search distance must collapse to one result");

const sameStreetDifferentDistance2=[
 {id:'sd3',name:"Wendy's",address:'2330 Madison St, Clarksville, TN 37043',lat:36.5300,lon:-87.3600,distance:6.90,source:'Google'},
 {id:'sd4',name:"Wendy's",address:'2500 Madison St, Clarksville, TN 37043',lat:36.7000,lon:-87.2000,distance:8.10,source:'Photon'}
];
assert.equal(t.dedupe(sameStreetDifferentDistance2).length,2,"Same-name same-street restaurants with materially different displayed distances must remain distinct");
