import {expect, test} from '@playwright/test';
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
