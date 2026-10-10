'use strict';

const assert = require('node:assert/strict');

process.env.GOOGLE_PLACES_API_KEY = 'unit-test-key';
process.env.GOOGLE_MASTER_ENABLED = 'true';

const usagePath = require.resolve('../../api/google-usage');
const originalUsage = require(usagePath);
const state = { reservations: [], disabled: [], mediaRequests: [] };
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

const photoPath = require.resolve('../../api/google-restaurant-photo');
delete require.cache[photoPath];
const photo = require(photoPath);

const PLACE = {
  id: 'ChIJTestPlace123',
  displayName: { text: 'Mock Pizza Kitchen' },
  formattedAddress: '123 Main St, Clarksville, TN 37040, USA',
  location: { latitude: 36.531, longitude: -87.359 },
  photos: [
    {
      name: 'places/ChIJTestPlace123/photos/photo-best',
      widthPx: 1600,
      heightPx: 1200,
      googleMapsUri: 'https://maps.google.com/?cid=1',
      authorAttributions: []
    },
    {
      name: 'places/ChIJTestPlace123/photos/photo-second',
      widthPx: 2000,
      heightPx: 1100,
      googleMapsUri: 'https://maps.google.com/?cid=1',
      authorAttributions: []
    }
  ]
};

function makeResponse(body, status = 200, contentType = 'application/json') {
  const content = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  return new Response(content, { status, headers: { 'content-type': contentType } });
}
function reset() {
  state.reservations.length = 0;
  state.disabled.length = 0;
  state.mediaRequests.length = 0;
}
function requestInput() {
  return {
    name: 'Mock Pizza Kitchen',
    address: '123 Main St, Clarksville, TN 37040',
    lat: 36.531,
    lon: -87.359,
    placeId: 'ChIJTestPlace123'
  };
}
async function withMockFetch(mock, fn) {
  const previous = global.fetch;
  global.fetch = mock;
  try { await fn(); }
  finally { global.fetch = previous; }
}

async function main() {
  const limits = require.cache[usagePath].exports.HARD_LIMITS;
  assert.equal(limits['place-details-pro'], 4500, 'Place Details including displayName uses the Pro budget');
  assert.equal(limits['place-details-essentials'], 9000, 'Essentials retains its own cap');
  assert.equal(limits['text-search-pro'], 4500);
  assert.equal(limits['place-photo'], 900);

  await withMockFetch(async url => {
    const value = String(url);
    if (value.includes('/media?')) {
      state.mediaRequests.push(value);
      return makeResponse(Buffer.alloc(5001, 0x11), 200, 'image/jpeg');
    }
    if (value.includes('/v1/places/ChIJTestPlace123')) return makeResponse(PLACE);
    throw new Error('Unexpected Google URL: ' + value);
  }, async () => {
    reset();
    const result = await photo._test.tryGoogleRestaurantPhoto(requestInput());
    assert.equal(result?.source, 'google-places');
    assert.ok(state.reservations.some(entry => entry.sku === 'place-details-pro' && entry.limit === 4500));
    assert.ok(state.reservations.some(entry => entry.sku === 'place-photo' && entry.limit === 900));
    assert.equal(state.mediaRequests.length, 1, 'only the highest-ranked photo should be fetched');
    assert.match(state.mediaRequests[0], /photo-best\/media\?/);
  });

  await withMockFetch(async url => {
    const value = String(url);
    if (value.includes('/media?')) {
      state.mediaRequests.push(value);
      return makeResponse({ error: { message: 'Temporary upstream failure' } }, 503);
    }
    if (value.includes('/v1/places/ChIJTestPlace123')) return makeResponse(PLACE);
    throw new Error('Unexpected Google URL: ' + value);
  }, async () => {
    reset();
    const result = await photo._test.tryGoogleRestaurantPhoto(requestInput());
    assert.equal(result, null);
    assert.equal(state.mediaRequests.length, 1, 'a failed best photo must not trigger a second Google media request');
    assert.deepEqual(state.disabled, [], 'a temporary media failure must not disable the monthly SKU');
  });

  await withMockFetch(async url => {
    const value = String(url);
    if (value.includes('/v1/places/ChIJTestPlace123')) {
      return makeResponse({ error: { message: 'Quota exceeded for Place Details' } }, 403);
    }
    throw new Error('Unexpected Google URL: ' + value);
  }, async () => {
    reset();
    const result = await photo._test.tryGoogleRestaurantPhoto(requestInput());
    assert.equal(result, null);
    assert.deepEqual(state.disabled, ['place-details-pro'], 'a Details quota error must disable only the Details Pro SKU');
    assert.equal(state.reservations[0]?.sku, 'place-details-pro');
  });

  await withMockFetch(async url => {
    const value = String(url);
    if (value.includes('/media?')) {
      state.mediaRequests.push(value);
      return makeResponse({ error: { message: 'Quota exceeded for Places Photos' } }, 403);
    }
    if (value.includes('/v1/places/ChIJTestPlace123')) return makeResponse(PLACE);
    throw new Error('Unexpected Google URL: ' + value);
  }, async () => {
    reset();
    const result = await photo._test.tryGoogleRestaurantPhoto(requestInput());
    assert.equal(result, null);
    assert.deepEqual(state.disabled, ['place-photo'], 'a photo-media quota error must disable only the photo SKU');
  });

  console.log('Google photo SKU budgeting and request caps: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
