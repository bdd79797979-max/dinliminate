'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app.js','utf8');
const api=fs.readFileSync('api/restaurants.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');

assert.match(app,/async function searchRestaurants\(options=\{\}\)/,'Restaurant search should accept an explicit radius override.');
assert.match(app,/Number\(options\?\.radius \?\? \$\('radius'\)\?\.value\)/,'Search should use the radius captured by the change event when supplied.');
assert.match(app,/\$\('radius'\)\.addEventListener\('change', event =>/,'Radius change must be explicitly handled.');
assert.match(app,/const selectedRadius=Math\.min\(100,Math\.max\(1,Number\(event\?\.currentTarget\?\.value\)\|\|10\)\)/,'Radius handler must capture the selected value from the event target.');
assert.match(app,/searchRestaurants\(\{radius:selectedRadius\}\)/,'Radius changes must launch a search using the captured radius.');

assert.match(api,/\(!searchTerm && radius<=10\) \? overpass\(/,'Overpass may run in parallel only for smaller nearby searches.');
assert(api.includes('const hasParallelOsmValue=!!parallelOsmResult?.value;'),'Skipped primary Overpass work must not be mistaken for a completed empty result.');
assert(api.includes('const needsOverpass=!preliminary.length&&!hasParallelOsmValue;'),'Empty fast-provider results must still get a bounded Overpass fallback.');
assert(!api.includes('(!searchTerm && radius<=25) ? overpass('),'25-mile searches must not put the large Overpass query on the critical path.');
assert(api.includes('const providerRadius=wideSearch?Math.min(radius,WIDE_PROVIDER_RADIUS_CAP):radius'),'Provider radius must continue to track the requested radius.');

assert(index.includes('?v=1157'),'Index cache-bust should be 1157.');
assert(sw.includes('dinliminate-shell-v1157'),'Service worker shell version should be 1157.');
console.log('CP1157 restaurant radius smoke: PASS');
