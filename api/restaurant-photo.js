'use strict';

let sharp=null;
try{sharp=require('sharp');}catch{}

const NO_PHOTO_HOSTS=new Set(['google.com','www.google.com','googleusercontent.com','lh3.googleusercontent.com','bing.com','www.bing.com','tse1.mm.bing.net','tse2.mm.bing.net','tse3.mm.bing.net','tse4.mm.bing.net','unsplash.com','images.unsplash.com','pexels.com','images.pexels.com','shutterstock.com','istockphoto.com','gettyimages.com','depositphotos.com','alamy.com','stock.adobe.com']);
const BLOCKED_IMAGE_HINTS=/\b(?:logo|favicon|sprite|icon|avatar|placeholder|default[-_ ]?image|brandmark|wordmark|google[ -]?play|play[ -]?store|app[ -]?store|download[ -]?app|download|badge|payment|visa|mastercard|amex|social[ -]?media|facebook|instagram|tiktok|youtube|x[ -]?twitter)\b/i;
const VENUE_IMAGE_HINTS=/\b(?:exterior|outside|outdoor|front|entrance|entry|building|storefront|facade|façade|sign|signage|location|drive[- ]?thru|drive through|parking lot|parking|street view|patio|terrace)\b/i;
const FOOD_IMAGE_HINTS=/\b(?:menu|food|dish|meal|burger|pizza|salad|steak|wings|tacos?|sushi|pasta|chicken|fries|dessert|cake|sandwich|plate|entrée|entree|appetizer|breakfast|lunch|dinner|drink|cocktail|coffee|beer|wine)\b/i;
const LOW_QUALITY_IMAGE_HINTS=/\b(?:thumbnail|thumb|tiny|small|lowres|low[-_ ]?res|preview|sprite|tile)\b/i;
const MAX_RESTAURANT_IMAGE_DIMENSION=6000;
const MAX_RESTAURANT_IMAGE_PIXELS=12000000;
const PHOTO_SOURCE_TIER={
  'known-restaurant-photo':100,
  'official-fast-path':96,
  'osm-exact-poi':95,
  'official-venue-page':94,
  'exact-public-venue-image':92,
  'known-public-venue-page':90,
  'exact-public-venue-page':88
};

function json(res,status,payload){
  res.statusCode=status;
  res.setHeader?.('Content-Type','application/json; charset=utf-8');
  res.end?.(JSON.stringify(payload));
  return res;
}

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
async function fetchWithValidatedRedirects(start,options={},maxRedirects=4){
  let current=absoluteHttpsUrl(start);
  if(!current||isBlockedHost(current))return null;
  for(let hop=0;hop<=maxRedirects;hop++){
    const response=await fetch(current,{...options,redirect:'manual'});
    if(!(response.status>=300&&response.status<400))return {response,url:current};
    const location=response.headers.get('location');
    if(!location)return null;
    const next=publicRedirectUrl(location,current);
    if(!next||isBlockedHost(next))return null;
    current=next;
  }
  return null;
}

async function fetchText(url,headers={},timeout=7000,maxBytes=2200000){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
  try{
    const result=await fetchWithValidatedRedirects(url,{headers:{
      'Accept':'text/html,application/xhtml+xml',
      'Accept-Language':'en-US,en;q=0.8',
      'User-Agent':'Mozilla/5.0 (compatible; Dinliminate/1.0; restaurant-photo)',
      ...headers
    },signal:ctl.signal});
    if(!result)return '';
    const r=result.response;
    if(!r.ok)throw new Error('Page request failed ('+r.status+').');
    const data=Buffer.from(await r.arrayBuffer());
    if(data.length>maxBytes)throw new Error('Page too large.');
    return data.toString('utf8');
  }finally{clearTimeout(timer)}
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
  }catch{}
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
function chooseBetterPhoto(a,b){
  if(!a)return b;
  if(!b)return a;
  const as=(PHOTO_SOURCE_TIER[a.source]||70)+mediaQuality(a.media);
  const bs=(PHOTO_SOURCE_TIER[b.source]||70)+mediaQuality(b.media);
  return bs>as?b:a;
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
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
  try{
    const result=await fetchWithValidatedRedirects(url,{headers:{
      'Accept':'image/avif,image/webp,image/apng,image/jpeg,image/png,image/gif,image/*;q=0.8',
      'User-Agent':'Mozilla/5.0 (compatible; Dinliminate/1.0; restaurant-photo)',
      ...headers
    },signal:ctl.signal});
    if(!result)throw new Error('Redirect validation failed.');
    const r=result.response;
    if(!r.ok)throw new Error('Image request failed ('+r.status+').');
    const type=(r.headers.get('content-type')||'image/jpeg').split(';')[0].toLowerCase();
    if(!type.startsWith('image/'))throw new Error('Image response was not an image.');
    if(type==='image/svg+xml'||type==='image/svg')throw new Error('SVG assets are not restaurant photos.');
    const bytes=Buffer.from(await r.arrayBuffer());
    if(bytes.length<4000)throw new Error('Image response was too small.');
    if(bytes.length>10*1024*1024)throw new Error('Image is too large.');
    const dimensions=imageDimensions(bytes,type);
    const width=Number(dimensions.width)||0,height=Number(dimensions.height)||0;
    if(width>MAX_RESTAURANT_IMAGE_DIMENSION||height>MAX_RESTAURANT_IMAGE_DIMENSION)throw new Error('Image dimensions are too large.');
    if(width&&height&&(width*height)>MAX_RESTAURANT_IMAGE_PIXELS)throw new Error('Image pixel count is too large.');
    if(width&&height&&mediaQuality(dimensions)<0)throw new Error('Image dimensions are not suitable for a restaurant card.');
    return await normalizeRestaurantImage(bytes);
  }finally{clearTimeout(timer)}
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
    candidates.push({url,context,source:'img',width,height});
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
    }catch{}
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

function structuredRestaurantMatches(html,name,address){
  const tokens=significantNameTokens(name);
  if(!tokens.length)return false;
  const addrNorm=normalizeMatchText(address);
  const addrNumber=(String(address||'').match(/\b\d{1,6}\b/)||[])[0];
  const zip=(String(address||'').match(/\b\d{5}(?:-\d{4})?\b/)||[])[0];
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
    try{if(inspect(JSON.parse(raw)))return true;}catch{}
  }
  return false;
}

function strictPageMatchesRestaurant(html,name,address){
  const source=String(html||'');
  const hay=normalizeMatchText(source.slice(0,1400000));
  const tokens=significantNameTokens(name);
  if(!tokens.length)return false;
  const nameHitCount=tokens.filter(t=>hay.includes(t)).length;
  if(nameHitCount/tokens.length<0.9)return false;
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

function pageMatchesRestaurant(html,name,address){
  const source=String(html||'');
  if(structuredRestaurantMatches(source,name,address))return true;
  const hay=normalizeMatchText(source.slice(0,1400000));
  const tokens=significantNameTokens(name);
  if(!tokens.length)return false;
  const hits=tokens.filter(t=>hay.includes(t)).length;
  if(hits/tokens.length<0.8)return false;
  const number=(String(address||'').match(/\b\d{1,6}\b/)||[])[0];
  if(number&&hay.includes(normalizeMatchText(number)))return true;
  const loc=normalizeMatchText(address).split(' ').filter(t=>t.length>=3).slice(-5);
  return loc.filter(t=>hay.includes(t)).length>=2;
}

async function verifiedRestaurantPage(url,name,address){
  const page=absoluteHttpsUrl(url);
  if(!page||isBlockedHost(page))return null;
  try{
    const html=await fetchText(page,{},6000,1800000);
    return strictPageMatchesRestaurant(html,name,address)?html:null;
  }catch{return null}
}

function venueScore(candidate,name,address,website){
  const context=String(candidate?.context||'')+' '+String(candidate?.url||'');
  const hay=normalizeMatchText(context);
  const nameTokens=significantNameTokens(name);
  const matchedName=nameTokens.filter(t=>hay.includes(t)).length;
  const addrNumber=(String(address||'').match(/\b\d{1,6}\b/)||[])[0];
  const venueHits=(normalizeMatchText(context).match(/exterior|outside|outdoor|front|entrance|entry|building|storefront|facade|sign|signage|location|drive thru|parking lot|parking|street view|patio|terrace/g)||[]).length;
  const foodHits=(normalizeMatchText(context).match(/menu|food|dish|meal|burger|pizza|salad|steak|wings|tacos|sushi|pasta|chicken|fries|dessert|cake|sandwich|plate|entree|appetizer|breakfast|lunch|dinner|drink|cocktail|coffee|beer|wine/g)||[]).length;
  let score=0;
  score+=matchedName*24;
  if(nameTokens.length&&matchedName===nameTokens.length)score+=70;
  if(addrNumber&&hay.includes(normalizeMatchText(addrNumber)))score+=34;
  if(VENUE_IMAGE_HINTS.test(context))score+=Math.min(90,venueHits*22);
  if(FOOD_IMAGE_HINTS.test(context))score-=Math.min(120,foodHits*24);
  if(candidate.source==='img')score+=8;
  if(candidate.source==='background')score+=3;
  if(LOW_QUALITY_IMAGE_HINTS.test(String(candidate?.url||'')))score-=28;
  const websiteHost=hostOf(website);
  const candidateHost=hostOf(candidate.url);
  if(websiteHost&&candidateHost&&(candidateHost===websiteHost||candidateHost.endsWith('.'+websiteHost)))score+=18;
  return score;
}

function hasVenueSignal(candidate){
  const context=String(candidate?.context||'');
  if(!context.trim())return false;
  // The page itself has already been verified as the exact restaurant/location.
  // For page-level image metadata (og:image / JSON-LD), that verification is
  // sufficient; forcing venue words into the image tag context rejects many
  // legitimate restaurant hero photos.
  if(candidate?.source==='meta'||candidate?.source==='jsonld')return true;
  const hay=normalizeMatchText(context);
  const venueHits=(hay.match(/exterior|outside|outdoor|front|entrance|entry|building|storefront|facade|sign|signage|location|drive thru|parking lot|parking|street view|patio|terrace/g)||[]).length;
  const foodHits=(hay.match(/menu|food|dish|meal|burger|pizza|salad|steak|wings|tacos|sushi|pasta|chicken|fries|dessert|cake|sandwich|plate|entree|appetizer|breakfast|lunch|dinner|drink|cocktail|coffee|beer|wine/g)||[]).length;
  // Require venue evidence, but allow normal restaurant-page copy around a
  // real venue photo instead of rejecting it because the page mentions food.
  return venueHits>=1 && foodHits <= (venueHits*3+4);
}

function extractVenueImageCandidates(html,pageUrl,name,address,website){
  const raw=[
    ...extractImgCandidates(html,pageUrl),
    ...extractStyleImageCandidates(html,pageUrl),
    ...extractJsonLdImageCandidates(html,pageUrl)
  ];
  const meta=extractMetaImages(html,pageUrl).map(url=>({url,context:url+' '+normalizeMatchText(name)+' restaurant',source:'meta'}));
  const seen=new Set();
  const all=[...raw,...meta].map(item=>({...item,score:venueScore(item,name,address,website)}))
    .filter(item=>{
      if(seen.has(item.url))return false;
      seen.add(item.url);
      return !BLOCKED_IMAGE_HINTS.test(item.url);
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
    }catch{}
  }
  return candidates;
}

function scoreImage(candidate,name,address,website){
  return venueScore({url:candidate?.contentUrl||'',context:[candidate?.title,candidate?.description,candidate?.hostPageUrl,candidate?.query].filter(Boolean).join(' '),source:'bing'},name,address,website)
      + (candidate?.hostPageUrl?12:0);
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

async function fetchVerifiedPages(urls,name,address){
  const results=await Promise.allSettled(urls.map(async url=>{
    const html=await verifiedRestaurantPage(url,name,address);
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
async function officialRestaurantPages(name,address,website){
  const official=absoluteHttpsUrl(website);
  if(!official||isBlockedHost(official))return [];
  try{
    const html=await fetchText(official,{},3000,1800000);
    const pages=[];
    const direct=pageMatchesRestaurant(html,name,address)?html:null;
    if(direct)pages.push({url:official,html:direct});
    const links=extractInternalLinks(html,official,name,address);
    const internal=await fetchVerifiedPages(links.slice(0,4),name,address);
    for(const item of internal)if(!pages.some(x=>sameHost(x.url,item.url)))pages.push(item);
    return pages.slice(0,12);
  }catch{return []}
}
async function fastOfficialVenuePhoto(name,address,website){
 const official=absoluteHttpsUrl(website);
 if(!official||isBlockedHost(official))return null;
 try{
  const html=await fetchText(official,{},2200,1800000);
  if(!html)return null;
  const candidates=extractVenueImageCandidates(html,official,name,address,official)
    .filter(item=>item.score>=45&&item.score>0&&hasVenueSignal(item))
    .slice(0,6);
  const attempts=await Promise.allSettled(candidates.map(async candidate=>{
   try{return {media:await fetchImage(candidate.url,{'Referer':official},2600),candidate};}catch{return null;}
  }));
  for(const hit of attempts){
   if(hit.status==='fulfilled'&&hit.value){
    return {media:hit.value.media,source:'official-fast-path',sourceUrl:official,sourceName:hostOf(official)};
   }
  }
 }catch{}
 return null;
}
const KNOWN_PUBLIC_PHOTO_PAGES=[
 {names:['excell bbq','excell bar b q','excell market bar b q','excell market and bbq'],url:'https://www.visitclarksvilletn.com/listing/excell-bar-b-q/128/'}
];
function knownPublicPhotoPage(name){
 const normalized=normalizeMatchText(name);
 const hit=KNOWN_PUBLIC_PHOTO_PAGES.find(entry=>entry.names.some(n=>normalized===normalizeMatchText(n)||normalized.includes(normalizeMatchText(n))||normalizeMatchText(n).includes(normalized)));
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
 }catch{}
 return null;
}
async function fastKnownPublicPhoto(name,address,website){
 const hint=knownPublicPhotoPage(name);
 if(!hint)return null;
 try{
  const html=await fetchText(hint,{},2200,1500000);
  if(!html||!pageMatchesRestaurant(html,name,address))return null;
  const candidates=extractVenueImageCandidates(html,hint,name,address,website)
    .filter(item=>item.score>=38&&item.score>0&&hasVenueSignal(item))
    .slice(0,5);
  const attempts=await Promise.allSettled(candidates.map(async candidate=>{
   try{return {media:await fetchImage(candidate.url,{'Referer':hint},2400),candidate};}catch{return null;}
  }));
  for(const hit of attempts){
   if(hit.status==='fulfilled'&&hit.value){
    return {media:hit.value.media,source:'known-public-venue-page',sourceUrl:hint,sourceName:hostOf(hint)};
   }
  }
 }catch{}
 return null;
}
async function findVerifiedRestaurantPages(name,address,website){
  const safeName=String(name||'').replace(/"/g,''),safeAddress=String(address||'').replace(/"/g,''),websiteHost=hostOf(website);
  // Official-site discovery is the primary web path. Do it before broader
  // search-engine work so a known restaurant website has first opportunity.
  const official=await officialRestaurantPages(name,address,website);

  const queries=[];
  // Prefer reputable local tourism/publication pages before broad global directories.
  // These pages are discovery sources; we still require exact restaurant/address
  // verification before accepting a photo.
  if(safeName&&safeAddress)queries.push('site:visitclarksvilletn.com "'+safeName+'" "'+safeAddress+'" restaurant');
  if(safeName&&safeAddress)queries.push('site:clarksvillenow.com "'+safeName+'" "'+safeAddress+'" restaurant');
  if(safeName&&safeAddress)queries.push('"'+safeName+'" "'+safeAddress+'" restaurant');
  if(safeName&&safeAddress)queries.push('site:tripadvisor.com "'+safeName+'" "'+safeAddress+'"');
  if(safeName&&safeAddress)queries.push('site:restaurantguru.com "'+safeName+'" "'+safeAddress+'"');

  const searchPages=await Promise.allSettled(
    queries.map(q=>fetchText('https://www.bing.com/search?'+new URLSearchParams({q,mkt:'en-US',first:'1'}).toString(),{},2500,450000))
  );
  const candidates=[];
  for(const page of searchPages){
    if(page.status!=='fulfilled')continue;
    for(const url of extractBingWebResultUrls(page.value)){
      if(!candidates.includes(url))candidates.push(url);
    }
  }
  const verified=await fetchVerifiedPages(candidates.slice(0,8),name,address);
  const officialFromSearch=verified.filter(x=>websiteHost&&sameHost(x.url,websiteHost));
  const publicPages=verified.filter(x=>!websiteHost||!sameHost(x.url,websiteHost));
  const officialMerged=[...official,...officialFromSearch]
    .filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i)
    .slice(0,8);
  return {official:officialMerged,public:publicPages.slice(0,8)};
}

async function bingExactImageCandidates(name,address,website){
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
  }).map(x=>({...x,score:scoreImage(x,name,address,website)})).filter(x=>x.score>=55);
  return candidates.sort((a,b)=>b.score-a.score).slice(0,20);
}

async function exactImageFromBing(name,address,website){
  const candidates=await bingExactImageCandidates(name,address,website);
  const checks=await Promise.allSettled(candidates.slice(0,6).map(async candidate=>{
    const hostPage=candidate.hostPageUrl;
    if(hostPage){
      const verified=await verifiedRestaurantPage(hostPage,name,address);
      if(!verified)return null;
    }
    try{
      const media=await fetchImage(candidate.contentUrl,{'Referer':hostPage||undefined},4000);
      return {media,source:'exact-public-venue-image',sourceUrl:hostPage||candidate.contentUrl,sourceName:hostOf(hostPage||candidate.contentUrl)};
    }catch{return null}
  }));
  for(const result of checks)if(result.status==='fulfilled'&&result.value)return result.value;
  return null;
}
function sendMedia(res,found){
  res.setHeader?.('Content-Type',found.media.type);
  res.setHeader?.('Cache-Control','public, max-age=604800, stale-while-revalidate=2592000');
  res.setHeader?.('X-Content-Type-Options','nosniff');
  res.setHeader?.('X-Restaurant-Photo-Source',found.source);
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
  const q=req?.query&&typeof req.query==='object'?req.query:(req?.queryStringParameters||{});
  const name=String(q.name||'').trim().slice(0,160);
  const address=String(q.address||'').trim().slice(0,240);
  const website=String(q.website||'').trim().slice(0,700);
  const officialWebsite=String(q.officialWebsite||website).trim().slice(0,700);
  const osmImage=String(q.osmImage||'').trim().slice(0,1200);
  const osmExact=q.osmExact==='1';
  if(!name)return json(res,400,{ok:false,error:'Restaurant name is required'});
  try{
    // Tier 1: exact OSM POI photo. It is trusted as exact-venue evidence,
    // but we still validate the image itself for usable dimensions.
    if(osmExact&&/^https:\/\//i.test(osmImage)&&!isBlockedHost(osmImage)&&!BLOCKED_IMAGE_HINTS.test(osmImage)){
      try{
        const media=await fetchImage(osmImage,{'Referer':'https://www.openstreetmap.org/'},3500);
        return sendMedia(res,{media,source:'osm-exact-poi'});
      }catch{}
    }

    // Fast path: when an official website is already known, inspect the
    // homepage first and try its strongest venue images immediately. This
    // avoids waiting for broader search/verification work in the common case.
    if(officialWebsite){
      const fastOfficial=await fastOfficialVenuePhoto(name,address,officialWebsite);
      if(fastOfficial)return sendMedia(res,fastOfficial);
    }

    const fastKnownRestaurant=await fastKnownRestaurantPhoto(name,address);
    if(fastKnownRestaurant)return sendMedia(res,fastKnownRestaurant);

    const fastKnown=await fastKnownPublicPhoto(name,address,officialWebsite);
    if(fastKnown)return sendMedia(res,fastKnown);

    const pages=await findVerifiedRestaurantPages(name,address,officialWebsite);

    // Tier 1: exact restaurant/location images from the restaurant's own website.
    for(const entry of pages.official){
      const candidates=extractVenueImageCandidates(entry.html,entry.url,name,address,officialWebsite)
        .filter(item=>item.score>=65&&item.score>0&&hasVenueSignal(item));
      const attempts=await Promise.allSettled(candidates.slice(0,8).map(async candidate=>{
        try{return {media:await fetchImage(candidate.url,{'Referer':entry.url},4000)}}catch{return null}
      }));
      for(const hit of attempts)if(hit.status==='fulfilled'&&hit.value){
        return sendMedia(res,{media:hit.value.media,source:'official-venue-page',sourceUrl:entry.url,sourceName:hostOf(entry.url)});
      }
    }

    // Tier 3: exact-location image discovered by Bing Images, but only when
    // the image's host page verifies this exact restaurant and address.
    const bingImage=await exactImageFromBing(name,address,officialWebsite);
    if(bingImage)return sendMedia(res,bingImage);

    // Tier 4: the image already attached to the exact OSM POI.
    if(osmExact&&/^https:\/\//i.test(osmImage)&&!isBlockedHost(osmImage)&&!BLOCKED_IMAGE_HINTS.test(osmImage)){
      try{
        const media=await fetchImage(osmImage,{'Referer':'https://www.openstreetmap.org/'},4000);
        return sendMedia(res,{media,source:'osm-exact-poi'});
      }catch{}
    }


    // Tier 2: exact-location public restaurant pages.
    for(const entry of pages.public){
      const candidates=extractVenueImageCandidates(entry.html,entry.url,name,address,officialWebsite)
        .filter(item=>item.score>=65&&item.score>0&&hasVenueSignal(item));
      const attempts=await Promise.allSettled(candidates.slice(0,8).map(async candidate=>{
        try{return {media:await fetchImage(candidate.url,{'Referer':entry.url},4000)}}catch{return null}
      }));
      for(const hit of attempts)if(hit.status==='fulfilled'&&hit.value){
        return sendMedia(res,{media:hit.value.media,source:'exact-public-venue-page',sourceUrl:entry.url,sourceName:hostOf(entry.url)});
      }
    }

    return json(res,404,{ok:false,error:'No verified venue photo was found from the allowed non-Google sources'});
  }catch(e){
    console.error('dinliminate-restaurant-photo',e);
    return json(res,502,{ok:false,error:'Could not load the restaurant photo'});
  }
};

module.exports._test={
  absoluteHttpsUrl,
  extractMetaImages,
  extractBingWebResultUrls,
  extractJsonLdImageCandidates,
  extractImgCandidates,
  extractVenueImageCandidates,
  pageMatchesRestaurant,
  venueScore,
  hasVenueSignal,
  extractInternalLinks,
  sameHost,
  structuredRestaurantMatches,
  bingExactImageCandidates,
  exactImageFromBing,
  fastOfficialVenuePhoto,
  knownRestaurantPhoto,
  fastKnownRestaurantPhoto,
  knownPublicPhotoPage,
  fastKnownPublicPhoto,
  imageDimensions,
  mediaQuality,
  fetchImage,
  normalizeRestaurantImage
};