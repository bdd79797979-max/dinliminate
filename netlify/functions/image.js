const ALLOWED_HOSTS=new Set([
  'images.pexels.com','images.unsplash.com','commons.wikimedia.org','static.spotapps.co','www.goodnes.com','hips.hearstapps.com','calliesbiscuits.com','vinovoss.com','southernbite.com','snapcalorie-webflow-website.s3.us-east-2.amazonaws.com','butterhearth.com','slicelife.imgix.net','cdn.shopify.com','savouryflavor.com','resizer.otstatic.com','kookycrunch.com'
]);
const MAX_BYTES=8*1024*1024;
exports.handler=async function(event){
  try{
    const raw=String(event.queryStringParameters?.url||'').trim();
    if(!raw)return {statusCode:400,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Missing image URL'})};
    const u=new URL(raw);
    if(u.protocol!=='https:'||!ALLOWED_HOSTS.has(u.hostname))return {statusCode:403,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Image host not allowed'})};
    const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),8000);
    let r; try{ r=await fetch(u.href,{signal:ctl.signal,headers:{Accept:'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'}}); } finally{ clearTimeout(timer); }
    if(!r.ok)return {statusCode:502,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Upstream image unavailable'})};
    const type=(r.headers.get('content-type')||'').split(';')[0].toLowerCase();
    if(!type.startsWith('image/'))return {statusCode:415,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Upstream content is not an image'})};
    const length=Number(r.headers.get('content-length')||0);
    if(Number.isFinite(length)&&length>MAX_BYTES)return {statusCode:413,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Image too large'})};
    const data=Buffer.from(await r.arrayBuffer());
    if(data.length>MAX_BYTES)return {statusCode:413,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Image too large'})};
    return {statusCode:200,isBase64Encoded:true,headers:{'Content-Type':type,'Cache-Control':'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'},body:data.toString('base64')};
  }catch{ return {statusCode:502,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Could not load image'})}; }
};
