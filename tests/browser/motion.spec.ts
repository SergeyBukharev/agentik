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
  await page.route('**/favicon.svg', async route => {
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

test('refracts the actual hero illustration on clicks and taps, then restores it', async ({browser, baseURL}) => {
  for (const touch of [false, true]) {
    const page = await browser.newPage({
      viewport: touch ? {width: 390, height: 800} : {width: 1280, height: 800},
      deviceScaleFactor: touch ? 3 : 1,
      isMobile: touch,
      hasTouch: touch,
      serviceWorkers: 'block',
    });
    try {
      await observeShaderDraws(page);
      await page.addInitScript(() => {
        const draw = WebGLRenderingContext.prototype.drawArrays;
        let baseline: Uint8Array | undefined;
        let previousProgram: WebGLProgram | undefined;
        let lastSample = -1;
        WebGLRenderingContext.prototype.drawArrays = function (...args: Parameters<typeof draw>) {
          draw.apply(this, args);
          if (!(this.canvas instanceof HTMLCanvasElement) || this.canvas.dataset.effect !== 'ripple') return;
          const program = this.getParameter(this.CURRENT_PROGRAM) as WebGLProgram;
          const time = this.getUniform(program, this.getUniformLocation(program, 'time')!) as number;
          const firstFrame = previousProgram !== program;
          previousProgram = program;
          const sample = Math.floor(time * 12);
          if (!firstFrame && sample <= lastSample) return;
          lastSample = sample;
          const {drawingBufferWidth: width, drawingBufferHeight: height} = this;
          const pixels = new Uint8Array(width * height * 4);
          this.readPixels(0, 0, width, height, this.RGBA, this.UNSIGNED_BYTE, pixels);
          const data = document.documentElement.dataset;
          if (firstFrame) {
            baseline = pixels;
            data.qaRippleStarts = String(1 + Number(data.qaRippleStarts ?? 0));
            data.qaRipplePixels = String(width * height);
            data.qaRippleOpaque = String(pixels.filter((value, i) => i % 4 === 3 && value > 127).length);
            data.qaRipplePeak = '0';
            return;
          }
          if (!baseline) return;
          let changed = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (Math.abs(pixels[i] - baseline[i]) + Math.abs(pixels[i + 3] - baseline[i + 3]) > 45) changed++;
          }
          data.qaRipplePeak = String(Math.max(Number(data.qaRipplePeak), changed));
          if (time >= .9) data.qaRippleFade = String(changed);
        };
      });
      await page.goto(baseURL!);
      const hero = page.locator('.hero--intro');
      const media = hero.locator('.reveal-media');
      const artwork = media.locator('img');
      const wave = media.locator('canvas[data-effect="ripple"]');
      const root = page.locator('html');
      await expect(artwork).toBeVisible();
      await expect(wave).toHaveCount(0);

      const pressHero = () => touch
        ? hero.tap({position: {x: 36, y: 72}})
        : hero.click({position: {x: 36, y: 72}});
      await pressHero();
      await expect(root).toHaveAttribute('data-qa-ripple-starts', '1');
      expect(Number(await root.getAttribute('data-qa-ripple-pixels'))).toBeLessThanOrEqual(65_000);
      expect(Number(await root.getAttribute('data-qa-ripple-opaque'))).toBeGreaterThan(1_500);
      await expect(root).toHaveAttribute('data-qa-ripple-fade', /\d+/);
      const peak = Number(await root.getAttribute('data-qa-ripple-peak'));
      expect(peak).toBeGreaterThan(100);
      expect(Number(await root.getAttribute('data-qa-ripple-fade'))).toBeLessThan(peak / 4);
      await expect(wave).not.toHaveAttribute('data-running');
      await expect(artwork).toBeVisible();

      await page.emulateMedia({reducedMotion:'reduce'});
      await pressHero();
      await expect(wave).not.toHaveAttribute('data-running');
      await page.emulateMedia({reducedMotion:'no-preference'});
      const signIn = hero.getByRole('link', {name: 'Войти по коду'});
      await signIn.evaluate(link => link.addEventListener('click', event => event.preventDefault(), {once:true}));
      if (touch) await signIn.tap();
      else await signIn.click();
      await expect(root).toHaveAttribute('data-qa-ripple-starts', '1');
      await expect(artwork).toBeVisible();
    } finally {
      await page.close();
    }
  }
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
  await page.route('**/favicon.svg', route => route.abort());
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
