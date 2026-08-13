import {expect,test} from '@playwright/test';
import axe from 'axe-core';
import {installSupabaseMock} from './mock-supabase.mjs';

async function prepare(page){
  await installSupabaseMock(page);
  await page.route('**/api/admin*',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({
      counts:{matches:202,players:418,ratings:16,users:6,predictions:4,upcoming:12,legacyAvatars:0},
      recentMatches:[],
      footballApiConfigured:true,
      checkedAt:'2026-08-10T16:00:00Z'
    })
  }));
}

async function expectNoSeriousWcagViolations(page,contextSelector=null){
  await page.addScriptTag({content:axe.source});
  const violations=await page.evaluate(async selector=>{
    const context=selector?document.querySelector(selector):document;
    const result=await window.axe.run(context,{
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}
    });
    return result.violations
      .filter(item=>item.impact==='critical'||item.impact==='serious')
      .map(item=>({
        id:item.id,
        impact:item.impact,
        help:item.help,
        targets:item.nodes.slice(0,5).map(node=>node.target.join(' '))
      }));
  },contextSelector);
  expect(violations).toEqual([]);
}

for(const scenario of [
  {name:'home desktop',url:'/?__e2e=1#home',ready:'#homeDashboardTitle',viewport:{width:1280,height:720}},
  {name:'feed mobile',url:'/?__e2e=1#feed',ready:'.feed-entry',viewport:{width:390,height:844}},
  {name:'club desktop',url:'/club/24?__e2e=1',ready:'.entity-hero h1',viewport:{width:1280,height:720}},
  {name:'competition mobile',url:'/competition/7?__e2e=1',ready:'.competition-shell h1',viewport:{width:390,height:844}},
  {name:'match desktop',url:'/match/101?__e2e=1',ready:'.md-hero',viewport:{width:1280,height:720}},
  {name:'admin mobile',url:'/?__e2e=1#admin',ready:'#adminMetrics .admin-metric',viewport:{width:390,height:844}},
  {name:'home light desktop',url:'/?__e2e=1#home',ready:'#homeDashboardTitle',viewport:{width:1280,height:720},theme:'light'},
  {name:'feed light mobile',url:'/?__e2e=1#feed',ready:'.feed-entry',viewport:{width:390,height:844},theme:'light'}
]){
  test(`${scenario.name} has no serious WCAG AA violations`,async({page})=>{
    await page.setViewportSize(scenario.viewport);
    if(scenario.theme){
      await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),scenario.theme);
    }
    await prepare(page);
    await page.goto(scenario.url);
    await expect(page.locator(scenario.ready).first()).toBeVisible();
    await expectNoSeriousWcagViolations(page);
  });
}

for(const scenario of [
  {name:'rating field mobile',viewport:{width:390,height:844}},
  {name:'rating field light desktop',viewport:{width:1280,height:720},theme:'light'}
]){
  test(`${scenario.name} has no serious WCAG AA violations`,async({page})=>{
    await page.setViewportSize(scenario.viewport);
    if(scenario.theme){
      await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),scenario.theme);
    }
    await prepare(page);
    await page.goto('/match/101?__e2e=1');
    await page.locator('.md-primary-action').click();
    await page.getByRole('button',{name:/Продолжить/}).click();
    await page.locator('#rating-player-5292').click();
    await expect(page.locator('#playerRatingEditor')).toBeVisible();
    await expectNoSeriousWcagViolations(page,'#rateOv');
  });
}
