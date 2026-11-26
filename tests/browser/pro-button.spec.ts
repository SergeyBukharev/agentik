import {expect, test, type Locator, type Page} from '@playwright/test';
import {codeB, enterCode, openCatalog, workspace} from './helpers';

test.use({serviceWorkers: 'block'});

async function signInAsOwner(page: Page) {
  await page.goto(workspace + '#/login');
  await page.getByRole('textbox', {name: 'Email'}).fill('owner@example.test');
  await enterCode(page, '123QWE');
  await expect(page.getByRole('heading', {name: 'Ваши разговоры'})).toBeVisible();
}

async function trackProSweeps(button: Locator) {
  await button.evaluate(node => {
    node.setAttribute('data-qa-sweeps', '0');
    node.addEventListener('animationstart', event => {
      if (!event.pseudoElement) return;
      node.setAttribute('data-qa-sweeps', String(Number(node.getAttribute('data-qa-sweeps')) + 1));
    });
  });
}

test('runs one PRO shimmer per hover or keyboard focus', async ({page}) => {
  await signInAsOwner(page);
  const pro = page.locator('.sidebar').getByRole('button', {name: 'Купить PRO'});
  await trackProSweeps(pro);
  await expect(pro).toHaveAttribute('data-qa-sweeps', '0');

  await pro.hover();
  await expect(pro).toHaveAttribute('data-qa-sweeps', '1', {timeout: 3000});
  await expect.poll(() => pro.evaluate(node => node.getAnimations({subtree: true}).length)).toBe(0);
  await expect(pro).toHaveAttribute('data-qa-sweeps', '1');
  await expect(pro.locator('canvas')).toHaveCount(0);

  await page.mouse.move(1, 1);
  const previousControl = page.locator('.sidebar__preferences').getByRole('button', {name: /Баланс демотокенов/});
  await previousControl.focus();
  await page.keyboard.press('Tab');
  await expect(pro).toBeFocused();
  await expect(pro).toHaveAttribute('data-qa-sweeps', '2');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', {name: 'Продолжайте с Agentik PRO'})).toBeVisible();
});

test('keeps PRO operable with reduced motion', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await signInAsOwner(page);
  const pro = page.locator('.sidebar').getByRole('button', {name: 'Купить PRO'});
  await pro.hover();
  expect(await pro.evaluate(node => node.getAnimations({subtree: true}))).toHaveLength(0);
  await pro.click();
  await expect(page.getByRole('dialog', {name: 'Продолжайте с Agentik PRO'})).toBeVisible();
});

test('omits the footer and mobile upgrade button for a PRO account', async ({page}) => {
  await openCatalog(page, codeB);
  await expect(page.locator('.sidebar').getByLabel('Баланс демотокенов')).toHaveText('∞');
  await expect(page.locator('.sidebar .button--pro')).toHaveCount(0);
  await page.setViewportSize({width:390, height:844});
  await page.getByRole('button', {name:'Открыть профиль'}).click();
  await expect(page.getByRole('dialog').locator('.button--pro')).toHaveCount(0);
});

test.describe('PRO on touch', () => {
  test.use({hasTouch: true, viewport: {width: 390, height: 844}});

  test('opens PRO on tap without a hover shimmer', async ({page}) => {
    await signInAsOwner(page);
    await page.getByRole('button', {name: 'Открыть профиль'}).tap();
    const pro = page.getByRole('dialog').getByRole('button', {name: 'Купить PRO'});
    await pro.hover();
    expect(await pro.evaluate(node => node.getAnimations({subtree: true}))).toHaveLength(0);
    await pro.tap();
    await expect(page.getByRole('dialog', {name: 'Продолжайте с Agentik PRO'})).toBeVisible();
  });
});
