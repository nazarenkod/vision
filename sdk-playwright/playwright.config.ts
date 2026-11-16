import { defineConfig } from '@playwright/test';

// the tests run against dist/: `npm test` builds it first, so they check what the package ships
export default defineConfig({
  testDir: 'test',
  reporter: 'list',
  use: { browserName: 'chromium', headless: true },
});
