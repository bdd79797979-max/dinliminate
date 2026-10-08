'use strict';

const dns=require('node:dns').promises;
const net=require('node:net');

const DEFAULT_TIMEOUT_MS=7000;
const DEFAULT_MAX_BYTES=2*1024*1024;
const DEFAULT_MAX_REDIRECTS=4;
const DNS_TIMEOUT_MS=2500;

function ipv4Int(value){
  const parts=String(value).split('.').map(Number);
  if(parts.length!==4||parts.some(x=>!Number.isInteger(x)||x<0||x>255))return null;
  return (((parts[0]*256+parts[1])*256+parts[2])*256+parts[3])>>>0;
}
function ipv4In(ip,start,end){
  const n=ipv4Int(ip),a=ipv4Int(start),b=ipv4Int(end);
  return n!=null&&a!=null&&b!=null&&n>=a&&n<=b;
}
function ipv6Int(value){
  let raw=String(value||'').toLowerCase().split('%')[0];
  if(!net.isIPv6(raw))return null;
  if(raw.includes('.')){
    const idx=raw.lastIndexOf(':');
    const tail=raw.slice(idx+1),n=ipv4Int(tail);
    if(n==null)return null;
    raw=raw.slice(0,idx)+':'+((n>>>16)&0xffff).toString(16)+':'+(n&0xffff).toString(16);
  }
  const halves=raw.split('::');
  if(halves.length>2)return null;
  const left=halves[0]?halves[0].split(':').filter(Boolean):[];
  const right=halves.length===2?(halves[1]?halves[1].split(':').filter(Boolean):[]):[];
  const missing=8-left.length-right.length;
  if(missing<0||(halves.length===1&&missing!==0))return null;
  const groups=[...left,...Array(missing).fill('0'),...right];
  if(groups.length!==8||groups.some(g=>!/^[0-9a-f]{1,4}$/.test(g)))return null;
  return groups.reduce((out,g)=>(out<<16n)+BigInt(parseInt(g,16)),0n);
}
function isForbiddenIp(ip){
  const raw=String(ip||'').trim().toLowerCase();
  if(net.isIPv4(raw)){
    return ipv4In(raw,'0.0.0.0','0.255.255.255')||ipv4In(raw,'10.0.0.0','10.255.255.255')||ipv4In(raw,'100.64.0.0','100.127.255.255')||ipv4In(raw,'127.0.0.0','127.255.255.255')||ipv4In(raw,'169.254.0.0','169.254.255.255')||ipv4In(raw,'172.16.0.0','172.31.255.255')||ipv4In(raw,'192.0.0.0','192.0.0.255')||ipv4In(raw,'192.168.0.0','192.168.255.255')||ipv4In(raw,'198.18.0.0','198.19.255.255');
  }
  if(!net.isIPv6(raw))return true;
  const n=ipv6Int(raw);if(n==null)return true;
  const top8=Number(n>>120n),top7=Number(n>>121n),top10=Number(n>>118n);
  const mapped=Number((n>>32n)&0xffffn)===0xffff;
  if(mapped){
    const v4=Number(n&0xffffffffn);
    const value=[v4>>>24,(v4>>>16)&255,(v4>>>8)&255,v4&255].join('.');
    return isForbiddenIp(value);
  }
  return n===0n||n===1n||top7===0x7e||top10===0x3fa||top8===0xff;
}
function withTimeout(promise,ms){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('DNS lookup timed out.')),ms))]);}
async function assertPublicHost(host){
  const hostname=String(host||'').toLowerCase();
  if(!hostname||hostname==='localhost')throw new Error('Host is not allowed.');
  if(net.isIP(hostname)){if(isForbiddenIp(hostname))throw new Error('Private or local IP is not allowed.');return;}
  const answers=await withTimeout(dns.lookup(hostname,{all:true,verbatim:true}),DNS_TIMEOUT_MS);
  if(!Array.isArray(answers)||!answers.length)throw new Error('Host did not resolve.');
  for(const answer of answers)if(isForbiddenIp(answer.address))throw new Error('Host resolves to a private or local IP.');
}
function assertHttpsUrl(raw){
  const url=new URL(String(raw||'').trim());
  if(url.protocol!=='https:'||!url.hostname)throw new Error('Only HTTPS URLs with a host are allowed.');
  return url.href;
}
async function safeFetch(input,options={},policy={}){
  let current=assertHttpsUrl(input);
  const maxRedirects=Math.max(0,Number.parseInt(String(policy.maxRedirects??DEFAULT_MAX_REDIRECTS),10)||DEFAULT_MAX_REDIRECTS);
  const timeoutMs=Math.max(500,Number.parseInt(String(policy.timeoutMs??DEFAULT_TIMEOUT_MS),10)||DEFAULT_TIMEOUT_MS);
  const maxBytes=Math.max(1024,Number.parseInt(String(policy.maxBytes??DEFAULT_MAX_BYTES),10)||DEFAULT_MAX_BYTES);
  const validateUrl=typeof policy.validateUrl==='function'?policy.validateUrl:null;
  if(validateUrl&&!validateUrl(current))throw new Error('URL policy rejected the target.');
  const timerController=new AbortController();
  const timer=setTimeout(()=>timerController.abort(),timeoutMs);
  const signal=options.signal&&typeof AbortSignal?.any==='function'?AbortSignal.any([timerController.signal,options.signal]):timerController.signal;
  const requestOptions={...options,redirect:'manual',signal};delete requestOptions.signal;
  requestOptions.signal=signal;
  try{
    for(let hop=0;hop<=maxRedirects;hop++){
      if(validateUrl&&!validateUrl(current))throw new Error('URL policy rejected the target.');
      await assertPublicHost(new URL(current).hostname);
      const response=await fetch(current,requestOptions);
      const length=Number(response.headers.get('content-length')||0);
      if(Number.isFinite(length)&&length>maxBytes){await response.body?.cancel?.().catch?.(()=>{});throw new Error('Response is too large.');}
      if(!(response.status>=300&&response.status<400))return {response,url:current,maxBytes};
      const location=response.headers.get('location');
      await response.body?.cancel?.().catch?.(()=>{});
      if(!location)throw new Error('Redirect location is missing.');
      if(hop===maxRedirects)throw new Error('Too many redirects.');
      current=assertHttpsUrl(new URL(location,current).href);
    }
  }finally{clearTimeout(timer);}
}
async function readResponseBody(response,maxBytes=DEFAULT_MAX_BYTES,timeoutMs=DEFAULT_TIMEOUT_MS){
  const limit=Math.max(1024,Number.parseInt(String(maxBytes),10)||DEFAULT_MAX_BYTES);
  const bodyTimeout=Math.max(500,Number.parseInt(String(timeoutMs),10)||DEFAULT_TIMEOUT_MS);
  const length=Number(response?.headers?.get?.('content-length')||0);
  if(Number.isFinite(length)&&length>limit)throw new Error('Response is too large.');
  if(!response?.body){
    const data=Buffer.from(await response.arrayBuffer());
    if(data.length>limit)throw new Error('Response is too large.');
    return data;
  }
  const reader=response.body.getReader(),chunks=[];
  let total=0,timedOut=false;
  const timer=setTimeout(()=>{
    timedOut=true;
    reader.cancel().catch(()=>{});
  },bodyTimeout);
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      const chunk=Buffer.from(value);total+=chunk.length;
      if(total>limit){await reader.cancel().catch(()=>{});throw new Error('Response is too large.');}
      chunks.push(chunk);
    }
    if(timedOut)throw new Error('Response body timed out.');
  }finally{
    clearTimeout(timer);
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks,total);
}
async function safeFetchBuffer(input,options={},policy={}){
  const result=await safeFetch(input,options,policy);
  if(!result.response.ok)throw Object.assign(new Error('Upstream request failed ('+result.response.status+').'),{status:result.response.status});
  return {...result,bytes:await readResponseBody(result.response,result.maxBytes)};
}
async function safeFetchText(input,options={},policy={}){
  const result=await safeFetchBuffer(input,options,policy);
  return {...result,text:result.bytes.toString('utf8')};
}
module.exports={DEFAULT_TIMEOUT_MS,DEFAULT_MAX_BYTES,DEFAULT_MAX_REDIRECTS,assertPublicHost,assertHttpsUrl,isForbiddenIp,safeFetch,readResponseBody,safeFetchBuffer,safeFetchText};
