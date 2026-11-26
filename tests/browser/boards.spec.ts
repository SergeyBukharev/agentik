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
