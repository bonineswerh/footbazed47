import {test,expect} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
test.use({timezoneId:'UTC'});

function fixtures(){
  return Array.from({length:38},(_,i)=>({id:800+i,league_name:'La Liga',home_team_name:i<10?'Other Club':'Real Madrid CF',away_team_name:'Manchester City FC',home_club_id:i<10?99:24,away_club_id:31,match_date:`2099-10-${i===37?'08':'07'}T${String(i%23).padStart(2,'0')}:00:00Z`,status:'finished',home_score:2,away_score:1}));
}
test('calendar date and favorites filter the complete catalogue before paging',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await installSupabaseMock(page,{matches:fixtures()});
  await page.goto('/matches?__e2e=1');
  await expect(page.locator('#matchG .mcard')).toHaveCount(24);
  await page.getByRole('button',{name:'Выбрать дату',exact:true}).click();
  await page.locator('#matchDay').fill('2099-10-07');
  await expect(page.locator('.calendar-caption')).toContainText('7 октября 2099');
  await page.getByRole('button',{name:'Матчи любимых клубов',exact:true}).click();
  await expect(page.locator('.match-results-summary')).toContainText('Показано 24 из 27');
  await expect(page.locator('#matchG')).not.toContainText('Other Club');
  await page.getByRole('button',{name:/Показать ещё/}).click();
  await expect(page.locator('#matchG .mcard')).toHaveCount(27);
  const calls=await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.calls());
  expect(calls.at(-1).p_offset).toBe(24);
  expect(calls.at(-1).p_filters).toMatchObject({favorites_only:true,from:'2099-10-07T00:00:00.000Z',until:'2099-10-08T00:00:00.000Z'});
  await expect(page).toHaveURL(/m_day=2099-10-07.*m_favorites=1/);
  await page.reload();
  await expect(page.locator('.calendar-favorites')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.match-results-summary')).toContainText('из 27');
});
test('date navigation and empty results remain recoverable with keyboard focus',async({page})=>{
  await installSupabaseMock(page,{matches:fixtures()});
  await page.goto('/matches?__e2e=1&m_day=2099-10-07');
  await expect(page.locator('#matchDay')).toHaveValue('2099-10-07');
  await page.getByRole('button',{name:'Следующий день'}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#matchDay')).toHaveValue('2099-10-08');
  await expect(page.getByRole('button',{name:'Следующий день'})).toBeFocused();
  await expect(page.locator('#matchG .mcard')).toHaveCount(1);
  await page.getByRole('button',{name:'Следующий день'}).click();
  await expect(page.locator('#matchG')).toContainText('Матчей не найдено');
  await page.locator('#matchG').getByRole('button',{name:'Все даты'}).click();
  await expect(page.locator('.match-results-summary')).toContainText('из 38');
  await expect(page.locator('#matchDay')).toHaveValue('');
});
test('empty favorites open real club search, guest favorite link asks for sign in',async({page})=>{
  await installSupabaseMock(page,{favoriteClubs:[]});
  await page.goto('/matches?__e2e=1&m_favorites=1');
  await expect(page.locator('#matchG')).toContainText('Выберите любимые клубы');
  await page.getByRole('button',{name:'Найти клуб',exact:true}).click();
  await expect(page.locator('#searchOv')).toBeVisible();
  await installSupabaseMock(page,{sessionUser:null});
  await page.goto('/matches?__e2e=1&m_favorites=1');
  await expect(page.locator('#matchG')).toContainText('Войдите, чтобы увидеть матчи любимых клубов');
  await page.locator('#matchG').getByRole('button',{name:'Войти',exact:true}).click();
  await expect(page.locator('#authOv')).toBeVisible();
  expect(await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.calls())).toHaveLength(0);
});
test('calendar retry preserves selected date and favorites',async({page})=>{
  await installSupabaseMock(page,{matches:fixtures(),calendarError:true});
  await page.goto('/matches?__e2e=1&m_day=2099-10-07&m_favorites=1');
  await expect(page.locator('#matchG')).toContainText('Календарь временно недоступен');
  await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.error(false));
  await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.locator('.match-results-summary')).toContainText('из 27');
  await expect(page.locator('.calendar-favorites')).toHaveAttribute('aria-pressed','true');
});
test('failed continuation keeps the existing page and retries the same offset',async({page})=>{
  await installSupabaseMock(page,{matches:fixtures()});
  await page.goto('/matches?__e2e=1&m_day=2099-10-07&m_favorites=1');
  await expect(page.locator('#matchG .mcard')).toHaveCount(24);
  await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.error(true));
  await page.getByRole('button',{name:/Показать ещё/}).click();
  await expect(page.locator('.load-more')).toHaveText('Повторить');
  await expect(page.locator('#matchG .mcard')).toHaveCount(24);
  await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.error(false));
  await page.locator('.load-more').click();
  await expect(page.locator('#matchG .mcard')).toHaveCount(27);
  const calls=await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.calls());
  expect(calls.slice(-2).map(c=>c.p_offset)).toEqual([24,24]);
});
test('calendar retries failed lazy CSS without duplicating its action handlers',async({page})=>{
  await installSupabaseMock(page);
  let blocked=false;
  await page.route('**/css/calendar.css?*',async route=>{if(!blocked){blocked=true;await route.abort();}else await route.continue();});
  await page.goto('/matches?__e2e=1');
  await expect(page.locator('#matchG')).toContainText('Календарь временно недоступен');
  await page.locator('#matchG').getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.locator('#matchG .mcard')).toHaveCount(2);
  await expect(page.locator('#calendarStyles')).toHaveAttribute('data-loaded','true');
  await page.getByRole('button',{name:'Матчи любимых клубов',exact:true}).click();
  await expect(page.locator('.calendar-favorites')).toHaveAttribute('aria-pressed','true');
});
test('late favorite results cannot repopulate the calendar after logout',async({page})=>{
  await installSupabaseMock(page,{matches:fixtures(),calendarDelay:600});
  await page.goto('/matches?__e2e=1');
  await expect(page.locator('#matchG .mcard')).toHaveCount(24);
  await page.getByRole('button',{name:'Матчи любимых клубов',exact:true}).click();
  await expect(page.locator('#matchG')).toHaveAttribute('aria-busy','true');
  await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.emit('SIGNED_OUT',null));
  await expect(page.locator('#page-home')).toHaveClass(/on/);
  await expect(page.locator('.calendar-favorites')).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Матчи',exact:true}).first().click();
  await expect(page.locator('.match-results-summary')).toContainText('из 38');
  await expect(page.locator('#matchG')).toContainText('Other Club');
  await page.waitForTimeout(700);
  await expect(page.locator('.match-results-summary')).toContainText('из 38');
});
for(const theme of ['dark','light'])for(const width of [320,390,1440])test(`calendar controls fit ${theme} ${width}px with readable text`,async({page},info)=>{
  await installSupabaseMock(page,{matches:fixtures()});
  await page.setViewportSize({width,height:844});
  await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'ice'})),theme);
  await page.goto('/matches?__e2e=1&m_day=2099-10-07');
  await expect(page.locator('#matchG .mcard').first()).toBeVisible();
  await expect(page.locator('.calendar-caption')).toContainText('7 октября');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  for(const button of await page.locator('#matchCalendar button:visible').all()){
    const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.width).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({path:info.outputPath(`calendar-${theme}-${width}.png`)});
  await page.addStyleTag({content:'html{font-size:200%}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('English calendar stays lazy on home and uses localized day controls',async({page})=>{
  await installSupabaseMock(page,{matches:fixtures()});
  await page.goto('/en?__e2e=1');
  await expect(page.locator('.home-spotlight')).toBeVisible();
  expect(await page.locator('script[src*="calendar-model"],script[src*="match-calendar"],#calendarStyles').count()).toBe(0);
  await page.goto('/en/matches?__e2e=1&m_day=2099-10-07');
  await expect(page.getByRole('button',{name:'Favourite club matches',exact:true})).toBeVisible();
  await expect(page.locator('.calendar-caption')).toContainText('7 October 2099');
  await page.getByRole('button',{name:'Next day'}).click();
  await expect(page.locator('#matchDay')).toHaveValue('2099-10-08');
});
test.describe('viewer timezone',()=>{
  test.use({timezoneId:'Europe/Moscow'});
  test('Russian viewer day begins at previous UTC evening',async({page})=>{
    await installSupabaseMock(page,{matches:fixtures()});
    await page.goto('/matches?__e2e=1&m_day=2099-10-07');
    await expect(page.locator('.match-results-summary')).toContainText('из 35');
    const calls=await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.calls());
    expect(calls.at(-1).p_filters).toMatchObject({from:'2099-10-06T21:00:00.000Z',until:'2099-10-07T21:00:00.000Z'});
  });
});
