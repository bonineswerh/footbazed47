import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
const own='3615141a-7700-46b8-9ba5-e4f4450537fc',other='cd291181-2db6-42cb-9f3d-ef84ab3a9660';
const upcoming={id:102,competition_id:8,league_name:'La Liga',home_team_name:'Real Madrid CF',away_team_name:'FC Barcelona',home_club_id:24,away_club_id:25,match_date:'2099-08-20T19:00:00Z',status:'scheduled',home_score:null,away_score:null};
async function expectAccessible(page,selector){
  await page.evaluate(async()=>{await document.fonts.ready;});
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
  const violations=await page.evaluate(async selector=>(await axe.run(document.querySelector(selector),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.filter(v=>['critical','serious','moderate'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),selector);
  expect(violations).toEqual([]);
}

for(const theme of ['dark','light'])for(const width of [320,390,1440])test(`compact cards separate navigation from rating: ${theme} ${width}`,async({page},testInfo)=>{
  await installSupabaseMock(page);
  await page.setViewportSize({width,height:844});
  await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'ice'})),theme);
  await page.goto('/matches?__e2e=1');
  const card=page.locator('#matchG .mcard').filter({has:page.locator('a[href="/match/101"]')});
  await expect(card).toBeVisible();
  const box=await card.boundingBox();
  expect(box.height).toBeLessThan(box.width);expect(box.height).toBeLessThanOrEqual(265);
  const rating=card.getByRole('button',{name:'Оценить',exact:true});
  expect((await rating.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await rating.click();await expect(page.locator('#rateOv')).toBeVisible();await expect(page).toHaveURL(/\/matches/);
  await page.keyboard.press('Escape');await card.click({position:{x:12,y:12}});
  await expect(page).toHaveURL(/\/match\/101/);await expect(page.locator('#rateOv')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await testInfo.attach('compact-match.png',{body:await page.screenshot(),contentType:'image/png'});
});

for(const language of ['ru','en'])test(`expectations use one short form, explicit rating and supporter side: ${language}`,async({page},testInfo)=>{
  await installSupabaseMock(page,{matches:[upcoming]});await page.setViewportSize({width:390,height:844});
  await page.goto((language==='en'?'/en':'')+'/match/102?__e2e=1');
  await expect(page.locator('.md-grid')).toBeHidden();await expect(page.locator('.pred-input')).toHaveCount(0);
  await page.locator('.md-primary-action').click();
  await expect(page.locator('#rateTitle')).toHaveText(language==='ru'?'Оценить ожидание':'Rate your expectation');
  await expect(page.locator('#rateScorePrompt')).toHaveText(language==='ru'?'Какой игры вы ожидаете?':'What quality of game do you expect?');
  await expect(page.locator('#rS2')).toBeHidden();await expect(page.locator('.rate-steps')).toBeHidden();await expect(page.locator('.rating-public-toggle')).toBeHidden();
  const rail=page.locator('#matchRatingRange'),save=page.locator('#rS1 button[data-fbz-click="shell.r-next"]');
  await expect(rail).toHaveValue('0');await expect(page.locator('#rScoreDisp')).toHaveText('—');
  await page.locator('input[name="ratingSupporterSide"][value="neutral"]').locator('..').click();await save.click();
  expect(await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.lastExpectation())).toBeNull();
  for(let i=0;i<5;i++)await rail.press('ArrowRight');
  await expect(rail).toHaveValue('5');expect(await rail.evaluate(el=>el.style.getPropertyValue('--rating-progress'))).toBe('50%');
  const labels=await page.locator('#rS1 .rating-rail-labels').evaluate(el=>{const parent=el.getBoundingClientRect(),middle=el.children[1].getBoundingClientRect();return{centre:parent.x+parent.width/2,label:middle.x+middle.width/2};});
  expect(Math.abs(labels.centre-labels.label)).toBeLessThanOrEqual(1);
  await expectAccessible(page,'#rateOv');await testInfo.attach('expectation-form.png',{body:await page.screenshot(),contentType:'image/png'});
  await save.click();await expect(page.locator('#rateOv')).toBeHidden();
  expect(await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.lastExpectation())).toEqual({p_match_id:102,p_rating:5,p_supporter_side:'neutral'});
  await expect(page.locator('.expectation-personal')).toContainText('5.0');await expect(page.locator('.md-primary-action')).toContainText(language==='ru'?'Изменить ожидание':'Edit expectation');
  expect(await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.lastRating())).toBeNull();
});

test('expectation edits and deletion are explicit and do not alter match ratings',async({page})=>{
  await installSupabaseMock(page,{matches:[upcoming],expectations:[{user_id:own,match_id:102,rating:9,supporter_side:'home'}]});
  await page.goto('/match/102?__e2e=1');await page.locator('.md-primary-action').click();
  await expect(page.locator('#rScoreDisp')).toHaveText('9/10');await expect(page.locator('#matchRatingRange')).toHaveAttribute('data-tone','elite');
  await expect(page.locator('input[value="home"][name="ratingSupporterSide"]')).toBeChecked();
  await page.evaluate(()=>{
    const rpc=sb.rpc.bind(sb);let attempts=0;
    sb.rpc=(name,args)=>name==='delete_match_expectation'&&attempts++===0?Promise.resolve({data:null,error:{message:'temporary failure'}}):rpc(name,args);
  });
  await page.locator('#rExpectationDelete').click();await page.locator('#confirmAction').click();
  await expect(page.locator('#toast')).toContainText('Не удалось удалить ожидание');
  await expect(page.locator('#confirmOv')).toBeVisible();await expect(page.locator('.expectation-personal')).toContainText('9.0');
  await page.locator('#confirmAction').click();
  await expect(page.locator('#rateOv')).toBeHidden();await expect(page.locator('.expectation-personal')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.lastRating())).toBeNull();
});

test('past kickoff and closed expectations cannot reopen through a stale form',async({page})=>{
  await installSupabaseMock(page,{matches:[{...upcoming,match_date:'2020-08-20T19:00:00Z'}]});
  await page.goto('/match/102?__e2e=1');await expect(page.locator('#mdExpectations')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('.md-primary-action')).toHaveCount(0);
  await page.evaluate(()=>openRate(102,'expectation'));
  await expect(page.locator('#toast')).toContainText('Ожидания закрыты');await expect(page.locator('#rateOv')).toBeHidden();
});

test('finished comparison uses the same voters and private expectations stay personal',async({page})=>{
  await installSupabaseMock(page,{expectations:[{user_id:own,match_id:101,rating:9,supporter_side:'home'},{user_id:other,match_id:101,rating:5,supporter_side:'neutral'}]});
  await page.goto('/match/101?__e2e=1');
  await expect(page.locator('.expectation-comparison')).toContainText('Обе оценки поставили: 2');
  await expect(page.locator('.expectation-comparison .expectation-delta')).toHaveText('+2.0');
  await expect(page.locator('.expectation-community')).toContainText('7.0');
  await expect(page.locator('.md-rating-comparison')).toHaveCount(0);
  await page.locator('.expectation-comparison summary').click();await expect(page.locator('.expectation-comparison')).toHaveAttribute('open','');
  await expect(page.locator('.expectation-personal .expectation-delta')).toHaveText('-1.0');
  await page.locator('.expectation-segments button').filter({hasText:'Реал Мадрид'}).click();
  await expect(page.locator('.expectation-comparison .expectation-delta')).toHaveText('-1.0');
  await expect(page.locator('.expectation-comparison')).toContainText('Обе оценки поставили: 1');
  await expectAccessible(page,'#page-md');
});

test('completion notification opens the exact match and is marked read',async({page})=>{
  await installSupabaseMock(page,{notifications:[{id:1001,user_id:own,from_user_id:null,type:'match_ready',match_id:101,read:false,created_at:'2026-10-07T12:00:00Z',rating_id:null,comment_id:null}]});
  await page.goto('/matches?__e2e=1');await expect(page.locator('#notifBadge')).toHaveText('1');await page.locator('#notifBtn').click();
  await expect(page.locator('.notif-item')).toContainText('Матч завершён');await expect(page.locator('.notif-actor')).toHaveCount(0);
  await page.locator('.notif-open').click();await expect(page).toHaveURL(/\/match\/101/);await expect(page.locator('#notifBadge')).toBeHidden();
});

test('a private profile sees its own expectation without contributing to public aggregates',async({page})=>{
  await installSupabaseMock(page,{users:[{id:own,username:'bazed',is_public:false},{id:other,username:'gamlet',is_public:true}],expectations:[{user_id:own,match_id:101,rating:9,supporter_side:'home'},{user_id:other,match_id:101,rating:5,supporter_side:'neutral'}]});
  await page.goto('/match/101?__e2e=1');
  await expect(page.locator('.expectation-community')).toContainText('5.0');
  await expect(page.locator('.expectation-comparison')).toContainText('Обе оценки поставили: 1');
  await expect(page.locator('.expectation-comparison .expectation-delta')).toHaveText('+5.0');
  await expect(page.locator('.expectation-personal')).toContainText('9.0');
});

test('admin guide explains destructive tools without making provider requests',async({page},testInfo)=>{
  await installSupabaseMock(page);const mutations=[];
  await page.route('**/api/admin*',route=>{if(route.request().method()==='POST')mutations.push(route.request().postDataJSON());return route.fulfill({contentType:'application/json',body:JSON.stringify({counts:{},recentMatches:[],footballApiConfigured:true,apiFootballConfigured:true})});});
  await page.setViewportSize({width:390,height:844});await page.goto('/admin?__e2e=1');await page.getByRole('button',{name:'Инструкция',exact:true}).click();
  const experts=page.locator('#admin-view-help summary').filter({hasText:'Эксперты FOOTBAZED'});await expect(experts).toBeVisible();await experts.click();
  await expect(page.locator('#admin-view-help')).toContainText('Роль эксперта не даёт прав администратора');
  await page.locator('#admin-view-help summary').filter({hasText:'Очистка и обслуживание'}).click();
  await expect(page.locator('#admin-view-help')).toContainText('сохраните резервную копию');expect(mutations).toEqual([]);
  await expectAccessible(page,'#admin-view-help');await testInfo.attach('admin-guide.png',{body:await page.screenshot(),contentType:'image/png'});
});

test('league ribbon respects reduced motion without images or extra provider calls',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await installSupabaseMock(page);await page.goto('/?__e2e=1');
  await expect(page.locator('#homeLeagueRibbon')).toBeVisible();
  expect(await page.locator('.home-league-track').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await expect(page.locator('#homeLeagueRibbon img')).toHaveCount(0);
  expect(await page.locator('#homeLeagueRibbon').getAttribute('aria-hidden')).toBe('true');
});

test('overview clubs reuse verified emblems in a bounded catalogue batch',async({page})=>{
  const media={asset_type:'club_logo',usage_status:'identification',source_provider:'api-football',url:'https://media.api-sports.io/football/teams/541.png'};
  await installSupabaseMock(page,{clubMarks:[{id:24,name:'Real Madrid CF',media}]});
  // A deterministic local image proves layout/rendering without consuming provider quota.
  await page.route('https://media.api-sports.io/football/teams/541.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZYkAAAAASUVORK5CYII=','base64')}));
  await page.goto('/discover?__e2e=1');
  await page.evaluate(()=>{window.markCalls=[];const rpc=sb.rpc.bind(sb);sb.rpc=(name,args)=>{if(name==='get_club_marks')window.markCalls.push(args);return rpc(name,args);};});
  await page.getByRole('button',{name:'Клубы',exact:true}).click();
  const logo=page.locator('.statistics-row').filter({hasText:'Реал Мадрид'}).locator('.collection-mark img');
  await expect(logo).toBeVisible();await expect(logo).toHaveAttribute('src',media.url);
  expect((await page.evaluate(()=>window.markCalls)).length).toBeLessThanOrEqual(1);
});
