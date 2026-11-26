import {expect, test} from '@playwright/test';
import {enterCode, messageField, sendButton, workspace} from './helpers';

test('returns from an open chat to its history through Your workspace', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(workspace + '#/assistant/career');
  await enterCode(page);
  const title = 'Проверка истории разговоров';
  await messageField(page).fill(title);
  await sendButton(page).click();
  await expect(page).toHaveURL(/#\/chat\/[\w-]+$/);
  await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();
  await messageField(page).fill('Черновик без отправки');

  const breadcrumb = page.getByRole('link', {name:'Ваше пространство'});
  await expect(breadcrumb).toHaveAttribute('href', '#/history');
  await breadcrumb.press('Enter');
  await expect(page).toHaveURL(/#\/history$/);
  await expect(page.getByRole('heading', {name:'Ваши разговоры'})).toBeVisible();
  await expect(page.getByRole('link', {name:new RegExp(title)})).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('heading', {name:'Карьерный навигатор'})).toBeVisible();
  await expect(messageField(page)).toHaveValue('Черновик без отправки');
});
