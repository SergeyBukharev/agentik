import {expect, test} from '@playwright/test';
import {openCatalog, workspace} from './helpers';

test.use({serviceWorkers: 'block'});

test('moves the hero spotlight on pointer input and respects reduced motion', async ({page}) => {
  await page.goto(workspace);
  const hero = page.locator('.hero--intro');
  const light = hero.locator('.hero-aura');
  const wash = light.locator('.hero-aura__wash');
  const wave = light.locator('.hero-aura__wave');
  await expect(hero).toBeVisible();
  await expect(light).toHaveCSS('opacity', '0');
  await expect(wave).toHaveCSS('animation-name', 'none');
  await expect(wash).toHaveCSS('border-radius', '0px');
  await expect(wash).toHaveCSS('background-image', /in oklch/);
  await hero.hover({position: {x: 82, y: 100}});
  await expect.poll(async ()=>light.evaluate(el=>Number(getComputedStyle(el).opacity)), {timeout:12_000}).toBeGreaterThan(.9);
  await expect(wave).toHaveCSS('animation-iteration-count', '2');
  const point = hero.locator('.hero-aura__point');
  await expect(point).toHaveAttribute('style', /translate3d/);
  const previous = await point.getAttribute('style');
  await hero.hover({position: {x: 330, y: 100}});
  await expect(point).not.toHaveAttribute('style', previous ?? '');
  await page.locator('.public-landing__header').hover();
  await expect(light).toHaveCSS('opacity', '0');
  await expect(wave).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await hero.hover({position: {x: 82, y: 100}});
  await expect(light).toHaveCSS('display', 'none');
});

test('uses separate skeleton surfaces and a silhouette mask for the pending illustration', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  let release!: () => void;
  const ready = new Promise<void>(resolve => {release = resolve;});
  for (const path of ['**/illustrations/ideas.svg', '**/assets/LandingShowcase-*.js']) {
    await page.route(path, async route => {
      await ready;
      await route.continue();
    });
  }

  await page.goto(workspace, {waitUntil: 'domcontentloaded'});
  const skeleton = page.locator('.screen-skeleton--layered');
  await expect(skeleton).toBeVisible();
  const surface = skeleton.locator('[data-skeleton-level="surface"]').first();
  const media = skeleton.locator('[data-skeleton-level="media"]').first();
  const surfaceColor = await surface.evaluate(node => getComputedStyle(node).backgroundColor);
  await expect(media).not.toHaveCSS('background-color', surfaceColor);

  const svg = page.locator('.reveal-media');
  await expect(svg).toHaveAttribute('data-status', 'loading');
  await expect(svg.locator('.media-skeleton')).toHaveCSS('mask-image', /data:image\/svg\+xml/);
  release();
  await expect(svg).toHaveAttribute('data-status', 'ready');
  await expect(svg.locator('.media-reveal-layer')).toHaveCSS('mask-image', /illustrations\/ideas\.svg/);
  await expect(skeleton).toHaveCount(0);
});

test('fills category icon backgrounds and gives design and product distinct motion', async ({page}) => {
  await openCatalog(page);
  const design = page.getByRole('button', {name: 'Дизайн', exact: true});
  const product = page.getByRole('button', {name: 'Продукт', exact: true});
  const tint = design.locator('.category-icon__background');
  await expect(tint).toHaveCSS('opacity', '0.1');
  await design.hover();
  await expect(tint).toHaveCSS('opacity', '1');
  const designBody = design.locator('.category-icon__body');
  await expect(designBody).not.toHaveCSS('transform', 'none');
  const designTransform = await designBody.evaluate(node => getComputedStyle(node).transform);
  await product.hover();
  await expect(tint).toHaveCSS('opacity', '0.1');
  const productBody = product.locator('.category-icon__body');
  await expect(productBody).not.toHaveCSS('transform', 'none');
  await expect(productBody).not.toHaveCSS('transform', designTransform);
});

test('keeps 18px sidebar padding and continuous PRO gradients in both themes', async ({page}) => {
  await openCatalog(page);
  const sidebar = page.locator('.sidebar');
  const button = sidebar.locator('.button--pro');
  for (const width of [1280, 1024, 800]) {
    await page.setViewportSize({width, height: 900});
    await expect(sidebar).toHaveCSS('padding', '18px');
    await expect(button).toBeVisible();
  }

  const appearance = () => button.evaluate(node => {
    const field = getComputedStyle(node, '::before');
    const highlights = getComputedStyle(node, '::after');
    return {
      fill: getComputedStyle(node).backgroundColor,
      field: field.backgroundImage,
      width: parseFloat(field.width),
      height: parseFloat(field.height),
      diagonal: Math.hypot(node.clientWidth, node.clientHeight),
      highlights: highlights.backgroundImage,
      opacity: highlights.opacity,
      animation: field.animationName,
      playState: field.animationPlayState,
    };
  });

  const light = await appearance();
  expect(light.field).toMatch(/conic-gradient\([^,]* in oklch/);
  expect(light.highlights.match(/radial-gradient/g)).toHaveLength(3);
  expect(light.width).toBeCloseTo(light.height, 0);
  expect(light.width).toBeGreaterThan(light.diagonal);
  expect(light.animation).toBe('pro-gradient-turn');
  expect(light.playState).toBe('paused');

  await button.hover();
  await expect.poll(async () => (await appearance()).opacity).toBe('1');
  expect((await appearance()).playState).toBe('running');
  await page.getByRole('button', {name: 'Тёмная тема'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(async () => (await appearance()).fill).not.toBe(light.fill);
  const dark = await appearance();
  expect(dark.field).not.toBe(light.field);
  expect(dark.highlights.match(/radial-gradient/g)).toHaveLength(3);
  await page.emulateMedia({reducedMotion: 'reduce'});
  expect((await appearance()).animation).toBe('none');
});
