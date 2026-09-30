import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

test.beforeEach(async({page})=>{await installSupabaseMock(page);});

test('messaging is absent while ratings, friends and review comments remain usable',async({page})=>{
  const errors=[],assets=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>assets.push(r.url()));
  await page.goto('/match/101?__e2e=1');
  await expect(page.locator('.md-primary-action')).toBeVisible();
  await expect(page.getByRole('button',{name:/Чат|Обсуждение матча/})).toHaveCount(0);
  await page.goto('/friends?__e2e=1');
  await expect(page.locator('#accountBtn')).toContainText('bazed');
  await expect(page.getByRole('button',{name:/Открыть чат/})).toHaveCount(0);
  await page.goto('/feed?__e2e=1');
  const entry=page.locator('.feed-entry').first();
  await expect(entry).toBeVisible();
  await expect(page.getByRole('button',{name:'Отправить оценку другу'})).toHaveCount(0);
  await entry.getByRole('button',{name:'Обсудить оценку'}).click();
  await expect(entry.locator('.feed-comments')).toContainText('Комментар');
  await expect(page.locator('#page-chat,#directChatOv')).toHaveCount(0);
  expect(assets.some(url=>/\/(?:js|css)\/messages\./.test(url))).toBe(false);
  expect(errors).toEqual([]);
});

test('retired HTTP route is gone; old hash links lead to the match without loading messaging',async({page,request})=>{
  const response=await request.get('/match/101/chat');
  expect(response.status()).toBe(410);
  await page.goto('/?__e2e=1#match/101/chat');
  await expect(page.locator('.md-hero')).toBeVisible();
  await expect(page).toHaveURL(/\/match\/101\?__e2e=1$/);
  await expect(page.locator('#page-chat,#directChatOv')).toHaveCount(0);
});

test('browser policy disables microphone, media playback and realtime transport',async({request})=>{
  const response=await request.get('/');
  expect(response.headers()['permissions-policy']).toContain('microphone=()');
  expect(response.headers()['content-security-policy']).toContain("media-src 'none'");
  expect(response.headers()['content-security-policy']).not.toContain('wss:');
});

test('saving a new rating does not offer a retired forwarding action',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/match/101?__e2e=1');
  await expect(page.locator('.md-primary-action')).toBeVisible();
  await page.evaluate(()=>{
    const from=sb.from.bind(sb);
    sb.from=table=>{
      const query=from(table);
      if(table==='ratings')query.maybeSingle=()=>Promise.resolve({data:null,error:null});
      return query;
    };
  });
  await page.locator('.md-primary-action').click();
  await expect(page.locator('#rateTitle')).toHaveText('Оценить матч');
  await page.locator('.rating-supporter-options label').filter({has:page.locator('input[value="neutral"]')}).click();
  await page.locator('.rate-star').nth(8).click();
  await page.getByRole('button',{name:/Продолжить/}).click();
  await page.clock.install();
  await page.locator('#rSave').click();
  await expect(page.locator('#rateOv')).toBeHidden();
  await page.clock.runFor(600);
  await expect(page.locator('#confirmOv')).toBeHidden();
  await expect(page.getByRole('button',{name:'Отправить другу'})).toHaveCount(0);
  expect((await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.lastRating())).p_match_rating).toBe(9);
  expect(errors).toEqual([]);
});
