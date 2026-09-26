import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const user='3615141a-7700-46b8-9ba5-e4f4450537fc';
const diary=Array.from({length:18},(_,i)=>({id:200+i,user_id:user,match_id:101,match_rating:i<9?9:7,is_public:i!==0,created_at:'2026-09-20T12:00:00Z',home_team_name:i===0?'Brighton':'Real Madrid',away_team_name:'Opponent '+i,league_name:i<9?'La Liga':'Premier League',match_date:`2026-09-${String(i+1).padStart(2,'0')}T19:00:00Z`,home_score:2,away_score:1}));
test.beforeEach(async({page})=>{await installSupabaseMock(page,{diary});});

test('дневник ограничен страницами, ищет всю историю и объединяет фильтры',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`/profile/${user}?__e2e=1`);
  await expect(page.locator('#diaryList .rh-row')).toHaveCount(8);
  await expect(page.locator('#diaryPage')).toHaveText('1–8 из 18');
  await page.locator('#diaryNext').click();
  await expect(page.locator('#diaryPage')).toHaveText('9–16 из 18');
  await page.locator('#diaryNext').click();
  await expect(page.locator('#diaryList .rh-row')).toHaveCount(2);
  await expect(page.locator('#diaryNext')).toBeDisabled();
  await page.locator('#diaryPrevious').click();
  await expect(page.locator('#diaryPage')).toHaveText('9–16 из 18');
  await page.getByRole('searchbox',{name:'Найти оценённый матч'}).fill('Brighton');
  await expect(page.locator('#diaryList .rh-row')).toHaveCount(1);
  await expect(page.locator('#diaryList')).toContainText('Только вам');
  await expect(page.locator('#diaryPage')).toHaveText('1–1 из 1');
  await page.getByRole('button',{name:'Сбросить фильтры'}).click();
  await expect(page.locator('#diaryPage')).toHaveText('1–8 из 18');
  await page.locator('#diaryFilters-league').selectOption('La Liga');
  await page.locator('#diaryFilters summary').click();
  await page.getByLabel('Матчи с',{exact:true}).fill('2026-09-04');
  await page.getByLabel('Матчи по',{exact:true}).fill('2026-09-07');
  await page.getByLabel('Голы хозяев').fill('2');
  await expect(page.locator('#diaryPage')).toHaveText('1–4 из 4');
  expect(errors).toEqual([]);
});

test('обзор имеет четыре сущности, выборку и рабочие фильтры',async({page})=>{
  await page.goto('/discover?__e2e=1');
  await expect(page).toHaveTitle(/Обзор оценок/);
  await expect(page.locator('.statistics-row')).toHaveCount(1);
  await expect(page.locator('.statistics-score')).toHaveText('9.0/10');
  await page.getByRole('button',{name:'Клубы',exact:true}).click();
  await expect(page.locator('.statistics-row')).toHaveCount(2);
  await expect(page.locator('#statisticsMethod')).toContainText('не оценка силы');
  await page.getByRole('button',{name:'Игроки',exact:true}).click();
  await expect(page.locator('.statistics-row').first()).toContainText('Thibaut Courtois');
  await page.getByRole('searchbox',{name:'Поиск в обзоре'}).fill('Bellingham');
  await expect(page.locator('.statistics-row')).toHaveCount(1);
  await expect(page.locator('.statistics-row')).toContainText('Jude Bellingham');
  await page.getByRole('button',{name:'Сбросить фильтры'}).click();
  await page.getByRole('button',{name:'Турниры',exact:true}).click();
  await expect(page.locator('.statistics-row')).toContainText('Champions League');
  await page.locator('#statisticsFilters summary').click();
  await page.getByLabel('Минимум оценок').selectOption('5');
  await expect(page.locator('.statistics-list')).toContainText('пока нет оценок');
});

test('запоздавший ответ поиска не заменяет новые результаты',async({page})=>{
  await page.goto(`/profile/${user}?__e2e=1`);
  await expect(page.locator('#diaryPage')).toHaveText('1–8 из 18');
  await page.evaluate(()=>{const original=window.__FOOTBAZED_TEST_CLIENT__.rpc;window.__FOOTBAZED_TEST_CLIENT__.rpc=async(name,args)=>{const result=await original(name,args);if(name==='get_profile_diary'&&args.p_filters.query==='Real')await new Promise(r=>setTimeout(r,900));return result;};});
  const search=page.getByRole('searchbox',{name:'Найти оценённый матч'});
  await search.fill('Real');
  await expect(page.locator('#diaryList')).toHaveAttribute('aria-busy','true');
  await search.fill('Brighton');
  await expect(page.locator('#diaryList .rh-row')).toHaveCount(1);
  await page.waitForTimeout(1000);
  await expect(page.locator('#diaryList')).toContainText('Brighton');
  await expect(page.locator('#diaryPage')).toHaveText('1–1 из 1');
});

for(const width of [360,390,1440])test(`обзор и дневник без переполнения при ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  for(const route of ['/discover',`/profile/${user}`]){
    await page.goto(route+'?__e2e=1');
    await expect(page.locator(route==='/discover'?'.statistics-row':'#diaryList .rh-row').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  }
});
