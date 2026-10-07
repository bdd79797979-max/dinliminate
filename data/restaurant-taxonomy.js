(() => {
'use strict';

const RESTAURANT_TAGS = ['Fast Food','Burgers','Pizza','Mexican','American','Italian','Asian','BBQ','Seafood','Breakfast','Southern'];

const RESTAURANT_SEARCH_ALIASES = {
  'Fast Food':['fast food','fastfood','quick service','quick-service','drive thru','drive through','drive-thru'],
  Burgers:['burger','burgers','hamburger','hamburgers','cheeseburger','cheeseburgers'],
  Pizza:['pizza','pizzeria','pizzerias'],
  Mexican:['mexican','mexican food','tex mex','tex-mex','taco','tacos','taqueria','burrito','burritos','enchilada','enchiladas','quesadilla','quesadillas','fajita','fajitas'],
  American:['american','american food','diner'],
  Italian:['italian','italian food','pasta','pizzeria','trattoria','osteria','ristorante'],
  Asian:['asian','asian food','chinese','japanese','thai','korean','sushi','vietnamese','ramen','pho','hibachi','teriyaki'],
  BBQ:['bbq','barbecue','barbeque','smokehouse','smoke shack','pit bbq','bar-b-q','bar-b-que'],
  Seafood:['seafood','fish house','fish restaurant','fish','shrimp','crab','lobster','oyster','catfish'],
  Breakfast:['breakfast','breakfast food','brunch','waffle','waffles','pancake','pancakes','omelet','omelette']
};

const RESTAURANT_IDENTITY_PROFILES = [
  {pattern:/\b(?:the )?heads bbq\b/,key:'heads-bbq-clarksville',identityNames:['heads bbq','the heads bbq','robert heads bbq'],tags:['BBQ'],primary:'BBQ'},
  {pattern:/\brobert heads bbq\b/,key:'heads-bbq-clarksville',identityNames:['heads bbq','the heads bbq','robert heads bbq'],tags:['BBQ'],primary:'BBQ'},
  {pattern:/\bexcell bbq\b/,key:'excell-bbq-clarksville',identityNames:['excell bbq','excell bar b q','excell market bar b q'],tags:['BBQ'],primary:'BBQ'},
  {pattern:/\bmcdonalds?\b/,tags:['Fast Food','Burgers']},
  {pattern:/\bwendys?\b/,tags:['Fast Food','Burgers']},
  {pattern:/\bburger king\b/,tags:['Fast Food','Burgers']},
  {pattern:/\bfive guys\b/,tags:['Fast Food','Burgers']},
  {pattern:/\bculvers?\b/,tags:['Fast Food','Burgers']},
  {pattern:/\bwhataburger\b/,tags:['Fast Food','Burgers']},
  {pattern:/\bsonic\b/,tags:['Fast Food','Burgers']},
  {pattern:/\bsteak n shake\b/,tags:['Fast Food','Burgers']},
  {pattern:/\bfreddys\b/,tags:['Fast Food','Burgers']},
  {pattern:/\bwhite castle\b/,tags:['Fast Food','Burgers']},
  {pattern:/\bin n out\b/,tags:['Fast Food','Burgers']},
  {pattern:/\bcarl s jr\b/,tags:['Fast Food','Burgers']},
  {pattern:/\btaco bell\b|\bdel taco\b|\bchipotle\b/,tags:['Fast Food','Mexican']},
  {pattern:/\bpanda express\b/,tags:['Fast Food','Asian']},
  {pattern:/\blittle caesars\b|\bdominos\b|\bpapa johns\b|\bpizza hut\b|\bmarcos pizza\b/,tags:['Fast Food','Pizza','Italian']},
  {pattern:/\bwingstop\b/,tags:['Fast Food']},
  {pattern:/\bkfc\b|\bchick fil a\b|\bpopeyes?\b|\barbys?\b|\bsubway\b|\bjimmy johns\b|\bjersey mike\b|\bfirehouse subs\b|\braising canes\b|\bbojangles\b|\bcook out\b|\bdairy queen\b|\bzaxbys\b|\bchurchs chicken\b|\bcaptain ds\b|\blong john silvers\b/,tags:['Fast Food']},
  {pattern:/\bwaffle house\b|\bihop\b|\bdennys?\b|\bbob evans\b|\bfirst watch\b/,tags:['American','Breakfast']},
  {pattern:/\bcracker barrel\b/,tags:['American','Breakfast']},
  {pattern:/\bolive garden\b/,tags:['Italian']},
  {pattern:/\bred lobster\b/,tags:['Seafood']},
  {pattern:/\bapplebees?\b|\bchilis\b|\btexas roadhouse\b|\boutback steakhouse\b|\bo charleys\b|\bruby tuesday\b|\bbuffalo wild wings\b|\bgolden corral\b/,tags:['American']},
  {pattern:/\bthirsty goat\b/,key:'thirsty-goat-clarksville',identityNames:['thirsty goat','the thirsty goat'],tags:['Pizza'],primary:'Pizza',blockFastFood:true},
  {pattern:/\btaco johns?\b|\bqdoba\b|\bmoe(?:s)?\b/,tags:['Fast Food','Mexican']},
  {pattern:/\blos compadres\b|\blos amigos\b|\b(la|el) hacienda\b/,tags:['Mexican']},
  {pattern:/\bchuy'?s\b|\bfuzzy'?s taco\b/,tags:['Mexican','Fast Food']},
  {pattern:/\bwingstop\b|\bbuffalo wild wings\b|\bhooters\b/,tags:['Fast Food','American']},
  {pattern:/\braising cane'?s\b|\bzaxby'?s\b|\bchick fil a\b|\bchick-fil-a\b/,tags:['Fast Food']},
  {pattern:/\bcaptain d'?s\b|\blong john silver'?s\b/,tags:['Fast Food','Seafood']},
  {pattern:/\bcracker barrel\b|\bbob evans\b|\bfirst watch\b/,tags:['American','Breakfast']},
  {pattern:/\bchina (one|garden|wok|house)\b|\bpeking\b|\bgolden dragon\b/,tags:['Asian']},
  {pattern:/\bthai\b|\bbangkok\b|\bsushi\b|\bhibachi\b/,tags:['Asian']},
  {pattern:/\bcatfish\b|\bfish house\b|\bseafood\b|\bred lobster\b/,tags:['Seafood']}
];

const RESTAURANT_MENU_SIGNALS = {
  Pizza:['pizza','calzone','pizzeria'],
  Mexican:['taco','burrito','enchilada','quesadilla','fajita','tamale','torta','pozole','churro'],
  Asian:['sushi','sashimi','ramen','pho','hibachi','teriyaki','tempura','bao','dim sum','pad thai','kimchi'],
  Italian:['pasta','spaghetti','lasagna','ravioli','gnocchi','alfredo','risotto','carbonara'],
  American:['american'],
  BBQ:['bbq','barbecue','barbeque','brisket','ribs','pulled pork','smokehouse','smoked'],
  Seafood:['seafood','shrimp','crab','lobster','oyster','catfish','salmon','tilapia'],
  Breakfast:['breakfast','brunch','pancakes','waffles','french toast','omelet','omelette','eggs benedict','biscuits and gravy']
};

const RESTAURANT_NAME_SIGNALS = {
  Pizza:/\bpizza\b|\bpizzeria\b/,
  Mexican:/\bmexican\b|\btaqueria\b|\btaco\b|\bburrito\b/,
  Asian:/\basian\b|\bchinese\b|\bjapanese\b|\bthai\b|\bkorean\b|\bsushi\b|\bramen\b|\bpho\b|\bhibachi\b|\bteriyaki\b/,
  Italian:/\bitalian\b|\bpizzeria\b|\bpasta\b|\btrattoria\b|\bosteria\b|\bristorante\b/,
  Southern:/\bsouthern\b|\bsoul food\b|\bcountry cooking\b|\bmeat and three\b/,
  BBQ:/\bbbq\b|\bbarbecue\b|\bbarbeque\b|\bsmokehouse\b|\bsmoke shack\b|\bpit bbq\b/,
  Seafood:/\bseafood\b|\bfish house\b|\bfish restaurant\b|\boyster\b|\bcrab house\b|\blobster\b/,
  Breakfast:/\bbreakfast\b|\bbrunch\b|\bpancake house\b|\bwaffle house\b/,
  American:/\bamerican\b|\bdiner\b|\bsteakhouse\b|\broadhouse\b/
};

const SEARCH_FILLER_WORDS = new Set(['restaurant','restaurants','place','places','food','foodie','near','me']);

function normalizeRestaurantSearch(value){
  return String(value||'')
    .toLowerCase()
    .replace(/['’]/g,'')
    .replace(/&/g,' and ')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,100);
}

const ALIAS_TO_TAG = new Map();
for(const [tag,aliases] of Object.entries(RESTAURANT_SEARCH_ALIASES)){
  for(const alias of aliases){const key=normalizeRestaurantSearch(alias);if(!ALIAS_TO_TAG.has(key))ALIAS_TO_TAG.set(key,tag);}
}

function restaurantSearchClassification(value){
  const normalized=normalizeRestaurantSearch(value);
  if(!normalized)return {kind:'empty',normalized,tag:null};
  const exact=ALIAS_TO_TAG.get(normalized);
  if(exact)return {kind:'category',normalized,tag:exact};

  const words=normalized.split(' ').filter(Boolean);
  const stripped=words.filter(word=>!SEARCH_FILLER_WORDS.has(word)).join(' ');
  const strippedTag=ALIAS_TO_TAG.get(stripped);
  if(strippedTag)return {kind:'category',normalized,tag:strippedTag};

  for(const [alias,tag] of ALIAS_TO_TAG.entries()){
    if(alias.length<4)continue;
    if(normalized.includes(alias)){
      const remainder=normalized.replace(alias,' ').split(' ').filter(Boolean).filter(word=>!SEARCH_FILLER_WORDS.has(word));
      if(remainder.length===0)return {kind:'category',normalized,tag};
    }
  }
  return {kind:'name',normalized,tag:null};
}

function searchAliasesFor(value){
  const c=restaurantSearchClassification(value);
  if(c.kind!=='category'||!c.tag)return [c.normalized];
  const canonical=normalizeRestaurantSearch(c.tag);
  const rawAliases=(RESTAURANT_SEARCH_ALIASES[c.tag]||[]).map(normalizeRestaurantSearch).filter(Boolean);
  const stem=x=>x.replace(/s$/,'');
  const candidates=[...new Set(rawAliases)].filter(x=>x!==canonical);
  candidates.sort((a,b)=>{
    const aw=a.split(' ').length,bw=b.split(' ').length;
    return aw-bw || a.length-b.length;
  });
  const selected=[];
  for(const candidate of candidates){
    if(stem(candidate)===stem(canonical))continue;
    if(selected.some(x=>stem(x)===stem(candidate)))continue;
    selected.push(candidate);
    if(selected.length>=2)break;
  }
  return [canonical,...selected];
}

function identityProfile(row){
  const name=normalizeRestaurantSearch(row?.name);
  const exact=RESTAURANT_IDENTITY_PROFILES.find(p=>Array.isArray(p.identityNames)&&p.identityNames.includes(name));
  return exact||null;
}
function restaurantIdentityKey(row){
  return String(identityProfile(row)?.key||'').trim();
}
function identityHay(row){
  return normalizeRestaurantSearch([row?.category,row?.cuisine,row?.providerType,row?.primaryType,row?.types?.join?.(' '),row?.name,row?.brand,row?.operator].join(' '));
}
function isFastFood(row){
  const identity=identityHay(row);
  const profile=identityProfile(row);
  if(profile?.blockFastFood)return false;
  if(profile?.tags.includes('Fast Food'))return true;
  return !!row?.fastFood || /\bfast food\b/.test(normalizeRestaurantSearch(row?.category));
}
function menuSignalCount(row,tag){
  const items=Array.isArray(row?.menuItems)?row.menuItems:[];
  const hay=normalizeRestaurantSearch(items.join(' '));
  const signals=RESTAURANT_MENU_SIGNALS[tag]||[];
  return new Set(signals.filter(signal=>hay.includes(normalizeRestaurantSearch(signal)))).size;
}
function classifyRestaurant(row){
  const rawCategory=normalizeRestaurantSearch(row?.category);
  const cuisineHay=normalizeRestaurantSearch(row?.cuisine);
  const nameHay=normalizeRestaurantSearch([row?.name,row?.brand,row?.operator].join(' '));
  const identity=identityHay(row);
  const tags=new Set();
  const evidence={};
  const add=(tag,reason)=>{tags.add(tag);(evidence[tag]||(evidence[tag]=[])).push(reason);};

  const profile=RESTAURANT_IDENTITY_PROFILES.find(p=>p.pattern.test(identity));
  if(profile)for(const tag of profile.tags)add(tag,'known identity');

  if(isFastFood(row))add('Fast Food','provider fast-food signal');
  const providerTypeHay=normalizeRestaurantSearch([row?.providerType,row?.primaryType,row?.types?.join?.(' ')].join(' '));
  const primary=rawCategory+' '+cuisineHay+' '+providerTypeHay;
  const providerRules={
    'Fast Food':/\b(fast food|fast_food_restaurant|fast food restaurant|quick service|quick-service|drive thru|drive through|drive-thru)\b/,
    Burgers:/\b(burger restaurant|burger restaurants|burgers?|hamburgers?|cheeseburgers?|smashburgers?|burger joint)\b/,
    Pizza:/\b(pizza restaurant|pizzeria|pizza|calzone)\b/,
    Mexican:/\b(mexican restaurant|mexican|tex mex|taqueria|taco shop|burrito|quesadilla|enchilada|fajita)\b/,
    Asian:/\b(asian restaurant|chinese restaurant|japanese restaurant|thai restaurant|korean restaurant|asian|chinese|japanese|thai|korean|sushi|vietnamese|hibachi|ramen|pho|teriyaki)\b/,
    Italian:/\b(italian restaurant|italian|pizzeria|pasta|spaghetti|lasagna|ravioli|trattoria|osteria|ristorante)\b/,
    Southern:/\b(southern restaurant|southern|soul food|country cooking|meat and three|comfort food)\b/,
    BBQ:/\b(barbecue restaurant|bbq restaurant|bbq|barbecue|barbeque|smokehouse|smoke shack|pit bbq|brisket|ribs|pulled pork)\b/,
    Seafood:/\b(seafood restaurant|fish restaurant|fish house|seafood|catfish|shrimp|crab house|lobster|oyster|salmon)\b/,
    Breakfast:/\b(breakfast restaurant|breakfast|brunch|pancake house|waffle house|waffles?|pancakes?|omelet(?:te)?|eggs benedict|biscuits and gravy)\b/,
    American:/\b(american restaurant|diner|steakhouse|steak house|roadhouse|grill|bistro|pub|tavern|american)\b/
  };
  for(const [tag,re] of Object.entries(providerRules))if(re.test(primary))add(tag,'provider category/cuisine');

  for(const [tag,re] of Object.entries(RESTAURANT_NAME_SIGNALS))if(re.test(nameHay))add(tag,'restaurant name');

  for(const tag of ['Pizza','Mexican','Asian','Italian','Southern','BBQ','Seafood','Breakfast']){
    if(menuSignalCount(row,tag)>=2)add(tag,'menu corroboration');
  }

  // Generic provider labels such as "Restaurant" should never be the only
  // classification when the name/category/cuisine contains a useful food signal.
  if(tags.size===0){
    const fallbackSignals={
      Burgers:/\b(burger|hamburger|cheeseburger|smashburger)\b/,
      Pizza:/\b(pizza|pizzeria|calzone)\b/,
      Mexican:/\b(mexican|taco|burrito|taqueria|enchilada|quesadilla|fajita)\b/,
      Asian:/\b(asian|chinese|japanese|thai|korean|sushi|ramen|pho|hibachi|teriyaki|dim sum)\b/,
      Italian:/\b(italian|pasta|spaghetti|lasagna|ravioli|trattoria|ristorante)\b/,
      BBQ:/\b(bbq|barbecue|smokehouse|smoked|brisket|ribs|pulled pork)\b/,
      Seafood:/\b(seafood|fish house|catfish|shrimp|crab|lobster|oyster|salmon)\b/,
      Breakfast:/\b(breakfast|brunch|pancake|waffle|omelet|omelette|eggs benedict|biscuits and gravy)\b/,
      Southern:/\b(southern|soul food|country cooking|meat and three|comfort food)\b/,
      American:/\b(diner|steakhouse|roadhouse|grill|bistro|pub|tavern|american)\b/,
    'Fast Food':/\b(fast food|quick service|drive thru|drive through)\b/
    };
    for(const [tag,re] of Object.entries(fallbackSignals))if(re.test(nameHay)||re.test(primary))add(tag,'fallback identity');
  }

  const primaryOrder=['Fast Food','Burgers','Pizza','Mexican','Asian','Italian','BBQ','Seafood','Breakfast','Southern','American'];
  if(profile?.blockFastFood){
    tags.delete('Fast Food');
    delete evidence['Fast Food'];
  }
  const primaryCategory=profile?.primary || primaryOrder.find(tag=>tags.has(tag))||null;
  return {tags:[...tags],primary:primaryCategory,evidence};
}

const taxonomy={
  tags:RESTAURANT_TAGS,
  aliases:RESTAURANT_SEARCH_ALIASES,
  aliasToTag:Object.fromEntries(ALIAS_TO_TAG),
  identityProfiles:RESTAURANT_IDENTITY_PROFILES,
  menuSignals:RESTAURANT_MENU_SIGNALS,
  nameSignals:RESTAURANT_NAME_SIGNALS,
  normalizeRestaurantSearch,
  restaurantSearchClassification,
  searchAliasesFor,
  identityHay,
  identityProfile,
  restaurantIdentityKey,
  isFastFood,
  classifyRestaurant,
  primaryCategory:row=>{
    const c=classifyRestaurant(row);
    return c.primary || 'American';
  },
  fillerWords:[...SEARCH_FILLER_WORDS]
};

if(typeof module!=='undefined'&&module.exports)module.exports=taxonomy;
else window.DINLIMINATE_RESTAURANT_TAXONOMY=taxonomy;
})();
