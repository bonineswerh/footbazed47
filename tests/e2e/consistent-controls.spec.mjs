import {test,expect} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
test.use({timezoneId:'Europe/Moscow'});
async function start(page,path='/matches',overrides={}){
  await page.clock.setFixedTime(new Date('2026-10-09T12:00:00Z'));
  await installSupabaseMock(page,overrides);await page.goto(path+'?__e2e=1');
}
test('calendar years follow the full catalogue, cap future years and block every boundary input',async({page})=>{
  await start(page,'/matches',{calendarDates:['2026-08-29T12:00:00Z','2026-10-21T19:00:00Z','2027-02-01T19:00:00Z']});
  await expect.poll(()=>page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.rangeCalls().length)).toBe(2);
  await page.getByRole('button',{name:'Выбрать дату',exact:true}).click();await page.locator('#calendarPeriodTrigger').click();
  await expect(page.locator('#calendarPeriodYears button')).toHaveCount(1);await expect(page.locator('#calendarYearsRange')).toHaveText('2026');
  await expect(page.locator('#calendarPeriodYears button')).toHaveText('2026');await page.locator('[data-period-month="11"]').click();await page.getByRole('button',{name:'Показать месяц',exact:true}).click();
  await expect(page.getByRole('button',{name:'Следующий месяц',exact:true})).toBeDisabled();
  const last=page.locator('[data-picker-day="2026-12-31"]');await last.focus();await page.keyboard.press('ArrowRight');await expect(last).toBeFocused();
  await expect(page.locator('[data-picker-day="2027-01-01"]')).toBeDisabled();
  for(const date of ['01.01.2027','31.12.2025']){await page.locator('#matchDay').fill(date);await page.locator('#matchDay').press('Enter');await expect(page.locator('#calendarExactError')).toContainText('2026–2026');await expect(page.locator('#calendarDateOv')).toBeVisible();}
  expect(await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.calls())).toHaveLength(0);
  await page.locator('#matchDay').fill('31.12.2026');await page.locator('#matchDay').press('Enter');await expect(page).toHaveURL(/m_day=2026-12-31/);await expect(page.getByRole('button',{name:'Следующий день',exact:true})).toBeDisabled();
  const reads=await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.rangeCalls());expect(reads).toEqual([{fields:'match_date',limit:1,order:{column:'match_date',ascending:true}},{fields:'match_date',limit:1,order:{column:'match_date',ascending:false}}]);
});
test('failed coverage offers a real retry and reveals historical years without changing the filter',async({page})=>{
  await start(page,'/matches',{calendarRangeError:true});await page.getByRole('button',{name:'Выбрать дату',exact:true}).click();
  await expect(page.locator('#calendarRangeStatus')).toContainText('Не удалось');
  await page.locator('#matchDay').fill('01.08.2016');
  await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.rangeError(false));await page.locator('#calendarRangeStatus button').click();
  await expect(page.locator('#calendarRangeStatus')).toBeHidden();await expect(page.locator('#matchDay')).toHaveValue('01.08.2016');
  await page.locator('#calendarPeriodTrigger').click();await expect(page.locator('#calendarYearsRange')).toHaveText('2016–2026');await expect(page.locator('[data-period-year="2027"]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.calls())).toHaveLength(0);
});
test('failed shared styles are retryable even when the domain script is already ready',async({page})=>{
  let blocked=false;await page.route('**/css/interaction-patterns.css?*',async route=>{if(!blocked){blocked=true;await route.abort();}else await route.continue();});
  await start(page,'/discover');await expect(page.locator('#statisticsRoot')).toContainText('Не удалось загрузить обзор');await expect(page.locator('#interactionStyles')).toHaveCount(0);
  await page.locator('#statisticsRoot').getByRole('button',{name:'Повторить',exact:true}).click();await expect(page.locator('.statistics-row').first()).toBeVisible();await expect(page.locator('#interactionStyles')).toHaveAttribute('data-loaded','true');
  await expect(page.locator('script[src*="js/statistics.js"]')).toHaveCount(1);await expect(page.locator('#interactionStyles')).toHaveCount(1);
});
test('feed club hover fits the name and mark, leaves the score clickable and likes restore cleanly',async({page})=>{
  await start(page,'/feed');const team=page.locator('button.feed-team.away').first();await expect(team).toBeVisible();await team.hover();
  const geometry=await team.evaluate(el=>({target:el.getBoundingClientRect().width,column:el.parentElement.getBoundingClientRect().width,padding:getComputedStyle(el).paddingLeft,border:getComputedStyle(el).borderTopWidth}));
  expect(geometry.target).toBeLessThan(geometry.column/2);expect(geometry.padding).toBe('8px');expect(geometry.border).toBe('1px');
  const like=page.locator('.like-action:not([disabled])').first();const count=Number(await like.locator('span').textContent());
  await like.click();await expect(like).toHaveAttribute('aria-pressed','true');await expect(like.locator('span')).toHaveText(String(count+1));
  await page.mouse.move(0,0);
  await expect(like).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  const selected=await like.evaluate(el=>[getComputedStyle(el.querySelector('.ico')).color,getComputedStyle(el.querySelector('span')).color,getComputedStyle(document.body).getPropertyValue('--rating-low').trim()]);
  expect(selected[0]).toBe(selected[1]);expect(selected[0]).not.toBe('rgb(255, 255, 255)');await expect(like.locator('small')).toHaveCount(0);
  await like.click();await expect(like).toHaveAttribute('aria-pressed','false');await expect(like.locator('span')).toHaveText(String(count));await expect(like).toHaveAttribute('aria-label','Поставить лайк');
  const score=page.locator('.feed-score').first(),href=await score.getAttribute('href');await score.click();await expect(page).toHaveURL(new RegExp(href.split('?')[0]));
  await page.goto('/feed?__e2e=1');const club=page.locator('button.feed-team.away').first();await club.click();await expect(page).toHaveURL(/\/club\//);
});
test('late calendar coverage preserves editing and day focus, and cannot reopen a departed route',async({page})=>{
  await start(page,'/matches',{calendarRangeDelay:900});await page.getByRole('button',{name:'Выбрать дату',exact:true}).click();
  await page.locator('#matchDay').fill('01.08.2016');await page.locator('[data-picker-day="2026-10-09"]').focus();
  await expect(page.locator('#calendarRangeStatus')).toBeHidden();await expect(page.locator('#matchDay')).toHaveValue('01.08.2016');await expect(page.locator('[data-picker-day="2026-10-09"]')).toBeFocused();
  await page.keyboard.press('Escape');await page.goto('/matches?__e2e=1');await page.getByRole('button',{name:'Главная',exact:true}).first().click();
  await expect(page.locator('#page-home')).toHaveClass(/on/);await page.waitForTimeout(1000);await expect(page.locator('#page-home')).toHaveClass(/on/);await expect(page.locator('#calendarDateOv')).toBeHidden();
});
for(const theme of ['dark','light'])for(const accent of ['ice','emerald','gold','mono'])test(`selection patterns match across lazy screens: ${theme} ${accent}`,async({page})=>{
  await page.addInitScript(value=>localStorage.setItem('fbz_appearance',JSON.stringify(value)),{theme,accent});await start(page,'/feed');
  const style=el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,border:s.borderTopColor,radius:s.borderRadius,color:s.color,shadow:s.boxShadow,weight:s.fontWeight};};
  const first=page.locator('.feed-filter.on');await expect(first).toBeVisible();await expect(page.locator('#interactionStyles')).toHaveAttribute('data-loaded','true');await first.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));const expected=await first.evaluate(style);
  for(const [path,selector] of [['/friends','.ftab2.on'],['/discover','.statistics-tabs:not(.statistics-participation) button[aria-pressed="true"]'],['/club/24','.entity-tabs button[aria-selected="true"]']]){
    await page.goto(path+'?__e2e=1');const selected=page.locator(selector).first();await expect(selected).toBeVisible();await expect.poll(()=>selected.evaluate(style)).toEqual(expected);
    await selected.focus();await expect(selected).toHaveCSS('outline-style','solid');await expect(selected).toHaveCSS('outline-width','2px');
  }
});
for(const width of [320,390,1440])test(`compact club links and supporter mark remain clear at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:850});await start(page,'/feed');await expect(page.locator('.feed-entry').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await info.attach('feed.png',{body:await page.screenshot({path:info.outputPath('feed.png')}),contentType:'image/png'});
  await page.goto('/matches?__e2e=1');await page.locator('#matchG .mc-acts .mbtn').first().click();
  const mark=page.locator('.supporter-neutral-mark');await expect(mark.locator('svg')).toHaveCSS('width','24px');
  const colors=await mark.evaluate(el=>({color:getComputedStyle(el).color,fill:getComputedStyle(el.querySelector('svg')).fill,background:getComputedStyle(el).backgroundColor}));expect(colors.fill).toBe(colors.color);expect(colors.fill).not.toBe(colors.background);
  await expect(mark.locator('circle')).toHaveCount(1);await expect(mark.locator('path')).toHaveCount(1);
  const bounds=await page.locator('.rating-supporter-options').evaluate(el=>({width:el.clientWidth,content:el.scrollWidth}));expect(bounds.content).toBeLessThanOrEqual(bounds.width);
  await info.attach('supporter.png',{body:await page.locator('#rateOv').screenshot({path:info.outputPath('supporter.png')}),contentType:'image/png'});
});
