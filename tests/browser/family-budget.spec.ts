import {expect, test} from '@playwright/test';
import {expectNoHorizontalScroll, openCatalog, workspace} from './helpers';

test('keeps the family financier first and saves an editable three-column monthly budget', async ({page}) => {
  await page.setViewportSize({width:320, height:800});
  await page.emulateMedia({reducedMotion:'reduce'});
  await openCatalog(page);
  const first = page.locator('.agent-card').first().getByRole('link', {name:'Открыть: Семейный финансист'});
  await expect(first).toBeVisible();
  await expect(page.getByText(/МАЛЕНЬКИЕ ПОМОЩНИКИ/)).toHaveCount(0);
  await expect(page.getByText(/\(c\) Sergey Buharev/)).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/#\/assistant\/budget$/);

  const salary = page.getByRole('textbox', {name:'Общая зарплата семьи за месяц, ₽'});
  await salary.fill('60 000');
  await page.getByRole('button', {name:'Сохранить зарплату'}).click();
  const table = page.getByRole('table', {name:'Расходы месяца'});
  await expect(table.getByRole('columnheader')).toHaveCount(3);

  await page.getByRole('button', {name:'Добавить платёж'}).click();
  const bill = page.getByRole('dialog', {name:'Добавить платёж'});
  await bill.getByRole('textbox', {name:'Название платежа'}).fill('Аренда');
  await bill.getByRole('textbox', {name:'Сумма, ₽'}).fill('20000');
  await bill.getByRole('button', {name:'Сохранить', exact:true}).click();
  await expect(table.getByRole('button', {name:'Аренда'})).toBeVisible();

  await page.getByRole('button', {name:'Добавить покупку'}).click();
  const purchase = page.getByRole('dialog', {name:'Добавить покупку'});
  await purchase.getByRole('textbox', {name:'Что купили'}).fill('Продукты');
  await purchase.getByRole('textbox', {name:'Сумма, ₽'}).fill('4000');
  await purchase.getByRole('button', {name:'Сохранить', exact:true}).click();
  const left = page.locator('[data-budget-left]');
  await expect(left).toHaveText(/36\s000\s₽/);
  const daily = await page.evaluate(() => {
    const today = new Date();
    const days = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate()-today.getDate()+1;
    return new Intl.NumberFormat('ru', {style:'currency',currency:'RUB',minimumFractionDigits:0,maximumFractionDigits:2}).format(Math.floor(3600000/days)/100);
  });
  await expect(page.locator('[data-budget-daily]')).toHaveText(daily);
  await expectNoHorizontalScroll(page);
  await expect(page.getByRole('button', {name:'Помоги разобрать чек'})).toBeVisible();

  await page.reload();
  await expect(left).toHaveText(/36\s000\s₽/);
  await expect(table.getByRole('button', {name:'Продукты'})).toBeVisible();
  await page.getByRole('button', {name:'Следующий месяц'}).click();
  await expect(table.getByRole('button', {name:'Продукты'})).toHaveCount(0);
  await page.getByRole('button', {name:'Предыдущий месяц'}).click();
  await expect(left).toHaveText(/36\s000\s₽/);
});

test('shows the slogan only on the public landing page', async ({page}) => {
  await page.goto(workspace);
  await expect(page.getByText('МАЛЕНЬКИЕ ПОМОЩНИКИ. БОЛЬШИЕ ВОЗМОЖНОСТИ.')).toBeVisible();
});
