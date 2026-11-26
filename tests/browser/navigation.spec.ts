import {expect, test} from '@playwright/test';
import {enterCode, expectNoHorizontalScroll, messageField, openCatalog, sendButton, workspace} from './helpers';

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

test('localizes all built-in catalog cards and filters them in English', async ({page}) => {
  await page.setViewportSize({width:1200,height:760});
  await openCatalog(page);
  await page.getByRole('button', {name:'ENG', exact:true}).click();
  const cards = page.locator('.agent-card');
  await expect(cards).toHaveCount(32);
  await expect(cards.filter({hasText:/[А-Яа-яЁё]/u})).toHaveCount(0);
  await expect(page.getByRole('heading', {name:'Family finance assistant', exact:true})).toBeVisible();

  await page.getByRole('button', {name:'Work', exact:true}).click();
  await page.getByRole('searchbox').fill('RESUME');
  await expect(cards).toHaveCount(1);
  await page.getByRole('button', {name:'Add favorite: Career guide'}).click();
  const favorites = page.getByRole('link', {name:/^Favorites\b/});
  await expect(favorites).toBeVisible();
  await favorites.click();
  await expect(cards).toHaveCount(1);
  await expect(cards.getByRole('link', {name:'Open: Career guide'})).toBeVisible();

  await page.goto(workspace + '#/characters');
  await expect(cards).toHaveCount(6);
  await expect(cards.filter({hasText:/[А-Яа-яЁё]/u})).toHaveCount(0);
  await expect(cards.getByRole('heading', {name:'Mira', exact:true})).toBeVisible();
  await page.setViewportSize({width:320,height:720});
  await expectNoHorizontalScroll(page);
  await page.getByRole('navigation', {name:'Bottom navigation'}).getByRole('button', {name:'Profile', exact:true}).click();
  const profile = page.getByRole('dialog');
  await profile.getByRole('button', {name:'RU', exact:true}).click();
  await profile.getByRole('button', {name:'Закрыть', exact:true}).click();
  await expect(cards.getByRole('heading', {name:'Мира', exact:true})).toBeVisible();
});
