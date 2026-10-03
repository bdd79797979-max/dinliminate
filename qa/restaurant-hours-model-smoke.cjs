'use strict';
const assert=require('node:assert/strict');
const handler=require('../api/restaurants.js');
const t=handler._test;
assert.ok(t&&typeof t.serverHoursState==='function','serverHoursState export missing');
assert.ok(typeof t.normalizeRestaurantHours==='function','normalizeRestaurantHours export missing');

const zone='America/Chicago';
const openNow=new Date('2026-09-30T23:30:00.000Z'); // 18:30 CDT on Wednesday.
const late=new Date('2026-09-30T02:00:00.000Z'); // 21:00 CDT on Tuesday.

assert.equal(t.serverHoursState({openNow:true},zone,openNow),'open','provider openNow=true must win');
assert.equal(t.serverHoursState({openNow:false},zone,openNow),'closed','provider openNow=false must win');
assert.equal(t.serverHoursState({},zone,openNow),'unknown','missing hours must remain unknown');

assert.equal(t.serverHoursState({opening_hours:'Mo-Su 17:00-22:00'},zone,openNow),'open','static hours should classify current open period');
assert.equal(t.serverHoursState({opening_hours:'Mo-Su 08:00-17:00'},zone,openNow),'closed','static hours should classify current closed period');
assert.equal(t.serverHoursState({opening_hours:'Mo-Su 20:00-02:00'},zone,late),'open','overnight hours should classify after-midnight/late-evening window');
assert.equal(t.serverHoursState({opening_hours:'Mo-Su 20:00-02:00'},zone,openNow),'closed','overnight hours should not remain open outside the window');

assert.equal(t.serverHoursState({hoursState:'closed',openNow:true},zone,openNow),'closed','normalized hoursState must be authoritative once supplied');
assert.equal(t.serverHoursState({hoursState:'unknown',opening_hours:'24/7',openNow:true},zone,openNow),'unknown','normalized unknown must remain authoritative instead of being overwritten locally');

const normalized=t.normalizeRestaurantHours({id:'demo',name:'Demo',openNow:false,opening_hours:'24/7'},zone,openNow);
assert.equal(normalized.hoursState,'closed');
assert.equal(normalized.hoursSource,'provider-openNow');
assert.equal(normalized.hoursCheckedAt,'2026-09-30T23:30:00.000Z');

console.log(JSON.stringify({
  ok:true,
  cases:10,
  verified:[
    'provider openNow true/false',
    'missing hours -> unknown',
    'scheduled open/closed',
    'overnight schedule',
    'normalized-state precedence',
    'normalized result metadata'
  ]
},null,2));
