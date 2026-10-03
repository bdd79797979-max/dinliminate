const assert=require('assert/strict');
const fs=require('fs');

const photo=require('../api/restaurant-photo');
const app=fs.readFileSync(require('path').join(__dirname,'..','app.js'),'utf8');

assert.equal(typeof photo._test?.knownRestaurantPhoto,'function','known restaurant photo helper should exist');
assert.equal(typeof photo._test?.fastKnownRestaurantPhoto,'function','fast known restaurant photo helper should exist');
assert.match(app,/const KNOWN_RESTAURANT_PHOTO_FALLBACKS=/,'frontend known-photo fallback table should exist');

const fixtures=[
 {name:"Sweet P's Southern Style",needle:'Sweet-Ps-Southern-Style_8c41d09a14d942d0ca25ab6076d3f05e.jpg'},
 {name:"Gray Smoke Barbecue",needle:'90a3488a-0fdb-47fa-9c6d-e76837ebc263.jpg'},
 {name:"CAP’s Neighborhood Bar & Grill",needle:'CAPS-Neighborhood-Bar-Grill-7.jpg'},
 {name:"Reggie's BBQ",needle:"https://d1w7312wesee68.cloudfront.net/XqjMLj3K3JQ1LOypRViqpaLKzbu0dXfv_cQwp2AxpXk/ext%3Awebp/quality%3A85/plain/s3%3A//toast-sites-resources-prod/restaurantImages/263daf0a-e243-4425-8d8a-9b75cbf93056/82d46202-8e46-4a18-9858-9ca3d930ca93-19"},
 {name:"Legends Smokehouse & Grill",needle:"https://5dee1204fff7f466a182.cdn6.editmysite.com/uploads/b/5dee1204fff7f466a182a4e6fe08b0edea7ec96d54c794955f8198991dae5da6/Untitled%20design%282%29_1713398838.png?optimize=medium&width=2400"},
 {name:"Johnny's Big Burger",needle:"https://thebigburger.com/__l5e/assets-v1/3211c7e6-0473-4028-b8d0-db085ca4a369/frontpage.jpg"},
 {name:"Blackhorse Pub & Brewery",needle:"https://assets.site-static.com/userFiles/2147/image/Mark/Compress_Images_Special_Project/The%20Blackhorse%20Pub%20Brewery%2C%20TN.jpg"},
 {name:"Pbody's",needle:"https://img.p.mapq.st/?q=75&url=https%3A%2F%2Fmedia-cdn.tripadvisor.com%2Fmedia%2Fphoto-o%2F07%2F11%2Fa6%2F80%2Fpbody-s.jpg&w=3840"},
 {name:"The Catfish House",needle:"https://static.wixstatic.com/media/568437_1b8e1db53bfa4086b85fad232d3b91f4~mv2.jpg/v1/fill/w_960%2Ch_460%2Cal_c%2Cq_85%2Cenc_avif%2Cquality_auto/568437_1b8e1db53bfa4086b85fad232d3b91f4~mv2.jpg"},
 {name:"Liberty Park Grill",needle:"https://photos.smugmug.com/USA/Tennessee/Clarksville/i-L9DVxSZ/0/92fe32e8/L/ClarksvilleTN-369-L.jpg"},
 {name:"Cafe 931",needle:"https://pub-ba1a74be17d7442a9f2541946eb9510e.r2.dev/shops/1f9865fb-9f52-490e-8c41-377ec5adab87/0.jpg"},
 {name:"Yada on Franklin",needle:"https://static.spotapps.co/spots/cd/9f903fe2ff4bd0b72d4439b91d8d95/full"},
 {name:"The Mailroom",needle:"https://images.squarespace-cdn.com/content/v1/6772c0e3152fba51d1e9cea1/1735573738359-OFYKQZMLW8GCX7TIKR0Q/Mailroom-Featured-Image-Header.jpg"},
 {name:"Silke's Old World Breads",needle:"https://silkesoldworldbreads.com/cdn/shop/files/outside_whole_bldg_for_web.jpg?v=1631571846&width=3840"},
 {name:"Casa D'Italia",needle:"https://static.goto-where.com/70162-albums-1.jpg"}
];

for(const fixture of fixtures){
  const found=photo._test.knownRestaurantPhoto(fixture.name,'Clarksville, TN');
  assert(found?.image?.includes(fixture.needle.split('/').pop().split('?')[0]) || found?.image===fixture.needle,fixture.name+' should resolve to its known venue photo');
  assert(app.includes(fixture.needle),fixture.name+' frontend fallback should contain its exact photo URL');
}
console.log('CP678 restaurant photo audit smoke: PASS ('+fixtures.length+' known venues)');
