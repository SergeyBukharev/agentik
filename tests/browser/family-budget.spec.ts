import {expect, test} from '@playwright/test';
import {expectNoHorizontalScroll, messageField, openCatalog, workspace} from './helpers';

test('creates one saved budget message on demand and keeps the chat draft', async ({page}) => {
  await page.setViewportSize({width:320, height:730});
  await page.emulateMedia({reducedMotion:'reduce'});
  await openCatalog(page);
  await page.getByRole('link', {name:'Открыть: Семейный финансист'}).click();

  const suggestions = page.getByRole('group', {name:'Подсказки для сообщения'});
  const create = suggestions.getByRole('button', {name:'Создать таблицу бюджета'});
  const history = page.locator('.chat__messages');
  const card = history.getByRole('button', {name:'Открыть таблицу бюджета'});
  const budget = page.getByRole('dialog', {name:'Семейный бюджет'});
  await expect(suggestions.getByRole('button', {name:'Помоги разобрать чек'})).toBeVisible();
  await expect(page.getByRole('table', {name:'Расходы месяца'})).toHaveCount(0);
  await expect(card).toHaveCount(0);
  await messageField(page).fill('Мой черновик о расходах');
  await create.click();
  await expect(budget.getByRole('table', {name:'Расходы месяца'})).toBeVisible();
  await expect(page).toHaveURL(/#\/chat\/[\w-]+$/);
  const chatUrl = page.url();
  await budget.getByRole('button', {name:'Закрыть', exact:true}).click();
  await expect(history.getByText('Таблица семейного бюджета', {exact:true})).toBeVisible();
  await expect(card).toHaveCount(1);
  await expect(card).toBeFocused();
  await expect(messageField(page)).toHaveValue('Мой черновик о расходах');

  await create.click();
  await expect(budget).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(budget).toHaveCount(0);
  await expect(create).toBeFocused();
  await expect(card).toHaveCount(1);
  await expect(page).toHaveURL(chatUrl);

  await page.getByRole('link', {name:'Закрыть чат'}).click();
  await expect(page).toHaveURL(/#\/history$/);
  await page.getByRole('link', {name:/Таблица семейного бюджета/}).click();
  await expect(page).toHaveURL(chatUrl);
  await page.reload();
  await expect(budget).toHaveCount(0);
  await card.click();
  await expect(budget.getByRole('table', {name:'Расходы месяца'})).toBeVisible();
});

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
  await page.getByRole('button', {name:'Создать таблицу бюджета'}).click();

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

  await page.reload();
  await page.getByRole('button', {name:'Открыть таблицу бюджета'}).click();
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
