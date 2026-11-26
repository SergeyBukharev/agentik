import {expect, test} from '@playwright/test';

test('starts an independent conversation from a quick prompt and keeps it after reload', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('agentik:v1', JSON.stringify({version: 1, favorites: ['budget']}));
  });
  await page.goto('./');
  await expect(page.getByRole('heading', {name: 'Что сегодня придумаем?'})).toBeVisible();
  await page.getByRole('button', {name: /Придумать/}).click();
  const field = page.getByRole('textbox', {name: 'Сообщение', exact: true});
  await expect(field).toBeFocused();
  await field.fill('Помоги придумать идею для проекта о растениях');
  await expect(page.getByRole('status').filter({hasText: /через 3 дня/})).toBeVisible();
  await page.getByRole('button', {name: 'Отправить', exact: true}).click();
  await page.getByRole('button', {name: 'Продолжить гостем', exact: true}).click();
  await expect(page).toHaveURL(/#\/chat\//);
  await expect(page.getByRole('log').getByText('Помоги придумать идею для проекта о растениях', {exact: true})).toBeVisible();
  await expect(page.getByText('Три направления для идеи', {exact: true})).toBeVisible();

  await page.reload();
  await expect(page.getByText('Три направления для идеи', {exact: true})).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('agentik:v1'))).toBe('{"version":1,"favorites":["budget"]}');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
});

test('opens the studio from the illustration and sends the original draft after creating an account', async ({page}) => {
  await page.goto('./');
  await page.getByRole('link', {name: 'Войти в студию через иллюстрацию'}).click();
  await expect(page).toHaveURL(/#\/new$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', {name: 'Сообщение', exact: true}).fill('Как разбить идею на шаги?');
  await page.getByRole('button', {name: 'Отправить', exact: true}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(/через 3 дня/);
  await dialog.getByRole('button', {name: 'Создать аккаунт', exact: true}).click();
  await dialog.getByLabel('Имя').fill('Вика');
  await dialog.getByLabel('Email').fill('vika@example.test');
  await dialog.getByLabel('Код из 6 цифр').fill('091384');
  await dialog.getByRole('button', {name: 'Создать аккаунт', exact: true}).click();
  await expect(page).toHaveURL(/#\/chat\//);
  await expect(page.getByText('Как разбить идею на шаги?', {exact: true}).last()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Как разбить идею на шаги?', {exact: true}).last()).toBeVisible();
  await page.getByRole('button', {name: 'Настройки', exact: true}).click();
  await expect(dialog.getByText('vika@example.test', {exact: true})).toBeVisible();
});

test('removes only expired guest chats from history', async ({page}) => {
  await page.addInitScript(() => {
    const now = Date.now(), day = 86_400_000;
    const make = (id: string, title: string, days: number) => ({id, title, assistantId: 'ideas', messages: [], updatedAt: now - day * days});
    localStorage.setItem('agentik:b-demo:v1', JSON.stringify({
      locale: 'ru', theme: 'system', chats: [make('old', 'Просроченный чат', 4), make('recent', 'Недавний чат', 2)],
      favorites: [], notes: [], expiresAt: now + day * 90,
    }));
  });
  await page.goto('./#/history');
  await expect(page.getByRole('link', {name: /Недавний чат/}).last()).toBeVisible();
  await expect(page.getByText('Просроченный чат')).toHaveCount(0);
});

test('finds an assistant, saves it and retains settings at compact widths', async ({page}) => {
  await page.goto('./');
  await page.getByRole('button', {name: 'Поиск', exact: true}).click();
  const search = page.getByRole('searchbox', {name: 'Поиск помощников и чатов'});
  await search.fill('English');
  await page.getByRole('link', {name: /English buddy/}).click();
  await expect(page.getByRole('heading', {name: 'English buddy'})).toBeVisible();
  await page.getByRole('button', {name: 'В избранное', exact: true}).click();
  await page.getByRole('link', {name: 'Сохранённое', exact: true}).first().click();
  await expect(page.getByRole('heading', {name: 'Сохранённое'})).toBeVisible();
  await expect(page.getByRole('link', {name: /English buddy/})).toBeVisible();

  await page.getByRole('button', {name: 'Настройки', exact: true}).click();
  await page.getByRole('button', {name: 'Тёмная', exact: true}).click();
  await page.getByRole('button', {name: 'English', exact: true}).click();
  await page.getByRole('button', {name: 'Close', exact: true}).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', {name: 'Saved'})).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
});
