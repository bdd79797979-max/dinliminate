const ALLOWED_HOSTS=new Set([
  'images.pexels.com',
  'images.unsplash.com',
  'commons.wikimedia.org',
  'upload.wikimedia.org',
  'static.spotapps.co',
  'www.goodnes.com',
  'hips.hearstapps.com',
  'calliesbiscuits.com',
  'vinovoss.com',
  'southernbite.com',
  'snapcalorie-webflow-website.s3.us-east-2.amazonaws.com',
  'butterhearth.com',
  'slicelife.imgix.net',
  'cdn.shopify.com',
  'savouryflavor.com',
  'resizer.otstatic.com',
  'kookycrunch.com',
  'cdn.apartmenttherapy.info','www.southernliving.com','shop.barebells.com','b1880159.assetcdn.net','www.mybakingaddiction.com','a.fsimg.co.nz','ourstate.s3.amazonaws.com','whitneybond.com','thedailymeal.com','crockncle.com','www.africanbites.com','www.foodrepublic.com','shop.camelliabrand.com','parade.com','sweetasirem.com','www.sugardale.com','myhomemaderecipe.com','www.finedininglovers.com','img.staticmb.com'
]);
const MAX_BYTES=8*1024*1024;
const MAX_URL_LENGTH=2048;
const imageRateBuckets=new Map();
function imageClientKey(req){
  const headers=req?.headers||{};
  const forwarded=String(headers['x-forwarded-for']||'').split(',')[0].trim();
  return forwarded||String(headers['x-real-ip']||'unknown');
}
function imageRateLimited(req){
  const now=Date.now(),key=imageClientKey(req);
  for(const [k,v] of imageRateBuckets){if(now-v.t>60000)imageRateBuckets.delete(k);}
  const row=imageRateBuckets.get(key);
  if(!row){imageRateBuckets.set(key,{t:now,count:1});return false;}
  row.count+=1;return row.count>120;
}
module.exports=async function handler(req,res){
  if(String(req?.method||'GET').toUpperCase()!=='GET')return res.status(405).setHeader('Cache-Control','no-store').json({ok:false,error:'GET required'});
  if(imageRateLimited(req))return res.status(429).setHeader('Cache-Control','no-store').json({ok:false,error:'Too many image requests'});
  try{
    const raw=String(req.query?.url||'').trim();
    if(!raw)return res.status(400).json({ok:false,error:'Missing image URL'});
    if(raw.length>MAX_URL_LENGTH)return res.status(414).json({ok:false,error:'Image URL is too long'});
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password||!ALLOWED_HOSTS.has(u.hostname))return res.status(403).json({ok:false,error:'Image host not allowed'});
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),8000);
    let r;
    try{
      r=await fetch(u.href,{signal:ctl.signal,redirect:'error',headers:{Accept:'image/webp,image/jpeg,image/png,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.5'}});
    }finally{clearTimeout(timer);}
    if(!r.ok)return res.status(502).json({ok:false,error:'Upstream image unavailable'});
    const type=(r.headers.get('content-type')||'').split(';')[0].toLowerCase();
    if(!type.startsWith('image/'))return res.status(415).json({ok:false,error:'Upstream content is not an image'});
    if(type==='image/svg+xml'||type==='image/svg')return res.status(415).json({ok:false,error:'SVG images are not supported'});
    const length=Number(r.headers.get('content-length')||0);
    if(Number.isFinite(length)&&length>MAX_BYTES)return res.status(413).json({ok:false,error:'Image too large'});
    const data=Buffer.from(await r.arrayBuffer());
    if(data.length>MAX_BYTES)return res.status(413).json({ok:false,error:'Image too large'});
    res.setHeader('Content-Type',type);
    res.setHeader('Cache-Control','public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
    res.status(200).end(data);
  }catch{
    res.status(502).json({ok:false,error:'Could not load image'});
  }
}
