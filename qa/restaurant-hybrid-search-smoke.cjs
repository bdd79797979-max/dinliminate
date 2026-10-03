const assert=require('assert/strict');
const fs=require('fs'),vm=require('vm');
const app=fs.readFileSync('app.js','utf8');
const apiSrc=fs.readFileSync('api/restaurants.js','utf8');

assert(app.includes("const RESTAURANT_TAXONOMY = window.DINLIMINATE_RESTAURANT_TAXONOMY;"),'Browser should use shared restaurant taxonomy');
assert(app.includes("const REST_QUICK = [...RESTAURANT_TAXONOMY.tags];"),'Restaurant Quick Cuts should come from shared taxonomy');
assert(app.includes("const searchTerm = String(S.restaurantQuery||'').trim().slice(0,100);"));
assert(app.includes("const queryParam = searchTerm ? '&q='+encodeURIComponent(searchTerm) : '';"));
assert(app.includes("setTimeout(()=>{searchRestaurants();},650)"));
assert(apiSrc.includes("async function googleSearchPlaces(lat,lon,radius,searchTerm)"));
assert(apiSrc.includes("textQuery:termVariant+' restaurant'"));
assert(apiSrc.includes('searchQueryMany'));
assert(apiSrc.includes('[cuisine~"'));
assert(apiSrc.includes('[brand~"'));
assert(apiSrc.includes('[operator~"'));

const context={module:{exports:{}},exports:{},require,process,fetch};
vm.runInNewContext(apiSrc,context,{filename:'api/restaurants.js'});
const t=context.module.exports._test||{};
assert.equal(typeof t.normalizeSearchQuery,'function');
assert.equal(typeof t.searchRegex,'function');
assert.equal(typeof t.searchQueryClause,'function');

assert.equal(t.normalizeSearchQuery("McDonald's"),'mcdonalds');
const namePattern=new RegExp(t.searchRegex("McDonald's"),'i');
assert(namePattern.test("McDonald's"),'Provider search regex must match McDonald\'s');
assert(namePattern.test('McDonalds'),'Provider search regex must match McDonalds');
const burgerClause=t.searchQueryClause(36.53,-87.34,10,'burger');
assert(burgerClause.includes('[name~') && burgerClause.includes('[brand~') && burgerClause.includes('[operator~') && burgerClause.includes('[cuisine~'),'Burger provider query must cover name, brand, operator, and cuisine');
const mexicanClause=t.searchQueryClause(36.53,-87.34,10,'Mexican');
const mexicanPattern=new RegExp(t.searchRegex('Mexican'),'i');
assert(mexicanPattern.test('Mexican'),'Cuisine provider regex should match the normalized cuisine term');
assert(mexicanClause.includes('[cuisine~'),'Cuisine provider query should target the cuisine field');

const taxonomy=require('../data/restaurant-taxonomy');
const mcd=taxonomy.classifyRestaurant({name:"McDonald's",category:'Fast Food',fastFood:true,cuisine:'burger',menuItems:['Big Mac']});
assert(mcd.tags.includes('Fast Food')&&mcd.tags.includes('Burgers'),'Shared classifier should classify McDonald\'s as Fast Food + Burgers');
const taco=taxonomy.classifyRestaurant({name:'Taco Bell',category:'Fast Food',fastFood:true,cuisine:'mexican',menuItems:['Tacos']});
assert(taco.tags.includes('Fast Food')&&taco.tags.includes('Mexican'),'Shared classifier should classify Taco Bell as Fast Food + Mexican');
const thirsty=taxonomy.classifyRestaurant({name:'Thirsty Goat',category:'Fast Food',fastFood:true,cuisine:'',menuItems:[]});
assert(thirsty.tags.includes('Pizza')&&!thirsty.tags.includes('Fast Food'),'Shared classifier should preserve Thirsty Goat Pizza identity over conflicting Fast Food data');
const weakSeafood=taxonomy.classifyRestaurant({name:'Neighborhood Cafe',category:'American',fastFood:false,cuisine:'american',menuItems:['Shrimp']});
assert(!weakSeafood.tags.includes('Seafood'),'One incidental seafood menu item must not create Seafood');
for(const [q,tag] of [['pizza restaurant','Pizza'],['mexican food','Mexican'],['fish','Seafood'],['burger','Burgers'],['breakfast restaurant','Breakfast'],['American','American'],['fast food','Fast Food']]){
  const c=taxonomy.restaurantSearchClassification(q);
  assert.equal(c.kind,'category',q+' should classify as category search');
  assert.equal(c.tag,tag,q+' should map to '+tag);
}
assert.equal(taxonomy.restaurantSearchClassification("McDonald's").kind,'name',"McDonald's should be treated as a named restaurant search");
assert(taxonomy.searchAliasesFor('Mexican').includes('taco'),'Mexican provider search should include Taco discovery alias');
assert(taxonomy.searchAliasesFor('Seafood').includes('fish'),'Seafood provider search should include Fish discovery alias');
assert(taxonomy.searchAliasesFor('Burger').includes('hamburger'),'Burger provider search should include Hamburger discovery alias');
assert.equal(taxonomy.restaurantSearchClassification('pizzeria').tag,'Pizza','Pizzeria should resolve to Pizza, not the overlapping Italian alias.');
const apiThirsty=taxonomy.classifyRestaurant({name:'Thirsty Goat',category:'Fast Food',fastFood:true,cuisine:'',menuItems:[]});
assert(!apiThirsty.tags.includes('Fast Food') && apiThirsty.tags.includes('Pizza'),'Shared classifier must keep Thirsty Goat out of Fast Food even when provider data conflicts.');
assert(apiSrc.includes('const classifiedFastFood=classification.tags.includes(\'Fast Food\')'),'API result Fast Food state must come from shared classification.');


console.log('restaurant hybrid search smoke: PASS');
