import {expect, test} from '@playwright/test';
import {codeField, enterCode, expectNoHorizontalScroll, messageField, sendButton, workspace} from './helpers';

test('keeps the landing, code form, catalog, chat, modal and 404 inside the viewport', async ({page}) => {
  const widths = [320, 360, 390, 768];
  const name = 'СверхдлинноеНазвание'.repeat(3);
  await page.goto(workspace);
  await expect(page.getByRole('link', {name: 'Войти по коду'})).toBeVisible();
  for (const width of widths) {
    await page.setViewportSize({width, height: 690});
    await expectNoHorizontalScroll(page);
  }
  await page.getByRole('link', {name: 'Войти по коду'}).click();
  await expect(codeField(page)).toBeVisible();
  for (const width of widths) {
    await page.setViewportSize({width, height: 625});
    await codeField(page).focus();
    await expectNoHorizontalScroll(page);
  }
  await enterCode(page);
  await expect(page.getByRole('heading',{name:'Ваши разговоры'})).toBeVisible();
  await page.goto(workspace+'#/assistants');
  await expect(page.getByRole('searchbox')).toBeVisible();
  for (const width of widths) {
    await page.setViewportSize({width, height: 690});
    await expectNoHorizontalScroll(page);
  }
  await page.setViewportSize({width: 320, height: 690});
  const categories = page.locator('.category-list');
  expect(await categories.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('navigation', {name: 'Нижняя навигация'}).getByRole('button', {name: 'Создать помощника'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole('textbox', {name: 'Название', exact: true}).fill(name);
  await page.getByRole('textbox', {name: 'Что он умеет'}).fill('ДлинноеОписание'.repeat(30));
  await page.getByRole('button', {name: 'Сохранить помощника'}).click();
  await expect(page.getByRole('heading', {name, exact: true})).toBeVisible();
  await messageField(page).fill('Ж'.repeat(6000));
  await sendButton(page).click();
  await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();
  for (const width of widths) {
    await page.setViewportSize({width, height: 690});
    await expectNoHorizontalScroll(page);
  }
  await page.goto(workspace + '#/bad-url');
  await expect(page.getByRole('heading', {name: 'Страница не найдена'})).toBeVisible();
  await page.setViewportSize({width: 320, height: 590});
  await expectNoHorizontalScroll(page);
});

test('supports browser back and reduced motion', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto(workspace);
  await page.getByRole('link', {name: 'Войти по коду'}).click();
  await expect(codeField(page)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', {name: 'Войти по коду'})).toBeVisible();
  await page.goto(workspace + '#/assistant/writer');
  await enterCode(page);
  await expect(page.getByRole('heading', {name: 'Привет! С чем помочь?'})).toBeVisible();
  await expect(page.locator('canvas[data-running]')).toHaveCount(0);
  await messageField(page).fill('Первый запрос без анимации');
  await messageField(page).press('Enter');
  await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();
  await expect(page.locator('.send-pulse')).toHaveCount(0);
});
