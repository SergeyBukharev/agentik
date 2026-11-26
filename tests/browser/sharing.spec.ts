import {expect, test} from '@playwright/test';
import {messageField, openCatalog, sendButton} from './helpers';

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
  await guest.getByRole('button',{name:'Отправить участникам'}).click();
  await expect(guest.getByRole('dialog')).toContainText('Два пробных сообщения отправлены');
  await guest.keyboard.press('Escape');
  await page.bringToFront();
  await expect(page.getByRole('img',{name:'reference.png'})).toBeVisible();

  await page.getByRole('button',{name:'Пригласить участника'}).click();
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
