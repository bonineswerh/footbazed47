import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const none={available:false,players:[]};
const confirmed={available:true,players:[{id:5290,club_id:24,participation:'starter'},{id:5292,club_id:24,participation:'bench'}]};
test('confirmed overview defaults to an honest empty sample and full history survives reload',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await installSupabaseMock(page,{lineup:none});
  await page.goto('/discover?__e2e=1&ov_kind=players');
  await expect(page.getByRole('button',{name:'Только подтверждённые',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#statisticsSummary strong')).toHaveText(['0','0','0']);
  await expect(page.locator('#statisticsContext')).toContainText('2 прежние оценки не включены');
  await expect(page.locator('#statisticsList')).toContainText('пока нет оценок подтверждённых выступлений');
  await page.getByRole('button',{name:'Вся история оценок',exact:true}).click();
  await expect(page.locator('.statistics-row')).toHaveCount(2);await expect(page).toHaveURL(/ov_participation=all/);
  await expect(page.locator('.statistics-row').first()).toContainText('Клуб выступления не подтверждён');
  await page.reload();await expect(page.getByRole('button',{name:'Вся история оценок',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.statistics-row')).toHaveCount(2);
  await page.getByRole('button',{name:'Сбросить фильтры',exact:true}).click();
  await expect(page.locator('#statisticsSummary strong')).toHaveText(['0','0','0']);
  await expect(page.getByRole('button',{name:'Только подтверждённые',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page).not.toHaveURL(/ov_participation/);expect(errors).toEqual([]);
});

test('player club filter refers to fixture side and never current membership or opponents',async({page})=>{
  await installSupabaseMock(page,{lineup:confirmed,players:[{id:5290,name:'Transferred Player',team:'Manchester City FC',club_id:31},{id:5292,name:'Bench Player',team:'Real Madrid CF',club_id:24}]});
  await page.goto('/discover?__e2e=1&ov_kind=players&ov_club_id=24');
  await expect(page.locator('.statistics-row')).toHaveCount(1);await expect(page.locator('.statistics-meta')).toHaveText('Real Madrid CF');
  await page.locator('#statisticsFilters-open').click();await page.getByLabel('Клуб',{exact:true}).selectOption('31');await page.getByRole('button',{name:'Готово',exact:true}).click();
  await expect(page.locator('.statistics-row')).toHaveCount(0);await expect(page.locator('#statisticsSummary strong')).toHaveText(['0','0','0']);
  await page.getByRole('button',{name:'Вся история оценок',exact:true}).click();await expect(page.locator('.statistics-row')).toHaveCount(0);
  await page.getByRole('button',{name:'Сбросить фильтры',exact:true}).click();await expect(page.locator('.statistics-row')).toHaveCount(1);
  await page.locator('.statistics-row').click();await expect(page).toHaveURL(/\/player\/5290/);await expect(page).toHaveTitle(/Thibaut Courtois/);
});

test('club historical performers remain visible independently of current squad',async({page})=>{
  await installSupabaseMock(page,{club:{club:{id:24,name:'Real Madrid CF',short_name:'Real Madrid'},stats:{performance_scope:'confirmed_historical',squad_count:0,match_count:2,upcoming_count:0,player_rating:9,player_rating_count:2,rated_player_count:1,player_match_count:1,unverified_player_rating_count:3},competitions:[],squad:[],matches:[],rated_performers:[{id:5290,name:'Thibaut Courtois',average:9,rating_count:2}]}});
  await page.goto('/club/24?__e2e=1');await expect(page.getByRole('heading',{name:'Выступления за клуб',exact:true})).toBeVisible();
  await expect(page.locator('.entity-rating-context')).toContainText('на дату матча');await expect(page.locator('.entity-rating-context')).toContainText('не приписываются ни одной команде');
  await page.getByRole('button',{name:'Thibaut Courtois',exact:true}).click();await expect(page).toHaveURL(/\/player\/5290/);
});

test('player legacy scores are preserved separately from confirmed statistics',async({page})=>{
  await installSupabaseMock(page,{player:{player:{id:5290,name:'Thibaut Courtois',position:'GK',team:'New Club',club:{id:31,name:'New Club'}},stats:{performance_scope:'confirmed_historical',average:8,rating_count:2,best_votes:1,matches_rated:1,unverified_rating_count:1,unverified_average:2},performances:[{match_id:101,average:8,rating_count:2,participation_verified:true,historical_club_id:24,historical_team:'Real Madrid CF',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',match_date:'2026-08-08T19:00Z',home_score:2,away_score:1},{match_id:103,average:2,rating_count:1,participation_verified:false,historical_club_id:null,historical_team:null,home_team_name:'Old Home',away_team_name:'Old Away',match_date:'2026-07-08T19:00Z',home_score:1,away_score:0}],teammates:[]}});
  await page.goto('/player/5290?__e2e=1');await expect(page.locator('.entity-meta')).toContainText('Клуб в каталоге: New Club');
  await expect(page.locator('.player-stats strong')).toHaveText(['8.0','2','1','1']);
  await page.getByText('Ранее сохранённые оценки · 1',{exact:true}).click();await expect(page.locator('.entity-legacy')).toContainText('2.0/10');
  await expect(page.locator('.performance-row').first()).toContainText('Выступление за Real Madrid CF');
  await expect(page.locator('.performance-row').last()).toContainText('Участие в матче не подтверждено');
  await page.locator('.performance-row').first().click();await expect(page).toHaveURL(/\/match\/101/);
});

for(const theme of ['dark','light'])for(const width of [320,390,1440])test(`confirmed overview geometry and WCAG ${theme} ${width}`,async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:width===1440?1000:844});
  await page.addInitScript(value=>localStorage.setItem('fbz_appearance',JSON.stringify({theme:value,accent:'ice'})),theme);await installSupabaseMock(page,{lineup:confirmed});
  await page.goto('/discover?__e2e=1&ov_kind=players');await expect(page.locator('.statistics-row')).toHaveCount(1);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.querySelector('#page-leaderboard').getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  const buttons=await page.locator('#statisticsParticipation button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {height:r.height,width:r.width,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth};}));
  for(const b of buttons){expect(b.height).toBeGreaterThanOrEqual(44);expect(b.width).toBeGreaterThanOrEqual(44);expect(b.scrollWidth).toBeLessThanOrEqual(b.clientWidth);}
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});const violations=await page.evaluate(async()=>(await axe.run(document.getElementById('statisticsRoot'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.filter(v=>['critical','serious','moderate'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
  expect(violations).toEqual([]);expect(errors).toEqual([]);await info.attach('confirmed-overview.png',{body:await page.locator('#statisticsRoot').screenshot(),contentType:'image/png'});
});
