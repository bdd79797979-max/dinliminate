import { test, expect } from '@playwright/test';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const TINY_PNG_DATA = 'data:image/png;base64,' + TINY_PNG.toString('base64');

const MOCK_RESTAURANTS = [
  {
    id: 'mock-pizza',
    name: 'Mock Pizza Kitchen',
    category: 'Pizza',
    cuisine: 'pizza',
    address: '123 Main St, Clarksville, TN 37040',
    lat: 36.531,
    lon: -87.359,
    distance: 0.2,
    photo: TINY_PNG_DATA,
    image: TINY_PNG_DATA,
    images: [TINY_PNG_DATA],
    opening_hours: ''
  },
  {
    id: 'mock-taco',
    name: 'Mock Taco House',
    category: 'Mexican',
    cuisine: 'mexican',
    address: '456 Oak St, Clarksville, TN 37040',
    lat: 36.532,
    lon: -87.358,
    distance: 0.3,
    photo: TINY_PNG_DATA,
    image: TINY_PNG_DATA,
    images: [TINY_PNG_DATA],
    opening_hours: ''
  }
];

async function prepare(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));

  await page.route('**/*', async route => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/restaurants') {
      const mode = url.searchParams.get('mode');
      if (mode === 'reverse') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            display: 'Clarksville, TN',
            lat: 36.53,
            lon: -87.36
          })
        });
        return;
      }
      if (mode === 'search') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            radiusMiles: Number(url.searchParams.get('radius') || 10),
            searchQuery: url.searchParams.get('q') || '',
            searchLatencyMs: 2,
            hoursTimeZone: 'America/Chicago',
            providerErrors: [],
            results: MOCK_RESTAURANTS
          })
        });
        return;
      }
    }

    if (url.pathname === '/api/restaurant-photo') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          url: TINY_PNG_DATA,
          attributions: []
        })
      });
      return;
    }

    if (url.pathname === '/api/image') {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: TINY_PNG
      });
      return;
    }

    if (['images.pexels.com', 'images.unsplash.com', 'commons.wikimedia.org'].includes(url.hostname)) {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: TINY_PNG
      });
      return;
    }

    await route.continue();
  });

  return errors;
}

async function seedMeals(page, count) {
  await page.goto('/');
  await page.locator('#foodStart').click();
  await expect(page.locator('#food')).toBeVisible();
  await expect(page.locator('#foodCard')).toBeVisible();

  const storageKey = await page.evaluate(() =>
    Object.keys(localStorage).find(key => key.startsWith('dinliminate:v1'))
  );
  expect(storageKey).toBeTruthy();

  await page.evaluate(({ key, limit }) => {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    const catalogPool = Array.isArray(saved.pool) ? saved.pool : [];
    if (catalogPool.length < limit) throw new Error('could not seed a deterministic meal pool');

    const keep = catalogPool.slice(0, limit);
    const hidden = new Set(Array.isArray(saved.hidden) ? saved.hidden.map(String) : []);
    for (const row of catalogPool.slice(limit)) hidden.add(String(row.id));

    Object.assign(saved, {
      screen: 'food',
      pool: keep,
      index: 0,
      hidden: [...hidden],
      foodCuts: [],
      maybe: [],
      maybeDeck: false,
      foodMaybeRound: false,
      foodActions: [],
      foodHistory: [],
      cutCats: [],
      deleted: Array.isArray(saved.deleted) ? saved.deleted : [],
      winnerItem: null,
      winnerType: 'food',
      saved: true
    });
    localStorage.setItem(key, JSON.stringify(saved));
  }, { key: storageKey, limit: count });

  await page.reload();
  await expect(page.locator('#food')).toBeVisible();
  await expect(page.locator('#foodCard')).toBeVisible();
  await expect(page.locator('#foodName')).not.toHaveText('');
  await expect(page.locator('#foodMaybeDeck')).toHaveAttribute('data-visible-count', String(count));
}

async function foodCounts(page) {
  return page.locator('#foodMaybeDeck').evaluate(el => ({
    all: el.dataset.allCount,
    maybes: el.dataset.maybeCount,
    visible: el.dataset.visibleCount,
    mode: el.dataset.mode
  }));
}

async function waitForDecisionIdle(page, selector) {
  await expect.poll(
    () => page.locator(selector).getAttribute('data-swipe-transaction'),
    { timeout: 7000 }
  ).not.toBe('active');
}

async function swipeMeal(page, direction) {
  const card = page.locator('#foodCard');
  const before = await page.locator('#foodName').innerText();
  const box = await card.boundingBox();
  expect(box).toBeTruthy();

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const delta = Math.max(125, box.width * 0.42) * (direction === 'left' ? -1 : 1);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + delta, y, { steps: 10 });
  await page.mouse.up();

  await expect.poll(() => page.locator('#foodName').innerText(), { timeout: 7000 })
    .not.toBe(before);

  return before;
}


test('CP1329 decision colors, label-sized gold arrows, and trigger-aligned uniform menu windows', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);

  const mealVisuals = await page.evaluate(() => {
    const box = id => {
      const el = document.querySelector('#' + id), r = el.getBoundingClientRect();
      return { x:r.x, y:r.y, width:r.width, height:r.height, centerY:r.y+r.height/2, fontSize:parseFloat(getComputedStyle(el).fontSize) };
    };
    const color = id => getComputedStyle(document.querySelector('#' + id)).backgroundColor;
    const arrow = document.querySelector('#foodHomeBack svg');
    return {
      cut: color('foodCut'),
      maybe: color('foodMaybe'),
      arrowColor: getComputedStyle(document.querySelector('#foodHomeBack')).color,
      backBackground: getComputedStyle(document.querySelector('#foodHomeBack')).backgroundColor,
      backBorder: getComputedStyle(document.querySelector('#foodHomeBack')).borderWidth,
      backRadius: getComputedStyle(document.querySelector('#foodHomeBack')).borderRadius,
      arrowHasCircle: Boolean(arrow?.querySelector('circle')),
      arrowPath: arrow?.querySelector('path')?.getAttribute('d') || '',
      mealTime: box('foodMealTimeToggle'),
      cuisine: box('foodQuickToggle'),
      maybes: box('foodMaybeDeck')
    };
  });
  expect(mealVisuals.cut).toBe('rgb(239, 51, 64)');
  expect(mealVisuals.maybe).toBe('rgb(40, 199, 111)');
  expect(mealVisuals.arrowColor).toBe('rgb(216, 182, 106)');
  expect(mealVisuals.backBackground).toBe('rgba(0, 0, 0, 0)');
  expect(mealVisuals.backBorder).toBe('0px');
  expect(mealVisuals.backRadius).toBe('0px');
  expect(mealVisuals.arrowHasCircle).toBe(false);
  expect(mealVisuals.arrowPath).toBe('M8.5 1.5 3.5 6l5 4.5');
  expect(await page.locator('#foodHomeBack svg').getAttribute('class')).toBe('home-back-arrowhead');
  const mealArrowBox = await page.locator('#foodHomeBack svg').boundingBox();
  expect(Math.abs(mealArrowBox.width - mealVisuals.mealTime.fontSize)).toBeLessThanOrEqual(0.6);
  expect(Math.abs(mealArrowBox.height - mealVisuals.mealTime.fontSize)).toBeLessThanOrEqual(0.6);
  expect(Math.max(mealVisuals.mealTime.centerY, mealVisuals.cuisine.centerY, mealVisuals.maybes.centerY)
    - Math.min(mealVisuals.mealTime.centerY, mealVisuals.cuisine.centerY, mealVisuals.maybes.centerY)).toBeLessThanOrEqual(3);

  await page.locator('#foodMenu').click();
  await expect(page.locator('#drawer')).toBeVisible();
  await expect.poll(() => page.locator('#drawer').evaluate(el => {
    const t=getComputedStyle(el).transform;
    return t==='none'||t==='matrix(1, 0, 0, 1, 0, 0)'||t==='matrix(1,0,0,1,0,0)';
  })).toBe(true);
  const triggerBox = await page.locator('#foodMenu').boundingBox();
  const drawerHead = await page.locator('#drawer .drawer-head').boundingBox();
  const closeBox = await page.locator('#drawerClose').boundingBox();
  const rows = await page.locator('#drawer .drawer-window').evaluateAll(els => els.map(el => {
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return {id:el.id,y:r.y,height:r.height,radius:s.borderRadius,border:s.borderWidth+' '+s.borderStyle+' '+s.borderColor,background:s.backgroundColor+'|'+s.backgroundImage,padding:s.padding,isWindow:el.classList.contains('drawer-window')};
  }));
  const firstMenuRow = await page.locator('#drawer .drawer-window').first().boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(drawerHead).not.toBeNull();
  expect(closeBox).not.toBeNull();
  expect(firstMenuRow).not.toBeNull();
  expect(rows.map(r=>r.id)).toEqual(['familyMode','manage','history','settings']);
  expect(Math.abs(closeBox.y-triggerBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs((closeBox.x+closeBox.width)-(triggerBox.x+triggerBox.width))).toBeLessThanOrEqual(1);
  expect(firstMenuRow.y-(triggerBox.y+triggerBox.height)).toBeGreaterThanOrEqual(2);
  expect(firstMenuRow.y-(triggerBox.y+triggerBox.height)).toBeLessThanOrEqual(5);
  expect(Math.abs(closeBox.width-triggerBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(closeBox.height-triggerBox.height)).toBeLessThanOrEqual(1);
  expect(rows.every(r=>r.isWindow && r.height===54 && r.radius==='10px' && r.border===rows[0].border && r.background===rows[0].background && r.padding===rows[0].padding)).toBe(true);
  await page.locator('#drawerClose').click();

  await page.evaluate(() => localStorage.clear());
  await openRestaurants(page);
  await page.locator('#restaurantMenu').click();
  await expect.poll(() => page.locator('#drawer').evaluate(el => {
    const t=getComputedStyle(el).transform;
    return t==='none'||t==='matrix(1, 0, 0, 1, 0, 0)'||t==='matrix(1,0,0,1,0,0)';
  })).toBe(true);
  const restaurantTriggerBox = await page.locator('#restaurantMenu').boundingBox();
  const restaurantCloseBox = await page.locator('#drawerClose').boundingBox();
  const restaurantFirstWindow = await page.locator('#drawer .drawer-window').first().boundingBox();
  expect(restaurantTriggerBox).not.toBeNull();
  expect(restaurantCloseBox).not.toBeNull();
  expect(restaurantFirstWindow).not.toBeNull();
  expect(Math.abs(restaurantCloseBox.y-restaurantTriggerBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs((restaurantCloseBox.x+restaurantCloseBox.width)-(restaurantTriggerBox.x+restaurantTriggerBox.width))).toBeLessThanOrEqual(1);
  expect(restaurantFirstWindow.y-(restaurantTriggerBox.y+restaurantTriggerBox.height)).toBeGreaterThanOrEqual(2);
  expect(restaurantFirstWindow.y-(restaurantTriggerBox.y+restaurantTriggerBox.height)).toBeLessThanOrEqual(5);
  await page.locator('#drawerClose').click();
  const restaurantVisuals = await page.evaluate(() => {
    const box = id => {
      const r = document.querySelector('#' + id).getBoundingClientRect();
      return { centerY:r.y+r.height/2 };
    };
    return {
      cut: getComputedStyle(document.querySelector('#restCut')).backgroundColor,
      maybe: getComputedStyle(document.querySelector('#restMaybe')).backgroundColor,
      cuisine: box('restaurantQuickToggle'),
      maybes: box('restaurantMaybeDeck')
    };
  });
  expect(restaurantVisuals.cut).toBe('rgb(239, 51, 64)');
  expect(restaurantVisuals.maybe).toBe('rgb(40, 199, 111)');
  const restaurantArrowBox = await page.locator('#restaurantHomeBack svg').boundingBox();
  const restaurantLabelSize = await page.locator('#restaurantQuickToggle').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(Math.abs(restaurantArrowBox.width - restaurantLabelSize)).toBeLessThanOrEqual(0.6);
  expect(Math.abs(restaurantArrowBox.height - restaurantLabelSize)).toBeLessThanOrEqual(0.6);
  const restaurantBackStyles = await page.locator('#restaurantHomeBack').evaluate(el => {
    const css = getComputedStyle(el);
    return { color: css.color, background: css.backgroundColor, border: css.borderWidth, radius: css.borderRadius };
  });
  expect(restaurantBackStyles.color).toBe('rgb(216, 182, 106)');
  expect(restaurantBackStyles.background).toBe('rgba(0, 0, 0, 0)');
  expect(restaurantBackStyles.border).toBe('0px');
  expect(restaurantBackStyles.radius).toBe('0px');
  expect(Math.abs(restaurantVisuals.cuisine.centerY - restaurantVisuals.maybes.centerY)).toBeLessThanOrEqual(3);
  await expectNoPageErrors(errors);
});

test('swipe machine rejects rapid double-swipes as one transaction', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);
  const card = page.locator('#foodCard');
  const box = await card.boundingBox();
  expect(box).toBeTruthy();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.evaluate(({ x, y }) => {
    const card = document.querySelector('#foodCard');
    const fire = (type,id,cx) => card.dispatchEvent(new PointerEvent(type,{bubbles:true,isPrimary:true,button:0,pointerId:id,clientX:cx,clientY:y}));
    fire('pointerdown',1,x);
    fire('pointermove',1,x-180);
    fire('pointerup',1,x-180);
    fire('pointerdown',2,x);
    fire('pointermove',2,x-180);
    fire('pointerup',2,x-180);
  }, { x, y });
  await expect.poll(() => page.locator('#foodMaybeDeck').getAttribute('data-all-count'), { timeout: 7000 }).toBe('2');
  await waitForDecisionIdle(page, '#foodCard');
  await expectNoPageErrors(errors);
});

test('Cut button during a drag uses the same commit transaction path', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);
  const before = await foodCounts(page);
  const card = page.locator('#foodCard');
  const box = await card.boundingBox();
  expect(box).toBeTruthy();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.evaluate(({ x, y }) => {
    const card = document.querySelector('#foodCard');
    card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,isPrimary:true,button:0,pointerId:7,clientX:x,clientY:y}));
    card.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,isPrimary:true,button:0,pointerId:7,clientX:x-30,clientY:y}));
    document.querySelector('#foodCut')?.click();
    card.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,isPrimary:true,button:0,pointerId:7,clientX:x-30,clientY:y}));
  }, { x, y });
  await expect.poll(() => page.locator('#foodMaybeDeck').getAttribute('data-all-count'), { timeout: 7000 }).toBe(String(Number(before.all)-1));
  await waitForDecisionIdle(page, '#foodCard');
  await expectNoPageErrors(errors);
});

test('interrupted drag settles without committing a meal', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);
  const beforeName = await page.locator('#foodName').innerText();
  const before = await foodCounts(page);
  const card = page.locator('#foodCard');
  const box = await card.boundingBox();
  expect(box).toBeTruthy();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.evaluate(({ x, y }) => {
    const card = document.querySelector('#foodCard');
    card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,isPrimary:true,button:0,pointerId:9,clientX:x,clientY:y}));
    card.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,isPrimary:true,button:0,pointerId:9,clientX:x-35,clientY:y}));
    card.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,isPrimary:true,pointerId:9,clientX:x-35,clientY:y}));
  }, { x, y });
  await expect.poll(() => card.getAttribute('data-swipe-phase'), { timeout: 3000 }).toBe('idle');
  expect(await page.locator('#foodName').innerText()).toBe(beforeName);
  expect(await foodCounts(page)).toEqual(before);
  await expectNoPageErrors(errors);
});

async function openRestaurants(page) {
  await page.goto('/');
  await page.locator('#restStart').click();
  await expect(page.locator('#restaurant')).toBeVisible();
  await expect.poll(
    () => page.locator('#restaurantMaybeDeck').getAttribute('data-all-count'),
    { timeout: 12000 }
  ).toBe('2');
}

async function expectNoPageErrors(errors) {
  expect(errors).toEqual([]);
}

test('swiping left cuts the active meal', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);

  const before = await foodCounts(page);
  const removed = await swipeMeal(page, 'left');
  const after = await foodCounts(page);

  expect(after.all).toBe(String(Number(before.all) - 1));
  expect(after.maybes).toBe('0');
  expect(await page.locator('#foodName').innerText()).not.toBe(removed);

  await expectNoPageErrors(errors);
});

test('swiping right adds the meal to Maybes and advances', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);

  const beforeName = await page.locator('#foodName').innerText();
  await swipeMeal(page, 'right');

  const after = await foodCounts(page);
  expect(after.all).toBe('3');
  expect(after.maybes).toBe('1');
  expect(after.visible).toBe('3');
  expect(await page.locator('#foodName').innerText()).not.toBe(beforeName);

  await expectNoPageErrors(errors);
});

test('Cut button removes the active meal', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);

  const before = await foodCounts(page);
  await page.locator('#foodCut').click();

  await expect.poll(() => page.locator('#foodMaybeDeck').getAttribute('data-all-count'))
    .toBe(String(Number(before.all) - 1));
  await waitForDecisionIdle(page, '#foodCard');

  await expectNoPageErrors(errors);
});

test('Maybe button marks the active meal and advances', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);

  const beforeName = await page.locator('#foodName').innerText();
  await page.locator('#foodMaybe').click();

  await expect.poll(() => page.locator('#foodMaybeDeck').getAttribute('data-maybe-count'))
    .toBe('1');
  await waitForDecisionIdle(page, '#foodCard');
  await expect.poll(() => page.locator('#foodName').innerText()).not.toBe(beforeName);

  await expectNoPageErrors(errors);
});


test('Maybe review continuously cycles Meals after the last undecided card', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);
  const ids = await page.evaluate(async () => {
    const { store } = await import('/src/state/store.js');
    return store.get().pool.map(row => String(row.id));
  });
  expect(ids.length).toBe(3);

  for (let index = 0; index < 3; index++) {
    await page.locator('#foodMaybe').click();
    await waitForDecisionIdle(page, '#foodCard');
    await expect.poll(() => page.locator('#foodCard').getAttribute('data-meal-id'), { timeout: 7000 })
      .toBe(ids[(index + 1) % 3]);
  }

  // All three are retained, so reviewing MAYBES now wraps continuously A → B → C → A.
  await expect(page.locator('#foodMaybeDeck')).toHaveAttribute('data-maybe-count', '3');
  for (const expectedId of [ids[1], ids[2], ids[0], ids[1]]) {
    await page.locator('#foodMaybe').click();
    await waitForDecisionIdle(page, '#foodCard');
    await expect.poll(() => page.locator('#foodCard').getAttribute('data-meal-id'), { timeout: 7000 })
      .toBe(expectedId);
    await expect(page.locator('#winner')).toBeHidden();
  }
  await expectNoPageErrors(errors);
});

test('Maybe review continuously cycles Restaurants after the last undecided result', async ({ page }) => {
  const errors = await prepare(page);
  await openRestaurants(page);
  await expect(page.locator('#restaurantCard h3')).toHaveText('Mock Pizza Kitchen');

  await page.locator('#restMaybe').click();
  await waitForDecisionIdle(page, '#restaurantCard');
  await expect.poll(() => page.locator('#restaurantCard h3').innerText(), { timeout: 12000 })
    .toBe('Mock Taco House');
  await page.locator('#restMaybe').click();
  await waitForDecisionIdle(page, '#restaurantCard');
  await expect.poll(() => page.locator('#restaurantCard h3').innerText(), { timeout: 12000 })
    .toBe('Mock Pizza Kitchen');

  for (const expectedName of ['Mock Taco House', 'Mock Pizza Kitchen', 'Mock Taco House']) {
    await page.locator('#restMaybe').click();
    await waitForDecisionIdle(page, '#restaurantCard');
    await expect.poll(() => page.locator('#restaurantCard h3').innerText(), { timeout: 12000 })
      .toBe(expectedName);
    await expect(page.locator('#winner')).toBeHidden();
  }
  await expectNoPageErrors(errors);
});

test('CP1336 phone swipe controls retain size with a tighter spread and verify address overlay/card height', async ({ page }) => {
  const errors = await prepare(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMeals(page, 3);

  async function expectFullWidthDecisionRow(selector) {
    const layout = await page.locator(selector).evaluate(el => {
      const row = el.getBoundingClientRect();
      const buttons = [...el.querySelectorAll(':scope > .round-action')].map(button => {
        const r = button.getBoundingClientRect();
        return { left:r.left, right:r.right, center:r.left+r.width/2, width:r.width };
      });
      return {
        row:{left:row.left,right:row.right,width:row.width},
        viewportWidth:window.innerWidth,
        buttons
      };
    });
    expect(layout.buttons).toHaveLength(4);
    expect(layout.row.width).toBeGreaterThanOrEqual(layout.viewportWidth - 24);
    expect(layout.buttons[0].left - layout.row.left).toBeGreaterThanOrEqual(18);
    expect(layout.buttons[0].left - layout.row.left).toBeLessThanOrEqual(22);
    expect(layout.row.right - layout.buttons[3].right).toBeGreaterThanOrEqual(18);
    expect(layout.row.right - layout.buttons[3].right).toBeLessThanOrEqual(22);
    const spread = layout.buttons[3].center - layout.buttons[0].center;
    expect(spread).toBeGreaterThan(layout.row.width * 0.72);
    expect(spread).toBeLessThan(layout.row.width * 0.84);
    for (let i=1;i<layout.buttons.length;i++) {
      expect(layout.buttons[i].left).toBeGreaterThanOrEqual(layout.buttons[i-1].right - 1);
    }
  }

  async function expectTallerCard(stackSelector, cardSelector) {
    const metrics = await page.evaluate(({ stackSelector, cardSelector }) => {
      const stack = document.querySelector(stackSelector);
      const card = document.querySelector(cardSelector);
      return {
        viewportHeight:window.innerHeight,
        stackMaxHeight:parseFloat(getComputedStyle(stack).maxHeight),
        cardMaxHeight:parseFloat(getComputedStyle(card).maxHeight)
      };
    }, { stackSelector, cardSelector });
    expect(metrics.stackMaxHeight).toBeGreaterThan(metrics.viewportHeight * 0.70);
    expect(metrics.cardMaxHeight).toBeGreaterThan(metrics.viewportHeight * 0.70);
  }
  async function expectStyledBack(selector) {
    const style = await page.locator(selector).evaluate(el => {
      const css=getComputedStyle(el), rect=el.getBoundingClientRect();
      return {width:rect.width,height:rect.height,color:css.color,backgroundImage:css.backgroundImage,borderColor:css.borderColor,opacity:parseFloat(css.opacity)};
    });
    expect(style.width).toBe(42);
    expect(style.height).toBe(42);
    expect(style.color).toBe('rgb(232, 200, 126)');
    expect(style.backgroundImage).toContain('linear-gradient');
    expect(style.borderColor).toBe('rgb(154, 126, 78)');
    expect(style.opacity).toBeGreaterThanOrEqual(0.5);
  }

  await expectFullWidthDecisionRow('#food .unified-swipe-actions');
  await expectStyledBack('#foodBack');
  await expectTallerCard('#food .swipe-card-stack', '#foodCard');

  await page.evaluate(() => localStorage.clear());
  await openRestaurants(page);
  await expectFullWidthDecisionRow('#restaurant .unified-swipe-actions');
  await expectStyledBack('#restBack');
  await expectTallerCard('#restaurant .restaurant-card-stack', '#restaurantCard');

  const overlay = await page.evaluate(() => {
    const dropdown=document.querySelector('#suggestionsBox');
    const quick=document.querySelector('#restaurant .restaurant-quick-section');
    dropdown.hidden=false;
    dropdown.style.display='block';
    dropdown.replaceChildren();
    for(let index=0;index<4;index++){
      const item=document.createElement('button');
      item.type='button';
      item.dataset.testSuggestion=String(index);
      item.textContent='Suggested address '+index;
      item.style.cssText='display:block;position:relative;width:100%;height:70px;padding:8px;';
      dropdown.appendChild(item);
    }
    const box=dropdown.getBoundingClientRect();
    const candidates=[...quick.querySelectorAll('button')]
      .filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')
      .map(el=>{
        const r=el.getBoundingClientRect();
        const left=Math.max(box.left,r.left),right=Math.min(box.right,r.right);
        const top=Math.max(box.top,r.top),bottom=Math.min(box.bottom,r.bottom);
        return {area:Math.max(0,right-left)*Math.max(0,bottom-top),left,right,top,bottom};
      })
      .filter(row=>row.area>0).sort((a,b)=>b.area-a.area);
    if(!candidates.length)return {intersects:false};
    const area=candidates[0];
    const hit=document.elementFromPoint((area.left+area.right)/2,(area.top+area.bottom)/2);
    return {
      intersects:true,
      targetIsSuggestion:Boolean(hit?.closest('#suggestionsBox [data-test-suggestion]')),
      stripZ:Number.parseInt(getComputedStyle(document.querySelector('#restaurant .location-strip')).zIndex,10),
      quickZ:Number.parseInt(getComputedStyle(quick).zIndex,10),
      suggestionsZ:Number.parseInt(getComputedStyle(dropdown).zIndex,10)
    };
  });
  expect(overlay.intersects).toBe(true);
  expect(overlay.targetIsSuggestion).toBe(true);
  expect(overlay.stripZ).toBeGreaterThan(overlay.quickZ);
  expect(overlay.suggestionsZ).toBeGreaterThan(overlay.quickZ);
  await expectNoPageErrors(errors);
});

test('decision counts track Cut and Maybe independently', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);

  expect(await foodCounts(page)).toEqual({ all: '3', maybes: '0', visible: '3', mode: 'all' });

  await page.locator('#foodMaybe').click();
  await expect.poll(() => page.locator('#foodMaybeDeck').getAttribute('data-maybe-count')).toBe('1');
  await waitForDecisionIdle(page, '#foodCard');
  expect(await foodCounts(page)).toEqual({ all: '3', maybes: '1', visible: '3', mode: 'all' });

  await page.locator('#foodCut').click();
  await expect.poll(() => page.locator('#foodMaybeDeck').getAttribute('data-all-count')).toBe('2');
  await waitForDecisionIdle(page, '#foodCard');
  expect(await foodCounts(page)).toEqual({ all: '2', maybes: '1', visible: '2', mode: 'all' });

  await expectNoPageErrors(errors);
});

test('Maybes view contains only retained meals', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);

  const maybeName = await page.locator('#foodName').innerText();
  await page.locator('#foodMaybe').click();
  await expect.poll(() => page.locator('#foodMaybeDeck').getAttribute('data-maybe-count')).toBe('1');
  await waitForDecisionIdle(page, '#foodCard');

  await page.locator('#foodMaybeDeck').click();
  await expect(page.locator('#foodMaybeDeck')).toHaveAttribute('data-mode', 'maybe');
  await expect(page.locator('#foodMaybeDeck')).toHaveAttribute('data-visible-count', '1');
  await expect.poll(() => page.locator('#foodName').innerText()).toBe(maybeName);

  await expectNoPageErrors(errors);
});

test('the last surviving meal can become the winner', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 2);

  await page.locator('#foodCut').click();
  await expect.poll(() => page.locator('#foodMaybeDeck').getAttribute('data-all-count')).toBe('1');
  await waitForDecisionIdle(page, '#foodCard');
  const survivor = await page.locator('#foodName').innerText();

  await page.locator('#foodChoose').click();
  await expect(page.locator('#winner')).toBeVisible();
  await expect(page.locator('#winName')).toHaveText(survivor);

  await expectNoPageErrors(errors);
});

test('restaurant search displays the mocked API result', async ({ page }) => {
  const errors = await prepare(page);
  await openRestaurants(page);

  await page.locator('#restaurantSearchToggle').click();
  await page.locator('#restaurantQuery').fill('Pizza');
  await page.locator('#restaurantQuery').press('Enter');

  await expect(page.locator('#restaurantCard h3')).toHaveText('Mock Pizza Kitchen');
  await expect(page.locator('#restaurantMaybeDeck')).toHaveAttribute('data-all-count', '1');

  await expectNoPageErrors(errors);
});

test('meal decision state survives reload', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);

  await page.locator('#foodMaybe').click();
  await expect.poll(() => page.locator('#foodMaybeDeck').getAttribute('data-maybe-count')).toBe('1');
  await waitForDecisionIdle(page, '#foodCard');
  const beforeName = await page.locator('#foodName').innerText();
  const before = await foodCounts(page);

  await page.reload();
  await expect(page.locator('#food')).toBeVisible();
  await expect.poll(() => page.locator('#foodName').innerText()).toBe(beforeName);
  expect(await foodCounts(page)).toEqual(before);

  await expectNoPageErrors(errors);
});

test('restaurant decision state survives reload', async ({ page }) => {
  const errors = await prepare(page);
  await openRestaurants(page);

  await page.locator('#restMaybe').click();
  await expect.poll(() => page.locator('#restaurantMaybeDeck').getAttribute('data-maybe-count')).toBe('1');
  await expect.poll(async () => page.evaluate(() => {
    const key = Object.keys(localStorage).find(value => value.startsWith('dinliminate:v1'));
    if (!key) return 0;
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    return Array.isArray(saved.restaurantPool) ? saved.restaurantPool.filter(row => row._maybe).length : 0;
  })).toBe(1);

  const beforeAll = await page.locator('#restaurantMaybeDeck').getAttribute('data-all-count');
  const beforeMaybe = await page.locator('#restaurantMaybeDeck').getAttribute('data-maybe-count');

  await page.reload();
  await expect(page.locator('#restaurant')).toBeVisible();
  await expect.poll(() => page.locator('#restaurantMaybeDeck').getAttribute('data-all-count'), { timeout: 12000 }).toBe('2');
  await expect(page.locator('#restaurantMaybeDeck')).toHaveAttribute('data-maybe-count', beforeMaybe);
  expect(await page.locator('#restaurantMaybeDeck').getAttribute('data-all-count')).toBe(beforeAll);

  await expectNoPageErrors(errors);
});


test('Home door background remains confined to the Home route', async ({ page }) => {
  const errors = await prepare(page);
  const readBackgroundState = () => page.evaluate(() => {
    const app = document.querySelector('.app');
    const home = document.querySelector('#home');
    return {
      homeActive: app.classList.contains('home-active'),
      appBackground: getComputedStyle(app).backgroundImage,
      homeBackground: getComputedStyle(home).backgroundImage,
      homeDisplay: getComputedStyle(home).display,
      foodDisplay: getComputedStyle(document.querySelector('#food')).display,
      restaurantDisplay: getComputedStyle(document.querySelector('#restaurant')).display,
      winnerDisplay: getComputedStyle(document.querySelector('#winner')).display
    };
  });

  await page.goto('/');
  await expect(page.locator('#home')).toBeVisible();
  let state = await readBackgroundState();
  expect(state.homeActive).toBe(true);
  expect(state.homeBackground).toContain('home-door.jpg');
  expect(state.appBackground).not.toContain('home-door.jpg');

  await page.locator('#foodStart').click();
  await expect(page.locator('#food')).toBeVisible();
  await expect(page.locator('#home')).toBeHidden();
  state = await readBackgroundState();
  expect(state.homeActive).toBe(false);
  expect(state.appBackground).not.toContain('home-door.jpg');
  expect(state.homeDisplay).toBe('none');
  expect(state.foodDisplay).not.toBe('none');

  await page.locator('#foodChoose').click();
  await expect(page.locator('#winner')).toBeVisible();
  state = await readBackgroundState();
  expect(state.appBackground).not.toContain('home-door.jpg');
  expect(state.homeDisplay).toBe('none');
  expect(state.winnerDisplay).not.toBe('none');

  await page.evaluate(() => localStorage.clear());
  await openRestaurants(page);
  state = await readBackgroundState();
  expect(state.homeActive).toBe(false);
  expect(state.appBackground).not.toContain('home-door.jpg');
  expect(state.homeDisplay).toBe('none');
  expect(state.restaurantDisplay).not.toBe('none');
  await expectNoPageErrors(errors);
});

test('Meal and Restaurant decision controls stay aligned, visible, and styled across viewports', async ({ page }) => {
  const errors = await prepare(page);
  const viewport = page.viewportSize();
  async function expectDecisionRow(ids) {
    const boxes = [];
    for (const id of ids) {
      const control = page.locator('#' + id);
      await expect(control, '#' + id + ' should be visible at ' + viewport.width + 'px').toBeVisible();
      const box = await control.boundingBox();
      expect(box, '#' + id + ' should have a rendered box').not.toBeNull();
      expect(box.width, '#' + id + ' width').toBeGreaterThanOrEqual(40);
      expect(box.height, '#' + id + ' height').toBeGreaterThanOrEqual(40);
      expect(box.x, '#' + id + ' left edge').toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, '#' + id + ' right edge').toBeLessThanOrEqual(viewport.width + 1);
      const style = await control.evaluate(el => {
        const css = getComputedStyle(el);
        return { backgroundColor: css.backgroundColor, backgroundImage: css.backgroundImage, borderRadius: css.borderRadius };
      });
      expect(style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none',
        '#' + id + ' should have its intentional button treatment').toBe(true);
      expect(style.borderRadius).not.toBe('0px');
      boxes.push(box);
    }
    for (let index = 1; index < boxes.length; index++) {
      expect(boxes[index].x, ids[index] + ' should follow ' + ids[index - 1])
        .toBeGreaterThanOrEqual(boxes[index - 1].x + boxes[index - 1].width - 1);
    }
    const centers = boxes.map(box => box.y + box.height / 2);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(16);
  }

  await seedMeals(page, 3);
  await expectDecisionRow(['foodBack', 'foodCut', 'foodMaybe', 'foodChoose']);

  await page.evaluate(() => localStorage.clear());
  await openRestaurants(page);
  await expectDecisionRow(['restBack', 'restCut', 'restMaybe', 'restChoose']);
  await expectNoPageErrors(errors);
});

test('CP1325 active and waiting Meal cards advance together without repeating previews', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 5);
  const expectedIds = await page.evaluate(async () => {
    const { store } = await import('/src/state/store.js');
    return store.get().pool.map(row => String(row.id));
  });
  expect(expectedIds.length).toBe(5);
  const removedIds = [];

  async function expectCardReadyForNextSwipe() {
    await expect(page.locator('#foodCard')).toBeVisible();
    await expect.poll(() => page.locator('#foodCard').evaluate(el => {
      const css = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return css.visibility === 'visible'
        && Number(css.opacity) > 0.99
        && css.pointerEvents === 'auto'
        // The card stack intentionally bleeds up to 10px beyond its stage.
        // Allow that edge treatment but reject an inherited fly-off transform.
        && rect.left >= -12
        && rect.right <= window.innerWidth + 12;
    }), { timeout: 12000 }).toBe(true);
  }

  for (let index = 0; index < 4; index++) {
    await waitForDecisionIdle(page, '#foodCard');
    await expectCardReadyForNextSwipe();
    const currentId = await page.locator('#foodCard').getAttribute('data-meal-id');
    expect(currentId).toBe(expectedIds[index]);
    expect(removedIds).not.toContain(currentId);
    removedIds.push(currentId);

    // The waiting card must advance as well; this catches the stale-preview bug
    // where B remains beneath later active cards C and D.
    await expect.poll(() => page.locator('#foodNextCard').getAttribute('data-meal-id'), { timeout: 12000 })
      .toBe(expectedIds[index + 1]);
    await expect.poll(() => page.locator('#foodNextCard').getAttribute('data-food-ready'), { timeout: 12000 })
      .toBe('1');

    await swipeMeal(page, 'left');
    await expect.poll(() => page.locator('#foodCard').getAttribute('data-meal-id'), { timeout: 12000 })
      .toBe(expectedIds[index + 1]);
    if (index < 3) {
      await expect.poll(() => page.locator('#foodNextCard').getAttribute('data-meal-id'), { timeout: 12000 })
        .toBe(expectedIds[index + 2]);
      await expect.poll(() => page.locator('#foodNextCard').getAttribute('data-food-ready'), { timeout: 12000 })
        .toBe('1');
    }
  }

  await waitForDecisionIdle(page, '#foodCard');
  await expectCardReadyForNextSwipe();
  const survivorId = await page.locator('#foodCard').getAttribute('data-meal-id');
  expect(survivorId).toBeTruthy();
  expect(removedIds).not.toContain(survivorId);
  await expect(page.locator('#foodMaybeDeck')).toHaveAttribute('data-all-count', '1');
  await expectNoPageErrors(errors);
});


test('CP1328 waiting Meal window advances before a slow active-card photo resolves', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 4);
  const target = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(value => value.startsWith('dinliminate:v1'));
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    const row = saved.pool?.[1];
    return {
      id: String(row?.id || ''),
      name: String(row?.name || ''),
      urls: [row?.officialImage, row?.image, row?.backupImage, ...(Array.isArray(row?.images) ? row.images : [])]
        .filter(value => typeof value === 'string' && /^https:\/\//i.test(value))
    };
  });
  expect(target.id).toBeTruthy();
  const targetPaths = new Set(target.urls.map(value => new URL(value).pathname));
  expect(targetPaths.size).toBeGreaterThan(0);
  const expectedIds = await page.evaluate(async () => {
    const { store } = await import('/src/state/store.js');
    return store.get().pool.map(row => String(row.id));
  });
  expect(expectedIds.length).toBe(4);

  let releaseTargetPhoto;
  const gate = new Promise(resolve => { releaseTargetPhoto = resolve; });
  let delayedRequests = 0;
  await page.route(url => {
    const remote = url.searchParams.get('url') || '';
    if (url.pathname !== '/api/image' || url.searchParams.get('meal') !== '1' || !remote) return false;
    try { return targetPaths.has(new URL(remote).pathname); }
    catch { return false; }
  }, async route => {
    delayedRequests += 1;
    await gate;
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'cache-control': 'no-store' },
      body: TINY_PNG
    });
  });

  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#food')).toBeVisible();
    await expect(page.locator('#foodCard')).toBeVisible();
    await expect(page.locator('#foodCard')).toHaveAttribute('data-meal-id', expectedIds[0]);
    await expect.poll(() => page.locator('#foodImg').evaluate(img =>
      img.dataset.mealPhotoLoaded === 'true' && img.complete && img.naturalWidth > 0
    ), { timeout: 12000 }).toBe(true);
    await expect.poll(() => delayedRequests).toBeGreaterThan(0);

    const card = page.locator('#foodCard');
    const box = await card.boundingBox();
    expect(box).toBeTruthy();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const delta = Math.max(125, box.width * 0.42);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - delta, y, { steps: 10 });
    await page.mouse.up();

    await expect(card).toHaveAttribute('data-meal-id', expectedIds[1]);
    await expect(card).toHaveAttribute('data-media-pending', 'true');
    await expect.poll(() => page.locator('#foodNextCard').getAttribute('data-meal-id'), { timeout: 3000 })
      .toBe(expectedIds[2]);
    await expect.poll(() => page.locator('#foodNextCard').getAttribute('data-preview-render-sequence'))
      .not.toBeNull();
  } finally {
    releaseTargetPhoto();
  }

  await expect.poll(() => page.locator('#foodCard').getAttribute('data-media-pending'), { timeout: 12000 }).toBe(null);
  await expect.poll(() => page.locator('#foodNextCard').getAttribute('data-meal-id'), { timeout: 7000 })
    .toBe(expectedIds[2]);
  await expectNoPageErrors(errors);
});


test('Meal handoff keeps the next card hidden until its matching photo is ready', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 5);

  const target = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(value => value.startsWith('dinliminate:v1'));
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    const row = saved.pool?.[4];
    return {
      id: row?.id,
      urls: [row?.officialImage, row?.image, row?.backupImage, ...(Array.isArray(row?.images) ? row.images : [])]
        .filter(value => typeof value === 'string' && /^https:\/\//i.test(value))
    };
  });
  expect(target.id).toBeTruthy();
  const targetPaths = new Set(target.urls.map(value => new URL(value).pathname));
  expect(targetPaths.size).toBeGreaterThan(0);

  // The default visual preloader warms only the next three cards. Target the
  // fifth seeded meal and hold its request behind a gate for deterministic
  // control over the pending-photo interval.
  let releaseTargetPhoto;
  const targetPhotoGate = new Promise(resolve => { releaseTargetPhoto = resolve; });
  let delayedRequests = 0;
  await page.route(url => {
    const remote = url.searchParams.get('url') || '';
    if (url.pathname !== '/api/image' || url.searchParams.get('meal') !== '1' || !remote) return false;
    try { return targetPaths.has(new URL(remote).pathname); }
    catch { return false; }
  }, async route => {
    delayedRequests += 1;
    await targetPhotoGate;
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'cache-control': 'no-store' },
      body: TINY_PNG
    });
  });

  for (let index = 0; index < 4; index++) {
    await expect(page.locator('#foodCard')).toBeVisible();
    await expect.poll(() => page.locator('#foodCard').evaluate(el => {
      const css = getComputedStyle(el);
      return css.visibility === 'visible' && css.pointerEvents === 'auto';
    }), { timeout: 12000 }).toBe(true);
    await swipeMeal(page, 'left');
  }

  await expect(page.locator('#foodCard')).toHaveAttribute('data-meal-id', String(target.id));
  await expect.poll(() => delayedRequests).toBeGreaterThan(0);
  await expect(page.locator('#foodCard')).toHaveAttribute('data-media-pending', 'true');
  const pendingStyle = await page.locator('#foodCard').evaluate(el => {
    const css = getComputedStyle(el);
    return { visibility: css.visibility, opacity: Number(css.opacity), pointerEvents: css.pointerEvents };
  });
  expect(pendingStyle.visibility).toBe('hidden');
  expect(pendingStyle.opacity).toBeLessThanOrEqual(0.01);
  expect(pendingStyle.pointerEvents).toBe('none');

  releaseTargetPhoto();
  await expect.poll(() => page.locator('#foodCard').getAttribute('data-media-pending'), { timeout: 12000 }).toBe(null);
  await expect.poll(() => page.locator('#foodCard').evaluate(el => getComputedStyle(el).visibility), { timeout: 12000 }).toBe('visible');
  await expectNoPageErrors(errors);
});


test('CP1320 Restaurant swipe advances to the next result and resets the outgoing card', async ({ page }) => {
  const errors = await prepare(page);
  await openRestaurants(page);
  await expect(page.locator('#restaurantCard h3')).toHaveText('Mock Pizza Kitchen');

  const card = page.locator('#restaurantCard');
  const box = await card.boundingBox();
  expect(box).toBeTruthy();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const delta = Math.max(125, box.width * 0.42);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - delta, y, { steps: 10 });
  await page.mouse.up();

  await expect.poll(() => page.locator('#restaurantCard h3').innerText(), { timeout: 12000 })
    .toBe('Mock Taco House');
  await expect.poll(() => page.locator('#restaurantCard').evaluate(el => {
    const css = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return css.visibility === 'visible'
      && Number(css.opacity) > 0.99
      && css.pointerEvents === 'auto'
      && rect.left >= -12
      && rect.right <= window.innerWidth + 12;
  }), { timeout: 12000 }).toBe(true);
  await expectNoPageErrors(errors);
});

test('CP1320 successive Restaurant swipes never repeat a cut result or leave a blank card', async ({ page }) => {
  const errors = await prepare(page);
  await page.route(url => url.pathname === '/api/restaurants' && url.searchParams.get('mode') === 'search', async route => {
    const third = {
      ...MOCK_RESTAURANTS[1],
      id: 'mock-bbq',
      name: 'Mock BBQ Table',
      category: 'BBQ',
      cuisine: 'bbq',
      address: '789 Cedar Rd, Clarksville, TN 37040',
      lat: 36.533,
      lon: -87.357,
      distance: 0.4
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        radiusMiles: 10,
        searchLatencyMs: 2,
        hoursTimeZone: 'America/Chicago',
        providerErrors: [],
        results: [...MOCK_RESTAURANTS, third]
      })
    });
  });

  await page.goto('/');
  await page.locator('#restStart').click();
  await expect(page.locator('#restaurant')).toBeVisible();
  await expect.poll(() => page.locator('#restaurantMaybeDeck').getAttribute('data-all-count'), { timeout: 12000 }).toBe('3');

  const seenIds = [];
  const expectedNames = ['Mock Pizza Kitchen', 'Mock Taco House', 'Mock BBQ Table'];
  for (let step = 0; step < 2; step++) {
    const card = page.locator('#restaurantCard');
    await expect(card.locator('h3')).toHaveText(expectedNames[step]);
    const id = await card.getAttribute('data-restaurant-id');
    expect(id).toBeTruthy();
    expect(seenIds).not.toContain(id);
    seenIds.push(id);

    const box = await card.boundingBox();
    expect(box).toBeTruthy();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const delta = Math.max(125, box.width * 0.42);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - delta, y, { steps: 10 });
    await page.mouse.up();

    const next = page.locator('#restaurantCard');
    await expect.poll(() => next.getAttribute('data-restaurant-id'), { timeout: 12000 })
      .not.toBe(id);
    await expect(next.locator('h3')).toHaveText(expectedNames[step + 1], { timeout: 12000 });
    await expect.poll(() => next.evaluate(el => {
      const css = getComputedStyle(el);
      return css.visibility === 'visible'
        && Number(css.opacity) > 0.99
        && css.pointerEvents === 'auto';
    }), { timeout: 7000 }).toBe(true);
  }

  const finalId = await page.locator('#restaurantCard').getAttribute('data-restaurant-id');
  expect(finalId).toBeTruthy();
  expect(seenIds).not.toContain(finalId);
  await expect(page.locator('#restaurantCard h3')).toHaveText('Mock BBQ Table');
  await expectNoPageErrors(errors);
});

test('a committed Meal swipe never paints the outgoing photo over the next card', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);
  await expect.poll(() => page.locator('#foodImg').evaluate(img =>
    img.dataset.mealPhotoLoaded === 'true' && img.complete && img.naturalWidth > 0
  ), { timeout: 12000 }).toBe(true);

  const previousName = await page.locator('#foodName').innerText();
  const previousPhoto = await page.locator('#foodImg').evaluate(img => img.currentSrc || img.src);
  await page.evaluate(oldName => {
    const card = document.querySelector('#foodCard');
    const image = document.querySelector('#foodImg');
    const name = document.querySelector('#foodName');
    window.__dinliminateSwipePaintTrace = [];
    const endAt = performance.now() + 1100;
    let advanced = false;
    const frame = () => {
      if (name?.textContent?.trim() !== oldName) advanced = true;
      if (advanced) {
        const cardStyle = getComputedStyle(card);
        const imageStyle = getComputedStyle(image);
        window.__dinliminateSwipePaintTrace.push({
          name: name?.textContent?.trim() || '',
          src: image?.currentSrc || image?.src || '',
          cardVisibility: cardStyle.visibility,
          opacity: Number(cardStyle.opacity),
          imageVisibility: imageStyle.visibility
        });
      }
      if (performance.now() < endAt) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, previousName);

  await swipeMeal(page, 'left');
  await waitForDecisionIdle(page, '#foodCard');
  await page.waitForTimeout(500);
  const trace = await page.evaluate(() => window.__dinliminateSwipePaintTrace || []);
  expect(trace.length).toBeGreaterThan(0);
  const outgoingPhotoPaints = trace.filter(frame =>
    frame.name !== previousName
    && frame.src === previousPhoto
    && frame.cardVisibility === 'visible'
    && frame.imageVisibility === 'visible'
    && frame.opacity > 0.05
  );
  expect(outgoingPhotoPaints).toEqual([]);
  await expect.poll(() => page.locator('#foodCard').evaluate(el => {
    const css = getComputedStyle(el);
    return css.visibility === 'visible' && css.pointerEvents === 'auto' && Number(css.opacity) > 0.99;
  }), { timeout: 7000 }).toBe(true);
  await expectNoPageErrors(errors);
});

test('CP1318 restores only one active Meal row per stable ID', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);
  const result = await page.evaluate(async () => {
    const { store } = await import('/src/state/store.js');
    const { drawFood } = await import('/src/main.js');
    const state = store.get();
    const first = state.pool[0];
    const second = state.pool[1];
    state.pool = [first, { ...first }, second, { ...second }];
    state.index = 3;
    drawFood();
    const ids = state.pool.map(row => String(row.id));
    return {
      ids,
      uniqueIds: new Set(ids).size,
      activeId: String(state.pool[state.index]?.id || ''),
      expectedActiveId: String(second?.id || '')
    };
  });
  expect(result.ids.length).toBe(2);
  expect(result.uniqueIds).toBe(2);
  expect(result.activeId).toBe(result.expectedActiveId);
  await expectNoPageErrors(errors);
});

test('CP1318 a stale image load cannot repaint a reused decision card', async ({ page }) => {
  const errors = await prepare(page);
  await page.route(url => url.pathname.startsWith('/__swap-race-'), async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__swap-race-slow.svg') {
      await new Promise(resolve => setTimeout(resolve, 450));
    }
    const fill = url.pathname === '/__swap-race-slow.svg' ? '#e33' : '#2c7';
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="'+fill+'"/></svg>'
    });
  });
  await seedMeals(page, 3);

  const result = await page.evaluate(async () => {
    const { swapImageWhenReady } = await import('/src/main.js');
    const card = document.querySelector('#foodCard');
    const img = document.querySelector('#foodImg');
    const stale = swapImageWhenReady(img, '/__swap-race-slow.svg');
    await new Promise(resolve => setTimeout(resolve, 35));

    // Simulate a normal redraw reusing this card and image for its next meal.
    card.dataset.mealId = 'simulated-next-meal';
    const nextToken = String(Number(card.dataset.mealLoadToken || 0) + 1);
    card.dataset.mealLoadToken = nextToken;
    img.dataset.mealLoadToken = nextToken;

    const current = swapImageWhenReady(img, '/__swap-race-fast.svg');
    const statuses = await Promise.all([stale, current]);
    return {
      source: new URL(img.currentSrc || img.src, document.baseURI).pathname,
      statuses,
      ownerMealId: card.dataset.mealId
    };
  });

  expect(result.ownerMealId).toBe('simulated-next-meal');
  expect(result.source).toBe('/__swap-race-fast.svg');
  expect(result.statuses).toEqual([false, true]);
  await expectNoPageErrors(errors);
});

test('a restored Meals route clears its one-shot boot selector before normal navigation', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);
  await page.reload();
  await expect(page.locator('#food')).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.classList.contains('dinliminate-ready')
  ), { timeout: 12000 }).toBe(true);
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.classList.contains('dinliminate-start-food')
  )).toBe(false);

  await page.locator('#foodHomeBack').click();
  await expect(page.locator('#home')).toBeVisible();
  const screens = await page.evaluate(() => [...document.querySelectorAll('.screen')]
    .filter(el => getComputedStyle(el).display !== 'none')
    .map(el => el.id));
  expect(screens).toEqual(['home']);
  await expectNoPageErrors(errors);
});

test('a restored Restaurants route clears its one-shot boot selector before normal navigation', async ({ page }) => {
  const errors = await prepare(page);
  await openRestaurants(page);
  await page.reload();
  await expect(page.locator('#restaurant')).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.classList.contains('dinliminate-ready')
  ), { timeout: 12000 }).toBe(true);
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.classList.contains('dinliminate-start-restaurant')
  )).toBe(false);

  await page.locator('#restaurantHomeBack').click();
  await expect(page.locator('#home')).toBeVisible();
  const screens = await page.evaluate(() => [...document.querySelectorAll('.screen')]
    .filter(el => getComputedStyle(el).display !== 'none')
    .map(el => el.id));
  expect(screens).toEqual(['home']);
  await expectNoPageErrors(errors);
});

test('Meal Details starts with the exact photo currently rendered on the card', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);
  await expect.poll(() => page.locator('#foodImg').evaluate(img =>
    img.dataset.mealPhotoLoaded === 'true' && img.complete && img.naturalWidth > 0
  ), { timeout: 12000 }).toBe(true);

  const itemName = await page.locator('#foodName').innerText();
  const cardPhoto = await page.locator('#foodImg').evaluate(img => new URL(img.currentSrc || img.src, document.baseURI).href);
  await page.locator('#foodDetails').click();
  await expect(page.locator('#detailsModal')).toBeVisible();
  await expect.poll(() => page.locator('#detailsModal .history-detail-photo').evaluate(img =>
    img.complete && img.naturalWidth > 0
  ), { timeout: 12000 }).toBe(true);
  const details = await page.locator('#detailsModal .history-detail-photo').evaluate(img => ({
    src: new URL(img.currentSrc || img.src, document.baseURI).href,
    name: document.querySelector('#detailsModal .detail-title-block h2')?.textContent?.trim()
  }));
  expect(details.src).toBe(cardPhoto);
  expect(details.name).toBe(itemName);
  await expectNoPageErrors(errors);
});



test('CP1334 phone discovery toolbars maximize their controls without wrapping', async ({ page }) => {
  const errors = await prepare(page);
  const widths = [320, 340, 360, 375, 390, 412, 430];

  await page.setViewportSize({ width: widths[0], height: 844 });
  await seedMeals(page, 3);

  async function expectOneToolbarRow(rowSelector, ids, textIds) {
    const layout = await page.evaluate(({ rowSelector, ids, textIds }) => {
      const rowEl = document.querySelector(rowSelector);
      const row = rowEl.getBoundingClientRect();
      const controls = ids.map(id => {
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          id, left:r.left, right:r.right, top:r.top, bottom:r.bottom,
          width:r.width, height:r.height, centerY:r.top+r.height/2,
          fontSize:parseFloat(style.fontSize),
          visible:style.display!=='none' && style.visibility==='visible' && r.width>0 && r.height>0
        };
      });
      const text = Object.fromEntries(textIds.map(id => [
        id, parseFloat(getComputedStyle(document.getElementById(id)).fontSize)
      ]));
      return {
        row:{left:row.left,right:row.right,top:row.top,bottom:row.bottom,width:row.width,height:row.height},
        viewportWidth:window.innerWidth, controls, text
      };
    }, { rowSelector, ids, textIds });

    expect(layout.row.width).toBeGreaterThan(0);
    expect(layout.controls.every(control => control.visible)).toBe(true);
    expect(Math.min(...layout.controls.map(control=>control.left))).toBeGreaterThanOrEqual(layout.row.left-1);
    expect(Math.max(...layout.controls.map(control=>control.right)))
      .toBeLessThanOrEqual(Math.min(layout.row.right,layout.viewportWidth)+1);
    expect(Math.max(...layout.controls.map(control=>control.centerY))
      - Math.min(...layout.controls.map(control=>control.centerY))).toBeLessThanOrEqual(4);

    for (let i=1;i<layout.controls.length;i++) {
      expect(layout.controls[i].left, layout.controls[i].id+' must remain to the right of '+layout.controls[i-1].id)
        .toBeGreaterThanOrEqual(layout.controls[i-1].right-1);
    }
    for (const control of layout.controls) {
      if (control.id.endsWith('HomeBack')) {
        expect(control.width).toBeGreaterThanOrEqual(33);
        expect(control.height).toBeGreaterThanOrEqual(35);
      }
      if (control.id.endsWith('MaybeDeck')) {
        expect(control.height).toBeGreaterThanOrEqual(35);
        expect(control.fontSize).toBeGreaterThanOrEqual(8.4);
      }
      if (control.id.endsWith('Menu')) {
        expect(control.width).toBeGreaterThanOrEqual(39);
        expect(control.height).toBeGreaterThanOrEqual(39);
      }
    }
    for (const [id,fontSize] of Object.entries(layout.text)) {
      expect(fontSize, id+' should use the enlarged readable phone label size').toBeGreaterThanOrEqual(10);
    }
  }

  for (const width of widths) {
    await page.setViewportSize({ width, height:844 });
    await expectOneToolbarRow(
      '#food .food-interior-nav',
      ['foodHomeBack','foodMealTimeToggle','foodQuickToggle','foodMaybeDeck','foodMenu'],
      ['foodMealTimeToggle','foodQuickToggle']
    );
  }

  await page.evaluate(() => localStorage.clear());
  await openRestaurants(page);
  for (const width of widths) {
    await page.setViewportSize({ width, height:844 });
    await expectOneToolbarRow(
      '#restaurant .restaurant-choice-management',
      ['restaurantHomeBack','restaurantSearchToggle','restaurantQuickToggle','restaurantHoursToggle','restaurantMaybeDeck'],
      ['restaurantSearchToggle','restaurantQuickToggle','restaurantHoursToggle']
    );
  }
  await expectNoPageErrors(errors);
});


test('CP1337 uses the five exact selected Pexels photos and normalizes restored built-in copies', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);
  const expected = {
  "jell-o": "https://images.pexels.com/photos/7428697/pexels-photo-7428697.jpeg?auto=compress&cs=tinysrgb&w=1800",
  "protein-bar": "https://images.pexels.com/photos/3735187/pexels-photo-3735187.jpeg?auto=compress&cs=tinysrgb&w=1800",
  "grilled-cheese": "https://images.pexels.com/photos/37395121/pexels-photo-37395121.jpeg?auto=compress&cs=tinysrgb&w=1800",
  "salad-bowl": "https://images.pexels.com/photos/4101804/pexels-photo-4101804.jpeg?auto=compress&cs=tinysrgb&w=1800",
  "pasta-alfredo": "https://images.pexels.com/photos/11220208/pexels-photo-11220208.jpeg?auto=compress&cs=tinysrgb&w=1800"
};
  const setup = await page.evaluate(async expectedPhotos => {
    const { FOODS } = await import('/data/foods.js');
    const key = Object.keys(localStorage).find(value => value.startsWith('dinliminate:v1'));
    if (!key) throw new Error('Dinliminate saved state key not found');
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    const ids = new Set(Object.keys(expectedPhotos));
    const defaults = Object.fromEntries(FOODS.filter(row => ids.has(String(row.id))).map(row => [String(row.id), row.image]));
    const stale = FOODS.filter(row => ids.has(String(row.id))).map(row => ({
      ...row,
      image: 'https://images.pexels.com/photos/1000000/pexels-photo-1000000.jpeg',
      images: ['https://images.pexels.com/photos/1000000/pexels-photo-1000000.jpeg'],
      backupImage: 'https://images.pexels.com/photos/1000001/pexels-photo-1000001.jpeg',
      officialImage: 'https://images.pexels.com/photos/1000002/pexels-photo-1000002.jpeg'
    }));
    saved.custom = [...(Array.isArray(saved.custom) ? saved.custom.filter(row => !ids.has(String(row.id))) : []), ...stale.map(row => ({...row}))];
    saved.deletedCustomMeals = [...(Array.isArray(saved.deletedCustomMeals) ? saved.deletedCustomMeals.filter(row => !ids.has(String(row.id))) : []), ...stale.map(row => ({...row}))];
    saved.pool = stale.map(row => ({...row}));
    saved.winnerItem = {...stale[0]};
    saved.winnerType = 'food';
    saved.saved = true;
    saved.screen = 'food';
    localStorage.setItem(key, JSON.stringify(saved));
    return { defaults, ids:[...ids], key };
  }, expected);
  expect(setup.defaults).toEqual(expected);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html.dinliminate-ready')).toBeAttached({ timeout: 10000 });
  const restored = await page.evaluate(({ key, ids }) => {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    const read = collection => Object.fromEntries(ids.map(id => {
      const row = (Array.isArray(collection) ? collection : []).find(item => String(item?.id || '') === id);
      return [id, row ? {
        image: row.image,
        images: Array.isArray(row.images) ? row.images : null,
        hasBackup: Object.prototype.hasOwnProperty.call(row, 'backupImage'),
        hasOfficial: Object.prototype.hasOwnProperty.call(row, 'officialImage')
      } : null];
    }));
    return {
      custom: read(saved.custom),
      deleted: read(saved.deletedCustomMeals),
      pool: read(saved.pool),
      winner: saved.winnerItem ? {
        id: String(saved.winnerItem.id),
        image: saved.winnerItem.image,
        images: saved.winnerItem.images,
        hasBackup: Object.prototype.hasOwnProperty.call(saved.winnerItem, 'backupImage'),
        hasOfficial: Object.prototype.hasOwnProperty.call(saved.winnerItem, 'officialImage')
      } : null
    };
  }, setup);
  for (const [id, photo] of Object.entries(expected)) {
    for (const collection of ['custom', 'deleted', 'pool']) {
      expect(restored[collection][id], collection + ' ' + id).toEqual({
        image: photo, images: [photo], hasBackup: false, hasOfficial: false
      });
    }
  }
  expect(restored.winner).toEqual({
    id: 'pasta-alfredo', image: expected['pasta-alfredo'], images: [expected['pasta-alfredo']],
    hasBackup: false, hasOfficial: false
  });
  await expectNoPageErrors(errors);
});


test('CP1338 keeps the shared menu directly under its hamburger and Family Mode exits to the menu', async ({ page }) => {
  const errors = await prepare(page);
  await page.goto('/');
  await expect(page.locator('html.dinliminate-ready')).toBeAttached({ timeout: 10000 });
  await page.locator('#menu').click();
  await expect(page.locator('#drawer')).toBeVisible();

  const geometry = await page.evaluate(() => {
    const trigger = document.querySelector('#menu').getBoundingClientRect();
    const first = document.querySelector('#drawer .drawer-window').getBoundingClientRect();
    const close = document.querySelector('#drawerClose').getBoundingClientRect();
    return {
      gap: first.top - trigger.bottom,
      closeTopDelta: Math.abs(close.top - trigger.top),
      closeRightDelta: Math.abs(close.right - trigger.right)
    };
  });
  expect(geometry.gap).toBeGreaterThanOrEqual(2);
  expect(geometry.gap).toBeLessThanOrEqual(5);
  expect(geometry.closeTopDelta).toBeLessThanOrEqual(1);
  expect(geometry.closeRightDelta).toBeLessThanOrEqual(1);

  await page.locator('#familyMode').click();
  await expect(page.locator('#family')).toBeVisible();
  await page.locator('#familyCloseTop').click();
  await expect(page.locator('#family')).toBeHidden({ timeout: 5000 });
  await expect(page.locator('#drawer')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#drawer .drawer-window')).toHaveCount(4);
  await expectNoPageErrors(errors);
});


test('CP1347 pending-photo Maybe keeps card copy visible and Back restores the decoded photo', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 4);
  const target = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(value => value.startsWith('dinliminate:v1'));
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    const row = saved.pool?.[1];
    return {
      id: String(row?.id || ''),
      urls: [row?.officialImage, row?.image, row?.backupImage, ...(Array.isArray(row?.images) ? row.images : [])]
        .filter(value => typeof value === 'string' && /^https:\/\//i.test(value))
    };
  });
  expect(target.id).toBeTruthy();
  const targetPaths = new Set(target.urls.map(value => new URL(value).pathname));
  expect(targetPaths.size).toBeGreaterThan(0);
  const expectedIds = await page.evaluate(async () => {
    const { store } = await import('/src/state/store.js');
    return store.get().pool.map(row => String(row.id));
  });
  expect(expectedIds.length).toBe(4);

  let releaseTargetPhoto;
  const gate = new Promise(resolve => { releaseTargetPhoto = resolve; });
  let delayedRequests = 0;
  await page.route(url => {
    const remote = url.searchParams.get('url') || '';
    if (url.pathname !== '/api/image' || url.searchParams.get('meal') !== '1' || !remote) return false;
    try { return targetPaths.has(new URL(remote).pathname); }
    catch { return false; }
  }, async route => {
    delayedRequests += 1;
    await gate;
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'cache-control': 'no-store' },
      body: TINY_PNG
    });
  });

  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#food')).toBeVisible();
    await expect(page.locator('#foodCard')).toHaveAttribute('data-meal-id', expectedIds[0]);
    await expect.poll(() => page.locator('#foodImg').evaluate(img =>
      img.dataset.mealPhotoLoaded === 'true' && img.complete && img.naturalWidth > 0
    ), { timeout: 12000 }).toBe(true);
    await expect.poll(() => delayedRequests).toBeGreaterThan(0);
    const initialName=await page.locator('#foodName').innerText();
    const initialPhoto=await page.locator('#foodImg').evaluate(img =>
      new URL(img.currentSrc||img.src,document.baseURI).href
    );
    await page.evaluate(src=>{window.__cp1347InitialPhoto=src;},initialPhoto);

    await page.locator('#foodMaybe').click();
    const active = page.locator('#foodCard');
    await expect(active).toHaveAttribute('data-meal-id', expectedIds[1]);
    await expect(active).toHaveAttribute('data-media-pending', 'true');
    await expect(page.locator('#foodName')).toHaveText(target.name);
    await expect.poll(() => active.evaluate(el => {
      const css=getComputedStyle(el);
      return css.visibility==='visible'&&Number(css.opacity)>.99&&css.pointerEvents==='auto';
    })).toBe(true);
    await expect.poll(() => page.locator('#foodNextCard').getAttribute('data-meal-id'), { timeout: 7000 })
      .toBe(expectedIds[2]);
    await expect.poll(() => page.locator('#foodNextCard').evaluate(el => getComputedStyle(el).visibility))
      .toBe('hidden');

    // Back while the next meal's image request is held must restore the prior
    // meal and its already-decoded photo without blanking the active card.
    await page.locator('#foodBack').click();
    await expect(page.locator('#foodCard')).toHaveAttribute('data-meal-id', expectedIds[0]);
    await expect(page.locator('#foodName')).toHaveText(initialName);
    await expect.poll(() => page.locator('#foodImg').evaluate(img => {
      const card=document.querySelector('#foodCard'),css=getComputedStyle(img);
      return img.dataset.mealPhotoLoaded==='true'&&img.complete&&img.naturalWidth>0
        &&css.visibility==='visible'
        &&new URL(img.currentSrc||img.src,document.baseURI).href===window.__cp1347InitialPhoto
        &&card?.dataset.mediaPending!=='true';
    }), { timeout: 3000 }).toBe(true);
  } finally {
    releaseTargetPhoto();
  }

  await expect.poll(() => page.locator('#foodCard').getAttribute('data-media-pending'), { timeout: 12000 }).toBe(null);
  await expect.poll(() => page.locator('#foodNextCard').evaluate(el => getComputedStyle(el).visibility), { timeout: 7000 })
    .toBe('visible');
  await expectNoPageErrors(errors);
});


test('CP1345 homepage has no CP1340 gold shine effects', async ({ page }) => {
  const errors = await prepare(page);
  await page.goto('/');
  await expect(page.locator('html.dinliminate-ready')).toBeAttached({ timeout: 10000 });
  await expect(page.locator('#home')).toBeVisible();

  const css = await page.evaluate(async () => {
    const response = await fetch('./home.css?v=1347', { cache:'no-store' });
    if (!response.ok) throw new Error('could not load the current homepage stylesheet');
    return response.text();
  });

  expect(css).not.toContain('dinliminate-home-gold-sweep');
  expect(css).not.toContain('rgba(255,224,160');
  expect(css).not.toContain('rgba(255,211,125');
  expect(css).not.toContain('rgba(255,226,150');
  expect(css).not.toContain('html:root .app.home-active #home::before{');
  expect(css).not.toContain('html:root .app.home-active .app-topbar .brand-mark::after{');
  expect(css).not.toContain('html:root .app.home-active #home .home-choice-zone::before{');
  expect(errors).toEqual([]);
});


test('CP1346 Maybe and Back restore the exact Meal immediately without a card flash', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 4);
  await expect.poll(() => page.locator('#foodImg').evaluate(img =>
    img.dataset.mealPhotoLoaded === 'true' && img.complete && img.naturalWidth > 0
  ), { timeout: 12000 }).toBe(true);

  const cycles = await page.evaluate(async () => {
    const { store } = await import('/src/state/store.js');
    const snapshot = () => {
      const state = store.get();
      const item = state.pool[state.index];
      const card = document.querySelector('#foodCard');
      const image = document.querySelector('#foodImg');
      const css = getComputedStyle(card);
      return {
        expectedId: String(item?.id || ''),
        expectedName: String(item?.name || ''),
        cardId: String(card?.dataset.mealId || ''),
        cardName: document.querySelector('#foodName')?.textContent?.trim() || '',
        visibility: css.visibility,
        opacity: Number(css.opacity),
        pointerEvents: css.pointerEvents,
        mediaPending: String(card?.dataset.mediaPending || ''),
        imageVisibility: getComputedStyle(image).visibility,
        imageLoaded: String(image.dataset.mealPhotoLoaded || 'false')
      };
    };
    const results = [];
    for (let i = 0; i < 3; i++) {
      const before = snapshot();
      document.querySelector('#foodMaybe').click();
      const afterMaybe = snapshot();
      document.querySelector('#foodBack').click();
      const afterBack = snapshot();
      results.push({ before, afterMaybe, afterBack });
    }
    return results;
  });

  expect(cycles).toHaveLength(3);
  for (const [index, result] of cycles.entries()) {
    const { before, afterMaybe, afterBack } = result;
    expect(before.cardId, 'starting meal '+index).toBe(before.expectedId);
    expect(before.cardName).toBe(before.expectedName);

    expect(afterMaybe.cardId, 'Maybe must advance immediately at cycle '+index).not.toBe(before.cardId);
    expect(afterMaybe.cardId).toBe(afterMaybe.expectedId);
    expect(afterMaybe.cardName).toBe(afterMaybe.expectedName);
    expect(afterMaybe.visibility).toBe('visible');
    expect(afterMaybe.opacity).toBeGreaterThan(0.99);
    if (afterMaybe.mediaPending === 'true') {
      expect(afterMaybe.imageVisibility).toBe('hidden');
      expect(afterMaybe.pointerEvents).toBe('auto');
    }

    expect(afterBack.cardId, 'Back must restore the exact meal at cycle '+index).toBe(before.cardId);
    expect(afterBack.cardName).toBe(before.cardName);
    expect(afterBack.expectedId).toBe(before.expectedId);
    expect(afterBack.visibility).toBe('visible');
    expect(afterBack.opacity).toBeGreaterThan(0.99);
    if (afterBack.mediaPending === 'true') {
      expect(afterBack.imageVisibility).toBe('hidden');
      expect(afterBack.pointerEvents).toBe('auto');
    }
  }

  await expect.poll(() => page.locator('#foodCard').getAttribute('data-media-pending'), { timeout: 12000 }).toBe(null);
  await expect.poll(() => page.locator('#foodImg').evaluate(img =>
    img.dataset.mealPhotoLoaded === 'true' && img.complete && img.naturalWidth > 0
  ), { timeout: 12000 }).toBe(true);
  await expectNoPageErrors(errors);
});

test('CP1347 Restaurant Maybe and Back reuse the prior photo on restore', async ({ page }) => {
  const errors = await prepare(page);
  await openRestaurants(page);
  // Seed a decoded, row-matched photo so this test does not depend on live
  // photo-service availability to verify the exact-photo restore path.
  await page.evaluate(async dataUrl => {
    const card=document.querySelector('#restaurantCard');
    const img=card?.querySelector('img');
    if(!card||!img)throw new Error('restaurant card did not render');
    img.dataset.restaurantPhotoKey=String(card.dataset.restaurantId||'');
    img.dataset.restaurantPhotoLoaded='true';
    img.src=dataUrl;
  }, TINY_PNG_DATA);
  await expect.poll(() => page.locator('#restaurantCard img').evaluate(img =>
    img.complete&&img.naturalWidth>0
  ), { timeout: 7000 }).toBe(true);

  async function snapshot() {
    return page.evaluate(async () => {
      const { store } = await import('/src/state/store.js');
      const card = document.querySelector('#restaurantCard');
      const id = String(card?.dataset.restaurantId || '');
      const row = store.get().restaurantPool.find(item => String(item?.id || '') === id);
      const css = getComputedStyle(card);
      return {
        id,
        name: document.querySelector('#restaurantCard h3')?.textContent?.trim() || '',
        expectedName: String(row?.name || ''),
        visibility: css.visibility,
        opacity: Number(css.opacity),
        imageKey: String(card?.querySelector('img')?.dataset.restaurantPhotoKey || ''),
        imageSrc: String(card?.querySelector('img')?.currentSrc || card?.querySelector('img')?.src || '')
      };
    });
  }

  for (let i = 0; i < 3; i++) {
    const before = await snapshot();
    expect(before.id).toBeTruthy();
    expect(before.name).toBe(before.expectedName);

    const afterMaybe = await page.evaluate(async () => {
      document.querySelector('#restMaybe').click();
      const { store } = await import('/src/state/store.js');
      const card = document.querySelector('#restaurantCard');
      const id = String(card?.dataset.restaurantId || '');
      const row = store.get().restaurantPool.find(item => String(item?.id || '') === id);
      const css = getComputedStyle(card);
      return {
        id, name:document.querySelector('#restaurantCard h3')?.textContent?.trim() || '',
        expectedName:String(row?.name || ''), visibility:css.visibility, opacity:Number(css.opacity),
        imageKey:String(card?.querySelector('img')?.dataset.restaurantPhotoKey || ''),
        imageSrc:String(card?.querySelector('img')?.currentSrc || card?.querySelector('img')?.src || '')
      };
    });
    expect(afterMaybe.id, 'Maybe must advance immediately at cycle '+i).not.toBe(before.id);
    expect(afterMaybe.name).toBe(afterMaybe.expectedName);
    expect(afterMaybe.visibility).toBe('visible');
    expect(afterMaybe.opacity).toBeGreaterThan(0.99);
    expect(afterMaybe.imageKey).toBe(afterMaybe.id);

    const afterBack = await page.evaluate(async () => {
      document.querySelector('#restBack').click();
      const { store } = await import('/src/state/store.js');
      const card = document.querySelector('#restaurantCard');
      const id = String(card?.dataset.restaurantId || '');
      const row = store.get().restaurantPool.find(item => String(item?.id || '') === id);
      const css = getComputedStyle(card);
      return {
        id, name:document.querySelector('#restaurantCard h3')?.textContent?.trim() || '',
        expectedName:String(row?.name || ''), visibility:css.visibility, opacity:Number(css.opacity),
        imageKey:String(card?.querySelector('img')?.dataset.restaurantPhotoKey || '')
      };
    });
    expect(afterBack.id, 'Back must restore the exact restaurant at cycle '+i).toBe(before.id);
    expect(afterBack.name).toBe(before.name);
    expect(afterBack.name).toBe(afterBack.expectedName);
    expect(afterBack.visibility).toBe('visible');
    expect(afterBack.opacity).toBeGreaterThan(0.99);
    expect(afterBack.imageKey).toBe(afterBack.id);
    expect(afterBack.imageSrc, 'Back should restore the prior restaurant photo at cycle '+i)
      .toBe(before.imageSrc);
  }
  await expectNoPageErrors(errors);
});
