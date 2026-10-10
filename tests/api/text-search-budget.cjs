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
        nationalPhoneNumber: '',
        websiteUri: ''
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
      id: 'cp1393-hours-target',
      name: 'CP1393 Hours Target Restaurant',
      address: '456 Oak St, Clarksville, TN 37040',
      lat: 36.532,
      lon: -87.358,
      googlePlaceId: 'ChIJHoursTargetCP1393'
    }], { maxGoogleCalls: 3 });

    assert.equal(hours.ok, true);
    assert.equal(hours.counts.googlePlaceDetails, 1);
    assert.equal(hours.patches.length, 1);
    assert.equal(hours.patches[0].openNow, true);
    assert.ok(state.detailsRequests.length === 1, 'the Open filter path should use the targeted Place Details request');
    assert.match(state.detailsRequests[0].fieldMask, /currentOpeningHours\.openNow/);
    assert.match(state.detailsRequests[0].fieldMask, /regularOpeningHours\.weekdayDescriptions/);
    assert.deepEqual(state.reservations, [
      { sku: 'place-details-enterprise', limit: 900 }
    ], 'Enterprise should be charged only when targeted hours are requested');
    assert.deepEqual(state.disabled, []);
  } finally {
    global.fetch = previousFetch;
    require.cache[usagePath].exports = originalUsage;
  }

  console.log('Text Search Pro budgeting and targeted Enterprise hours resolution: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
