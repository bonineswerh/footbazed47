import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

for(const language of ['ru','en'])for(const width of [320,390,1440])test(`empty match remains compact and score aligned: ${language} ${width}`,async({page})=>{
  await installSupabaseMock(page,{feed:[],playerRatings:[],matchInsights:{rating_count:0,average:null,top_players:[],segments:{all:{rating_count:0,distribution:[]}}}});
  await page.setViewportSize({width,height:844});
  await page.goto(`${language==='en'?'/en':''}/match/101?__e2e=1`);
  await expect(page.locator('.md-community-empty')).toHaveText(language==='en'?'No public ratings yet':'Публичных оценок пока нет');
  await expect(page.locator('.md-grid')).toBeHidden();
  await expect(page.locator('.md-primary-action')).toBeVisible();
  await expect(page.locator('#matchDetailStyles')).toHaveAttribute('data-loaded','true');
  const geometry=await page.evaluate(()=>{
    const centre=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return r.y+r.height/2;};
    return{home:centre('.md-team:first-child .md-score'),away:centre('.md-team:last-child .md-score'),vs:centre('.md-vs'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  });
  expect(Math.abs(geometry.home-geometry.away)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.home-geometry.vs)).toBeLessThanOrEqual(2);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
});

test('late rating module cannot open its dialog on a different page',async({page})=>{
  await installSupabaseMock(page);
  let held;
  await page.route('**/js/ratings.js*',route=>{held=route;});
  await page.goto('/match/101?__e2e=1');
  await page.locator('.md-primary-action').click();
  await expect.poll(()=>Boolean(held)).toBe(true);
  await page.getByRole('navigation',{name:'Основная навигация',exact:true}).getByRole('button',{name:'Матчи',exact:true}).click();
  await expect(page).toHaveURL(/\/matches/);
  await held.continue();
  await page.waitForFunction(()=>window.__FOOTBAZED_RATINGS_READY__===true);
  await expect(page.locator('#rateOv')).toBeHidden();
  await page.locator('#matchG .mcard').filter({has:page.locator('a[href="/match/101"]')}).getByRole('button',{name:'Оценить',exact:true}).click();
  await expect(page.locator('#matchRatingRange')).toBeEnabled();
});
