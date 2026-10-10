'use strict';

const assert = require('node:assert/strict');
const handler = require('../../api/restaurant-photo');

function responseHarness() {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    body: '',
    setHeader(name, value) { headers[String(name).toLowerCase()] = String(value); },
    end(value) { this.body = String(value ?? ''); }
  };
}

async function main() {
  const res = responseHarness();
  await handler({ method: 'GET', query: {} }, res);

  assert.equal(res.statusCode, 400, 'missing restaurant name should return a client error');
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.deepEqual(JSON.parse(res.body), {
    ok: false,
    error: 'Restaurant name is required'
  });

  console.log('Restaurant photo invalid-input response: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
