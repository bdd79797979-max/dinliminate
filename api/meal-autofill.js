'use strict';

const {json:sendJson}=require('./_lib/http');
const {rateLimit}=require('./_lib/rateLimit');
const {safeFetchText}=require('./_lib/ssrf');

/*
 * Dinliminate Meal Auto-Fill — CP1266
 * Server-side only: the browser sends a meal name and receives a reviewable draft.
 * AI Gateway auth uses AI_GATEWAY_API_KEY or Vercel's VERCEL_OIDC_TOKEN.
 */

const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite';
const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const MAX_NAME_LENGTH = 120;
const MAX_ARRAY = 24;
const PHOTO_TIMEOUT_MS = 5000;


function cleanString(value, max = 4000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function cleanName(value) {
  return cleanString(value, MAX_NAME_LENGTH).replace(/\s+/g, ' ');
}

function cleanList(value, max = MAX_ARRAY) {
  if (!Array.isArray(value)) return [];
  return value.map(item => cleanString(item, 320)).filter(Boolean).slice(0, max);
}

function numberOrBlank(value, max = 1000000) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) return '';
  return Math.round(n * 10) / 10;
}

function normalizedKey(value) {
  return cleanString(value, 300).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function allowedIntersection(values, allowed) {
  const map = new Map(cleanList(allowed, 100).map(value => [normalizedKey(value), value]));
  const out = [];
  for (const value of cleanList(values)) {
    const exact = map.get(normalizedKey(value));
    if (exact && !out.includes(exact)) out.push(exact);
  }
  return out;
}

function parseModelJson(value) {
  if (value && typeof value === 'object') return value;
  const raw = cleanString(value, 20000);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch(error){console.error('Dinliminate error',error)}
  const fenced = raw.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch(error){console.error('Dinliminate error',error)}
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch(error){console.error('Dinliminate error',error)}
  }
  return null;
}

function normalizeDraft(raw, context) {
  const draft = raw && typeof raw === 'object' ? raw : {};
  const nutrition = draft.nutrition && typeof draft.nutrition === 'object' ? draft.nutrition : {};
  const out = {
    cuisine: allowedIntersection(draft.cuisine, context.cuisineOptions),
    mealTimes: allowedIntersection(draft.mealTimes, context.mealTimeOptions),
    description: cleanString(draft.description, 900),
    ingredients: cleanList(draft.ingredients, 24),
    recipe: cleanString(draft.recipe, 4200),
    nutrition: {
      calories: numberOrBlank(nutrition.calories, 10000),
      protein: numberOrBlank(nutrition.protein, 1000),
      carbs: numberOrBlank(nutrition.carbs, 2000),
      fat: numberOrBlank(nutrition.fat, 1000),
      sodium: numberOrBlank(nutrition.sodium, 20000)
    },
    nutritionBasis: cleanString(draft.nutritionBasis, 180) || 'Typical serving estimate',
    photoQueries: cleanList(draft.photoQueries, 5)
  };
  return out;
}

function sectionPrompt(section, mealName, context) {
  const current = context.current && typeof context.current === 'object' ? context.current : {};
  const base = [
    'You are the meal catalog assistant for Dinliminate, a decision app.',
    'Return JSON only. Do not return markdown.',
    'The meal name is: ' + JSON.stringify(mealName),
    'Populate a practical, familiar home-meal interpretation. Do not invent unusual ingredients when the name strongly implies a standard version.',
    'The user will review every value before saving.',
    'Cuisine must use only exact values from: ' + JSON.stringify(context.cuisineOptions),
    'Meal Times must use only exact values from: ' + JSON.stringify(context.mealTimeOptions),
    'A meal may have multiple cuisines and multiple meal times.',
    'Nutrition is only an estimate for a typical single serving. Never present it as laboratory-accurate.',
    'Use concise ingredient lines and clear preparation steps.',
    'For photos, supply 2-4 exact search phrases that describe the finished dish, not ingredients alone.'
  ].join('\n');

  if (section !== 'all') {
    return base + '\nRefresh only this section: ' + section + '. Do not attempt to change other sections. Current section value: ' + JSON.stringify(current[section] == null ? '' : current[section]);
  }
  return base + '\nGenerate every field in the schema.';
}

function schemaForSection(section) {
  if (section === 'nutrition') return '{"nutrition":{"calories":0,"protein":0,"carbs":0,"fat":0,"sodium":0},"nutritionBasis":"Typical serving estimate"}';
  if (section === 'ingredients') return '{"ingredients":["ingredient 1","ingredient 2"]}';
  if (section === 'recipe') return '{"recipe":"Step 1...\\nStep 2..."}';
  if (section === 'cuisine') return '{"cuisine":["American"]}';
  if (section === 'mealTimes') return '{"mealTimes":["Lunch / Dinner"]}';
  if (section === 'description') return '{"description":"A concise description."}';
  if (section === 'photo') return '{"photoQueries":["exact dish name","dish name plated"]}';
  return '{"cuisine":["American"],"mealTimes":["Lunch / Dinner"],"description":"...","ingredients":["..."],"recipe":"Step 1...","nutrition":{"calories":0,"protein":0,"carbs":0,"fat":0,"sodium":0},"nutritionBasis":"Typical serving estimate","photoQueries":["exact dish name","dish name plated"]}';
}

async function callGateway(mealName, section, context) {
  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || '';
  if (!token) {
    const error = new Error('Meal Auto-Fill is not connected to the AI service yet.');
    error.code = 'AI_AUTH_MISSING';
    throw error;
  }
  const model = process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL;
  const system = sectionPrompt(section, mealName, context) + '\nRequired JSON shape: ' + schemaForSection(section);
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'Prepare the Dinliminate meal draft for ' + mealName + '.' }
      ],
      temperature: 0.15,
      max_tokens: 1600,
      response_format: { type: 'json_object' }
    })
  });
  if (!response.ok) {
    const error = new Error('The meal autofill service could not complete the request.');
    error.code = response.status === 401 || response.status === 403 ? 'AI_AUTH_FAILED' : response.status === 429 ? 'AI_RATE_LIMITED' : 'AI_REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message
    ? payload.choices[0].message.content
    : '';
  const parsed = parseModelJson(content);
  if (!parsed) {
    const error = new Error('The meal autofill service returned an unreadable result.');
    error.code = 'AI_BAD_RESPONSE';
    throw error;
  }
  return normalizeDraft(parsed, context);
}

function cleanSearchText(value) {
  return cleanString(value, 180).replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
}

function providerImageUrls(html, provider, query, excludedUrls=[]) {
  const excluded=new Set(cleanList(excludedUrls, 20).map(value=>{try{return new URL(value).origin+new URL(value).pathname}catch{return String(value).split('?')[0]}}));
  const source = String(html || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/\\"/g, '"');
  const regex = provider === 'pexels'
    ? /https:\/\/images\.pexels\.com\/photos\/\d+\/[^\s"'<>\\]+/gi
    : /https:\/\/images\.unsplash\.com\/photo-[^\s"'<>\\)]+/gi;
  const terms = cleanSearchText(query).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const match of source.matchAll(regex)) {
    let url = match[0];
    try { url = decodeURIComponent(url); } catch(error){console.error('Dinliminate error',error)}
    const base = url.split('?')[0];
    if (seen.has(base)||excluded.has(base)||excluded.has((()=>{try{const u=new URL(base);return u.origin+u.pathname}catch{return base}})())) continue;
    seen.add(base);
    const index = match.index || 0;
    const context = source.slice(Math.max(0, index - 420), Math.min(source.length, index + 420)).toLowerCase();
    const negative = /logo|avatar|profile|portrait|illustration|wallpaper|icon|background/.test(context);
    if (negative) continue;
    let score = provider === 'pexels' ? 100 : 96;
    for (const term of terms) if (context.includes(term)) score += 5;
    if (index < 90000) score += 2;
    const normalized = base.toLowerCase();
    if (normalized.includes('food')) score += 1;
    if (negative) score -= 100;
    if (score < 90) continue;
    out.push({ url, provider, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 6);
}

function withImageParams(url, provider) {
  try {
    const u = new URL(url);
    if (provider === 'pexels') {
      u.searchParams.set('auto', 'compress');
      u.searchParams.set('cs', 'tinysrgb');
      u.searchParams.set('w', '1800');
    } else {
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'max');
      u.searchParams.set('w', '1800');
    }
    return u.href;
  } catch {
    return url;
  }
}

async function fetchText(url){
  try{
    const result=await safeFetchText(url,{
      headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'Dinliminate/1308 meal-photo-search'},
      cache:'no-store'
    },{timeoutMs:PHOTO_TIMEOUT_MS,maxBytes:2200000,maxRedirects:3});
    return result.response.ok?result.text:'';
  }catch{return ''}
}
async function findMealPhoto(mealName, photoQueries, excludedUrls=[]) {
  const queries = [];
  const add = value => {
    const cleaned = cleanSearchText(value);
    if (!cleaned) return;
    const key = normalizedKey(cleaned);
    if (!key || queries.some(item => normalizedKey(item) === key)) return;
    queries.push(cleaned);
  };
  add(mealName);
  cleanList(photoQueries, 5).forEach(add);
  const providers = [
    query => 'https://www.pexels.com/search/' + encodeURIComponent(query) + '/',
    query => 'https://unsplash.com/s/photos/' + encodeURIComponent(query)
  ];
  for (const query of queries.slice(0, 4)) {
    for (let i = 0; i < providers.length; i++) {
      const html = await fetchText(providers[i](query));
      if (!html) continue;
      const candidates = providerImageUrls(html, i === 0 ? 'pexels' : 'unsplash', query, excludedUrls);
      if (candidates.length) {
        const best = candidates[0];
        return {
          url: withImageParams(best.url, best.provider),
          provider: best.provider,
          query
        };
      }
    }
  }
  return { url: '', provider: '', query: '' };
}

function requestSectionPayload(name, section, body, current) {
  return {
    name,
    section,
    cuisineOptions: cleanList(body.cuisineOptions, 100),
    mealTimeOptions: cleanList(body.mealTimeOptions, 100),
    current: current && typeof current === 'object' ? current : {}
  };
}

async function handleMealAutofill(req, res) {
  if (req.method !== 'POST') {
    res.setHeader && res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Meal Auto-Fill uses POST.' });
  }

  const limit=await rateLimit(req,{scope:'meal-autofill',perMinute:8,dailyCap:100});
  if(!limit.configured)return sendJson(res,503,{ok:false,code:'RATE_LIMIT_UNAVAILABLE',message:'Meal Auto-Fill is temporarily unavailable.'});
  if(!limit.allowed){res.setHeader?.('Retry-After',String(limit.retryAfterSeconds||60));return sendJson(res,429,{ok:false,code:limit.reason==='daily-cap'?'DAILY_CAP_REACHED':'RATE_LIMITED',message:limit.reason==='daily-cap'?'Meal Auto-Fill has reached today’s limit. Please try again tomorrow.':'Meal Auto-Fill is temporarily busy. Please try again shortly.'});}

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') return sendJson(res, 400, { ok: false, code: 'BAD_REQUEST', message: 'A meal name is required.' });

  const name = cleanName(body.name);
  if (!name) return sendJson(res, 400, { ok: false, code: 'NAME_REQUIRED', message: 'Enter a meal name first.' });
  if (name.length > MAX_NAME_LENGTH) return sendJson(res, 400, { ok: false, code: 'NAME_TOO_LONG', message: 'Meal names must be 120 characters or fewer.' });

  const allowedSections = new Set(['all','nutrition','ingredients','recipe','cuisine','mealTimes','description','photo']);
  const section = allowedSections.has(String(body.section || 'all')) ? String(body.section || 'all') : 'all';
  const context = requestSectionPayload(name, section, body, body.current);

  if (!context.cuisineOptions.length) context.cuisineOptions = ['American'];
  if (!context.mealTimeOptions.length) context.mealTimeOptions = ['Lunch / Dinner'];

  try {
    let draft = section === 'photo'
      ? { photoQueries: [] }
      : await callGateway(name, section, context);

    let photo = null;
    if (section === 'all' || section === 'photo') {
      const queries = section === 'photo' ? [name] : draft.photoQueries;
      const excludedPhotos = Array.isArray(body.current?.photos) ? body.current.photos : [body.current?.photo].filter(Boolean);
      photo = await findMealPhoto(name, queries, excludedPhotos);
      draft.photoQueries = section === 'all' ? draft.photoQueries : queries;
    }

    return sendJson(res, 200, {
      ok: true,
      section,
      draft,
      photo,
      model: section === 'photo' ? '' : (process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL)
    });
  } catch (error) {
    const status = error && error.status === 429 ? 429 : error && (error.code === 'AI_AUTH_MISSING' || error.code === 'AI_AUTH_FAILED') ? 503 : 502;
    return sendJson(res, status, {
      ok: false,
      code: error && error.code ? error.code : 'AUTOFILL_FAILED',
      message: error && error.code === 'AI_AUTH_MISSING'
        ? 'Meal Auto-Fill is not connected on this deployment yet.'
        : error && error.code === 'AI_RATE_LIMITED'
          ? 'Meal Auto-Fill is temporarily busy. Please try again.'
          : 'Meal Auto-Fill could not complete that request.'
    });
  }
}

module.exports = handleMealAutofill;
module.exports.__test = {
  cleanName,
  normalizeDraft,
  providerImageUrls,
  findMealPhoto
};
