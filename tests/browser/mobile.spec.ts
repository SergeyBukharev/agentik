import {devices, expect, test} from '@playwright/test';
import {codeB, codeField, enterCode, expectNoHorizontalScroll, messageField, sendButton, workspace} from './helpers';

test('keeps the phone layout readable in a wide virtual viewport', async ({browser, browserName, baseURL}) => {
  const device = devices[browserName === 'webkit' ? 'iPhone 13' : 'Pixel 7'];
  const context = await browser.newContext({...device, baseURL, serviceWorkers:'block', reducedMotion:'reduce'});
  try {
    await context.route('**/agentik/', async route => {
      // Model a browser that ignores the site's viewport meta tag in desktop mode.
      const response = await route.fetch();
      const body = (await response.text()).replace(/<meta name="viewport"[^>]*>/u, '');
      await route.fulfill({response, body});
    });
    const page = await context.newPage();
    await page.goto(workspace);
    const scale = await page.evaluate(() => window.visualViewport!.scale);
    expect(await page.evaluate(() => innerWidth)).toBeGreaterThan(820);
    expect(scale).toBeLessThan(.75);

    await page.getByRole('link', {name:'Войти по коду'}).click();
    await expect(codeField(page)).toBeInViewport({ratio:1});
    await enterCode(page);
    await expect(page.getByRole('heading', {name:'Ваши разговоры'})).toBeVisible();
    await page.goto(workspace + '#/');

    const navigation = page.getByRole('navigation', {name:'Нижняя навигация'});
    await expect(page.getByRole('navigation', {name:'Главная навигация'})).toBeHidden();
    await expect(navigation).toBeInViewport();
    const navItem = navigation.getByRole('link', {name:'Каталог'});
    expect((await navItem.boundingBox())!.height * scale).toBeGreaterThanOrEqual(44);
    await navItem.click();
    const search = page.getByRole('searchbox');
    await expect(search).toBeInViewport();
    expect((await page.locator('label.search').boundingBox())!.height * scale).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalScroll(page);

    await page.goto(workspace + '#/assistant/writer');
    await expect(messageField(page)).toBeInViewport();
    await expect(sendButton(page)).toBeInViewport();
    const send = (await sendButton(page).boundingBox())!;
    expect(send.y + send.height).toBeLessThanOrEqual((await navigation.boundingBox())!.y);
    await expectNoHorizontalScroll(page);

    const editor = messageField(page);
    await editor.focus();
    const keyboardTop = await page.evaluate(() => {
      const viewport = window.visualViewport!;
      const height = viewport.height - 260 / viewport.scale;
      Object.defineProperty(viewport, 'height', {value:height, configurable:true});
      viewport.dispatchEvent(new Event('resize'));
      return height;
    });
    await expect(navigation).toBeHidden();
    const keyboardSend = (await sendButton(page).boundingBox())!;
    expect(keyboardSend.y + keyboardSend.height).toBeLessThanOrEqual(keyboardTop + 1);

    await page.goto(workspace + '#/characters');
    await navigation.getByRole('button', {name:'Профиль'}).click();
    const profile = page.getByRole('dialog');
    await profile.getByRole('button', {name:'ENG', exact:true}).click();
    await profile.getByRole('button', {name:'Close', exact:true}).click();

    for (const [route, title] of [['characters', 'Who shall we talk to?'], ['favorites', 'Your favorites']]) {
      await page.goto(workspace + '#/' + route);
      const heading = page.getByRole('heading', {name:title, exact:true});
      const searchLabel = page.locator('label.search');
      await expect(heading).toBeVisible();
      const [headingBox, searchBox] = await Promise.all([heading.boundingBox(), searchLabel.boundingBox()]);
      expect(headingBox!.width).toBeGreaterThanOrEqual(searchBox!.width - 1);
      expect(headingBox!.y + headingBox!.height).toBeLessThan(searchBox!.y);
      await expect(searchLabel).toBeInViewport();
      await expectNoHorizontalScroll(page);
    }
  } finally {
    await context.close();
  }
});

test('keeps touch navigation and chat controls reachable as the viewport changes', async ({browser, browserName, baseURL}) => {
  const device = browserName === 'webkit' ? 'iPhone 13 landscape' : 'Pixel 7 landscape';
  const compactViewports = [
    devices[device].viewport,
    {width:568, height:320},
    {width:844, height:390},
    {width:844, height:530},
    {width:915, height:600},
    {width:641, height:900},
    {width:768, height:1024},
  ];
  const context = await browser.newContext({...devices[device], baseURL, reducedMotion:'reduce'});
  try {
    const page = await context.newPage();
    await page.goto(workspace);
    await expect(page.getByRole('link', {name:'Войти по коду'})).toBeInViewport({ratio:1});
    await page.getByRole('link', {name:'Войти по коду'}).click();
    await expect(page.getByRole('textbox', {name:'Email'})).toBeInViewport({ratio:1});
    await expect(codeField(page)).toBeInViewport({ratio:1});
    await expect(page.getByRole('button', {name:'Войти', exact:true})).toBeInViewport({ratio:1});
    await enterCode(page);

    const navigation = page.getByRole('navigation', {name:'Нижняя навигация'});
    await expect(navigation).toBeInViewport({ratio:1});
    await expect(page.getByRole('navigation', {name:'Главная навигация'})).toBeHidden();
    await navigation.getByRole('link', {name:'Каталог'}).click();
    const search = page.getByRole('searchbox');
    for (const viewport of compactViewports) {
      await page.setViewportSize(viewport);
      await expect(navigation).toBeInViewport({ratio:1});
      await expect(search).toBeInViewport({ratio:1});
      const searchBox = (await search.boundingBox())!;
      expect(searchBox.width).toBeGreaterThan(viewport.width * 0.75);
      expect(searchBox.y + searchBox.height).toBeLessThanOrEqual((await navigation.boundingBox())!.y);
      await expectNoHorizontalScroll(page);
    }

    await page.goto(workspace + '#/assistant/writer');
    await messageField(page).fill('Сообщение для проверки мобильной вёрстки');
    await sendButton(page).click();
    await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();
    await messageField(page).blur();
    for (const viewport of compactViewports) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(navigation).toBeInViewport({ratio:1});
      await expect(page.getByRole('navigation', {name:'Главная навигация'})).toBeHidden();
      await expect(messageField(page)).toBeInViewport({ratio:1});
      await expect(sendButton(page)).toBeInViewport({ratio:1});
      await expect(page.getByRole('link', {name:'Назад к чатам'})).toBeInViewport({ratio:1});
      const sendBox = (await sendButton(page).boundingBox())!;
      expect(sendBox.y + sendBox.height).toBeLessThanOrEqual((await navigation.boundingBox())!.y);
      if (viewport.height <= 320) {
        await page.getByRole('button', {name:'Увеличить поле сообщения'}).click();
        await expect(messageField(page)).toBeInViewport({ratio:1});
        const expandedSend = (await sendButton(page).boundingBox())!;
        expect(expandedSend.y + expandedSend.height).toBeLessThanOrEqual((await navigation.boundingBox())!.y);
        await page.getByRole('button', {name:'Уменьшить поле сообщения'}).click();
      }
      await expectNoHorizontalScroll(page);
    }
  } finally {
    await context.close();
  }
});

test('keeps the chat field and send button above a mobile keyboard', async ({page}) => {
  await page.setViewportSize({width:390,height:720});
  await page.goto(workspace + '#/assistant/writer');
  await enterCode(page);
  const field = messageField(page);
  const navigation = page.getByRole('navigation', {name:'Нижняя навигация'});
  await expect(navigation).toBeVisible();
  await field.fill('Отправлено над клавиатурой');
  await page.evaluate(() => {
    const viewport = window.visualViewport!;
    Object.defineProperty(viewport,'height',{value:405,configurable:true});
    Object.defineProperty(viewport,'offsetTop',{value:35,configurable:true});
    viewport.dispatchEvent(new Event('resize'));
  });
  await expect(navigation).toBeHidden();
  const send = (await sendButton(page).boundingBox())!;
  expect(send.y + send.height).toBeLessThanOrEqual(440);
  await sendButton(page).click();
  await expect(page.locator('.message--user')).toContainText('Отправлено над клавиатурой');
  await expect(field).toHaveValue('');
  await expect(navigation).toBeHidden();

  await field.blur();
  await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, 'height');
    Reflect.deleteProperty(window.visualViewport!, 'offsetTop');
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(navigation).toBeVisible();

  await field.focus();
  await page.setViewportSize({width:390,height:320});
  await expect(navigation).toBeHidden();
  await expect(field).toBeInViewport({ratio:1});
  await expect(sendButton(page)).toBeInViewport({ratio:1});
  await page.setViewportSize({width:390,height:720});
  await expect(navigation).toBeVisible();
});

for (const kind of ['private', 'group'] as const) {
  test(`keeps the ${kind} chat composer visible while browsing a long history`, async ({page}) => {
    await page.goto(workspace + '#/login');
    await enterCode(page, codeB);
    await expect(page.getByRole('heading', {name:'Ваши разговоры'})).toBeVisible();
    if (kind === 'group') {
      await page.goto(workspace + '#/rooms');
      await page.getByRole('button', {name:'Создать комнату'}).click();
      await page.getByRole('textbox', {name:'Название комнаты'}).fill('Архив группы');
      await page.getByRole('dialog').getByRole('button', {name:'Создать комнату'}).click();
      await expect(page.getByRole('heading', {name:'Архив группы'})).toBeVisible();
    }
    await page.evaluate(kind => {
      const updatedAt = Date.now();
      const messages = Array.from({length:24}, (_, index) =>
        `Сообщение ${index + 1}\n${'Текст для проверки прокрутки. '.repeat(8)}`);
      if (kind === 'group') {
        const key = 'agentik:rooms:v1';
        const rooms = JSON.parse(localStorage.getItem(key)!);
        const room = rooms[0];
        room.messages = messages.map((body, index) => ({id:`test-${index}`, userId:room.ownerId, name:'Автор', body, createdAt:updatedAt}));
        localStorage.setItem(key, JSON.stringify(rooms));
      } else {
        const selectionKey = Object.keys(sessionStorage).find(key => key.startsWith('agentik:active'))!;
        localStorage.setItem(`agentik:state:${sessionStorage.getItem(selectionKey)}`, JSON.stringify({
          version:1, favorites:[], custom:[], expiresAt:updatedAt + 86_400_000,
          conversations:[{id:'long-history', assistantId:'writer', title:'Архив', updatedAt,
            messages:messages.map(content => ({role:'assistant', content}))}],
        }));
      }
    }, kind);
    await page.setViewportSize({width:1200, height:720});
    if (kind === 'private') await page.goto(workspace + '#/chat/long-history');
    await page.reload();

    const field = kind === 'private' ? messageField(page) : page.getByRole('textbox', {name:'Сообщение участникам'});
    const thread = page.getByRole('region', {name:'История сообщений'});
    const oldest = page.getByText(/^Сообщение 1\s+Текст/);
    const newest = page.getByText(/^Сообщение 24\s+Текст/);
    for (const width of [1200, 390]) {
      await page.setViewportSize({width, height:720});
      await expect(field).toBeInViewport({ratio:1});
      await expect(newest).toBeInViewport();
      const fieldBeforeScroll = (await field.boundingBox())!;
      await thread.evaluate(el => { el.scrollTop = 0; });
      await expect(oldest).toBeInViewport();
      await expect(newest).not.toBeInViewport();
      expect(Math.abs((await field.boundingBox())!.y - fieldBeforeScroll.y)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await expectNoHorizontalScroll(page);
      await thread.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await expect(newest).toBeInViewport();
    }

    const close = page.getByRole('link', {name:'Закрыть чат'});
    await expect(close).toBeInViewport({ratio:1});
    const closeBounds = (await close.boundingBox())!;
    const headerBounds = (await page.locator('.chat__header').boundingBox())!;
    expect(closeBounds.width).toBeGreaterThanOrEqual(44);
    expect(Math.abs(closeBounds.y - headerBounds.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(closeBounds.x + closeBounds.width - headerBounds.x - headerBounds.width)).toBeLessThanOrEqual(1);

    const navigation = page.getByRole('navigation', {name:'Нижняя навигация'});
    const send = kind === 'private' ? sendButton(page) : page.getByRole('button', {name:'Отправить участникам'});
    const sendBottom = async () => {
      const bounds = (await send.boundingBox())!;
      return bounds.y + bounds.height;
    };
    expect(await sendBottom()).toBeLessThanOrEqual((await navigation.boundingBox())!.y);
    await field.focus();
    await page.evaluate(() => {
      const viewport = window.visualViewport!;
      Object.defineProperty(viewport, 'height', {value:405, configurable:true});
      Object.defineProperty(viewport, 'offsetTop', {value:35, configurable:true});
      viewport.dispatchEvent(new Event('resize'));
    });
    await expect(navigation).toBeHidden();
    expect(await sendBottom()).toBeLessThanOrEqual(440);
    await expect(newest).toBeInViewport();
    await field.fill('Новое сообщение в длинном чате');
    await send.click();
    const sent = thread.getByText('Новое сообщение в длинном чате', {exact:true});
    await expect(sent).toBeAttached();
    await expect(kind === 'private' ? thread.getByText(/Это демонстрационный ответ/) : sent).toBeInViewport();
    await close.click();
    await expect(page.getByRole('heading', {name:kind === 'private' ? 'Ваши разговоры' : 'Общие комнаты'})).toBeVisible();
  });
}

test('keeps board files available for editing after reload on mobile', async ({page}) => {
  const name = 'СверхдлинноеНазвание'.repeat(3);
  await page.setViewportSize({width:320,height:740});
  await page.goto(workspace + '#/login');
  await enterCode(page);
  await page.getByRole('navigation', {name:'Нижняя навигация'}).getByRole('button', {name:'Создать помощника'}).click();
  await page.getByRole('textbox', {name:'Название', exact:true}).fill(name);
  await page.getByRole('textbox', {name:'Что он умеет'}).fill('Помогает разбирать заметки.');
  await page.getByRole('button', {name:'Сохранить помощника'}).click();
  await page.getByRole('link', {name:'Доска', exact:true}).click();
  await expect(page.getByRole('button',{name:'Добавить файлы'})).toBeEnabled();
  await page.locator('.chat-board input[type=file]').setInputFiles({
    name:'mobile-notes.txt', mimeType:'text/plain', buffer:Buffer.from('Абзац с заметками.'),
  });
  const edit = page.getByRole('button',{name:'Редактировать в чате'});
  await expect(edit).toBeVisible({timeout:4000});
  await page.reload();
  await expect(page.getByRole('heading', {name, exact:true})).toBeInViewport({ratio:1});
  await expectNoHorizontalScroll(page);
  await expect(page.getByText('Абзац с заметками.',{exact:true})).toBeVisible();
  await edit.click();
  await expect(page.locator('.composer__document')).toContainText('mobile-notes.txt');
  await expectNoHorizontalScroll(page);
});

test('keeps the landing sign-in fixed opposite the logo on narrow and wide screens', async ({page}) => {
  await page.goto(workspace);
  const login = page.getByRole('link', {name: 'Войти', exact: true});
  const logo = page.getByRole('link', {name: 'Agentik — главная'});
  for (const width of [320, 1440]) {
    await page.setViewportSize({width, height: 500});
    await page.evaluate(() => window.scrollTo(0, 0));
    const brand = (await logo.boundingBox())!;
    const button = (await login.boundingBox())!;
    const viewport = await page.evaluate(() => window.visualViewport?.width ?? innerWidth);
    expect(Math.abs(viewport - button.x - button.width - brand.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(button.y - brand.y)).toBeLessThanOrEqual(1);
    const fixedTop = () => login.evaluate(el => el.getBoundingClientRect().top + (window.visualViewport?.offsetTop ?? 0));
    const top = await fixedTop();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(80);
    await expect.poll(fixedTop).toBeCloseTo(top, 0);
    await expect(login).toBeInViewport();
  }
  await login.click();
  await expect(codeField(page)).toBeVisible();
  const close = page.getByRole('link', {name:'Закрыть вход'});
  const lock = page.getByRole('img', {name:'Страница входа'});
  await expect(close).toBeVisible();
  const lockStyle = await lock.evaluate(node => {
    const style = getComputedStyle(node);
    return {background:style.backgroundColor,border:style.borderColor,radius:style.borderRadius};
  });
  await expect(close).toHaveCSS('background-color', lockStyle.background);
  await expect(close).toHaveCSS('border-color', lockStyle.border);
  await expect(close).toHaveCSS('border-radius', lockStyle.radius);
  for (const width of [320, 1440]) {
    await page.setViewportSize({width, height:640});
    await expect(close).toBeInViewport({ratio:1});
    const [closeBox, lockBox] = await Promise.all([close.boundingBox(), lock.boundingBox()]);
    const logoInset = await logo.evaluate(node => getComputedStyle(node.closest('.persistent-brand-bar')!).insetInlineStart);
    await expect(close).toHaveCSS('inset-inline-end', logoInset);
    expect(closeBox!.width).toBe(lockBox!.width);
    expect(closeBox!.height).toBe(lockBox!.height);
    expect(closeBox!.y).toBe(lockBox!.y);
    expect(closeBox!.x).toBeGreaterThan(lockBox!.x + lockBox!.width);
    await expectNoHorizontalScroll(page);
  }
  await close.press('Enter');
  await expect(page.getByRole('link', {name:'Войти по коду'})).toBeVisible();
  await expect(close).toBeHidden();
});

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
