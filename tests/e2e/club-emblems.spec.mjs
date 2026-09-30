import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
const image='https://media.api-sports.io/football/teams/50.png';
const asset={asset_type:'club_logo',usage_status:'identification',source_provider:'api-football',url:image};
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');

for(const theme of ['dark','light'])test(`эмблемы API-Football в календаре, матче и ленте (${theme})`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await installSupabaseMock(page,{clubMarks:[{id:24,name:'Real Madrid CF',media:asset},{id:31,name:'Manchester City FC',media:asset}]});
  await page.route(image,route=>route.fulfill({contentType:'image/png',body:pixel}));
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/matches?__e2e=1');await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
  await expect(page.locator('#matchG .mc-score-mark img').first()).toBeVisible();
  expect(await page.locator('#matchG .mc-score-mark img').first().evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
  await page.locator('#matchG .mc-score-link').filter({hasText:'Manchester City FC'}).click();
  await expect(page).toHaveURL(/\/match\/101/);await expect(page.locator('.md-team-mark img')).toHaveCount(2);
  await page.getByRole('button',{name:'Лента',exact:true}).first().click();
  await expect(page.locator('.feed-club-mark img').first()).toBeVisible();
  await page.locator('.feed-score').first().click();await expect(page).toHaveURL(/\/match\/101/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);expect(errors).toEqual([]);
});

test('ошибка API-Football эмблемы сохраняет инициалы и кликабельный матч',async({page})=>{
  await installSupabaseMock(page,{clubMarks:[{id:31,name:'Manchester City FC',media:asset}]});await page.route(image,route=>route.abort());
  await page.goto('/match/101?__e2e=1');
  await expect(page.locator('.md-team-mark').last()).toHaveClass(/is-fallback/);await expect(page.locator('.md-team-mark').last()).toHaveText('MC');
  await expect(page.locator('.md-team-mark img')).toHaveCount(0);
});

test('админ сначала видит подготовленные эмблемы, публикация не вызывает повторный запрос API',async({page})=>{
  await page.setViewportSize({width:390,height:844});await installSupabaseMock(page);await page.route(image,route=>route.fulfill({contentType:'image/png',body:pixel}));
  const calls=[];
  await page.route('**/api/admin*',route=>{
    const body=route.request().postDataJSON();if(body)calls.push(body);
    const data=body?.action==='prepare_club_emblems'?{batch:'12345678-1234-4123-8123-123456789012',league:'PL',season:2024,received:20,items:[{club_id:31,club_name:'Manchester City FC',source_url:image}],skipped:[],quota:{dailyRemaining:98}}:body?.action==='apply_club_emblems'?{applied:1}:{counts:{},recentMatches:[],footballApiConfigured:true,apiFootballConfigured:true};
    return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/admin?__e2e=1');await page.getByRole('button',{name:'Синхронизация',exact:true}).click();
  await expect(page.getByRole('button',{name:'Опубликовать эмблемы',exact:true})).toBeDisabled();
  await page.getByLabel('Год начала сезона').fill('2024');await page.getByRole('button',{name:'Подготовить эмблемы',exact:true}).click();
  await expect(page.locator('#adminEmblemsPreview img')).toBeVisible();await expect(page.locator('#adminEmblemsResult')).toContainText('подготовлено 1 из 20');
  await page.getByRole('button',{name:'Опубликовать эмблемы',exact:true}).click();await expect(page.locator('#adminEmblemsResult')).toContainText('Подключено эмблем: 1');
  expect(calls.map(call=>call.action)).toEqual(['prepare_club_emblems','apply_club_emblems']);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});
