import {expect, test} from '@playwright/test';
import {enterCode, expectNoHorizontalScroll, messageField, sendButton, workspace} from './helpers';

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
  await page.locator('input[type=file]').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('Факт из локального документа.')});
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
  await page.locator('input[type=file]').setInputFiles({name:'sample.pdf',mimeType:'application/pdf',buffer:textPdf()});
  await expect(page.getByText('Board PDF sample',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Открыть PDF'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Извлечь данные'})).toBeEnabled();
});
