/**
 * Dinliminate Radius Engine v2
 * CP1191 foundation.
 *
 * This module owns geographic coverage geometry only. Provider adapters are
 * injected by the restaurant API so Google, ArcGIS, Overpass, and Photon
 * cannot redefine the user's selected radius.
 *
 * Contract:
 *   buildCoverageGrid({ lat, lon, radiusMiles })
 *   queryCoverageGrid({ grid, providerTasks, concurrency })
 *   exactDistanceFilter(rows, origin, radiusMiles)
 *   runRadiusEngine({ lat, lon, radiusMiles, providers, dedupe, concurrency })
 *
 * A provider task receives:
 *   { tile, origin, radiusMiles, searchTerm }
 * and must return { rows: [], errors: [] }.
 */

const EARTH_RADIUS_MILES = 3958.7613;
const MILES_PER_LATITUDE_DEGREE = 69.0;
const MIN_RADIUS_MILES = 1;
const MAX_RADIUS_MILES = 100;

function n(value, fallback = NaN) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function clampRadius(value) {
  return Math.min(
    MAX_RADIUS_MILES,
    Math.max(MIN_RADIUS_MILES, n(value, MIN_RADIUS_MILES))
  );
}

function validCoordinates(lat, lon) {
  return Number.isFinite(n(lat)) &&
    Number.isFinite(n(lon)) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180;
}

function milesBetween(lat1, lon1, lat2, lon2) {
  const a1 = n(lat1);
  const o1 = n(lon1);
  const a2 = n(lat2);
  const o2 = n(lon2);

  if (![a1, o1, a2, o2].every(Number.isFinite)) return Infinity;

  const radians = Math.PI / 180;
  const x = (a2 - a1) * radians;
  const y = (o2 - o1) * radians;
  const h =
    Math.sin(x / 2) ** 2 +
    Math.cos(a1 * radians) *
      Math.cos(a2 * radians) *
      Math.sin(y / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(Math.min(1, h)));
}

function milesToDegrees(lat, lon, northMiles, eastMiles) {
  const latitude = lat + northMiles / MILES_PER_LATITUDE_DEGREE;
  const longitudeScale =
    MILES_PER_LATITUDE_DEGREE *
    Math.max(0.2, Math.abs(Math.cos(lat * Math.PI / 180)));
  const longitude = lon + eastMiles / longitudeScale;
  return { lat: latitude, lon: longitude };
}

/**
 * Pick a conservative provider query radius and lattice spacing.
 *
 * The largest tile remains below the common 50-mile upstream limit. The
 * lattice spacing is intentionally tighter than the theoretical sqrt(3)
 * circle-covering threshold, giving overlap between adjacent provider areas.
 */
function coverageSpec(radiusMiles) {
  const radius = clampRadius(radiusMiles);

  if (radius <= 3) {
    return { tileRadiusMiles: radius, ringMiles: 0, count: 0 };
  }

  if (radius <= 5) {
    return { tileRadiusMiles: 4, ringMiles: 4, count: 6 };
  }

  if (radius <= 7) {
    return { tileRadiusMiles: 5.5, ringMiles: 5.5, count: 6 };
  }

  if (radius <= 10) {
    return { tileRadiusMiles: 6.5, ringMiles: 6, count: 6 };
  }

  if (radius <= 25) {
    return { tileRadiusMiles: 15, ringMiles: 15, count: 6 };
  }

  if (radius <= 50) {
    return { tileRadiusMiles: 30, ringMiles: 30, count: 6 };
  }

  // 13 deterministic tiles cover the full 100-mile disk while keeping
  // every provider request under the common 50-mile geographic query cap.
  return { tileRadiusMiles: 45, ringMiles: 65, count: 12 };
}

/**
 * Build a deterministic hexagonal coverage lattice.
 *
 * Every selected-radius point is within tileRadiusMiles of at least one
 * retained tile center, including points near the selected-radius boundary.
 */
function buildCoverageGrid({ lat, lon, radiusMiles }) {
  if (!validCoordinates(lat, lon)) {
    throw new Error('Radius engine requires valid origin coordinates.');
  }

  const radius = clampRadius(radiusMiles);
  const spec = coverageSpec(radius);
  const origin = { lat: Number(lat), lon: Number(lon) };

  const tiles = [{
    id: 'tile-origin',
    q: 0,
    r: 0,
    lat: origin.lat,
    lon: origin.lon,
    queryRadiusMiles: spec.tileRadiusMiles,
    centerDistanceMiles: 0
  }];

  if (spec.count > 0) {
    for (let i = 0; i < spec.count; i += 1) {
      const angle = i * 2 * Math.PI / spec.count;
      const point = milesToDegrees(
        origin.lat,
        origin.lon,
        Math.sin(angle) * spec.ringMiles,
        Math.cos(angle) * spec.ringMiles
      );
      if (!validCoordinates(point.lat, point.lon)) continue;

      tiles.push({
        id: 'tile-ring-' + i,
        q: 0,
        r: i,
        lat: point.lat,
        lon: point.lon,
        queryRadiusMiles: spec.tileRadiusMiles,
        centerDistanceMiles: milesBetween(
          origin.lat,
          origin.lon,
          point.lat,
          point.lon
        )
      });
    }
  }

  return {
    origin,
    radiusMiles: radius,
    tileRadiusMiles: spec.tileRadiusMiles,
    ringMiles: spec.ringMiles,
    tiles
  };
}
function tileCoverageIsSufficient(grid, sampleCount = 720) {
  const radius = Number(grid?.radiusMiles);
  if (!Number.isFinite(radius) || radius <= 0) return false;

  for (let i = 0; i < sampleCount; i += 1) {
    const angle = (i / sampleCount) * Math.PI * 2;
    const north = radius * Math.sin(angle);
    const east = radius * Math.cos(angle);
    const point = milesToDegrees(grid.origin.lat, grid.origin.lon, north, east);
    const nearest = Math.min(...grid.tiles.map(tile =>
      milesBetween(point.lat, point.lon, tile.lat, tile.lon)
    ));
    if (nearest > Number(grid.tileRadiusMiles) + 0.15) return false;
  }
  return true;
}

function rowCoordinates(row) {
  const lat = n(row?.lat);
  const lon = n(row?.lon ?? row?.lng);
  return { lat, lon };
}

function exactDistanceFilter(rows, origin, radiusMiles) {
  const radius = clampRadius(radiusMiles);
  const lat = n(origin?.lat);
  const lon = n(origin?.lon);

  return (rows || [])
    .map(row => {
      const point = rowCoordinates(row);
      const distance = milesBetween(lat, lon, point.lat, point.lon);
      return {
        ...row,
        distance
      };
    })
    .filter(row =>
      Number.isFinite(row.distance) &&
      row.distance <= radius + 0.001
    )
    .sort((a, b) => a.distance - b.distance);
}

function fallbackIdentityKey(row) {
  const name = String(row?.name || '').trim().toLowerCase();
  const address = String(row?.address || '').trim().toLowerCase();
  const id = String(row?.id || row?.googlePlaceId || '').trim().toLowerCase();

  if (id) return 'id:' + id;
  if (name || address) return 'name:' + name + '|address:' + address;

  const lat = n(row?.lat);
  const lon = n(row?.lon ?? row?.lng);
  return Number.isFinite(lat) && Number.isFinite(lon)
    ? 'geo:' + lat.toFixed(5) + '|' + lon.toFixed(5)
    : 'row:' + JSON.stringify(row);
}

function fallbackDedupe(rows) {
  const map = new Map();

  for (const row of rows || []) {
    const key = fallbackIdentityKey(row);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, { ...row });
      continue;
    }

    // Keep the first provider's canonical identity but fill obvious gaps.
    for (const field of [
      'address',
      'phone',
      'website',
      'opening_hours',
      'photo',
      'googlePlaceId'
    ]) {
      if (!existing[field] && row[field]) existing[field] = row[field];
    }
  }

  return [...map.values()];
}

async function mapWithConcurrency(items, concurrency, worker, perTaskTimeoutMs = 0) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(
    1,
    Math.min(Number(concurrency) || 1, Math.max(1, list.length))
  );
  const output = new Array(list.length);
  let cursor = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= list.length) return;

      try {
        const work = Promise.resolve().then(() => worker(list[index], index));
        if (perTaskTimeoutMs > 0) {
          output[index] = await Promise.race([
            work,
            new Promise(resolve => setTimeout(() => resolve({
              rows: [],
              errors: ['Radius provider tile timed out']
            }), perTaskTimeoutMs))
          ]);
        } else {
          output[index] = await work;
        }
      } catch (error) {
        output[index] = {
          rows: [],
          errors: [String(error?.message || error || 'Provider task failed')]
        };
      }
    }
  });

  await Promise.all(workers);
  return output;
}

/**
 * Run provider tasks over the same geographic grid.
 *
 * providers:
 *   [{ name, query(tile, context) }]
 */
async function queryCoverageGrid({
  grid,
  providers = [],
  searchTerm = '',
  concurrency = 6
}) {
  const providerList = Array.isArray(providers) ? providers : [];
  const tasks = [];

  for (const provider of providerList) {
    if (!provider || typeof provider.query !== 'function') continue;

    for (const tile of grid.tiles || []) {
      tasks.push({
        provider: String(provider.name || 'provider'),
        tile,
        query: provider.query,
      });
    }
  }

  const settled = await mapWithConcurrency(
    tasks,
    concurrency,
    async task => {
      const result = await task.query({
        tile: task.tile,
        origin: grid.origin,
        radiusMiles: grid.radiusMiles,
        searchTerm
      });

      return {
        provider: task.provider,
        tile: task.tile,
        rows: Array.isArray(result?.rows) ? result.rows : [],
        errors: Array.isArray(result?.errors) ? result.errors : [],
        nestedProviderStats: result?.providerStats && typeof result.providerStats === 'object'
          ? result.providerStats
          : null
      };
    }
  );

  const rows = [];
  const errors = [];
  const providerStats = {};

  for (const result of settled) {
    const provider = result?.provider || 'provider';
    if (!providerStats[provider]) {
      providerStats[provider] = {
        tiles: 0,
        rows: 0,
        errors: 0
      };
    }

    providerStats[provider].tiles += 1;
    providerStats[provider].rows += result?.rows?.length || 0;
    providerStats[provider].errors += result?.errors?.length || 0;

    for (const [nestedName, stats] of Object.entries(result?.nestedProviderStats || {})) {
      if (!providerStats[nestedName]) {
        providerStats[nestedName] = { tiles: 0, rows: 0, errors: 0 };
      }
      providerStats[nestedName].tiles += Number(stats?.tiles || 0);
      providerStats[nestedName].rows += Number(stats?.rows || 0);
      providerStats[nestedName].errors += Number(stats?.errors || 0);
    }

    rows.push(...(result?.rows || []));
    errors.push(...(result?.errors || []));
  }

  return {
    rows,
    errors,
    providerStats
  };
}

async function runRadiusEngine({
  lat,
  lon,
  radiusMiles,
  searchTerm = '',
  providers = [],
  dedupe = fallbackDedupe,
  concurrency = 7,
  perTileTimeoutMs = 4500
}) {
  const grid = buildCoverageGrid({ lat, lon, radiusMiles });
  if (!tileCoverageIsSufficient(grid)) {
    throw new Error('Radius engine coverage grid failed its coverage invariant.');
  }

  const startedAt = Date.now();
  const discovered = await queryCoverageGrid({
    grid,
    providers,
    searchTerm,
    concurrency,
    perTileTimeoutMs
  });

  const merged = exactDistanceFilter(
    dedupe(discovered.rows),
    grid.origin,
    grid.radiusMiles
  );

  return {
    ok: true,
    origin: grid.origin,
    radiusMiles: grid.radiusMiles,
    tileRadiusMiles: grid.tileRadiusMiles,
    ringMiles: grid.ringMiles,
    tileCount: grid.tiles.length,
    coverageVerified: true,
    elapsedMs: Date.now() - startedAt,
    providerStats: discovered.providerStats,
    errors: discovered.errors.slice(0, 20),
    rows: merged
  };
}

module.exports = {
  EARTH_RADIUS_MILES,
  clampRadius,
  validCoordinates,
  milesBetween,
  coverageSpec,
  buildCoverageGrid,
  tileCoverageIsSufficient,
  exactDistanceFilter,
  fallbackDedupe,
  queryCoverageGrid,
  runRadiusEngine
};
