'use strict';

const crypto = require('node:crypto');

const RESTAURANTS_TABLE = 'dinliminate_restaurant_library_v1';
const IMAGES_TABLE = 'dinliminate_restaurant_images_v1';
let sqlClient = null;
let schemaPromise = null;
let sqlFactory = null;
let blobPut = null;

function clean(value, max = 1000) {
  return String(value || '').trim().replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, max);
}

function normalizeName(value) {
  return clean(value, 300).normalize('NFKD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeAddress(value) {
  return clean(value, 500).normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/\b(street|st)\b/g, ' st ').replace(/\b(avenue|ave)\b/g, ' ave ')
    .replace(/\b(road|rd)\b/g, ' rd ').replace(/\b(boulevard|blvd)\b/g, ' blvd ')
    .replace(/\b(drive|dr)\b/g, ' dr ').replace(/\b(lane|ln)\b/g, ' ln ')
    .replace(/\b(suite|ste)\b/g, ' ste ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

function restaurantKey(name, address = '', scope = 'venue') {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return '';
  if (scope === 'brand') return 'brand_' + hash(normalizedName).slice(0, 48);
  const normalizedAddress = normalizeAddress(address);
  return normalizedAddress ? 'venue_' + hash(normalizedName + '\n' + normalizedAddress).slice(0, 48) : '';
}

function hostFrom(raw) {
  try {
    const url = new URL(String(raw || ''));
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
    return url.hostname.toLowerCase().replace(/\.$/, '');
  } catch { return ''; }
}

function retentionHosts() {
  return String(process.env.RESTAURANT_LIBRARY_RETENTION_HOSTS || '').split(',')
    .map(value => value.trim().toLowerCase().replace(/^\*\./, '').replace(/\.$/, ''))
    .filter(value => value && !value.includes('/') && !value.includes(':'));
}

function isGoogleHost(host) {
  return ['google.com', 'googleusercontent.com', 'googleapis.com', 'gstatic.com']
    .some(root => host === root || host.endsWith('.' + root));
}

function isRetentionEligible(sourceUrl, hosts = retentionHosts()) {
  const host = hostFrom(sourceUrl);
  if (!host || isGoogleHost(host)) return false;
  return hosts.some(root => host === root || host.endsWith('.' + root));
}

function hasBlobCredentials() {
  return Boolean(((process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID) || process.env.BLOB_READ_WRITE_TOKEN));
}

function database() {
  const connection = String(process.env.RESTAURANT_LIBRARY_DATABASE_URL || process.env.DATABASE_URL ||
    process.env.POSTGRES_URL || '').trim();
  if (!connection) return null;
  if (!sqlClient) {
    const factory = sqlFactory || require('@neondatabase/serverless').neon;
    sqlClient = factory(connection);
  }
  return sqlClient;
}

async function ensureSchema() {
  const sql = database();
  if (!sql) return null;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql.query(`CREATE TABLE IF NOT EXISTS ${RESTAURANTS_TABLE} (
        restaurant_key text PRIMARY KEY,
        scope text NOT NULL DEFAULT 'venue',
        name text NOT NULL,
        normalized_name text NOT NULL,
        address text NOT NULL DEFAULT '',
        normalized_address text NOT NULL DEFAULT '',
        phone text NOT NULL DEFAULT '',
        website_url text NOT NULL DEFAULT '',
        hours_text text NOT NULL DEFAULT '',
        metadata_source_url text NOT NULL DEFAULT '',
        metadata_verified boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now()
      )`);
      await sql.query(`CREATE TABLE IF NOT EXISTS ${IMAGES_TABLE} (
        image_id text PRIMARY KEY,
        restaurant_key text NOT NULL REFERENCES ${RESTAURANTS_TABLE}(restaurant_key) ON DELETE CASCADE,
        image_type text NOT NULL DEFAULT 'restaurant-card',
        blob_url text NOT NULL,
        source_url text NOT NULL,
        source_host text NOT NULL,
        source_name text NOT NULL DEFAULT '',
        retention_basis text NOT NULL DEFAULT 'legacy-unverified',
        attribution text NOT NULL DEFAULT '[]',
        content_type text NOT NULL,
        byte_length integer NOT NULL DEFAULT 0,
        width integer NOT NULL DEFAULT 0,
        height integer NOT NULL DEFAULT 0,
        sha256 text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_used_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (restaurant_key, image_type, sha256)
      )`);
      await sql.query(`CREATE INDEX IF NOT EXISTS dinliminate_restaurant_images_lookup_v1
        ON ${IMAGES_TABLE}(restaurant_key, image_type, is_active)`);
      await sql.query(`ALTER TABLE ${IMAGES_TABLE} ADD COLUMN IF NOT EXISTS retention_basis text NOT NULL DEFAULT 'legacy-unverified'`);
      await sql.query(`CREATE INDEX IF NOT EXISTS dinliminate_restaurant_library_name_v1
        ON ${RESTAURANTS_TABLE}(normalized_name, scope)`);
      return sql;
    })().catch(error => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
}

async function getRestaurantMetadata({ name, address = '' } = {}) {
  const key = restaurantKey(name, address);
  if (!key) return null;
  const sql = await ensureSchema();
  if (!sql) return null;
  const rows = await sql.query(`SELECT restaurant_key, name, address, phone, website_url, hours_text,
      metadata_source_url, metadata_verified, created_at, updated_at, last_seen_at
    FROM ${RESTAURANTS_TABLE} WHERE restaurant_key = $1 LIMIT 1`, [key]);
  return rows?.[0] || null;
}

async function upsertRestaurantMetadata({ name, address = '', phone = '', website = '', hours = '',
  sourceUrl = '', verified = false } = {}) {
  const key = restaurantKey(name, address);
  const normalizedName = normalizeName(name);
  const normalizedAddress = normalizeAddress(address);
  if (!key || !normalizedName || !normalizedAddress) return null;
  const sql = await ensureSchema();
  if (!sql) return null;
  const rows = await sql.query(`INSERT INTO ${RESTAURANTS_TABLE}
    (restaurant_key, scope, name, normalized_name, address, normalized_address, phone, website_url,
     hours_text, metadata_source_url, metadata_verified, last_seen_at, updated_at)
    VALUES ($1, 'venue', $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
    ON CONFLICT (restaurant_key) DO UPDATE SET
      name = EXCLUDED.name,
      address = CASE WHEN EXCLUDED.address <> '' THEN EXCLUDED.address ELSE ${RESTAURANTS_TABLE}.address END,
      phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE ${RESTAURANTS_TABLE}.phone END,
      website_url = CASE WHEN EXCLUDED.website_url <> '' THEN EXCLUDED.website_url ELSE ${RESTAURANTS_TABLE}.website_url END,
      hours_text = CASE WHEN EXCLUDED.hours_text <> '' THEN EXCLUDED.hours_text ELSE ${RESTAURANTS_TABLE}.hours_text END,
      metadata_source_url = CASE WHEN EXCLUDED.metadata_source_url <> '' THEN EXCLUDED.metadata_source_url ELSE ${RESTAURANTS_TABLE}.metadata_source_url END,
      metadata_verified = ${RESTAURANTS_TABLE}.metadata_verified OR EXCLUDED.metadata_verified,
      updated_at = now(), last_seen_at = now()
    RETURNING restaurant_key, name, address, phone, website_url, hours_text, metadata_source_url,
      metadata_verified, created_at, updated_at, last_seen_at`, [key, clean(name, 160), normalizedName,
    clean(address, 300), normalizedAddress, clean(phone, 80), clean(website, 700), clean(hours, 500),
    clean(sourceUrl, 900), Boolean(verified)]);
  return rows?.[0] || null;
}

async function deleteRestaurantMetadata({ name, address = '' } = {}) {
  const key = restaurantKey(name, address);
  if (!key) return false;
  const sql = await ensureSchema();
  if (!sql) return false;
  const rows = await sql.query(`DELETE FROM ${RESTAURANTS_TABLE} WHERE restaurant_key = $1 RETURNING restaurant_key`, [key]);
  return Boolean(rows?.length);
}

async function findRestaurantPhoto({ name, address = '' } = {}) {
  const key = restaurantKey(name, address);
  if (!key) return null;
  try {
    const sql = await ensureSchema();
    if (!sql) return null;
    const rows = await sql.query(`SELECT i.image_id, i.blob_url, i.source_url, i.source_name,
      i.content_type, i.width, i.height, r.name, r.address
      FROM ${IMAGES_TABLE} i JOIN ${RESTAURANTS_TABLE} r ON r.restaurant_key = i.restaurant_key
      WHERE i.restaurant_key = $1 AND i.image_type = 'restaurant-card' AND i.is_active = true
        AND i.retention_basis <> 'legacy-unverified'
      ORDER BY i.last_used_at DESC, i.created_at DESC LIMIT 1`, [key]);
    const row = rows?.[0];
    if (!row || !/^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//i.test(String(row.blob_url || ''))) return null;
    try { await sql.query(`UPDATE ${IMAGES_TABLE} SET last_used_at = now() WHERE image_id = $1`, [row.image_id]); }
    catch (error) { console.error('Dinliminate restaurant library use-stamp failed', error); }
    return row;
  } catch (error) { console.error('Dinliminate restaurant library read failed', error); return null; }
}

function mediaExtension(contentType) {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' })[String(contentType || '').toLowerCase()] || '';
}

function mediaSignatureMatches(bytes, contentType) {
  if (!bytes || bytes.length < 12) return false;
  if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (contentType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === 'image/webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (contentType === 'image/avif') return bytes.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(bytes.toString('ascii', 8, 16));
  return false;
}

async function rememberRestaurantPhoto({ name, address = '', phone = '', website = '', hours = '',
  source = '', sourceUrl = '', sourceName = '', retentionBasis = '', attributions = [], media = null } = {}) {
  if (String(source).toLowerCase() === 'google-places' || isGoogleHost(hostFrom(sourceUrl)))
    return { stored: false, reason: 'google-content-not-retained' };
  if (!String(process.env.RESTAURANT_LIBRARY_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim())
    return { stored: false, reason: 'database-not-configured' };
  if (!hasBlobCredentials()) return { stored: false, reason: 'object-storage-not-configured' };
  const sourceHost = hostFrom(sourceUrl);
  if (!isRetentionEligible(sourceUrl) || clean(retentionBasis, 200) !== 'operator-approved-retention-host:' + sourceHost)
    return { stored: false, reason: 'source-retention-not-explicitly-eligible' };
  const key = restaurantKey(name, address);
  if (!key) return { stored: false, reason: 'venue-identity-required' };
  const bytes = Buffer.isBuffer(media?.bytes) ? media.bytes : media?.bytes ? Buffer.from(media.bytes) : null;
  const contentType = String(media?.type || media?.contentType || '').split(';')[0].toLowerCase();
  const extension = mediaExtension(contentType);
  if (!bytes || bytes.length < 1024 || bytes.length > 10 * 1024 * 1024 || !extension || !mediaSignatureMatches(bytes, contentType))
    return { stored: false, reason: 'media-failed-library-validation' };
  const width = Number(media?.width) || 0, height = Number(media?.height) || 0;
  if (width < 180 || height < 120) return { stored: false, reason: 'image-dimensions-too-small' };
  try {
    const sql = await ensureSchema();
    if (!sql) return { stored: false, reason: 'database-not-configured' };
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    const existing = await sql.query(`SELECT image_id, blob_url FROM ${IMAGES_TABLE}
      WHERE restaurant_key = $1 AND image_type = 'restaurant-card' AND sha256 = $2 AND is_active = true LIMIT 1`, [key, digest]);
    if (existing?.[0]) return { stored: true, duplicate: true, url: existing[0].blob_url };
    const put = blobPut || require('@vercel/blob').put;
    const blob = await put('restaurant-library/' + key + '/' + digest + '.' + extension, bytes, {
      access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType, cacheControlMaxAge: 2592000
    });
    if (!/^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//i.test(String(blob?.url || '')))
      return { stored: false, reason: 'object-storage-returned-invalid-url' };
    await upsertRestaurantMetadata({ name, address, phone, website, hours, sourceUrl });
    const attribution = Array.isArray(attributions) ? attributions.map(item => ({
      displayName: clean(item?.displayName, 120), uri: clean(item?.uri, 700)
    })).filter(item => item.displayName || item.uri).slice(0, 5) : [];
    const imageId = hash(key + '\nrestaurant-card\n' + digest).slice(0, 64);
    await sql.query(`INSERT INTO ${IMAGES_TABLE}
      (image_id, restaurant_key, image_type, blob_url, source_url, source_host, source_name, retention_basis,
       attribution, content_type, byte_length, width, height, sha256)
      VALUES ($1, $2, 'restaurant-card', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (restaurant_key, image_type, sha256) DO UPDATE SET
       blob_url = EXCLUDED.blob_url, source_url = EXCLUDED.source_url, source_host = EXCLUDED.source_host,
       source_name = EXCLUDED.source_name, retention_basis = EXCLUDED.retention_basis,
       attribution = EXCLUDED.attribution, is_active = true`, [imageId, key, blob.url, clean(sourceUrl, 900),
      sourceHost, clean(sourceName || sourceHost, 120), clean(retentionBasis, 200), JSON.stringify(attribution),
      contentType, bytes.length, width, height, digest]);
    return { stored: true, duplicate: false, url: blob.url };
  } catch (error) { console.error('Dinliminate restaurant library write failed', error); return { stored: false, reason: 'library-write-failed' }; }
}

async function restaurantLibraryHealth() {
  const hosts = retentionHosts();
  const configured = Boolean(String(process.env.RESTAURANT_LIBRARY_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim());
  const report = { ok: true, version: 'v1', databaseConfigured: configured, objectStorageConfigured: hasBlobCredentials(),
    retentionHostsConfigured: hosts.length > 0, retentionHostCount: hosts.length, googlePlacesPhotosRetained: false,
    readEnabled: configured, writeEnabled: configured && hasBlobCredentials() && hosts.length > 0 };
  if (!configured) return { ...report, status: 'needs-database', restaurantCount: null, imageCount: null };
  try {
    const sql = await ensureSchema();
    const rows = await sql.query(`SELECT (SELECT count(*)::integer FROM ${RESTAURANTS_TABLE}) AS restaurant_count,
      (SELECT count(*)::integer FROM ${IMAGES_TABLE} WHERE is_active = true) AS image_count`);
    return { ...report, status: report.writeEnabled ? 'ready' : 'read-only-or-not-configured', schemaReady: true,
      restaurantCount: Number(rows?.[0]?.restaurant_count || 0), imageCount: Number(rows?.[0]?.image_count || 0) };
  } catch (error) {
    console.error('Dinliminate restaurant library health failed', error);
    return { ...report, ok: false, status: 'database-unavailable', schemaReady: false, restaurantCount: null, imageCount: null };
  }
}

module.exports = { findRestaurantPhoto, getRestaurantMetadata, upsertRestaurantMetadata,
  deleteRestaurantMetadata, rememberRestaurantPhoto, restaurantLibraryHealth,
  _test: { normalizeName, normalizeAddress, restaurantKey, hostFrom, retentionHosts,
    isRetentionEligible, hasBlobCredentials, mediaExtension, mediaSignatureMatches,
    setAdapters(adapters = {}) { sqlClient = null; schemaPromise = null; sqlFactory = adapters.sqlFactory || null; blobPut = adapters.put || null; },
    resetAdapters() { sqlClient = null; schemaPromise = null; sqlFactory = null; blobPut = null; }
  }
};
