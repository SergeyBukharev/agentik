import {expect,test} from '@playwright/test';
import {expectNoHorizontalScroll,openCatalog,workspace} from './helpers';

test('opens the model menu, displays provider marks and supports keyboard selection',async({page})=>{
  await page.addInitScript(() => {
    class SpeechRecognition {
      start() { document.documentElement.dataset.qaDictationStarted = 'true'; }
      stop() {}
      abort() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', {value: SpeechRecognition, configurable: true});
  });
  await openCatalog(page);
  await expect(page.getByText('С чего начнём?', {exact:true})).toHaveCount(0);
  await page.goto(workspace+'#/assistant/ideas');
  const trigger=page.getByRole('combobox',{name:'Модель'});
  await expect(trigger).toHaveAttribute('data-agentik-select','');
  await trigger.press('KeyK');
  await expect(page.locator('html')).not.toHaveAttribute('data-qa-dictation-started','true');
  await trigger.press('Enter');
  const menu=page.getByRole('listbox');
  await expect(menu).toBeVisible();
  const openai=menu.getByRole('option',{name:'ChatGPT'});
  const deepseek=menu.getByRole('option',{name:'DeepSeek'});
  const alice=menu.getByRole('option',{name:'Алиса AI'});
  await expect(openai.locator('[data-provider-icon="openai"] img:visible')).toHaveJSProperty('complete',true);
  await expect(openai.locator('[data-provider-icon="openai"] img:visible')).not.toHaveJSProperty('naturalWidth',0);
  await expect(deepseek.locator('[data-provider-icon="deepseek"] img')).toHaveJSProperty('complete',true);
  await expect(deepseek.locator('[data-provider-icon="deepseek"] img')).not.toHaveJSProperty('naturalWidth',0);
  await expect(alice.locator('[data-provider-icon="alice"] img')).toHaveJSProperty('complete',true);
  await expect(alice.locator('[data-provider-icon="alice"] img')).not.toHaveJSProperty('naturalWidth',0);
  await expect(menu.getByRole('option',{name:'Авто'})).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(openai).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText('ChatGPT');
  await expect(trigger.locator('[data-provider-icon="openai"]')).toBeVisible();
  await trigger.press('Enter');
  await expect(openai).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('KeyK');
  await expect(page.locator('html')).not.toHaveAttribute('data-qa-dictation-started','true');
  await page.keyboard.press('Escape');
  await trigger.press('Enter');
  await page.keyboard.press('d');
  await expect(deepseek).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText('ChatGPT');
  await trigger.press('Enter');
  await alice.click();
  await expect(trigger).toContainText('Алиса AI');
  await page.setViewportSize({width:1024,height:768});
  await page.getByRole('button',{name:'ENG',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Model'})).toContainText('Alice AI');
});

test('uses the same themed selector in the profile and closes the menu before the dialog',async({page})=>{
  await openCatalog(page);
  await page.getByRole('button',{name:'Тёмная тема'}).click();
  await page.goto(workspace+'#/profile');
  const profile=page.getByRole('dialog',{name:'Ваше пространство'});
  await expect(profile).toBeVisible();
  const mode=page.getByRole('combobox',{name:'Режим ответов'});
  await mode.press('Enter');
  const menu=page.getByRole('listbox');
  await expect(menu).toBeVisible();
  const surface=await menu.evaluate(node=>getComputedStyle(node).getPropertyValue('--surface').trim());
  expect(surface).toBe('#22271f');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(profile).toBeVisible();
  await expect(mode).toBeFocused();
  await mode.click();
  await page.getByRole('option',{name:'AI через сервер'}).click();
  await expect(mode).toContainText('AI через сервер');
});

test.describe('touch layout',()=>{
  test.use({viewport:{width:375,height:710},hasTouch:true,isMobile:true});
  test('positions the model menu inside a small viewport and selects by tapping',async({page})=>{
    await openCatalog(page);
    await page.goto(workspace+'#/assistant/ideas');
    const trigger=page.getByRole('combobox',{name:'Модель'});
    await trigger.tap();
    const menu=page.getByRole('listbox');
    await expect(menu).toBeVisible();
    const bounds=(await menu.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x+bounds.width).toBeLessThanOrEqual(375);
    expect(bounds.y+bounds.height).toBeLessThanOrEqual(710);
    await expectNoHorizontalScroll(page);
    await menu.getByRole('option',{name:'DeepSeek'}).tap();
    await expect(trigger).toContainText('DeepSeek');
  });
});
