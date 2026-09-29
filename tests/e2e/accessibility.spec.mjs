import {expect,test} from '@playwright/test';

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

async function expectNoSignificantWcagViolations(page,contextSelector=null){
  await page.addScriptTag({url: "/node_modules/axe-core/axe.min.js"});
  const violations=await page.evaluate(async selector=>{
    const context=selector?document.querySelector(selector):document;
    const result=await window.axe.run(context,{
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}
    });
    return result.violations
      .filter(item=>['critical','serious','moderate'].includes(item.impact))
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
  {name:'home mobile spotlight',url:'/?__e2e=1#home',ready:'#homeMatchSpotlight .home-spotlight',viewport:{width:390,height:844}},
  {name:'feed mobile',url:'/?__e2e=1#feed',ready:'.feed-entry',viewport:{width:390,height:844}},
  {name:'club desktop',url:'/club/24?__e2e=1',ready:'.entity-hero h1',viewport:{width:1280,height:720}},
  {name:'competition mobile',url:'/competition/7?__e2e=1',ready:'.competition-shell h1',viewport:{width:390,height:844}},
  {name:'match desktop',url:'/match/101?__e2e=1',ready:'.md-hero',viewport:{width:1280,height:720}},
  {name:'match light mobile',url:'/match/101?__e2e=1',ready:'.md-hero',viewport:{width:390,height:844},theme:'light'},
  {name:'calendar light desktop',url:'/?__e2e=1#matches',ready:'#matchG .mcard',viewport:{width:1280,height:720},theme:'light'},
  {name:'admin mobile',url:'/?__e2e=1#admin',ready:'#adminMetrics .admin-metric',viewport:{width:390,height:844}},
  {name:'overview dark mobile',url:'/discover?__e2e=1',ready:'.statistics-row',viewport:{width:390,height:844}},
  {name:'overview light desktop',url:'/discover?__e2e=1',ready:'.statistics-row',viewport:{width:1440,height:1000},theme:'light'},
  {name:'home light desktop',url:'/?__e2e=1#home',ready:'#homeDashboardTitle',viewport:{width:1280,height:720},theme:'light'},
  {name:'feed light mobile',url:'/?__e2e=1#feed',ready:'.feed-entry',viewport:{width:390,height:844},theme:'light'}
]){
  test(`${scenario.name} has no moderate, serious or critical WCAG AA violations`,async({page})=>{
    await page.setViewportSize(scenario.viewport);
    if(scenario.theme){
      await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),scenario.theme);
    }
    await prepare(page);
    await page.goto(scenario.url);
    await expect(page.locator(scenario.ready).first()).toBeVisible();
    await expectNoSignificantWcagViolations(page);
  });
}

for(const scenario of [
  {name:'account menu dark desktop',theme:'dark',target:'#accountMenu',open:page=>page.locator('#accountBtn').click()},
  {name:'account menu light desktop',theme:'light',target:'#accountMenu',open:page=>page.locator('#accountBtn').click()},
  {name:'settings dark desktop',theme:'dark',target:'#settingsOv',open:page=>page.evaluate(()=>openSettings())},
  {name:'settings light desktop',theme:'light',target:'#settingsOv',open:page=>page.evaluate(()=>openSettings())}
]){
  test(`${scenario.name} has no moderate, serious or critical WCAG AA violations`,async({page})=>{
    await page.setViewportSize({width:1280,height:720});
    await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),scenario.theme);
    await prepare(page);
    await page.goto('/?__e2e=1#home');
    await scenario.open(page);
    await expect(page.locator(scenario.target)).toBeVisible();
    await expectNoSignificantWcagViolations(page,scenario.target);
  });
}

test('матч в фокусе сохраняет контраст при смене темы и акцента',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await prepare(page);
  for(const theme of ['dark','light']){
    for(const accent of ['emerald','ice','gold','mono']){
      await page.addInitScript(({theme,accent})=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent})),{theme,accent});
      await page.goto('/?__e2e=1#home');
      await expect(page.locator('#homeMatchSpotlight .home-spotlight')).toBeVisible();
      await expectNoSignificantWcagViolations(page,'#homeMatchSpotlight');
    }
  }
});

for(const scenario of [
  {name:'rating field mobile',viewport:{width:390,height:844}},
  {name:'rating field light desktop',viewport:{width:1280,height:720},theme:'light'}
]){
  test(`${scenario.name} has no moderate, serious or critical WCAG AA violations`,async({page})=>{
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
    await expectNoSignificantWcagViolations(page,'#rateOv');
  });
}
