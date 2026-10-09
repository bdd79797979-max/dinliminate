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


test('CP1313 decision colors, gold chevron, inline Maybes controls, and menu spacing', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 3);

  const mealVisuals = await page.evaluate(() => {
    const box = id => {
      const r = document.querySelector('#' + id).getBoundingClientRect();
      return { x:r.x, y:r.y, width:r.width, height:r.height, centerY:r.y+r.height/2 };
    };
    const color = id => getComputedStyle(document.querySelector('#' + id)).backgroundColor;
    const arrow = document.querySelector('#foodHomeBack svg');
    return {
      cut: color('foodCut'),
      maybe: color('foodMaybe'),
      arrowColor: getComputedStyle(document.querySelector('#foodHomeBack')).color,
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
  expect(mealVisuals.arrowHasCircle).toBe(false);
  expect(mealVisuals.arrowPath).toMatch(/^M15 5\.5 8\.5 12l6\.5 6\.5$/);
  expect(Math.max(mealVisuals.mealTime.centerY, mealVisuals.cuisine.centerY, mealVisuals.maybes.centerY)
    - Math.min(mealVisuals.mealTime.centerY, mealVisuals.cuisine.centerY, mealVisuals.maybes.centerY)).toBeLessThanOrEqual(3);

  await page.locator('#foodMenu').click();
  await expect(page.locator('#drawer')).toBeVisible();
  const firstMenuRow = await page.locator('#drawer .drawer-row').first().boundingBox();
  expect(firstMenuRow).not.toBeNull();
  expect(firstMenuRow.y).toBeLessThan(145);
  await page.locator('#drawerClose').click();

  await page.evaluate(() => localStorage.clear());
  await openRestaurants(page);
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

test('successive Meal swipes never reintroduce a cut card', async ({ page }) => {
  const errors = await prepare(page);
  await seedMeals(page, 5);
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
    expect(currentId).toBeTruthy();
    expect(removedIds).not.toContain(currentId);
    removedIds.push(currentId);
    await swipeMeal(page, 'left');
  }

  await waitForDecisionIdle(page, '#foodCard');
  await expectCardReadyForNextSwipe();
  const survivorId = await page.locator('#foodCard').getAttribute('data-meal-id');
  expect(survivorId).toBeTruthy();
  expect(removedIds).not.toContain(survivorId);
  await expect(page.locator('#foodMaybeDeck')).toHaveAttribute('data-all-count', '1');
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


test('Restaurant swipe advances to the next result and resets the outgoing card', async ({ page }) => {
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

