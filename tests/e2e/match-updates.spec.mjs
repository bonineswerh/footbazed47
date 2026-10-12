import {test,expect} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const match={id:101,league_name:'La Liga',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',home_club_id:24,away_club_id:31,match_date:'2026-10-11T16:00:00Z',status:'live',home_score:0,away_score:0};
for(const width of [390,1440])test(`scores refresh in place and finished matches gain the rating action at ${width}`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:1000});
  await page.clock.install({time:new Date('2026-10-11T16:10:00Z')});
  await installSupabaseMock(page,{matches:[match]});
  await page.goto('/matches?__e2e=1');
  const card=page.locator('#matchG [data-match-id="101"]');
  await expect(card.locator('.mc-score-num')).toHaveText('0:0');
  await page.evaluate(()=>window.__FOOTBAZED_TEST_MATCHES__.update([{id:101,home_score:2,away_score:1}]));
  await page.clock.fastForward(61000);
  await expect(card.locator('.mc-score-num')).toHaveText('2:1');
  await expect(card.locator('.tag')).toHaveText('LIVE');
  await page.evaluate(()=>window.__FOOTBAZED_TEST_MATCHES__.update([{id:101,status:'finished'}]));
  await page.clock.fastForward(61000);
  await expect(card.getByRole('button',{name:'Оценить',exact:true})).toBeVisible();
  await expect(card.locator('.tag')).toHaveText('Завершён');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('an overdue fixture stays unconfirmed instead of showing a fabricated live result',async({page})=>{
  await page.clock.install({time:new Date('2026-10-11T15:59:30Z')});
  await installSupabaseMock(page,{matches:[{...match,status:'scheduled',home_score:null,away_score:null}]});
  await page.goto('/matches?__e2e=1');
  const card=page.locator('#matchG [data-match-id="101"]');
  await expect(card.getByRole('button',{name:'Ожидание',exact:true})).toBeVisible();
  await page.clock.fastForward(61000);
  await expect(card.locator('.tag')).toHaveText('Статус уточняется');
  await expect(card.locator('.mc-score-num')).toHaveText('—:—');
  await expect(card.getByRole('button',{name:'Ожидание',exact:true})).toHaveCount(0);
});

test('detail refresh preserves a live score and opens the completed match layout',async({page})=>{
  await page.clock.install({time:new Date('2026-10-11T16:10:00Z')});
  await installSupabaseMock(page,{matches:[match]});
  await page.goto('/match/101?__e2e=1');
  await expect(page.locator('.md-status')).toHaveText('LIVE');
  await page.evaluate(()=>window.__FOOTBAZED_TEST_MATCHES__.update([{id:101,status:'finished',home_score:2,away_score:1}]));
  await page.clock.fastForward(61000);
  await expect(page.locator('.md-status')).toHaveText('Завершён');
  await expect(page.locator('.md-score')).toHaveText(['2','1']);
  await expect(page.locator('.md-primary-action')).toBeVisible();
  await expect(page).toHaveURL(/\/match\/101/);
});
