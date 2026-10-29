import { defineConfig } from '@playwright/test';
import { browserRuntime } from './scripts/browser-runtime.mjs';
export default defineConfig({
  testDir: './tests/browser', timeout: 45000, workers: 1,
  reporter: 'list', use: { headless: true, viewport: { width: 390, height: 844 },
    launchOptions: await browserRuntime(),
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
});
