const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

const DATABASE_URL = String(process.env.FAMILY_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
const MAX_FAMILY_SIZE = 8;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FAMILY_INACTIVITY_MS = 30 * 24 * 60 * 60 * 1000;
const FAMILY_MEMBER_STALE_MS = 15 * 60 * 1000;
const FAMILY_HOST_RECOVERY_MS = 15 * 60 * 1000;

// CP847: One-time, non-destructive Family schema bootstrap for the database
// actually used by this deployment. Every statement is CREATE IF NOT EXISTS.
let familySchemaPromise = null;
const FAMILY_SCHEMA_BOOTSTRAP = [
  "create extension if not exists pgcrypto",
  "create table if not exists family_rooms (\n  family_id uuid primary key default gen_random_uuid(),\n  join_code varchar(6) not null unique,\n  join_code_rotated_at timestamptz not null default now(),\n  member_count integer not null default 0 check (member_count between 0 and 8),\n  host_member_id uuid,\n  active_round_id uuid,\n  schema_version integer not null default 1,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now(),\n  last_activity_at timestamptz not null default now()\n)",
  "create table if not exists family_members (\n  member_id uuid primary key default gen_random_uuid(),\n  family_id uuid not null references family_rooms(family_id) on delete cascade,\n  display_name varchar(40) not null,\n  token_hash varchar(64) not null unique,\n  role varchar(10) not null check (role in ('host','member')),\n  active boolean not null default true,\n  joined_at timestamptz not null default now(),\n  last_seen_at timestamptz not null default now()\n)",
  "create table if not exists family_rounds (\n  round_id uuid primary key default gen_random_uuid(),\n  family_id uuid not null references family_rooms(family_id) on delete cascade,\n  created_by_member_id uuid not null references family_members(member_id),\n  status varchar(20) not null check (status in ('setup','swiping','finalists','final_swiping','tiebreak','complete','ended')),\n  decision_type varchar(12) not null check (decision_type in ('meal','restaurant')),\n  snapshot jsonb not null default '{}'::jsonb,\n  dinner_target_at timestamptz,\n  stage_started_at timestamptz,\n  stage_deadline_at timestamptz,\n  current_stage smallint not null default 1 check (current_stage between 1 and 3),\n  winner_item jsonb,\n  winner_saved boolean not null default false,\n  expires_at timestamptz not null,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now(),\n  completed_at timestamptz\n)",
  "create table if not exists family_round_members (\n  round_id uuid not null references family_rounds(round_id) on delete cascade,\n  member_id uuid not null references family_members(member_id) on delete cascade,\n  included boolean not null default true,\n  joined_at timestamptz not null default now(),\n  submitted_stage1_at timestamptz,\n  submitted_stage2_at timestamptz,\n  submitted_tiebreak_at timestamptz,\n  last_seen_at timestamptz not null default now(),\n  primary key (round_id, member_id)\n)",
  "create table if not exists family_votes (\n  round_id uuid not null references family_rounds(round_id) on delete cascade,\n  stage varchar(12) not null check (stage in ('initial','finalist','tiebreak')),\n  member_id uuid not null references family_members(member_id) on delete cascade,\n  item_id varchar(160) not null,\n  choice varchar(8) not null check (choice in ('cut','maybe','choose')),\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now(),\n  primary key (round_id, stage, member_id, item_id)\n)",
  "create table if not exists family_events (\n  event_id uuid primary key default gen_random_uuid(),\n  family_id uuid not null references family_rooms(family_id) on delete cascade,\n  round_id uuid references family_rounds(round_id) on delete set null,\n  member_id uuid references family_members(member_id) on delete set null,\n  event_type varchar(40) not null,\n  payload jsonb not null default '{}'::jsonb,\n  created_at timestamptz not null default now()\n)",
  "create index if not exists idx_family_members_family on family_members(family_id, active)",
  "create index if not exists idx_family_rounds_family on family_rounds(family_id, created_at desc)",
  "create index if not exists idx_family_round_members_round on family_round_members(round_id, member_id)",
  "create index if not exists idx_family_votes_round_stage on family_votes(round_id, stage)",
  "create index if not exists idx_family_events_family_time on family_events(family_id, created_at desc)"
];

async function readyDb() {
  const sql = db();
  if (!familySchemaPromise) {
    familySchemaPromise = (async () => {
      for (const statement of FAMILY_SCHEMA_BOOTSTRAP) await sql.query(statement);
    })().catch(err => {
      familySchemaPromise = null;
      throw err;
    });
  }
  await familySchemaPromise;
  return sql;
}

function db() {
  if (!DATABASE_URL) {
    const e = new Error('Family Mode database is not configured.');
    e.code = 'FAMILY_DATABASE_UNCONFIGURED';
    throw e;
  }
  return neon(DATABASE_URL);
}
function fail(code, message, status) {
  const e = new Error(message);
  e.code = code;
  e.status = status || 400;
  throw e;
}
function cleanName(v) {
  const s = String(v || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!s) fail('INVALID_NAME', 'Enter a name to join Family Mode.');
  return s;
}
function stageItemIds(round, currentStage) {
  const snapshot = round && round.snapshot && typeof round.snapshot === 'object' ? round.snapshot : {};
  if (currentStage === 'initial') {
    const excluded = new Set(Array.isArray(snapshot.hostExcluded) ? snapshot.hostExcluded.map(String) : []);
    return (Array.isArray(snapshot.pool) ? snapshot.pool : [])
      .filter(item => item && item.id && !excluded.has(String(item.id)))
      .map(item => String(item.id));
  }
  if (currentStage === 'finalist') {
    return Array.isArray(snapshot.finalists) ? Array.from(new Set(snapshot.finalists.map(String).filter(Boolean))) : [];
  }
  return Array.isArray(snapshot.tiebreakItems) ? Array.from(new Set(snapshot.tiebreakItems.map(String).filter(Boolean))) : [];
}
function token() { return crypto.randomBytes(32).toString('base64url'); }
function hash(v) { return crypto.createHash('sha256').update(String(v || '')).digest('hex'); }
function code() {
  let out = '';
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  return out;
}
function normalizeCode(v) { return String(v || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6); }
function prettyCode(v) {
  const s = normalizeCode(v);
  return s.length === 6 ? s.slice(0, 3) + ' · ' + s.slice(3) : s;
}
function decisionType(v) {
  const s = String(v || '').toLowerCase();
  if (!['meal', 'restaurant'].includes(s)) fail('INVALID_DECISION_TYPE', 'Choose Meals or Restaurants.');
  return s;
}
function choice(v) {
  const s = String(v || '').toLowerCase();
  if (!['cut', 'maybe', 'choose'].includes(s)) fail('INVALID_CHOICE', 'Invalid choice.');
  return s;
}
function stage(v) {
  const s = String(v || '').toLowerCase();
  if (!['initial', 'finalist', 'tiebreak'].includes(s)) fail('INVALID_STAGE', 'Invalid stage.');
  return s;
}
function itemId(v) {
  const s = String(v || '').trim().slice(0, 160);
  if (!s || /[\x00-\x1f]/.test(s)) fail('INVALID_ITEM', 'Invalid choice.');
  return s;
}
function targetDate(v) {
  if (v == null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) fail('INVALID_DATE', 'Invalid dinner time.');
  return d;
}
function sanitizeSnapshot(input, type) {
  const raw = input && typeof input === 'object' ? input : {};
  const pool = Array.isArray(raw.pool) ? raw.pool.slice(0, 150) : [];
  const cleanPool = pool.map(function(item) {
    return {
      id: String(item && item.id || '').slice(0, 160),
      name: String(item && item.name || '').slice(0, 160),
      category: String(item && item.category || '').slice(0, 80),
      cuisine: String(item && item.cuisine || '').slice(0, 120),
      image: String(item && item.image || '').slice(0, 2000),
      address: String(item && item.address || '').slice(0, 500),
      website: String(item && item.website || '').slice(0, 1200),
      phone: String(item && item.phone || '').slice(0, 100),
      distance: Number.isFinite(Number(item && item.distance)) ? Number(item.distance) : null
    };
  }).filter(function(item) { return item.id && item.name; });

  if (!cleanPool.length) fail('INVALID_SNAPSHOT', 'Family rounds need at least one choice.');
  const hostExcluded = Array.isArray(raw.hostExcluded)
    ? Array.from(new Set(raw.hostExcluded.map(function(v){ return String(v).slice(0,160); }).filter(Boolean)))
    : [];
  const remainingCount = cleanPool.filter(function(item){ return !hostExcluded.includes(String(item.id)); }).length;
  if (remainingCount < 2) fail('INVALID_SNAPSHOT', 'Keep at least 2 choices for the Family.');

  return {
    version: 1,
    decisionType: type,
    pool: cleanPool,
    hostExcluded: hostExcluded.slice(0,150),
    location: raw.location && Number.isFinite(Number(raw.location.lat)) && Number.isFinite(Number(raw.location.lon))
      ? { lat: Number(raw.location.lat), lon: Number(raw.location.lon) } : null,
    radius: Math.max(1, Math.min(100, Number(raw.radius) || 10)),
    searchTerm: String(raw.searchTerm || '').trim().slice(0,120),
    openState: ['open','all'].includes(String(raw.openState)) ? String(raw.openState) : 'all',
    quickCuts: Array.isArray(raw.quickCuts)
      ? Array.from(new Set(raw.quickCuts.map(function(v){ return String(v).slice(0,80); }).filter(Boolean))).slice(0,30)
      : [],
    frozenAt: new Date().toISOString()
  };
}
function publicFamily(r) {
  return { id:r.family_id, joinCode:prettyCode(r.join_code), memberCount:Number(r.member_count || 0), activeRoundId:r.active_round_id || null, schemaVersion:r.schema_version, createdAt:r.created_at, updatedAt:r.updated_at, lastActivityAt:r.last_activity_at };
}
function publicMember(r) {
  return { id:r.member_id, name:r.display_name, role:r.role, active:Boolean(r.active), joinedAt:r.joined_at, lastSeenAt:r.last_seen_at };
}
function publicRound(r) {
  if (!r) return null;
  return { id:r.round_id, status:r.status, decisionType:r.decision_type, snapshot:r.snapshot, dinnerTargetAt:r.dinner_target_at, stageStartedAt:r.stage_started_at, stageDeadlineAt:r.stage_deadline_at, currentStage:Number(r.current_stage), winnerItem:r.winner_item || null, winnerSaved:Boolean(r.winner_saved), expiresAt:r.expires_at, createdAt:r.created_at, updatedAt:r.updated_at, completedAt:r.completed_at || null };
}
async function auth(sql, value) {
  const rows = await sql.query('select * from family_members where token_hash = $1 and active = true limit 1', [hash(value)]);
  if (!rows[0]) fail('UNAUTHORIZED', 'Your Family Mode session is no longer active.', 401);
  return rows[0];
}
async function event(sql, familyId, roundId, memberId, eventType, payload) {
  await sql.query(
    'insert into family_events (family_id, round_id, member_id, event_type, payload) values ($1,$2,$3,$4,$5::jsonb)',
    [familyId, roundId || null, memberId || null, eventType, JSON.stringify(payload || {})]
  );
}
async function createFamily(nameValue) {
  const sql = await readyDb();
  const name = cleanName(nameValue);
  const memberId = crypto.randomUUID();
  const sessionToken = token();
  const tokenHash = hash(sessionToken);

  for (let attempt = 0; attempt < 5; attempt++) {
    const familyId = crypto.randomUUID();
    const joinCode = code();
    try {
      await sql.query('insert into family_rooms (family_id, join_code, member_count) values ($1,$2,0)', [familyId, joinCode]);
      await sql.query('insert into family_members (member_id, family_id, display_name, token_hash, role) values ($1,$2,$3,$4,$5)', [memberId, familyId, name, tokenHash, 'host']);
      await sql.query('update family_rooms set host_member_id=$1, member_count=1, updated_at=now(), last_activity_at=now() where family_id=$2', [memberId, familyId]);
      await event(sql, familyId, null, memberId, 'family_created', {});
      const family = (await sql.query('select * from family_rooms where family_id=$1', [familyId]))[0];
      const member = (await sql.query('select * from family_members where member_id=$1', [memberId]))[0];
      return { family:publicFamily(family), member:publicMember(member), token:sessionToken };
    } catch (err) {
      try { await sql.query('delete from family_rooms where family_id=$1', [familyId]); } catch (_) {}
      if (String(err && err.message || '').toLowerCase().includes('duplicate key') && String(err && err.message || '').includes('join_code')) continue;
      throw err;
    }
  }
  fail('CODE_UNAVAILABLE', 'Could not create a Family Mode room. Please try again.', 503);
}
async function joinFamily(codeValue, nameValue) {
  const sql = await readyDb();
  const joinCode = normalizeCode(codeValue);
  if (!/^[A-Z0-9]{6}$/.test(joinCode)) fail('INVALID_CODE', 'Enter the 6-character Family code.');
  const name = cleanName(nameValue);
  const familyRows = await sql.query('select * from family_rooms where join_code=$1 limit 1', [joinCode]);
  const family = familyRows[0];
  if (!family) fail('FAMILY_NOT_FOUND', 'That Family code was not found.', 404);
  if (Number(family.member_count || 0) === 0 && Date.now() - new Date(family.last_activity_at).getTime() > FAMILY_INACTIVITY_MS) {
    fail('FAMILY_EXPIRED', 'That Family has expired. Create a new Family.', 410);
  }

  const claimed = await sql.query(
    'update family_rooms set member_count=member_count+1, updated_at=now(), last_activity_at=now() where family_id=$1 and member_count < $2 returning *',
    [family.family_id, MAX_FAMILY_SIZE]
  );
  if (!claimed[0]) fail('FAMILY_FULL', 'This Family already has 8 members.', 409);

  const memberId = crypto.randomUUID();
  const sessionToken = token();
  try {
    await sql.query(
      'insert into family_members (member_id, family_id, display_name, token_hash, role) values ($1,$2,$3,$4,$5)',
      [memberId, family.family_id, name, hash(sessionToken), 'member']
    );
    await event(sql, family.family_id, null, memberId, 'member_joined', {});
  } catch (err) {
    await sql.query('update family_rooms set member_count=greatest(0, member_count-1), updated_at=now() where family_id=$1', [family.family_id]);
    throw err;
  }

  const nextFamily = (await sql.query('select * from family_rooms where family_id=$1', [family.family_id]))[0];
  const member = (await sql.query('select * from family_members where member_id=$1', [memberId]))[0];
  return { family:publicFamily(nextFamily), member:publicMember(member), token:sessionToken };
}
function buildTimePlan(dinnerTargetAt){
  const now=Date.now();
  const target=dinnerTargetAt?new Date(dinnerTargetAt).getTime():now+25*60*1000;
  const remaining=Math.max(8*60*1000,target-now);
  const initialMs=Math.max(2*60*1000,Math.floor(remaining*0.46));
  const finalistMs=Math.max(2*60*1000,Math.floor(remaining*0.32));
  const finalMs=Math.max(2*60*1000,remaining-initialMs-finalistMs);
  return {initialMs,finalistMs,finalMs,targetMs:target};
}
async function advanceInitialStageIfReady(sql,round){
  if(!round||round.status!=='swiping')return round;
  const members=await sql.query('select submitted_stage1_at from family_round_members where round_id=$1 and included=true',[round.round_id]);
  const allSubmitted=members.length>0&&members.every(m=>!!m.submitted_stage1_at);
  const expired=round.stage_deadline_at&&new Date(round.stage_deadline_at).getTime()<=Date.now();
  if(!allSubmitted&&!expired)return round;
  const updated=(await sql.query(
    "update family_rounds set status='finalists',current_stage=1,stage_started_at=now(),stage_deadline_at=null,updated_at=now() where round_id=$1 and status='swiping' returning *",
    [round.round_id]
  ))[0];
  return updated||round;
}
async function ensureFinalistsStage(sql,round){
  if(!round||round.status!=='finalists')return round;
  const members=await sql.query('select member_id from family_round_members where round_id=$1 and included=true order by joined_at asc',[round.round_id]);
  const memberIds=members.map(m=>m.member_id);
  const votes=memberIds.length?await sql.query('select member_id,item_id,choice from family_votes where round_id=$1 and stage=$2',[round.round_id,'initial']):[];
  const byItem=new Map();
  for(const v of votes){const id=String(v.item_id);const row=byItem.get(id)||{support:0,choose:0,maybe:0};if(v.choice==='maybe'){row.support++;row.maybe++;}else if(v.choice==='choose'){row.support++;row.choose++;}byItem.set(id,row);}
  const snapshot=round.snapshot||{};
  const excluded=new Set(Array.isArray(snapshot.hostExcluded)?snapshot.hostExcluded.map(String):[]);
  const pool=Array.isArray(snapshot.pool)?snapshot.pool.filter(item=>item&&item.id&&!excluded.has(String(item.id))):[];
  const total=Math.max(1,memberIds.length);
  const scored=pool.map((item,index)=>{const v=byItem.get(String(item.id))||{support:0,choose:0,maybe:0};return {item,index,support:v.support,choose:v.choose,maybe:v.maybe,qualified:v.support*2>=total,weighted:v.support+v.choose};});
  const qualified=scored.filter(x=>x.qualified).sort((a,b)=>b.support-a.support||b.choose-a.choose||b.weighted-a.weighted||a.index-b.index);
  let selected=qualified.slice(0,8);
  if(selected.length===0){ selected=scored.slice().sort((a,b)=>b.support-a.support||b.weighted-a.weighted||b.choose-a.choose||a.index-b.index).slice(0,Math.min(8,scored.length)); }
  const finalists=selected.map(x=>x.item);
  if(!finalists.length){
    const updated=(await sql.query("update family_rounds set status='ended',updated_at=now(),completed_at=now() where round_id=$1 and status='finalists' returning *",[round.round_id]))[0];
    return updated||round;
  }
  if(finalists.length===1){
    const updated=(await sql.query("update family_rounds set status='complete',current_stage=1,stage_started_at=now(),stage_deadline_at=null,winner_item=$1::jsonb,winner_saved=false,completed_at=now(),updated_at=now(),snapshot=$2::jsonb where round_id=$3 and status='finalists' returning *",[JSON.stringify(finalists[0]),JSON.stringify({...snapshot,finalists:finalists.map(x=>String(x.id))}),round.round_id]))[0];
    await sql.query('update family_rooms set active_round_id=null,updated_at=now(),last_activity_at=now() where family_id=$1 and active_round_id=$2',[round.family_id,round.round_id]);
    return updated||round;
  }
  const plan=snapshot.timePlan||{};
  const targetMs=Number(plan.targetMs)||Date.now()+10*60*1000;
  const available=Math.max(2*60*1000,targetMs-Date.now()-2*60*1000);
  const finalistMs=Math.max(2*60*1000,Math.min(Number(plan.finalistMs)||available,available));
  const deadline=new Date(Math.min(Date.now()+finalistMs,targetMs-2*60*1000));
  const updated=(await sql.query("update family_rounds set status='final_swiping',current_stage=2,stage_started_at=now(),stage_deadline_at=$1,snapshot=$2::jsonb,updated_at=now() where round_id=$3 and status='finalists' returning *",[deadline,JSON.stringify({...snapshot,finalists:finalists.map(x=>String(x.id))}),round.round_id]))[0];
  return updated||round;
}
function winnerScores(votes){
  const map=new Map();
  for(const v of votes){
    const id=String(v.item_id);
    const row=map.get(id)||{choose:0,maybe:0,cut:0,score:0};
    if(v.choice==='choose'){row.choose++;row.score+=2;} else if(v.choice==='maybe'){row.maybe++;row.score+=1;} else row.cut++;
    map.set(id,row);
  }
  return map;
}
function stableItemOrder(snapshot,id){
  const pool=Array.isArray(snapshot?.pool)?snapshot.pool:[];
  const idx=pool.findIndex(x=>String(x?.id)===String(id));
  return idx<0?999999:idx;
}
async function completeRound(sql,round,item){
  const updated=(await sql.query("update family_rounds set status='complete',winner_item=$1::jsonb,winner_saved=false,stage_deadline_at=null,completed_at=now(),updated_at=now() where round_id=$2 and status not in ('complete','ended') returning *",[JSON.stringify(item),round.round_id]))[0];
  if(updated) await sql.query('update family_rooms set active_round_id=null,updated_at=now(),last_activity_at=now() where family_id=$1 and active_round_id=$2',[round.family_id,round.round_id]);
  return updated||round;
}
async function finalizeFinalStage(sql,round){
  if(!round||round.status!=='final_swiping')return round;
  const members=await sql.query('select member_id from family_round_members where round_id=$1 and included=true order by joined_at asc',[round.round_id]);
  const allSubmitted=members.length>0&&members.every(m=>m.submitted_stage2_at);
  const expired=round.stage_deadline_at&&new Date(round.stage_deadline_at).getTime()<=Date.now();
  if(!allSubmitted&&!expired)return round;
  const snapshot=round.snapshot||{};
  const finalists=Array.isArray(snapshot.finalists)?snapshot.finalists.map(String):[];
  const pool=Array.isArray(snapshot.pool)?snapshot.pool:[];
  const allowed=new Set(finalists);
  const voteRows=await sql.query('select item_id,choice from family_votes where round_id=$1 and stage=$2',[round.round_id,'finalist']);
  const scores=winnerScores(voteRows);
  const scored=finalists.map(id=>{const row=scores.get(id)||{score:0,choose:0,maybe:0,cut:0};return{id,score:row.score,choose:row.choose,maybe:row.maybe,order:stableItemOrder(snapshot,id)};}).sort((a,b)=>b.score-a.score||b.choose-a.choose||b.maybe-a.maybe||a.order-b.order);
  if(!scored.length){return completeRound(sql,round,null);}
  const topScore=scored[0].score;
  const tied=scored.filter(x=>x.score===topScore);
  if(tied.length===1){
    const item=pool.find(x=>String(x?.id)===tied[0].id)||null;
    return completeRound(sql,round,item);
  }
  const tiedIds=tied.map(x=>x.id);
  const plan=snapshot.timePlan||{};
  const targetMs=Number(plan.targetMs)||Date.now()+2*60*1000;
  const available=Math.max(60000,targetMs-Date.now()-60000);
  const deadline=new Date(Math.min(Date.now()+Math.min(90000,available),targetMs-60000));
  const updated=(await sql.query("update family_rounds set status='tiebreak',current_stage=3,stage_started_at=now(),stage_deadline_at=$1,snapshot=$2::jsonb,updated_at=now() where round_id=$3 and status='final_swiping' returning *",[deadline,JSON.stringify({...snapshot,tiebreakItems:tiedIds}),round.round_id]))[0];
  return updated||round;
}
async function finalizeTiebreak(sql,round){
  if(!round||round.status!=='tiebreak')return round;
  const members=await sql.query('select member_id from family_round_members where round_id=$1 and included=true order by joined_at asc',[round.round_id]);
  const allSubmitted=members.length>0&&members.every(m=>m.submitted_tiebreak_at);
  const expired=round.stage_deadline_at&&new Date(round.stage_deadline_at).getTime()<=Date.now();
  if(!allSubmitted&&!expired)return round;
  const snapshot=round.snapshot||{};
  const ids=Array.isArray(snapshot.tiebreakItems)?snapshot.tiebreakItems.map(String):[];
  const pool=Array.isArray(snapshot.pool)?snapshot.pool:[];
  const votes=await sql.query('select item_id,choice from family_votes where round_id=$1 and stage=$2',[round.round_id,'tiebreak']);
  const scores=winnerScores(votes);
  const scored=ids.map(id=>{const row=scores.get(id)||{score:0,choose:0,maybe:0,cut:0};return{id,score:row.score,choose:row.choose,maybe:row.maybe,order:stableItemOrder(snapshot,id)};}).sort((a,b)=>b.score-a.score||b.choose-a.choose||b.maybe-a.maybe||a.order-b.order);
  if(!scored.length)return completeRound(sql,round,null);
  const top=scored[0].score,tied=scored.filter(x=>x.score===top);
  let chosen=tied[0];
  if(tied.length>1) chosen=tied[crypto.randomInt(0,tied.length)];
  const item=pool.find(x=>String(x?.id)===chosen.id)||null;
  return completeRound(sql,round,item);
}
async function expireActiveRound(sql,family){
  if(!family?.active_round_id)return family;
  const round=(await sql.query('select * from family_rounds where round_id=$1 and family_id=$2',[family.active_round_id,family.family_id]))[0];
  if(!round)return family;
  if(!round.expires_at||new Date(round.expires_at).getTime()>Date.now())return family;
  if(['complete','ended'].includes(round.status))return family;
  await sql.query("update family_rounds set status='ended',completed_at=now(),updated_at=now() where round_id=$1 and status not in ('complete','ended')",[round.round_id]);
  await sql.query('update family_rooms set active_round_id=null,updated_at=now(),last_activity_at=now() where family_id=$1 and active_round_id=$2',[family.family_id,round.round_id]);
  return (await sql.query('select * from family_rooms where family_id=$1',[family.family_id]))[0]||family;
}
async function recoverFamilyHost(sql,family){
  if(!family?.host_member_id)return family;
  const host=(await sql.query('select * from family_members where member_id=$1 and family_id=$2 and active=true',[family.host_member_id,family.family_id]))[0];
  if(!host)return family;
  if(Date.now()-new Date(host.last_seen_at).getTime()<FAMILY_HOST_RECOVERY_MS)return family;
  const replacement=(await sql.query('select * from family_members where family_id=$1 and active=true and member_id<>$2 order by joined_at asc limit 1',[family.family_id,host.member_id]))[0];
  if(!replacement)return family;
  await sql.query("update family_members set role='member' where family_id=$1 and role='host'",[family.family_id]);
  await sql.query("update family_members set role='host' where member_id=$1 and family_id=$2",[replacement.member_id,family.family_id]);
  await sql.query('update family_rooms set host_member_id=$1,updated_at=now(),last_activity_at=now() where family_id=$2',[replacement.member_id,family.family_id]);
  await event(sql,family.family_id,family.active_round_id,replacement.member_id,'host_recovered',{fromMemberId:host.member_id});
  return (await sql.query('select * from family_rooms where family_id=$1',[family.family_id]))[0]||family;
}
async function leaveFamily(sessionToken){
  const sql=db();
  const me=await auth(sql,sessionToken);
  const family=(await sql.query('select * from family_rooms where family_id=$1',[me.family_id]))[0];
  if(!family)return {ok:true};
  const members=await sql.query('select * from family_members where family_id=$1 and active=true order by joined_at asc',[family.family_id]);
  if(members.length<=1){
    await sql.query('update family_members set active=false,last_seen_at=now() where member_id=$1',[me.member_id]);
    if(family.active_round_id){
      await sql.query("update family_rounds set status='ended',updated_at=now(),completed_at=now() where round_id=$1 and status not in ('complete','ended')",[family.active_round_id]);
    }
    await sql.query('update family_rooms set member_count=0,host_member_id=null,active_round_id=null,updated_at=now(),last_activity_at=now() where family_id=$1',[family.family_id]);
    return {ok:true,empty:true};
  }
  await sql.query('update family_members set active=false,role=\'member\',last_seen_at=now() where member_id=$1',[me.member_id]);
  if(family.active_round_id){await sql.query('update family_round_members set included=false,last_seen_at=now() where round_id=$1 and member_id=$2',[family.active_round_id,me.member_id]);}
  let nextFamily=family;
  if(family.host_member_id===me.member_id){
    const replacement=(await sql.query('select member_id from family_members where family_id=$1 and active=true order by joined_at asc limit 1',[family.family_id]))[0];
    if(replacement){
      await sql.query("update family_members set role='member' where family_id=$1 and role='host'",[family.family_id]);
      await sql.query("update family_members set role='host' where member_id=$1 and family_id=$2",[replacement.member_id,family.family_id]);
      await sql.query('update family_rooms set host_member_id=$1 where family_id=$2',[replacement.member_id,family.family_id]);
    }
  }
  await sql.query('update family_rooms set member_count=(select count(*)::integer from family_members where family_id=$1 and active=true),updated_at=now(),last_activity_at=now() where family_id=$1',[family.family_id]);
  await event(sql,family.family_id,family.active_round_id,me.member_id,'member_left',{});
  return {ok:true};
}
async function pruneStaleMembers(sql,family){
  if(!family)return family;
  const cutoff=new Date(Date.now()-FAMILY_MEMBER_STALE_MS);
  const stale=await sql.query(
    'select member_id from family_members where family_id=$1 and active=true and member_id<>$2 and last_seen_at < $3 order by joined_at asc',
    [family.family_id,family.host_member_id,cutoff]
  );
  for(const row of stale){
    await sql.query(
      "update family_members set active=false,role='member',last_seen_at=now() where member_id=$1 and family_id=$2 and active=true",
      [row.member_id,family.family_id]
    );
    if(family.active_round_id){
      await sql.query(
        'update family_round_members set included=false,last_seen_at=now() where round_id=$1 and member_id=$2 and included=true',
        [family.active_round_id,row.member_id]
      );
    }
  }
  if(!stale.length)return family;
  await sql.query(
    'update family_rooms set member_count=(select count(*)::integer from family_members where family_id=$1 and active=true),updated_at=now(),last_activity_at=now() where family_id=$1',
    [family.family_id]
  );
  let next=(await sql.query('select * from family_rooms where family_id=$1',[family.family_id]))[0]||family;
  if(next.active_round_id){
    const included=(await sql.query(
      'select count(*)::integer as count from family_round_members where round_id=$1 and included=true',
      [next.active_round_id]
    ))[0];
    if(Number(included?.count||0)<2){
      await sql.query(
        "update family_rounds set status='ended',updated_at=now(),completed_at=now() where round_id=$1 and status not in ('complete','ended')",
        [next.active_round_id]
      );
      await sql.query(
        'update family_rooms set active_round_id=null,updated_at=now(),last_activity_at=now() where family_id=$1 and active_round_id=$2',
        [next.family_id,next.active_round_id]
      );
      next=(await sql.query('select * from family_rooms where family_id=$1',[next.family_id]))[0]||next;
    }
  }
  return next;
}
async function getFamilyState(sessionToken) {
  const sql = await readyDb();
  const me = await auth(sql, sessionToken);
  await sql.query('update family_members set last_seen_at=now() where member_id=$1', [me.member_id]);
  await sql.query('update family_rooms set last_activity_at=now() where family_id=$1', [me.family_id]);

  let family = (await sql.query('select * from family_rooms where family_id=$1', [me.family_id]))[0];
  family = await expireActiveRound(sql,family);
  family = await pruneStaleMembers(sql,family);
  family = await recoverFamilyHost(sql,family);
  const refreshedMe=(await sql.query('select * from family_members where member_id=$1',[me.member_id]))[0]||me;
  const members = await sql.query('select * from family_members where family_id=$1 and active=true order by joined_at asc', [me.family_id]);
  let round = null;
  let lastCompletedRound = null;
  let roundMembers = [];
  let myVotes = [];

  if (family.active_round_id) {
    round = (await sql.query('select * from family_rounds where round_id=$1 and family_id=$2', [family.active_round_id, family.family_id]))[0] || null;
    if (round) {
      round = await advanceInitialStageIfReady(sql, round);
      round = await ensureFinalistsStage(sql, round);
      round = await finalizeFinalStage(sql, round);
      round = await finalizeTiebreak(sql, round);
      roundMembers = await sql.query(
        'select frm.*, fm.display_name, fm.role from family_round_members frm join family_members fm on fm.member_id=frm.member_id where frm.round_id=$1 order by frm.joined_at asc',
        [round.round_id]
      );
      myVotes = await sql.query(
        'select stage,item_id,choice,updated_at from family_votes where round_id=$1 and member_id=$2 order by stage,item_id',
        [round.round_id, me.member_id]
      );
    }
  }
  if (!round || round.status === 'complete') {
    const candidate = (await sql.query(
      "select * from family_rounds where family_id=$1 and status='complete' order by completed_at desc nulls last, created_at desc limit 1",
      [family.family_id]
    ))[0] || null;
    if(candidate){
      const participated=(await sql.query(
        'select 1 from family_round_members where round_id=$1 and member_id=$2 and included=true limit 1',
        [candidate.round_id,me.member_id]
      ))[0];
      if(participated)lastCompletedRound=candidate;
    }
  }

  return {
    family:publicFamily(family),
    me:publicMember(refreshedMe),
    members:members.map(publicMember),
    activeRound:publicRound(round),
    lastCompletedRound:publicRound(lastCompletedRound),
    roundMembers:roundMembers.map(function(r){
      return {
        memberId:r.member_id, name:r.display_name, role:r.role, included:Boolean(r.included),
        submittedStage1:Boolean(r.submitted_stage1_at), submittedStage2:Boolean(r.submitted_stage2_at),
        submittedTiebreak:Boolean(r.submitted_tiebreak_at), lastSeenAt:r.last_seen_at
      };
    }),
    myVotes:myVotes.map(function(v){ return {stage:v.stage,itemId:v.item_id,choice:v.choice,updatedAt:v.updated_at}; })
  };
}
async function createRound(sessionToken, payload) {
  const sql = await readyDb();
  const me = await auth(sql, sessionToken);
  const family = (await sql.query('select * from family_rooms where family_id=$1', [me.family_id]))[0];
  if (!family || family.host_member_id !== me.member_id) fail('HOST_REQUIRED', 'Only the host can create the dinner decision.', 403);
  if (family.active_round_id) fail('ROUND_ACTIVE', 'Finish or end the current dinner decision first.', 409);

  const type = decisionType(payload && payload.decisionType);
  const snapshot = sanitizeSnapshot(payload && payload.snapshot, type);
  const dinnerTargetAt = targetDate(payload && payload.dinnerTargetAt);
  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const round = (await sql.query(
    'insert into family_rounds (family_id,created_by_member_id,status,decision_type,snapshot,dinner_target_at,stage_started_at,expires_at) values ($1,$2,$3,$4,$5::jsonb,$6,now(),$7) returning *',
    [family.family_id, me.member_id, 'setup', type, JSON.stringify(snapshot), dinnerTargetAt, expiresAt]
  ))[0];

  await sql.query('update family_rooms set active_round_id=$1,updated_at=now(),last_activity_at=now() where family_id=$2', [round.round_id, family.family_id]);
  await event(sql, family.family_id, round.round_id, me.member_id, 'round_created', {decisionType:type});
  return publicRound(round);
}
async function startRound(sessionToken) {
  const sql = await readyDb();
  const me = await auth(sql, sessionToken);
  const family = (await sql.query('select * from family_rooms where family_id=$1', [me.family_id]))[0];
  if (!family || family.host_member_id !== me.member_id) fail('HOST_REQUIRED', 'Only the host can start the dinner decision.', 403);
  const round = family.active_round_id ? (await sql.query('select * from family_rounds where round_id=$1', [family.active_round_id]))[0] : null;
  if (!round) fail('NO_ROUND', 'No dinner decision is ready to start.', 409);
  if (round.status !== 'setup') fail('ROUND_ALREADY_STARTED', 'This dinner decision has already started.', 409);

  const activeMembers = await sql.query('select member_id from family_members where family_id=$1 and active=true order by joined_at asc', [family.family_id]);
  if(activeMembers.length < 2) fail('FAMILY_TOO_SMALL','Family Mode needs at least 2 active members to start.',409);
  await sql.query('insert into family_round_members (round_id,member_id,included) select $1,member_id,true from family_members where family_id=$2 and active=true on conflict do nothing', [round.round_id, family.family_id]);
  const plan = buildTimePlan(round.dinner_target_at);
  const deadline = new Date(Math.min(Date.now() + plan.initialMs, plan.targetMs - 2 * 60 * 1000));
  const updatedSnapshot = {...(round.snapshot || {}), timePlan:plan};

  const updated = (await sql.query(
    'update family_rounds set status=$1,current_stage=1,stage_started_at=now(),stage_deadline_at=$2,snapshot=$3::jsonb,updated_at=now() where round_id=$4 and status=$5 returning *',
    ['swiping', deadline, JSON.stringify(updatedSnapshot), round.round_id, 'setup']
  ))[0];
  if (!updated) fail('ROUND_STATE_CHANGED', 'The dinner decision changed. Refresh and try again.', 409);
  await event(sql, family.family_id, round.round_id, me.member_id, 'round_started', {});
  return publicRound(updated);
}
async function submitVote(sessionToken, payload) {
  const sql = await readyDb();
  const me = await auth(sql, sessionToken);
  const roundId = itemId(payload && payload.roundId);
  const currentStage = stage(payload && payload.stage);
  const item = itemId(payload && payload.itemId);
  const currentChoice = choice(payload && payload.choice);

  const rows = await sql.query(
    'select fr.*,frm.included from family_rounds fr join family_round_members frm on frm.round_id=fr.round_id and frm.member_id=$1 where fr.round_id=$2 and fr.family_id=$3 limit 1',
    [me.member_id, roundId, me.family_id]
  );
  const round = rows[0];
  if (!round || !round.included) fail('ROUND_ACCESS', 'You are not part of this dinner decision.', 403);
  const expected = currentStage === 'initial' ? 'swiping' : currentStage === 'finalist' ? 'final_swiping' : 'tiebreak';
  const expectedStageNumber = currentStage === 'initial' ? 1 : currentStage === 'finalist' ? 2 : 3;
  if (round.status !== expected || Number(round.current_stage||0) !== expectedStageNumber) fail('ROUND_STAGE', 'That stage is not accepting choices right now.', 409);
  if (round.stage_deadline_at && new Date(round.stage_deadline_at).getTime() < Date.now()) fail('STAGE_EXPIRED', 'That stage has expired.', 409);
  const allowedIds = new Set(stageItemIds(round,currentStage));
  if (!allowedIds.has(item)) fail('INVALID_ITEM', 'That choice is not part of this stage.');

  await sql.query(
    'insert into family_votes (round_id,stage,member_id,item_id,choice) values ($1,$2,$3,$4,$5) on conflict (round_id,stage,member_id,item_id) do update set choice=excluded.choice,updated_at=now()',
    [roundId, currentStage, me.member_id, item, currentChoice]
  );
  await sql.query('update family_members set last_seen_at=now() where member_id=$1', [me.member_id]);
  await sql.query('update family_round_members set last_seen_at=now() where round_id=$1 and member_id=$2', [roundId, me.member_id]);
  let nextRound=await advanceInitialStageIfReady(sql, round);
  nextRound=await ensureFinalistsStage(sql,nextRound);
  nextRound=await finalizeFinalStage(sql,nextRound);
  nextRound=await finalizeTiebreak(sql,nextRound);
  return {ok:true,roundId,stage:currentStage,itemId:item,choice:currentChoice,round:publicRound(nextRound)};
}
async function markStageSubmitted(sessionToken, payload) {
  const sql = await readyDb();
  const me = await auth(sql, sessionToken);
  const roundId = itemId(payload && payload.roundId);
  const currentStage = stage(payload && payload.stage);
  const col = currentStage === 'initial' ? 'submitted_stage1_at' : currentStage === 'finalist' ? 'submitted_stage2_at' : 'submitted_tiebreak_at';
  const rows = await sql.query(
    'select fr.* from family_rounds fr join family_round_members frm on frm.round_id=fr.round_id and frm.member_id=$1 where fr.round_id=$2 and fr.family_id=$3 and frm.included=true limit 1',
    [me.member_id, roundId, me.family_id]
  );
  const round = rows[0];
  if (!round) fail('ROUND_ACCESS', 'You are not part of this dinner decision.', 403);
  const expectedStatus = currentStage === 'initial' ? 'swiping' : currentStage === 'finalist' ? 'final_swiping' : 'tiebreak';
  const expectedStageNumber = currentStage === 'initial' ? 1 : currentStage === 'finalist' ? 2 : 3;
  if(round.status!==expectedStatus || Number(round.current_stage||0)!==expectedStageNumber) fail('ROUND_STAGE','That stage is not ready to submit.',409);
  if(round.stage_deadline_at && new Date(round.stage_deadline_at).getTime() < Date.now()) fail('STAGE_EXPIRED','That stage has expired.',409);

  const requiredIds=stageItemIds(round,currentStage);
  if(!requiredIds.length) fail('ROUND_STAGE','There are no choices to submit for this stage.',409);
  const voteRows=await sql.query(
    'select item_id from family_votes where round_id=$1 and member_id=$2 and stage=$3',
    [roundId,me.member_id,currentStage]
  );
  const voted=new Set(voteRows.map(row=>String(row.item_id)));
  if(!requiredIds.every(id=>voted.has(String(id)))) fail('ROUND_STAGE','Finish every choice before submitting.',409);

  await sql.query('update family_round_members set ' + col + '=now(),last_seen_at=now() where round_id=$1 and member_id=$2', [roundId, me.member_id]);
  let nextRound=(await sql.query('select * from family_rounds where round_id=$1 and family_id=$2',[roundId,me.family_id]))[0];
  if(nextRound){
    nextRound=await advanceInitialStageIfReady(sql, nextRound);
    nextRound=await ensureFinalistsStage(sql, nextRound);
    nextRound=await finalizeFinalStage(sql, nextRound);
    nextRound=await finalizeTiebreak(sql,nextRound);
  }
  return {ok:true,roundId,stage:currentStage,round:publicRound(nextRound)};
}
async function leaveRound(sessionToken,payload={}) {
  const sql=db();
  const me=await auth(sql,sessionToken);
  const roundId=itemId(payload && payload.roundId);
  const family=(await sql.query('select * from family_rooms where family_id=$1',[me.family_id]))[0];
  if(!family?.active_round_id || String(family.active_round_id)!==String(roundId)){
    return {ok:true,removed:false,family:publicFamily(family),round:null};
  }
  const participant=(await sql.query(
    'select included from family_round_members where round_id=$1 and member_id=$2 limit 1',
    [roundId,me.member_id]
  ))[0];
  if(!participant?.included){
    const round=(await sql.query('select * from family_rounds where round_id=$1 and family_id=$2',[roundId,me.family_id]))[0]||null;
    return {ok:true,removed:false,family:publicFamily(family),round:publicRound(round)};
  }

  await sql.query(
    'update family_round_members set included=false,last_seen_at=now() where round_id=$1 and member_id=$2 and included=true',
    [roundId,me.member_id]
  );

  let round=(await sql.query('select * from family_rounds where round_id=$1 and family_id=$2',[roundId,me.family_id]))[0]||null;
  if(round && !['complete','ended'].includes(round.status)){
    const remaining=(await sql.query(
      'select count(*)::integer as count from family_round_members where round_id=$1 and included=true',
      [roundId]
    ))[0];
    if(Number(remaining?.count||0)<2){
      round=(await sql.query(
        "update family_rounds set status='ended',updated_at=now(),completed_at=now() where round_id=$1 and status not in ('complete','ended') returning *",
        [roundId]
      ))[0]||round;
      await sql.query(
        'update family_rooms set active_round_id=null,updated_at=now(),last_activity_at=now() where family_id=$1 and active_round_id=$2',
        [me.family_id,roundId]
      );
    }else{
      round=await advanceInitialStageIfReady(sql,round);
      round=await ensureFinalistsStage(sql,round);
      round=await finalizeFinalStage(sql,round);
      round=await finalizeTiebreak(sql,round);
    }
  }

  const nextFamily=(await sql.query('select * from family_rooms where family_id=$1',[me.family_id]))[0]||family;
  return {ok:true,removed:true,family:publicFamily(nextFamily),round:publicRound(round)};
}
async function rotateCode(sessionToken) {
  const sql = await readyDb();
  const me = await auth(sql, sessionToken);
  const family = (await sql.query('select * from family_rooms where family_id=$1', [me.family_id]))[0];
  if (!family || family.host_member_id !== me.member_id) fail('HOST_REQUIRED', 'Only the host can regenerate the Family code.', 403);

  for (let attempt=0; attempt<5; attempt++) {
    const newCode=code();
    try {
      const next=(await sql.query('update family_rooms set join_code=$1,join_code_rotated_at=now(),updated_at=now(),last_activity_at=now() where family_id=$2 returning *',[newCode,family.family_id]))[0];
      await event(sql,family.family_id,null,me.member_id,'join_code_rotated',{});
      return {joinCode:prettyCode(next.join_code)};
    } catch (err) {
      if (String(err && err.message || '').toLowerCase().includes('duplicate key')) continue;
      throw err;
    }
  }
  fail('CODE_UNAVAILABLE','Could not regenerate the Family code.',503);
}
async function endRound(sessionToken) {
  const sql = await readyDb();
  const me = await auth(sql, sessionToken);
  const family = (await sql.query('select * from family_rooms where family_id=$1', [me.family_id]))[0];
  if (!family || family.host_member_id !== me.member_id) fail('HOST_REQUIRED', 'Only the host can end the dinner decision.', 403);
  if (!family.active_round_id) return {ok:true};
  const round=(await sql.query('select * from family_rounds where round_id=$1',[family.active_round_id]))[0];
  if (!round) return {ok:true};
  const updated=(await sql.query("update family_rounds set status='ended',updated_at=now(),completed_at=now() where round_id=$1 and status not in ('complete','ended') returning *",[round.round_id]))[0] || round;
  await sql.query('update family_rooms set active_round_id=null,updated_at=now(),last_activity_at=now() where family_id=$1',[family.family_id]);
  await event(sql,family.family_id,round.round_id,me.member_id,'round_ended',{});
  return {ok:true,round:publicRound(updated)};
}
async function transferHost(sessionToken, targetMemberId) {
  const sql=db();
  const me=await auth(sql,sessionToken);
  const family=(await sql.query('select * from family_rooms where family_id=$1',[me.family_id]))[0];
  if (!family || family.host_member_id !== me.member_id) fail('HOST_REQUIRED','Only the current host can transfer hosting.',403);
  const target=(await sql.query('select * from family_members where member_id=$1 and family_id=$2 and active=true',[targetMemberId,family.family_id]))[0];
  if (!target) fail('MEMBER_NOT_FOUND','That family member could not be found.',404);
  await sql.query("update family_members set role='member' where family_id=$1 and member_id=$2",[family.family_id,me.member_id]);
  await sql.query("update family_members set role='host' where family_id=$1 and member_id=$2",[family.family_id,target.member_id]);
  await sql.query('update family_rooms set host_member_id=$1,updated_at=now(),last_activity_at=now() where family_id=$2',[target.member_id,family.family_id]);
  await event(sql,family.family_id,family.active_round_id,me.member_id,'host_transferred',{toMemberId:target.member_id});
  return {ok:true,hostMemberId:target.member_id};
}
module.exports = {createFamily,joinFamily,getFamilyState,createRound,startRound,submitVote,markStageSubmitted,rotateCode,endRound,transferHost,leaveFamily,leaveRound};
