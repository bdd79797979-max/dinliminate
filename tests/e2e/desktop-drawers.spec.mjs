import { test, expect } from '@playwright/test';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const TINY_PNG_DATA = 'data:image/png;base64,' + TINY_PNG.toString('base64');

async function openApp(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/api/restaurants*', async route => {
    const url = new URL(route.request().url());
    const body = url.searchParams.get('mode') === 'reverse'
      ? { ok:true, display:'Clarksville, TN', lat:36.53, lon:-87.36 }
      : {
          ok:true, display:'Clarksville, TN', lat:36.53, lon:-87.36,
          radiusMiles:10, searchLatencyMs:2, hoursTimeZone:'America/Chicago',
          providerErrors:[], results:[]
        };
    await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(body) });
  });
  await page.route('**/api/restaurant-photo*', async route => {
    await route.fulfill({
      status:200, contentType:'application/json',
      body:JSON.stringify({ ok:true, url:TINY_PNG_DATA, attributions:[] })
    });
  });
  await page.route('**/api/image*', async route => {
    await route.fulfill({ status:200, contentType:'image/png', body:TINY_PNG });
  });
  await page.goto('/');
  await expect(page.locator('#home')).toBeVisible();
  if (page.viewportSize()?.width > 600) {
    await expect.poll(() => page.locator('.app').evaluate(el => getComputedStyle(el).transform)).toBe('none');
    // Emulate Windows classic scrollbars: innerWidth can be 16px wider than
    // the CSS positioning viewport and must not offset fixed drawers.
    await page.evaluate(() => {
      const cssViewportWidth = document.documentElement.clientWidth;
      Object.defineProperty(window, 'innerWidth', {
        configurable:true,
        value:cssViewportWidth + 16
      });
    });
    await expect.poll(() => page.evaluate(() => window.innerWidth - document.documentElement.clientWidth)).toBe(16);
  }
  return errors;
}

async function waitForSettledTransform(locator) {
  await expect.poll(() => locator.evaluate(el => {
    const transform = getComputedStyle(el).transform;
    return transform === 'none'
      || transform === 'matrix(1, 0, 0, 1, 0, 0)'
      || transform === 'matrix(1,0,0,1,0,0)';
  })).toBe(true);
}

async function expectDrawerAnchored(page, panelSelector, triggerId, closeId, maxWidth=400) {
  const geometry = await page.evaluate(({ panelSelector, triggerId, closeId }) => {
    const trigger = document.getElementById(triggerId);
    const panel = document.querySelector(panelSelector);
    const close = document.getElementById(closeId);
    const t = trigger.getBoundingClientRect(), p = panel.getBoundingClientRect(), c = close.getBoundingClientRect();
    return {
      trigger:{ left:t.left, top:t.top, bottom:t.bottom, right:t.right, width:t.width, height:t.height },
      panel:{ top:p.top, right:p.right, left:p.left, width:p.width, height:p.height },
      close:{ top:c.top, right:c.right, width:c.width, height:c.height },
      viewport:{ width:document.documentElement.clientWidth, height:window.innerHeight }
    };
  }, { panelSelector, triggerId, closeId });

  expect(geometry.panel.top, panelSelector+' begins 4px beneath its hamburger')
    .toBeCloseTo(geometry.trigger.bottom + 4, 0);
  expect(Math.abs(geometry.panel.right - geometry.trigger.right), panelSelector+' right edge')
    .toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.close.right - geometry.trigger.right), closeId+' right edge')
    .toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.close.top - geometry.panel.top), closeId+' top edge')
    .toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.close.width - geometry.trigger.width), closeId+' width')
    .toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.close.height - geometry.trigger.height), closeId+' height')
    .toBeLessThanOrEqual(1);
  expect(geometry.panel.width).toBeLessThanOrEqual(maxWidth);
  expect(geometry.panel.width).toBeGreaterThanOrEqual(350);
  expect(geometry.panel.right).toBeLessThanOrEqual(geometry.viewport.width + 1);
}

async function openMenuFrom(page, triggerId) {
  await page.locator('#' + triggerId).click();
  const drawer = page.locator('#drawer');
  await expect(drawer).toHaveClass(/is-open/);
  await waitForSettledTransform(drawer);
  expect(await drawer.getAttribute('data-menu-anchor-id')).toBe(triggerId);
  // The shared menu backdrop begins at the viewport top, but the first menu
  // window and its close control align with the hamburger row.
  const geometry = await page.evaluate((id) => {
    const trigger = document.getElementById(id).getBoundingClientRect();
    const first = document.querySelector('#drawer .drawer-window').getBoundingClientRect();
    const close = document.querySelector('#drawerClose').getBoundingClientRect();
    return {
      trigger:{top:trigger.top,bottom:trigger.bottom,right:trigger.right},
      first:{top:first.top},
      close:{top:close.top,right:close.right}
    };
  }, triggerId);
  expect(Math.abs(geometry.first.top-geometry.trigger.bottom), 'first menu window starts next to its hamburger')
    .toBeLessThanOrEqual(5);
  expect(Math.abs(geometry.close.top-geometry.trigger.top), 'menu close control shares hamburger top')
    .toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.close.right-geometry.trigger.right), 'menu close control shares hamburger right edge')
    .toBeLessThanOrEqual(1);
}

async function openFamilyFrom(page, triggerId) {
  await openMenuFrom(page, triggerId);
  await page.locator('#familyMode').click();
  const family = page.locator('#family');
  await expect(family).toHaveClass(/is-open/);
  await waitForSettledTransform(family);
  await expect(page.locator('#familyDrawerBg')).toHaveClass(/is-open/);
  await expect(page.locator('#drawer')).toBeHidden();
  await expectDrawerAnchored(page, '#family', triggerId, 'familyCloseTop', 520);
  const layers = await page.evaluate((id) => {
    const app = document.querySelector('.app');
    const family = document.querySelector('#family');
    const backdrop = document.querySelector('#familyDrawerBg');
    const trigger = document.getElementById(id);
    const r = trigger.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      panelInsideApp:family.parentElement===app,
      backdropInsideApp:backdrop.parentElement===app,
      panelZ:Number(getComputedStyle(family).zIndex),
      backdropZ:Number(getComputedStyle(backdrop).zIndex),
      triggerStillVisible:hit?.closest?.('#'+id)===trigger,
      width:family.getBoundingClientRect().width
    };
  }, triggerId);
  expect(layers.panelInsideApp).toBe(true);
  expect(layers.backdropInsideApp).toBe(true);
  expect(layers.backdropZ).toBeLessThan(layers.panelZ);
  expect(layers.triggerStillVisible).toBe(true);
  expect(layers.width).toBeCloseTo(510, 0);
}

test('desktop shared menu anchors to the actual Home, Meals and Restaurant hamburger', async ({ page }) => {
  const errors = await openApp(page);

  await openMenuFrom(page, 'menu');
  await page.locator('#drawerClose').click();
  await expect(page.locator('#drawer')).toBeHidden();

  await page.locator('#foodStart').click();
  await expect(page.locator('#food')).toBeVisible();
  await openMenuFrom(page, 'foodMenu');
  await page.locator('#drawerClose').click();
  await expect(page.locator('#drawer')).toBeHidden();

  await page.locator('#foodHomeBack').click();
  await expect(page.locator('#home')).toBeVisible();
  await page.locator('#restStart').click();
  await expect(page.locator('#restaurant')).toBeVisible();
  await openMenuFrom(page, 'restaurantMenu');
  await page.locator('#drawerClose').click();
  await expect(page.locator('#drawer')).toBeHidden();

  expect(errors).toEqual([]);
});

test('desktop Family Mode is a right-side drawer that closes without changing its underlying screen', async ({ page }) => {
  const errors = await openApp(page);

  await openFamilyFrom(page, 'menu');
  await expect(page.locator('#home')).toBeVisible();
  await page.locator('#familyCloseTop').click();
  await expect(page.locator('#family')).toBeHidden();
  await expect(page.locator('#home')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('menu');

  await page.locator('#foodStart').click();
  await expect(page.locator('#food')).toBeVisible();
  await openFamilyFrom(page, 'foodMenu');
  await expect(page.locator('#food')).toBeVisible();
  await page.locator('#familyDrawerBg').click({ position:{ x:20, y:450 } });
  await expect(page.locator('#family')).toBeHidden();
  await expect(page.locator('#food')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('foodMenu');

  await page.locator('#foodHomeBack').click();
  await expect(page.locator('#home')).toBeVisible();
  await page.locator('#restStart').click();
  await expect(page.locator('#restaurant')).toBeVisible();
  await openFamilyFrom(page, 'restaurantMenu');
  await page.keyboard.press('Escape');
  await expect(page.locator('#family')).toBeHidden();
  await expect(page.locator('#restaurant')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('restaurantMenu');

  await openFamilyFrom(page, 'restaurantMenu');
  await page.locator('#familyCloseTop').focus();
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => page.locator('#family').evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#family')).toBeHidden();

  expect(errors).toEqual([]);
});


test('CP1342 all four desktop windows share hamburger alignment, layering, and return-to-menu behavior', async ({ page }) => {
  const errors = await openApp(page);
  const items = [
    { menuId:'manage', modalId:'manageFoodsModal', title:'Manage Meals' },
    { menuId:'history', modalId:'historyModal', title:'History' },
    { menuId:'settings', modalId:'settingsModal', title:'Settings' }
  ];

  for (const item of items) {
    await page.locator('#menu').click();
    await expect(page.locator('#drawer')).toHaveClass(/is-open/);
    await page.locator('#' + item.menuId).click();
    const modal = page.locator('#' + item.modalId);
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-head h3')).toHaveText(item.title);
    await waitForSettledTransform(modal);

    const geometry = await page.evaluate(({ modalId }) => {
      const trigger = document.querySelector('#menu').getBoundingClientRect();
      const panel = document.getElementById(modalId).getBoundingClientRect();
      return {
        trigger:{bottom:trigger.bottom,right:trigger.right},
        panel:{top:panel.top,right:panel.right,bottom:panel.bottom},
        viewport:{width:document.documentElement.clientWidth,height:window.innerHeight}
      };
    }, { modalId:item.modalId });

    expect(geometry.panel.top, item.title + ' starts 4px below the hamburger')
      .toBeCloseTo(geometry.trigger.bottom + 4, 0);
    expect(Math.abs(geometry.panel.right - geometry.trigger.right), item.title + ' right edge follows hamburger')
      .toBeLessThanOrEqual(1);
    expect(geometry.panel.top, item.title + ' is in the upper part of the desktop viewport')
      .toBeLessThan(geometry.viewport.height * .2);
    expect(geometry.panel.bottom, item.title + ' stays inside the viewport')
      .toBeLessThanOrEqual(geometry.viewport.height + 1);
    expect(geometry.panel.width, item.title + ' has the same desktop panel width as Family Mode')
      .toBeCloseTo(510, 0);

    const layering = await page.evaluate(() => {
      const app = document.querySelector('.app');
      const trigger = document.querySelector('#menu');
      const bg = document.querySelector('#manageFoodsModalBg, #historyModalBg, #settingsModalBg');
      const panel = document.querySelector('.utility-modal');
      const r = trigger.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        appOwnsBackdrop:bg?.parentElement===app,
        appOwnsPanel:panel?.parentElement===app,
        backdropZ:Number(getComputedStyle(bg).zIndex),
        headerZ:Number(getComputedStyle(document.querySelector('#appTopbar')).zIndex),
        panelZ:Number(getComputedStyle(panel).zIndex),
        hamburgerRemainsVisible:hit?.closest?.('#menu')===trigger
      };
    });
    expect(layering.appOwnsBackdrop, item.title + ' uses the shared in-app overlay layer').toBe(true);
    expect(layering.appOwnsPanel, item.title + ' uses the shared in-app panel layer').toBe(true);
    expect(layering.backdropZ).toBeLessThan(layering.headerZ);
    expect(layering.headerZ).toBeLessThan(layering.panelZ);
    expect(layering.hamburgerRemainsVisible, item.title + ' keeps the hamburger visible above its backdrop').toBe(true);

    await modal.locator('[data-close]').click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator('#drawer')).toHaveClass(/is-open/);
    await page.locator('#drawerClose').click();
    await expect(page.locator('#drawer')).toBeHidden();
  }
  expect(errors).toEqual([]);
});
