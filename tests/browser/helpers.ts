import {expect, type Page} from '@playwright/test';

export const codeA = 'UX9A2K';
export const codeB = 'PD7B4M';
export const workspace = '/agentik/';
export const codeField = (page: Page) => page.getByRole('textbox', {name: 'Код доступа'});
export const logInButton = (page: Page) => page.getByRole('button', {name: 'Войти', exact: true});
export const sendButton = (page: Page) => page.getByRole('button', {name: 'Отправить сообщение'});
export const messageField = (page: Page) => page.getByRole('textbox', {name: 'Ваше сообщение'});

export async function selectChoice(page: Page, label: string, option: string) {
  const trigger = page.getByRole('combobox', {name: label});
  await trigger.click();
  await page.getByRole('listbox', {name: label}).getByRole('option', {name: option, exact: true}).click();
  return trigger;
}

export async function enterCode(page: Page, code = codeA) {
  await codeField(page).fill(code);
}

export async function openCatalog(page: Page, code = codeA) {
  await page.goto(workspace + '#/login');
  await enterCode(page, code);
  await expect(page.getByRole('heading', {name:'Ваши разговоры'})).toBeVisible();
  await page.goto(workspace + '#/assistants');
  await expect(page.getByRole('searchbox')).toBeVisible();
}

export async function expectNoHorizontalScroll(page: Page) {
  const width = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewport;
  });
  expect(width).toBeLessThanOrEqual(1);
}
