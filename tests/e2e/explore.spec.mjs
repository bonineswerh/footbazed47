import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const user='3615141a-7700-46b8-9ba5-e4f4450537fc';
const diary=Array.from({length:18},(_,i)=>({id:200+i,user_id:user,match_id:101,competition_id:i<9?8:9,home_club_id:i===0?230:24,away_club_id:1000+i,match_rating:i<9?9:7,is_public:i!==0,created_at:'2026-09-20T12:00:00Z',home_team_name:i===0?'Brighton':'Real Madrid',away_team_name:'Opponent '+i,league_name:i<9?'La Liga':'Premier League',match_date:`2026-09-${String(i+1).padStart(2,'0')}T19:00:00Z`,home_score:2,away_score:1}));
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
  await page.locator('#diaryFilters-open').click();
  await page.locator('#diaryFilters-competition_id').selectOption('8');
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
  await expect(page.locator('.statistics-row')).toContainText('Лига чемпионов');
  await page.locator('#statisticsFilters-open').click();
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
  await expect(page.locator('#diaryList')).toContainText('Брайтон');
  await expect(page.locator('#diaryPage')).toHaveText('1–1 из 1');
});

for(const width of [320,360,390,844,1440,2560,3840])test(`обзор и дневник без переполнения при ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  for(const route of ['/discover',`/profile/${user}`]){
    await page.goto(route+'?__e2e=1');
    await expect(page.locator(route==='/discover'?'.statistics-row':'#diaryList .rh-row').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  }
});

test('клубы зависят от турнира, поиск вариантов не меняет выборку и URL восстанавливается',async({page})=>{
  await page.goto('/discover?__e2e=1');
  await expect(page.locator('.statistics-row')).toHaveCount(1);
  await page.locator('#statisticsFilters-open').click();
  await page.getByLabel('Клуб',{exact:true}).selectOption('31');
  await page.getByLabel('Турнир',{exact:true}).selectOption('8');
  await expect(page.getByLabel('Клуб',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Клуб',{exact:true}).locator('option[value="31"]')).toHaveCount(0);
  await page.getByRole('searchbox',{name:'Найти клуб в фильтрах'}).fill('barc');
  await expect(page.getByLabel('Клуб',{exact:true}).locator('option')).toHaveCount(2);
  await page.getByLabel('Клуб',{exact:true}).selectOption('25');
  await page.getByRole('button',{name:'Готово'}).click();
  await expect(page).toHaveURL(/ov_competition_id=8.*ov_club_id=25/);
  await expect(page.getByRole('button',{name:'Убрать фильтр Клуб: Барселона'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'Убрать фильтр Клуб: Барселона'})).toBeVisible();
  await page.getByRole('button',{name:'Убрать фильтр Клуб: Барселона'}).click();
  await expect(page).not.toHaveURL(/ov_club_id/);
  await page.goBack();
  await expect(page.getByRole('button',{name:'Убрать фильтр Клуб: Барселона'})).toBeVisible();
});

test('месячная сводка учитывает всю историю, включая записи на следующих страницах',async({page})=>{
  await page.goto(`/profile/${user}?__e2e=1`);
  await expect(page.locator('.diary-month-head')).toContainText('18 матчей · средняя оценка 8.0');
  await expect(page.locator('#diaryList .rh-row')).toHaveCount(8);
  await page.locator('#diaryNext').click();
  await expect(page.locator('.diary-month-head')).toContainText('18 матчей · средняя оценка 8.0');
});

test('мобильные фильтры возвращают фокус, обрабатывают Escape и неизвестный ID честно',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto('/discover?__e2e=1&ov_club_id=999');
  await expect(page.locator('#statisticsList')).toContainText('пока нет оценок');
  await page.locator('#statisticsFilters-open').click();
  await expect(page.getByRole('dialog',{name:'Фильтры'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Готово'})).toBeInViewport();
  await expect(page.getByRole('button',{name:'Закрыть фильтры'})).toBeInViewport();
  expect(await page.getByRole('button',{name:'Готово'}).evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));})).toBe(true);
  await page.getByLabel('Клуб',{exact:true}).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'Фильтры'})).toBeHidden();
  await expect(page.locator('#statisticsFilters-open')).toBeFocused();
  await page.getByRole('button',{name:'Убрать фильтр Клуб: 999'}).click();
  await expect(page.locator('.statistics-row')).toHaveCount(1);
});

test('история браузера закрывает фильтры, а ошибочное число можно сбросить',async({page})=>{
  await page.goto(`/profile/${user}?__e2e=1`);
  await expect(page.locator('#diaryPage')).toHaveText('1–8 из 18');
  await page.locator('#diaryFilters-open').click();
  await page.getByLabel('Оценка от',{exact:true}).fill('11');
  await expect(page.locator('.explore-validation')).toBeVisible();
  await expect(page.getByRole('button',{name:'Сбросить',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Сбросить',exact:true}).click();
  await expect(page.getByLabel('Оценка от',{exact:true})).toHaveValue('');
  await page.getByLabel('Турнир',{exact:true}).selectOption('8');
  await expect(page).toHaveURL(/di_competition_id=8/);
  await page.goBack();
  await expect(page.locator('#diaryFilters-sheet')).not.toHaveClass(/on/);
  await expect(page.locator('body')).not.toHaveClass(/modal-open/);
  await expect(page.locator('#diaryPage')).toHaveText('1–8 из 18');
});
