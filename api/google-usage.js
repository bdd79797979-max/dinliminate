'use strict';

const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = String(
  process.env.GOOGLE_BUDGET_DATABASE_URL ||
  process.env.GOOGLE_PHOTO_BUDGET_DATABASE_URL ||
  process.env.FAMILY_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  ''
).trim();

const HARD_LIMITS = Object.freeze({
  'text-search-pro': Math.max(1, Number.parseInt(process.env.GOOGLE_TEXT_SEARCH_PRO_HARD_LIMIT || '4500', 10) || 4500),
  'nearby-search-pro': Math.max(1, Number.parseInt(process.env.GOOGLE_NEARBY_SEARCH_PRO_HARD_LIMIT || '4500', 10) || 4500),
  'text-search-enterprise': Math.max(1, Number.parseInt(process.env.GOOGLE_TEXT_SEARCH_ENTERPRISE_HARD_LIMIT || '900', 10) || 900),
  'place-details-enterprise': Math.max(1, Number.parseInt(process.env.GOOGLE_PLACE_DETAILS_ENTERPRISE_HARD_LIMIT || '900', 10) || 900),
  'place-details-essentials': Math.max(1, Number.parseInt(process.env.GOOGLE_PLACE_DETAILS_ESSENTIALS_HARD_LIMIT || '9000', 10) || 9000)
});

const TABLE = 'dinliminate_google_sku_usage_v1';
let dbPromise = null;
let localMonth = '';
const localCounts = new Map();

function pacificMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  return year + '-' + month;
}

function nextPacificMonthIso(date = new Date()) {
  const month = pacificMonthKey(date);
  const [year, monthNumber] = month.split('-').map(Number);
  const next = monthNumber === 12
    ? new Date(Date.UTC(year + 1, 0, 1, 8, 0, 0, 0))
    : new Date(Date.UTC(year, monthNumber, 1, 8, 0, 0, 0));
  return next.toISOString();
}

async function budgetDb() {
  if (!DATABASE_URL) return null;
  if (!dbPromise) {
    dbPromise = (async () => {
      const sql = neon(DATABASE_URL);
      await sql.query(
        'CREATE TABLE IF NOT EXISTS ' + TABLE + ' (' +
        'month_key text NOT NULL, ' +
        'sku_key text NOT NULL, ' +
        'request_count integer NOT NULL DEFAULT 0, ' +
        'disabled_until timestamptz NULL, ' +
        'updated_at timestamptz NOT NULL DEFAULT now(), ' +
        'PRIMARY KEY (month_key, sku_key)' +
        ')'
      );
      return sql;
    })();
  }
  return dbPromise;
}

async function reserveGoogleSku(skuKey, configuredLimit) {
  const sku = String(skuKey || '').trim();
  if (!sku) return { ok: false, reason: 'missing-sku' };

  const limit = Math.max(
    1,
    Number.parseInt(String(configuredLimit ?? HARD_LIMITS[sku] ?? ''), 10) ||
      Number(HARD_LIMITS[sku] || 1)
  );
  const month = pacificMonthKey();
  const sql = await budgetDb().catch(() => null);

  if (!sql) {
    if (localMonth !== month) {
      localMonth = month;
      localCounts.clear();
    }
    const count = Number(localCounts.get(sku) || 0);
    if (count >= limit) return { ok: false, reason: 'monthly-budget', sku, count, limit, month };
    const next = count + 1;
    localCounts.set(sku, next);
    return { ok: true, count: next, limit, month, durable: false, sku };
  }

  await sql.query(
    'INSERT INTO ' + TABLE + ' (month_key,sku_key,request_count,disabled_until,updated_at) ' +
    'VALUES ($1,$2,0,NULL,now()) ON CONFLICT(month_key,sku_key) DO NOTHING',
    [month, sku]
  );

  const rows = await sql.query(
    'UPDATE ' + TABLE + ' SET request_count=request_count+1,updated_at=now() ' +
    'WHERE month_key=$1 AND sku_key=$2 AND (disabled_until IS NULL OR disabled_until<=now()) ' +
    'AND request_count<$3 RETURNING request_count',
    [month, sku, limit]
  );

  if (!rows.length) return { ok: false, reason: 'monthly-budget', sku, limit, month, durable: true };
  return { ok: true, count: Number(rows[0].request_count) || 0, limit, month, durable: true, sku };
}

async function disableGoogleSkuForMonth(skuKey) {
  const sku = String(skuKey || '').trim();
  if (!sku) return false;
  const month = pacificMonthKey();
  const sql = await budgetDb().catch(() => null);
  if (!sql) return false;
  try {
    await sql.query(
      'INSERT INTO ' + TABLE + ' (month_key,sku_key,request_count,disabled_until,updated_at) ' +
      'VALUES ($1,$2,0,$3,now()) ON CONFLICT(month_key,sku_key) DO UPDATE ' +
      'SET disabled_until=$3,updated_at=now()',
      [month, sku, nextPacificMonthIso()]
    );
    return true;
  } catch {
    return false;
  }
}

async function googleUsageHealth() {
  const month = pacificMonthKey();
  const sql = await budgetDb().catch(() => null);
  const result = {
    month,
    durable: !!sql,
    limits: { ...HARD_LIMITS },
    usage: {}
  };

  if (!sql) return result;

  try {
    const rows = await sql.query(
      'SELECT sku_key,request_count,disabled_until FROM ' + TABLE + ' WHERE month_key=$1',
      [month]
    );
    for (const row of rows || []) {
      result.usage[String(row.sku_key)] = {
        requestCount: Number(row.request_count) || 0,
        disabledUntil: row.disabled_until || null
      };
    }
  } catch {}

  return result;
}

module.exports = {
  HARD_LIMITS,
  pacificMonthKey,
  nextPacificMonthIso,
  reserveGoogleSku,
  disableGoogleSkuForMonth,
  googleUsageHealth
};
