'use strict';

const fs=require('node:fs');
const path=require('node:path');
const google=require('../api/google-restaurant-photo.js');
const photo=require('../api/restaurant-photo.js');

function assert(name,condition,detail=''){
 if(!condition)throw new Error(name+(detail?': '+detail:''));
}

const g=google._test||{};
const p=photo._test||{};

assert('Google photo test hooks available',
  typeof g.exactPlaceMatch==='function' &&
  typeof g.venueNameMatches==='function' &&
  typeof g.photoQuality==='function'
);

const exactPlace={
 displayName:{text:'Excell Bar-B-Q'},
 formattedAddress:'100 Main St, Clarksville, TN 37040',
 location:{latitude:36.5001,longitude:-87.3001}
};
assert('exact Google venue match',
  g.exactPlaceMatch(exactPlace,'Excell Market & BBQ','100 Main St, Clarksville, TN 37040',36.5001,-87.3001)
);
assert('wrong same-address venue rejected',
  !g.exactPlaceMatch({...exactPlace,displayName:{text:'Excell Market'}},'Excell Bar-B-Q','100 Main St, Clarksville, TN 37040',36.5001,-87.3001)
);
assert('wrong-city venue rejected',
  !g.exactPlaceMatch({...exactPlace,formattedAddress:'100 Main St, Nashville, TN 37201'},'Excell Bar-B-Q','100 Main St, Clarksville, TN 37040',36.5001,-87.3001)
);
assert('far-away venue rejected',
  !g.exactPlaceMatch({...exactPlace,location:{latitude:36.9,longitude:-87.3}},'Excell Bar-B-Q','100 Main St, Clarksville, TN 37040',36.5001,-87.3001)
);
assert('bar-b-q name normalization',
  g.venueNameMatches('Excell Bar-B-Q','Excell Market & BBQ')
);
assert('photo quality accepts large landscape metadata',
  g.photoQuality({widthPx:1400,heightPx:1050},0)>0
);

const rejected=p.isRejectedPhotoCandidate||(()=>false);
if(typeof rejected==='function'){
 assert('menu image rejected',rejected({url:'https://example.com/menu-board.jpg',label:''}));
 assert('logo image rejected',rejected({url:'https://example.com/brand-logo.png',label:''}));
}

assert('restaurant photo fetch hook available',typeof p.fetchImage==='function');
assert('restaurant photo pipeline refuses generic fallback',
  /function restaurantCardFallbackImage\(\)\{return ''\;\}/.test(fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'))
);

const googleSource=fs.readFileSync(path.join(__dirname,'..','api','google-restaurant-photo.js'),'utf8');
const restaurantSource=fs.readFileSync(path.join(__dirname,'..','api','restaurant-photo.js'),'utf8');
assert('photo quota uses central place-photo SKU',
  googleSource.includes("reserveGoogleSku('place-photo',HARD_LIMITS['place-photo'])")
);
assert('photo quota disable uses central SKU',
  !googleSource.includes('disableGoogleForMonth')
);
assert('Google exact-match field mask includes display name',
  googleSource.includes('places.displayName,places.formattedAddress,places.location')
);
assert('Google request is first fresh-photo attempt',
  /const googlePhoto=await tryGoogleRestaurantPhoto/.test(restaurantSource) &&
  restaurantSource.indexOf('const googlePhoto=await tryGoogleRestaurantPhoto') <
  restaurantSource.indexOf('if\(officialLocationPage\)')
);
assert('no neutral photo response path',
  restaurantSource.includes("return json(res,404,{ok:false,error:'No verified venue photo was found from the allowed non-Google sources'})")
);

console.log(JSON.stringify({
 ok:true,
 exactGoogleMatch:true,
 sameAddressWrongVenueRejected:true,
 farVenueRejected:true,
 compositeAndMenuFiltering:true,
 centralPhotoQuotaGuard:true,
 genericFallbackBlocked:true
},null,2));
