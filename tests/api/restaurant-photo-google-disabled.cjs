'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const handler = require('../../api/restaurant-photo.js');

function capture() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; },
    json(body) { this.body = body; return this; }
  };
}

async function main() {
  const original = process.env.GOOGLE_PHOTOS_ENABLED;
  try {
    process.env.GOOGLE_PHOTOS_ENABLED = 'false';
    assert.equal(handler._test.googlePhotosEnabled(), false);
    process.env.GOOGLE_PHOTOS_ENABLED = 'FALSE';
    assert.equal(handler._test.googlePhotosEnabled(), false);
    delete process.env.GOOGLE_PHOTOS_ENABLED;
    assert.equal(handler._test.googlePhotosEnabled(), true);

    process.env.GOOGLE_PHOTOS_ENABLED = 'false';
    const res = capture();
    await handler({ method: 'GET', query: {} }, res);
    assert.equal(res.headers['x-restaurant-photo-google'], 'disabled');
    assert.equal(res.statusCode, 400);

    const source = fs.readFileSync(require.resolve('../../api/restaurant-photo.js'), 'utf8');
    assert.match(source, /if\s*\(googlePhotosEnabled\)\s*\{\s*const googlePhoto\s*=\s*await tryGoogleRestaurantPhoto/);
    assert.match(source, /res\.setHeader\?\.\('X-Restaurant-Photo-Google', googlePhotosEnabled \? 'enabled' : 'disabled'\)/);
    console.log('PASS restaurant photo Google opt-out switch, response header, and guarded Google call');
  } finally {
    if (original === undefined) delete process.env.GOOGLE_PHOTOS_ENABLED;
    else process.env.GOOGLE_PHOTOS_ENABLED = original;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
