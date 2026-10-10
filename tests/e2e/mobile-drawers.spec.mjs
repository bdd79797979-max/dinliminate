import { test, expect } from '@playwright/test';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const TINY_PNG_DATA = 'data:image/png;base64,' + TINY_PNG.toString('base64');

async function openApp(page) {
  await page.route('**/api/restaurants*', async route => {
    await route.fulfill({
      status:200, contentType:'application/json',
      body:JSON.stringify({
        ok:true, display:'Clarksville, TN', lat:36.53, lon:-87.36,
        radiusMiles:10, searchLatencyMs:2, hoursTimeZone:'America/Chicago',
        providerErrors:[], results:[]
      })
    });
  });
  await page.route('**/api/restaurant-photo*', async route => {
    await route.fulfill({
      status:200, contentType:'application/json',
      body:JSON.stringify({ok:true,url:TINY_PNG_DATA,attributions:[]})
    });
  });
  await page.route('**/api/image*', async route => {
    await route.fulfill({status:200,contentType:'image/png',body:TINY_PNG});
  });
  await page.goto('/');
  await expect(page.locator('html.dinliminate-ready')).toBeAttached({timeout:10000});
  await expect(page.locator('#home')).toBeVisible();
}

async function settled(locator) {
  await expect.poll(() => locator.evaluate(el => {
    const transform=getComputedStyle(el).transform;
    return transform==='none'||transform==='matrix(1, 0, 0, 1, 0, 0)'||transform==='matrix(1,0,0,1,0,0)';
  })).toBe(true);
}

async function expectAnchoredPanel(page, panel, backdrop, closeButton, anchorId) {
  const geometry=await page.evaluate(({panel,backdrop,closeButton,anchorId})=>{
    const p=document.querySelector(panel),bg=document.querySelector(backdrop),trigger=document.getElementById(anchorId);
    const close=document.querySelector(closeButton),logo=document.querySelector('#appTopbar .brand-mark');
    const pr=p.getBoundingClientRect(),tr=trigger.getBoundingClientRect(),cr=close.getBoundingClientRect();
    const br=bg.getBoundingClientRect(),lr=logo.getBoundingClientRect();
    const hit=(el)=>document.elementFromPoint(el.left+el.width/2,el.top+el.height/2);
    return {
      panel:{top:pr.top,right:pr.right,width:pr.width,bottom:pr.bottom},
      trigger:{top:tr.top,bottom:tr.bottom,right:tr.right},
      close:{top:cr.top,right:cr.right},
      backdrop:{top:br.top},
      viewport:{width:document.documentElement.clientWidth,height:window.innerHeight},
      logoHit:hit(lr)?.closest?.('.brand-mark')===logo,
      triggerHit:hit(tr)?.closest?.('#'+anchorId)===trigger,
      topbarVisible:logo.getClientRects().length>0&&getComputedStyle(logo).visibility!=='hidden'
    };
  },{panel,backdrop,closeButton,anchorId});
  expect(geometry.panel.top).toBeCloseTo(geometry.trigger.bottom+4,0);
  expect(Math.abs(geometry.panel.right-geometry.trigger.right)).toBeLessThanOrEqual(1);
  expect(geometry.panel.width).toBeCloseTo(Math.min(geometry.viewport.width*.91,510),0);
  expect(geometry.backdrop.top).toBeCloseTo(geometry.panel.top,0);
  expect(Math.abs(geometry.close.top-geometry.panel.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.close.right-geometry.panel.right)).toBeLessThanOrEqual(1);
  expect(geometry.panel.bottom).toBeLessThanOrEqual(geometry.viewport.height+1);
  expect(geometry.logoHit).toBe(true);
  expect(geometry.triggerHit).toBe(true);
  expect(geometry.topbarVisible).toBe(true);
}

test(' all four phone panels share hamburger anchoring, visible header, and return-to-menu behavior', async ({page})=>{
  await openApp(page);
  const items=[
    {type:'family',menuId:'familyMode',panel:'#family',backdrop:'#familyDrawerBg',close:'#familyCloseTop'},
    {type:'utility',menuId:'manage',panel:'#manageFoodsModal',backdrop:'#manageFoodsModalBg',close:'#manageFoodsModal [data-close]'},
    {type:'utility',menuId:'history',panel:'#historyModal',backdrop:'#historyModalBg',close:'#historyModal [data-close]'},
    {type:'utility',menuId:'settings',panel:'#settingsModal',backdrop:'#settingsModalBg',close:'#settingsModal [data-close]'}
  ];
  await page.locator('#menu').click();
  const drawer=page.locator('#drawer');
  await expect(drawer).toHaveClass(/is-open/);

  for(const item of items){
    await page.locator('#'+item.menuId).click();
    const panel=page.locator(item.panel);
    await expect(panel).toBeVisible();
    await settled(panel);
    await expectAnchoredPanel(page,item.panel,item.backdrop,item.close,'menu');
    await page.locator(item.close).click();
    if(item.type==='family'){
      await expect(page.locator('#family')).toBeHidden({timeout:5000});
    }else{
      await expect(panel).toHaveCount(0,{timeout:5000});
    }
    await expect(drawer).toHaveClass(/is-open/);
    await expect(drawer.locator('.drawer-window')).toHaveCount(4);
  }
});
