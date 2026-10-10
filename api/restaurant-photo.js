'use strict';

const {json}=require('./_lib/http');
const {safeFetch,readResponseBody}=require('./_lib/ssrf');

const {tryGoogleRestaurantPhoto}=require('./google-restaurant-photo');

let sharp=null;
try{sharp=require('sharp');}catch(error){console.error('Dinliminate error',error)}

const restaurantPhotoRateBuckets=new Map();
function restaurantPhotoRateLimited(req,max=18){
 const headers=req?.headers||{},ip=String(headers['x-forwarded-for']||headers['x-real-ip']||'anon').split(',')[0].trim()||'anon';
 const now=Date.now(),old=restaurantPhotoRateBuckets.get(ip);
 if(!old||now-old.at>60000){restaurantPhotoRateBuckets.set(ip,{at:now,count:1});return false;}
 old.count++;return old.count>max;
}
const NO_PHOTO_HOSTS=new Set(['google.com','www.google.com','googleusercontent.com','lh3.googleusercontent.com','bing.com','www.bing.com','tse1.mm.bing.net','tse2.mm.bing.net','tse3.mm.bing.net','tse4.mm.bing.net','unsplash.com','images.unsplash.com','pexels.com','images.pexels.com','shutterstock.com','istockphoto.com','gettyimages.com','depositphotos.com','alamy.com','stock.adobe.com']);
const BLOCKED_IMAGE_HINTS=/\b(?:logo|favicon|sprite|icon|avatar|placeholder|default[-_ ]?image|brandmark|wordmark|google[ -]?play|play[ -]?store|app[ -]?store|download[ -]?app|download|badge|payment|visa|mastercard|amex|social[ -]?media|facebook|instagram|tiktok|youtube|x[ -]?twitter)\b/i;
const VENUE_IMAGE_HINTS=/\b(?:exterior|outside|outdoor|front|entrance|entry|building|storefront|facade|façade|sign|signage|location|drive[- ]?thru|drive through|parking lot|parking|street view|patio|terrace)\b/i;
const FOOD_IMAGE_HINTS=/\b(?:food|dish|meal|burger|pizza|salad|steak|wings|tacos?|sushi|pasta|chicken|fries|dessert|cake|sandwich|plate|entrée|entree|appetizer|breakfast|lunch|dinner|drink|cocktail|coffee|beer|wine)\b/i;
const PHOTO_GRAPHIC_HINTS=/\b(?:menu(?:board|boards|page|item)?|menu[-_ ]?board|food[-_ ]?menu|menu[-_ ]?cover|flyer|promo(?:tion)?|poster|collage|montage|mosaic|screenshot|screen[-_ ]?shot|social[-_ ]?image|sharing[-_ ]?image|banner|coupon|special[-_ ]?graphic|advert(?:isement)?|template|graphic|composite|photo[-_ ]?grid|multi[-_ ]?photo|multi[-_ ]?panel|four[-_ ]?panel|2x2|3x3|contact[-_ ]?sheet|story[-_ ]?grid)\b/i;
const PHOTO_CONTEXT_HINTS=/\b(?:photo|photos|photograph|gallery|dining|interior|exterior|outside|storefront|patio|restaurant|burger|pizza|tacos?|steak|wings|chicken|fries|dessert|sandwich|plate)\b/i;
const LOW_QUALITY_IMAGE_HINTS=/\b(?:thumbnail|thumb|tiny|small|lowres|low[-_ ]?res|preview|sprite|tile)\b/i;
const LOW_TRUST_PUBLIC_PHOTO_HOSTS=new Set(['restaurantguru.com','usarestaurants.info','yellowpages.com','mapquest.com','foursquare.com']);
const MAX_RESTAURANT_IMAGE_DIMENSION=6000;
const MAX_RESTAURANT_IMAGE_PIXELS=12000000;
const PHOTO_SOURCE_TIER={
  'google-places':100,
  'known-restaurant-photo':100,
  'official-fast-path':99,
  'official-venue-page':96,
  'restaurantji-photo':94,
  'exact-public-venue-image':92,
  'known-public-venue-page':90,
  'osm-exact-poi':88,
  'exact-public-venue-page':84
};


function absoluteHttpsUrl(raw,base=''){
  try{
    const u=new URL(String(raw||''),base||undefined);
    if(u.protocol!=='https:')return '';
    const host=u.hostname.toLowerCase();
    if(host==='localhost'||host==='127.0.0.1'||host==='0.0.0.0'||host==='::1')return '';
    if(/^10\./.test(host)||/^192\.168\./.test(host)||/^169\.254\./.test(host)||/^172\.(1[6-9]|2\d|3[0-1])\./.test(host))return '';
    return u.href;
  }catch{return ''}
}

function hostOf(raw){try{return new URL(raw).hostname.toLowerCase()}catch{return ''}}
function isBlockedHost(raw){
  const host=hostOf(raw);
  if(!host)return true;
  for(const blocked of NO_PHOTO_HOSTS)if(host===blocked||host.endsWith('.'+blocked))return true;
  return false;
}

function decodeHtml(raw){
  return String(raw||'')
    .replace(/&quot;/g,'"').replace(/&#34;/g,'"')
    .replace(/&#39;|&#x27;/g,"'")
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}

function publicRedirectUrl(location,current){
  try{
    const next=new URL(String(location||''),String(current||''));
    if(next.protocol!=='https:')return '';
    const host=next.hostname.toLowerCase();
    if(host==='localhost'||host==='127.0.0.1'||host==='0.0.0.0'||host==='::1')return '';
    if(/^10\./.test(host)||/^192\.168\./.test(host)||/^169\.254\./.test(host)||/^172\.(1[6-9]|2\d|3[0-1])\./.test(host))return '';
    return next.href;
  }catch{return ''}
}
async function fetchWithValidatedRedirects(start,options={},maxRedirects=4,maxBytes=10*1024*1024,timeoutMs=7000){
  const current=absoluteHttpsUrl(start);
  if(!current||isBlockedHost(current))return null;
  try{
    return await safeFetch(current,options,{
      maxRedirects,maxBytes,timeoutMs,
      validateUrl:url=>{const safe=absoluteHttpsUrl(url);return !!safe&&!isBlockedHost(safe);}
    });
  }catch{return null}
}
async function fetchText(url,headers={},timeout=7000,maxBytes=2200000){
  const result=await fetchWithValidatedRedirects(url,{headers:{
    'Accept':'text/html,application/xhtml+xml',
    'Accept-Language':'en-US,en;q=0.8',
    'User-Agent':'Mozilla/5.0 (compatible; Dinliminate/1.0; restaurant-photo)',
    ...headers
  }},4,maxBytes,timeout);
  if(!result||!result.response.ok)return '';
  try{return (await readResponseBody(result.response,maxBytes)).toString('utf8');}catch{return ''}
}
function imageDimensions(bytes,type){
  try{
    if(type==='image/webp'&&bytes.length>=30&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){
      const chunk=bytes.toString('ascii',12,16);
      if(chunk==='VP8X'&&bytes.length>=30){
        const width=1+(bytes[24]|(bytes[25]<<8)|(bytes[26]<<16));
        const height=1+(bytes[27]|(bytes[28]<<8)|(bytes[29]<<16));
        return {width,height};
      }
      if(chunk==='VP8 '&&bytes.length>=30){
        const start=bytes.indexOf(Buffer.from([0x9d,0x01,0x2a]),20);
        if(start>=0&&start+7<bytes.length)return {width:bytes.readUInt16LE(start+3)&0x3fff,height:bytes.readUInt16LE(start+5)&0x3fff};
      }
      if(chunk==='VP8L'&&bytes.length>=25){
        const b0=bytes[21],b1=bytes[22],b2=bytes[23],b3=bytes[24];
        const width=1+((b1<<8)|(b0&0xff)|((b2&0x3f)<<16));
        const height=1+((b3<<16)|(bytes[25]<<8)|(bytes[24]>>6));
        if(width>0&&height>0)return {width,height};
      }
    }
    if(type==='image/png'&&bytes.length>=24){
      const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
      return {width:w,height:h};
    }
    if(type==='image/gif'&&bytes.length>=10){
      return {width:bytes.readUInt16LE(6),height:bytes.readUInt16LE(8)};
    }
    if((type==='image/avif'||type==='image/avif-sequence'))return {width:800,height:600};
    if((type==='image/jpeg'||type==='image/jpg')&&bytes.length>4&&bytes[0]===0xff&&bytes[1]===0xd8){
      let i=2;
      while(i+9<bytes.length){
        if(bytes[i]!==0xff){i++;continue;}
        const marker=bytes[i+1];
        i+=2;
        if(marker===0xd8||marker===0xd9||marker===0x01)continue;
        if(i+2>bytes.length)break;
        const len=bytes.readUInt16BE(i);
        if(len<2||i+len>bytes.length)break;
        if((marker>=0xc0&&marker<=0xc3)||(marker>=0xc5&&marker<=0xc7)||(marker>=0xc9&&marker<=0xcb)||(marker>=0xcd&&marker<=0xcf)){
          return {width:bytes.readUInt16BE(i+5),height:bytes.readUInt16BE(i+3)};
        }
        i+=len;
      }
    }
  }catch(error){console.error('Dinliminate error',error)}
  return {width:0,height:0};
}
function mediaQuality(media){
  const width=Number(media?.width)||0,height=Number(media?.height)||0;
  if(!width||!height)return 0;
  const pixels=width*height,ratio=width/height;
  if(width<400||height<250||pixels<180000||ratio<0.48||ratio>2.7)return -100;
  let score=Math.min(18,Math.log10(pixels/180000+1)*8);
  if(ratio>=1.1&&ratio<=2.1)score+=4;
  return score;
}
async function isLikelyPhotoCollage(bytes){
  if(!sharp||!bytes?.length)return false;
  try{
    const sample=await sharp(bytes,{failOn:'error',limitInputPixels:MAX_RESTAURANT_IMAGE_PIXELS})
      .resize({width:96,height:96,fit:'fill'})
      .removeAlpha()
      .grayscale()
      .raw()
      .toBuffer({resolveWithObject:true});
    const data=sample?.data,info=sample?.info;
    if(!data||!info?.width||!info?.height)return false;
    const w=info.width,h=info.height,px=(x,y)=>data[(y*w)+x];
    const lineContrast=(center,isColumn)=>{
      const limit=isColumn?w:h;let total=0,strong=0,count=0;
      for(let i=6;i<limit-6;i++){
        let seam=0,side=0,seamN=0,sideN=0;
        for(let d=-1;d<=1;d++){
          const idx=center+d;
          if(idx<0||idx>=(isColumn?w:h))continue;
          seam+=isColumn?px(idx,i):px(i,idx);seamN++;
        }
        for(const d of [-5,-4,-3,3,4,5]){
          const idx=center+d;
          if(idx<0||idx>=(isColumn?w:h))continue;
          side+=isColumn?px(idx,i):px(i,idx);sideN++;
        }
        if(!seamN||!sideN)continue;
        const diff=Math.abs(seam/seamN-side/sideN);
        total+=diff;count++;if(diff>=35)strong++;
      }
      return {mean:count?total/count:0,support:count?strong/count:0};
    };
    for(const ratio of [.5,.333,.667]){
      const v=lineContrast(Math.max(2,Math.min(w-3,Math.round(w*ratio))),true);
      const hline=lineContrast(Math.max(2,Math.min(h-3,Math.round(h*ratio))),false);
      if(v.mean>=24&&hline.mean>=24&&v.support>=.42&&hline.support>=.42)return true;
    }
  }catch(error){console.error('Dinliminate error',error)}
  return false;
}
function chooseBetterPhoto(a,b){
  if(!a)return b;
  if(!b)return a;
  const score=(x)=>(PHOTO_SOURCE_TIER[x.source]||70)+Math.min(18,Math.max(0,Number(x.candidateScore)||Number(x.score)||0)/6)+mediaQuality(x.media);
  return score(b)>score(a)?b:a;
}
async function normalizeRestaurantImage(bytes){
  if(!sharp)throw new Error('Image normalization is unavailable.');
  const result=await sharp(bytes,{failOn:'error',limitInputPixels:MAX_RESTAURANT_IMAGE_PIXELS})
    .rotate()
    .resize({width:1400,height:1050,fit:'inside',withoutEnlargement:true})
    .webp({quality:82,effort:4})
    .toBuffer({resolveWithObject:true});
  if(!result?.data?.length||!result?.info?.width||!result?.info?.height)throw new Error('Image normalization failed.');
  return {type:'image/webp',bytes:Buffer.from(result.data),width:result.info.width,height:result.info.height};
}
async function fetchImage(url,headers={},timeout=7000){
  const result=await fetchWithValidatedRedirects(url,{headers:{
    'Accept':'image/avif,image/webp,image/apng,image/jpeg,image/png,image/gif,image/*;q=0.8',
    'User-Agent':'Mozilla/5.0 (compatible; Dinliminate/1.0; restaurant-photo)',
    ...headers
  }},4,10*1024*1024,timeout);
  if(!result||!result.response.ok)throw new Error('Image request failed.');
  const r=result.response;
  const type=(r.headers.get('content-type')||'image/jpeg').split(';')[0].toLowerCase();
  if(!type.startsWith('image/'))throw new Error('Image response was not an image.');
  if(type==='image/svg+xml'||type==='image/svg')throw new Error('SVG assets are not restaurant photos.');
  const bytes=await readResponseBody(r,10*1024*1024);
  if(bytes.length<4000)throw new Error('Image response was too small.');
  if(bytes.length>10*1024*1024)throw new Error('Image is too large.');
  const dimensions=imageDimensions(bytes,type),width=Number(dimensions.width)||0,height=Number(dimensions.height)||0;
  if(width>MAX_RESTAURANT_IMAGE_DIMENSION||height>MAX_RESTAURANT_IMAGE_DIMENSION)throw new Error('Image dimensions are too large.');
  if(width&&height&&(width*height)>MAX_RESTAURANT_IMAGE_PIXELS)throw new Error('Image pixel count is too large.');
  if(width&&height&&mediaQuality(dimensions)<0)throw new Error('Image dimensions are not suitable for a restaurant card.');
  if(await isLikelyPhotoCollage(bytes))throw new Error('Image appears to be a multi-panel or composite graphic.');
  return await normalizeRestaurantImage(bytes);
}
function htmlAttrs(tag){
  const out={};
  const re=/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m;
  while((m=re.exec(String(tag||''))))out[m[1].toLowerCase()]=decodeHtml(m[2]??m[3]??m[4]??'');
  return out;
}

function firstSrcsetUrl(raw,base){
  const parts=String(raw||'').split(',');
  for(const part of parts){
    const value=String(part||'').trim().split(/\s+/)[0];
    const url=absoluteHttpsUrl(value,base);
    if(url&&!isBlockedHost(url)&&!BLOCKED_IMAGE_HINTS.test(url))return url;
  }
  return '';
}

function extractImgCandidates(html,pageUrl){
  const candidates=[],seen=new Set(),re=/<img\b[^>]*>/ig;
  let m;
  while((m=re.exec(String(html||'')))&&candidates.length<120){
    const attrs=htmlAttrs(m[0]);
    const rawSrcs=[
      attrs.src,attrs['data-src'],attrs['data-lazy-src'],attrs['data-original'],
      attrs['data-image-url'],attrs['data-photo-url'],firstSrcsetUrl(attrs.srcset,pageUrl),
      firstSrcsetUrl(attrs['data-srcset'],pageUrl)
    ];
    const url=rawSrcs.map(v=>absoluteHttpsUrl(v,pageUrl)).find(v=>v&&!isBlockedHost(v)&&!BLOCKED_IMAGE_HINTS.test(v));
    if(!url||seen.has(url))continue;
    seen.add(url);
    const sourceHtml=String(html||'');
    const nearby=sourceHtml.slice(Math.max(0,m.index-220),Math.min(sourceHtml.length,m.index+m[0].length+320));
    const width=Number.parseInt(attrs.width||'',10),height=Number.parseInt(attrs.height||'',10);
    const dims=(Number.isFinite(width)?' width '+width:'')+(Number.isFinite(height)?' height '+height:'');
    if((Number.isFinite(width)&&Number.isFinite(height))&&(width<200||height<120))continue;
    const context=[attrs.alt,attrs.title,attrs.class,attrs.id,attrs['data-caption'],attrs['data-alt'],attrs['data-filename'],nearby,url,dims].filter(Boolean).join(' ');
    candidates.push({url,context,label:[attrs.alt,attrs.title,attrs.class,attrs.id,attrs['data-caption'],attrs['data-alt'],attrs['data-filename']].filter(Boolean).join(' '),source:'img',width,height});
  }
  return candidates;
}

function extractLinkedImageCandidates(html,pageUrl){
  const candidates=[],seen=new Set(),re=/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/ig;
  let m;
  while((m=re.exec(String(html||'')))&&candidates.length<80){
    const raw=m[1]??m[2]??m[3]??'';
    const url=absoluteHttpsUrl(raw,pageUrl);
    if(!url||seen.has(url)||isBlockedHost(url)||BLOCKED_IMAGE_HINTS.test(url))continue;
    const text=String(m[4]||'').replace(/<[^>]+>/g,' ');
    const nearby=String(html||'').slice(Math.max(0,m.index-260),Math.min(String(html||'').length,m.index+m[0].length+360));
    const imageUrl=/\.(?:jpe?g|png|webp|avif)(?:[?#].*)?$/i.test(url);
    const imageText=/image|photo|gallery|picture/i.test(text+' '+nearby);
    if(!imageUrl&&!imageText)continue;
    seen.add(url);
    candidates.push({url,context:[text,nearby,url].filter(Boolean).join(' '),source:'linked-image'});
  }
  return candidates;
}

function extractStyleImageCandidates(html,pageUrl){
  const candidates=[],seen=new Set(),re=/background-image\s*:\s*url\(\s*['"]?([^'")\s]+)['"]?\s*\)/ig;
  let m;
  while((m=re.exec(String(html||'')))&&candidates.length<60){
    const url=absoluteHttpsUrl(m[1],pageUrl);
    if(!url||seen.has(url)||isBlockedHost(url)||BLOCKED_IMAGE_HINTS.test(url))continue;
    seen.add(url);
    const context=String(html||'').slice(Math.max(0,m.index-160),Math.min(String(html||'').length,m.index+260));
    candidates.push({url,context,source:'background'});
  }
  return candidates;
}

function extractMetaImages(html,pageUrl){
  const urls=[];
  const patterns=[
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/ig,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/ig,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/ig,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/ig
  ];
  for(const re of patterns){let m;while((m=re.exec(html))&&urls.length<12)urls.push(m[1]);}
  return urls.map(raw=>absoluteHttpsUrl(String(raw||'').replace(/&amp;/g,'&'),pageUrl)).filter(Boolean).filter(url=>!isBlockedHost(url)&&!BLOCKED_IMAGE_HINTS.test(url));
}

function extractJsonLdImageCandidates(html,pageUrl){
  const out=[],seen=new Set(),re=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/ig;
  let m;
  const push=(raw,context='')=>{
    const url=absoluteHttpsUrl(raw,pageUrl);
    if(!url||seen.has(url)||isBlockedHost(url)||BLOCKED_IMAGE_HINTS.test(url))return;
    seen.add(url);
    out.push({url,context:context+' '+url,source:'jsonld'});
  };
  const walk=(value,context='')=>{
    if(value==null||out.length>=100)return;
    if(typeof value==='string'){
      if(/^(?:https?:)?\/\//i.test(value)||/^\//.test(value))push(value,context);
      return;
    }
    if(Array.isArray(value)){for(const item of value)walk(item,context);return;}
    if(typeof value==='object'){
      const local=[value.name,value.caption,value.description,value.alt,value.title,value.contentUrl,value.thumbnailUrl,value.url].filter(v=>typeof v==='string').join(' ');
      for(const key of ['image','photo','photos','contentUrl','thumbnailUrl','associatedMedia']){
        if(value[key])walk(value[key],context+' '+local);
      }
      for(const key of ['itemListElement','subjectOf','about']){
        if(value[key])walk(value[key],context+' '+local);
      }
    }
  };
  while((m=re.exec(String(html||'')))&&out.length<100){
    try{
      const data=JSON.parse(m[1]);
      walk(data,'jsonld');
    }catch(error){console.error('Dinliminate error',error)}
  }
  return out;
}

function normalizeMatchText(text){
  return String(text||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}

function significantNameTokens(name){
  const stop=new Set(['the','a','an','restaurant','restaurants','llc','inc','co','company','and','of','at','in']);
  return normalizeMatchText(name).split(' ').filter(t=>t.length>=3&&!stop.has(t));
}

function structuredRestaurantMatches(html,name,address,phone=''){
  const tokens=significantNameTokens(name);
  if(!tokens.length)return false;
  const addrNorm=normalizeMatchText(address);
  const addrNumber=(String(address||'').match(/\b\d{1,6}\b/)||[])[0];
  const zip=(String(address||'').match(/\b\d{5}(?:-\d{4})?\b/)||[])[0];
  const phoneDigits=String(phone||'').replace(/\D/g,'').slice(-10);
  const city=(addrNorm.split(' ').findIndex(x=>x==='clarksville')>=0)?'clarksville':'';
  const blocks=[];
  const re=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/ig;
  let m;
  while((m=re.exec(String(html||''))))blocks.push(m[1]);
  const inspect=(value)=>{
    if(value==null)return false;
    if(Array.isArray(value))return value.some(inspect);
    if(typeof value!=='object')return false;
    const type=Array.isArray(value['@type'])?value['@type'].join(' '):String(value['@type']||'');
    const business=/restaurant|foodestablishment|localbusiness/i.test(type);
    const itemName=normalizeMatchText(value.name||'');
    const nameHits=tokens.filter(t=>itemName.includes(t)).length;
    if(business&&nameHits/tokens.length>=0.8){
      const a=value.address;
      const itemPhone=String(value.telephone||value.phone||'').replace(/\D/g,'').slice(-10);
      if(phoneDigits&&itemPhone&&itemPhone===phoneDigits)return true;
      const addressText=normalizeMatchText(typeof a==='string'?a:[a?.streetAddress,a?.addressLocality,a?.addressRegion,a?.postalCode].filter(Boolean).join(' '));
      const numberOk=!!addrNumber&&addressText.includes(normalizeMatchText(addrNumber));
      const zipOk=!!zip&&addressText.includes(normalizeMatchText(zip));
      const cityOk=!!city&&addressText.includes(city);
      const locParts=addrNorm.split(' ').filter(t=>t.length>=3).slice(-5);
      const locHits=locParts.filter(t=>addressText.includes(t)).length;
      if(numberOk||zipOk||(cityOk&&locHits>=2)||locHits>=3)return true;
    }
    for(const key of ['mainEntity','about','subject','item','itemListElement','address','location']){
      if(value[key]&&inspect(value[key]))return true;
    }
    return false;
  };
  for(const raw of blocks){
    try{if(inspect(JSON.parse(raw)))return true;}catch(error){console.error('Dinliminate error',error)}
  }
  return false;
}

function strictPageMatchesRestaurant(html,name,address,phone=''){
  const source=String(html||'');
  const hay=normalizeMatchText(source.slice(0,1400000));
  const phoneDigits=String(phone||'').replace(/\D/g,'').slice(-10);
  const digitHay=source.replace(/\D/g,'');
  const tokens=significantNameTokens(name);
  if(!tokens.length)return false;
  const nameHitCount=tokens.filter(t=>hay.includes(t)).length;
  if(nameHitCount/tokens.length<0.9)return false;
  if(phoneDigits&&digitHay.includes(phoneDigits))return true;
  const rawAddress=String(address||'');
  const normAddress=normalizeMatchText(rawAddress);
  const number=(rawAddress.match(/\\b\\d{1,6}\\b/)||[])[0];
  const zip=(rawAddress.match(/\\b\\d{5}(?:-\\d{4})?\\b/)||[])[0];
  const cityTokens=normAddress.split(' ').filter(t=>t.length>=4&&!/^\\d+$/.test(t)).slice(-5);
  const numberOk=!!number&&hay.includes(normalizeMatchText(number));
  const zipOk=!!zip&&hay.includes(normalizeMatchText(zip));
  const cityHits=cityTokens.filter(t=>hay.includes(t)).length;
  if(number&&zip)return numberOk&&zipOk;
  if(number)return numberOk&&cityHits>=1;
  return cityHits>=2;
}

function pageMatchesRestaurant(html,name,address,phone=''){
  const source=String(html||'');
  if(structuredRestaurantMatches(source,name,address,phone))return true;
  const hay=normalizeMatchText(source.slice(0,1400000));
  const tokens=significantNameTokens(name);
  if(!tokens.length)return false;
  const hits=tokens.filter(t=>hay.includes(t)).length;
  if(hits/tokens.length<0.8)return false;
  const phoneDigits=String(phone||'').replace(/\D/g,'').slice(-10);
  if(phoneDigits&&source.replace(/\D/g,'').includes(phoneDigits))return true;
  const number=(String(address||'').match(/\b\d{1,6}\b/)||[])[0];
  if(number&&hay.includes(normalizeMatchText(number)))return true;
  const loc=normalizeMatchText(address).split(' ').filter(t=>t.length>=3).slice(-5);
  return loc.filter(t=>hay.includes(t)).length>=2;
}

async function verifiedRestaurantPage(url,name,address,phone=''){
  const page=absoluteHttpsUrl(url);
  if(!page||isBlockedHost(page))return null;
  try{
    const html=await fetchText(page,{},6000,1800000);
    return strictPageMatchesRestaurant(html,name,address,phone)?html:null;
  }catch{return null}
}

function isRejectedPhotoCandidate(candidate){
  const url=String(candidate?.url||'');
  const label=String(candidate?.label||'');
  const combined=url+' '+label;
  if(PHOTO_GRAPHIC_HINTS.test(combined))return true;
  if(LOW_QUALITY_IMAGE_HINTS.test(combined))return true;
  if(BLOCKED_IMAGE_HINTS.test(url))return true;
  try{
    const u=new URL(url);
    if(u.protocol!=='https:')return true;
    const path=u.pathname.toLowerCase();
    if(/(?:^|[/_-])(?:menu|menuboard|menu-board)(?:[/_.-]|$)/i.test(path))return true;
  }catch{return true}
  return false;
}
function venueScore(candidate,name,address,website){
  const context=String(candidate?.context||'')+' '+String(candidate?.url||'');
  const hay=normalizeMatchText(context);
  const nameTokens=significantNameTokens(name);
  const matchedName=nameTokens.filter(t=>hay.includes(t)).length;
  const addrNumber=(String(address||'').match(/\b\d{1,6}\b/)||[])[0];
  const venueHits=(normalizeMatchText(context).match(/exterior|outside|outdoor|front|entrance|entry|building|storefront|facade|sign|signage|location|drive thru|parking lot|parking|street view|patio|terrace/g)||[]).length;
  const contextHits=(normalizeMatchText(String(candidate?.label||candidate?.context||'')).match(PHOTO_CONTEXT_HINTS)||[]).length;
  let score=0;
  score+=matchedName*24;
  if(nameTokens.length&&matchedName===nameTokens.length)score+=70;
  if(addrNumber&&hay.includes(normalizeMatchText(addrNumber)))score+=34;
  if(VENUE_IMAGE_HINTS.test(context))score+=Math.min(70,venueHits*18);
  score+=Math.min(30,contextHits*10);
  if(candidate.source==='img'||candidate.source==='restaurantji-photo')score+=12;
  if(candidate.source==='jsonld')score+=10;
  if(candidate.source==='background')score+=8;
  if(candidate.source==='meta')score-=55;
  if(LOW_QUALITY_IMAGE_HINTS.test(String(candidate?.url||'')))score-=28;
  const websiteHost=hostOf(website);
  const candidateHost=hostOf(candidate.url);
  if(websiteHost&&candidateHost&&(candidateHost===websiteHost||candidateHost.endsWith('.'+websiteHost)))score+=28;
  if(isRejectedPhotoCandidate(candidate))return -999;
  return score;
}
function hasVenueSignal(candidate){
  const context=String(candidate?.context||'');
  if(candidate?.source==='meta'||candidate?.source==='jsonld')return true;
  if(candidate?.source==='restaurantji-photo')return true;
  // The page itself has already been verified as the exact restaurant/location.
  // Once obvious graphics/menu assets are rejected, a normal image element on
  // a verified official/public venue page is a valid photo candidate even when
  // its alt text is empty or the surrounding HTML contains no venue keywords.
  if(['img','background'].includes(candidate?.source)&&Number(candidate?.score||0)>=10)return true;
  // Exact verified venue pages may expose their photo as an anchor to a
  // standalone image (common in older local-news articles).
  if(candidate?.source==='linked-image'&&Number(candidate?.score||0)>=30)return true;
  if(!context.trim())return false;
  const hay=normalizeMatchText(context);
  const venueHits=(hay.match(/exterior|outside|outdoor|front|entrance|entry|building|storefront|facade|sign|signage|location|drive thru|parking lot|parking|street view|patio|terrace/g)||[]).length;
  const foodHits=(hay.match(/menu|food|dish|meal|burger|pizza|salad|steak|wings|tacos|sushi|pasta|chicken|fries|dessert|cake|sandwich|plate|entree|appetizer|breakfast|lunch|dinner|drink|cocktail|coffee|beer|wine/g)||[]).length;
  return venueHits>=1 && foodHits <= (venueHits*3+4);
}

function isRestaurantjiPage(pageUrl){
  return discoveryHost(pageUrl)==='restaurantji.com';
}
function extractRestaurantjiPhotoCandidates(html,pageUrl,name,address){
  if(!isRestaurantjiPage(pageUrl))return [];
  return extractImgCandidates(html,pageUrl).filter(item=>{
    const path=(()=>{try{return new URL(item.url).pathname.toLowerCase()}catch{return ''}})();
    return /(?:^|[/])(?:d|m)_[^/]*(?:_photo|_photos)\.(?:jpe?g|png|webp)$/i.test(path) && !isRejectedPhotoCandidate(item);
  }).map(item=>({...item,source:'restaurantji-photo',label:(item.label||'')+' restaurantji photo',score:240}));
}
function extractVenueImageCandidates(html,pageUrl,name,address,website){
  const raw=[
    ...extractRestaurantjiPhotoCandidates(html,pageUrl,name,address),
    ...extractImgCandidates(html,pageUrl),
    ...extractLinkedImageCandidates(html,pageUrl),
    ...extractStyleImageCandidates(html,pageUrl),
    ...extractJsonLdImageCandidates(html,pageUrl)
  ];
  const meta=extractMetaImages(html,pageUrl).map(url=>({url,context:url+' '+normalizeMatchText(name)+' restaurant',label:'open-graph image',source:'meta'}));
  const seen=new Set();
  const pageIsDirectory=isPhotoDiscoveryHost(pageUrl);
  const pageHost=discoveryHost(pageUrl);
  const all=[...raw,...meta].map(item=>({...item,score:venueScore(item,name,address,website)}))
    .filter(item=>{
      if(seen.has(item.url))return false;
      seen.add(item.url);
      if(pageIsDirectory&&['meta','jsonld'].includes(item.source))return false;
      if(LOW_TRUST_PUBLIC_PHOTO_HOSTS.has(pageHost)&&item.source!=='restaurantji-photo')return false;
      return !isRejectedPhotoCandidate(item);
    });
  return all.sort((a,b)=>b.score-a.score);
}

function extractBingImageCandidates(html){
  const candidates=[],re=/\bm="([^"]+)"/gi;
  let match;
  while((match=re.exec(html))&&candidates.length<60){
    try{
      const raw=JSON.parse(decodeHtml(match[1]));
      const contentUrl=absoluteHttpsUrl(raw?.murl||raw?.contentUrl||'');
      const hostPageUrl=absoluteHttpsUrl(raw?.purl||raw?.hostPageUrl||'');
      if(!contentUrl||isBlockedHost(contentUrl)||BLOCKED_IMAGE_HINTS.test(contentUrl))continue;
      candidates.push({
        contentUrl,
        hostPageUrl,
        title:String(raw?.t||raw?.name||'').trim(),
        description:String(raw?.desc||'').trim(),
        host:hostOf(hostPageUrl||contentUrl)
      });
    }catch(error){console.error('Dinliminate error',error)}
  }
  return candidates;
}

function scoreImage(candidate,name,address,website,phone=''){
  return venueScore({url:candidate?.contentUrl||'',context:[candidate?.title,candidate?.description,candidate?.hostPageUrl].filter(Boolean).join(' '),source:'bing'},name,address,website)
      + (candidate?.hostPageUrl?12:0)
      + (phone&&String(candidate?.title||'').includes(String(phone))?18:0);
}

const PHOTO_DISCOVERY_HOSTS=new Set([
 'restaurantji.com','www.restaurantji.com','restaurantguru.com','www.restaurantguru.com',
 'tripadvisor.com','www.tripadvisor.com','tripadvisor.ca','www.tripadvisor.ca',
 'clarksvillenow.com','www.clarksvillenow.com','visitclarksvilletn.com','www.visitclarksvilletn.com',
 'usarestaurants.info','www.usarestaurants.info','yellowpages.com','www.yellowpages.com',
 'mapquest.com','www.mapquest.com','foursquare.com','www.foursquare.com',
 'facebook.com','www.facebook.com','instagram.com','www.instagram.com',
 'yelp.com','www.yelp.com'
]);
function discoveryHost(url){return hostOf(url).replace(/^www\./,'');}
function extractSearchResultUrl(raw,base){
 const decoded=decodeHtml(String(raw||''));
 try{
  const absolute=/^https?:\/\//i.test(decoded)?decoded:new URL(decoded,base||'').toString();
  const u=new URL(absolute);
  for(const key of ['q','url','uddg','u']){
   const nested=u.searchParams.get(key);
   if(nested&&/^https?:\/\//i.test(nested))return nested;
  }
  return absolute;
 }catch{return ''}
}
function extractGenericSearchResults(html,sourceHost=''){
 const out=[],seen=new Set();
 const add=(raw,title='')=>{
  const url=absoluteHttpsUrl(raw,sourceHost?('https://'+sourceHost+'/'):'');
  if(!url)return;
  const host=discoveryHost(url);
  if(!host||host===sourceHost||host.includes('google.')||host.includes('bing.')||host.includes('duckduckgo.'))return;
  if(seen.has(url))return;
  const blockedPublic=/^(?:yelp|grubhub|doordash|ubereats|postmates|seamless)\.com$/.test(host);
  if(blockedPublic)return;
  seen.add(url);
  out.push({url,title:String(title||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(),kind:PHOTO_DISCOVERY_HOSTS.has(host)?'public':'website'});
 };
 const anchorRe=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/ig;
 let m;
 while((m=anchorRe.exec(String(html||'')))&&out.length<50)add(extractSearchResultUrl(m[1],sourceHost?('https://'+sourceHost+'/'):''),m[2]);
 const plainRe=/(https?:\/\/[^\s"'<>]+)/ig;
 while((m=plainRe.exec(String(html||'')))&&out.length<70)add(m[1],'');
 return out;
}
function isPhotoDiscoveryHost(url){
 return PHOTO_DISCOVERY_HOSTS.has(discoveryHost(url));
}
function extractBingWebResultUrls(html){
  const out=[];
  const re=/<li[^>]+class=["'][^"']*b_algo[^"']*["'][^>]*>[\s\S]*?<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["']/gi;
  let m;
  while((m=re.exec(String(html||'')))&&out.length<20){
    const url=absoluteHttpsUrl(String(m[1]||'').replace(/&amp;/g,'&'));
    if(url&&!isBlockedHost(url))out.push(url);
  }
  return [...new Set(out)];
}

async function fetchVerifiedPages(urls,name,address,phone=''){
  const results=await Promise.allSettled(urls.map(async url=>{
    const html=await verifiedRestaurantPage(url,name,address,phone);
    return html?{url,html}:null;
  }));
  return results.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value);
}
function sameHost(a,b){
  const ah=hostOf(a),bh=hostOf(b);
  return !!ah&&!!bh&&(ah===bh||ah.endsWith('.'+bh)||bh.endsWith('.'+ah));
}
function extractInternalLinks(html,pageUrl,name,address){
  const out=[],seen=new Set(),re=/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/ig;
  const nameTokens=significantNameTokens(name),addressTokens=normalizeMatchText(address).split(' ').filter(t=>t.length>=3).slice(0,10);
  let m;
  while((m=re.exec(String(html||'')))&&out.length<80){
    const raw=m[1]??m[2]??m[3]??'',url=absoluteHttpsUrl(raw,pageUrl);
    if(!url||isBlockedHost(url)||!sameHost(url,pageUrl)||seen.has(url))continue;
    const text=String(m[4]||'').replace(/<[^>]+>/g,' ');
    const context=normalizeMatchText([text,url].join(' '));
    const locationSignal=/location|locations|find us|store locator|where we are|contact|our restaurant|restaurants?/i.test(context);
    const photoSignal=/gallery|photo|photos|about|visit|inside|outside|exterior/i.test(context);
    const nameSignal=nameTokens.filter(t=>context.includes(t)).length>=Math.max(1,Math.ceil(nameTokens.length*0.5));
    const addressSignal=addressTokens.filter(t=>context.includes(t)).length>=2;
    const score=(locationSignal?50:0)+(photoSignal?20:0)+(nameSignal?30:0)+(addressSignal?35:0);
    if(score<=0)continue;
    seen.add(url);out.push({url,score});
  }
  return out.sort((a,b)=>b.score-a.score).slice(0,12).map(x=>x.url);
}
async function discoverOfficialLocationPages(name,address,website,phone=''){
  const official=absoluteHttpsUrl(website);
  if(!official||isBlockedHost(official))return [];
  const host=hostOf(official);
  const safeName=String(name||'').replace(/"/g,'').trim();
  const safeAddress=String(address||'').replace(/"/g,'').trim();
  const phoneDigits=String(phone||'').replace(/\D/g,'').slice(-10);
  const queries=[];
  if(safeName&&safeAddress)queries.push('"'+safeName+'" "'+safeAddress+'" site:'+host);
  if(safeName&&phoneDigits)queries.push('"'+safeName+'" "'+phoneDigits+'" site:'+host);
  if(safeName)queries.push('"'+safeName+'" location site:'+host);
  const fetchSearch=async q=>{
    const url='https://www.bing.com/search?'+new URLSearchParams({q:q,mkt:'en-US',first:'1'}).toString();
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),2800);
    try{
      const response=await fetch(url,{headers:{
        Accept:'text/html,application/xhtml+xml',
        'Accept-Language':'en-US,en;q=0.8',
        'User-Agent':'Mozilla/5.0 (compatible; Dinliminate/1.0; official-location-resolver)'
      },signal:ctl.signal});
      if(!response.ok)return '';
      const bytes=Buffer.from(await response.arrayBuffer());
      if(bytes.length>900000)return '';
      return bytes.toString('utf8');
    }catch{return ''}finally{clearTimeout(timer)}
  };
  const pages=await Promise.allSettled(queries.slice(0,3).map(fetchSearch));
  const urls=[];
  const seen=new Set();
  for(const page of pages){
    if(page.status!=='fulfilled'||!page.value)continue;
    for(const url of extractBingWebResultUrls(page.value)){
      if(seen.has(url)||!sameHost(url,official))continue;
      const normalized=String(url).toLowerCase();
      if(normalized===String(official).toLowerCase())continue;
      if(isBlockedHost(url))continue;
      seen.add(url);urls.push(url);
      if(urls.length>=12)break;
    }
  }
  const ranked=urls.sort((a,b)=>{
    const rank=url=>{
      const path=(()=>{try{return new URL(url).pathname.toLowerCase()}catch{return ''}})();
      let score=0;
      if(/\/location\//.test(path))score+=60;
      if(/\/locations?\//.test(path))score+=55;
      if(/\/store\//.test(path))score+=50;
      if(/\/restaurant\//.test(path))score+=40;
      if(/\/(?:tn|us|en-us)\//.test(path))score+=15;
      return score;
    };
    return rank(b)-rank(a);
  });
  return await fetchVerifiedPages(ranked.slice(0,8),name,address,phone);
}

async function officialRestaurantPages(name,address,website){
  const official=absoluteHttpsUrl(website);
  if(!official||isBlockedHost(official))return [];
  try{
    const html=await fetchText(official,{},2400,1800000);
    const pages=[];
    const direct=pageMatchesRestaurant(html,name,address)?html:null;
    if(direct)pages.push({url:official,html:direct});
    const links=extractInternalLinks(html,official,name,address);
    const internal=await fetchVerifiedPages(links.slice(0,4),name,address);
    for(const item of internal)if(!pages.some(x=>sameHost(x.url,item.url)))pages.push(item);
    return pages.slice(0,12);
  }catch{return []}
}
async function fastOfficialVenuePhoto(name,address,website,phone=''){
 const official=absoluteHttpsUrl(website);
 if(!official||isBlockedHost(official))return null;
 try{
  const html=await fetchText(official,{},1800,1800000);
  if(!html||!pageMatchesRestaurant(html,name,address,phone))return null;
  const candidates=extractVenueImageCandidates(html,official,name,address,official)
    .filter(item=>item.score>=10&&item.score>0&&hasVenueSignal(item))
    .slice(0,10);
  const attempts=await Promise.allSettled(candidates.map(async candidate=>{
   try{return {media:await fetchImage(candidate.url,{'Referer':official},2200),candidate};}catch{return null;}
  }));
  for(const hit of attempts){
   if(hit.status==='fulfilled'&&hit.value){
    return {media:hit.value.media,source:'official-fast-path',sourceUrl:official,sourceName:hostOf(official)};
   }
  }
 }catch(error){console.error('Dinliminate error',error)}
 return null;
}
const KNOWN_PUBLIC_PHOTO_PAGES=[
 {names:['shelbys trio',"shelby's trio"],addressTokens:['304 n 2nd st','304 north 2nd street'],phone:'9319193373',url:'https://www.toasttab.com/local/order/shelbys-trio-304-north-2nd-street'},
 {names:['mcdonalds'],addressTokens:['792 n 2nd st','792 north 2nd street'],phone:'9315520627',url:'https://www.restaurantji.com/tn/clarksville/mcdonalds-/'},
 {names:['mcdonalds'],addressTokens:['724 sango rd','724 sango road'],phone:'9313580259',url:'https://www.restaurantji.com/tn/clarksville/mcdonalds/'},
 {names:['subway'],addressTokens:['601 college st','601 college street','student union'],phone:'9312498572',url:'https://restaurants.subway.com/united-states/tn/clarkesville/601-college-street'},
 {names:['excell bbq','excell bar b q','excell market bar b q','excell market and bbq'],addressTokens:['3102 ashland city rd','3102 ashland city road'],phone:'9313583638',url:'https://clarksvillenow.com/local/exploring-the-clarksville-food-scene-excell-bar-b-q/'},
 {names:['thirsty goat'],addressTokens:['4044 madison st','4044 madison street','madison street 4044'],phone:'9313434628',url:'https://www.restaurantji.com/tn/clarksville/the-thirsty-goat-/'}
];
function normalizePhoneDigits(value){return String(value||'').replace(/\D/g,'').slice(-10);}
function compactMatchText(value){return normalizeMatchText(value).replace(/\s+/g,'');}
function knownPublicPhotoPage(name,address='',phone=''){
 const normalized=compactMatchText(name);
 const addr=normalizeMatchText(address);
 const phoneDigits=normalizePhoneDigits(phone);
 const hit=KNOWN_PUBLIC_PHOTO_PAGES.find(entry=>{
  const names=Array.isArray(entry?.names)?entry.names:[];
  const addressTokens=Array.isArray(entry?.addressTokens)?entry.addressTokens:[];
  const nameMatch=names.some(n=>{
   const key=compactMatchText(n);
   return normalized===key||normalized.includes(key)||key.includes(normalized);
  });
  if(!nameMatch)return false;
  const addressMatch=addressTokens.some(token=>addr.includes(normalizeMatchText(token)));
  const entryPhone=normalizePhoneDigits(entry?.phone||'');
  const phoneMatch=!!entryPhone&&!!phoneDigits&&entryPhone===phoneDigits;
  return addressMatch||phoneMatch;
 });
 return hit?.url||'';
}
const KNOWN_RESTAURANT_PHOTOS=[
 {names:["sweet p's southern style","sweet ps southern style"],image:"https://static.where-e.com/United_States/Tennessee/Sweet-Ps-Southern-Style_8c41d09a14d942d0ca25ab6076d3f05e.jpg",sourceUrl:"https://sweet-ps-southern-style.wheree.com/"},
 {names:["gray smoke barbecue","gray smoke","gray's smoke"],image:"https://du9m0k402rjmo.cloudfront.net/images/P_23585/90a3488a-0fdb-47fa-9c6d-e76837ebc263.jpg",sourceUrl:"https://graysmokebarbecue.com/"},
 {names:["cap's neighborhood bar & grill","caps neighborhood bar & grill","caps neighborhood bar and grill"],image:"https://clarksvillenow.sagacom.com/files/2024/05/CAPS-Neighborhood-Bar-Grill-7.jpg",sourceUrl:"https://clarksvillenow.com/local/caps-neighborhood-bar-grill-opens-family-friendly-spot-in-clarksville/"},
 {names:["Reggie's BBQ","Reggie's BBQ Clarksville"],image:"https://d1w7312wesee68.cloudfront.net/XqjMLj3K3JQ1LOypRViqpaLKzbu0dXfv_cQwp2AxpXk/ext%3Awebp/quality%3A85/plain/s3%3A//toast-sites-resources-prod/restaurantImages/263daf0a-e243-4425-8d8a-9b75cbf93056/82d46202-8e46-4a18-9858-9ca3d930ca93-19",sourceUrl:"https://reggiesbbq.com/"},
 {names:["Legends Smokehouse & Grill","Legends Smokehouse and Grill","Legends Smokehouse"],image:"https://5dee1204fff7f466a182.cdn6.editmysite.com/uploads/b/5dee1204fff7f466a182a4e6fe08b0edea7ec96d54c794955f8198991dae5da6/Untitled%20design%282%29_1713398838.png?optimize=medium&width=2400",sourceUrl:"https://www.legendssmokehouseandgrill.com/about-us"},
 {names:["Johnny's Big Burger","Johnnys Big Burger"],image:"https://thebigburger.com/__l5e/assets-v1/3211c7e6-0473-4028-b8d0-db085ca4a369/frontpage.jpg",sourceUrl:"https://thebigburger.com/"},
 {names:["Blackhorse Pub & Brewery","Blackhorse Pub and Brewery","Blackhorse"],image:"https://assets.site-static.com/userFiles/2147/image/Mark/Compress_Images_Special_Project/The%20Blackhorse%20Pub%20Brewery%2C%20TN.jpg",sourceUrl:"https://www.mattwardhomes.com/clarksville/"},
 {names:["Pbody's","Pbodys"],image:"https://img.p.mapq.st/?q=75&url=https%3A%2F%2Fmedia-cdn.tripadvisor.com%2Fmedia%2Fphoto-o%2F07%2F11%2Fa6%2F80%2Fpbody-s.jpg&w=3840",sourceUrl:"https://www.mapquest.com/us/tennessee/pbodys-424425299"},
 {names:["The Catfish House","Catfish House"],image:"https://static.wixstatic.com/media/568437_1b8e1db53bfa4086b85fad232d3b91f4~mv2.jpg/v1/fill/w_960%2Ch_460%2Cal_c%2Cq_85%2Cenc_avif%2Cquality_auto/568437_1b8e1db53bfa4086b85fad232d3b91f4~mv2.jpg",sourceUrl:"https://www.catfishhouseclarksville.com/"},
 {names:["Liberty Park Grill"],image:"https://photos.smugmug.com/USA/Tennessee/Clarksville/i-L9DVxSZ/0/92fe32e8/L/ClarksvilleTN-369-L.jpg",sourceUrl:"https://abritandasoutherner.com/things-to-do-in-clarksville-tn/"},
 {names:["Cafe 931","Café 931"],image:"https://pub-ba1a74be17d7442a9f2541946eb9510e.r2.dev/shops/1f9865fb-9f52-490e-8c41-377ec5adab87/0.jpg",sourceUrl:"https://joe.coffee/locations/tn/clarksville/cafe-931-clarksville-1f9865fb-9f52-490e-8c41-377ec5adab87/"},
 {names:["Yada on Franklin","Yada"],image:"https://static.spotapps.co/spots/cd/9f903fe2ff4bd0b72d4439b91d8d95/full",sourceUrl:"https://yadaonfranklin.com/"},
 {names:["The Mailroom","Mailroom"],image:"https://images.squarespace-cdn.com/content/v1/6772c0e3152fba51d1e9cea1/1735573738359-OFYKQZMLW8GCX7TIKR0Q/Mailroom-Featured-Image-Header.jpg",sourceUrl:"https://www.mailroomtn.com/about"},
 {names:["Silke's Old World Breads","Silkes Old World Breads","Silke's"],image:"https://silkesoldworldbreads.com/cdn/shop/files/outside_whole_bldg_for_web.jpg?v=1631571846&width=3840",sourceUrl:"https://silkesoldworldbreads.com/"},
 {names:["Casa D'Italia","Casa D’Italia","Casa D Italia","Casa D'Italia Ristorante"],image:"https://static.goto-where.com/70162-albums-1.jpg",sourceUrl:"https://casa-ditalia.goto-where.com/"}
];
function knownRestaurantPhoto(name,address){
 const normalized=normalizeMatchText(name);
 if(!normalized||address&&!/\bclarksville\b/i.test(address))return null;
 return KNOWN_RESTAURANT_PHOTOS.find(entry=>entry.names.some(n=>{
  const key=normalizeMatchText(n);
  return normalized===key||normalized.includes(key)||key.includes(normalized);
 }))||null;
}
async function fastKnownRestaurantPhoto(name,address){
 const hit=knownRestaurantPhoto(name,address);
 if(!hit)return null;
 try{
  const media=await fetchImage(hit.image,{'Referer':hit.sourceUrl},2200);
  return {media,source:'known-restaurant-photo',sourceUrl:hit.sourceUrl,sourceName:hostOf(hit.sourceUrl)};
 }catch(error){console.error('Dinliminate error',error)}
 return null;
}
async function fastKnownPublicPhoto(name,address,website,phone=''){
 const hint=knownPublicPhotoPage(name,address,phone);
 if(!hint)return null;
 try{
  const html=await fetchText(hint,{},1800,1500000);
  if(!html||!pageMatchesRestaurant(html,name,address,phone))return null;
  const candidates=extractVenueImageCandidates(html,hint,name,address,website)
    .filter(item=>item.score>=24&&item.score>0&&hasVenueSignal(item))
    .slice(0,8);
  const attempts=await Promise.allSettled(candidates.map(async candidate=>{
   try{return {media:await fetchImage(candidate.url,{'Referer':hint},2200),candidate};}catch{return null;}
  }));
  for(const hit of attempts){
   if(hit.status==='fulfilled'&&hit.value){
    return {media:hit.value.media,source:'known-public-venue-page',sourceUrl:hint,sourceName:hostOf(hint)};
   }
  }
 }catch(error){console.error('Dinliminate error',error)}
 return null;
}
const DIRECTORY_STATE_NAMES=[
 ['alabama','al'],['alaska','ak'],['arizona','az'],['arkansas','ar'],['california','ca'],['colorado','co'],
 ['connecticut','ct'],['delaware','de'],['florida','fl'],['georgia','ga'],['hawaii','hi'],['idaho','id'],
 ['illinois','il'],['indiana','in'],['iowa','ia'],['kansas','ks'],['kentucky','ky'],['louisiana','la'],
 ['maine','me'],['maryland','md'],['massachusetts','ma'],['michigan','mi'],['minnesota','mn'],['mississippi','ms'],
 ['missouri','mo'],['montana','mt'],['nebraska','ne'],['nevada','nv'],['new hampshire','nh'],['new jersey','nj'],
 ['new mexico','nm'],['new york','ny'],['north carolina','nc'],['north dakota','nd'],['ohio','oh'],['oklahoma','ok'],
 ['oregon','or'],['pennsylvania','pa'],['rhode island','ri'],['south carolina','sc'],['south dakota','sd'],
 ['tennessee','tn'],['texas','tx'],['utah','ut'],['vermont','vt'],['virginia','va'],['washington','wa'],
 ['west virginia','wv'],['wisconsin','wi'],['wyoming','wy'],['district of columbia','dc']
];
const DIRECTORY_BLOCKED_HOSTS=new Set([
 'yelp.com','www.yelp.com','grubhub.com','www.grubhub.com','doordash.com','www.doordash.com',
 'ubereats.com','www.ubereats.com','postmates.com','www.postmates.com','seamless.com','www.seamless.com'
]);
function directoryLocation(address){
 const raw=String(address||'').trim();
 const parts=raw.split(',').map(x=>x.trim()).filter(Boolean);
 let state='';
 const stateZip=raw.match(/(?:^|[ ,])([A-Za-z]{2})\s+\d{5}(?:-\d{4})?/);
 if(stateZip)state=String(stateZip[1]).toLowerCase();
 if(!state){
  const lower=parts.map(x=>x.toLowerCase());
  const hit=DIRECTORY_STATE_NAMES.find(([name])=>lower.some(p=>p===name||p.startsWith(name+' ')));
  state=hit?.[1]||'';
 }
 let city='';
 if(parts.length>=2){
  const stateIdx=parts.findIndex(p=>/^([A-Za-z]{2})(?:\s+\d{5})?$/i.test(p)||DIRECTORY_STATE_NAMES.some(([name])=>p.toLowerCase().startsWith(name)));
  const zipIdx=parts.findIndex(p=>/^\d{5}(?:-\d{4})?$/.test(p));
  if(stateIdx>=1) city=parts[stateIdx-1];
  else if(zipIdx>=2) city=parts[zipIdx-2];
  else if(parts.length>=2) city=parts[parts.length-2]||'';
 }
 city=normalizeMatchText(city);
 return {state,city};
}
function directorySlugVariants(name){
 const base=normalizeMatchText(name).replace(/\s+/g,'-');
 const noThe=base.replace(/^the-/,'');
 const variants=[base,noThe];
 for(const item of [base,noThe]){
  if(item){
   variants.push(item+'-');
   variants.push(item+'s');
   variants.push(item+'s-');
   if(item.endsWith('s'))variants.push(item.slice(0,-1)+'-');
  }
 }
 return [...new Set(variants.filter(Boolean))].slice(0,8);
}
function directoryCandidateUrls(name,address){
 const {state,city}=directoryLocation(address);
 if(!state||!city)return[];
 const citySlug=city.replace(/\s+/g,'-');
 const urls=[];
 for(const slug of directorySlugVariants(name)){
  urls.push('https://www.restaurantji.com/'+state+'/'+citySlug+'/'+slug+'/');
  urls.push('https://restaurantguru.com/'+slug.replace(/-+$/,'')+'-'+citySlug);
 }
 return [...new Set(urls)];
}
function extractDirectoryWebsiteCandidates(html,pageUrl){
 const out=[],seen=new Set();
 const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/ig;
 let m;
 while((m=re.exec(String(html||'')))&&out.length<20){
  const label=String(m[2]||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  if(!/\b(?:official\s+)?website|official\s+site|homepage\b/i.test(label))continue;
  let href='';
  try{href=new URL(m[1],pageUrl).toString();}catch{continue}
  if(!/^https:\/\//i.test(href))continue;
  const host=hostOf(href);
  if(!host||PHOTO_DISCOVERY_HOSTS.has(discoveryHost(href))||DIRECTORY_BLOCKED_HOSTS.has(host)||isBlockedHost(href)||seen.has(href))continue;
  seen.add(href);out.push(href);
 }
 return out;
}
async function fastDirectoryPhotoSources(name,address,phone=''){
 const urls=directoryCandidateUrls(name,address);
 if(!urls.length)return null;
 const settled=await Promise.allSettled(urls.slice(0,12).map(async url=>{
  const html=await fetchText(url,{},1600,1200000);
  if(!html||!pageMatchesRestaurant(html,name,address,phone))return null;
  return {url,html};
 }));
 const pages=settled.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value);
 if(!pages.length)return null;
 for(const page of pages){
  const websiteCandidates=extractDirectoryWebsiteCandidates(page.html,page.url);
  for(const website of websiteCandidates.slice(0,4)){
   const official=await fastOfficialVenuePhoto(name,address,website,phone);
   if(official)return {official};
  }
 }
 for(const page of pages){
  const candidates=extractVenueImageCandidates(page.html,page.url,name,address,'')
   .filter(item=>item.score>=24&&item.score>0&&hasVenueSignal(item))
   .slice(0,10);
  const attempts=await Promise.allSettled(candidates.map(async candidate=>{
   try{return {media:await fetchImage(candidate.url,{'Referer':page.url},2200)}}catch{return null;}
  }));
  for(const hit of attempts){
   if(hit.status==='fulfilled'&&hit.value){
    return {publicPhoto:{media:hit.value.media,source:'exact-public-venue-page',sourceUrl:page.url,sourceName:hostOf(page.url)}};
   }
  }
 }
 return null;
}
async function findVerifiedRestaurantPages(name,address,website){
  const safeName=String(name||'').replace(/"/g,''),safeAddress=String(address||'').replace(/"/g,''),websiteHost=hostOf(website);
  const official=await officialRestaurantPages(name,address,website);

  const queries=[];
  if(safeName&&safeAddress)queries.push('site:visitclarksvilletn.com "'+safeName+'" "'+safeAddress+'" restaurant');
  if(safeName&&safeAddress)queries.push('site:clarksvillenow.com "'+safeName+'" "'+safeAddress+'" restaurant');
  if(safeName&&safeAddress)queries.push('"'+safeName+'" "'+safeAddress+'" restaurant');
  if(safeName&&safeAddress)queries.push('site:restaurantji.com "'+safeName+'" "'+safeAddress+'"');
  if(safeName&&safeAddress)queries.push('site:restaurantguru.com "'+safeName+'" "'+safeAddress+'"');
  if(safeName&&safeAddress)queries.push('site:tripadvisor.com "'+safeName+'" "'+safeAddress+'"');

  const sources=[
   {base:'https://www.bing.com/search',host:'bing.com'},
   {base:'https://html.duckduckgo.com/html/',host:'html.duckduckgo.com'}
  ];
  const searchPages=[];
  for(const source of sources){
   const settled=await Promise.allSettled(
    queries.slice(0,5).map(q=>fetchText(source.base+'?'+new URLSearchParams({q,mkt:'en-US',first:'1'}).toString(),{},2500,900000))
   );
   for(const p of settled)if(p.status==='fulfilled'&&p.value)searchPages.push({source,html:p.value});
  }

  const results=[],seen=new Set();
  for(const item of searchPages){
   for(const hit of extractGenericSearchResults(item.html,item.source.host)){
    if(!hit.url||seen.has(hit.url))continue;
    seen.add(hit.url);
    results.push(hit);
   }
  }

  // Fetch the strongest search candidates, but verify the complete restaurant
  // identity before any page can provide a photo.
  const ranked=results.sort((a,b)=>{
   const aText=normalizeMatchText(a.title+' '+a.url),bText=normalizeMatchText(b.title+' '+b.url);
   const n=normalizeMatchText(name);
   const ah=aText.includes(n)?20:0,bh=bText.includes(n)?20:0;
   const ap=isPhotoDiscoveryHost(a.url)?0:12,bp=isPhotoDiscoveryHost(b.url)?0:12;
   return (bh+bp)-(ah+ap);
  });
  const verified=await fetchVerifiedPages(ranked.slice(0,16).map(x=>x.url),name,address);

  const officialFromSearch=verified.filter(x=>{
   if(websiteHost)return sameHost(x.url,websiteHost);
   return !isPhotoDiscoveryHost(x.url);
  });
  const publicPages=verified.filter(x=>websiteHost?sameHost(x.url,websiteHost)===false:isPhotoDiscoveryHost(x.url));
  const publicSourcePriority=(url)=>{
    const host=discoveryHost(url);
    if(host==='restaurantji.com')return 100;
    if(host==='tripadvisor.com'||host==='tripadvisor.ca')return 94;
    if(host==='clarksvillenow.com'||host==='visitclarksvilletn.com')return 90;
    if(host==='restaurantguru.com')return 76;
    return 60;
  };
  publicPages.sort((a,b)=>publicSourcePriority(b.url)-publicSourcePriority(a.url));

  const officialMerged=[...official,...officialFromSearch]
   .filter((x,i,a)=>a.findIndex(y=>sameHost(y.url,x.url))===i)
   .slice(0,8);
  return {official:officialMerged,public:publicPages.slice(0,10)};
}

async function bingExactImageCandidates(name,address,website,phone=''){
  const safeName=String(name||'').replace(/"/g,''),safeAddress=String(address||'').replace(/"/g,''),websiteHost=hostOf(website);
  if(!safeName||!safeAddress)return [];
  const queries=['"'+safeName+'" "'+safeAddress+'" restaurant exterior'];
  if(websiteHost)queries.push('site:'+websiteHost+' "'+safeName+'" "'+safeAddress+'"');
  const pages=await Promise.allSettled(queries.map(q=>fetchText('https://www.bing.com/images/search?'+new URLSearchParams({q:q,form:'HDRSC2'}).toString(),{},5000,1200000)));
  const raw=[];
  for(const page of pages){
    if(page.status!=='fulfilled')continue;
    for(const item of extractBingImageCandidates(page.value))raw.push({...item,query:safeName+' '+safeAddress});
  }
  const seen=new Set();
  const candidates=raw.filter(x=>{
    if(seen.has(x.contentUrl))return false;
    seen.add(x.contentUrl);
    return !!x.contentUrl;
  }).map(x=>({...x,score:scoreImage(x,name,address,website,phone)})).filter(x=>x.score>=55);
  return candidates.sort((a,b)=>b.score-a.score).slice(0,20);
}

async function exactImageFromBing(name,address,website,phone=''){
  const candidates=await bingExactImageCandidates(name,address,website,phone);
  const checks=await Promise.allSettled(candidates.slice(0,6).map(async candidate=>{
    const hostPage=candidate.hostPageUrl;
    if(hostPage){
      const verified=await verifiedRestaurantPage(hostPage,name,address,phone);
      if(!verified)return null;
    }
    if(!hostPage&&Number(candidate.score||0)<110)return null;
    try{
      const media=await fetchImage(candidate.contentUrl,{'Referer':hostPage||undefined},4000);
      return {media,source:'exact-public-venue-image',sourceUrl:hostPage||candidate.contentUrl,sourceName:hostOf(hostPage||candidate.contentUrl)};
    }catch{return null}
  }));
  for(const result of checks)if(result.status==='fulfilled'&&result.value)return result.value;
  return null;
}
function sendMedia(res,found){
  const source=String(found?.source||'').trim();
  const isGooglePhoto=source.toLowerCase()==='google-places';
  res.setHeader?.('Content-Type',found.media.type);
  res.setHeader?.('Cache-Control',isGooglePhoto?'no-store, max-age=0':'public, max-age=604800, stale-while-revalidate=2592000');
  res.setHeader?.('X-Content-Type-Options','nosniff');
  res.setHeader?.('X-Restaurant-Photo-Outcome','hit');
  res.setHeader?.('X-Restaurant-Photo-Source',source);
  if(isGooglePhoto&&/^ChI[A-Za-z0-9_-]+$/.test(String(found.googlePlaceId||'')))res.setHeader?.('X-Restaurant-Google-Place-ID',String(found.googlePlaceId));
  console.info('dinliminate-restaurant-photo-outcome',{outcome:'hit',source:source||'unknown'});
  if(found.media.width&&found.media.height)res.setHeader?.('X-Restaurant-Photo-Dimensions',found.media.width+'x'+found.media.height);
  if(found.sourceUrl)res.setHeader?.('X-Restaurant-Photo-Source-URL',found.sourceUrl);
  const attributions=Array.isArray(found.attributions)&&found.attributions.length?found.attributions.map(x=>({displayName:String(x?.displayName||'').trim(),uri:String(x?.uri||'').trim()})).filter(x=>x.displayName||x.uri).slice(0,5):[];
  if(attributions.length)res.setHeader?.('X-Restaurant-Photo-Attributions',Buffer.from(JSON.stringify(attributions)).toString('base64url'));
  else if(found.sourceName&&found.sourceUrl){
    res.setHeader?.('X-Restaurant-Photo-Attributions',Buffer.from(JSON.stringify([{displayName:found.sourceName,uri:found.sourceUrl}])).toString('base64url'));
  }
  res.statusCode=200;
  res.end?.(found.media.bytes);
  return res;
}

module.exports=async function handler(req,res){
  res.setHeader?.('Cache-Control','no-store');
  res.setHeader?.('X-Content-Type-Options','nosniff');
  res.setHeader?.('Referrer-Policy','no-referrer');
  const googlePhotosEnabled=String(process.env.GOOGLE_PHOTOS_ENABLED??'true').trim().toLowerCase()!=='false';
  res.setHeader?.('X-Restaurant-Photo-Google', googlePhotosEnabled ? 'enabled' : 'disabled');
  if(String(req?.method||'GET').toUpperCase()!=='GET')return json(res,405,{ok:false,error:'GET required'});
  
  const q=req?.query&&typeof req.query==='object'?req.query:(req?.queryStringParameters||{});
  const name=String(q.name||'').trim().slice(0,160);
  const address=String(q.address||'').trim().slice(0,240);
  const phone=String(q.phone||'').trim().slice(0,80);
  const website=String(q.website||'').trim().slice(0,700);
  const officialWebsite=String(q.officialWebsite||website).trim().slice(0,700);
  const officialLocationPage=String(q.officialLocationPage||'').trim().slice(0,900);
  const osmImage=String(q.osmImage||'').trim().slice(0,1200);
  const osmExact=q.osmExact==='1';
  const googlePlaceId=String(q.placeId||q.googlePlaceId||'').trim().slice(0,220);
  if(!name)return json(res,400,{ok:false,error:'Restaurant name is required'});
  try{
    // CP1047: Google is the primary new-photo source. Existing client-side
    // verified photos are reused before this request; once a fresh lookup starts,
    // Google gets first opportunity, then exact non-Google sources.
    if(googlePhotosEnabled){
      const googlePhoto=await tryGoogleRestaurantPhoto({
        name,address,phone,lat:q.lat,lon:q.lon,placeId:googlePlaceId
      });
      if(googlePhoto)return sendMedia(res,googlePhoto);
    }

    // Official restaurant sources are the first fallback after Google.
    if(officialLocationPage){
      const directLocation=await fastOfficialVenuePhoto(name,address,officialLocationPage,phone);
      if(directLocation)return sendMedia(res,{...directLocation,source:'official-location-page'});
    }

    if(officialWebsite){
      const fastOfficial=await fastOfficialVenuePhoto(name,address,officialWebsite,phone);
      if(fastOfficial)return sendMedia(res,fastOfficial);

      // An official brand root is not necessarily the exact store page.
      // Discover and verify the location-specific page before leaving the official domain.
      const locationPages=await discoverOfficialLocationPages(name,address,officialWebsite,phone);
      for(const entry of locationPages){
        const candidates=extractVenueImageCandidates(entry.html,entry.url,name,address,officialWebsite)
          .filter(item=>item.score>=10&&item.score>0&&hasVenueSignal(item))
          .slice(0,10);
        const attempts=await Promise.allSettled(candidates.map(async candidate=>{
          try{return {media:await fetchImage(candidate.url,{'Referer':entry.url},2200)}}catch{return null}
        }));
        for(const hit of attempts)if(hit.status==='fulfilled'&&hit.value){
          return sendMedia(res,{media:hit.value.media,source:'official-location-page',sourceUrl:entry.url,sourceName:hostOf(entry.url)});
        }
      }
    }

    const fastKnownRestaurant=await fastKnownRestaurantPhoto(name,address);
    if(fastKnownRestaurant)return sendMedia(res,fastKnownRestaurant);

    const fastKnown=await fastKnownPublicPhoto(name,address,officialWebsite,phone);
    if(fastKnown)return sendMedia(res,fastKnown);

    // Other exact-venue public sources remain the next fallback when Google
    // cannot return an exact, quality restaurant photo.
    const fastDirectory=await fastDirectoryPhotoSources(name,address,phone);
    if(fastDirectory?.official)return sendMedia(res,fastDirectory.official);
    if(fastDirectory?.publicPhoto)return sendMedia(res,fastDirectory.publicPhoto);

    const pages=await findVerifiedRestaurantPages(name,address,officialWebsite);

    // Continue searching the restaurant's own website before leaving the
    // official domain.
    for(const entry of pages.official){
      const candidates=extractVenueImageCandidates(entry.html,entry.url,name,address,officialWebsite)
        .filter(item=>item.score>=10&&item.score>0&&hasVenueSignal(item));
      const attempts=await Promise.allSettled(candidates.slice(0,8).map(async candidate=>{
        try{return {media:await fetchImage(candidate.url,{'Referer':entry.url},3000)}}catch{return null}
      }));
      for(const hit of attempts)if(hit.status==='fulfilled'&&hit.value){
        return sendMedia(res,{media:hit.value.media,source:'official-venue-page',sourceUrl:entry.url,sourceName:hostOf(entry.url)});
      }
    }

    // Then use exact public restaurant pages, with venue verification.
    for(const entry of pages.public){
      const candidates=extractVenueImageCandidates(entry.html,entry.url,name,address,officialWebsite)
        .filter(item=>item.score>=30&&item.score>0&&hasVenueSignal(item));
      const attempts=await Promise.allSettled(candidates.slice(0,8).map(async candidate=>{
        try{return {media:await fetchImage(candidate.url,{'Referer':entry.url},3000)}}catch{return null}
      }));
      for(const hit of attempts)if(hit.status==='fulfilled'&&hit.value){
        return sendMedia(res,{media:hit.value.media,source:'exact-public-venue-page',sourceUrl:entry.url,sourceName:hostOf(entry.url)});
      }
    }

    // OSM exact-POI image remains available after the verified public-site layer.
    if(osmExact&&/^https:\/\//i.test(osmImage)&&!isBlockedHost(osmImage)&&!BLOCKED_IMAGE_HINTS.test(osmImage)){
      try{
        const media=await fetchImage(osmImage,{'Referer':'https://www.openstreetmap.org/'},2800);
        return sendMedia(res,{media,source:'osm-exact-poi'});
      }catch(error){console.error('Dinliminate error',error)}
    }

    // Last discovery layer: Bing Images, but only after exact host-page
    // verification or a very strong exact match.
    const bingImage=await exactImageFromBing(name,address,officialWebsite,phone);
    if(bingImage)return sendMedia(res,bingImage);

    res.setHeader?.('X-Restaurant-Photo-Outcome','miss');
    res.setHeader?.('X-Restaurant-Photo-Failure','no-verified-venue-photo');
    console.info('dinliminate-restaurant-photo-outcome',{outcome:'miss',reason:'no-verified-venue-photo'});
    return json(res,404,{ok:false,error:'No verified venue photo was found from the allowed non-Google sources'});
  }catch(e){
    res.setHeader?.('X-Restaurant-Photo-Outcome','error');
    res.setHeader?.('X-Restaurant-Photo-Failure','resolver-error');
    console.info('dinliminate-restaurant-photo-outcome',{outcome:'error',reason:'resolver-error'});
    console.error('dinliminate-restaurant-photo',e);
    return json(res,502,{ok:false,error:'Could not load the restaurant photo'});
  }
};

module.exports._test={
  googlePhotosEnabled:()=>String(process.env.GOOGLE_PHOTOS_ENABLED??'true').trim().toLowerCase()!=='false',
  absoluteHttpsUrl,
  extractMetaImages,
  extractBingWebResultUrls,
  extractJsonLdImageCandidates,
  extractImgCandidates,
  extractLinkedImageCandidates,
  extractVenueImageCandidates,
  pageMatchesRestaurant,
  venueScore,
  scoreImage,
  hasVenueSignal,
  extractInternalLinks,
  sameHost,
  structuredRestaurantMatches,
  bingExactImageCandidates,
  exactImageFromBing,
  fastOfficialVenuePhoto,
  knownRestaurantPhoto,
  fastKnownRestaurantPhoto,
  discoverOfficialLocationPages,
  knownPublicPhotoPage,
  fastKnownPublicPhoto,
  imageDimensions,
  mediaQuality,
  isRejectedPhotoCandidate,
  fetchImage,
  normalizeRestaurantImage
};