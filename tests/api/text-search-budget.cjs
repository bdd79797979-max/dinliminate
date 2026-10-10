'use strict';

const assert = require('node:assert/strict');

process.env.GOOGLE_PLACES_API_KEY = 'unit-test-key';
process.env.GOOGLE_MASTER_ENABLED = 'true';

const usagePath = require.resolve('../../api/google-usage');
const originalUsage = require(usagePath);
const state = { reservations: [], disabled: [], searchRequests: [], detailsRequests: [] };
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

function placeResponse(overrides = {}) {
  return {
    id: 'ChIJSearchBudgetTest',
    displayName: { text: 'CP1393 Budget Test Restaurant' },
    location: { latitude: 36.531, longitude: -87.359 },
    formattedAddress: '123 Main St, Clarksville, TN 37040, USA',
    primaryType: 'restaurant',
    types: ['restaurant'],
    businessStatus: 'OPERATIONAL',
    ...overrides
  };
}

function capturedResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(body) { this.body = body; return this; }
  };
}

async function main() {
  global.fetch = async (url, options = {}) => {
    const value = String(url);
    if (value === 'https://places.googleapis.com/v1/places:searchText') {
      state.searchRequests.push({
        fieldMask: String(options.headers?.['X-Goog-FieldMask'] || ''),
        body: JSON.parse(String(options.body || '{}'))
      });
      return new Response(JSON.stringify({ places: [placeResponse()] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    if (value === 'https://places.googleapis.com/v1/places/ChIJHoursTargetCP1393') {
      state.detailsRequests.push({
        fieldMask: String(options.headers?.['X-Goog-FieldMask'] || '')
      });
      return new Response(JSON.stringify({
        id: 'ChIJHoursTargetCP1393',
        displayName: { text: 'CP1393 Hours Target Restaurant' },
        formattedAddress: '456 Oak St, Clarksville, TN 37040, USA',
        location: { latitude: 36.532, longitude: -87.358 },
        currentOpeningHours: { openNow: true, weekdayDescriptions: ['Monday: 10:00 AM–9:00 PM'] },
        regularOpeningHours: { weekdayDescriptions: ['Monday: 10:00 AM–9:00 PM'] },
        businessStatus: 'OPERATIONAL',
        nationalPhoneNumber: '(931) 555-0194',
        websiteUri: 'https://restaurant.example/'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    throw new Error('Unexpected fetch URL: ' + value);
  };

  try {
    const search = await api._test.googleSearchPlaces(36.53, -87.36, 10, 'pizza');
    assert.ok(search.rows.some(row => row.name === 'CP1393 Budget Test Restaurant'));
    assert.ok(state.searchRequests.length > 0, 'name/cuisine search must exercise Text Search');
    assert.ok(state.searchRequests.every(request =>
      request.fieldMask.includes('places.displayName') &&
      request.fieldMask.includes('places.formattedAddress') &&
      request.fieldMask.includes('places.location') &&
      !/currentOpeningHours|regularOpeningHours|nationalPhoneNumber|websiteUri/.test(request.fieldMask)
    ), 'routine Text Search must request only Pro-tier fields');
    assert.ok(state.reservations.filter(entry => entry.sku === 'text-search-pro').length > 0);
    assert.ok(state.reservations.every(entry =>
      entry.sku === 'text-search-pro' && entry.limit === 4500
    ), 'routine Text Search must reserve the Pro SKU');
    assert.equal(search.rows[0].openNow, undefined);
    assert.equal(search.rows[0].opening_hours, '');

    state.reservations.length = 0;
    state.searchRequests.length = 0;
    state.detailsRequests.length = 0;

    const hours = await api._test.enrichOpenNowHours([{
      id: 'cp1394-hours-target',
      name: 'CP1394 Hours Target Restaurant',
      address: '456 Oak St, Clarksville, TN 37040',
      lat: 36.532,
      lon: -87.358,
      googlePlaceId: 'ChIJHoursTargetCP1393'
    }]);

    assert.equal(hours.ok, true);
    assert.equal(hours.counts.resolvedByGooglePlaceDetails, 0);
    assert.equal(hours.counts.resolvedByGoogleTextSearch, 0);
    assert.equal(hours.patches.length, 0, 'unknown opening hours remain unverified in the Open filter');
    assert.equal(hours.counts.stillUnknown, 1);
    assert.equal(hours.google.callsUsed, 0);
    assert.equal(hours.google.callsBudget, 0);
    assert.equal(state.detailsRequests.length, 0, 'the Open filter must not request Enterprise Place Details');
    assert.deepEqual(state.reservations, [], 'the Open filter must not reserve any Google Enterprise SKU');
    assert.deepEqual(state.disabled, []);

    const detailsResponse = capturedResponse();
    await api({
      method: 'GET',
      url: '/api/restaurants?mode=details&placeId=ChIJHoursTargetCP1393&name=CP1393%20Hours%20Target%20Restaurant&address=456%20Oak%20St%2C%20Clarksville%2C%20TN%2037040',
      headers: { 'x-forwarded-for': 'cp1394-restaurant-details-test' }
    }, detailsResponse);

    assert.equal(detailsResponse.statusCode, 200);
    assert.equal(detailsResponse.body?.ok, true, 'opening restaurant details should still resolve Google Place Details');
    assert.equal(state.detailsRequests.length, 1);
    assert.match(state.detailsRequests[0].fieldMask, /currentOpeningHours\.openNow/);
    assert.match(state.detailsRequests[0].fieldMask, /regularOpeningHours\.weekdayDescriptions/);
    assert.deepEqual(state.reservations, [
      { sku: 'place-details-enterprise', limit: 900 }
    ], 'Enterprise should be reserved only by the explicit restaurant-details endpoint');
  } finally {
    global.fetch = previousFetch;
    require.cache[usagePath].exports = originalUsage;
  }

  console.log('Text Search Pro budgeting, no-Enterprise Open filter, and Enterprise restaurant details: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
