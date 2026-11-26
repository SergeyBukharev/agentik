import {expect, test} from '@playwright/test';
import {enterCode, workspace} from './helpers';

test.use({serviceWorkers:'block'});

const attribution = 'sergey buharev (c) 2026';

test('keeps the guard invisible during normal navigation and blocks the Capture API call', async ({page}) => {
  await page.goto(workspace+'#/assistant/career');
  await enterCode(page);
  const heading = page.getByRole('heading', {name:'Карьерный навигатор'});
  await expect(heading).toBeVisible();
  await expect(page.getByText(attribution, {exact:true})).toHaveCount(0);

  await page.evaluate(async () => {
    const api = (window as Window & {figma?: {captureForDesign: (options: object) => Promise<void>}}).figma;
    if (!api?.captureForDesign) throw new Error('The Capture guard is not loaded');
    await api.captureForDesign({selector:'body', delayMs:250});
  });
  const notice = page.getByRole('alertdialog', {name:attribution});
  await expect(notice).toBeVisible();
  await expect(heading).toBeHidden();
  await notice.getByRole('button', {name:'Вернуться'}).click();
  await expect(heading).toBeVisible();
  await expect(page).toHaveURL(/#\/assistant\/career$/);
});

test('blocks the Capture script before contacting Figma and removes the extension toolbar', async ({page}) => {
  await page.goto(workspace);
  await expect(page.getByRole('link', {name:'Войти по коду'})).toBeVisible();
  const source = 'https://mcp.figma.com/mcp/html-to-design/capture.js';
  let requested = false;
  await page.route(source, route => {
    requested = true;
    return route.fulfill({contentType:'text/javascript', body:'window.fixtureCaptureRan = true;'});
  });
  await page.evaluate(src => {
    const script = document.createElement('script');
    script.src = src;
    document.head.append(script);
  }, source);
  const notice = page.getByRole('alertdialog', {name:attribution});
  await expect(notice).toBeVisible();
  expect(requested).toBe(false);
  await notice.getByRole('button', {name:'Вернуться'}).click();

  await page.evaluate(() => {
    const toolbar = document.createElement('figma-html-to-design-toolbar');
    toolbar.id = '__figma_h2d_chrome_extension_toolbar__';
    document.body.append(toolbar);
  });
  await expect(notice).toBeVisible();
  await expect(page.locator('#__figma_h2d_chrome_extension_toolbar__')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', {name:'Войти по коду'})).toBeVisible();
});

test('consumes a Figma capture hash and leaves normal page navigation available', async ({page}) => {
  await page.goto(workspace+'#figmacapture=fixture');
  const notice = page.getByRole('alertdialog', {name:attribution});
  await expect(notice).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
  await notice.getByRole('button', {name:'Вернуться'}).click();
  await page.getByRole('link', {name:'Пользовательское соглашение'}).click();
  await expect(page.getByRole('heading', {name:'Пользовательское соглашение'})).toBeVisible();

  await page.evaluate(() => {location.hash = '#figmacapture=fixture';});
  await expect(notice).toBeVisible();
  await expect(page).toHaveURL(/#\/agreement$/);
});
