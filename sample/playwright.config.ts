import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'line',
  workers: 1,
  projects: [{ name: 'chromium' }],
});
