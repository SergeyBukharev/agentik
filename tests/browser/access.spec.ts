import {expect, test} from '@playwright/test';
import {codeA, codeB, codeField, enterCode, logInButton, messageField, openCatalog, selectChoice, sendButton, workspace} from './helpers';

test('validates format, rejects a wrong code and animates a successful login into the requested route', async ({page}) => {
  await page.goto(workspace + '#/assistant/writer');
  await expect(page.getByRole('heading', {name: 'Вход в Agentik'})).toBeVisible();
  await codeField(page).fill('аааааа');
  await codeField(page).press('Enter');
  await expect(page.getByRole('alert')).toContainText('шесть латинских букв');

  await enterCode(page, 'ZZ9ZZ9');
  await expect(page.getByRole('alert')).toContainText('Код не подошёл');
  await expect(codeField(page)).toHaveValue('');

  let continueLogin!: () => void;
  const ready = new Promise<void>(resolve => {continueLogin = resolve;});
  await page.route('**/api/access/login', async route => {
    await ready;
    await route.continue();
  });
  await codeField(page).fill(' ux9-a2k ');
  await codeField(page).press('Enter');
  const field = page.locator('.code-gate__field');
  await expect(field).toHaveAttribute('data-phase', 'checking');
  continueLogin();
  await expect(field).toHaveAttribute('data-phase', 'accepted');
  await expect(page.getByRole('heading', {name: 'Редактор'})).toBeVisible();
  await expect(page).toHaveURL(/#\/assistant\/writer$/);
});

test('keeps independent account history and propagates logout to the same account tabs', async ({page, context}) => {
  await openCatalog(page);
  await page.getByRole('link', {name: 'Открыть: Редактор'}).click();
  await messageField(page).fill('История первого аккаунта');
  await sendButton(page).click();
  await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();

  const second = await context.newPage();
  await second.goto(workspace + '#/history');
  await expect(second.getByRole('link', {name: /История первого аккаунта/})).toBeVisible();
  await second.getByRole('button', {name: 'Открыть профиль'}).click();
  await second.getByRole('button', {name: 'Выйти', exact: true}).click();
  await expect(logInButton(page)).toBeVisible();
  await expect(logInButton(second)).toBeVisible();

  await enterCode(second, codeB);
  await expect(second.getByText('Здесь начнётся ваша история')).toBeVisible();
  await expect(second.getByText('История первого аккаунта')).toHaveCount(0);
  await enterCode(page, codeA);
  await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();
  await second.reload();
  await expect(second.getByText('Здесь начнётся ваша история')).toBeVisible();
});

test('resumes a 90-day lease offline and opens cached rooms while first login needs connectivity', async ({page, context}) => {
  await openCatalog(page);
  const lease = await page.evaluate(() => {
    const account = localStorage.getItem('agentik:access:active');
    const expiry = JSON.parse(localStorage.getItem('agentik:access:' + account) ?? '{}').expiresAt;
    return expiry - Date.now();
  });
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  expect(lease).toBeGreaterThan(ninetyDays - 5000);
  expect(lease).toBeLessThanOrEqual(ninetyDays);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect(page.getByRole('status', {name: ''}).filter({hasText: 'Офлайн'})).toBeVisible();
  await page.getByRole('button', {name: 'Открыть профиль'}).click();
  await selectChoice(page, 'Режим ответов', 'AI через сервер');
  await page.getByRole('button', {name: 'Готово'}).click();
  await page.getByRole('link', {name: 'Открыть: Редактор'}).click();
  await messageField(page).fill('Проверь запрос без интернета');
  await expect(sendButton(page)).toBeDisabled();
  await expect(page.getByText('Подключитесь к интернету, чтобы отправить запрос AI.')).toBeVisible();
  await page.getByRole('button', {name: 'Открыть профиль'}).click();
  await selectChoice(page, 'Режим ответов', 'Демо, включая офлайн');
  await page.getByRole('button', {name: 'Готово'}).click();
  await sendButton(page).click();
  await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();
  await page.getByRole('link', {name: 'Групповые чаты'}).click();
  await expect(page.getByRole('heading', {name: 'Общие комнаты'})).toBeVisible();
  await page.getByRole('button', {name: 'Открыть профиль'}).click();
  await page.getByRole('button', {name: 'Выйти', exact: true}).click();
  await expect(page.getByText('Для проверки кода нужен интернет.')).toBeVisible();
  await expect(logInButton(page)).toBeDisabled();
  await context.setOffline(false);
  await enterCode(page);
  await expect(page.getByRole('heading',{name:'Ваши разговоры'})).toBeVisible();
});

test('recovers a request interrupted during login and explains an expired lease', async ({page}) => {
  await page.goto(workspace + '#/login');
  const intercept = '**/api/access/login';
  await page.route(intercept, route => route.abort('failed'), {times: 1});
  await enterCode(page);
  await expect(page.getByRole('alert')).toContainText('Не удалось связаться с сервером');
  await expect(codeField(page)).toHaveValue(codeA);
  await logInButton(page).click();
  await expect(page.getByRole('heading',{name:'Ваши разговоры'})).toBeVisible();
  await page.evaluate(() => {
    const key = 'agentik:access:' + localStorage.getItem('agentik:access:active');
    const session = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({...session, expiresAt: Date.now() - 1}));
  });
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Вход в Agentik'})).toBeVisible();
});

test('shows 404 on hash and physical URLs and handles stale conversation links', async ({page}) => {
  await page.goto(workspace + '#/unknown');
  await expect(page.getByText('404', {exact: true})).toBeVisible();
  const state = page.getByRole('region', {name: 'Страница не найдена'});
  await expect(state).toBeFocused();
  await state.getByRole('link', {name: 'На главную'}).click();
  await expect(page.getByRole('link', {name: 'Войти по коду'})).toBeVisible();
  await page.goto(workspace + '404.html');
  await expect(state).toBeVisible();
  await expect(state.getByRole('link', {name: 'На главную'})).toHaveAttribute('href', workspace);
  await openCatalog(page);
  await page.goto(workspace + '#/chat/missing');
  await expect(page.getByRole('heading', {name: 'Разговор не найден'})).toBeVisible();
  await page.getByRole('link', {name: 'К истории'}).click();
  await expect(page.getByRole('heading', {name: 'Ваши разговоры'})).toBeVisible();
});

test('opens local rooms across tabs and reports an invalid invitation', async ({page, context}) => {
  await openCatalog(page);
  await page.getByRole('link', {name: 'Групповые чаты'}).click();
  await page.getByRole('button', {name: 'Создать комнату'}).click();
  await page.getByRole('textbox', {name: 'Название комнаты'}).fill('Общий черновик');
  await page.getByRole('dialog').getByRole('button', {name: 'Создать комнату'}).click();
  await page.getByRole('button', {name: 'Пригласить участника'}).click();
  const invitation = await page.getByRole('textbox', {name: 'Приглашение'}).inputValue();
  await page.keyboard.press('Escape');
  const second = await context.newPage();
  await second.goto(invitation);
  await second.getByRole('button', {name: 'Открыть профиль'}).click();
  await second.getByRole('button', {name: 'Другой профиль'}).click();
  await second.getByRole('textbox', {name: 'Как вас зовут?'}).fill('Елена');
  await second.getByRole('button', {name: 'Создать пространство'}).click();
  await second.getByRole('button', {name: 'Присоединиться'}).click();
  await second.getByRole('textbox', {name: 'Сообщение участникам'}).fill('Привет из соседней вкладки');
  await second.getByRole('button', {name: 'Отправить участникам'}).click();
  await expect(page.getByText('Привет из соседней вкладки')).toBeVisible();
  await second.goto(workspace + '#/join/invalid');
  await second.getByRole('button', {name: 'Присоединиться'}).click();
  await expect(second.getByRole('alert')).toBeVisible();
});
