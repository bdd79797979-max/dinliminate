'use strict';

const { json } = require('./_lib/http');
const library = require('./_lib/restaurant-library');

module.exports = async function restaurantLibraryHandler(req, res) {
  res.setHeader?.('Cache-Control', 'no-store');
  res.setHeader?.('X-Content-Type-Options', 'nosniff');
  if (String(req?.method || 'GET').toUpperCase() !== 'GET')
    return json(res, 405, { ok: false, error: 'GET required' });
  const query = req?.query && typeof req.query === 'object' ? req.query : (req?.queryStringParameters || {});
  if (String(query.mode || '').toLowerCase() === 'health')
    return json(res, 200, await library.restaurantLibraryHealth());
  const name = String(query.name || '').trim().slice(0, 160);
  const address = String(query.address || '').trim().slice(0, 240);
  if (!name || !address) return json(res, 400, { ok: false, error: 'Restaurant name and address are required' });
  try {
    const restaurant = await library.getRestaurantMetadata({ name, address });
    if (!restaurant) return json(res, 404, { ok: false, error: 'Restaurant not found in library' });
    return json(res, 200, { ok: true, restaurant });
  } catch (error) {
    console.error('Dinliminate restaurant library lookup failed', error);
    return json(res, 503, { ok: false, error: 'Restaurant library unavailable' });
  }
};
