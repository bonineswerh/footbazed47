import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

test.beforeEach(async({page})=>{await installSupabaseMock(page);});

test('unavailable historical lineup preserves existing player scores while allowing review edits',async({page})=>{
  await installSupabaseMock(page,{lineup:{available:false,players:[]}});
  await page.goto('/match/101?__e2e=1');await page.locator('.md-primary-action').click();
  await page.getByRole('button',{name:/Продолжить/}).click();
  await expect(page.locator('#rPlayers')).toContainText('Состав этого матча пока недоступен');
  await expect(page.locator('.rating-player')).toHaveCount(0);
  await expect(page.locator('.rating-legacy')).toContainText('Thibaut Courtois');
  await page.locator('#rCmt').fill('Edited review with legacy scores');await page.locator('#rSave').click();
  const payload=await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.lastRating());
  expect(payload.p_player_ratings).toEqual([{player_id:5290,rating:9,is_best_player:true},{player_id:5292,rating:8,is_best_player:false}]);
  expect(payload.p_comment).toBe('Edited review with legacy scores');
});

test('lineup read failure offers retry without disabling match ratings or querying the club squad',async({page})=>{
  await installSupabaseMock(page,{lineupError:true});
  await page.goto('/match/101?__e2e=1');await page.locator('.md-primary-action').click();
  await page.getByRole('button',{name:/Продолжить/}).click();
  await expect(page.getByRole('button',{name:'Повторить загрузку состава'})).toBeVisible();
  await expect(page.locator('#rSave')).toBeEnabled();
  await page.getByRole('button',{name:'Повторить загрузку состава'}).click();
  await expect(page.locator('.rating-legacy li')).toHaveCount(2);
  await page.locator('#rSave').click();
  expect((await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.lastRating())).p_player_ratings).toHaveLength(2);
});

test('removing a legacy player score is an explicit draft change and preserves the other score',async({page})=>{
  await installSupabaseMock(page,{lineup:{available:false,players:[]}});
  await page.goto('/match/101?__e2e=1');await page.locator('.md-primary-action').click();
  await page.getByRole('button',{name:/Продолжить/}).click();
  await page.getByRole('button',{name:'Убрать ранее сохранённую оценку Thibaut Courtois'}).click();
  await expect(page.locator('.rating-legacy li')).toHaveCount(1);await page.locator('#rSave').click();
  expect((await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.lastRating())).p_player_ratings).toEqual([{player_id:5292,rating:8,is_best_player:false}]);
});

test('rating CSS can be retried without bypassing the loader or duplicating JavaScript',async({page})=>{
  let styles=0,scripts=0;
  await page.route('**/css/ratings.css*',route=>++styles===1?route.abort():route.continue());
  page.on('request',request=>{if(new URL(request.url()).pathname==='/js/ratings.js')scripts++;});
  await page.goto('/match/101?__e2e=1');
  await page.locator('.md-primary-action').click();
  await expect(page.locator('#toast')).toContainText('Не удалось открыть форму оценки');
  await expect(page.locator('#rateOv')).toBeHidden();
  await page.locator('.md-primary-action').click();
  await expect(page.locator('#rScoreDisp')).toHaveText('8/10');
  await expect(page.locator('#ratingsStyles')).toHaveAttribute('data-loaded','true');
  expect(styles).toBe(2);
  expect(scripts).toBe(1);
});

test('match rail, direct choices and reset share one draft without assuming a default rating',async({page})=>{
  const assets=[];
  page.on('request',request=>assets.push(new URL(request.url()).pathname));
  await page.goto('/match/101?__e2e=1');
  await expect(page.locator('.md-primary-action')).toBeVisible();
  expect(assets).not.toContain('/css/ratings.css');
  await page.locator('.md-primary-action').click();
  const rail=page.getByRole('slider',{name:'Оценка матча от 1 до 10',exact:true});
  await expect(rail).toHaveValue('8');
  expect(assets).toContain('/css/ratings.css');
  await page.getByRole('button',{name:'Сбросить оценку матча'}).click();
  await expect(page.locator('#rScoreDisp')).toHaveText('—');
  await expect(rail).toHaveValue('0');
  await expect(rail).toHaveAttribute('data-selected','false');
  await page.getByRole('button',{name:/Продолжить/}).click();
  await expect(page.locator('#rS2')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('Выберите оценку');
  // Zero is an empty draft, never an implicit vote or a stored score.
  await rail.press('Enter');
  await expect(page.locator('#rScoreDisp')).toHaveText('—');
  for(let step=0;step<5;step++)await rail.press('ArrowRight');
  await expect(page.locator('#rScoreDisp')).toHaveText('5/10');
  await expect(rail).toHaveAttribute('aria-valuetext','5 из 10 — Средне');
  await page.getByRole('button',{name:'9 из 10 — Великолепно',exact:true}).click();
  await expect(rail).toHaveValue('9');
  await expect(rail).toHaveAttribute('data-tone','elite');
  await rail.press('End');
  await expect(page.getByRole('button',{name:'10 из 10 — Исключительно',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:/Продолжить/}).click();
  await page.locator('#rSave').click();
  expect((await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.lastRating())).p_match_rating).toBe(10);
});

test('an unrated player can explicitly receive 5 and clearing also removes the best player vote',async({page})=>{
  await page.goto('/match/101?__e2e=1');
  await page.locator('.md-primary-action').click();
  await page.getByRole('button',{name:/Продолжить/}).click();
  await page.locator('#rating-player-5291').click();
  const rail=page.getByRole('slider',{name:'Оценка игрока от 1 до 10',exact:true});
  await expect(page.locator('#playerRatingValue')).toHaveText('—');
  await expect(page.locator('#playerBestButton')).toBeDisabled();
  await rail.press('Enter');
  await expect(page.locator('#playerRatingValue')).toHaveText('—');
  for(let step=0;step<5;step++)await rail.press('ArrowRight');
  await expect(page.locator('#playerRatingValue')).toHaveText('5/10');
  await page.locator('#playerBestButton').click();
  await expect(page.locator('#rating-player-5291')).toHaveClass(/is-best/);
  await page.locator('.player-rating-clear').click();
  await expect(page.locator('#playerRatingValue')).toHaveText('—');
  await expect(rail).toHaveAttribute('data-selected','false');
  await expect(page.locator('#playerBestButton')).toBeDisabled();
  await expect(page.locator('#rating-player-5291')).not.toHaveClass(/is-best/);
  await page.getByRole('button',{name:'Готово',exact:true}).click();
  await page.locator('#rSave').click();
  const payload=await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.lastRating());
  expect(payload.p_player_ratings.some(item=>item.player_id===5291)).toBe(false);
  expect(payload.p_player_ratings.every(item=>!item.is_best_player)).toBe(true);
});

for(const theme of ['dark','light'])test(`${theme}: narrow screens keep the next action visible and player names readable`,async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),theme);
  await page.goto('/match/101?__e2e=1');
  await page.locator('.md-primary-action').click();
  await expect(page.getByRole('button',{name:/Продолжить/})).toBeInViewport();
  expect((await page.locator('#matchRatingRange').boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button',{name:/Продолжить/}).click();
  const player=page.locator('#rating-player-5292');
  const style=await player.evaluate(element=>({
    nameSize:parseFloat(getComputedStyle(element.querySelector('.rating-player-name')).fontSize),
    nameDisplay:getComputedStyle(element.querySelector('.rating-player-name')).display,
    color:getComputedStyle(element.querySelector('.rating-player-score')).color,
    background:getComputedStyle(element.querySelector('.rating-player-score')).backgroundColor
  }));
  expect(style.nameSize).toBeGreaterThanOrEqual(14);
  expect(style.nameDisplay).toBe('block');
  expect(style.color).not.toBe(style.background);
  expect((await player.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await player.click();
  expect((await page.locator('#playerRatingRange').boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.locator('#playerRatingRange').press('End');
  await expect(page.locator('#playerRatingValue')).toHaveText('10/10');
  await page.locator('#playerRatingRange').press('ArrowLeft');
  await expect(page.locator('#playerRatingValue')).toHaveText('9/10');
  await expect(player).toHaveAttribute('data-tone','elite');
  await page.getByRole('button',{name:'Готово',exact:true}).click();
  await page.getByRole('button',{name:'Назад',exact:true}).click();
  expect(await page.locator('.rate-box').evaluate(element=>element.scrollTop)).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});
