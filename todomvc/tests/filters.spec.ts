import { expect, test } from '@playwright/test';
import { addTodo, openApp, titles } from './app';
import { hit } from './record';

test('shows only active todos', async ({ page }) => {
  hit('shows only active todos');
  await openApp(page);
  await addTodo(page, 'buy milk');
  await addTodo(page, 'walk the dog');
  await page.getByRole('checkbox', { name: 'Toggle Todo' }).nth(1).check();
  await page.getByRole('link', { name: 'Active' }).click();
  await expect(titles(page)).toHaveText(['buy milk']);
  await page.getByRole('link', { name: 'Completed' }).click();
  await expect(titles(page)).toHaveText(['walk the dog']);
});
