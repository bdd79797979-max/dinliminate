import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    geolocation: { latitude: 36.53, longitude: -87.36 },
    permissions: ['geolocation']
  },
  webServer: {
    command: 'node tests/e2e/server.cjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true
  },
  projects: [
    { name: 'chromium-360x740', testIgnore: '**/desktop-drawers.spec.mjs', use: { ...devices['Pixel 7'], browserName: 'chromium', viewport: { width: 360, height: 740 } } },
    { name: 'chromium-375x667', testIgnore: '**/desktop-drawers.spec.mjs', use: { ...devices['Pixel 7'], browserName: 'chromium', viewport: { width: 375, height: 667 } } },
    { name: 'chromium-390x844', testIgnore: '**/desktop-drawers.spec.mjs', use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'chromium-412x915', testIgnore: '**/desktop-drawers.spec.mjs', use: { ...devices['Pixel 7'], browserName: 'chromium', viewport: { width: 412, height: 915 } } },
    { name: 'webkit-mobile', testIgnore: '**/desktop-drawers.spec.mjs', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'desktop-drawers', testMatch: '**/desktop-drawers.spec.mjs', use: { ...devices['Desktop Chrome'], browserName: 'chromium', viewport: { width: 1280, height: 900 } } }
  ]
});
