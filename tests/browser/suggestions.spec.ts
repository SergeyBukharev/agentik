import {expect, test} from '@playwright/test';
import {enterCode, expectNoHorizontalScroll, messageField, sendButton, workspace} from './helpers';

test('keeps three role-specific suggestions in an existing chat and appends to the draft', async ({page}) => {
  await page.setViewportSize({width:320,height:730});
  await page.goto(workspace+'#/assistant/career');
  await enterCode(page);
  await expect(page.getByRole('heading', {name:'Карьерный навигатор'})).toBeVisible();
  const suggestions = page.getByRole('group', {name:'Подсказки для сообщения'});
  await expect(suggestions.getByRole('button')).toHaveCount(3);
  await suggestions.getByRole('button', {name:'Подготовь меня к собеседованию'}).click();
  const draft = messageField(page);
  await expect(draft).toHaveValue('Подготовь меня к собеседованию');
  await sendButton(page).click();
  await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();

  await expect(suggestions.getByRole('button')).toHaveCount(3);
  await draft.fill('Хочу сменить сферу.');
  await suggestions.getByRole('button', {name:'Помоги подготовить резюме для PDF'}).click();
  await expect(draft).toHaveValue('Хочу сменить сферу.\n\nПомоги подготовить резюме для PDF');
  await expect(draft).toBeFocused();
  await expect(page.locator('.message--user')).toHaveCount(1);
  await expectNoHorizontalScroll(page);

  await page.setViewportSize({width:1120,height:730});
  await page.getByRole('button', {name:'ENG', exact:true}).click();
  await expect(page.getByRole('group', {name:'Message suggestions'}).getByRole('button', {name:'Help me prepare a résumé for PDF'})).toBeVisible();
});
