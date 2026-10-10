'use strict';

const assert = require('node:assert/strict');
const handler = require('../../api/restaurants.js');

const response = body => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  text: async () => JSON.stringify(body),
  json: async () => body
});

function capture() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(body) { this.body = body; return this; }
  };
}

function photonFeature(name, lat, lon, props = {}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { name, ...props }
  };
}

async function withFetch(mock, fn) {
  const previous = global.fetch;
  global.fetch = mock;
  try {
    return await fn();
  } finally {
    global.fetch = previous;
  }
}

async function main() {
  let res = capture();

  await withFetch(async () => response({}), async () => {
    await handler({
      method: 'GET',
      url: '/api/restaurants?mode=health',
      headers: { 'x-forwarded-for': 'api-health-test' }
    }, res);
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.version, 'r50');
  assert.equal(res.body.maxRadiusMiles, 100);

  res = capture();
  await withFetch(async () => response({}), async () => {
    await handler({
      method: 'POST',
      url: '/api/restaurants?mode=hours',
      headers: { 'x-forwarded-for': 'api-hours-test' },
      body: { maxGoogleCalls: 36, rows: [{
        id: 'known-hours', name: 'Known Restaurant',
        address: '123 Main St, Clarksville, TN 37040',
        lat: 36.53, lon: -87.36, openNow: true,
        opening_hours: 'Monday: 10:00 AM–9:00 PM'
      }] }
    }, res);
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.patches, []);
  assert.equal(res.body.counts.total, 1);
  assert.equal(res.body.counts.alreadyKnown, 1);
  assert.equal(res.body.google.callsUsed, 0);
  assert.equal(res.body.processedRows, 1);
  assert.equal(res.headers['Cache-Control'], 'no-store');

  res = capture();
  await handler({
    method: 'GET',
    url: '/api/restaurants?mode=hours',
    headers: { 'x-forwarded-for': 'api-hours-method-test' }
  }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
  assert.equal(res.body.ok, false);

  res = capture();
  await handler({
    method: 'POST',
    url: '/api/restaurants?mode=hours',
    headers: { 'x-forwarded-for': 'api-hours-invalid-test' },
    body: '{'
  }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);

  res = capture();

  await withFetch(async url => {
    const value = String(url);

    if (value.includes('photon.komoot.io')) {
      return response({
        features: [
          photonFeature('Mock Pizza Kitchen', 36.531, -87.359, {
            osm_key: 'amenity',
            osm_value: 'restaurant',
            cuisine: 'pizza'
          }),
          photonFeature('Mock Taco House', 36.532, -87.358, {
            osm_key: 'amenity',
            osm_value: 'fast_food',
            cuisine: 'mexican'
          })
        ]
      });
    }

    if (value.includes('geocode.arcgis.com')) return response({ candidates: [] });
    if (value.includes('open-meteo.com')) return response({ timezone: 'America/Chicago' });
    if (value.includes('overpass')) return response({ elements: [] });

    throw new Error('unexpected provider URL: ' + value);
  }, async () => {
    await handler({
      method: 'GET',
      url: '/api/restaurants?mode=search&lat=36.53&lon=-87.36&radius=10&q=Pizza',
      headers: { 'x-forwarded-for': 'api-search-test' }
    }, res);
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.radiusMiles, 10);
  assert.equal(res.body.searchQuery, 'pizza');
  assert.ok(Array.isArray(res.body.results));

  const pizza = res.body.results.find(row => row.name === 'Mock Pizza Kitchen');
  assert.ok(pizza);
  assert.equal(pizza.cuisine, 'pizza');
  assert.equal(pizza.hoursTimeZone, 'America/Chicago');

  res = capture();

  await withFetch(async () => response({}), async () => {
    await handler({
      method: 'GET',
      url: '/api/restaurants?mode=search&lat=999&lon=-87.36&radius=10',
      headers: { 'x-forwarded-for': 'api-invalid-test' }
    }, res);
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);

  console.log('Restaurant API behavior: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
