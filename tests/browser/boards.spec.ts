import {expect, test} from '@playwright/test';
import {codeB, enterCode, expectNoHorizontalScroll, messageField, selectChoice, sendButton, workspace} from './helpers';

function textPdf() {
  const stream = 'BT /F1 12 Tf 20 80 Td (Board PDF sample) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 120] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf='%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index+1} 0 obj\n${object}\nendobj\n`;
    return offset.toString().padStart(10,'0')+' 00000 n \n';
  });
  const xref=pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test('keeps files on a local board and sends an excerpt to the same chat draft', async ({page}) => {
  await page.setViewportSize({width:375,height:780});
  await page.goto(workspace+'#/assistant/writer');
  await enterCode(page);
  const field = messageField(page);
  await field.fill('Начало разговора');
  await sendButton(page).click();
  await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();
  const chatUrl = page.url();
  await field.fill('Мой черновик');
  const tabs = page.getByRole('navigation',{name:'Чат и файлы'});
  await tabs.getByRole('link',{name:'Доска'}).click();
  await expect(page).toHaveURL(/#\/board\/writer\//);
  await expect(page.getByRole('button',{name:'Добавить файлы'})).toBeEnabled();
  await page.locator('.chat-board input[type=file]').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('Факт из локального документа.')});
  await expect(page.getByText('Факт из локального документа.',{exact:true})).toBeVisible();
  await expectNoHorizontalScroll(page);

  let sent = 0;
  page.on('request', request => {if(new URL(request.url()).pathname==='/api/chat') sent++;});
  await page.getByRole('button',{name:'Сделать выжимку'}).click();
  await expect(page).toHaveURL(chatUrl);
  await expect(field).toHaveValue(/Мой черновик[\s\S]*Факт из локального документа/);
  expect(sent).toBe(0);
  await expect(page.locator('.message--user')).toHaveCount(1);

  await page.goto(workspace+'#/boards');
  await expect(page.getByRole('heading',{name:'Доски',exact:true})).toBeVisible();
  await page.getByRole('link',{name:/Редактор/}).click();
  await expect(page).toHaveURL(/#\/board\/writer$/);
  await page.reload();
  await expect(page.getByText('Факт из локального документа.',{exact:true})).toBeVisible();
});

test('extracts text from a PDF with the production worker', async ({page}) => {
  await page.goto(workspace+'#/board/writer');
  await enterCode(page);
  await expect(page.getByRole('button',{name:'Добавить файлы'})).toBeEnabled();
  await page.locator('.chat-board input[type=file]').setInputFiles({name:'sample.pdf',mimeType:'application/pdf',buffer:textPdf()});
  await expect(page.getByText('Board PDF sample',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Открыть PDF'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Извлечь данные'})).toBeEnabled();
});

test('keeps a long comparison filename inside the board and its dropdown', async ({page}) => {
  await page.setViewportSize({width: 320, height: 568});
  await page.goto(workspace + '#/board/writer');
  await enterCode(page);
  await expect(page.getByRole('button', {name: 'Добавить файлы'})).toBeEnabled();
  const longFilename = 'QuarterlyRevenueForecastData'.repeat(5) + '.md';
  await page.locator('.chat-board input[type=file]').setInputFiles([
    {name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Board notes.')},
    {name: longFilename, mimeType: 'text/markdown', buffer: Buffer.from('Forecast detail.')},
  ]);

  await page.getByRole('button', {name: 'Сравнить', exact: true}).click();
  await expectNoHorizontalScroll(page);
  await page.getByRole('combobox', {name: 'С каким файлом сравнить'}).click();
  const option = page.getByRole('option', {name: longFilename});
  await expect(option).toBeVisible();
  expect(await option.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await option.click();
  await expect(page.getByRole('button', {name: 'В черновик'})).toBeInViewport();
});

test.describe('board on a phone with a wide layout viewport', () => {
  test.use({viewport: {width: 390, height: 500}, screen: {width: 390, height: 500}, isMobile: true, hasTouch: true});

  test('brings the selected file preview into view below the list', async ({page}) => {
    await page.route('**/agentik/', async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/<meta name="viewport"[^>]*>/, '');
      await route.fulfill({response, body});
    });
    await page.goto(workspace + '#/board/writer');
    await enterCode(page);
    await expect(page.getByRole('button', {name: 'Добавить файлы'})).toBeEnabled();
    expect(await page.evaluate(() => window.innerWidth)).toBeGreaterThan(760);
    const files = Array.from({length: 8}, (_, index) => ({
      name: `notes-${index}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`Notes ${index}`),
    }));
    await page.locator('.chat-board input[type=file]').setInputFiles(files);
    const file = page.getByRole('button', {name: /notes-1\.txt/});
    await expect(file).toBeInViewport({ratio: 1});
    const preview = page.getByRole('region', {name: 'Просмотр файла'});
    await file.press('Enter');
    await expect(preview.getByRole('heading', {name: 'notes-1.txt'})).toBeInViewport({ratio: 1});
  });
});

test('opens the saved family budget from both boards and keeps edits with the table', async ({page}) => {
  await page.setViewportSize({width: 320, height: 720});
  await page.goto(workspace + '#/boards');
  await enterCode(page);
  await expect(page.getByRole('heading', {name: 'Доски', exact: true})).toBeVisible();
  await page.evaluate(() => {
    const activeKey = Object.keys(sessionStorage).find(key => key.startsWith('agentik:active:'));
    const profileId = activeKey && sessionStorage.getItem(activeKey);
    if (!profileId) throw new Error('The workspace did not select a profile');
    const today = new Date();
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem(`agentik:family-budget:${profileId}:${month}`, JSON.stringify({
      version: 1, salaryCents: 6_000_000,
      entries: [{id: 'rent', label: 'Rent', cents: 2_000_000, kind: 'bill'}],
    }));
    localStorage.setItem('agentik:language', 'en');
  });
  await page.reload();

  const budgetItem = page.getByRole('button', {name: 'Family budget', exact: true});
  const budget = page.getByRole('dialog', {name: 'Family budget', exact: true});
  await expect(budgetItem).toBeVisible();
  await expect(page.getByRole('heading', {name: 'No boards yet'})).toHaveCount(0);
  await budgetItem.press('Enter');
  const table = budget.getByRole('table', {name: 'Monthly expenses'});
  await expect(table.getByRole('button', {name: 'Rent'})).toBeVisible();
  const tableBounds = (await table.boundingBox())!;
  const dialogBounds = (await budget.boundingBox())!;
  expect(tableBounds.x + tableBounds.width).toBeLessThanOrEqual(dialogBounds.x + dialogBounds.width);
  const income = budget.getByRole('textbox', {name: 'Total family income this month, ₽'});
  await income.fill('65 000');
  await budget.getByRole('button', {name: 'Save income'}).click();
  await expectNoHorizontalScroll(page);
  await page.keyboard.press('Escape');
  await expect(budget).toHaveCount(0);
  await expect(budgetItem).toBeFocused();

  await page.goto(workspace + '#/board/budget');
  await expect(page.getByRole('button', {name: 'Add files'})).toBeEnabled();
  await expect(page.getByRole('heading', {name: 'Your files go here'})).toHaveCount(0);
  await budgetItem.click();
  await expect(income).toHaveValue('65000');
  await budget.getByRole('button', {name: 'Close', exact: true}).click();
  await page.locator('.chat-board input[type=file]').setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Notes from the board.'),
  });
  await expect(page.getByText('Notes from the board.', {exact: true})).toBeVisible();
  await expect(budgetItem).toBeVisible();

  await page.goto(workspace + '#/boards');
  await expect(page.getByRole('link', {name: /Files: 1/})).toBeVisible();
  await expect(budgetItem).toHaveCount(1);
  await expectNoHorizontalScroll(page);
});

test('keeps empty boards empty until there is a family budget', async ({page}) => {
  await page.goto(workspace + '#/boards');
  await enterCode(page);
  const budgetItem = page.getByRole('button', {name: 'Семейный бюджет', exact: true});
  await expect(page.getByRole('heading', {name: 'Доски пока пусты'})).toBeVisible();
  await expect(budgetItem).toHaveCount(0);

  await page.goto(workspace + '#/board/budget');
  await expect(page.getByRole('heading', {name: 'Здесь будут файлы'})).toBeVisible();
  await expect(budgetItem).toHaveCount(0);
});

test('attaches a board file to the chat draft and sends it with the edited request', async ({page}) => {
  await page.setViewportSize({width:375,height:780});
  await page.goto(workspace+'#/assistant/writer');
  await enterCode(page, codeB);
  const field = messageField(page);
  await field.fill('Сократи второй абзац.');
  const chat = page.url();
  const tabs = page.getByRole('navigation',{name:'Чат и файлы'});
  await tabs.getByRole('link',{name:'Доска'}).click();
  const source = 'Начало плана.\n\nВторой абзац плана.';
  await expect(page.getByRole('button',{name:'Добавить файлы'})).toBeEnabled();
  await page.locator('.chat-board input[type=file]').setInputFiles({name:'plan.md',mimeType:'text/markdown',buffer:Buffer.from(source)});
  const edit = page.getByRole('button',{name:'Редактировать в чате'});
  await expect(edit).toBeVisible({timeout:4000});

  let latest: unknown;
  await page.route('**/api/chat', route => {
    latest = route.request().postDataJSON().messages.at(-1);
    return route.fulfill({json:{reply:'Сокращённый план готов.'}});
  });
  await edit.click();
  await expect(page).toHaveURL(chat);
  await expect(field).toHaveValue('Сократи второй абзац.');
  await expect(page.getByRole('button',{name:'Убрать файл из черновика'})).toBeVisible();
  await expect(page.locator('.composer')).toContainText('plan.md');
  expect(latest).toBeUndefined();
  await expect(page.locator('.message--user')).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  await page.getByRole('button',{name:'Убрать файл из черновика'}).click();
  await expect(page.locator('.composer')).not.toContainText('plan.md');
  await expect(field).toHaveValue('Сократи второй абзац.');
  await tabs.getByRole('link',{name:'Доска'}).click();
  await edit.click();
  await expect(page.locator('.composer')).toContainText('plan.md');

  await page.getByRole('button',{name:'Открыть профиль'}).click();
  await selectChoice(page, 'Режим ответов', 'AI через сервер');
  await page.getByRole('button',{name:'Готово'}).click();
  await sendButton(page).click();
  await expect(page.getByText('Сокращённый план готов.',{exact:true})).toBeVisible();
  expect(latest).toMatchObject({role:'user',content:'Сократи второй абзац.',document:{name:'plan.md',text:source}});
  await expect(page.getByRole('button',{name:'Убрать файл из черновика'})).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.message--user').getByText('plan.md',{exact:true})).toBeVisible();
});
