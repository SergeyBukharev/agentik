import {expect, test} from '@playwright/test';

test('guests can change the landing language and retain it on reload', async ({page}) => {
  await page.goto('./#/');
  await expect(page.getByRole('button', {name: 'Русский'})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'English'}).press('Space');
  await expect(page.getByRole('button', {name: 'English'})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', {name: 'English'})).toBeFocused();
  await expect(page.getByRole('link', {name: 'Sign in with a code'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Family finance assistant'})).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('link', {name: 'User agreement'})).toBeVisible();
  await page.getByRole('button', {name: 'Русский'}).click();
  await expect(page.getByRole('heading', {name: 'Семейный финансист'})).toBeVisible();
});

test('guests can override the system theme and retain it on reload', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'});
  await page.goto('./#/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', {name: 'Светлая тема'}).click();
  await expect(page.getByRole('button', {name: 'Тёмная тема'})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', {name: 'Тёмная тема'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('public controls have separate touch targets at 320px', async ({page}) => {
  await page.setViewportSize({width: 320, height: 640});
  await page.emulateMedia({colorScheme: 'light', reducedMotion: 'reduce'});
  await page.goto('./#/');
  await page.getByRole('button', {name: 'English'}).click();
  const headerControls = [
    page.getByRole('link', {name: 'Agentik home'}),
    page.getByRole('link', {name: 'Sign in', exact: true}),
    page.getByRole('button', {name: 'Dark theme'}),
    page.getByRole('button', {name: 'Русский'}),
    page.getByRole('button', {name: 'English'}),
  ];
  const bounds = await Promise.all(headerControls.map(async control => {
    await expect(control).toBeVisible();
    const box = (await control.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    return box;
  }));
  for (const [index, first] of bounds.entries()) {
    for (const second of bounds.slice(index + 1)) {
      const overlapX = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
      const overlapY = Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y);
      expect(Math.min(overlapX, overlapY)).toBeLessThanOrEqual(0);
    }
  }

  await page.evaluate(() => window.scrollTo(0, 60));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  for (const [index, control] of headerControls.entries()) {
    expect((await control.boundingBox())?.y).toBeCloseTo(bounds[index].y);
  }
});
