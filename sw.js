const CACHE='dinliminate-shell-v1079';
const IMAGE_CACHE='dinliminate-images-v4';

// CP1077 — Google usage tracker + release shell cache bump
// CP1070 — Shell cache bump for Restaurant refine controls and tutorial home navigation.
// CP1008 — Managed image cache:
// keep a durable working set for meal + restaurant photos without allowing
// Cache Storage to grow indefinitely. The budget is size-based, not count-based.
const IMAGE_META_DB='dinliminate-image-cache-v1';
const IMAGE_META_STORE='entries';
const IMAGE_CACHE_LIMIT_BYTES=75*1024*1024;
const IMAGE_CACHE_TARGET_BYTES=60*1024*1024;
const IMAGE_SIZE_FALLBACK_BYTES=1536*1024;
let imageCacheMaintenance=Promise.resolve();

function queueImageCacheMaintenance(task){
  imageCacheMaintenance=imageCacheMaintenance.then(task,task);
  return imageCacheMaintenance;
}

function openImageMetaDb(){
  return new Promise((resolve,reject)=>{
    if(!self.indexedDB){reject(new Error('IndexedDB unavailable'));return;}
    const request=indexedDB.open(IMAGE_META_DB,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(IMAGE_META_STORE)){
        const store=db.createObjectStore(IMAGE_META_STORE,{keyPath:'url'});
        store.createIndex('lastUsed','lastUsed');
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('IndexedDB open failed'));
  });
}

async function readAllImageMeta(){
  const db=await openImageMetaDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(IMAGE_META_STORE,'readonly');
    const request=tx.objectStore(IMAGE_META_STORE).getAll();
    request.onsuccess=()=>resolve(Array.isArray(request.result)?request.result:[]);
    request.onerror=()=>reject(request.error||new Error('Image metadata read failed'));
    tx.onabort=()=>reject(tx.error||new Error('Image metadata transaction aborted'));
  });
}

async function touchImageMeta(url,sizeFallback=IMAGE_SIZE_FALLBACK_BYTES){
  if(!url)return;
  const db=await openImageMetaDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(IMAGE_META_STORE,'readwrite');
    const store=tx.objectStore(IMAGE_META_STORE);
    const request=store.get(url);
    request.onsuccess=()=>{
      const current=request.result;
      const size=Number(current?.size)>0?Number(current.size):sizeFallback;
      store.put({url,size,lastUsed:Date.now()});
    };
    request.onerror=()=>reject(request.error||new Error('Image metadata lookup failed'));
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error('Image metadata write failed'));
    tx.onabort=()=>reject(tx.error||new Error('Image metadata transaction aborted'));
  });
}

async function writeImageMetaBulk(upserts=[],deletes=[]){
  const db=await openImageMetaDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(IMAGE_META_STORE,'readwrite');
    const store=tx.objectStore(IMAGE_META_STORE);
    for(const entry of upserts){
      if(entry?.url)store.put({
        url:String(entry.url),
        size:Math.max(1,Number(entry.size)||IMAGE_SIZE_FALLBACK_BYTES),
        lastUsed:Number(entry.lastUsed)||0
      });
    }
    for(const url of deletes){
      if(url)store.delete(url);
    }
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error('Image metadata bulk write failed'));
    tx.onabort=()=>reject(tx.error||new Error('Image metadata bulk transaction aborted'));
  });
}

function estimateImageBytes(response){
  const length=Number(response?.headers?.get?.('content-length')||0);
  return Number.isFinite(length)&&length>0?length:IMAGE_SIZE_FALLBACK_BYTES;
}

async function enforceImageCacheBudget(){
  return queueImageCacheMaintenance(async()=>{
    try{
      const cache=await caches.open(IMAGE_CACHE);
      const keys=await cache.keys();
      const present=new Set(keys.map(request=>request.url));
      const allMeta=await readAllImageMeta();
      const byUrl=new Map();
      for(const entry of allMeta){
        if(entry?.url)byUrl.set(String(entry.url),entry);
      }

      const missing=keys.filter(request=>!byUrl.has(request.url)).map(request=>({
        url:request.url,
        size:IMAGE_SIZE_FALLBACK_BYTES,
        lastUsed:0
      }));

      const stale=allMeta.filter(entry=>entry?.url&&!present.has(String(entry.url))).map(entry=>String(entry.url));

      if(missing.length||stale.length){
        await writeImageMetaBulk(missing,stale);
        for(const entry of missing)byUrl.set(entry.url,entry);
        for(const url of stale)byUrl.delete(url);
      }

      let total=0;
      const entries=[];
      for(const request of keys){
        const meta=byUrl.get(request.url)||{
          url:request.url,
          size:IMAGE_SIZE_FALLBACK_BYTES,
          lastUsed:0
        };
        const size=Math.max(1,Number(meta.size)||IMAGE_SIZE_FALLBACK_BYTES);
        total+=size;
        entries.push({url:request.url,size,lastUsed:Number(meta.lastUsed)||0});
      }

      if(total<=IMAGE_CACHE_LIMIT_BYTES)return;

      entries.sort((a,b)=>{
        if(a.lastUsed!==b.lastUsed)return a.lastUsed-b.lastUsed;
        return b.size-a.size;
      });

      const deleted=[];
      for(const entry of entries){
        if(total<=IMAGE_CACHE_TARGET_BYTES)break;
        if(await cache.delete(entry.url)){
          total-=entry.size;
          deleted.push(entry.url);
        }
      }
      if(deleted.length)await writeImageMetaBulk([],deleted);
    }catch{}
  });
}

async function recordCachedImage(cache,req,res){
  try{
    const size=estimateImageBytes(res);
    // A single oversized asset should not consume the entire working set.
    if(size>IMAGE_CACHE_LIMIT_BYTES)return;
    await cache.put(req,res.clone());
    await touchImageMeta(req.url,size);
    await enforceImageCacheBudget();
  }catch{}
}

async function touchCachedImage(req){
  try{
    await touchImageMeta(req.url);
    await enforceImageCacheBudget();
  }catch{}
}

const SHELL=['./','./index.html','./styles.css?v=1076','./app.js?v=1079','./data/foods.js?v=1070','./data/restaurant-taxonomy.js','./manifest.webmanifest','./app-release.json','./release-manifest.json','./icon.svg','./icon-512.png','./apple-touch-icon.png','./fallback-food.svg','./fallback-restaurant.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(Promise.all([
    caches.open(CACHE).then(c=>c.addAll(SHELL)),
    caches.open(IMAGE_CACHE)
  ]).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.filter(k=>k!==CACHE&&k!==IMAGE_CACHE&&k!=='dinliminate.restaurant.photos.v6').map(k=>caches.delete(k))
      ))
      .then(()=>enforceImageCacheBudget())
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);

  const imageHosts=['images.pexels.com','images.unsplash.com','commons.wikimedia.org','static.spotapps.co','hips.hearstapps.com','calliesbiscuits.com','vinovoss.com','recipesclare.com','www.ajsbbq.co.nz','southernbite.com','snapcalorie-webflow-website.s3.us-east-2.amazonaws.com','butterhearth.com','www.pastapiracy.com','slicelife.imgix.net','cdn.shopify.com','savouryflavor.com','resizer.otstatic.com','www.cooksoups.com','bigbitesedenderry.com','kookycrunch.com','www.goodnes.com','cdn.apartmenttherapy.info','www.southernliving.com','shop.barebells.com','b1880159.assetcdn.net','www.mybakingaddiction.com','a.fsimg.co.nz','ourstate.s3.amazonaws.com','whitneybond.com','thedailymeal.com','crockncle.com','www.foodrepublic.com','shop.camelliabrand.com','parade.com','sweetasirem.com','myhomemaderecipe.com','www.finedininglovers.com','1.bp.blogspot.com'];

  const isImageRequest=req.destination==='image'||url.pathname.match(/\.(?:avif|webp|jpe?g|png|gif)$/i);
  if(url.origin!==self.location.origin&&!isImageRequest&&!imageHosts.includes(url.hostname))return;

  if(url.origin===self.location.origin&&url.pathname==='/api/image'){
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache=>
        cache.match(req).then(cached=>{
          if(cached){
            event.waitUntil(touchCachedImage(req));
            return cached;
          }
          return fetch(req).then(res=>{
            if(res.ok)event.waitUntil(recordCachedImage(cache,req,res));
            return res;
          }).catch(()=>cached||Response.error());
        })
      )
    );
    return;
  }

  if(url.origin===self.location.origin&&url.pathname.startsWith('/api/'))return;

  if(req.mode==='navigate'){
    event.respondWith(fetch(req).catch(()=>caches.match('./index.html')));
    return;
  }

  const targetCache=isImageRequest?IMAGE_CACHE:CACHE;

  event.respondWith(
    caches.open(targetCache).then(cache=>
      cache.match(req).then(cached=>
        fetch(req).then(res=>{
          if((res.ok||res.type==='opaque')&&isImageRequest){
            event.waitUntil(recordCachedImage(cache,req,res));
          }
          return res;
        }).catch(()=>cached||Response.error()).then(res=>{
          if(cached&&isImageRequest)event.waitUntil(touchCachedImage(req));
          return res;
        })
      )
    )
  );
});
