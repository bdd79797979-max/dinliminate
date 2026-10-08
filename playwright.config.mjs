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
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } }
  ]
});
