'use strict';

const {json}=require('./_lib/http');
const {safeFetchBuffer}=require('./_lib/ssrf');
const {isAllowedImageHost}=require('./_lib/imageHosts');

const MAX_BYTES=8*1024*1024;
function allowedImageUrl(raw){
  try{
    const u=new URL(String(raw||'').trim());
    return u.protocol==='https:'&&isAllowedImageHost(u.hostname);
  }catch{return false}
}
module.exports=async function handler(req,res){
  try{
    const raw=String(req.query?.url||'').trim();
    if(!raw)return json(res,400,{ok:false,error:'Missing image URL'});
    if(!allowedImageUrl(raw))return json(res,403,{ok:false,error:'Image host not allowed'});
    const result=await safeFetchBuffer(raw,{
      headers:{Accept:'image/webp,image/jpeg,image/png,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.5'}
    },{
      timeoutMs:8000,maxBytes:MAX_BYTES,maxRedirects:3,validateUrl:allowedImageUrl
    });
    const r=result.response;
    const type=(r.headers.get('content-type')||'').split(';')[0].toLowerCase();
    if(!type.startsWith('image/'))return json(res,415,{ok:false,error:'Upstream content is not an image'});
    const isMealImage=String(req.query?.meal||'')==='1';
    res.setHeader?.('Content-Type',type);
    res.setHeader?.('Cache-Control',isMealImage?'no-store':'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');
    res.setHeader?.('X-Content-Type-Options','nosniff');
    res.setHeader?.('Cross-Origin-Resource-Policy','same-origin');
    res.setHeader?.('Referrer-Policy','no-referrer');
    res.statusCode=200;
    res.end?.(result.bytes);
  }catch(error){
    const status=Number(error?.status)===413?413:502;
    return json(res,status,{ok:false,error:status===413?'Image too large':'Could not load image'});
  }
};
