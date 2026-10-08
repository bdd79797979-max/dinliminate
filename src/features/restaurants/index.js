import { state as S } from '../../state/store.js';
import { $ } from '../../ui/dom.js';
import { esc } from '../../ui/esc.js';
import RESTAURANT_TAXONOMY from '../../data/restaurant-taxonomy.js';
import { save } from '../../state/storage.js';
import { imageProxyUrl, bindImageFallbackAttrs, swapImageWhenReady, setRestaurantPhotoCredit, prefetchRestaurantPhotos, clearDecisionHistory, updateDecisionBackButtons, pushDecisionHistory, captureRestaurantDecisionState, restoreRestaurantDecisionState, legacyRestaurantBack, show, familyNormalBar, familyIsBrowseStage, familyBrowseNext, familyBrowsePrevious, familyBrowseBack, familyRoundStage } from '../../main.js';
import { dismissSwipeHint, maybeShowInCardSwipeCoach, stageSwipePreview, waitForVisualImage, bindRestaurantPhotoPinch } from '../swipe/index.js';
import { renderMaybeDeckToggle, bindMaybeDeckToggle, renderRestaurantHours, bindRestaurantHours, renderQuickCutsCollapse, bindQuickCutsCollapse, mealTimesFor, ensureMealTimeSettings, mealTimeCatalog, mealTimeOptions, mealTimeNames, syncMealTimeReferences, foodBasePool, buildFood, renderMealTimeCuts, foodQuick } from '../meals/index.js';
import { triggerSwipeHaptic, bindSwipeCard } from '../swipe/index.js';
import { openModal } from '../../ui/modal.js';

let restaurantBackBusy=false;
const REST_QUICK_IMAGES = {
'Fast Food':'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=85',
Southern:'https://images.pexels.com/photos/2397401/pexels-photo-2397401.jpeg?auto=compress&cs=tinysrgb&w=900',
Burgers:'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=85',
Pizza:'https://images.unsplash.com/photo-1579684947550-22e945225d9a?auto=format&fit=crop&w=900&q=85',
Mexican:'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=85',
American:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=85',
Italian:'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=85',
Asian:'https://images.pexels.com/photos/32845321/pexels-photo-32845321.jpeg?auto=compress&cs=tinysrgb&w=900',
Indian:'https://images.unsplash.com/photo-1680993032090-1ef7ea9b51e5?auto=format&fit=crop&w=900&q=85',
Mediterranean:'https://images.unsplash.com/photo-1743674453093-592bed88018e?auto=format&fit=crop&w=900&q=85',
BBQ:'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=85',
Seafood:'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?auto=format&fit=crop&w=900&q=85',
Breakfast:'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=900&q=85'
};

function milesBetween(lat1,lon1,lat2,lon2){
 const a=Number(lat1),b=Number(lon1),c=Number(lat2),d=Number(lon2);
 if(![a,b,c,d].every(Number.isFinite))return NaN;
 const R=3958.7613,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p,z=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;
 return 2*R*Math.asin(Math.sqrt(z));
}
function restaurantAddressFamily(value){
 const replacements={
  street:'st',road:'rd',avenue:'ave',boulevard:'blvd',drive:'dr',lane:'ln',parkway:'pkwy',highway:'hwy',route:'rte',
  circle:'cir',court:'ct',place:'pl',trail:'trl',terrace:'ter',north:'n',south:'s',east:'e',west:'w',
  alabama:'al',alaska:'ak',arizona:'az',arkansas:'ar',california:'ca',colorado:'co',connecticut:'ct',delaware:'de',
  florida:'fl',georgia:'ga',hawaii:'hi',idaho:'id',illinois:'il',indiana:'in',iowa:'ia',kansas:'ks',kentucky:'ky',
  louisiana:'la',maine:'me',maryland:'md',massachusetts:'ma',michigan:'mi',minnesota:'mn',mississippi:'ms',
  missouri:'mo',montana:'mt',nebraska:'ne',nevada:'nv','new-hampshire':'nh',newhampshire:'nh','new-jersey':'nj',
  newjersey:'nj','new-mexico':'nm',newmexico:'nm','new-york':'ny',newyork:'ny',northcarolina:'nc',
  'north-carolina':'nc','north-dakota':'nd',northdakota:'nd',ohio:'oh',oklahoma:'ok',oregon:'or',
  pennsylvania:'pa',rhodeisland:'ri','rhode-island':'ri',southcarolina:'sc','south-carolina':'sc',
  'south-dakota':'sd',southdakota:'sd',tennessee:'tn',tn:'tn',texas:'tx',utah:'ut',vermont:'vt',virginia:'va',
  washington:'wa',westvirginia:'wv','west-virginia':'wv',wisconsin:'wi',wyoming:'wy',
  'district-of-columbia':'dc',districtcolumbia:'dc',dc:'dc'
 };
 return normKey(value).split(' ').map(x=>replacements[x]||x).join(' ').replace(/\b(?:usa|united states)\b/g,'').replace(/\s+/g,' ').trim();
}
function restaurantNameTokensUI(value){
 const text=normKey(String(value||'').replace(/[’']s\b/gi,'s'))
   .replace(/\bbar\s+b\s+q\b/g,'bbq')
   .replace(/\bbarbecue\b/g,'bbq')
   .replace(/\bb\s+q\b/g,'bbq');
 return text.split(' ').filter(Boolean);
}
function restaurantNameFamily(value){return restaurantNameTokensUI(value).join(' ');}
const RESTAURANT_NAME_GENERIC_UI=new Set([
 'market','markets','bar','bars','bbq','barbecue','bq','restaurant','restaurants','grill','grills',
 'kitchen','cafe','café','coffee','house','food','foods','eatery','deli','bakery','pizza','pizzeria'
]);
function restaurantNameCoreTokensUI(value){
 return restaurantNameTokensUI(value).filter(t=>t.length>=4&&!RESTAURANT_NAME_GENERIC_UI.has(t));
}
function restaurantNameCoreMatchUI(a,b){
 const aa=new Set(restaurantNameCoreTokensUI(a)),bb=new Set(restaurantNameCoreTokensUI(b));
 if(!aa.size||!bb.size)return false;
 return [...aa].some(t=>bb.has(t));
}
function restaurantNameSimilarityUI(a,b){
 const aa=restaurantNameTokensUI(a),bb=restaurantNameTokensUI(b);
 if(!aa.length||!bb.length)return 0;
 const as=new Set(aa),bs=new Set(bb);
 const shared=[...as].filter(t=>bs.has(t)).length;
 const shorter=Math.min(as.size,bs.size),union=new Set([...as,...bs]).size;
 if(!shared||!shorter||!union)return restaurantNameCoreMatchUI(a,b)?1:0;
 const coverage=shared/shorter,jaccard=shared/union;
 return coverage>=0.75&&jaccard>=0.60?Math.max(coverage,jaccard):(restaurantNameCoreMatchUI(a,b)?1:0);
}
function restaurantAddressKeyUI(value){
 const raw=restaurantAddressFamily(value);
 if(!raw)return '';
 const tokens=raw.split(' ').filter(Boolean);
 const number=(tokens[0]||'').match(/^\d+[a-z]?$/i)?.[0]||'';
 const streetTokens=[];
 const suffixes=new Set(['st','rd','ave','blvd','dr','ln','pkwy','hwy','rte','cir','ct','pl','trl','ter','way']);
 const begin=number?1:0;
 for(let i=begin;i<tokens.length&&streetTokens.length<6;i++){
   streetTokens.push(tokens[i]);
   if(suffixes.has(tokens[i]))break;
 }
 return number&&streetTokens.length ? number+'|'+streetTokens.join(' ') : streetTokens.join(' ');
}
function restaurantAddressSimilarityUI(a,b){
 const ax=restaurantAddressFamily(a),bx=restaurantAddressFamily(b);
 if(!ax||!bx)return 0;
 if(ax===bx)return 1;
 const ka=restaurantAddressKeyUI(a),kb=restaurantAddressKeyUI(b);
 if(ka&&kb&&ka===kb)return 0.90;
 const sa=restaurantStreetFamily(a),sb=restaurantStreetFamily(b);
 if(sa&&sb&&sa===sb)return 0.72;
 const at=ax.split(' '),bt=bx.split(' '),shared=at.filter(t=>bt.includes(t)).length;
 const coverage=shared/Math.min(at.length,bt.length);
 return coverage>=0.80?0.80:0;
}
function restaurantStreetFamily(value){
 const raw=restaurantAddressFamily(value);
 if(!raw)return '';
 const first=raw.split(',')[0].trim();
 const tokens=first.split(' ').filter(Boolean);
 const start=/^\d+[a-z]?$/i.test(tokens[0]||'')?1:0;
 return tokens.slice(start,start+5).join(' ').trim();
}
function addressHasStreetNumber(value){return /^\s*\d+[a-z]?\b/i.test(String(value||''));}
const RESTAURANT_NAME_VARIANT_BLOCKERS_UI=new Set(['express','grill','kitchen','cafe','coffee','bar','deli','bakery','shop','and','at','inside','food','foods','eatery','restaurant','restaurants']);
function restaurantNameVariantMatchUI(a,b){
 const score=restaurantNameSimilarityUI(a,b);
 return score>=0.60;
}
function restaurantPhotoQualityScore(row){
 const confidence=Number(row?.photoConfidence);
 if(Number.isFinite(confidence))return confidence;
 const source=String(row?.photoSource||'').toLowerCase();
 if(source==='google-places')return 0.95;
 if(source==='provider')return 0.85;
 if(source==='known-entity')return 0.55;
 if(source==='cuisine-fallback')return 0.4;
 if(source==='generic-fallback')return 0.2;
 return /^https:\/\//i.test(String(row?.photo||''))?0.8:0;
}

function dedupeRestaurantPool(rows){
 const out=[];
 for(const row of (rows||[])){
  if(!row)continue;
  const name=restaurantNameFamily(row.name),address=restaurantAddressFamily(row.address||'');
  const phone=String(row.phone||'').replace(/\D/g,'').slice(-10),website=String(row.website||'').toLowerCase().replace(/^https?:\/\/(?:www\.)?/,'').replace(/\/$/,'');
  const lat=Number(row.lat),lon=Number(row.lon);
  let match=out.find(x=>{
   const xn=restaurantNameFamily(x.name),xa=restaurantAddressFamily(x.address||'');
   const xp=String(x.phone||'').replace(/\D/g,'').slice(-10),xw=String(x.website||'').toLowerCase().replace(/^https?:\/\/(?:www\.)?/,'').replace(/\/$/,'');
   const dist=milesBetween(x.lat,x.lon,lat,lon);
   const sameName=!!name&&name===xn;
   const nameScore=restaurantNameSimilarityUI(name,xn);
   const sameNameFamily=sameName||nameScore>=0.60;
   const sameAddrScore=restaurantAddressSimilarityUI(address,xa);
   const sameAddr=sameAddrScore>=0.90;
   const sameStreet=sameAddrScore>=0.72;
   const samePhysical=Number.isFinite(dist)&&dist<=0.15;
   const coreNameMatch=restaurantNameCoreMatchUI(name,xn);
   const sameAddressAndName=sameAddr&&(sameNameFamily||coreNameMatch);
   const sameStreetAndName=sameStreet&&(sameNameFamily||coreNameMatch)&&samePhysical;
   const sameNearbyAndName=samePhysical&&sameNameFamily&&(!address||!xa);
   const identityKey=RESTAURANT_TAXONOMY.restaurantIdentityKey(row);
   const existingIdentityKey=RESTAURANT_TAXONOMY.restaurantIdentityKey(x);
   const sameCanonicalIdentity=!!identityKey&&identityKey===existingIdentityKey&&samePhysical;
   const sameContact=(phone&&xp&&phone===xp)||(website&&xw&&website===xw);
   const strongContact=sameContact&&samePhysical;
   return sameAddressAndName
     || sameStreetAndName
     || sameNearbyAndName
     || sameCanonicalIdentity
     || strongContact;
  });
  if(!match){
    const inferred=RESTAURANT_TAXONOMY.classifyRestaurant(row);
    out.push({...row,category:(inferred.primary||row.category||'American'),quickCutTags:[...new Set([...(row.quickCutTags||[]),...inferred.tags])]});
    continue;
  }
  match.fastFood=match.fastFood||row.fastFood;
  if(typeof row.openNow==='boolean' && typeof match.openNow!=='boolean')match.openNow=row.openNow;
  if(restaurantPhotoQualityScore(row)>restaurantPhotoQualityScore(match)){
    if(row.photo)match.photo=row.photo;
    if(row.photoFallback)match.photoFallback=row.photoFallback;
    if(row.photoSource)match.photoSource=row.photoSource;
    if(Number.isFinite(Number(row.photoConfidence)))match.photoConfidence=Number(row.photoConfidence);
    if(typeof row.photoIsGeneric==='boolean')match.photoIsGeneric=row.photoIsGeneric;
    if(row.googlePlaceId)match.googlePlaceId=row.googlePlaceId;
  }
  for(const key of ['address','phone','website','opening_hours','photo','cuisine','brand','operator'])if(!match[key]&&row[key])match[key]=row[key];
  match.menuItems=[...new Set([...(Array.isArray(match.menuItems)?match.menuItems:[]),...(Array.isArray(row.menuItems)?row.menuItems:[])])].slice(0,10);
  match.quickCutTags=[...new Set([...(match.quickCutTags||[]),...(row.quickCutTags||[]),...RESTAURANT_TAXONOMY.classifyRestaurant({...match,...row}).tags])];
  const inferred=RESTAURANT_TAXONOMY.classifyRestaurant({...match,...row});
  if(!match.category || /^(restaurant|eatery|food)$/i.test(String(match.category)))match.category=inferred.primary||'American';
  match.distance=Math.min(Number(match.distance)||Infinity,Number(row.distance)||Infinity);
 }
 return out.sort((a,b)=>Number(a.distance)-Number(b.distance));
}
function restaurantCanonicalId(row){
const name=normKey(row?.name);
const address=normKey(row?.address);
const geo=(Number.isFinite(Number(row?.lat))&&Number.isFinite(Number(row?.lon))) ? Number(row.lat).toFixed(4)+'-'+Number(row.lon).toFixed(4) : '';
return 'restaurant-'+(name+'|'+(address||geo)).replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,150);
}
function restaurantHidden(row){
if(!row)return false;
if(S.hiddenRestaurants[row.id] || (row.canonicalId && S.hiddenRestaurants[row.canonicalId]))return true;
const targetName=normKey(row.name),targetAddr=normKey(row.address),targetCanonical=row.canonicalId||restaurantCanonicalId(row);
return Object.values(S.hiddenRestaurants||{}).some(x=>{
if(x.canonicalId && x.canonicalId===targetCanonical)return true;
if(normKey(x.name)!==targetName)return false;
if(targetAddr&&normKey(x.address)===targetAddr)return true;
if(x.lat!=null&&x.lon!=null&&row.lat!=null&&row.lon!=null){
const dlat=Math.abs(Number(x.lat)-Number(row.lat)),dlon=Math.abs(Number(x.lon)-Number(row.lon));
return dlat<0.001&&dlon<0.001;
}
return false;
});
}
function restaurantSearchText(row){
 return [
  row?.name,row?.brand,row?.operator,row?.category,row?.cuisine,
  restaurantCategory(row),
  ...(Array.isArray(row?.menuItems)?row.menuItems:[])
 ].filter(Boolean).join(' ');
}
const normalizeRestaurantSearch = RESTAURANT_TAXONOMY.normalizeRestaurantSearch;
const restaurantIdentityHay = RESTAURANT_TAXONOMY.identityHay;
function restaurantIsFastFood(row){
 return RESTAURANT_TAXONOMY.isFastFood(row);
}
function restaurantCuisineTags(row){
 const preset=Array.isArray(row?.quickCutTags)?row.quickCutTags:[];
 const inferred=RESTAURANT_TAXONOMY.classifyRestaurant(row).tags;
 return inferred.length ? inferred : [...new Set(preset)];
}
function restaurantCuisineEvidence(row){
 return RESTAURANT_TAXONOMY.classifyRestaurant(row).evidence;
}
function restaurantCategory(row){
 const inferred=RESTAURANT_TAXONOMY.classifyRestaurant(row);
 if(inferred.primary)return inferred.primary;
 const tags=restaurantCuisineTags(row),raw=String(row?.category||'').trim();
 if(/^(American|Mexican|Asian|Italian|Southern|BBQ|Seafood|Breakfast|Burgers|Fast Food)$/i.test(raw))return raw;
 const order=['Burgers','Pizza','Mexican','Asian','Italian','BBQ','Seafood','Breakfast','Southern','Fast Food','American'];
 for(const label of order) if(tags.includes(label)) return label;
 const providerRaw=RESTAURANT_TAXONOMY.normalizeRestaurantSearch([row?.cuisine,row?.category,row?.providerType,row?.primaryType,row?.types?.join?.(' ')].join(' '));
 const nameRaw=RESTAURANT_TAXONOMY.normalizeRestaurantSearch([row?.name,row?.brand,row?.operator].join(' '));
 const fallback=[
  ['Pizza',/\b(pizza|pizzeria|calzone)\b/],
  ['Mexican',/\b(mexican|taco|burrito|taqueria|enchilada|quesadilla|fajita)\b/],
  ['Asian',/\b(asian|chinese|japanese|thai|korean|sushi|ramen|pho|hibachi|teriyaki)\b/],
  ['Italian',/\b(italian|pasta|spaghetti|lasagna|ravioli|trattoria|ristorante)\b/],
  ['BBQ',/\b(bbq|barbecue|smokehouse|brisket|ribs|pulled pork)\b/],
  ['Seafood',/\b(seafood|fish house|catfish|shrimp|crab|lobster|oyster|salmon)\b/],
  ['Breakfast',/\b(breakfast|brunch|pancake|waffle|omelet|eggs benedict|biscuits and gravy)\b/],
  ['Burgers',/\b(burger|hamburger|cheeseburger|smashburger)\b/],
  ['Southern',/\b(southern|soul food|country cooking|meat and three|comfort food)\b/],
  ['American',/\b(diner|steakhouse|roadhouse|grill|bistro|pub|tavern|american)\b/]
 ];
 for(const [label,re] of fallback)if(re.test(nameRaw)||re.test(providerRaw))return label;
 return raw&&/^(restaurant|eatery|food)$/i.test(raw)?'American':(raw||'American');
}
function restaurantQuickMatches(row,label){
 const wanted=String(label||'').trim().toLowerCase();
 if(!wanted)return false;
 const tags=restaurantCuisineTags(row).map(x=>String(x||'').trim().toLowerCase());
 const category=String(restaurantCategory(row)||'').trim().toLowerCase();
 return tags.includes(wanted)||category===wanted;
}

function restaurantCategorySearchMatches(row,tag){
 const tags=restaurantCuisineTags(row);
 if(tag==='Burgers')return tags.includes('Burgers')||tags.includes('Fast Food');
 return tags.includes(tag);
}
function restaurantSearchTermMatches(row,term,hay){
 const normalized=normalizeRestaurantSearch(term);
 if(!normalized)return true;
 const classification=RESTAURANT_TAXONOMY.restaurantSearchClassification(normalized);
 if(classification.kind==='category'&&classification.tag) return restaurantCategorySearchMatches(row,classification.tag);
 const words=normalized.split(' ').filter(Boolean);
 if(words.length===1 && ['restaurant','restaurants','place','places'].includes(words[0]))return true;
 return words.every(word=>hay.includes(word));
}
function restaurantMatchesQuery(row){
 const q=String(S.restaurantQuery||'').trim();
 if(!q)return true;
 const classification=RESTAURANT_TAXONOMY.restaurantSearchClassification(q);
 if(classification.kind==='category'&&classification.tag)return restaurantCategorySearchMatches(row,classification.tag);
 const hay=normalizeRestaurantSearch(restaurantSearchText(row));
 return q.split(/\s+/).filter(Boolean).every(term=>restaurantSearchTermMatches(row,term,hay));
}

function restaurantClockParts(row){
  const timeZone=String(row?.hoursTimeZone||S.restaurantSearchTimeZone||'').trim();
  if(timeZone){
    try{
      const parts=new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
      const pick=type=>String(parts.find(p=>p.type===type)?.value||'');
      const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
      const day=dayMap[pick('weekday')];
      const hour=Number(pick('hour')),minute=Number(pick('minute'));
      if(Number.isFinite(day)&&Number.isFinite(hour)&&Number.isFinite(minute))return {day,minute:hour*60+minute,timeZone};
    }catch(error){console.error('Dinliminate error',error)}
  }
  const now=new Date();
  return {day:now.getDay(),minute:now.getHours()*60+now.getMinutes(),timeZone:''};
}
function restaurantHoursState(row){
  if(typeof row?.openNow==='boolean')return row.openNow?'open':'closed';
  const status=String(row?.businessStatus||'').toUpperCase();
  if(status==='CLOSED_PERMANENTLY'||status==='CLOSED_TEMPORARILY')return 'closed';
  const raw=String(row?.opening_hours||'').trim();
  if(!raw)return 'unknown';
  if(/\b(?:24\s*\/\s*7|24\s*hours?)\b/i.test(raw))return 'open';

   const {day,minute}=restaurantClockParts(row);
  const dayNames=[['Su','Sun','Sunday'],['Mo','Mon','Monday'],['Tu','Tue','Tuesday'],['We','Wed','Wednesday'],['Th','Thu','Thursday'],['Fr','Fri','Friday'],['Sa','Sat','Saturday']];
  const aliases=new Map();
  dayNames.forEach((list,index)=>list.forEach(name=>aliases.set(name.toLowerCase(),index)));

  const appliesToDay=(selector,targetDay)=>{
    const s=String(selector||'').trim();
    if(!s)return true;
    const normalized=s.replace(/[–—−]/g,'-').replace(/\s+/g,' ');
    const ranges=[...normalized.matchAll(/\b(Su|Mo|Tu|We|Th|Fr|Sa|Sun|Mon|Tue|Wed|Thu|Fri|Sat|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s*-\s*(Su|Mo|Tu|We|Th|Fr|Sa|Sun|Mon|Tue|Wed|Thu|Fri|Sat|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/gi)];
    for(const m of ranges){
      const a=aliases.get(m[1].toLowerCase()),b=aliases.get(m[2].toLowerCase());
      if(a==null||b==null)continue;
      if(a<=b ? targetDay>=a&&targetDay<=b : targetDay>=a||targetDay<=b)return true;
    }
    const tokens=normalized.match(/\b(?:Su|Mo|Tu|We|Th|Fr|Sa|Sun|Mon|Tue|Wed|Thu|Fri|Sat|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/gi)||[];
    return tokens.some(token=>aliases.get(token.toLowerCase())===targetDay);
  };

  const parseTime=(value,hint='')=>{
    const m=String(value||'').trim().toUpperCase().replace(/\s+/g,'').match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)?$/);
    if(!m)return NaN;
    let hour=Number(m[1]),mins=Number(m[2]||0),ampm=m[3]||hint;
    if(mins>59)return NaN;
    if(ampm){
      if(hour<1||hour>12)return NaN;
      hour=ampm==='AM'?(hour===12?0:hour):(hour===12?12:hour+12);
    }else if(hour>23)return NaN;
    return hour*60+mins;
  };

  const timeRe=/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-–—]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i;
  const clauses=raw.split(/\s*[;·•]\s*/).map(x=>x.trim()).filter(Boolean);
  const intervals=[];
  let applicable=false,sawClosed=false;

   const collect=(clause,targetDay)=>{
     const matches=[...String(clause||'').matchAll(new RegExp(timeRe.source,'gi'))];
     const selector=matches.length?String(clause||'').slice(0,matches[0].index).trim():String(clause||'').trim();
     if(!appliesToDay(selector,targetDay))return;
     applicable=true;
     if(/\b(?:off|closed)\b/i.test(clause)&&!matches.length){sawClosed=true;return;}
     if(!matches.length)return;
     for(const tm of matches){
       const startHasMeridiem=/\b(?:AM|PM)\b/i.test(tm[1]);
       const endMeridiem=(tm[2].match(/AM|PM/i)||[])[0]||'';
       const start=parseTime(tm[1],!startHasMeridiem?endMeridiem:'');
       const end=parseTime(tm[2]);
       if(Number.isFinite(start)&&Number.isFinite(end))intervals.push({start,end,targetDay});
     }
   };

  for(const clause of clauses)collect(clause,day);
  const todayCount=intervals.length;

  for(let i=todayCount;i<todayCount+clauses.length;i++){}
  const previousDay=(day+6)%7;
  const previousIntervals=[];
  const originalIntervals=intervals.length;
  for(const clause of clauses){
    const before=intervals.length;
    collect(clause,previousDay);
    if(intervals.length>before)previousIntervals.push(intervals[intervals.length-1]);
  }

  for(const interval of previousIntervals){
    if(interval.start>interval.end&&minute<=interval.end)return 'open';
  }
  for(let i=0;i<originalIntervals;i++){
    const interval=intervals[i];
    if(interval.start<=interval.end ? minute>=interval.start&&minute<=interval.end : minute>=interval.start||minute<=interval.end)return 'open';
  }
  return applicable&&sawClosed?'closed':(applicable?'closed':'unknown');
}
function restaurantHoursMatches(row){
  const mode=String(S.restaurantHours||'all')==='open'?'open':'all';
  return mode==='all'||restaurantHoursState(row)==='open';
}
function restaurantPoolHourFiltered(){return restaurantPoolBase().filter(restaurantHoursMatches);}
function restaurantChoiceIndex(rows,start,keepState=false){
 const len=rows.length;if(!len)return -1;
 for(let step=0;step<len;step++){const i=(start+step)%len;if(keepState?!!rows[i]._maybe:!rows[i]._maybe)return i;}
 return -1;
}
function restaurantPoolBase(){
 return (S.restaurantPool||[]).filter(row=>{
  if([...S.restaurantCuts].some(label=>restaurantQuickMatches(row,label)))return false;
  if(row._cut||row._hidden||restaurantHidden(row))return false;
  return restaurantMatchesQuery(row);
 });
}
function restaurantPoolFiltered(){
 // CP1214: photo readiness is presentation-only and cannot remove choices.
 const base=restaurantPoolHourFiltered();
 return S.maybeDeck ? base.filter(row=>row._maybe) : base;
}
function updateRestaurantStatus(){
 const el=$('status'); if(!el)return;
 const radius=Math.min(100,Math.max(1,Number(S.restaurantSearchRadius ?? $('radius')?.value)||10));
 const total=restaurantPoolHourFiltered().length,degraded=S.restaurantSearchDegraded;
 if(!total){
  el.textContent=degraded?'Restaurant sources are unavailable. Try again.':(S.restaurantHours==='open'?'No restaurants are open now in this radius.':'No restaurants match the current filters.');
  return;
 }
 const mode=S.restaurantHours==='open'?'open':'all';
 const modeLabel=mode==='open'?' · Open Now':'';
 el.textContent=total+' restaurant'+(total===1?'':'s')+' · '+radius+' mi'+modeLabel;
}

function restaurantQuick() {
 const labels=REST_QUICK;
 const existing=[...document.querySelectorAll('#restQuick [data-rest-quick]')].map(btn=>btn.dataset.restQuick);
 if(existing.length!==labels.length||existing.some((x,i)=>x!==labels[i])){
  $('restQuick').innerHTML = labels.map(label => {
   const src=imageProxyUrl(REST_QUICK_IMAGES[label] || REST_QUICK_IMAGES.American);
   return '<button class="chip photo-chip" data-rest-quick="'+esc(label)+'"><img class="quick-chip-photo" src="'+esc(src)+'" alt="'+esc(label)+' restaurant photo" draggable="false"><span>'+esc(label)+'</span></button>';
  }).join('');
  bindImageFallbackAttrs('[data-rest-quick] img');
 }
 document.querySelectorAll('#restQuick [data-rest-quick]').forEach(btn => {
  const label=btn.dataset.restQuick;
  btn.classList.toggle('cut',S.restaurantCuts.has(label));
  btn.onclick = () => {
   S.restaurantCuts.has(label) ? S.restaurantCuts.delete(label) : S.restaurantCuts.add(label);
   S.restaurantIndex=0;
   restaurantQuick();
   drawRestaurants();
   save();
  };
 });
 bindQuickCutsCollapse('restaurant');
}
function renderLocationSource(){
const el=$('locationSourceLabel'); if(!el)return;
const labels={device:'Using your location',last:'Last used location',address:'Using selected address',typed:'Address needs selection',none:'No location selected'};
el.textContent=labels[S.locationSource]||labels.none;
el.classList.toggle('is-ready',S.locationSource==='device'||S.locationSource==='address');
renderFindButton();
}
function displayRestaurantLocationLabel(value,originalQuery=''){
 const raw=String(value||'').trim().replace(/\s+/g,' ');
 const query=String(originalQuery||'').trim().replace(/\s+/g,' ');
 if(query && !addressLooksComplete(query)) return query;
 if(!raw)return query||'Current location';
 const parts=raw.split(',').map(x=>x.trim()).filter(Boolean);
 const stateIndex=parts.findIndex(x=>/^(Tennessee|TN|Kentucky|KY|Georgia|GA|Alabama|AL|Illinois|IL|Missouri|MO)$/i.test(x));
 if(stateIndex>=1){
  const stateMap={tennessee:'TN',tn:'TN',kentucky:'KY',ky:'KY',georgia:'GA',ga:'GA',alabama:'AL',al:'AL',illinois:'IL',il:'IL',missouri:'MO',mo:'MO'};
  const state=stateMap[parts[stateIndex].toLowerCase()]||parts[stateIndex];
  const city=parts[stateIndex-1];
  let street='';
  for(let i=0;i<stateIndex;i++){
    const p=parts[i];
    if(/^\d+[a-z]?$/i.test(p)&&parts[i+1]){street=p+' '+parts[i+1];break;}
    if(/^\d+\s+/i.test(p)){street=p;break;}
  }
  if(!street && stateIndex>=2 && !/^\d/.test(parts[stateIndex-2])) street=parts[stateIndex-2];
  if(street && city && street!==city)return street+', '+city+', '+state;
  if(city)return city+', '+state;
 }
 return parts.slice(0,3).join(', ');
}
function setLocation(lat, lon, label, source='address') {
S.location = {lat, lon, label};
S.locationSource = source;
if(source==='device')S.locationFreshAt=Date.now();
else S.locationFreshAt=null;
$('address').value = label || 'Current location';
renderLocationSource();
save();
}
let suggestController = null;
let restaurantSearchController = null;
let reverseLocationController = null;
let locationRequestActive = false;
let locationRequestSeq = 0;
function renderFindButton(){
 const btn=$('find');if(!btn)return;
 const hasSearchTarget=!!S.location || !!$('address')?.value.trim();
 const state=hasSearchTarget?'refresh':'find';
 const label=state==='refresh'?'Refresh restaurant search using this location and radius':'Find restaurants near the selected location';
 btn.dataset.state=state;
 btn.title=label;
 btn.innerHTML=state==='refresh'
  ? '<svg class="find-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 8.5V4.8l-2.2 2.2A7.5 7.5 0 1 0 19.2 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 4.8h-3.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sr-only">Refresh</span>'
  : '<svg class="find-icon find-locator-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21c4.2-4.8 6.4-8.2 6.4-11.3A6.4 6.4 0 0 0 5.6 9.7C5.6 12.8 7.8 16.2 12 21Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.2" fill="currentColor"/></svg><span class="sr-only">Find restaurants nearby</span>';
 btn.setAttribute('aria-label',label);
}
function setFindBusy(busy) {
const btn=$('find'); if(!btn)return;
btn.disabled=busy;
btn.setAttribute('aria-busy',String(busy));
const hasSearchTarget=!!S.location || !!$('address')?.value.trim();
 const state=busy?'busy':(hasSearchTarget?'refresh':'find');
btn.dataset.state=state;
btn.title=busy?'Searching for restaurants…':(state==='refresh'?'Refresh restaurant search using this location and radius':'Find restaurants near the selected location');
btn.innerHTML=busy
 ? '<span class="find-spinner" aria-hidden="true"></span><span class="sr-only">Searching</span>'
 : (state==='refresh'
   ? '<svg class="find-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 8.5V4.8l-2.2 2.2A7.5 7.5 0 1 0 19.2 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 4.8h-3.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sr-only">Refresh</span>'
   : '<svg class="find-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.8" cy="10.8" r="5.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15.2 15.2 4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sr-only">Find</span>');
}
function setLocationBusy(busy) {
const btn=$('locate');if(!btn)return;
btn.disabled=busy;
btn.setAttribute('aria-busy',String(busy));
const label=busy?'Getting your current location…':'Use your current location for nearby restaurants';
btn.setAttribute('aria-label',label);
btn.title=label;
}
function requestBrowserPosition(options={}) {
return new Promise((resolve,reject)=>{
 try{
  navigator.geolocation.getCurrentPosition(resolve,reject,options);
 }catch(err){reject(err);}
});
}
function locationMovedMiles(a,b) {
return milesBetween(a?.lat,a?.lon,b?.lat,b?.lon);
}
async function reverseLocationLabel(lat,lon,seq) {
reverseLocationController?.abort();
const ctl=new AbortController();
reverseLocationController=ctl;
const timer=setTimeout(()=>ctl.abort(),5000);
try{
const r=await fetch('/api/restaurants?mode=reverse&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon),{signal:ctl.signal});
const d=await r.json();
if(seq!==locationRequestSeq||ctl.signal.aborted)return null;
if(!r.ok||!d.ok)return null;
return String(d.display||'Current location');
}catch{return null}
finally{clearTimeout(timer);if(reverseLocationController===ctl)reverseLocationController=null;}
}
async function useLocation() {
if (!navigator.geolocation) {
 $('status').textContent='Location is not available in this browser.';
 $('locationSourceLabel').textContent='Location unavailable';
 return false;
}
if(!window.isSecureContext){
 $('status').textContent='Location requires a secure connection. Open the HTTPS app address.';
 $('locationSourceLabel').textContent='Secure connection required';
 return false;
}
if(locationRequestActive)return false;
const seq=++locationRequestSeq;
locationRequestActive=true;
setLocationBusy(true);
invalidateAddressSuggestions();
$('locationSourceLabel').textContent='Getting your location…';
$('status').textContent='Allow location access when your browser asks.';
try{
 let permission='unknown';
 try{
  const p=await navigator.permissions?.query?.({name:'geolocation'});
  permission=p?.state||'unknown';
 }catch(error){console.error('Dinliminate error',error)}
 if(permission==='denied')throw Object.assign(new Error('Location permission is blocked for this site. Enable Location in your browser site permissions, then try again.'),{code:1});
 const attempts=[
  {enableHighAccuracy:true,timeout:8500,maximumAge:0},
  {enableHighAccuracy:false,timeout:10000,maximumAge:0},
  {enableHighAccuracy:false,timeout:12000,maximumAge:120000}
 ];
 let position=null,lastError=null;
 for(const options of attempts){
  if(seq!==locationRequestSeq) return false;
  try{position=await requestBrowserPosition(options);break;}catch(err){lastError=err;}
 }
 if(!position)throw lastError||new Error('Could not access your current location.');
 const loc={lat:Number(position.coords.latitude),lon:Number(position.coords.longitude)};
 if(!Number.isFinite(loc.lat)||!Number.isFinite(loc.lon))throw new Error('Your browser returned an invalid location.');
 setLocation(loc.lat,loc.lon,'Current location','device');
 $('locationSourceLabel').textContent='Using your current location';
 $('status').textContent='Location found. Finding nearby restaurants…';
 if(seq!==locationRequestSeq)return false;
 const searchPromise=searchRestaurants();
 const label=await reverseLocationLabel(loc.lat,loc.lon,seq).catch(()=>null);
 if(seq!==locationRequestSeq)return false;
 if(label){
  const visibleLabel=displayRestaurantLocationLabel(label,'');
  S.location={...S.location,label:visibleLabel};
  $('address').value=visibleLabel;
  $('locationSourceLabel').textContent='Using your current location';
  save();
 }
 await searchPromise;
 if(seq!==locationRequestSeq)return false;
 S.locationFreshAt=Date.now();
 S.locationSource='device';
 renderLocationSource();
 if(!S.restaurantSearchDegraded) $('status').textContent=S.restaurantPool.length?'Location ready.':'Location found, but no restaurants were returned.';
 save();
 return true;
}catch(err){
 if(seq!==locationRequestSeq)return false;
 const code=Number(err?.code);
 if(code===1){
  $('locationSourceLabel').textContent='Location permission needed';
  $('status').textContent=err?.message||'Location permission was denied. Enable Location for this site and try again.';
 }else if(code===3){
  $('locationSourceLabel').textContent='Location timed out';
  $('status').textContent='Your browser could not get a fresh location. Try again or enter an address.';
 }else if(code===2){
  $('locationSourceLabel').textContent='Location unavailable';
  $('status').textContent='Your device could not provide a location. Try again or enter an address.';
 }else{
  $('locationSourceLabel').textContent='Location unavailable';
  $('status').textContent=err?.message||'Could not access your current location. Try again or enter an address.';
 }
 return false;
}finally{
 if(seq===locationRequestSeq){
  locationRequestActive=false;
  setLocationBusy(false);
  renderLocationSource();
 }
}
}
let autoRestaurantRefreshActive=false;
async function maybeAutoRefreshRestaurantLocation(){
 if(autoRestaurantRefreshActive||S.screen!=='restaurant'||S.locationSource!=='device'||!S.location)return false;
 const age=Date.now()-Number(S.locationFreshAt||0);
 if(age<10*60*1000)return false;
 autoRestaurantRefreshActive=true;
 try{
  const pos=await requestBrowserPosition({enableHighAccuracy:false,timeout:2500,maximumAge:120000});
  const fresh={lat:Number(pos.coords.latitude),lon:Number(pos.coords.longitude)};
  if(!Number.isFinite(fresh.lat)||!Number.isFinite(fresh.lon))return false;
  const moved=locationMovedMiles(S.location,fresh);
  S.locationFreshAt=Date.now();
  if(Number.isFinite(moved)&&moved>=0.15){
   setLocation(fresh.lat,fresh.lon,'Current location','device');
   if(S.screen==='restaurant'){
    $('status').textContent='Location updated. Refreshing restaurants…';
    await searchRestaurants().catch(()=>{});
   }
   return true;
  }
  save();
 }catch(error){console.error('Dinliminate error',error)}
 finally{autoRestaurantRefreshActive=false;}
 return false;
}
let suggestTimer = 0;
let suggestSeq = 0;
let suggestionIndex = -1;
const suggestCache = new Map();
function invalidateAddressSuggestions() {
  suggestSeq++;
  clearTimeout(suggestTimer);
  suggestTimer=0;
  suggestController?.abort();
  suggestController=null;
  clearSuggestions();
}
function addressLooksComplete(value) {
  const q=String(value||'').trim().replace(/\s+/g,' ');
  if(!/^\d+\s+[^,]+/i.test(q))return false;
  if(/\b\d{5}(?:-\d{4})?\b/.test(q))return true;
  const parts=q.split(',').map(x=>x.trim()).filter(Boolean);
  if(parts.length>=3&&/\b[A-Z]{2}\b/i.test(parts[parts.length-2]))return true;
  const last=parts[parts.length-1]||'';
  return parts.length>=2&&/\b[A-Za-z][A-Za-z .'-]+\s+[A-Z]{2}\b/i.test(last);
}
async function chooseAddressSuggestion(index) {
  const opts=[...document.querySelectorAll('#suggestionsBox [data-suggestion]')];
  const btn=opts[index];
  if(!btn)return false;
  btn.click();
  return true;
}
async function suggestAddresses() {
const q = $('address').value.trim();
const seq = ++suggestSeq;
if (q.length < 2) { clearSuggestions(); $('status').textContent='Enter an address or use your location.'; return; }
const cached=suggestCache.get(q.toLowerCase());
if(cached&&Date.now()-cached.t<300000){ renderSuggestions(cached.rows); return; }
$('status').textContent='Searching addresses…';
clearTimeout(suggestTimer);
suggestTimer=setTimeout(async()=>{
suggestController?.abort();
suggestController=new AbortController();
try{
const r=await fetch('/api/restaurants?mode=suggest&q='+encodeURIComponent(q),{signal:suggestController.signal});
const d=await r.json();
if(seq!==suggestSeq)return;
const rows=Array.isArray(d.results)?d.results:[];
suggestCache.set(q.toLowerCase(),{t:Date.now(),rows});
renderSuggestions(rows);
}catch(e){
if(e?.name==='AbortError')return;
clearSuggestions();$('status').textContent='Address lookup is temporarily unavailable.';
}
},380);
}
function renderSuggestions(rows) {
suggestionIndex = -1;
let box = $('suggestionsBox');
if (!box) {
box = document.createElement('div');
box.id = 'suggestionsBox';
$('address').insertAdjacentElement('afterend', box);
}
box.innerHTML = (rows || []).map((row, i) =>
'<button type="button" role="option" aria-selected="false" id="addressSuggestion-'+i+'" data-suggestion="'+i+'">'+esc(row.display)+'</button>'
).join('');
const hasRows=!!rows?.length;
box.hidden=!hasRows;
box.style.display=hasRows ? 'grid' : 'none';
$('address')?.setAttribute('aria-expanded',String(hasRows));
$('address')?.removeAttribute('aria-activedescendant');
box.querySelectorAll('[data-suggestion]').forEach((btn, i) => {
  btn.onclick = async () => {
    const row = rows[i];
    suggestionIndex = -1;
    invalidateAddressSuggestions();
    /* CP892 — autocomplete selection commits the full resolved address returned by the provider. */
    setLocation(row.lat, row.lon, String(row.display||'').trim(),'address');
    $('status').textContent = 'Location selected. Searching restaurants…';
    await searchRestaurants();
  };
});
}
function clearSuggestions() {
suggestionIndex = -1;
const box = $('suggestionsBox');
if (box) { box.style.display = 'none'; box.hidden=true; }
$('address')?.setAttribute('aria-expanded','false');
$('address')?.removeAttribute('aria-activedescendant');
}
function moveSuggestion(delta){
const opts=[...document.querySelectorAll('#suggestionsBox [data-suggestion]')];
if(!opts.length)return false;
suggestionIndex=(suggestionIndex+delta+opts.length)%opts.length;
opts.forEach((el,i)=>el.setAttribute('aria-selected',String(i===suggestionIndex)));
const active=opts[suggestionIndex];
$('address')?.setAttribute('aria-activedescendant',active.id);
active.scrollIntoView?.({block:'nearest'});
return true;
}
let restaurantSearchSeq = 0;
let restaurantHoursEnrichmentSeq = 0;
async function enrichRestaurantHoursForOpenNow(){
  const pool=Array.isArray(S.restaurantPool)?S.restaurantPool:[];
  const unknown=pool
    .filter(row=>restaurantHoursState(row)==='unknown')
    .sort((a,b)=>Number(a.distance||Infinity)-Number(b.distance||Infinity))
    .slice(0,90);
  if(!unknown.length){
    restaurantHoursEnrichmentKey=String(S.restaurantSearchKey||'');
    restaurantHoursEnrichedAt=Date.now();
    return {ok:true,counts:{total:pool.length,alreadyKnown:pool.length,resolvedFromOfficialWebsite:0,resolvedByGooglePlaceDetails:0,resolvedByGoogleTextSearch:0,stillUnknown:0,open:pool.filter(r=>restaurantHoursState(r)==='open').length},google:{callsUsed:0,callsBudget:36}};
  }
  const seq=++restaurantHoursEnrichmentSeq;
  const payload={
    maxGoogleCalls:36,
    rows:unknown.map(row=>({
      id:String(row?.id||''),
      name:String(row?.name||'').slice(0,160),
      address:String(row?.address||'').slice(0,240),
      phone:String(row?.phone||'').slice(0,50),
      website:String(row?.website||'').slice(0,700),
      brand:String(row?.brand||'').slice(0,120),
      lat:Number(row?.lat),
      lon:Number(row?.lon),
      distance:Number(row?.distance),
      googlePlaceId:String(row?.googlePlaceId||'').trim(),
      opening_hours:String(row?.opening_hours||'').slice(0,1200),
      openNow:typeof row?.openNow==='boolean'?row.openNow:null,
      businessStatus:String(row?.businessStatus||''),
      hoursSource:String(row?.hoursSource||''),
      hoursTimeZone:String(row?.hoursTimeZone||S.restaurantSearchTimeZone||'')
    }))
  };
  $('status').textContent='Checking open hours…';
  try{
    const response=await fetch('/api/restaurants?mode=hours',{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify(payload)
    });
    const data=await responseJson(response,'Open hours could not be checked right now.');
    if(seq!==restaurantHoursEnrichmentSeq||S.screen!=='restaurant')return data;
    const patches=new Map((Array.isArray(data?.patches)?data.patches:[]).map(row=>[String(row?.id||''),row]));
    let applied=0;
    for(const row of S.restaurantPool||[]){
      const patch=patches.get(String(row?.id||''));
      if(!patch)continue;
      for(const key of ['name','address','phone','website','opening_hours','openNow','businessStatus','googlePlaceId']){
        if(patch[key]!==undefined&&patch[key]!==null&&patch[key]!=='')row[key]=patch[key];
      }
      if(patch.hoursSource)row.hoursSource=patch.hoursSource;
      applied++;
    }
    restaurantHoursEnrichmentKey=String(S.restaurantSearchKey||'');
    restaurantHoursEnrichedAt=Date.now();
    return {...data,applied};
  }catch(error){
    if(seq!==restaurantHoursEnrichmentSeq||S.screen!=='restaurant')return {ok:false,error:String(error?.message||error||'')};
    $('status').textContent='Open hours could not be checked. Showing confirmed hours only.';
    return {ok:false,error:String(error?.message||error||'Open hours enrichment failed.')};
  }
}

let restaurantHoursEnrichmentKey = '';
let restaurantHoursEnrichedAt = 0;
async function responseJson(response, message){
let body=null;
try{body=await response.json();}catch{throw new Error(message||'The restaurant search returned an invalid response.');}
return body;
}
async function fetchRestaurantEndpoint(url,signal){
let lastError=null;
for(let attempt=0;attempt<2;attempt++){
  try{
    const response=await fetch(url,{signal});
    if(response.ok || attempt===1 || ![429,500,502,503,504].includes(response.status)) return response;
    await new Promise(resolve=>setTimeout(resolve,response.status===429?500:250));
    if(signal?.aborted) throw Object.assign(new Error('Aborted'),{name:'AbortError'});
  }catch(e){
    if(e?.name==='AbortError')throw e;
    lastError=e;
    if(attempt===1)throw e;
    await new Promise(resolve=>setTimeout(resolve,250));
    if(signal?.aborted) throw Object.assign(new Error('Aborted'),{name:'AbortError'});
  }
}
throw lastError||new Error('Restaurant service unavailable.');
}
async function searchRestaurants(options={}) {
invalidateAddressSuggestions();
const searchSeq = ++restaurantSearchSeq;
restaurantSearchController?.abort();
restaurantSearchController = new AbortController();
const signal=restaurantSearchController.signal;
let timedOut=false;
const deadline=setTimeout(()=>{timedOut=true;restaurantSearchController.abort()},14500);
clearSuggestions(); setFindBusy(true); $('status').textContent = 'Searching restaurants…';
$('restStage')?.setAttribute('aria-busy','true');
$('restStage')?.classList.add('is-searching');
try {
let loc = S.location;
if (!loc) {
const q = $('address').value.trim();
if (!q) { $('status').textContent = 'Enter an address or use your location.'; return; }
const rr = await fetchRestaurantEndpoint('/api/restaurants?mode=resolve&q='+encodeURIComponent(q),signal);
const rd = await responseJson(rr,'Could not locate that address. Please try another address.');
if (searchSeq !== restaurantSearchSeq) return;
if (!rr.ok || !rd.ok) throw new Error(rr.status===429 ? 'Address lookup is temporarily busy. Please try again.' : (rd.message || 'Could not locate that address.'));
const visibleLabel=displayRestaurantLocationLabel(rd.display,q); loc = {lat:rd.lat, lon:rd.lon, label:visibleLabel}; S.location = loc; S.locationSource='address'; renderLocationSource(); $('address').value = visibleLabel;
}
const radius = Math.min(100,Math.max(1,Number(options?.radius ?? $('radius')?.value)||10));
S.restaurantSearchRadius=radius;
const searchTerm = String(S.restaurantQuery||'').trim().slice(0,100);
const searchKey = Number(loc.lat).toFixed(4)+':'+Number(loc.lon).toFixed(4)+':'+radius+':'+normalizeRestaurantSearch(searchTerm);
 const previousSearchKey=String(S.restaurantSearchKey||'');
 const previousOrigin=S.restaurantSearchOrigin&&Number.isFinite(Number(S.restaurantSearchOrigin.lat))&&Number.isFinite(Number(S.restaurantSearchOrigin.lon))
   ? {lat:Number(S.restaurantSearchOrigin.lat),lon:Number(S.restaurantSearchOrigin.lon)}
   : null;
 const sameLocationQuery=!!previousOrigin
   && Math.abs(previousOrigin.lat-Number(loc.lat))<=0.0002
   && Math.abs(previousOrigin.lon-Number(loc.lon))<=0.0002
   && normalizeRestaurantSearch(String(S.restaurantSearchQuery||''))===normalizeRestaurantSearch(searchTerm);
 // CP1186: radius changes must never inherit a prior-radius pool.
 let replacingSearchTarget=!!previousSearchKey&&previousSearchKey!==searchKey;
 if(replacingSearchTarget&&!sameLocationQuery){
   clearDecisionHistory('restaurant');
   // CP1078: never leave the previous location/radius/query cards on screen
   // while a materially different restaurant search is being rebuilt.
   S.restaurantPool=[];
   S.restaurantSearchTimeZone='';
   S.restaurantIndex=0;
   S.restaurantActions=[];
   S.restaurantMaybeRound=false;
   S.maybeDeck=false;
   S.winnerItem=null;
   await drawRestaurants();
 }
const queryParam = searchTerm ? '&q='+encodeURIComponent(searchTerm) : '';
const rr = await fetchRestaurantEndpoint('/api/restaurants?mode=search&lat='+encodeURIComponent(loc.lat)+'&lon='+encodeURIComponent(loc.lon)+'&radius='+radius+queryParam,signal);
const d = await responseJson(rr,'Restaurant search returned an invalid response. Please try again.');
if (searchSeq !== restaurantSearchSeq) return;
if (!rr.ok || !d.ok) throw new Error(rr.status===429 ? 'Restaurant search is temporarily busy. Please try again.' : (d.message || 'Restaurant search failed.'));
const returnedRadius=Number(d.radiusMiles);
if(Number.isFinite(returnedRadius)&&Math.abs(returnedRadius-radius)>0.001){
 throw new Error('Restaurant search returned the wrong radius. Please try again.');
}
S.restaurantSearchDegraded = !!(d.providerErrors?.length);
S.restaurantSearchLatencyMs = Number(d.searchLatencyMs)||0;
S.restaurantSearchQuery = String(d.searchQuery||searchTerm||'');
S.restaurantSearchBudgetMs = Number(d.searchBudgetMs)||12000;
// Rebuild the active restaurant pool from the fresh provider response.
 // Do not carry the previous pool forward: stale rows can survive provider-side
 // dedupe/filter fixes and reappear as duplicate or non-restaurant cards.
 const incomingRows=(d.results || []).map(row => ({...row, providerId:row.id, canonicalId:restaurantCanonicalId(row), _maybe:false, _cut:false, _hidden:false})).filter(row=>{
 const dist=milesBetween(row.lat,row.lon,loc.lat,loc.lon);
 return Number.isFinite(dist) && dist<=radius+0.001;
});
// CP1186: each requested radius is rebuilt from its own provider response.
 const mergedRows=incomingRows;
 S.restaurantPool = dedupeRestaurantPool(mergedRows).filter(row=>{
   const dist=milesBetween(row.lat,row.lon,loc.lat,loc.lon);
   return Number.isFinite(dist)&&dist<=radius+0.001;
 }).sort((a,b)=>Number(a.distance||Infinity)-Number(b.distance||Infinity));
S.restaurantSearchOrigin = {lat:Number(loc.lat),lon:Number(loc.lon)};
S.restaurantSearchKey = searchKey;
 S.restaurantSearchTimeZone=String(d.hoursTimeZone||'');
S.restaurantIndex = 0; S.restaurantActions = []; S.restaurantHistory = []; S.restaurantMaybeRound = false;
S.winnerItem = null;
if(S.restaurantPool.length) {
  updateRestaurantStatus();
} else {
  $('status').textContent = d.providerErrors?.length ? 'Restaurant sources are unavailable. Try again.' : 'No restaurants found in this radius.';
}
restaurantQuick();
renderRestaurantHours();
if(S.restaurantPool.length){
  $('restStage')?.setAttribute('data-photo-state','preparing');
  await primeRestaurantPhotosBeforeFirstPaint(S.restaurantPool, S.restaurantIndex);
}
await drawRestaurants();
$('restStage')?.removeAttribute('data-photo-state');
save();
} catch (err) {
if (err?.name==='AbortError' || searchSeq !== restaurantSearchSeq) return;
S.restaurantSearchDegraded=true;
 if(replacingSearchTarget&&!sameLocationQuery){
   S.restaurantSearchTimeZone='';
   S.restaurantSearchKey='';
   S.restaurantPool=[];
   S.restaurantIndex=0;
   await drawRestaurants().catch(()=>{});
 }
$('status').textContent = timedOut ? 'The restaurant search took too long. Please try again.' : (err?.message || 'Could not complete the search.');
} finally {
clearTimeout(deadline);
if(searchSeq===restaurantSearchSeq){
  $('restStage')?.removeAttribute('aria-busy');
  $('restStage')?.classList.remove('is-searching');
  setFindBusy(false);
}
}
}
function openRestaurant(options={}) {
renderRestaurantSearchControl();
S.screen = 'restaurant';
S.restaurantActions = [];
S.restaurantHistory = [];
S.restaurantMaybeRound = false;
S.maybeDeck = false;
S.restaurantQuery = '';
S.restaurantHours = 'all';
S.restaurantHoursCollapsed = true;
S.restaurantCuts.clear();
for (const row of S.restaurantPool || []) {
row._cut = false;
row._maybe = false;
}
S.winnerItem = null;
show('restaurant');
restaurantQuick();
renderRestaurantHours();
$('restaurantSearchBox')?.classList.add('hidden');
$('restaurantQuery').value = '';
maybeShowInCardSwipeCoach();

// Restaurant entry is location-first: use the device location automatically whenever
// this screen is entered or re-entered, while preserving a deliberate typed-address search.
const hasTypedAddress=!!String($('address')?.value||'').trim();
const shouldAutoUseDeviceLocation=S.locationSource==='device'||!hasTypedAddress;
if(shouldAutoUseDeviceLocation) {
 window.setTimeout(()=>{
   if(S.screen!=='restaurant'||locationRequestActive)return;
   const currentAddress=String($('address')?.value||'').trim();
   const preserveTypedAddress=!!currentAddress&&S.locationSource==='typed';
   if(!preserveTypedAddress) useLocation();
 },80);
}
if(tutorialModeEnabled()&&tutorialState.active){
 const resumeIndex=Number.isInteger(options?.tutorialResumeIndex)?options.tutorialResumeIndex:0;
 tutorialEnterDecisionScreen('restaurant',resumeIndex);
}
}
let restaurantDrawSeq=0;
async function drawRestaurants(options={}) {
const drawSeq=++restaurantDrawSeq;
renderRestaurantHours();
let rows = restaurantPoolFiltered();
renderRestaurantSearchControl();
updateRestaurantStatus();
renderMaybeDeckToggle('restaurant');
if (!rows.length) {
const hasResults=!!S.restaurantPool.length;
const message=hasResults ? (S.restaurantHours!=='all' && restaurantPoolBase().length ? 'No restaurants match the Hours filter.' : 'No restaurants match the current filters.') : (S.restaurantSearchDegraded ? 'Some restaurant sources are unavailable.' : (S.location ? 'No restaurants found in this radius.' : 'Set a location, then find restaurants.'));
const actions = (S.location || hasResults) ? '<div class="empty-actions">'+(hasResults?'<button class="secondary" id="clearRestaurantSearch">Clear filter</button>':'')+(S.location?'<button class="premium-retry" id="retryRestaurantSearch">Retry Search</button>':'')+'</div>' : '';
$('restStage').innerHTML = '<div class="empty"><b>Hungry.</b><span>'+esc(message)+'</span>'+actions+'</div>';
if($('retryRestaurantSearch')) $('retryRestaurantSearch').onclick=searchRestaurants;
if($('clearRestaurantSearch')) $('clearRestaurantSearch').onclick=()=>{S.restaurantQuery=''; if($('restaurantQuery'))$('restaurantQuery').value=''; drawRestaurants(); save();};
return;
}
const restoreExact=!!S.restaurantRestoreExact;
S.restaurantRestoreExact=false;
S.restaurantIndex = Math.max(0, Math.min(S.restaurantIndex, rows.length - 1));
if(!restoreExact&&!S.restaurantMaybeRound){const ni=restaurantChoiceIndex(rows,S.restaurantIndex,false);if(ni>=0)S.restaurantIndex=ni;else if(rows.some(x=>x._maybe)){S.restaurantMaybeRound=true;S.restaurantIndex=restaurantChoiceIndex(rows,0,true);}}
let prepared={firstId:String(rows[S.restaurantIndex]?.id||''),readyIds:[]};
if(!options.startup){
 prepared=options.swipeHandoff
   ? {firstId:String(rows[S.restaurantIndex]?.id||''),readyIds:[]}
   : await prepareRestaurantPhotoDeck(rows,S.restaurantIndex,2);
 if(drawSeq!==restaurantDrawSeq)return;
 rows=restaurantPoolFiltered();
 if(prepared.firstId&&!restoreExact){
  const readyIndex=rows.findIndex(row=>String(row.id)===String(prepared.firstId));
  if(readyIndex>=0)S.restaurantIndex=readyIndex;
 }
}
if(S.restaurantIndex<0||S.restaurantIndex>=rows.length)S.restaurantIndex=0;
const row = rows[S.restaurantIndex];
if(!row)return;
const category = restaurantCategory(row);
const restaurantFallback = restaurantImmediatePhoto;
const image = restaurantFallback(row);
const distanceLabel=Number.isFinite(Number(row.distance)) ? Number(row.distance).toFixed(1)+' mi away' : '';
const restaurantMaybeBadge=row._maybe?'<span class="maybe-stamp restaurant-maybe-stamp" aria-label="Marked Maybe">MAYBE</span>':'';
const nextRow = rows[S.restaurantIndex + 1];
const nextImage = restaurantFallback(nextRow);
const shortAddress = row.address ? esc(String(row.address).split(',').slice(0,2).join(', ')) : '';
 const cardLocation = (shortAddress || distanceLabel) ? '<div class="restaurant-card-location-distance" title="'+esc(row.address||'')+'">'+[shortAddress,distanceLabel?esc(distanceLabel):''].filter(Boolean).join(' <span aria-hidden="true">•</span> ')+'</div>' : '';
const cardDetailsAction = '<button class="restaurant-card-utility restaurant-card-details-utility card-details-inline" id="restDetails" type="button" aria-label="Details" title="Details"><svg class="details-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 7.25h2M11 7.25h7M6 12h2M11 12h7M6 16.75h2M11 16.75h5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
 const cardUtilityRow='<div class="card-info-row card-cuisine-row restaurant-card-meta-row"><span class="restaurant-card-meta card-cuisine-text">'+esc(category)+'</span>'+cardDetailsAction+'</div>';
$('restStage').innerHTML =
'<div class="restaurant-card-stack"><article class="card next-card '+(nextRow?'':'hidden')+'" id="restaurantNextCard" aria-hidden="true"><img src="'+esc(nextImage)+'" data-restaurant-photo-key="'+esc(nextRow?.id||'')+'" alt="'+esc(nextRow?.name||'')+'"><div class="shade"></div><div class="card-copy restaurant-next-copy">'+(nextRow?('<div class="card-info-row card-cuisine-row restaurant-card-meta-row"><span class="restaurant-card-meta card-cuisine-text">'+esc(restaurantCategory(nextRow))+'</span><span class="restaurant-card-utility restaurant-card-details-utility card-details-inline card-details-visual" aria-hidden="true"><svg class="details-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 7.25h2M11 7.25h7M6 12h2M11 12h7M6 16.75h2M11 16.75h5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div><h3>'+esc(nextRow.name||'')+'</h3>'): '')+'</div><div class="restaurant-photo-credit" aria-live="polite"></div></article><article class="card" id="restaurantCard"><img src="'+esc(image)+'" data-restaurant-photo-key="'+esc(row.id||'')+'" alt="'+esc(row.name)+'"><div class="shade"></div><div class="restaurant-card-photo-ui">'+restaurantMaybeBadge+'</div><div class="restaurant-photo-credit" aria-live="polite"></div><div class="card-copy">'+cardUtilityRow+'<h3>'+esc(row.name)+'</h3>'+cardLocation+'</div></div></article></div>'+'<div class="swipe-actions unified-swipe-actions" aria-label="Restaurant decision controls"><button class="round-action round-back secondary" id="restBack" aria-label="Back"><span>↶</span></button><button class="round-action round-cut cut" id="restCut" aria-label="Cut"><span>✕</span></button><button class="round-action round-maybe maybe" id="restMaybe" aria-label="Maybe"><span>♥</span></button><button class="round-action round-choose choose" id="restChoose" aria-label="Choose this restaurant"><span>✓</span></button></div>';
const current = rows[S.restaurantIndex];
const handoffRendering=!!options.swipeHandoff;
const currentCard=$('restaurantCard');
if(handoffRendering&&currentCard){
 currentCard.style.opacity='0';
 currentCard.style.visibility='hidden';
 currentCard.style.pointerEvents='none';
}
updateDecisionBackButtons();
bindCardButton('restBack', restaurantBack);
bindCardButton('restCut', () => restaurantCut(current));
bindCardButton('restMaybe', () => restaurantMaybe(current));
bindCardButton('restChoose', () => {dismissSwipeHint();if(S.familyNormalMode==='decision'&&S.familyDecisionType==='restaurant'){familyRoundStage()===1?familyEnterMaybes('restaurant'):familyPickSingle('restaurant');}else winner(current)});
bindCardButton('restDetails', () => detailsSheet(current,'restaurant'));
bindRestaurantSwipe(current);bindMaybeDeckToggle('restaurant');
bindRestaurantPhotoPinch($('restaurantCard')?.querySelector('img'));
const restaurantNextCard=$('restaurantNextCard');
const restaurantNextImageEl=$('#restStage #restaurantNextCard img');
if(nextRow&&restaurantNextCard&&restaurantNextImageEl){
  restaurantNextImageEl.decoding='async';
  stageSwipePreview(restaurantNextCard,restaurantNextImageEl,nextImage,nextRow.id);
  loadRestaurantPhoto(nextRow).then(async data=>{
   if(!data?.url)return null;
   if(!restaurantNextCard.isConnected)return data.url;
   if(String(restaurantNextCard.dataset.swipePreviewKey||'')!==String(nextRow.id||''))return data.url;
   const swapped=await swapImageWhenReady(restaurantNextImageEl,data.url);
   if(swapped){
    restaurantNextImageEl.dataset.restaurantPhotoLoaded='true';
    setRestaurantPhotoCredit(restaurantNextCard,data.attributions);
   }
   return data.url;
  }).catch(()=>null);
}
const currentPhotoPromise=hydrateRestaurantPhoto(row,'#restStage #restaurantCard');
if(handoffRendering){
 currentPhotoPromise.then(async data=>{
   const freshCard=$('#restStage #restaurantCard'),freshImg=freshCard?.querySelector('img');
   if(!freshCard||!freshImg)return;
   if(data?.url)await waitForVisualImage(data.url,freshImg,1200);
   else if(image)await waitForVisualImage(image,freshImg,900);
   freshCard.style.transition='none';
   freshCard.style.transform='none';
   freshCard.style.opacity='1';
   freshCard.style.visibility='visible';
   freshCard.style.pointerEvents='auto';
 }).catch(()=>{
   const freshCard=$('#restStage #restaurantCard');
   if(freshCard){
    freshCard.style.transition='none';
    freshCard.style.transform='none';
    freshCard.style.opacity='1';
    freshCard.style.visibility='visible';
    freshCard.style.pointerEvents='auto';
   }
 });
}else{
 currentPhotoPromise.catch(()=>{});
}
if(nextRow)hydrateRestaurantPhoto(nextRow,'#restStage #restaurantNextCard');
prefetchRestaurantPhotos(rows,S.restaurantIndex,RESTAURANT_PHOTO_PREFETCH_COUNT);
maybeShowInCardSwipeCoach();
if(S.familyNormalMode==='setup'&&S.familyDecisionType==='restaurant')familyNormalBar('restaurant','setup',S.familyActiveData);
}
async function restaurantCut(row,options={}){
 dismissSwipeHint();
 if(S.familyNormalMode==='decision'&&S.familyDecisionType==='restaurant'&&familyRoundStage()!==1){familyBrowsePrevious('restaurant');return;}
 if(!row)return;
 pushDecisionHistory('restaurant',captureRestaurantDecisionState());
 const unkept=restaurantPoolFiltered().filter(x=>!x._maybe).length;
 S.restaurantActions.push({type:'cut',id:row.id,index:S.restaurantIndex,maybeRound:!!S.restaurantMaybeRound,hadMaybe:!!row._maybe,roundAfter:!!S.restaurantMaybeRound||(Array.isArray(S.restaurantPool)&&S.restaurantPool.some(x=>x._maybe)&&unkept<=1)});
 row._cut=true;
 const remaining=restaurantPoolFiltered();
 if(!remaining.length)winner({name:'Nothing left — hungry mode',image:HUNGRY_IMAGE,category:'Hungry'});else{S.restaurantIndex=Math.min(S.restaurantIndex,remaining.length-1);await drawRestaurants({swipeHandoff:!!options.fromSwipe});}
 save();
}

async function restaurantMaybe(row,options={}){
 dismissSwipeHint();
 if(S.familyNormalMode==='decision'&&S.familyDecisionType==='restaurant'&&familyRoundStage()!==1){familyBrowseNext('restaurant');return;}
 if(!row)return;const rows=restaurantPoolFiltered();if(rows.length===1){pushDecisionHistory('restaurant',captureRestaurantDecisionState());winner(row);return;}
 pushDecisionHistory('restaurant',captureRestaurantDecisionState());
 const wasRecycle=S.restaurantMaybeRound;S.restaurantActions.push({type:'maybe',id:row.id,index:S.restaurantIndex,maybeRound:wasRecycle,hadMaybe:!!row._maybe});row._maybe=true;
 const remaining=restaurantPoolFiltered(),next=restaurantChoiceIndex(remaining,(S.restaurantIndex+1)%Math.max(1,remaining.length),wasRecycle);
 if(next>=0)S.restaurantIndex=next;else{S.restaurantMaybeRound=true;S.restaurantIndex=restaurantChoiceIndex(remaining,0,true);}
 await drawRestaurants({swipeHandoff:!!options.fromSwipe});save();
}

function restaurantBack(){
 if(familyIsBrowseStage('restaurant')){familyBrowseBack('restaurant');return;}
 if(restaurantBackBusy||$('restaurantCard')?.dataset.swipeTransaction==='active')return;
 const state=S.restaurantHistory.pop();
 if(!state){legacyRestaurantBack();updateDecisionBackButtons();return;}
 S.restaurantActions.pop();
 if(!restoreRestaurantDecisionState(state))return;
 restaurantBackBusy=true;
 Promise.resolve(drawRestaurants()).finally(()=>{restaurantBackBusy=false;updateDecisionBackButtons();});
 save();
}

async function restaurantHide(row) {
if (!row) return false;
if (!await appConfirm('Hide this restaurant?', 'Hide '+row.name+' until you restore it in Settings.', 'Hide')) return false;
row._hidden = true;
S.hiddenRestaurants[row.id] = {
id:row.id,canonicalId:row.canonicalId||restaurantCanonicalId(row),name:row.name,photo:row.photo||row.image||'',category:restaurantCategory(row),
address:row.address||'',phone:row.phone||'',lat:row.lat,lon:row.lon,website:row.website||''
};
drawRestaurants();
save();
return true;
}
function bindCardButton(id,handler){
 const el=$(id);if(!el)return;
 const premiumDecision=/^(?:food|rest)(?:Cut|Maybe|Choose)$/.test(id);
 let pressTimer=0;
 el.setAttribute('type',el.getAttribute('type')||'button');
 el.style.touchAction='manipulation';
 el.style.webkitUserSelect='none';
 el.style.userSelect='none';

 const clearPress=()=>{
  if(!premiumDecision)return;
  clearTimeout(pressTimer);
  pressTimer=window.setTimeout(()=>el.classList.remove('is-pressed'),150);
 };

 el.onpointerdown=e=>{
  if(el.disabled)return;
  if(premiumDecision){
   clearTimeout(pressTimer);
   el.classList.add('is-pressed');
  }
 };

 // CP1244: buttons have one authoritative activation path. Pointerup is
 // visual-only; click is the command. This avoids pointerup + click double
 // activation and lets the swipe transaction be the single source of truth.
 el.onclick=e=>{
  if(el.disabled)return;
  const now=performance.now();
  if(premiumDecision){
   el.__dinliminateLastActivation=now;
   el.classList.add('is-pressed');
   if(id==='foodCut'||id==='restCut'||id==='foodMaybe'||id==='restMaybe')triggerSwipeHaptic();
  }

  clearPress();
  e?.preventDefault?.();
  e?.stopPropagation?.();

  if((id==='foodChoose'||id==='restChoose')&&typeof tutorialMarkChoose==='function'){
   tutorialMarkChoose(id==='restChoose'?'restaurant':'food');
  }

  try{
   const swipeCardId=(id==='foodCut'||id==='foodMaybe')?'foodCard':(id==='restCut'||id==='restMaybe')?'restaurantCard':'';
   const swipeDecision=(id==='foodCut'||id==='restCut')?-1:(id==='foodMaybe'||id==='restMaybe')?1:0;
   const swipeCard=swipeCardId?$(swipeCardId):null;

   if(swipeDecision&&swipeCard?.__triggerSwipeDecision){
    const transaction=swipeCard.__triggerSwipeDecision(swipeDecision);
    // CP1244: an active transaction consumes the command. Never fall through
    // to foodCut/foodMaybe/restaurantCut/restaurantMaybe while that card is
    // still leaving, even when the visual flight is still in progress.
    if(transaction==='accepted'||transaction==='busy')return;
   }

   const result=handler?.(e);
   if(result&&typeof result.catch==='function')result.catch(()=>{});
  }catch(error){console.error('Dinliminate error',error)}
 };
 el.onpointercancel=clearPress;
}

// CP1244 — One decision transaction per active card. A busy card consumes
// subsequent Cut/Maybe commands instead of letting them mutate app state.

function bindRestaurantSwipe(row){bindSwipeCard('restaurantCard',()=>familyIsBrowseStage('restaurant')?familyBrowseNext('restaurant'):restaurantCut(row,{fromSwipe:true}),()=>familyIsBrowseStage('restaurant')?familyBrowsePrevious('restaurant'):restaurantMaybe(row,{fromSwipe:true}))}
let restaurantQueryTimer = 0;
function scheduleRestaurantProviderSearch(){
 clearTimeout(restaurantQueryTimer);
 const q=String(S.restaurantQuery||'').trim();
 if(q.length<2)return;
 restaurantQueryTimer=setTimeout(()=>{searchRestaurants();},650);
}
function renderRestaurantSearchControl(){
 const btn=$('restaurantSearchToggle');
 const box=$('restaurantSearchBox');
 if(!btn||!box)return;
 const isOpen=!box.classList.contains('hidden');
 btn.classList.toggle('is-open',isOpen);
 btn.setAttribute('aria-expanded',String(isOpen));
 btn.setAttribute('aria-label',isOpen?'Close Search':'Open Search');
 btn.title=isOpen?'Close Search':'Open Search';
}
function collapseRestaurantSearch(clear=false){
 clearTimeout(restaurantQueryTimer);
 restaurantQueryTimer=0;
 restaurantSearchSeq++;
 restaurantSearchController?.abort();
 restaurantSearchController=null;
 setFindBusy(false);
 const box=$('restaurantSearchBox');
 if(box)box.classList.add('hidden');
 if(clear){
   const input=$('restaurantQuery');
   if(input)input.value='';
   S.restaurantQuery='';
   S.restaurantIndex=0;
 }
 renderRestaurantSearchControl();
}
function setRestaurantRefinePanel(kind,open=null){
 const searchBox=$('restaurantSearchBox');
 const isSearchOpen=!!searchBox&&!searchBox.classList.contains('hidden');
 const isCuisineOpen=!S.quickCutsCollapsed?.restaurant;
 const isHoursOpen=!S.restaurantHoursCollapsed;
 const current=kind==='search'?isSearchOpen:(kind==='cuisine'?isCuisineOpen:isHoursOpen);
 const next=open===null?!current:!!open;
 if(kind==='search'){
  if(next){
   S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:false,restaurant:false}),restaurant:true};
   S.restaurantHoursCollapsed=true;
   searchBox?.classList.remove('hidden');
  }else collapseRestaurantSearch(false);
 }else if(kind==='cuisine'){
  if(next){
   collapseRestaurantSearch(false);
   S.restaurantHoursCollapsed=true;
   S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:false,restaurant:false}),restaurant:false};
  }else S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:false,restaurant:false}),restaurant:true};
 }else if(kind==='hours'){
  if(next){
   collapseRestaurantSearch(false);
   S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:false,restaurant:false}),restaurant:true};
   S.restaurantHoursCollapsed=false;
  }else S.restaurantHoursCollapsed=true;
 }
 renderRestaurantSearchControl();
 renderQuickCutsCollapse('restaurant');
 renderRestaurantHours();
}
function closeRestaurantSearch(){
 collapseRestaurantSearch(true);
 drawRestaurants();
 save();
}
function bindRestaurantTools(){
 bindRestaurantHours();
 const searchButton=$('restaurantSearchToggle');
 if(searchButton)searchButton.onclick=event=>{
   event.preventDefault();
   event.stopPropagation();
   const box=$('restaurantSearchBox');
   if(!box)return;
   const willOpen=box.classList.contains('hidden');
   setRestaurantRefinePanel('search',willOpen);
   if(willOpen){
     const input=$('restaurantQuery');
     if(input)input.value=S.restaurantQuery||'';
     input?.focus();
   }
 };
 const queryInput=$('restaurantQuery');
 if(queryInput)queryInput.oninput=()=>{
   const previousQuery=String(S.restaurantQuery||'').trim();
   S.restaurantQuery=String(queryInput.value||'').trim().slice(0,100);
   S.restaurantIndex=0;
   save();
   if(!S.restaurantQuery && previousQuery){
     clearTimeout(restaurantQueryTimer); restaurantQueryTimer=0; searchRestaurants(); return;
   }
   scheduleRestaurantProviderSearch();
 };
 if(queryInput)queryInput.onkeydown=e=>{
   if(e.key==='Enter'){
     e.preventDefault();e.stopPropagation();
     clearTimeout(restaurantQueryTimer);restaurantQueryTimer=0;
     S.restaurantQuery=String(e.currentTarget?.value||'').trim().slice(0,100);
     S.restaurantIndex=0;
     if(S.restaurantQuery)searchRestaurants();
   }
 };
 renderRestaurantSearchControl();
}
let celebrationHideTimer=0;

export { milesBetween, restaurantAddressFamily, restaurantNameTokensUI, restaurantNameFamily, restaurantNameCoreTokensUI, restaurantNameCoreMatchUI, restaurantNameSimilarityUI, restaurantAddressKeyUI, restaurantAddressSimilarityUI, restaurantStreetFamily, addressHasStreetNumber, restaurantNameVariantMatchUI, restaurantPhotoQualityScore, dedupeRestaurantPool, restaurantCanonicalId, restaurantHidden, restaurantSearchText, restaurantIsFastFood, restaurantCuisineTags, restaurantCuisineEvidence, restaurantCategory, restaurantQuickMatches, restaurantCategorySearchMatches, restaurantSearchTermMatches, restaurantMatchesQuery, restaurantClockParts, restaurantHoursState, restaurantHoursMatches, restaurantPoolHourFiltered, restaurantChoiceIndex, restaurantPoolBase, restaurantPoolFiltered, updateRestaurantStatus, restaurantQuick, renderLocationSource, displayRestaurantLocationLabel, setLocation, renderFindButton, setFindBusy, setLocationBusy, requestBrowserPosition, locationMovedMiles, invalidateAddressSuggestions, addressLooksComplete, renderSuggestions, clearSuggestions, moveSuggestion, openRestaurant, restaurantBack, bindCardButton, bindRestaurantSwipe, scheduleRestaurantProviderSearch, renderRestaurantSearchControl, collapseRestaurantSearch, setRestaurantRefinePanel, closeRestaurantSearch, bindRestaurantTools, reverseLocationLabel, useLocation, maybeAutoRefreshRestaurantLocation, chooseAddressSuggestion, suggestAddresses, enrichRestaurantHoursForOpenNow, responseJson, fetchRestaurantEndpoint, searchRestaurants, drawRestaurants, restaurantCut, restaurantMaybe, restaurantHide };
