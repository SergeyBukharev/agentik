import {expect,test} from '@playwright/test';
import {codeB,codeField,enterCode,expectNoHorizontalScroll,messageField,openCatalog,selectChoice,sendButton,workspace} from './helpers';

test('requires the configured email and keeps only the active code cell highlighted',async({page})=>{
  await page.goto(workspace+'#/login');
  await expect(codeField(page)).toBeVisible();
  await codeField(page).focus();
  expect(await page.locator('.code-gate__field').evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
  expect(await codeField(page).evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
  await enterCode(page,'123QWE');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('textbox',{name:'Email'}).fill('alias@example.test');
  await enterCode(page,'123QWE');
  await expect(page.getByRole('heading',{name:'Ваши разговоры'})).toBeVisible();
});

test('opens PRO after the second accepted message, keeps the third draft and shows the balance',async({page})=>{
  await openCatalog(page);
  await page.getByRole('link',{name:'Открыть: Редактор'}).click();
  await sendButton(page).click();
  await expect(page.getByRole('alert')).toContainText('Напишите сообщение');
  const model = await selectChoice(page, 'Модель', 'DeepSeek');
  await expect(model).toContainText('DeepSeek');
  const balance = page.getByLabel('Баланс демотокенов');
  await expect(balance).toHaveText('2');
  await expect(balance).toHaveRole('button');
  await balance.click();
  await expect(page.getByRole('dialog')).toContainText('Продолжайте с Agentik PRO');
  await page.keyboard.press('Escape');
  await expect(balance).toBeFocused();
  await expect(page.locator('[data-send-price]')).toHaveText('1 токен');
  await messageField(page).fill('Первое сообщение');
  await messageField(page).press('Enter');
  await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();
  await expect(messageField(page)).toBeFocused();
  await expect(balance).toHaveText('1');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await messageField(page).fill('Второе сообщение');
  await sendButton(page).click();
  await expect(page.getByRole('dialog')).toContainText('Два пробных сообщения отправлены');
  await page.getByRole('button',{name:'К чатам',exact:true}).click();
  await expect(balance).toHaveText('0');
  await expect(page.locator('.message--user').getByText('Второе сообщение',{exact:true})).toBeVisible();
  await expect(page.locator('.message--assistant')).toHaveCount(2);

  await page.getByRole('link',{name:'Новый разговор'}).click();
  await expect(page.getByRole('heading',{name:'Привет! С чем помочь?'})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await messageField(page).fill('Третье сообщение');
  await sendButton(page).click();
  await expect(page.getByRole('dialog')).toContainText('Два пробных сообщения отправлены');
  await page.keyboard.press('Escape');
  await expect(messageField(page)).toHaveValue('Третье сообщение');
  await expect(page.locator('.message--user')).toHaveCount(0);

  await page.getByRole('button',{name:'ENG',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Your message'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox',{name:'Your message'})).toBeVisible();
  await expect(page.getByLabel('Demo token balance')).toHaveText('0');
});

test('holds K to dictate into an editable draft and renders the text reveal',async({page})=>{
  await page.addInitScript(()=>{
    class FakeRecognition {
      onstart?:()=>void;
      onend?:()=>void;
      onresult?:(event:unknown)=>void;
      start(){queueMicrotask(()=>this.onstart?.());}
      stop(){this.onresult?.({resultIndex:0,results:[{isFinal:true,0:{transcript:'Черновик из диктовки'}}]});this.onend?.();}
      abort(){}
    }
    Object.defineProperty(window,'SpeechRecognition',{value:FakeRecognition});
  });
  await page.goto(workspace+'#/assistant/writer');
  await enterCode(page);
  const microphone=page.getByRole('button',{name:'Удерживайте для диктовки'});
  await microphone.focus();
  await page.keyboard.down('k');
  await expect(microphone).toHaveAttribute('data-recording','true');
  await page.keyboard.up('k');
  await expect(messageField(page)).toHaveValue('Черновик из диктовки');
  await expect(page.locator('.transcript__letter').first()).toBeVisible();
  await microphone.dispatchEvent('pointerdown',{button:0, pointerId:1, pointerType:'touch'});
  await expect(microphone).toHaveAttribute('data-recording','true');
  await microphone.dispatchEvent('pointerup',{button:0, pointerId:1, pointerType:'touch'});
  await expect(messageField(page)).toHaveValue('Черновик из диктовки Черновик из диктовки');
});

test('shows unlimited PRO balance without a paywall trigger', async ({page}) => {
  await openCatalog(page, codeB);
  const balance = page.getByLabel('Баланс демотокенов');
  await expect(balance).toHaveText('∞');
  await expect(balance).not.toHaveRole('button');
  await balance.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('opens the profile, assistant form and PRO from their direct links',async({page})=>{
  await openCatalog(page);
  for(const [route,title] of [
    ['profile','Ваше пространство'],
    ['create','Помощник по вашим правилам'],
    ['pro','Продолжайте с Agentik PRO'],
  ]){
    await page.goto(workspace+'#/'+route);
    await expect(page.getByRole('dialog',{name:title})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/#\/assistants$/);
  }
});

test('expands the same draft from the top-right of the composer on desktop and mobile', async ({page}) => {
  await page.goto(workspace+'#/assistant/writer');
  await enterCode(page);
  const field = messageField(page);
  await field.fill('Черновик останется на месте');
  for (const width of [1120, 320]) {
    await page.setViewportSize({width, height:690});
    const expand = page.getByRole('button', {name:'Увеличить поле сообщения'});
    await expect(expand).toBeVisible();
    await expect(expand).toHaveAttribute('aria-controls', 'message');
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    const fieldBounds = (await field.boundingBox())!;
    const expandBounds = (await expand.boundingBox())!;
    expect(expandBounds.y).toBe(fieldBounds.y);
    expect(expandBounds.x+expandBounds.width).toBeCloseTo(fieldBounds.x+fieldBounds.width, 0);
    await expect(field).toHaveCSS('resize', 'none');
    await expand.press('Enter');

    const collapse = page.getByRole('button', {name:'Уменьшить поле сообщения'});
    await expect(collapse).toHaveAttribute('aria-expanded', 'true');
    expect((await field.boundingBox())!.height).toBeGreaterThan(fieldBounds.height);
    await expect(field).toHaveValue('Черновик останется на месте');
    await expectNoHorizontalScroll(page);
    await collapse.click();
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect((await field.boundingBox())!.height).toBe(fieldBounds.height);
  }
});
