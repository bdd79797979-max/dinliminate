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
  'nearby-search-enterprise': Math.max(1, Number.parseInt(process.env.GOOGLE_NEARBY_SEARCH_ENTERPRISE_HARD_LIMIT || '900', 10) || 900),
  'text-search-enterprise': Math.max(1, Number.parseInt(process.env.GOOGLE_TEXT_SEARCH_ENTERPRISE_HARD_LIMIT || '900', 10) || 900),
  'place-details-enterprise': Math.max(1, Number.parseInt(process.env.GOOGLE_PLACE_DETAILS_ENTERPRISE_HARD_LIMIT || '900', 10) || 900),
  'place-details-pro': Math.max(1, Number.parseInt(process.env.GOOGLE_PLACE_DETAILS_PRO_HARD_LIMIT || '4500', 10) || 4500),
  'place-details-essentials': Math.max(1, Number.parseInt(process.env.GOOGLE_PLACE_DETAILS_ESSENTIALS_HARD_LIMIT || '9000', 10) || 9000),
  'place-photo': Math.max(1, Number.parseInt(process.env.GOOGLE_PHOTO_MONTHLY_HARD_LIMIT || process.env.GOOGLE_PLACE_PHOTO_HARD_LIMIT || '900', 10) || 900)
});

const TABLE = 'dinliminate_google_sku_usage_v1';
const UNTRACKED_LIMIT = Math.max(0, Number.parseInt(process.env.GOOGLE_UNTRACKED_SKU_LIMIT || '0', 10) || 0);
const GOOGLE_MASTER_ENABLED = !/^(?:0|false|off|disabled)$/i.test(String(process.env.GOOGLE_MASTER_ENABLED ?? 'true'));
let dbPromise = null;
let legacyPhotoMigratedMonth = '';
let localMonth = '';
const localCounts = new Map();

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

async function migrateLegacyPhotoUsage(sql, month) {
  if (!sql || legacyPhotoMigratedMonth === month) return;
  try {
    const rows = await sql.query(
      'SELECT request_count,disabled_until FROM dinliminate_google_photo_usage WHERE month_key=$1 LIMIT 1',
      [month]
    );
    const legacy = rows?.[0];
    if (!legacy) { legacyPhotoMigratedMonth = month; return; }
    const count = Math.max(0, Number(legacy.request_count) || 0);
    const disabledUntil = legacy.disabled_until || null;
    await sql.query(
      'INSERT INTO ' + TABLE + ' (month_key,sku_key,request_count,disabled_until,updated_at) ' +
      'VALUES ($1,$2,$3,$4,now()) ' +
      'ON CONFLICT(month_key,sku_key) DO UPDATE SET ' +
      'request_count=GREATEST(' + TABLE + '.request_count,$3), ' +
      'disabled_until=CASE WHEN $4 IS NOT NULL THEN $4 ELSE ' + TABLE + '.disabled_until END, ' +
      'updated_at=now()',
      [month, 'place-photo', count, disabledUntil]
    );
    legacyPhotoMigratedMonth = month;
  } catch(error){console.error('Dinliminate error',error)}
}

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

function pacificParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const value = type => Number(parts.find(p => p.type === type)?.value || 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second')
  };
}

function pacificOffsetMinutes(date = new Date()) {
  const p = pacificParts(date);
  if (!p.year || !p.month || !p.day) return 0;
  const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((localAsUtc - date.getTime()) / 60000);
}

function nextPacificMonthIso(date = new Date()) {
  const month = pacificMonthKey(date);
  const [year, monthNumber] = month.split('-').map(Number);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  // Pacific uses UTC-8 or UTC-7. Try both possible offsets and choose the
  // candidate that is exactly midnight on the requested Pacific date.
  for (const offsetMinutes of [-480, -420]) {
    const candidate = new Date(
      Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0, 0) - offsetMinutes * 60000
    );
    const p = pacificParts(candidate);
    if (
      p.year === nextYear &&
      p.month === nextMonth &&
      p.day === 1 &&
      p.hour === 0 &&
      p.minute === 0
    ) {
      return candidate.toISOString();
    }
  }
  return new Date(
    Date.UTC(nextYear, nextMonth - 1, 1, 8, 0, 0, 0)
  ).toISOString();
}

function googleServicesEnabled(){ return GOOGLE_MASTER_ENABLED; }

async function reserveGoogleSku(skuKey, configuredLimit) {
  const sku = String(skuKey || '').trim();
  if (!sku) return { ok: false, reason: 'missing-sku' };
  if (!GOOGLE_MASTER_ENABLED) return { ok: false, reason: 'master-disabled', sku };

  const limit = Math.max(
    1,
    Number.parseInt(String(configuredLimit ?? HARD_LIMITS[sku] ?? ''), 10) ||
      Number(HARD_LIMITS[sku] || 1)
  );
  const month = pacificMonthKey();
  const sql = await budgetDb().catch(() => null);

  if (sql) await migrateLegacyPhotoUsage(sql, month);

  if (!sql) {
    if (localMonth !== month) {
      localMonth = month;
      localCounts.clear();
    }
    if (UNTRACKED_LIMIT <= 0) {
      return { ok: false, reason: 'budget-unconfigured', sku, limit, month, durable: false };
    }
    const effectiveLimit = Math.min(limit, UNTRACKED_LIMIT);
    const count = Number(localCounts.get(sku) || 0);
    if (count >= effectiveLimit) {
      return { ok: false, reason: 'untracked-limit', sku, count, limit: effectiveLimit, month, durable: false };
    }
    const next = count + 1;
    localCounts.set(sku, next);
    return { ok: true, count: next, limit: effectiveLimit, month, durable: false, sku };
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
  if (sql) await migrateLegacyPhotoUsage(sql, month);
  const result = {
    month,
    googleMasterEnabled: GOOGLE_MASTER_ENABLED,
    durable: !!sql,
    untrackedLimit: UNTRACKED_LIMIT,
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
  } catch(error){console.error('Dinliminate error',error)}

  return result;
}

async function googleUsageSnapshot() {
  const health = await googleUsageHealth();
  const now = Date.now();
  const skus = Object.entries(HARD_LIMITS).map(([sku, cap]) => {
    const raw = health.usage?.[sku] || {};
    const trackingAvailable = !!health.durable || health.untrackedLimit > 0;
    const used = trackingAvailable ? Math.max(0, Number(raw.requestCount) || 0) : null;
    const remaining = used === null ? null : Math.max(0, cap - used);
    const percent = used === null ? null : Number(Math.min(100, (used / cap) * 100).toFixed(1));
    const disabledUntil = raw.disabledUntil || null;
    const disabled = Number.isFinite(Date.parse(disabledUntil)) && Date.parse(disabledUntil) > now;
    let status = 'ok';
    if (!health.googleMasterEnabled) status = 'disabled';
    else if (!trackingAvailable) status = 'blocked-untracked';
    else if (disabled) status = 'disabled';
    else if (used >= cap) status = 'exhausted';
    else if (used >= cap * 0.8) status = 'warning';
    return {sku,used,cap,remaining,percent,status,disabledUntil};
  });
  const blocked = !health.googleMasterEnabled || (!health.durable && health.untrackedLimit <= 0);
  return {
    ok:true,
    readOnly:true,
    trackerVersion:'1.0',
    month:health.month,
    billingMonthTimeZone:'America/Los_Angeles',
    googleMasterEnabled:!!health.googleMasterEnabled,
    durable:!!health.durable,
    untrackedLimit:health.untrackedLimit,
    safeToCallGoogle:!blocked && skus.some(x=>x.status==='ok'||x.status==='warning'),
    status:!health.googleMasterEnabled?'master-disabled':(!health.durable&&health.untrackedLimit<=0?'blocked-untracked':(skus.some(x=>x.status==='exhausted'||x.status==='disabled')?'limited':'healthy')),
    nextBillingMonth:nextPacificMonthIso(),
    skus
  };
}

async function handler(req,res){
  res?.setHeader?.('Cache-Control','no-store, max-age=0');
  res?.setHeader?.('X-Content-Type-Options','nosniff');
  if(String(req?.method||'GET').toUpperCase()!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});
  try{return res.status(200).json(await googleUsageSnapshot());}
  catch(error){
    console.error('dinliminate-google-usage-health',{message:String(error?.message||error||'unknown')});
    return res.status(500).json({ok:false,error:'Google usage tracker unavailable'});
  }
}
handler.snapshot=googleUsageSnapshot;
handler._test={googleUsageSnapshot,pacificMonthKey,nextPacificMonthIso};



module.exports = handler;
handler.HARD_LIMITS=HARD_LIMITS;
handler.googleServicesEnabled=googleServicesEnabled;
handler.pacificMonthKey=pacificMonthKey;
handler.nextPacificMonthIso=nextPacificMonthIso;
handler.reserveGoogleSku=reserveGoogleSku;
handler.disableGoogleSkuForMonth=disableGoogleSkuForMonth;
handler.googleUsageHealth=googleUsageHealth;
handler.googleUsageSnapshot=googleUsageSnapshot;
