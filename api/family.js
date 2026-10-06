const family = require('./family-store');

const rateBuckets = new Map();
const MAX_RATE_BUCKETS = 5000;
function pruneRateBuckets(now){
  if(rateBuckets.size<=MAX_RATE_BUCKETS)return;
  for(const [key,row] of rateBuckets){if(!row||now-row.at>120000)rateBuckets.delete(key);}
  if(rateBuckets.size>MAX_RATE_BUCKETS){
    const oldest=[...rateBuckets.entries()].sort((a,b)=>Number(a[1]?.at||0)-Number(b[1]?.at||0)).slice(0,rateBuckets.size-MAX_RATE_BUCKETS);
    for(const [key] of oldest)rateBuckets.delete(key);
  }
}

function clientKey(req) {
  const f = String(req.headers && req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return f || String(req.headers && req.headers['x-real-ip'] || 'unknown');
}
function limited(req, action, max) {
  const key = clientKey(req) + ':' + action;
  const now = Date.now();
  pruneRateBuckets(now);
  const old = rateBuckets.get(key);
  if (!old || now - old.at > 60000) {
    rateBuckets.set(key, {at:now,count:1});
    return false;
  }
  old.count += 1;
  return old.count > max;
}
function send(res, status, body) {
  res.status(status).setHeader('Cache-Control','no-store').setHeader('X-Content-Type-Options','nosniff').json(body);
}

module.exports = async function handler(req, res) {
  if (String(req.method || '').toUpperCase() !== 'POST') {
    return send(res, 405, {ok:false,code:'POST_REQUIRED',message:'Family Mode uses POST requests.'});
  }
  const contentLength=Number(req.headers?.['content-length']||req.headers?.['Content-Length']||0);
  if(Number.isFinite(contentLength)&&contentLength>64*1024)return send(res,413,{ok:false,code:'REQUEST_TOO_LARGE',message:'Family Mode request is too large.'});
  const contentType=String(req.headers?.['content-type']||req.headers?.['Content-Type']||'').toLowerCase();
  if(!contentType.startsWith('application/json'))return send(res,415,{ok:false,code:'JSON_REQUIRED',message:'Family Mode requests must use JSON.'});
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if(Buffer.byteLength(JSON.stringify(body),'utf8')>64*1024)return send(res,413,{ok:false,code:'REQUEST_TOO_LARGE',message:'Family Mode request is too large.'});
  const action = String(body.action || '').trim().toLowerCase();

  try {
    const actionLimit=action==='create'?8:action==='join'?12:['state'].includes(action)?120:30;
    if(limited(req,action,actionLimit))return send(res,429,{ok:false,code:'RATE_LIMITED',message:'Too many Family Mode requests. Please try again shortly.'});

    let result;
    if (action === 'create') result = await family.createFamily(body.displayName);
    else if (action === 'join') result = await family.joinFamily(body.joinCode, body.displayName);
    else if (action === 'state') result = await family.getFamilyState(body.token);
    else if (action === 'create-round') result = await family.createRound(body.token, body);
    else if (action === 'start-round') result = await family.startRound(body.token);
    else if (action === 'vote') result = await family.submitVote(body.token, body);
    else if (action === 'submit-stage') result = await family.markStageSubmitted(body.token, body);
    else if (action === 'rotate-code') result = await family.rotateCode(body.token);
    else if (action === 'end-round') result = await family.endRound(body.token);
    else if (action === 'transfer-host') result = await family.transferHost(body.token, body.targetMemberId);
    else if (action === 'leave') result = await family.leaveFamily(body.token);
    else return send(res, 400, {ok:false,code:'UNKNOWN_ACTION',message:'Unknown Family Mode action.'});

    return send(res, 200, {ok:true,...result});
  } catch (err) {
    const known = new Set([
      'FAMILY_DATABASE_UNCONFIGURED','FAMILY_TOO_SMALL','INVALID_NAME','INVALID_CODE','FAMILY_NOT_FOUND','FAMILY_FULL',
      'HOST_REQUIRED','ROUND_ACTIVE','NO_ROUND','ROUND_ALREADY_STARTED','ROUND_STATE_CHANGED',
      'INVALID_SNAPSHOT','INVALID_DATE','INVALID_ITEM','INVALID_CHOICE','INVALID_STAGE',
      'INVALID_DECISION_TYPE','ROUND_ACCESS','ROUND_STAGE','STAGE_EXPIRED','MEMBER_NOT_FOUND',
      'CODE_UNAVAILABLE','FAMILY_EXPIRED','UNAUTHORIZED'
    ]);
    const code = known.has(err && err.code) ? err.code : 'FAMILY_SERVER_ERROR';
    if (code === 'FAMILY_SERVER_ERROR') console.error('[family]', err);
    return send(res, Number(err && err.status) >= 500 ? 500 : Number(err && err.status) || 400, {
      ok:false,
      code,
      message: code === 'FAMILY_SERVER_ERROR' ? 'Family Mode could not complete that request.' : String(err && err.message || 'Family Mode request failed.')
    });
  }
};
