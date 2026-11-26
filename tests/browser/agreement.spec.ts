import {expect,test} from '@playwright/test';
import {codeA,codeField,expectNoHorizontalScroll,workspace} from './helpers';

test('keeps the current sign-in badge beside the fixed brand and opens it after code verification',async({page})=>{
  await page.goto(workspace);
  const brand=page.getByRole('link',{name:'Agentik — главная'});
  await expect(brand).toBeVisible();
  const handle=await brand.elementHandle();
  const initial=await brand.boundingBox();
  const faviconHref=(await page.locator('link[rel="icon"]').getAttribute('href'))!;
  const faviconResponse=await page.request.get(faviconHref);
  expect(faviconResponse.ok()).toBe(true);
  const sameGeometry=await brand.locator('.persistent-brand__mark').evaluate((mark, favicon) => {
    const reference=new DOMParser().parseFromString(favicon, 'image/svg+xml').documentElement;
    const geometry=(svg:Element)=>Array.from(svg.querySelectorAll('rect,path')).map(shape =>
      [shape.localName,...['x','y','width','height','rx','d'].map(attribute=>shape.getAttribute(attribute))]);
    return mark.getAttribute('viewBox')===reference.getAttribute('viewBox') && JSON.stringify(geometry(mark))===JSON.stringify(geometry(reference));
  }, await faviconResponse.text());
  expect(sameGeometry).toBe(true);

  await page.getByRole('link',{name:'Войти по коду'}).click();
  await expect(page.getByRole('heading',{name:'Вход в Agentik'})).toBeVisible();
  const badge = page.getByRole('img', {name:'Страница входа'});
  await expect(badge).toHaveAttribute('aria-current','page');
  await expect(badge.locator('[data-lock="closed"]')).toHaveCount(1);
  const brandBox = (await brand.boundingBox())!;
  const badgeBox = (await badge.boundingBox())!;
  expect(brandBox).toMatchObject({x:initial!.x,y:initial!.y});
  expect(badgeBox.y).toBe(brandBox.y);
  expect(badgeBox.x).toBeGreaterThan(brandBox.x + brandBox.width);
  expect(badgeBox.height).toBe(brandBox.height);
  expect(await brand.evaluate(node=>getComputedStyle(node.parentElement!).zIndex)).toBe('9999');
  await badge.evaluate(node=>{
    const observer=new MutationObserver(()=>{
      if (node.querySelector('[data-lock="open"]')) {
        document.documentElement.setAttribute('data-qa-opened','true');
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
  await expect(badge.locator('[data-lock="closed"]')).toHaveCount(1);
  release();
  await expect(page.getByRole('heading',{name:'Ваши разговоры'})).toBeVisible();
  await expect(page).toHaveURL(/#\/history$/);
  await expect(page.locator('html')).toHaveAttribute('data-qa-opened','true');
  await expect(badge).toHaveCount(0);

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
