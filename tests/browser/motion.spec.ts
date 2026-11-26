import {expect, test, type Page} from '@playwright/test';
import {codeB, enterCode, messageField, sendButton, workspace} from './helpers';

test.use({serviceWorkers: 'block'});

async function observeShaderDraws(page: Page) {
  await page.addInitScript(() => {
    // Headless Chromium uses SwiftShader. Exercise the GLSL separately from the production fallback.
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(this: HTMLCanvasElement, name: string, attributes?: WebGLContextAttributes) {
        const options = name === 'webgl' ? {...attributes, failIfMajorPerformanceCaveat: false} : attributes;
        return Reflect.apply(getContext, this, [name, options]);
      },
    });
    const draw = WebGLRenderingContext.prototype.drawArrays;
    const observed = new WeakSet<HTMLCanvasElement>();
    WebGLRenderingContext.prototype.drawArrays = function (...args: Parameters<typeof draw>) {
      draw.apply(this, args);
      if (!(this.canvas instanceof HTMLCanvasElement) || observed.has(this.canvas)) return;
      const effect = this.canvas.dataset.effect;
      if (!effect || this.getError() !== this.NO_ERROR) return;
      observed.add(this.canvas);
      const scope = this.canvas.closest('.reveal-media') ? 'media-' : '';
      const attribute = 'data-qa-shader-' + scope + effect;
      const root = document.documentElement;
      root.setAttribute(attribute, String(1 + Number(root.getAttribute(attribute))));
      if (effect === 'pulse') root.dataset.qaPulsePixels = String(this.canvas.width * this.canvas.height);
    };
  });
}

test('shows a boot skeleton before the app JavaScript arrives', async ({page}) => {
  let loadApp!: () => void;
  const wait = new Promise<void>(resolve => {loadApp = resolve;});
  await page.route('**/assets/index-*.js', async route => {
    await wait;
    await route.continue();
  });
  await page.goto(workspace, {waitUntil: 'commit'});
  await expect(page.getByRole('status', {name: 'Загрузка Agentik'})).toBeVisible();
  loadApp();
  await expect(page.getByRole('link', {name: 'Войти по коду'})).toBeVisible();
  await expect(page.getByRole('status', {name: 'Загрузка Agentik'})).toHaveCount(0);
});

test('renders the WebGL welcome for every new chat and keeps the send pulse one-time', async ({page}) => {
  await observeShaderDraws(page);
  await page.goto(workspace + '#/assistant/writer');
  await enterCode(page, codeB);
  await expect(page.locator('html')).toHaveAttribute('data-qa-shader-welcome', '1');
  await expect(page.getByRole('heading', {name: 'Привет! С чем помочь?'})).toBeVisible();
  await messageField(page).fill('Первое сообщение');
  await sendButton(page).click();
  await expect(page.locator('html')).toHaveAttribute('data-qa-shader-pulse', '1');
  expect(Number(await page.locator('html').getAttribute('data-qa-pulse-pixels'))).toBeLessThanOrEqual(90_000);
  await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();
  await expect(page.locator('.send-pulse')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-qa-shader-pulse', '1');

  await page.getByRole('link', {name: 'Новый разговор'}).click();
  await expect(page.getByRole('heading', {name: 'Привет! С чем помочь?'})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-qa-shader-welcome', '2');
  await messageField(page).fill('Второй разговор');
  await sendButton(page).click();
  await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();
  await expect(page.locator('.send-pulse')).toHaveCount(0);
  await page.reload();
  await page.getByRole('link', {name: 'Новый разговор'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-qa-shader-welcome', '1');
});

test('uses a shader skeleton until landing media is available', async ({page}) => {
  await observeShaderDraws(page);
  let loadImage!: () => void;
  const wait = new Promise<void>(resolve => {loadImage = resolve;});
  await page.route('**/illustrations/ideas.svg', async route => {
    await wait;
    await route.continue();
  });
  await page.goto(workspace, {waitUntil: 'domcontentloaded'});
  const media = page.locator('.reveal-media');
  await expect(media).toHaveAttribute('data-status', 'loading');
  await expect(page.locator('html')).toHaveAttribute('data-qa-shader-media-skeleton', '1');
  loadImage();
  await expect(media).toHaveAttribute('data-status', 'ready');
  await expect(media.locator('img')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-qa-shader-media-reveal', '1');
  await expect(media.locator('canvas[data-running]')).toHaveCount(0);
});

test('keeps the UI usable with WebGL disabled and a failed landing image', async ({page}) => {
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(this: HTMLCanvasElement, name: string, ...args: unknown[]) {
        if (name === 'webgl') {
          const root = document.documentElement;
          root.dataset.qaWebglAttempts = String(1 + Number(root.dataset.qaWebglAttempts || 0));
          root.dataset.qaWebglCaveat = String((args[0] as WebGLContextAttributes)?.failIfMajorPerformanceCaveat);
          return null;
        }
        return Reflect.apply(native, this, [name, ...args]);
      },
    });
  });
  await page.route('**/illustrations/ideas.svg', route => route.abort());
  await page.goto(workspace);
  await expect(page.getByRole('link', {name: 'Войти по коду'})).toBeVisible();
  await expect(page.locator('.reveal-media')).toHaveAttribute('data-status', 'fallback');
  await page.goto(workspace + '#/assistant/writer');
  await enterCode(page);
  await expect(page.getByRole('heading', {name: 'Привет! С чем помочь?'})).toBeVisible();
  await expect(page.locator('canvas[data-running]')).toHaveCount(0);
  await messageField(page).fill('Всё работает без WebGL');
  await sendButton(page).click();
  await expect(page.locator('.send-pulse__glow')).toBeVisible();
  await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-qa-webgl-caveat', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-qa-webgl-attempts', '1');
});
