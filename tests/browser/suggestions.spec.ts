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

test('lets Leo invite the user to share a stream link without overwriting the draft', async ({page}) => {
  await page.setViewportSize({width:390,height:820});
  await page.goto(workspace + '#/assistant/leo');
  await enterCode(page);
  const notice = page.getByRole('article', {name:'Совместный просмотр с Лео'});
  const addLink = notice.getByRole('button', {name:'Добавить ссылку на стрим'});
  await expect(notice).toContainText(/YouTube и VK Видео/);
  await expect(addLink).toBeInViewport({ratio:1});
  const draft = messageField(page);
  await draft.fill('Объясни, что происходит на 03:20.');
  await addLink.click();
  await expect(draft).toBeFocused();
  await expect(draft).toHaveValue('Объясни, что происходит на 03:20.');
  await expectNoHorizontalScroll(page);
  await draft.fill('Объясни момент на 03:20 https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await sendButton(page).click();
  await expect(page).toHaveURL(/#\/chat\//);
  await expect(page.locator('.message--user')).toContainText('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await page.reload();
  await expect(notice).toHaveCount(1);
  await page.setViewportSize({width:1120,height:820});
  await page.getByRole('button', {name:'ENG',exact:true}).click();
  await expect(page.getByRole('article', {name:'Watch together with Leo'})).toContainText(/YouTube and VK Video/);
});
