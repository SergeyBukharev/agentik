import {expect, test} from '@playwright/test';
import {openCatalog, workspace} from './helpers';

test.use({serviceWorkers: 'block'});

test('uses a finite ASCII pulse without the green spotlight on the public and workspace heroes', async ({page}) => {
  await page.goto(workspace);
  const hero = page.locator('.hero--intro');
  const signal = hero.locator('.hero-stream__signal');
  await expect(hero).toBeVisible();
  await expect(hero.locator('.hero-aura')).toHaveCount(0);
  await expect(hero.locator('.hero-stream svg text')).not.toHaveCount(0);
  await expect(signal).toHaveCSS('animation-name', 'none');
  await hero.hover({position: {x: 82, y: 100}});
  await expect(signal).toHaveCSS('animation-name', 'hero-stream-pulse');
  await expect(signal).toHaveCSS('animation-iteration-count', '1');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(signal).toHaveCSS('animation-name', 'none');
  await openCatalog(page);
  await page.goto(workspace + '#/');
  await expect(hero.locator('.hero-stream')).toHaveCount(1);
  await expect(hero.locator('.hero-aura')).toHaveCount(0);
});

test('uses separate skeleton surfaces and a static silhouette for the illustration effects', async ({page}) => {
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
  const pending = svg.locator('.media-skeleton');
  await expect(pending).toHaveCSS('mask-image', /data:image\/svg\+xml/);
  const silhouette = await pending.evaluate(node => getComputedStyle(node).maskImage);
  release();
  await expect(svg).toHaveAttribute('data-status', 'ready');
  await expect(svg.locator('.media-reveal-layer')).toHaveCSS('mask-image', silhouette);
  await expect(skeleton).toHaveCount(0);
});

test('keeps filter icons still and moves assistant avatars on hover and keyboard focus', async ({page}) => {
  await openCatalog(page);
  const filter = page.getByRole('button', {name: 'Дизайн', exact: true});
  await filter.hover();
  await expect(filter.locator('.category-icon__background')).toHaveCSS('opacity', '0.1');
  await expect(filter.locator('.category-icon__body')).toHaveCSS('transform', 'none');

  const designLink = page.getByRole('link', {name:'Открыть: Графический дизайнер-иллюстратор'});
  const productLink = page.getByRole('link', {name:'Открыть: Продакт-менеджер'});
  const design = page.locator('.agent-card').filter({has:designLink});
  const product = page.locator('.agent-card').filter({has:productLink});
  const designAvatar = design.locator('.agent-card__top > .avatar > svg');
  const productAvatar = product.locator('.agent-card__top > .avatar > svg');
  await expect(designAvatar).toHaveCSS('transform', 'none');
  await design.hover();
  await expect(designAvatar).toHaveCSS('opacity', '1');
  await expect(designAvatar).not.toHaveCSS('transform', 'none');
  const designTransform = await designAvatar.evaluate(node => getComputedStyle(node).transform);
  await product.hover();
  await expect(designAvatar).toHaveCSS('transform', 'none');
  await expect(productAvatar).not.toHaveCSS('transform', 'none');
  await expect(productAvatar).not.toHaveCSS('transform', designTransform);

  await filter.hover();
  await expect(productAvatar).toHaveCSS('transform', 'none');
  await page.keyboard.press('Tab');
  await productLink.focus();
  await expect(productAvatar).not.toHaveCSS('transform', 'none');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(productAvatar).toHaveCSS('transform', 'none');
});

test('keeps 18px sidebar padding and the lime PRO button in both themes', async ({page}) => {
  await openCatalog(page);
  const sidebar = page.locator('.sidebar');
  const button = sidebar.locator('.button--pro');
  for (const width of [1280, 1024, 800]) {
    await page.setViewportSize({width, height: 900});
    await expect(sidebar).toHaveCSS('padding', '18px');
    await expect(button).toBeVisible();
  }

  await expect(button).toHaveCSS('background-color', 'rgb(212, 245, 138)');
  await expect(button).toHaveCSS('background-image', 'none');
  await button.hover();
  await expect(button.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', {name: 'Тёмная тема'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(button).toHaveCSS('background-color', 'rgb(212, 245, 138)');
  await expect(button).toHaveCSS('border-top-width', '0px');
  await page.keyboard.press('Tab');
  await button.focus();
  await expect(button).toHaveCSS('outline-style', 'solid');
});
