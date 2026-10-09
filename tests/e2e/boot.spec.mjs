import { test, expect } from '@playwright/test';

test('initial boot reaches ready without runtime, console, or CSP errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push('pageerror: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push('console.error: ' + message.text() + ' @ ' + message.location().url);
  });
  await page.addInitScript(() => {
    window.__dinliminateCspViolations = [];
    window.addEventListener('securitypolicyviolation', event => {
      window.__dinliminateCspViolations.push({
        directive: event.violatedDirective,
        blockedURI: event.blockedURI
      });
    });
  });

  await page.goto('/');
  await expect(page.locator('html.dinliminate-ready')).toBeAttached({ timeout: 5000 });
  await expect(page.locator('#home')).toBeVisible({ timeout: 5000 });
  expect(await page.evaluate(() => window.__dinliminateCspViolations)).toEqual([]);
  expect(errors).toEqual([]);
});

test('cached app shell boots after reload while offline', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'allow',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    geolocation: { latitude: 36.53, longitude: -87.36 },
    permissions: ['geolocation']
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html.dinliminate-ready')).toBeAttached({ timeout: 5000 });
    await expect.poll(async () => page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.active && registration.active.state === 'activated');
    }), { timeout: 10000 }).toBe(true);

    await expect.poll(async () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 10000 }).toBe(true);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html.dinliminate-ready')).toBeAttached({ timeout: 5000 });
    await expect(page.locator('#home')).toBeVisible({ timeout: 5000 });
  } finally {
    await context.close();
  }
});
