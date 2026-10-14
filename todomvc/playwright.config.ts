import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'line',
  workers: 1,
  use: {
    baseURL: 'https://demo.playwright.dev/todomvc/',
  },
  projects: [{ name: 'chromium' }],
});
