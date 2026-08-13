import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const VIEWPORTS=[
  {width:320,height:700},
  {width:390,height:844},
  {width:768,height:900},
  {width:1280,height:720},
  {width:1600,height:900}
];

async function prepare(page){
  await installSupabaseMock(page);
  await page.route('**/api/admin*',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({
      counts:{matches:202,players:418,ratings:16,users:6,predictions:4,upcoming:12,legacyAvatars:4},
      recentMatches:[
        {id:101,league_name:'Champions League',league_code:'CL',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',match_date:'2026-08-08T19:00:00Z',status:'finished',home_score:2,away_score:1},
        {id:102,league_name:'La Liga',league_code:'PD',home_team_name:'Real Madrid CF',away_team_name:'FC Barcelona',match_date:'2026-08-20T19:00:00Z',status:'scheduled',home_score:null,away_score:null}
      ],
      footballApiConfigured:true,
      checkedAt:'2026-08-10T16:00:00Z'
    })
  }));
}

for(const viewport of VIEWPORTS){
  test(`главная сохраняет композицию ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    await prepare(page);
    await page.goto('/?__e2e=1#home');
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('#homeDashboardTitle')).toBeVisible();

    const layout=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      font:document.fonts.check('14px "Onest Variable"','Главная')
    }));
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.font).toBe(true);
    await expect(page).toHaveScreenshot(`home-${viewport.width}x${viewport.height}.png`,{
      animations:'disabled',
      caret:'hide',
      maxDiffPixelRatio:0.05
    });
  });
}

for(const viewport of [{width:390,height:844},{width:1280,height:720}]){
  test(`матч сохраняет композицию ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    await prepare(page);
    await page.goto('/match/101?__e2e=1');
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('.md-rating-comparison')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expect(page).toHaveScreenshot(`match-${viewport.width}x${viewport.height}.png`,{
      animations:'disabled',
      caret:'hide',
      maxDiffPixelRatio:0.05
    });
  });
}

for(const viewport of [{width:390,height:844},{width:1280,height:720}]){
  test(`админ-панель сохраняет композицию ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    await prepare(page);
    await page.goto('/?__e2e=1#admin');
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('#adminMetrics .admin-metric')).toHaveCount(5);
    await expect(page.locator('#adminLegacyAvatarCount')).toContainText('4');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expect(page).toHaveScreenshot(`admin-${viewport.width}x${viewport.height}.png`,{
      animations:'disabled',
      caret:'hide',
      maxDiffPixelRatio:0.05
    });
  });
}

for(const viewport of [{width:390,height:844},{width:1280,height:720}]){
  test(`light theme preserves composition at ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    await page.addInitScript(()=>localStorage.setItem('fbz_appearance',JSON.stringify({theme:'light',accent:'emerald'})));
    await prepare(page);
    await page.goto('/?__e2e=1#home');
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('#homeDashboardTitle')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expect(page).toHaveScreenshot(`home-light-${viewport.width}x${viewport.height}.png`,{
      animations:'disabled',
      caret:'hide',
      maxDiffPixelRatio:0.05
    });
  });
}
