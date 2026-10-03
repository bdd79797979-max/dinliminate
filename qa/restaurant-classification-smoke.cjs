const assert=require('assert/strict');
const handler=require('../api/restaurants');
const isFast=handler._test?.isFastFoodName; const dedupe=handler._test?.dedupe; const isNonDining=handler._test?.isClearlyNonDiningBusiness; const nameSimilarity=handler._test?.restaurantNameSimilarity; const addressSimilarity=handler._test?.restaurantAddressSimilarity; const filterNonDining=handler._test?.filterNonDiningRows; const knownWebsite=handler._test?.knownRestaurantWebsite;
assert.equal(typeof isFast,'function','fast-food classifier test hook should exist');
assert.equal(typeof dedupe,'function','restaurant dedupe test hook should exist');
assert.equal(typeof isNonDining,'function','non-dining business filter test hook should exist');
assert.equal(typeof filterNonDining,'function','non-dining row filter test hook should exist');
assert.equal(typeof knownWebsite,'function','known restaurant website test hook should exist');
assert.equal(typeof nameSimilarity,'function','restaurant name similarity test hook should exist');
assert.equal(typeof addressSimilarity,'function','restaurant address similarity test hook should exist');
assert.equal(knownWebsite({name:"McDonald's"}),'https://www.mcdonalds.com',"McDonald's should use its known official website");
assert.equal(knownWebsite({name:'The Thirsty Goat'}),'https://www.thirstygoatsango.com','The Thirsty Goat should use its known official website');
for(const name of ["McDonald's","Wendy's","Burger King","KFC","Taco Bell","Chick-fil-A","Chipotle"]) assert.equal(isFast(name),true,name+' should classify as Fast Food');
for(const name of ["Applebee's","Ruby Tuesday","Olive Garden","Texas Roadhouse","Outback Steakhouse","Cracker Barrel","O'Charley's","Red Lobster","Panera Bread","The Thirsty Goat"]) assert.equal(isFast(name),false,name+' should not classify as Fast Food');
const classify=handler._test.classifyRestaurant;
assert.equal(classify({name:'The Thirsty Goat',category:'Restaurant',cuisine:'',providerType:'restaurant'}).tags.includes('Pizza'),true,'The Thirsty Goat should classify as Pizza');
assert.equal(classify({name:'Heads BBQ',category:'Restaurant',cuisine:'',providerType:'restaurant'}).tags.includes('BBQ'),true,'Heads BBQ should classify as BBQ');
assert.equal(classify({name:'Excell BBQ',category:'Restaurant',cuisine:'',providerType:'restaurant'}).tags.includes('BBQ'),true,'Excell BBQ should classify as BBQ');
console.log('Dinliminate restaurant classification smoke: PASS');

const fixture=[
 {id:'a',name:'Heads BBQ',address:'801 Iron Workers Rd, Clarksville, TN 37043',lat:36.5304,lon:-87.3601,distance:0.1,source:'Photon',phone:'9315550101'},
 {id:'b',name:'Robert Heads BBQ',address:'801 Iron Workers Road, Clarksville, Tennessee 37043',lat:36.53045,lon:-87.36012,distance:0.1,source:'ArcGIS',phone:'9315550101'},
 {id:'c',name:"Chris Pizza",address:'100 Main St, Clarksville, TN 37040',lat:36.5300,lon:-87.3600,distance:0.2,source:'Photon'},
 {id:'d',name:"Chris's Pizza",address:'100 Main St, Clarksville, TN 37040',lat:36.53002,lon:-87.36002,distance:0.2,source:'ArcGIS'}
];
const merged=dedupe(fixture);
assert.equal(merged.length,2,'Same-site provider name variants should merge without leaving duplicate cards');
assert.equal(merged.some(x=>/heads bbq/i.test(x.name)),true,'Heads BBQ family should remain discoverable after dedupe');
assert.equal(merged.filter(x=>/chris pizza/i.test(x.name)).length,1,'Chris Pizza variants should merge into one result');
const separate=dedupe([{id:'e',name:'Heads BBQ',address:'801 Iron Workers Rd, Clarksville, TN 37043',lat:36.5304,lon:-87.3601,distance:0.1,source:'Photon'},{id:'f',name:'Robert Heads BBQ',address:'200 College St, Clarksville, TN 37040',lat:36.545,lon:-87.350,distance:1.1,source:'ArcGIS'}]);
assert.equal(separate.length,2,'Same-named restaurant variants at different locations must remain separate');
const reportedDuplicates=dedupe([
 {id:'ex1',name:'Excell BBQ',address:'3102 Ashland City Rd, Clarksville, TN 37043',lat:36.5304,lon:-87.3601,distance:0.7,source:'OpenStreetMap'},
 {id:'ex2',name:'Excell Market Bar-B-Q',address:'3102 Ashland City Road, Clarksville, TN 37043',lat:36.53042,lon:-87.36008,distance:0.7,source:'Photon'},
 {id:'cs1',name:'Strippers Chicken',address:'124 S 10th St, Clarksville, TN 37040',lat:36.5280,lon:-87.3590,distance:1.2,source:'OpenStreetMap'},
 {id:'cs2',name:'Chicken Strippers',address:'124 S 10th Street, Clarksville, TN 37040',lat:36.52804,lon:-87.35896,distance:1.2,source:'ArcGIS'}
]);
assert.equal(reportedDuplicates.filter(x=>/^excell/i.test(x.name)).length,1,'Excell BBQ provider/name variants must merge to one result');
assert.equal(reportedDuplicates.filter(x=>/strippers chicken|chicken strippers/i.test(x.name)).length,1,'Chicken Strippers provider/name variants must merge to one result');
console.log('Restaurant duplicate regression: PASS');
assert.equal(handler._test.restaurantNameTokens('Excell Market Bar-B-Q').join(' '),'excell market bbq','BBQ name normalization should canonicalize Bar-B-Q');


// CP670 location-first dedupe regression.
assert.ok(nameSimilarity('Excell BBQ','Excell Market Bar-B-Q')>=0.60,'Excell BBQ name variants should be similar enough to merge');
assert.ok(nameSimilarity('Strippers Chicken','Chicken Strippers')>=0.60,'Chicken Strippers name variants should be similar enough to merge');
assert.ok(addressSimilarity('3102 Ashland City Rd, Clarksville, TN 37043','3102 Ashland City Road, Clarksville, Tennessee 37043')>=0.90,'Equivalent addresses should normalize together');

const sameAddressDifferentNames=dedupe([
 {id:'same-a',name:'Panda Garden',address:'1000 Market St, Clarksville, TN 37040',lat:36.53,lon:-87.36,distance:1,source:'Photon'},
 {id:'same-b',name:'Burger House',address:'1000 Market Street, Clarksville, TN 37040',lat:36.53001,lon:-87.36001,distance:1,source:'ArcGIS'}
]);
assert.equal(sameAddressDifferentNames.length,2,'Same address by itself must not collapse unrelated restaurant names');

const similarAddressSameName=dedupe([
 {id:'addr-a',name:'Excell BBQ',address:'3102 Ashland City Rd, Clarksville, TN 37043',lat:36.5304,lon:-87.3601,distance:.7,source:'OpenStreetMap'},
 {id:'addr-b',name:'Excell Market Bar-B-Q',address:'3102 Ashland City Road, Clarksville, Tennessee 37043',lat:36.53042,lon:-87.36008,distance:.7,source:'ArcGIS'}
]);
assert.equal(similarAddressSameName.length,1,'Same/similar address plus similar name must collapse to one restaurant');

const nearCoordsSimilarName=dedupe([
 {id:'near-a',name:'Strippers Chicken',address:'124 S 10th St, Clarksville, TN 37040',lat:36.5280,lon:-87.3590,distance:1.2,source:'OpenStreetMap'},
 {id:'near-b',name:'Chicken Strippers',address:'124 South 10th Street, Clarksville, TN 37040',lat:36.52804,lon:-87.35896,distance:1.2,source:'Photon'}
]);
assert.equal(nearCoordsSimilarName.length,1,'Near-identical coordinates plus similar name must collapse to one restaurant');

const sameNameDifferentAddresses=dedupe([
 {id:'diff-a',name:'Chris Pizza',address:'100 Main St, Clarksville, TN 37040',lat:36.53,lon:-87.36,distance:.2,source:'Photon'},
 {id:'diff-b',name:'Chris Pizza',address:'800 College St, Clarksville, TN 37040',lat:36.55,lon:-87.34,distance:2.0,source:'ArcGIS'}
]);
assert.equal(sameNameDifferentAddresses.length,2,'Same restaurant name at clearly different addresses must remain separate');
console.log('CP670 location-first dedupe regression: PASS');


const nonDiningFixtures=[
 {id:'supplier',name:"Larson's Enterprise Inc",category:'Restaurant',providerType:'Food Supplier',address:'123 Example Rd, Clarksville, TN'},
 {id:'distributor',name:'Regional Food Distribution',category:'Restaurant',providerType:'Food Distributor',address:'125 Example Rd, Clarksville, TN'},
 {id:'warehouse',name:'Clarksville Food Warehouse',category:'Restaurant',providerType:'Warehouse',address:'127 Example Rd, Clarksville, TN'},
 {id:'restaurant',name:'Camacho Taco Grill',category:'Restaurant',providerType:'restaurant',cuisine:'Mexican',address:'129 Example Rd, Clarksville, TN'}
];
assert.equal(isNonDining(nonDiningFixtures[0]),true,"Larson's Enterprise Inc food-supplier record must be excluded");
assert.equal(isNonDining(nonDiningFixtures[1]),true,'Food distributor must be excluded');
assert.equal(isNonDining(nonDiningFixtures[2]),true,'Warehouse must be excluded');
assert.equal(isNonDining({id:'larson-ambiguous',name:'Larsons Enterprise',category:'Restaurant',providerType:'Restaurant',address:'555 Food Service Rd, Clarksville, TN'}),true,'Larsons Enterprise must be excluded even when a weak provider mislabels it as a restaurant');
assert.equal(isNonDining(nonDiningFixtures[3]),false,'Actual dining venue must remain eligible');
assert.equal(isNonDining({id:'larson-exact',name:'Larson Enterprises Inc',category:'Restaurant',providerType:'Restaurant',address:'555 Food Service Rd, Clarksville, TN'}),true,'Larson Enterprises Inc must be excluded as the reported food-provider false positive');
assert.equal(isNonDining({id:'supplier-type',name:'Some Food Business',category:'Restaurant',providerType:'Food Supplier',address:'556 Example Rd, Clarksville, TN'}),true,'Food Supplier provider type must be excluded even when category is mislabelled');
assert.equal(isNonDining({id:'equipment-type',name:'Commercial Kitchen Equipment',category:'Restaurant',providerType:'Commercial Kitchen Equipment',address:'557 Example Rd, Clarksville, TN'}),true,'Commercial kitchen supplier/equipment records must be excluded');
const filtered=filterNonDining(nonDiningFixtures);
assert.deepEqual(filtered.map(x=>x.id),['restaurant'],'Non-dining rows must be removed while dining rows remain');
console.log('Restaurant non-dining business regression: PASS');
