'use strict';

const HOSTS=Object.freeze([
  'irp.cdn-website.com','www.banquet.com','images.pexels.com','images.unsplash.com','commons.wikimedia.org',
  'upload.wikimedia.org','thumb.wikimedia.org','static.spotapps.co','www.goodnes.com','hips.hearstapps.com',
  'calliesbiscuits.com','vinovoss.com','southernbite.com','snapcalorie-webflow-website.s3.us-east-2.amazonaws.com',
  'butterhearth.com','slicelife.imgix.net','cdn.shopify.com','savouryflavor.com','resizer.otstatic.com','kookycrunch.com',
  'cdn.apartmenttherapy.info','www.southernliving.com','shop.barebells.com','b1880159.assetcdn.net',
  'www.mybakingaddiction.com','a.fsimg.co.nz','ourstate.s3.amazonaws.com','whitneybond.com','thedailymeal.com',
  'crockncle.com','www.africanbites.com','www.foodrepublic.com','shop.camelliabrand.com','parade.com',
  'sweetasirem.com','www.sugardale.com','myhomemaderecipe.com','www.finedininglovers.com','img.staticmb.com',
  'recipesclare.com','www.ajsbbq.co.nz','www.pastapiracy.com','www.cooksoups.com','bigbitesedenderry.com','1.bp.blogspot.com'
]);
function isAllowedImageHost(host){return HOSTS.includes(String(host||'').toLowerCase());}
if(typeof module==='object'&&module.exports)module.exports={HOSTS,isAllowedImageHost};
if(typeof self!=='undefined')self.DINLIMINATE_IMAGE_HOSTS=HOSTS;
