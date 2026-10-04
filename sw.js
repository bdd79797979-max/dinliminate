const CACHE='dinliminate-shell-v926';
const IMAGE_CACHE='dinliminate-images-v4';
const SHELL=['./','./index.html','./styles.css?v=926','./app.js?v=926','./data/foods.js','./data/restaurant-taxonomy.js','./manifest.webmanifest','./app-release.json','./release-manifest.json','./icon.svg','./icon-512.png','./apple-touch-icon.png','./fallback-food.svg','./fallback-restaurant.svg'];
self.addEventListener('install',event=>{
  event.waitUntil(Promise.all([caches.open(CACHE).then(c=>c.addAll(SHELL)),caches.open(IMAGE_CACHE)]).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!==IMAGE_CACHE&&k!=='dinliminate.restaurant.photos.v2').map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  const imageHosts=['images.pexels.com','images.unsplash.com','commons.wikimedia.org','static.spotapps.co','hips.hearstapps.com','calliesbiscuits.com','vinovoss.com','recipesclare.com','www.ajsbbq.co.nz','southernbite.com','snapcalorie-webflow-website.s3.us-east-2.amazonaws.com','butterhearth.com','www.pastapiracy.com','slicelife.imgix.net','cdn.shopify.com','savouryflavor.com','resizer.otstatic.com','www.cooksoups.com','bigbitesedenderry.com','kookycrunch.com','www.goodnes.com','cdn.apartmenttherapy.info','www.southernliving.com','shop.barebells.com','b1880159.assetcdn.net','www.mybakingaddiction.com','a.fsimg.co.nz','ourstate.s3.amazonaws.com','whitneybond.com','thedailymeal.com','crockncle.com','www.africanbites.com','www.foodrepublic.com','shop.camelliabrand.com'];
  if(url.origin!==self.location.origin && !imageHosts.includes(url.hostname))return;
  if(url.origin===self.location.origin && url.pathname==='/api/image'){
    event.respondWith(caches.open(IMAGE_CACHE).then(cache=>cache.match(req).then(cached=>cached||fetch(req).then(res=>{
      if(res.ok){const copy=res.clone();cache.put(req,copy).catch(()=>{});}
      return res;
    }).catch(()=>cached||Response.error()))));
    return;
  }
  if(url.origin===self.location.origin && url.pathname.startsWith('/api/'))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).catch(()=>caches.match('./index.html')));
    return;
  }
  const isImageRequest=req.destination==='image'||url.pathname.match(/\.(?:avif|webp|jpe?g|png|gif)$/i);
  const targetCache=isImageRequest?IMAGE_CACHE:CACHE;
  event.respondWith(caches.open(targetCache).then(cache=>cache.match(req).then(cached=>fetch(req).then(res=>{
    if(res.ok || res.type==='opaque'){
      const copy=res.clone();
      cache.put(req,copy).catch(()=>{});
    }
    return res;
  }).catch(()=>cached||Response.error()))));
});
