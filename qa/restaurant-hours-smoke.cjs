'use strict';

const fs=require('node:fs');
const path=require('node:path');

const appSource=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const apiSource=fs.readFileSync(path.join(__dirname,'..','api','restaurants.js'),'utf8');

function assert(name,condition,detail=''){
 if(!condition)throw new Error(name+(detail?': '+detail:''));
}

function between(source,start,end){
 const i=source.indexOf(start),j=source.indexOf(end,i);
 if(i<0||j<0)throw new Error('Could not isolate '+start);
 return source.slice(i,j);
}

const clockSource=between(appSource,'function restaurantClockParts(row){','\nfunction restaurantHoursState');
const stateSource=between(appSource,'function restaurantHoursState(row){','\nfunction restaurantHoursMatches');

class FixedDate extends Date{
 constructor(){super('2026-10-06T09:30:00.000Z')}
 static now(){return new Date('2026-10-06T09:30:00.000Z').getTime()}
}

const withTimezone=new Function('S','Date',clockSource+'\n'+stateSource+';return restaurantHoursState;')(
 {restaurantSearchTimeZone:'Pacific/Honolulu'},FixedDate
);
const localClock=new Function('S','Date',clockSource+'\n'+stateSource+';return restaurantHoursState;')(
 {restaurantSearchTimeZone:''},FixedDate
);

assert('multiple same-day intervals stay open',
 withTimezone({opening_hours:'Mo 22:00-23:00, 23:15-23:45',hoursTimeZone:'Pacific/Honolulu'})==='open'
);
assert('cross-midnight interval stays open',
 withTimezone({opening_hours:'Mo 22:00-02:00',hoursTimeZone:'Pacific/Honolulu'})==='open'
);
assert('timezone changes weekday calculation',
 localClock({opening_hours:'Mo 22:00-23:00, 23:15-23:45'})!=='open'
);

const apiModule={exports:{}};
const tax={};
new Function('module','exports','process',fs.readFileSync(path.join(__dirname,'..','data','restaurant-taxonomy.js'),'utf8'))({exports:tax},tax,{env:{}});
const usageStub={HARD_LIMITS:{},reserveGoogleSku:async()=>({ok:true}),disableGoogleSkuForMonth:async()=>{},googleUsageHealth:async()=>({})};
new Function('require','module','exports','process',apiSource)(
 p=>p.includes('restaurant-taxonomy')?tax:usageStub,
 apiModule,apiModule.exports,{env:{},NODE_ENV:'test'}
);
assert('timezone resolver exported',typeof apiModule.exports._test?.hoursTimezoneForCoordinates==='function');
assert('timezone resolver source uses auto timezone',
 apiSource.includes("timezone:'auto'")&&apiSource.includes('https://api.open-meteo.com/v1/forecast')
);
assert('OSM hours provenance',apiSource.includes("hoursSource:String(t.opening_hours||'')?'OpenStreetMap':'"'));
assert('search response carries hours timezone',
 apiSource.includes("hoursTimeZone:String(hoursTimeZone||r.hoursTimeZone||'')")
);
assert('multi-interval parser uses repeated time matches',
 appSource.includes("matchAll(new RegExp(timeRe.source,'gi'))")
);
console.log(JSON.stringify({ok:true,timezoneAware:true,multipleIntervals:true,crossMidnight:true,branch:'cp1080-restaurant-hours-reliability'},null,2));
