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

test('meal and restaurant decision controls are visible and touch-sized at mobile widths', async ({ page }) => {
  const errors = await prepare(page);
  const viewport = page.viewportSize();
  expect([360, 375, 390, 412]).toContain(viewport.width);

  async function expectControls(ids) {
    for (const id of ids) {
      const control = page.locator('#' + id);
      await expect(control, '#' + id + ' should be visible at ' + viewport.width + 'px').toBeVisible();
      const box = await control.boundingBox();
      expect(box, '#' + id + ' should have a rendered box').not.toBeNull();
      expect(box.width, '#' + id + ' width at ' + viewport.width + 'px').toBeGreaterThanOrEqual(40);
      expect(box.height, '#' + id + ' height at ' + viewport.width + 'px').toBeGreaterThanOrEqual(40);
    }
  }

  await seedMeals(page, 2);
  await expectControls(['foodBack', 'foodCut', 'foodMaybe', 'foodChoose']);

  // Clear the persisted Meal route so the next navigation starts on Home.
  await page.evaluate(() => localStorage.clear());
  await openRestaurants(page);
  await expectControls(['restBack', 'restCut', 'restMaybe', 'restChoose']);

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
