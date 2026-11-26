import {expect, test} from '@playwright/test';
import {codeB, expectNoHorizontalScroll, messageField, openCatalog, sendButton, workspace} from './helpers';

test('keeps the share action visible before the first message on a narrow screen', async ({page}) => {
  await page.setViewportSize({width:320, height:568});
  await openCatalog(page);
  await page.getByRole('link', {name:'Открыть: Редактор'}).click();
  await messageField(page).fill('Текст черновика');

  const button = page.getByRole('button', {name:'Поделиться чатом'});
  await expect(button).toHaveText('Поделиться');
  await expect(button).toBeInViewport({ratio:1});
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await button.click();
  const dialog = page.getByRole('dialog', {name:'Доступ к чату'});
  await expect(dialog).toContainText('Отправьте первое сообщение');
  await expect(dialog.getByRole('textbox', {name:'Приглашение'})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(messageField(page)).toHaveValue('Текст черновика');
});

test('shares an existing chat, exchanges an attachment and makes it private again', async ({page, context}) => {
  await openCatalog(page);
  await page.getByRole('link',{name:'Открыть: Редактор'}).click();
  await messageField(page).fill('История перед приглашением');
  await sendButton(page).click();
  await expect(page.getByText(/Это демонстрационный ответ/)).toBeVisible();

  await page.getByRole('button',{name:'Поделиться чатом'}).click();
  const share = page.getByRole('dialog',{name:'Доступ к чату'});
  await share.getByRole('button',{name:'Создать группу'}).click();
  const invitation = await share.getByRole('textbox',{name:'Приглашение'}).inputValue();
  await share.getByRole('link',{name:'Открыть группу'}).click();
  await expect(page.getByRole('heading',{name:'История перед приглашением'})).toBeVisible();

  const guest = await context.newPage();
  await guest.goto(invitation);
  await guest.getByRole('button',{name:'Открыть профиль'}).click();
  await guest.getByRole('button',{name:'Другой профиль'}).click();
  await guest.getByRole('textbox',{name:'Как вас зовут?'}).fill('Гость QA');
  await guest.getByRole('button',{name:'Создать пространство'}).click();
  await guest.getByRole('button',{name:'Присоединиться'}).click();
  await expect(guest.getByRole('article').getByText('История перед приглашением',{exact:true})).toBeVisible();

  await guest.locator('input[type=file]').setInputFiles({
    name:'reference.png',
    mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAF0lEQVR4nGOcejCYgRBgIqhiVNEABAEA9LYBwYIi/9wAAAAASUVORK5CYII=','base64'),
  });
  await expect(guest.getByLabel('Удалить изображение')).toBeVisible();
  const guestField = guest.getByRole('textbox',{name:'Сообщение участникам'});
  await guestField.fill('@');
  await guest.getByRole('listbox',{name:'Упоминания'}).getByRole('option',{name:/Моё пространство/}).click();
  await guestField.press('End');
  await guest.keyboard.type('Посмотри на вложение');
  await guest.getByRole('button',{name:'Отправить участникам'}).click();
  await expect(guest.getByRole('dialog')).toContainText('Два пробных сообщения отправлены');
  await guest.keyboard.press('Escape');
  await page.bringToFront();
  await expect(page.getByRole('img',{name:'reference.png'})).toBeVisible();
  await expect(page.getByText('Вас упомянули',{exact:true})).toBeVisible();

  await page.getByRole('button',{name:'Поделиться группой'}).click();
  await share.getByRole('button',{name:'Сделать приватным'}).click();
  await share.getByRole('button',{name:'Закрыть доступ'}).click();
  await expect(share.getByRole('textbox',{name:'Приглашение'})).toHaveCount(0);
  await expect(guest.getByRole('heading',{name:'Чат недоступен'})).toBeVisible();
  await expect(guest.getByRole('img',{name:'reference.png'})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByText('Приватный чат',{exact:true})).toBeVisible();
  await expect(page.getByRole('img',{name:'reference.png'})).toBeVisible();
  await guest.goto(invitation);
  await guest.getByRole('button',{name:'Присоединиться'}).click();
  await expect(guest.getByRole('alert')).toHaveText(/приглашение истекло/);
});

test('adds a custom bot and a template, mentions the active bot and receives its reply', async ({page, browserName}) => {
  await openCatalog(page,codeB);
  await page.getByRole('button',{name:'Создать помощника',exact:true}).click();
  await page.getByLabel('Название',{exact:true}).fill('Кот QA');
  await page.getByLabel('Что он умеет').fill('Фантазирует и сочиняет короткие истории.');
  await page.getByRole('button',{name:'Сохранить помощника'}).click();
  await expect(page.getByRole('heading',{name:'Кот QA'})).toBeVisible();
  await page.goto(workspace+'#/rooms');
  await page.getByRole('button',{name:'Создать комнату'}).click();
  await page.getByRole('textbox',{name:'Название комнаты'}).fill('Сценарий команды');
  await page.getByRole('dialog').getByRole('button',{name:'Создать комнату'}).click();
  await expect(page.getByRole('heading',{name:'Сценарий команды'})).toBeVisible();

  await page.setViewportSize({width:360,height:720});
  await page.getByRole('button',{name:'Персонажи в чате'}).click();
  const roster = page.getByRole('dialog',{name:'Персонажи в чате'});
  await roster.getByRole('button',{name:'Добавить «Кот QA»',exact:true}).click();
  await roster.getByRole('button',{name:'Добавить «Мира»',exact:true}).click();
  await expect(roster.getByRole('button',{name:'Убрать «Мира»',exact:true})).toBeVisible();
  await roster.getByRole('button',{name:'Закрыть',exact:true}).click();
  await expectNoHorizontalScroll(page);

  const field = page.getByRole('textbox',{name:'Сообщение участникам'});
  await field.fill('mail@example');
  const mentions = page.getByRole('listbox',{name:'Упоминания'});
  await expect(mentions).toHaveCount(0);
  await field.fill('@мир');
  await expect(mentions.getByRole('option',{name:/Мира/})).toBeVisible();
  await field.press('Enter');
  await expect(field).toHaveValue(/^@мира\s$/u);
  await field.press('End');
  await page.keyboard.insertText('Куда отправимся?');
  await page.getByRole('button',{name:'Отправить участникам'}).click();
  await expect(page.locator('.message__mention')).toHaveText('@мира');
  await expect(page.getByText(/Это демонстрационный ответ «Мира»/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/Это демонстрационный ответ «Мира»/)).toBeVisible();
  await page.setViewportSize({width:568,height:320});
  await field.fill('@кот');
  await page.evaluate(() => {
    const viewport = window.visualViewport!;
    Object.defineProperty(viewport,'height',{value:155,configurable:true});
    Object.defineProperty(viewport,'offsetTop',{value:40,configurable:true});
    viewport.dispatchEvent(new Event('resize'));
  });
  const custom = mentions.getByRole('option',{name:/Кот QA/});
  await expect.poll(async () => {
    const bounds = await custom.boundingBox();
    return !!bounds && bounds.y >= 40 && bounds.y + bounds.height <= 195;
  }).toBe(true);
  if (browserName === 'webkit') await custom.tap();
  else await custom.click();
  await expect(field).toHaveValue('@кот-qa ');
  await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, 'height');
    Reflect.deleteProperty(window.visualViewport!, 'offsetTop');
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await page.setViewportSize({width:360,height:720});

  await page.getByRole('button',{name:'Персонажи в чате'}).click();
  await roster.getByRole('button',{name:'Убрать «Мира»',exact:true}).click();
  await roster.getByRole('button',{name:'Закрыть',exact:true}).click();
  await field.fill('@мир');
  await expect(mentions).toContainText('Никого не нашли');
  await expect(page.locator('.message__mention')).toHaveText('@мира');
});
