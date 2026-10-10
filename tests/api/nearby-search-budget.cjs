'use strict';

const assert = require('node:assert/strict');

process.env.GOOGLE_PLACES_API_KEY = 'unit-test-key';
process.env.GOOGLE_MASTER_ENABLED = 'true';

const usagePath = require.resolve('../../api/google-usage');
const originalUsage = require(usagePath);
const state = { reservations: [], disabled: [], request: null };
require.cache[usagePath].exports = {
  ...originalUsage,
  reserveGoogleSku: async (sku, limit) => {
    state.reservations.push({ sku, limit });
    return { ok: true, count: state.reservations.length, limit, durable: true, sku };
  },
  disableGoogleSkuForMonth: async sku => {
    state.disabled.push(sku);
    return true;
  },
  googleServicesEnabled: () => true
};

const apiPath = require.resolve('../../api/restaurants.js');
delete require.cache[apiPath];
const api = require(apiPath);
const previousFetch = global.fetch;

async function main() {
  global.fetch = async (url, options = {}) => {
    assert.equal(String(url), 'https://places.googleapis.com/v1/places:searchNearby');
    assert.equal(options.method, 'POST');
    state.request = {
      fieldMask: String(options.headers?.['X-Goog-FieldMask'] || ''),
      body: JSON.parse(String(options.body || '{}'))
    };
    return new Response(JSON.stringify({
      places: [{
        id: 'ChIJMockRestaurant',
        displayName: { text: 'Mock Restaurant' },
        location: { latitude: 36.531, longitude: -87.359 },
        formattedAddress: '123 Main St, Clarksville, TN 37040, USA',
        primaryType: 'restaurant',
        types: ['restaurant'],
        businessStatus: 'OPERATIONAL'
      }]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const result = await api._test.googlePlaces(36.53, -87.36, 10);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].name, 'Mock Restaurant');
    assert.equal(result.rows[0].openNow, undefined);
    assert.equal(result.rows[0].opening_hours, '');
    assert.equal(state.reservations.length, 1);
    assert.deepEqual(state.reservations[0], { sku: 'nearby-search-pro', limit: 4500 });
    assert.ok(state.request.fieldMask.includes('places.displayName'));
    assert.ok(state.request.fieldMask.includes('places.formattedAddress'));
    assert.ok(state.request.fieldMask.includes('places.location'));
    assert.ok(state.request.fieldMask.includes('places.businessStatus'));
    assert.doesNotMatch(state.request.fieldMask, /currentOpeningHours|regularOpeningHours/);
    assert.deepEqual(state.disabled, []);
  } finally {
    global.fetch = previousFetch;
    require.cache[usagePath].exports = originalUsage;
  }

  console.log('Nearby Search Pro budget and lean field mask: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
