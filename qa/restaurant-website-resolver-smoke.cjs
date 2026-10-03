const assert=require('assert/strict');
const handler=require('../api/restaurants');

const test=handler._test||{};
const known=test.knownRestaurantWebsite;
const blocked=test.isBlockedWebsite;
const discoveryHost=test.isDiscoveryHost;
const extractDiscovery=test.extractBingDiscoveryResults;
const extractWeb=test.extractBingWebsiteResults;
const extractLinks=test.extractExternalWebsiteLinks;
const score=test.websitePageScore;
const verify=test.verifiedWebsiteCandidate;
const searchVerify=test.verifiedWebsiteSearchHit;
const resolve=test.resolveOfficialWebsite;
const domainCandidates=test.directWebsiteDomainCandidates;

for(const [name,fn] of Object.entries({
  known,blocked,discoveryHost,extractDiscovery,extractWeb,extractLinks,score,verify,searchVerify,resolve,domainCandidates
}))assert.equal(typeof fn,'function',name+' helper should exist');

// There should be no Camacho-specific hardcoded exception.
assert.equal(known({name:"Camacho's Famous",brand:''}),'','Camacho should be discovered generically, not via a special case.');
const camachoDomains=domainCandidates("Camacho's Famous","1021 Highway 76, Clarksville, TN 37043, Suite 106");
assert.ok(camachoDomains.includes('https://camachosfamous.com'),'Name-derived domain candidate should cover Camacho\'s official domain.');
const chrisDomains=domainCandidates("Chris' Pizza Village - Sango","3383 Highway 41A South, Clarksville, TN 37043");
assert.ok(chrisDomains.includes('https://chrispizzavillagetn.com'),'Name/state-derived domain candidate should cover Chris\' Pizza Village official domain.');


assert.equal(blocked('https://www.facebook.com/camachosfamous'),true,'Facebook is a discovery source, not an accepted website destination.');
assert.equal(blocked('https://www.yelp.com/biz/camachos-famous-clarksville'),true,'Yelp must never be accepted as an official website.');
assert.equal(discoveryHost('https://www.facebook.com/camachosfamous'),true,'Facebook should be allowed as a discovery host.');
assert.equal(discoveryHost('https://www.chamberofcommerce.com/clarksville-tn/example'),true,'Directory bridge should be allowed as a discovery host.');
assert.equal(discoveryHost('https://camachosfamous.com/'),false,'Actual restaurant websites are not discovery-only hosts.');

const bingHtml='<li class="b_algo"><h2><a href="https://www.camachosfamous.com/">Camacho\\'s Famous</a></h2></li>'+
 '<li class="b_algo"><h2><a href="https://www.facebook.com/camachosfamous">Camacho\\'s Famous Facebook</a></h2></li>'+
 '<li class="b_algo"><h2><a href="https://www.yelp.com/biz/camachos-famous-clarksville">Camacho\\'s Famous Yelp</a></h2></li>';
const discovered=extractDiscovery(bingHtml);
assert.equal(discovered.length,3,'Bing discovery parser should retain website and social/directory results.');
assert.equal(discovered.find(x=>x.kind==='website')?.url,'https://www.camachosfamous.com/','Direct website result should remain eligible.');
assert.equal(discovered.find(x=>x.kind==='facebook')?.url,'https://www.facebook.com/camachosfamous','Facebook result should be classified as discovery-only.');
assert.equal(extractWeb(bingHtml).length,1,'Website-only extraction must exclude social/directory hosts.');

const directoryHtml='<html><body><a href="https://camachosfamous.com/">Website</a><a href="https://www.yelp.com/biz/camachos-famous-clarksville">Yelp</a></body></html>';
const outbound=extractLinks(directoryHtml,'https://www.yelp.com/biz/camachos-famous-clarksville');
assert.equal(outbound[0]?.url,'https://camachosfamous.com/','Directory pages may bridge to an external official site.');
assert.equal(blocked(outbound[0]?.url),false,'Bridged official site must not be treated as blocked.');

const camachoHtml='<html><head><title>Camacho\\'s Famous</title></head><body><h1>Camacho\\'s Famous</h1><p>Bringing authentic Chicago-style pizza to Clarksville, TN.</p><p>1021 Highway 76, Clarksville, TN 37043, Suite 106</p><p>(931) 552-1234</p><a href="/contact">Contact</a></body></html>';
const camachoCandidate=verify({url:'https://www.camachosfamous.com/',html:camachoHtml},"Camacho's Famous",'1021 Highway 76, Clarksville, TN 37043, Suite 106','', '(931) 552-1234');
assert.ok(camachoCandidate && camachoCandidate.score>=66,'Exact business page should verify as an official-site candidate.');

const honeyHtml='<html><head><title>HoneyBaked of Clarksville</title></head><body><h1>HoneyBaked of Clarksville</h1><p>Visit our Clarksville store.</p><p>1822 Fort Campbell Blvd, Clarksville, TN 37042</p><p>HoneyBaked meals, sandwiches and catering.</p><a>Locations</a></body></html>';
const honeyCandidate=verify({url:'https://www.honeybaked.com/stores/1822',html:honeyHtml},'HoneyBaked of Clarksville','1822 Fort Campbell Blvd, Clarksville, TN 37042','HoneyBaked');
assert.ok(honeyCandidate,'Exact store page should verify as a local HoneyBaked website.');

const directoryCandidate=verify({url:'https://www.yelp.com/biz/camachos-famous-clarksville',html:directoryHtml},"Camacho's Famous",'1021 Highway 76, Clarksville, TN','');
assert.equal(directoryCandidate,null,'Blocked directory sites must not become official website candidates.');

const hit=searchVerify({
 url:'https://www.thirstygoatsango.com/',
 title:'The Thirsty Goat - Clarksville, TN | Official'
},'The Thirsty Goat','4044 Highway 41A South, Clarksville, TN 37043','');
assert.ok(hit,'Strong search-result identity/domain evidence should work even when the site fetch is unavailable.');

resolve({name:"Wendy's",address:'2800 Wilma Rudolph Blvd, Clarksville, TN 37040',website:'https://www.wendys.com'}).then(result=>{
 assert.equal(result.website,'https://www.wendys.com','Provider website should remain highest-priority source.');
 assert.equal(result.source,'provider','Provider website source should be reported explicitly.');
 console.log('Dinliminate CP655 official web presence resolver smoke: PASS');
}).catch(err=>{console.error(err);process.exit(1)});
