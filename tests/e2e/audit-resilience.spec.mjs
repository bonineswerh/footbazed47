import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

test('отложенный фокус диалога не забирает фокус у выбранной шкалы оценки',async({page})=>{
  await page.goto('/match/101?__e2e=1');
  await page.locator('.md-primary-action').click();await expect(page.locator('#rateOv')).toBeVisible();await expect(page.locator('#matchRatingRange')).toBeEnabled();
  await page.clock.install();
  await page.evaluate(()=>{FBZOverlay.close('rateOv');FBZOverlay.open('rateOv','.rate-close');document.getElementById('matchRatingRange').focus();});
  await page.clock.runFor(100);await expect(page.locator('#matchRatingRange')).toBeFocused();
});

test.beforeEach(async({page})=>{await installSupabaseMock(page);});

test('failed feature CSS can be retried without duplicate JavaScript',async({page})=>{
  let css=0,js=0;
  await page.route('**/css/entities.css*',route=>++css===1?route.abort():route.continue());
  page.on('request',r=>{if(r.url().includes('/js/entities.js'))js++;});
  await page.goto('/club/24?__e2e=1');
  await expect(page.getByText('Не удалось загрузить раздел',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.locator('.entity-hero h1')).toHaveText('Реал Мадрид');
  await expect(page.locator('#entityStyles')).toHaveAttribute('data-loaded','true');
  expect(css).toBe(2);expect(js).toBe(1);
});

test('invalid first filter can be reset and stale counts disappear on failure',async({page})=>{
  await page.goto('/discover?__e2e=1');
  await expect(page.locator('.statistics-row')).toHaveCount(1);
  await page.locator('#statisticsFilters-open').click();
  await page.getByLabel('Матчи с',{exact:true}).fill('2026-09-20');
  await page.getByLabel('Матчи по',{exact:true}).fill('2026-09-01');
  await expect(page.locator('.explore-validation')).toContainText('Начало периода');
  await expect(page.getByRole('button',{name:'Сбросить фильтры'})).toBeEnabled();
  await expect(page.locator('#statisticsList')).toHaveAttribute('aria-busy','false');
  await page.getByRole('button',{name:'Закрыть фильтры'}).click();
  await page.getByRole('button',{name:'Клубы',exact:true}).click();
  await expect(page.locator('#statisticsList')).toBeEmpty();
  await expect(page.locator('.explore-validation')).toContainText('Начало периода');
  await page.getByRole('button',{name:'Сбросить фильтры'}).click();
  await expect(page.locator('.statistics-row')).toHaveCount(2);
  await expect(page.locator('.explore-validation')).toBeHidden();
  await page.evaluate(()=>{const original=sb.rpc.bind(sb);sb.rpc=(name,args)=>name==='get_football_statistics'?Promise.resolve({error:{message:'offline'}}):original(name,args);});
  await page.getByRole('searchbox',{name:'Поиск в обзоре'}).fill('Real');
  await expect(page.locator('#statisticsError')).toContainText('Не удалось загрузить обзор');
  await expect(page.locator('#statisticsCount')).toBeEmpty();
  await expect(page.locator('#statisticsSummary')).toBeEmpty();
  await expect(page.locator('#statisticsNext')).toBeDisabled();
});

test('an unrated player has no phantom null score and cannot be chosen best',async({page})=>{
  await page.goto('/match/101?__e2e=1');
  await page.locator('.md-primary-action').click();
  await page.getByRole('button',{name:/Продолжить/}).click();
  await page.locator('#rating-player-5292').click();
  await page.locator('.player-rating-clear').click();
  await expect(page.locator('#playerRatingValue')).toHaveText('—');
  await expect(page.locator('#playerBestButton')).toBeDisabled();
  await expect(page.locator('#playerRatingRange')).toHaveAttribute('aria-valuetext',/Оценка не выбрана/);
  await page.locator('#playerRatingRange').press('End');
  await expect(page.locator('#playerBestButton')).toBeEnabled();
});

test('keyboard skip link reaches content instead of every navigation item',async({page})=>{
  await page.goto('/?__e2e=1');
  await expect(page.locator('#homeDashboardTitle')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('#skipContent')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#page-home')).toBeFocused();
});

test('predictions reject fractional scores and ignore a late result after navigation',async({page})=>{
  await page.goto('/match/102?__e2e=1');
  const home=page.locator('.pred-input[data-side="home"]'),away=page.locator('.pred-input[data-side="away"]');
  await home.fill('1.5');await away.fill('0');
  await page.locator('.pred-btn').click();
  await expect(page.getByText('Введите корректный счёт',{exact:true})).toBeVisible();
  await expect(page.locator('.pred-btn')).toBeEnabled();
  await page.evaluate(()=>{
    const from=sb.from.bind(sb);
    sb.from=name=>name==='predictions'?{upsert:()=>new Promise(resolve=>{window.finishPrediction=()=>resolve({error:null});})}:from(name);
  });
  await home.fill('2');await page.locator('.pred-btn').click();
  await expect(page.locator('.pred-btn')).toBeDisabled();
  await page.getByRole('button',{name:'Главная',exact:true}).click();
  await expect(page.locator('#homeDashboardTitle')).toBeVisible();
  await page.evaluate(()=>window.finishPrediction());
  await expect(page.getByText('Прогноз сохранён',{exact:true})).toHaveCount(0);
});
