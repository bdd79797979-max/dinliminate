'use strict';

const assert = require('node:assert/strict');
const library = require('../../api/_lib/restaurant-library');
const photoHandler = require('../../api/restaurant-photo');
const libraryHandler = require('../../api/restaurant-library');

function responseHarness() {
  const headers = {};
  return { headers, statusCode: 200, body: '', setHeader(name, value) { headers[String(name).toLowerCase()] = String(value); },
    end(value) { this.body = value == null ? '' : String(value); } };
}

function clearConfig() {
  for (const key of ['RESTAURANT_LIBRARY_DATABASE_URL', 'DATABASE_URL', 'POSTGRES_URL', 'FAMILY_DATABASE_URL',
    'BLOB_READ_WRITE_TOKEN', 'VERCEL_OIDC_TOKEN', 'BLOB_STORE_ID', 'RESTAURANT_LIBRARY_RETENTION_HOSTS']) delete process.env[key];
}

async function main() {
  clearConfig();
  library._test.resetAdapters();
  assert.equal(library._test.normalizeName("Café & Grill"), 'cafe and grill');
  assert.equal(library._test.normalizeAddress('12 Main Street, Suite 4'), '12 main st ste 4');
  assert.equal(library._test.restaurantKey('Cafe', '12 Main St'), library._test.restaurantKey('Café', '12 Main Street'));
  assert.equal(library._test.isRetentionEligible('https://images.googleusercontent.com/photo.jpg', ['googleusercontent.com']), false);
  assert.equal(library._test.isRetentionEligible('http://approved.example/photo.jpg', ['approved.example']), false);
  assert.equal(library._test.isRetentionEligible('https://cdn.approved.example/photo.jpg', ['approved.example']), true);
  assert.deepEqual(await library.rememberRestaurantPhoto({ name: 'Cafe', address: '12 Main St' }),
    { stored: false, reason: 'database-not-configured' });

  process.env.DATABASE_URL = 'postgres://test';
  process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
  process.env.RESTAURANT_LIBRARY_RETENTION_HOSTS = 'approved.example';
  let putCount = 0;
  const queryLog = [];
  library._test.setAdapters({
    sqlFactory: () => ({ async query(query, params) {
      queryLog.push({ query, params });
      if (/SELECT image_id, blob_url/.test(query)) return [];
      if (/INSERT INTO dinliminate_restaurant_library/.test(query)) return [{ restaurant_key: params[0] }];
      return [];
    } }),
    put: async (path, bytes, options) => { putCount++; assert.equal(options.access, 'public'); return { url: 'https://test.public.blob.vercel-storage.com/' + path }; }
  });
  const bytes = Buffer.alloc(1600);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const common = { name: 'Cafe', address: '12 Main Street', sourceUrl: 'https://cdn.approved.example/cafe.png',
    retentionBasis: 'operator-approved-retention-host:cdn.approved.example',
    media: { bytes, type: 'image/png', width: 640, height: 480 } };
  assert.deepEqual(await library.rememberRestaurantPhoto({ ...common, source: 'google-places' }),
    { stored: false, reason: 'google-content-not-retained' });
  assert.equal(putCount, 0, 'Google images must never reach Blob');
  assert.deepEqual(await library.rememberRestaurantPhoto({ ...common, source: 'official-venue-page',
    sourceUrl: 'https://unapproved.example/cafe.png' }),
  { stored: false, reason: 'source-retention-not-explicitly-eligible' });
  assert.equal(putCount, 0, 'unapproved sources must never reach Blob');
  const stored = await library.rememberRestaurantPhoto({ ...common, source: 'official-venue-page' });
  assert.equal(stored.stored, true);
  assert.equal(putCount, 1);
  assert.ok(queryLog.some(entry => /CREATE TABLE IF NOT EXISTS dinliminate_restaurant_images/.test(entry.query)));
  assert.ok(queryLog.some(entry => /retention_basis/.test(entry.query)), 'retention basis must be recorded in metadata');

  library._test.resetAdapters();
  const metadataRow = { restaurant_key: library._test.restaurantKey('Cafe', '12 Main Street'), name: 'Cafe', address: '12 Main Street' };
  library._test.setAdapters({ sqlFactory: () => ({ async query(query) {
    if (/INSERT INTO dinliminate_restaurant_library/.test(query)) return [metadataRow];
    if (/SELECT restaurant_key, name, address/.test(query)) return [metadataRow];
    if (/DELETE FROM dinliminate_restaurant_library/.test(query)) return [metadataRow];
    return [];
  } }) });
  assert.equal((await library.upsertRestaurantMetadata({ name: 'Cafe', address: '12 Main Street' })).restaurant_key, metadataRow.restaurant_key);
  assert.equal((await library.getRestaurantMetadata({ name: 'Cafe', address: '12 Main Street' })).name, 'Cafe');
  assert.equal(await library.deleteRestaurantMetadata({ name: 'Cafe', address: '12 Main Street' }), true);

  // Verify the production photo route reads the retained library before invoking a search fallback.
  library._test.resetAdapters();
  const cachedUrl = 'https://cache.public.blob.vercel-storage.com/restaurant-library/item.webp';
  library._test.setAdapters({ sqlFactory: () => ({ async query(query) {
    if (/SELECT i.image_id/.test(query)) return [{ image_id: 'cached', blob_url: cachedUrl }];
    return [];
  } }) });
  const photoResponse = responseHarness();
  await photoHandler({ method: 'GET', query: { name: 'Cafe', address: '12 Main Street' } }, photoResponse);
  assert.equal(photoResponse.statusCode, 302);
  assert.equal(photoResponse.headers.location, cachedUrl);
  assert.equal(photoResponse.headers['x-restaurant-photo-source'], 'restaurant-library');

  const metadataRouteResponse = responseHarness();
  library._test.resetAdapters();
  library._test.setAdapters({ sqlFactory: () => ({ async query(query) {
    if (/SELECT restaurant_key, name, address/.test(query)) return [metadataRow];
    return [];
  } }) });
  await libraryHandler({ method: 'GET', query: { name: 'Cafe', address: '12 Main Street' } }, metadataRouteResponse);
  assert.equal(metadataRouteResponse.statusCode, 200);
  assert.equal(JSON.parse(metadataRouteResponse.body).restaurant.name, 'Cafe');

  const healthResponse = responseHarness();
  await libraryHandler({ method: 'GET', query: { mode: 'health' } }, healthResponse);
  assert.equal(healthResponse.statusCode, 200);
  assert.equal(JSON.parse(healthResponse.body).googlePlacesPhotosRetained, false);
  const deniedResponse = responseHarness();
  await libraryHandler({ method: 'POST', query: { mode: 'health' } }, deniedResponse);
  assert.equal(deniedResponse.statusCode, 405);
  const invalidPhotoResponse = responseHarness();
  await photoHandler({ method: 'GET', query: {} }, invalidPhotoResponse);
  assert.equal(invalidPhotoResponse.statusCode, 400);

  clearConfig();
  library._test.resetAdapters();
  console.log('Restaurant library normalization, eligibility, missing config, CRUD helpers and routes: PASS');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
