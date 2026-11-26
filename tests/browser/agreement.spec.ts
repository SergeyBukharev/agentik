import {expect,test} from '@playwright/test';
import {codeA,codeField,expectNoHorizontalScroll,workspace} from './helpers';

test('keeps one fixed brand and opens the lock when the sixth input character verifies',async({page})=>{
  await page.goto(workspace);
  const brand=page.getByRole('link',{name:'Agentik — главная'});
  await expect(brand).toBeVisible();
  const handle=await brand.elementHandle();
  const initial=await brand.boundingBox();
  expect(await page.locator('link[rel="icon"]').getAttribute('href')).toBe(await brand.locator('img').getAttribute('src'));

  await page.getByRole('link',{name:'Войти по коду'}).click();
  await expect(page.getByRole('heading',{name:'Вход в Agentik'})).toBeVisible();
  await expect(brand.locator('[data-lock="closed"]')).toHaveCount(1);
  expect(await brand.boundingBox()).toMatchObject({x:initial!.x,y:initial!.y});
  expect(await brand.evaluate(node=>getComputedStyle(node).zIndex)).toBe('9999');
  await brand.evaluate(node=>{
    const observer=new MutationObserver(()=>{
      if (node.querySelector('[data-lock="open"]')) {
        node.setAttribute('data-qa-opened','true');
        observer.disconnect();
      }
    });
    observer.observe(node,{attributes:true,attributeFilter:['data-lock'],subtree:true});
  });
  let requests=0;
  let release!:()=>void;
  const ready=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/access/login',async route=>{requests++;await ready;await route.continue();});
  await codeField(page).pressSequentially(codeA.slice(0,5));
  expect(requests).toBe(0);
  await codeField(page).pressSequentially(codeA.slice(5));
  await expect.poll(()=>requests).toBe(1);
  await expect(brand.locator('[data-lock="closed"]')).toHaveCount(1);
  release();
  await expect(page.getByRole('heading',{name:'Ваши разговоры'})).toBeVisible();
  await expect(page).toHaveURL(/#\/history$/);
  await expect(brand).toHaveAttribute('data-qa-opened','true');

  expect(await handle!.evaluate(node=>node===document.querySelector('.persistent-brand'))).toBe(true);
  expect(await brand.boundingBox()).toMatchObject({x:initial!.x,y:initial!.y});
  await page.goto(workspace+'#/assistant/writer');
  await expect(page.getByRole('heading',{name:'Редактор'})).toBeVisible();
  expect(await handle!.evaluate(node=>node.isConnected)).toBe(true);
  expect(await brand.boundingBox()).toMatchObject({x:initial!.x,y:initial!.y});
  expect(requests).toBe(1);
});

test('opens the public agreement and saves and clears a hand-drawn signature',async({page})=>{
  await page.setViewportSize({width:375,height:790});
  await page.goto(workspace);
  await page.getByRole('link',{name:'Пользовательское соглашение'}).click();
  await expect(page.getByRole('heading',{name:'Пользовательское соглашение',exact:true})).toBeVisible();
  await expectNoHorizontalScroll(page);
  const signature=page.getByRole('img',{name:'Поле для подписи'});
  const save=page.getByRole('button',{name:'Сохранить согласие'});
  await save.click();
  await expect(page.getByRole('alert')).toContainText('Нарисуйте подпись');
  await signature.scrollIntoViewIfNeeded();
  const box=(await signature.boundingBox())!;
  await page.mouse.move(box.x+40,box.y+50);
  await page.mouse.down();
  await page.mouse.move(box.x+80,box.y+25,{steps:8});
  await page.mouse.move(box.x+125,box.y+68,{steps:8});
  await page.mouse.up();
  await save.click();
  await expect(page.getByRole('img',{name:'Сохранённая подпись'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('img',{name:'Сохранённая подпись'})).toBeVisible();
  await page.getByRole('button',{name:'Удалить отметку'}).click();
  await expect(signature).toBeVisible();
  await page.goto(workspace+'#/login');
  await page.getByRole('link',{name:'Пользовательское соглашение'}).click();
  await expect(page.getByRole('heading',{name:'Пользовательское соглашение',exact:true})).toBeVisible();
});
