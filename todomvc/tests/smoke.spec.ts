import { expect, test } from '@playwright/test';
import { addTodo, openApp, titles } from './app';
import { hit } from './record';

test('shows the new todo field', { tag: '@smoke' }, async ({ page }) => {
  hit('shows the new todo field');
  await openApp(page);
  await expect(page).toHaveTitle('React • TodoMVC');
  await expect(page.getByPlaceholder('What needs to be done?')).toBeVisible();
});

test('starts with no todos', { tag: '@smoke' }, async ({ page }) => {
  hit('starts with no todos');
  await openApp(page);
  await expect(titles(page)).toHaveCount(0);
});

test('edits a todo by double-clicking', async ({ page }) => {
  hit('edits a todo by double-clicking');
  await openApp(page);
  await addTodo(page, 'buy milk');
  await titles(page).dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit' });
  await editor.fill('buy oat milk');
  await editor.press('Enter');
  await expect(titles(page)).toHaveText(['buy oat milk']);
});
