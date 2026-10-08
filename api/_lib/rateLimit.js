'use strict';

const crypto=require('node:crypto');
const net=require('node:net');
const {neon}=require('@neondatabase/serverless');

const DATABASE_URL=String(process.env.RATE_LIMIT_DATABASE_URL||process.env.FAMILY_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.GOOGLE_BUDGET_DATABASE_URL||'').trim();
const TABLE='dinliminate_api_rate_limit_v1';
const KEY_SALT=String(process.env.RATE_LIMIT_KEY_SALT||process.env.VERCEL_PROJECT_ID||'dinliminate-rate-v1');
let dbPromise=null;

async function db(){
  if(!DATABASE_URL)return null;
  if(!dbPromise){
    dbPromise=(async()=>{
      const sql=neon(DATABASE_URL);
      await sql.query('CREATE TABLE IF NOT EXISTS '+TABLE+' (bucket_key text PRIMARY KEY,window_started_at timestamptz NOT NULL,window_count integer NOT NULL DEFAULT 0,day_key date NOT NULL,day_count integer NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now())');
      return sql;
    })();
  }
  return dbPromise;
}
function header(req,name){
  const headers=req?.headers||{};
  if(typeof headers.get==='function')return String(headers.get(name)||'').trim();
  const key=String(name).toLowerCase();
  return String(headers[key]??headers[name]??'').trim();
}
function clientIp(req){
  const trusted=header(req,'x-vercel-forwarded-for');
  const candidate=trusted.split(',')[0].trim();
  if(net.isIP(candidate))return candidate;
  const socket=String(req?.socket?.remoteAddress||'').trim();
  return net.isIP(socket)?socket:'unknown';
}
function keyFor(scope,ip){return String(scope||'default')+':'+crypto.createHash('sha256').update(KEY_SALT+'|'+String(ip||'unknown')).digest('hex');}
async function rateLimit(req,{scope='default',perMinute=10,dailyCap=100}={}){
  const minuteLimit=Math.max(1,Number.parseInt(String(perMinute),10)||10);
  const dayLimit=Math.max(minuteLimit,Number.parseInt(String(dailyCap),10)||100);
  const sql=await db().catch(()=>null);
  if(!sql)return {allowed:false,configured:false,reason:'database-unavailable',retryAfterSeconds:60};
  const bucket=keyFor(scope,clientIp(req));
  const rows=await sql.query(
    'INSERT INTO '+TABLE+' (bucket_key,window_started_at,window_count,day_key,day_count,updated_at) VALUES ($1,date_trunc(\'minute\',now()),1,current_date,1,now()) '+
    'ON CONFLICT (bucket_key) DO UPDATE SET '+
    'window_started_at=CASE WHEN window_started_at <= now()-($2 * interval \'1 second\') THEN date_trunc(\'minute\',now()) ELSE window_started_at END,'+
    'window_count=CASE WHEN window_started_at <= now()-($2 * interval \'1 second\') THEN 1 ELSE window_count+1 END,'+
    'day_key=CASE WHEN day_key<>current_date THEN current_date ELSE day_key END,'+
    'day_count=CASE WHEN day_key<>current_date THEN 1 ELSE day_count+1 END,'+
    'updated_at=now() '+
    'WHERE (day_key<>current_date OR day_count<$3) AND (window_started_at <= now()-($2 * interval \'1 second\') OR window_count<$4) '+
    'RETURNING window_count,day_count',
    [bucket,60,dayLimit,minuteLimit]
  );
  if(rows.length)return {allowed:true,configured:true,windowCount:Number(rows[0].window_count)||0,dayCount:Number(rows[0].day_count)||0};
  const current=await sql.query('SELECT window_count,day_count,day_key FROM '+TABLE+' WHERE bucket_key=$1',[bucket]);
  const row=current[0]||{};
  const today=new Date().toISOString().slice(0,10);
  const dailyBlocked=String(row.day_key||'')===today&&Number(row.day_count||0)>=dayLimit;
  return {allowed:false,configured:true,reason:dailyBlocked?'daily-cap':'rate-limit',retryAfterSeconds:dailyBlocked?86400:60};
}
module.exports={rateLimit,clientIp,keyFor,TABLE};
