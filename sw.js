importScripts('./api/_lib/imageHosts.js?v=1339');
// CP1306: shell/cache version bump for Meal deck selection.
const CACHE='dinliminate-shell-v1339';
const IMAGE_CACHE='dinliminate-images-v5';

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
    }catch(error){console.error('Dinliminate error',error)}
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
  }catch(error){console.error('Dinliminate error',error)}
}

async function touchCachedImage(req){
  try{
    await touchImageMeta(req.url);
    await enforceImageCacheBudget();
  }catch(error){console.error('Dinliminate error',error)}
}

const SHELL=["./api/_lib/imageHosts.js?v=1339","./","./index.html","./boot.js?v=1339","./viewport.js?v=1339","./src/api/client.js","./src/data/restaurant-taxonomy.js","./src/features/family/index.js","./src/features/history/index.js","./src/features/meals/index.js","./src/features/restaurants/index.js","./src/features/settings/index.js","./src/features/swipe/index.js","./src/features/swipe/swipeMachine.js","./src/features/tutorial/index.js","./src/features/winner/index.js","./src/main.js","./src/state/migrations.js","./src/state/storage.js","./src/state/store.js","./src/ui/dom.js","./src/ui/esc.js","./src/ui/modal.js","./logo.svg?v=1339","./data/foods.js","./data/foods.js?v=1339","./manifest.webmanifest","./app-release.json","./release-manifest.json","./icon.svg?v=1339","./app-icon.svg?v=1339","./apple-touch-icon.png?v=1339","./fallback-food.svg","./fallback-restaurant.svg","./tokens.css?v=1339","./base.css?v=1339","./chrome.css?v=1339","./modal.css?v=1339","./swipe.css?v=1339","./home.css?v=1339","./meals.css?v=1339","./restaurants.css?v=1339","./winner.css?v=1339","./history.css?v=1339","./family.css?v=1339","./settings.css?v=1339","./tutorial.css?v=1339","./menu.css?v=1339"];

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

  const imageHosts=new Set(self.DINLIMINATE_IMAGE_HOSTS||[]);

  const isImageRequest=req.destination==='image'||url.pathname.match(/\.(?:avif|webp|jpe?g|png|gif)$/i);
  if(url.origin!==self.location.origin&&!isImageRequest&&!imageHosts.includes(url.hostname))return;

  if(url.origin===self.location.origin&&url.pathname==='/api/image'){
    const isMealImage=url.searchParams.get('meal')==='1';
    if(isMealImage){
      event.respondWith(fetch(req).catch(()=>Response.error()));
      return;
    }
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
