'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const handler = require('../../api/restaurant-photo.js');

async function main() {
  const original = process.env.GOOGLE_PHOTOS_ENABLED;
  try {
    process.env.GOOGLE_PHOTOS_ENABLED = 'false';
    assert.equal(handler._test.googlePhotosEnabled(), false);

    const mockResponse = () => ({
      headers: {},
      statusCode: 200,
      body: '',
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      end(body) { this.body = body == null ? '' : body; },
    });
    const methodResponse = mockResponse();
    await handler({ method: 'POST', query: {} }, methodResponse);
    assert.equal(methodResponse.statusCode, 405, 'unsupported methods must return HTTP 405');
    assert.equal(methodResponse.headers['x-restaurant-photo-google'], 'disabled');
    assert.match(methodResponse.headers['content-type'], /application\/json/i);
    assert.deepEqual(JSON.parse(methodResponse.body), { ok: false, error: 'GET required' });

    const missingNameResponse = mockResponse();
    await handler({ method: 'GET', query: {} }, missingNameResponse);
    assert.equal(missingNameResponse.statusCode, 400, 'missing restaurant name must return HTTP 400');
    assert.deepEqual(JSON.parse(missingNameResponse.body), { ok: false, error: 'Restaurant name is required' });
    process.env.GOOGLE_PHOTOS_ENABLED = 'FALSE';
    assert.equal(handler._test.googlePhotosEnabled(), false);
    process.env.GOOGLE_PHOTOS_ENABLED = 'true';
    assert.equal(handler._test.googlePhotosEnabled(), true);
    delete process.env.GOOGLE_PHOTOS_ENABLED;
    assert.equal(handler._test.googlePhotosEnabled(), true);

    const source = fs.readFileSync(require.resolve('../../api/restaurant-photo.js'), 'utf8');
    assert.match(source, /if\s*\(googlePhotosEnabled\)\s*\{\s*const googlePhoto\s*=\s*await tryGoogleRestaurantPhoto/);
    assert.match(source, /res\.setHeader\?\.\('X-Restaurant-Photo-Google', googlePhotosEnabled \? 'enabled' : 'disabled'\)/);
    console.log('PASS restaurant photo Google opt-out switch, response header, and guarded Google call');
  } finally {
    if (original === undefined) delete process.env.GOOGLE_PHOTOS_ENABLED;
    else process.env.GOOGLE_PHOTOS_ENABLED = original;
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
