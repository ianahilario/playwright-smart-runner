import { expect, test } from '@playwright/test';
import { addTodo, openApp, titles } from '../app';
import { hit } from '../record';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('completes a todo', async ({ page }) => {
  hit('completes a todo');
  await addTodo(page, 'buy milk');
  await page.getByRole('checkbox', { name: 'Toggle Todo' }).check();
  await expect(page.getByTestId('todo-item')).toHaveClass(/completed/);
  await expect(page.getByTestId('todo-count')).toHaveText('0 items left');
});

test('clears completed todos', async ({ page }) => {
  hit('clears completed todos');
  await addTodo(page, 'buy milk');
  await addTodo(page, 'walk the dog');
  await page.getByRole('checkbox', { name: 'Toggle Todo' }).first().check();
  await page.getByRole('button', { name: 'Clear completed' }).click();
  await expect(titles(page)).toHaveText(['walk the dog']);
});
