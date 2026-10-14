import { expect, type Locator, type Page } from '@playwright/test';

export async function openApp(page: Page): Promise<void> {
  await page.goto('#/');
  await expect(page.getByPlaceholder('What needs to be done?')).toBeVisible();
}

export async function addTodo(page: Page, title: string): Promise<void> {
  const input = page.getByPlaceholder('What needs to be done?');
  await input.fill(title);
  await input.press('Enter');
}

export function titles(page: Page): Locator {
  return page.getByTestId('todo-title');
}
