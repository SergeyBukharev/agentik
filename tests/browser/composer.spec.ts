import {expect,test,type Locator} from '@playwright/test';
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

test('shows expanding waves while dictating and reveals only the new text inside the draft',async({page})=>{
  await page.addInitScript(()=>{
    class FakeRecognition {
      onstart?:()=>void;
      onend?:()=>void;
      onresult?:(event:unknown)=>void;
      start(){queueMicrotask(()=>this.onstart?.());}
      stop(){this.onresult?.({resultIndex:0,results:[{isFinal:true,0:{transcript:'Кофе, чай 👩‍💻'}}]});this.onend?.();}
      abort(){}
    }
    Object.defineProperty(window,'SpeechRecognition',{value:FakeRecognition});
  });
  await page.goto(workspace+'#/assistant/writer');
  await enterCode(page);
  const field = messageField(page);
  await field.fill('Покупки:');
  const microphone=page.getByRole('button',{name:'Удерживайте для диктовки'});
  const waves = microphone.locator('.composer__mic-waves');
  const preview = page.locator('.composer__field .composer__dictation-preview');
  await microphone.focus();
  await page.keyboard.down('k');
  await expect(microphone).toHaveAttribute('data-recording','true');
  await expect(waves).toBeVisible();
  expect(await waves.evaluate(el => getComputedStyle(el, '::before').animationPlayState)).toBe('running');
  await page.keyboard.up('k');
  await expect(field).toHaveValue('Покупки: Кофе, чай 👩‍💻');
  await expect(preview).toHaveText('Покупки: Кофе, чай 👩‍💻');
  await expect(preview.locator('.composer__dictation-letter').first()).toHaveText('К');
  await expect(preview.locator('.composer__dictation-letter').last()).toHaveText('👩‍💻');
  await expect(microphone).toHaveAttribute('data-recording','false');
  await expect(preview).toHaveCount(0);
  await field.fill('Исправленный текст');
  await expect(field).toHaveValue('Исправленный текст');

  await page.setViewportSize({width:360,height:660});
  await microphone.dispatchEvent('pointerdown',{button:0,pointerId:1,pointerType:'touch'});
  await expect(microphone).toHaveAttribute('aria-pressed','true');
  await expect(waves).toBeVisible();
  await microphone.dispatchEvent('pointerup',{button:0,pointerId:2,pointerType:'touch'});
  await expect(microphone).toHaveAttribute('aria-pressed','true');
  await microphone.dispatchEvent('pointerup',{button:0,pointerId:1,pointerType:'touch'});
  await expect(microphone).toHaveAttribute('aria-pressed','false');
  await expect(waves).toBeHidden();
  await expect(field).toHaveValue('Исправленный текст Кофе, чай 👩‍💻');
  await expectNoHorizontalScroll(page);

  await microphone.focus();
  await page.keyboard.down('Space');
  await expect(microphone).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.up('Space');
  await expect(microphone).toHaveAttribute('aria-pressed','false');
  await expect(field).toHaveValue('Исправленный текст Кофе, чай 👩‍💻 Кофе, чай 👩‍💻');
});

test('holds K or Л inside the editor to dictate while a short press types the letter', async ({page}) => {
  await page.addInitScript(() => {
    class Recognition {
      onstart?: () => void;
      onend?: () => void;
      onresult?: (event: unknown) => void;
      start() { queueMicrotask(() => this.onstart?.()); }
      stop() {
        this.onresult?.({resultIndex:0,results:[{isFinal:true,0:{transcript:'Добавленный голосом текст'}}]});
        this.onend?.();
      }
      abort() {}
    }
    Object.defineProperty(window,'SpeechRecognition',{value:Recognition});
  });
  await page.goto(workspace+'#/assistant/writer');
  await enterCode(page);
  const field = messageField(page);
  const microphone = page.getByRole('button',{name:'Удерживайте для диктовки'});
  await field.fill('');
  await page.clock.install();

  await field.press('k');
  await page.clock.runFor(450);
  await expect(field).toHaveValue('k');
  await expect(microphone).toHaveAttribute('aria-pressed','false');

  await field.fill('Список покупок');
  await field.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(0,6,'backward'));
  await page.keyboard.down('k');
  await page.clock.runFor(450);
  await expect(microphone).toHaveAttribute('aria-pressed','true',{timeout:2500});
  await expect(field).toHaveValue('Список покупок');
  expect(await field.evaluate(node => (node as HTMLTextAreaElement).selectionEnd)).toBe(6);
  await page.keyboard.down('k');
  await expect(field).toHaveValue('Список покупок');
  await page.keyboard.up('k');
  await expect(field).toHaveValue('Список покупок Добавленный голосом текст');

  await field.fill('');
  const russian = {key:'л',code:'Unidentified'};
  await field.dispatchEvent('keydown',russian);
  await page.keyboard.insertText('л');
  await field.dispatchEvent('keyup',russian);
  await page.clock.runFor(450);
  await expect(field).toHaveValue('л');
  await expect(microphone).toHaveAttribute('aria-pressed','false');

  await field.fill('Голос');
  await field.press('End');
  await field.dispatchEvent('keydown',russian);
  await page.keyboard.insertText('л');
  await page.clock.runFor(450);
  await expect(microphone).toHaveAttribute('aria-pressed','true');
  await field.dispatchEvent('keyup',russian);
  await expect(field).toHaveValue('Голос Добавленный голосом текст');
  await expect(microphone).toHaveAttribute('aria-pressed','false');

  await field.fill('');
  await page.keyboard.down('k');
  await page.keyboard.press('a');
  await page.clock.runFor(450);
  await page.keyboard.up('k');
  await expect(field).toHaveValue('ka');
  await expect(microphone).toHaveAttribute('aria-pressed','false');
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

test('grows with multiline drafts and keeps the caret and send button reachable at the height limit', async ({page}) => {
  await page.setViewportSize({width:390, height:820});
  await page.goto(workspace + '#/assistant/writer');
  await enterCode(page);
  const field = messageField(page);
  const initial = (await field.boundingBox())!.height;
  await field.fill('Первая строка\nВторая строка\nТретья строка\nЧетвёртая строка\nПятая строка');
  await expect.poll(async () => (await field.boundingBox())!.height).toBeGreaterThan(initial);
  await expect.poll(() => field.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  await field.fill(('Черновик с длинными строками и таймкодом.\n').repeat(140));
  await field.evaluate(editor => {
    const draft = editor as HTMLTextAreaElement;
    draft.setSelectionRange(draft.value.length, draft.value.length);
  });
  await field.pressSequentially('.');
  await expect.poll(() => field.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await expect(sendButton(page)).toBeInViewport({ratio:1});
  await expectNoHorizontalScroll(page);
  await field.fill('');
  await expect.poll(async () => (await field.boundingBox())!.height).toBe(initial);
});

test('animates only manual character input and leaves pasted text static', async ({page}) => {
  await page.goto(workspace + '#/assistant/writer');
  await enterCode(page);
  const field = messageField(page);
  const editor = page.locator('.composer__field');
  await editor.evaluate(node => {
    const observer = new MutationObserver(() => {
      const letter = node.querySelector('.composer__typing-letter');
      if (letter) (node as HTMLElement).dataset.sampledTyping = letter.textContent ?? '';
    });
    observer.observe(node, {childList:true, subtree:true});
  });
  const preview = page.locator('.composer__typing-preview');
  await field.press('a');
  await expect(editor).toHaveAttribute('data-sampled-typing', 'a');
  await expect(preview).toBeHidden();
  await field.evaluate(el => {
    el.setRangeText('!', el.selectionStart, el.selectionEnd, 'end');
    el.dispatchEvent(new InputEvent('input', {inputType:'insertFromPaste', data:'!', bubbles:true}));
  });
  await expect(field).toHaveValue('a!');
  await expect(preview).toBeHidden();
  await page.emulateMedia({reducedMotion:'reduce'});
  await field.press('b');
  await expect(field).toHaveValue('a!b');
  await expect(preview).toBeHidden();
});

test('keeps the branded draft scrollbar at the right edge on desktop and mobile', async ({page}) => {
  await page.goto(workspace+'#/assistant/writer');
  await enterCode(page);
  const field = messageField(page);
  const draft = Array.from({length: 30}, (_, index) => `Строка ${index + 1}`).join('\n');
  await field.fill(draft);

  async function expectDraftScrolls() {
    await field.evaluate(el => { el.scrollTop = 0; });
    await field.hover();
    await page.mouse.wheel(0, 120);
    await expect.poll(() => field.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  }

  async function expectScrollbarOutside(button: Locator) {
    const [area, toggle, editor] = await Promise.all([
      field.boundingBox(), button.boundingBox(), page.locator('.composer__editor').boundingBox(),
    ]);
    const gutter = await field.evaluate(node => node.offsetWidth - node.clientWidth);
    expect(Math.abs(area!.x + area!.width - editor!.x - editor!.width)).toBeLessThanOrEqual(1);
    expect(area!.x + area!.width - toggle!.x - toggle!.width).toBeGreaterThanOrEqual(Math.max(4, gutter));
  }

  for (const width of [1120, 320]) {
    await page.setViewportSize({width, height:690});
    const expand = page.getByRole('button', {name:'Увеличить поле сообщения'});
    await expect(expand).toBeVisible();
    await expect(expand).toHaveAttribute('aria-controls', 'message');
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    const fieldBounds = (await field.boundingBox())!;
    const expandBounds = (await expand.boundingBox())!;
    expect(Math.abs(expandBounds.y - fieldBounds.y)).toBeLessThanOrEqual(1);
    await expectScrollbarOutside(expand);
    await expect(field).toHaveCSS('resize', 'none');
    await expectDraftScrolls();
    await expand.press('Enter');

    const collapse = page.getByRole('button', {name:'Уменьшить поле сообщения'});
    await expect(collapse).toHaveAttribute('aria-expanded', 'true');
    const expandedField = (await field.boundingBox())!;
    expect(expandedField.height).toBeGreaterThan(fieldBounds.height);
    await expectScrollbarOutside(collapse);
    await expect(field).toHaveValue(draft);
    await expectDraftScrolls();
    await expectNoHorizontalScroll(page);
    await collapse.click();
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect((await field.boundingBox())!.height).toBe(fieldBounds.height);
  }

  await page.getByRole('button',{name:'Тёмная тема',exact:true}).click();
  const colors = await field.evaluate(node => {
    const sample = document.createElement('span');
    sample.style.color = 'var(--brand-lime)';
    document.body.append(sample);
    const lime = getComputedStyle(sample).color;
    sample.remove();
    const scrollbar = CSS.supports('scrollbar-color','auto')
      ? getComputedStyle(node).getPropertyValue('scrollbar-color')
      : getComputedStyle(node,'::-webkit-scrollbar-thumb').backgroundColor;
    return {lime,scrollbar,selection:getComputedStyle(node,'::selection').backgroundColor};
  });
  expect(colors.scrollbar).toContain(colors.lime);
  expect(colors.selection).toBe(colors.lime);
});
