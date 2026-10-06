'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const styles=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const viewport=fs.readFileSync(path.join(root,'viewport.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const release=JSON.parse(fs.readFileSync(path.join(root,'app-release.json'),'utf8'));

function assert(name,condition,detail=''){
  if(!condition)throw new Error(name+(detail?': '+detail:''));
}
for(const [name,src] of Object.entries({viewport,app,sw})){
  try{new Function(src);}catch(e){throw new Error(name+' syntax: '+e.message);}
}

assert('viewport-fit cover enabled',/viewport-fit=cover/.test(index));
assert('Apple standalone enabled',index.includes('apple-mobile-web-app-capable')&&index.includes('apple-mobile-web-app-title'));

const shell=styles.slice(styles.lastIndexOf('/* CP1071 — true edge-to-edge iPhone viewport shell.'));
assert('final iPhone shell exists',shell.includes('.app{')&&shell.includes('position:fixed!important;')&&shell.includes('inset:0!important;'));
assert('final shell is edge-to-edge',shell.includes('width:100%!important;')&&shell.includes('min-width:100%!important;')&&shell.includes('max-width:none!important;'));
assert('final shell has legacy viewport fallback',shell.includes('height:100vh!important;')&&shell.includes('min-height:100vh!important;')&&shell.includes('max-height:100vh!important;'));
assert('modern viewport follows fallback',shell.indexOf('height:100vh!important;')<shell.indexOf('height:100dvh!important;'));
assert('visual viewport fallback shell exists',styles.includes('html.dinliminate-visual-mobile .app{'));
assert('mobile screens cannot inherit desktop canvas width',styles.includes('.app > .screen > *{')&&styles.includes('max-width:none;'));

assert('viewport script listens to visualViewport resize',viewport.includes('window.visualViewport?.addEventListener')&&viewport.includes('dinliminate-visual-mobile'));
assert('diagnosis measures the real visible viewport',app.includes('window.visualViewport?.width')&&app.includes('window.visualViewport?.height')&&app.includes('appEl?.getBoundingClientRect?.()')&&app.includes('activeScreen?.getBoundingClientRect?.()'));
assert('safe-area diagnosis is separate',app.includes('Safe-area configuration')&&app.includes('Full iPhone viewport shell')&&app.includes('Active screen geometry'));
assert('diagnosis reports measured mismatch',app.includes('The app shell is not filling the visible viewport'));
assert('desktop viewport is informational',app.includes('Desktop-sized viewport detected'));

assert('CP1087 assets synchronized',index.includes('./app.js?v=1087')&&index.includes('./styles.css?v=1087')&&index.includes('./viewport.js?v=1087')&&sw.includes('dinliminate-shell-v1087')&&sw.includes('./app.js?v=1087'));
assert('CP1087 release metadata',release.build===1087&&release.checkpoint==='CP1087'&&release.vercelProductionVerified===false);

console.log(JSON.stringify({ok:true,edgeToEdgeShell:true,safeAreaSeparated:true,visualViewportFallback:true,measuredGeometryDiagnosis:true,legacyViewportFallback:true,deploymentCreated:false},null,2));
