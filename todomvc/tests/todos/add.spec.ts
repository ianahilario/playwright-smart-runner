import { expect, test } from '@playwright/test';
import { addTodo, openApp, titles } from '../app';
import { hit } from '../record';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('adds a todo', async ({ page }) => {
  hit('adds a todo');
  await addTodo(page, 'buy milk');
  await expect(titles(page)).toHaveText(['buy milk']);
});

test('counts the remaining todos', async ({ page }) => {
  hit('counts the remaining todos');
  await addTodo(page, 'buy milk');
  await addTodo(page, 'walk the dog');
  await expect(page.getByTestId('todo-count')).toHaveText('2 items left');
});
