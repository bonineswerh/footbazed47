import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

test.beforeEach(async({page})=>{
  await installSupabaseMock(page);
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,route=>route.abort());
});

test('авторизованный пользователь управляет реакциями и комментариями в ленте',async({page})=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/?__e2e=1#feed');

  await expect(page.getByRole('heading',{name:'Лента',exact:true})).toBeVisible();
  await expect(page).toHaveTitle('Лента — FOOTBAZED');
  await expect(page.locator('#accountBtn')).toContainText('bazed');

  const entry=page.locator('.feed-entry[data-rating-id="501"]');
  await expect(entry).toContainText('Сильный второй тайм');
  const like=entry.locator('.like-action');
  await expect(like.locator('span')).toHaveText('3');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed','true');
  await expect(like.locator('span')).toHaveText('4');

  await entry.getByRole('button',{name:/Обсудить/}).click();
  await expect(entry.getByText('Согласен насчёт второго тайма.')).toBeVisible();
  await entry.getByPlaceholder('Написать комментарий').fill('Новая мысль после матча.');
  await entry.locator('.comment-form button[type="submit"]').click();
  const created=entry.locator('.feed-comment').filter({hasText:'Новая мысль после матча.'});
  await expect(created).toBeVisible();
  await created.getByRole('button',{name:'Удалить комментарий'}).click();
  await expect(created).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('страница клуба открывает игрока и возвращает в клуб',async({page})=>{
  await page.goto('/?__e2e=1#club/24');

  await expect(page.getByRole('heading',{name:'Real Madrid CF',exact:true})).toBeVisible();
  await expect(page.getByText('Santiago Bernabéu')).toBeVisible();
  await page.getByRole('tab',{name:/Состав/}).click();
  await page.getByRole('button',{name:/Thibaut Courtois/}).click();

  await expect(page).toHaveURL(/#player\/5290$/);
  await expect(page.getByRole('heading',{name:'Thibaut Courtois',exact:true})).toBeVisible();
  await expect(page.getByText('Средняя оценка')).toBeVisible();
  await page.getByRole('button',{name:'Real Madrid CF',exact:true}).click();
  await expect(page).toHaveURL(/#club\/24$/);
  await expect(page.getByRole('heading',{name:'Real Madrid CF',exact:true})).toBeVisible();
});

test.describe('мобильный авторизованный сценарий',()=>{
  test.use({viewport:{width:390,height:844}});

  test('личная лента не создаёт горизонтальную прокрутку',async({page})=>{
    await page.goto('/?__e2e=1#feed');
    await page.getByRole('button',{name:'Мои',exact:true}).click();
    await expect(page.locator('.feed-entry')).toHaveCount(1);
    await expect(page.getByText('Мои публикации')).toBeVisible();
    await expect(page.locator('.feed-edit')).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
