import {readFile} from 'node:fs/promises';
import {devices, expect, test} from '@playwright/test';
import {expectNoHorizontalScroll, workspace} from './helpers';

test('aligns agreement and kits with the logo on wide screens and stacks them on mobile', async ({page}) => {
  const brand = page.getByRole('link', {name:'Agentik — главная'});
  for (const [route, selector] of [
    ['agreement', '.agreement__intro'],
    ['ui-kit', '.kit-nav'],
    ['brand-kit', '.kit-nav'],
    ['press-kit', '.kit-nav'],
  ]) {
    await page.goto(`${workspace}#/${route}`);
    const firstBlock = page.locator(selector);
    await expect(firstBlock).toBeVisible();
    for (const width of [768, 1024, 1440, 390]) {
      await page.setViewportSize({width, height:800});
      const logo = (await brand.boundingBox())!;
      const block = (await firstBlock.boundingBox())!;
      if (width >= 768) {
        expect(block.y).toBeCloseTo(logo.y, 0);
        expect(block.x).toBeGreaterThanOrEqual(logo.x + logo.width + 12);
      } else {
        expect(block.y).toBeGreaterThanOrEqual(logo.y + logo.height);
      }
      await expectNoHorizontalScroll(page);
    }
  }
});

test('opens the kits from the logo context menu and keeps the primary home link', async ({page}) => {
  await page.goto(workspace);
  const brand = page.getByRole('link', {name:'Agentik — главная'});
  await expect(brand).toHaveText('agentik');
  await brand.click({button:'right'});
  const menu = page.getByRole('menu', {name:'Материалы Agentik'});
  await expect(menu.getByRole('menuitem')).toHaveCount(3);
  await expect(menu.getByRole('menuitem', {name:'UI-кит'})).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/brand-kit$/);
  await expect(page.getByRole('heading', {name:'Бренд-кит'})).toBeVisible();

  await brand.focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem', {name:'Пресс-кит'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(brand).toBeFocused();
  await brand.click();
  await expect(page).toHaveURL(/#\/$/);
});

test('renders public kit pages at 320px and demonstrates live component states', async ({page}) => {
  await page.setViewportSize({width:320, height:780});
  await page.goto(workspace+'#/ui-kit');
  await expect(page.getByRole('heading', {name:'UI-кит'})).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', {name:'Открыть диалог'}).click();
  await expect(page.getByRole('dialog', {name:'Пример диалога'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const theme = page.getByRole('button', {name:'Тёмная тема'});
  await theme.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.locator('.persistent-brand')).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');

  await page.getByRole('link', {name:'Пресс-кит', exact:true}).click();
  await expect(page.getByRole('heading', {name:'Пресс-кит'})).toBeVisible();
  await expect(page.getByRole('link', {name:'Скачать знак'})).toHaveAttribute('download', 'agentik-mark.svg');
  await expectNoHorizontalScroll(page);
});

test.describe('390px phone with a wide virtual viewport', () => {
  const {viewport, userAgent, deviceScaleFactor, isMobile, hasTouch} = devices['iPhone 13'];
  test.use({viewport, screen:viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, reducedMotion:'reduce', serviceWorkers:'block'});

  test.beforeEach(async ({page}) => {
    await page.route('**/agentik/', async route => {
      const response = await route.fetch();
      // Reproduce mobile desktop mode, where the browser ignores the viewport declaration.
      const body = (await response.text()).replace(/<meta name="viewport"[^>]*>/u, '');
      await route.fulfill({response, body});
    });
  });

  test('fits wordmark cards and their download controls to the phone', async ({page}) => {
    await page.goto(workspace + '#/brand-kit');
    await expect(page.locator('html')).toHaveAttribute('data-wide-phone-viewport', '');
    const cards = page.locator('.kit-logo-card');
    await expect(cards).toHaveCount(2);
    const first = (await cards.first().boundingBox())!;
    const second = (await cards.last().boundingBox())!;
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);

    for (const button of await cards.getByRole('button').all()) {
      const fits = await button.evaluate(node => {
        const bounds = node.getBoundingClientRect();
        const contents = document.createRange();
        contents.selectNodeContents(node);
        const label = contents.getBoundingClientRect();
        return label.left >= bounds.left && label.right <= bounds.right;
      });
      expect(fits).toBe(true);
    }
    await expectNoHorizontalScroll(page);
  });

  test('opens the PNG menu fully above a trigger near the bottom', async ({page}) => {
    await page.goto(workspace + '#/brand-kit');
    await expect(page.locator('html')).toHaveAttribute('data-wide-phone-viewport', '');
    const trigger = page.getByRole('button', {name:'Скачать PNG'}).last();
    await trigger.evaluate(node => {
      const viewport = window.visualViewport!;
      const bottom = viewport.offsetTop + viewport.height;
      window.scrollBy(0, node.getBoundingClientRect().bottom - bottom + 68 / viewport.scale);
      (node as HTMLElement).focus({preventScroll:true});
    });
    await page.keyboard.press('ArrowDown');
    const menu = page.getByRole('menu', {name:'Скачать PNG'});
    await expect(menu.getByRole('menuitem', {name:/1×/})).toBeFocused();
    const options = (await menu.boundingBox())!;
    expect(options.y + options.height).toBeLessThan((await trigger.boundingBox())!.y);
    await expect(menu).toBeInViewport({ratio:1});
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('stacks UI examples and the press summary on the phone', async ({page}) => {
    await page.goto(workspace + '#/ui-kit');
    await expect(page.locator('html')).toHaveAttribute('data-wide-phone-viewport', '');
    const examples = page.locator('.kit-example');
    const first = (await examples.nth(0).boundingBox())!;
    const second = (await examples.nth(1).boundingBox())!;
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    for (const [label, title] of [['Открыть диалог', 'Пример диалога'], ['Купить PRO', 'Agentik PRO']]) {
      const dialogButton = page.getByRole('button', {name:label});
      await dialogButton.click();
      const dialog = page.getByRole('dialog', {name:title});
      await expect(dialog).toBeInViewport({ratio:1});
      await page.keyboard.press('Escape');
      await expect(dialogButton).toBeFocused();
    }
    await expectNoHorizontalScroll(page);

    await page.getByRole('link', {name:'Пресс-кит', exact:true}).click();
    const summary = page.locator('.kit-press');
    const text = (await summary.locator('.kit-credit').boundingBox())!;
    const image = (await summary.locator('img').boundingBox())!;
    expect(image.y).toBeGreaterThanOrEqual(text.y + text.height);
    await expectNoHorizontalScroll(page);
  });

  test('opens the UI kit selector next to its trigger inside the screen', async ({page}) => {
    await page.goto(workspace + '#/ui-kit');
    await expect(page.locator('html')).toHaveAttribute('data-wide-phone-viewport', '');
    const trigger = page.getByRole('combobox', {name:'Режим ответов', includeHidden:true});
    await trigger.evaluate(node => node.scrollIntoView({block:'center'}));
    await trigger.press('Enter');
    const listbox = page.getByRole('listbox', {name:'Режим ответов'});
    await expect(listbox.getByRole('option', {name:'Деморежим'})).toBeFocused();
    const scale = await page.evaluate(() => window.visualViewport!.scale);
    await expect.poll(async () => {
      const anchor = (await trigger.boundingBox())!;
      const menu = (await listbox.boundingBox())!;
      const distance = Math.min(Math.abs(menu.y - (anchor.y + anchor.height)), Math.abs(anchor.y - (menu.y + menu.height)));
      return distance * scale;
    }).toBeLessThan(16);
    await expect(listbox).toBeInViewport({ratio:1});
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(trigger).toContainText('Подключённая модель');
    await expect(trigger).toBeFocused();
  });
});

const logoVariants = [['light', 'На светлом фоне'], ['dark', 'На тёмном фоне']] as const;

test('copies each brand wordmark’s SVG source to the clipboard', async ({page, context}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(workspace + '#/brand-kit');

  for (const [variant, label] of logoVariants) {
    const response = await page.request.get(`${workspace}brand/agentik-wordmark-${variant}.svg`);
    expect(response.ok()).toBe(true);
    const source = (await response.text()).replace(/\r\n/g, '\n');
    const logo = page.getByRole('group', {name:label});

    await logo.getByRole('button', {name:'Копировать SVG'}).click();
    await expect(logo.getByRole('status')).toHaveText('SVG скопирован');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard.replace(/\r\n/g, '\n')).toBe(source);
  }
});

test('copies SVG when the Clipboard API declines the write', async ({page, context}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: async () => {throw new DOMException('Clipboard write denied', 'NotAllowedError');},
    });
  });
  await page.goto(workspace + '#/brand-kit');
  const logo = page.getByRole('group', {name:'На светлом фоне'});
  await logo.getByRole('button', {name:'Копировать SVG'}).click();
  await expect(logo.getByRole('status')).toHaveText('SVG скопирован');
  await context.grantPermissions(['clipboard-read']);
  const response = await page.request.get(`${workspace}brand/agentik-wordmark-light.svg`);
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard.replace(/\r\n/g, '\n')).toBe((await response.text()).replace(/\r\n/g, '\n'));
});

test('reports an unavailable clipboard without claiming success', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: async () => {throw new DOMException('Clipboard write denied', 'NotAllowedError');},
    });
    Object.defineProperty(document, 'execCommand', {value:() => false});
  });
  await page.goto(workspace + '#/brand-kit');
  const logo = page.getByRole('group', {name:'На светлом фоне'});
  await logo.getByRole('button', {name:'Копировать SVG'}).click();
  await expect(logo.getByRole('status')).toHaveText('Не удалось скопировать SVG');
});

test('downloads both PNG scales with the stated pixel dimensions and file weight', async ({page}) => {
  await page.setViewportSize({width:320, height:780});
  await page.goto(workspace + '#/brand-kit');

  for (const [variant, label] of logoVariants) {
    const logo = page.getByRole('group', {name:label});
    const trigger = logo.getByRole('button', {name:'Скачать PNG'});
    const menu = logo.getByRole('menu', {name:'Скачать PNG'});
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', {name:/1×/})).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', {name:/2×/})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    for (const [scale, width, height] of [[1, 180, 48], [2, 360, 96]]) {
      await trigger.click();
      const option = menu.getByRole('menuitem', {name:new RegExp(`${scale}×`)});
      await expect(option).toContainText(`${width} × ${height} px`);
      await expectNoHorizontalScroll(page);
      const metadata = (await option.innerText()).split('·')[1];

      const downloaded = page.waitForEvent('download');
      await option.click();
      const file = await downloaded;
      expect(file.suggestedFilename()).toBe(`agentik-wordmark-${variant}@${scale}x.png`);
      const bytes = await readFile(await file.path());
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(bytes.subarray(12, 16).toString()).toBe('IHDR');
      expect(bytes.readUInt32BE(16)).toBe(width);
      expect(bytes.readUInt32BE(20)).toBe(height);
      expect(Number(metadata.replace(/\D/g, ''))).toBe(bytes.length);
      await expect(menu).toBeHidden();
    }
  }
});
