const assert=require('assert/strict');
const fs=require('fs'),vm=require('vm');
const app=fs.readFileSync('app.js','utf8');
const api=fs.readFileSync('api/restaurants.js','utf8');

assert(app.includes('async function fetchRestaurantEndpoint'),'Restaurant search needs a transient-failure retry wrapper');
assert(app.includes('attempt<2'),'Retry wrapper should retry once, not loop indefinitely');
assert(app.includes('[429,500,502,503,504]'),'Retry wrapper should target rate-limit and transient server failures');
assert(app.includes('const deadline=setTimeout(()=>{timedOut=true;restaurantSearchController.abort()},14500)'),'Client search deadline should be bounded near the server budget');
assert(app.includes("S.restaurantSearchBudgetMs = Number(d.searchBudgetMs)||12000;"),'Client should use the r25 12-second search budget fallback');

assert(api.includes("const SEARCH_BUDGET_MS=12000"),'API search budget should be reduced to a predictable 12 seconds');
assert(api.includes("const WIDE_DISCOVERY_RESERVE_MS=4500"),'Wide discovery should reserve a bounded expansion window');
assert(api.includes("const MAX_SEARCH_PER_MINUTE=60"),'Interactive search should allow reasonable repeated searches');
assert(api.includes("mode!=='search'&&rate(req,mode)"),'Search rate limiting should be deferred until after cache lookup');
assert(api.includes("if(rate(req,mode))return res.status(429)"),'Uncached restaurant searches must still be rate limited');
assert(api.includes('const discoveryPromise=wideSearch||searchTerm'),'Provider-backed expansion should start concurrently with primary providers');
assert(api.includes('await withinBudget(discoveryPromise'),'Concurrent discovery result should be consumed within the remaining budget');
assert(api.includes('const API_VERSION=\'r25\''),'Reliability hardening should remain on API r25');

const ctx={module:{exports:{}},exports:{},require,process,fetch};
vm.runInNewContext(api,ctx,{filename:'api/restaurants.js'});
const t=ctx.module.exports._test||{};
assert.equal(t.normalizeSearchQuery("McDonald's"),'mcdonalds');
assert.equal(typeof t.rate,'function');
assert.equal(t.rate({headers:{}},'suggest'),false);
console.log('restaurant search reliability smoke: PASS');


const taxonomy=require('../data/restaurant-taxonomy');
const cuisineFixtures=[
 ["Subway", "Restaurant", "", ["Fast Food"]],
 ["McDonald's", "Restaurant", "", ["Fast Food","Burgers"]],
 ["Olive Garden", "Restaurant", "", ["Italian"]],
 ["Red Lobster", "Restaurant", "", ["Seafood"]],
 ["Waffle House", "Restaurant", "", ["American","Breakfast"]],
 ["Taco Bell", "Restaurant", "", ["Fast Food","Mexican"]],
 ["Thirsty Goat", "Restaurant", "", ["Pizza"]],
 ["Sample Burger", "Restaurant", "burger restaurant", ["Burgers"]],
 ["Sample Sushi", "Restaurant", "japanese_restaurant", ["Asian"]],
 ["Sample BBQ", "Restaurant", "barbecue restaurant", ["BBQ"]]
];
for(const [name,category,cuisine,tags] of cuisineFixtures){
 const actual=taxonomy.classifyRestaurant({name,category,cuisine,providerType:cuisine});
 for(const tag of tags)assert(actual.tags.includes(tag),name+' should classify as '+tag+'; got '+actual.tags.join(', '));
 assert(!taxonomy.classifyRestaurant({name,category:"Restaurant",cuisine:"",providerType:""}).tags.includes(undefined));
}
console.log('Restaurant taxonomy classification regression: PASS');
