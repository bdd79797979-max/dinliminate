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
    return { tileRadiusMiles: radius, spacingMiles: radius * 2 };
  }

  if (radius <= 5) {
    return { tileRadiusMiles: 4, spacingMiles: 5.6 };
  }

  if (radius <= 10) {
    return { tileRadiusMiles: 6.5, spacingMiles: 9.1 };
  }

  if (radius <= 25) {
    return { tileRadiusMiles: 15, spacingMiles: 21 };
  }

  if (radius <= 50) {
    return { tileRadiusMiles: 30, spacingMiles: 42 };
  }

  return { tileRadiusMiles: 45, spacingMiles: 63 };
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
  const { tileRadiusMiles, spacingMiles } = coverageSpec(radius);

  // Tiny searches are intentionally one exact provider request.
  if (radius <= 3) {
    return {
      origin: { lat: Number(lat), lon: Number(lon) },
      radiusMiles: radius,
      tileRadiusMiles,
      spacingMiles,
      tiles: [{
        id: 'tile-0-0',
        lat: Number(lat),
        lon: Number(lon),
        queryRadiusMiles: tileRadiusMiles,
        centerDistanceMiles: 0
      }]
    };
  }

  const extentMiles = radius + tileRadiusMiles + spacingMiles;
  const indexLimit = Math.ceil(extentMiles / spacingMiles) + 2;
  const tiles = [];
  const seen = new Set();

  for (let q = -indexLimit; q <= indexLimit; q += 1) {
    for (let r = -indexLimit; r <= indexLimit; r += 1) {
      // Pointy-top axial hex coordinates projected into local east/north miles.
      const eastMiles = spacingMiles * (q + r / 2);
      const northMiles = spacingMiles * (Math.sqrt(3) / 2) * r;
      const centerDistanceMiles = Math.hypot(eastMiles, northMiles);

      // A tile circle must be allowed to extend past the selected boundary.
      // The extra spacing margin keeps edge coverage deterministic.
      if (centerDistanceMiles > extentMiles + 1e-9) continue;

      const point = milesToDegrees(
        Number(lat),
        Number(lon),
        northMiles,
        eastMiles
      );

      if (!validCoordinates(point.lat, point.lon)) continue;

      const id = q + ':' + r;
      if (seen.has(id)) continue;
      seen.add(id);

      tiles.push({
        id: 'tile-' + id,
        q,
        r,
        lat: point.lat,
        lon: point.lon,
        queryRadiusMiles: tileRadiusMiles,
        centerDistanceMiles: milesBetween(
          Number(lat),
          Number(lon),
          point.lat,
          point.lon
        )
      });
    }
  }

  tiles.sort((a, b) =>
    a.centerDistanceMiles - b.centerDistanceMiles ||
    a.id.localeCompare(b.id)
  );

  return {
    origin: { lat: Number(lat), lon: Number(lon) },
    radiusMiles: radius,
    tileRadiusMiles,
    spacingMiles,
    tiles
  };
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

async function mapWithConcurrency(items, concurrency, worker) {
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
        output[index] = await worker(list[index], index);
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
        errors: Array.isArray(result?.errors) ? result.errors : []
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
  concurrency = 6
}) {
  const grid = buildCoverageGrid({ lat, lon, radiusMiles });
  const startedAt = Date.now();

  const discovered = await queryCoverageGrid({
    grid,
    providers,
    searchTerm,
    concurrency
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
    spacingMiles: grid.spacingMiles,
    tileCount: grid.tiles.length,
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
  exactDistanceFilter,
  fallbackDedupe,
  queryCoverageGrid,
  runRadiusEngine
};
