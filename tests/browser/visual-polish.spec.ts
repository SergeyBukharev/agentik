import {expect, test} from '@playwright/test';
import {enterCode, openCatalog, workspace} from './helpers';

test.use({serviceWorkers: 'block'});

test('shows logo pixels only on hover or keyboard focus in the public and workspace heroes', async ({page}) => {
  await page.goto(workspace);
  const hero = page.locator('.hero--intro');
  await expect(hero).toBeVisible();
  await expect(hero.locator('.hero-stream, .hero-aura')).toHaveCount(0, {timeout: 2000});
  await expect(hero.locator('img')).toHaveAttribute('src', '/agentik/favicon.svg');
  const pixels = hero.locator('.hero-mark__cluster--top-right');
  await expect(pixels).toHaveCSS('opacity', '0');
  const restingPosition = await pixels.evaluate(node => getComputedStyle(node).transform);
  await hero.hover({position: {x: 82, y: 100}});
  await expect(pixels).toHaveCSS('opacity', '1');
  await expect(pixels).not.toHaveCSS('transform', restingPosition);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(pixels).toHaveCSS('transform', 'none');
  await page.mouse.move(1, 1);
  await expect(pixels).toHaveCSS('opacity', '0');
  await page.keyboard.press('Tab');
  await hero.getByRole('link', {name:'Войти по коду'}).focus();
  await expect(pixels).toHaveCSS('opacity', '1');

  await openCatalog(page);
  await page.goto(workspace + '#/');
  await expect(hero.getByRole('link', {name:'Выбрать помощника'})).toBeVisible();
  await expect(hero.locator('.hero-stream, .hero-aura')).toHaveCount(0);
  await expect(pixels).toHaveCSS('opacity', '0');
  await hero.hover({position: {x: 82, y: 100}});
  await expect(pixels).toHaveCSS('opacity', '1');
});

test('expands a ripple from the click point and leaves the sign-in link alone', async ({page}) => {
  await page.goto(workspace);
  const hero = page.locator('.hero--intro');
  const wave = hero.locator('.hero__ripple-wave');
  await hero.click({position: {x: 36, y: 72}});
  await expect(wave).toHaveCount(1, {timeout: 2000});
  await expect(wave).toHaveCSS('left', '36px');
  await expect(wave).toHaveCSS('top', '72px');
  await expect(wave).toHaveCount(0);

  const signIn = hero.getByRole('link', {name:'Войти по коду'});
  await signIn.evaluate(link => link.addEventListener('click', event => event.preventDefault(), {once:true}));
  await signIn.click();
  await expect(wave).toHaveCount(0);

  await page.emulateMedia({reducedMotion:'reduce'});
  await hero.click({position: {x:36, y:72}});
  await expect(wave).toHaveCount(0);
});

test('uses separate skeleton surfaces and a static silhouette for the illustration effects', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  let release!: () => void;
  const ready = new Promise<void>(resolve => {release = resolve;});
  for (const path of ['**/favicon.svg', '**/assets/LandingShowcase-*.js']) {
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

test('keeps 18px sidebar padding and the lime PRO button for the Free owner', async ({page}) => {
  await page.goto(workspace + '#/login');
  await page.getByLabel('Email').fill('owner@example.test');
  await enterCode(page, '123QWE');
  await expect(page.getByRole('heading', {name:'Ваши разговоры'})).toBeVisible();
  const sidebar = page.locator('.sidebar');
  const button = sidebar.locator('.button--pro');
  for (const width of [1280, 1024, 821]) {
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

  await page.setViewportSize({width: 800, height: 900});
  await expect(sidebar).toBeHidden();
  await page.getByRole('button', {name: 'Открыть профиль'}).click();
  await expect(page.getByRole('dialog').getByRole('button', {name: 'Купить PRO', exact: true})).toBeVisible();
});
