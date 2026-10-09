import {test,expect} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
const own='3615141a-7700-46b8-9ba5-e4f4450537fc';
test.use({timezoneId:'Europe/Moscow'});
async function start(page,path='/matches',overrides={}){await installSupabaseMock(page,overrides);await page.goto(path+'?__e2e=1');}
test('notifications dismiss individually, survive reopening and undo without changing friendship',async({page})=>{
  await start(page);await page.locator('#notifBtn').click();await expect(page.locator('.notif-dismiss')).toHaveCount(2);
  const first=await page.locator('.notif-item').first().getAttribute('data-notification-id');
  await page.locator('.notif-dismiss').first().click();await expect(page.locator('.notif-item')).toHaveCount(1);await expect(page.locator('#notifBadge')).toHaveText('1');
  await expect(page.locator('.notif-dismiss')).toBeFocused();
  await page.keyboard.press('Escape');await page.locator('#notifBtn').click();await expect(page.locator('.notif-item')).toHaveCount(1);
  await expect(page.locator(`.notif-item[data-notification-id="${first}"]`)).toHaveCount(0);
  await page.locator('#notifRestore').click();await expect(page.locator('.notif-item')).toHaveCount(2);await expect(page.locator('#notifBadge')).toHaveText('2');
  await page.locator('.notif-item[data-notification-id="901"] .notif-dismiss').click();await expect(page.locator('.notif-item')).toHaveCount(1);
  await page.keyboard.press('Escape');await page.goto('/friends?__e2e=1');await page.getByRole('button',{name:/Входящие/}).click();await expect(page.locator('#page-friends')).toContainText('natasha');
});
test('failed notification cleanup retains the event and confirmed badge',async({page})=>{
  await start(page);await page.locator('#notifBtn').click();await expect(page.locator('.notif-item')).toHaveCount(2);
  await page.evaluate(()=>{const original=sb.rpc.bind(sb);sb.rpc=(name,args)=>name==='set_notification_dismissed'?Promise.resolve({error:{message:'offline'}}):original(name,args);});
  await page.locator('.notif-dismiss').first().click();await expect(page.locator('#toast')).toContainText('Не удалось');await expect(page.locator('.notif-item')).toHaveCount(2);await expect(page.locator('#notifBadge')).toHaveText('2');await expect(page.locator('.notif-dismiss').first()).toBeEnabled();
});
test('calendar period browser does not fetch; exact entry validates and selects the precise day',async({page})=>{
  await start(page);await page.getByRole('button',{name:'Выбрать дату',exact:true}).click();
  await page.locator('#calendarPeriodTrigger').click();await expect(page.locator('#calendarMonthPicker')).toBeVisible();
  await page.locator('[data-period-year="2016"]').click();await page.locator('[data-period-month="7"]').click();
  await page.getByRole('button',{name:'Показать месяц',exact:true}).click();await expect(page.locator('#calendarMonthLabel')).toContainText('2016');await expect(page.locator('#calendarMonthLabel')).toContainText('август');
  expect(await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.calls())).toHaveLength(0);
  await page.locator('#calendarPeriodTrigger').click();await page.keyboard.press('Escape');await expect(page.locator('#calendarDateOv')).toBeVisible();await expect(page.locator('#calendarMonthPicker')).toBeHidden();await expect(page.locator('#calendarPeriodTrigger')).toBeFocused();
  await expect(page.locator('#matchDay')).toHaveAttribute('type','text');await page.locator('#matchDay').fill('31.02.2016');await page.locator('#matchDay').press('Enter');await expect(page.locator('#calendarExactError')).toBeVisible();await expect(page.locator('#calendarDateOv')).toBeVisible();
  await page.locator('#matchDay').fill('01.08.2016');await page.locator('#matchDay').press('Enter');await expect(page.locator('#calendarDateOv')).toBeHidden();await expect(page).toHaveURL(/m_day=2016-08-01/);await expect(page.locator('.calendar-caption')).toContainText('1 августа 2016');
  const calls=await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.calls());expect(calls.at(-1).p_filters).toMatchObject({from:'2016-07-31T21:00:00.000Z',until:'2016-08-01T21:00:00.000Z'});
});
test('liked state colors the heart and label while retaining the neutral surface',async({page})=>{
  await start(page,'/feed');const button=page.locator('.like-action:not([disabled])').first();await expect(button).toBeVisible();
  const surface=()=>button.evaluate(el=>({background:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderColor,color:getComputedStyle(el).color}));
  await page.mouse.move(0,0);const before=await surface();await button.click();await expect(button).toHaveAttribute('aria-pressed','true');await page.mouse.move(0,0);await expect.poll(surface).toEqual(before);
  expect(await button.locator('.ico').evaluate(el=>getComputedStyle(el).color)).toBe(await button.locator('small').evaluate(el=>getComputedStyle(el).color));
});
test('profile prioritizes the diary and histogram opens exact rating records',async({page})=>{
  await start(page,'/profile/'+own);await expect(page.locator('#diaryList .rh-row').first()).toBeVisible();
  await expect(page.locator('.pgrid>div').first()).toContainText('История оценок');expect(await page.locator('.pgrid>div').first().locator('#profileInsightsTitle').count()).toBe(0);
  const bucket=page.locator('button.prdist-row:not([disabled])').first(),value=JSON.parse(await bucket.getAttribute('data-fbz-args'))[0];await bucket.click();
  await expect(page).toHaveURL(new RegExp('di_min_rating='+value));await expect(page).toHaveURL(new RegExp('di_max_rating='+value));await expect(page.locator('#diaryTitle')).toBeFocused();
  await expect(page.locator('#diaryList .rh-v').first()).toContainText(String(value));
});
test('overview quick sample threshold is sent to the server and survives refresh',async({page})=>{
  await start(page,'/discover');await expect(page.locator('.statistics-row').first()).toBeVisible();
  await page.locator('[data-statistics-votes="5"]').click();await expect(page).toHaveURL(/ov_min_votes=5/);await expect(page.locator('[data-statistics-votes="5"]')).toHaveAttribute('aria-pressed','true');
  await page.reload();await expect(page.locator('[data-statistics-votes="5"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#statisticsFilters-min_votes')).toHaveValue('5');
});
test('rating and expectation use club crests; hover lifts the button without darkening it',async({page})=>{
  const url='https://media.api-sports.io/football/teams/50.png',asset={asset_type:'club_logo',usage_status:'identification',source_provider:'api-football',url};
  await page.route(url,route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="blue"/></svg>'}));
  await start(page,'/matches',{clubMarks:[{id:24,name:'Real Madrid CF',media:asset},{id:31,name:'Manchester City FC',media:asset}]});
  const button=page.locator('#matchG .mc-acts .mbtn').first();await expect(button).toBeVisible();const gradient=await button.evaluate(el=>getComputedStyle(el).backgroundImage);
  await button.hover();await expect.poll(()=>button.evaluate(el=>getComputedStyle(el).transform)).not.toBe('none');expect(await button.evaluate(el=>getComputedStyle(el).backgroundImage)).toBe(gradient);
  await button.click();await expect(page.locator('#rSupportHomeMark img')).toBeVisible();await expect(page.locator('#rSupportAwayMark img')).toBeVisible();await expect(page.locator('input[value="neutral"]+span>i svg')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});await button.hover();await expect(button).toHaveCSS('transform','none');
  await start(page,'/matches',{clubMarks:[{id:24,name:'Real Madrid CF',media:asset},{id:31,name:'Manchester City FC',media:asset}],matches:[{id:101,league_name:'Champions League',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',home_club_id:24,away_club_id:31,status:'scheduled',match_date:'2099-08-01T20:00:00Z',home_score:null,away_score:null}]});
  await page.getByRole('button',{name:'Ожидание',exact:true}).click();await expect(page.locator('#rateTitle')).toHaveText('Оценить ожидание');await expect(page.locator('#rSupportHomeMark img')).toBeVisible();await expect(page.locator('#rSupportAwayMark img')).toBeVisible();
});
for(const theme of ['dark','light'])for(const width of [320,390,1440])test(`community controls fit, remain readable and support keyboard: ${theme} ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:850});await page.addInitScript(value=>localStorage.setItem('fbz_appearance',JSON.stringify({theme:value,accent:'ice'})),theme);await start(page);
  const avatar=page.locator('.account-trigger .nav-av');await expect(avatar).toBeVisible();const shape=await avatar.evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,radius:getComputedStyle(el).borderRadius,border:getComputedStyle(el).borderTopWidth}));expect(shape.width).toBe(32);expect(shape.height).toBe(32);expect(shape.radius).toBe('50%');expect(parseFloat(shape.border)).toBeGreaterThan(0);
  await page.locator('#notifBtn').click();await expect(page.locator('.notif-dismiss')).toHaveCount(2);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Выбрать дату',exact:true}).click();await page.locator('#calendarPeriodTrigger').click();await expect(page.locator('#calendarPeriodYears')).toBeVisible();
  await expect(page.locator('#calendarPeriodMonths button[aria-pressed="true"]')).toBeInViewport();
  const bounds=await page.locator('.calendar-panel').evaluate(el=>({width:el.clientWidth,content:el.scrollWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}));expect(bounds.content).toBeLessThanOrEqual(bounds.width);expect(bounds.left).toBeGreaterThanOrEqual(0);expect(bounds.right).toBeLessThanOrEqual(width);
  await info.attach('calendar-period.png',{body:await page.locator('.calendar-panel').screenshot({path:info.outputPath('calendar-period.png')}),contentType:'image/png'});
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});expect(await page.evaluate(async()=> (await axe.run(document.getElementById('calendarDateOv'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.filter(v=>['critical','serious','moderate'].includes(v.impact)).map(v=>v.id))).toEqual([]);
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.goto('/profile/'+own+'?__e2e=1');await expect(page.locator('#diaryList .rh-row').first()).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await info.attach('profile.png',{body:await page.screenshot({path:info.outputPath('profile.png')}),contentType:'image/png'});await page.goto('/discover?__e2e=1');await expect(page.locator('.statistics-row').first()).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);await info.attach('overview.png',{body:await page.screenshot({path:info.outputPath('overview.png')}),contentType:'image/png'});
});
