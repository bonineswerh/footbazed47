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
    const scoreSize=await page.locator('.md-score').first().evaluate(element=>getComputedStyle(element).fontSize);
    expect(Number.parseFloat(scoreSize)).toBeGreaterThanOrEqual(viewport.width<620?47:65);
    await page.screenshot({path:test.info().outputPath(`match-detail-${viewport.width}.png`)});
    await expect(page).toHaveScreenshot(`match-${viewport.width}x${viewport.height}.png`,{
      animations:'disabled',
      caret:'hide',
      maxDiffPixelRatio:0.05
    });
  });
}

test('матч в фокусе открывает тот же матч из календаря',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await prepare(page);
  await page.goto('/?__e2e=1#home');
  const spotlight=page.locator('#homeMatchSpotlight .home-spotlight');
  await expect(spotlight).toContainText('Real Madrid CF');
  await expect(spotlight).toContainText('Manchester City FC');
  await expect(spotlight.locator('.home-spotlight-team b')).toHaveText(['2','1']);
  await spotlight.getByRole('button',{name:'Открыть матч'}).click();
  await expect(page).toHaveURL(/\/match\/101\?__e2e=1$/u);
  await expect(page.locator('.md-hero')).toContainText('Manchester City FC');
});

for(const scenario of [
  {width:390,theme:'dark'},
  {width:1280,theme:'dark'},
  {width:390,theme:'light'},
  {width:1280,theme:'light'}
]){
  test(`карточка матча показывает счёт и команды в ${scenario.theme} теме на ${scenario.width}px`,async({page})=>{
    await page.setViewportSize({width:scenario.width,height:900});
    await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),scenario.theme);
    await prepare(page);
    await page.goto('/?__e2e=1#matches');
    const card=page.locator('#matchG .mcard').filter({hasText:'Manchester City FC'}).first();
    await expect(card).toBeVisible();
    await expect(card.locator('.mc-score-num')).toContainText('2:1');
    await expect(card.getByRole('button',{name:/Открыть матч: Real Madrid CF против Manchester City FC/})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.evaluate(()=>document.fonts.ready);
    const scoreType=await card.locator('.mc-score-num').evaluate(element=>({family:getComputedStyle(element).fontFamily,numbers:getComputedStyle(element).fontVariantNumeric}));
    expect(scoreType.family).toContain('Onest Variable');
    expect(scoreType.numbers).toContain('tabular-nums');
    await expect(card).toHaveScreenshot(`match-card-${scenario.theme}-${scenario.width}.png`,{animations:'disabled',maxDiffPixelRatio:0.03});
  });
}

for(const scenario of [
  {viewport:{width:390,height:844},theme:'dark'},
  {viewport:{width:1280,height:720},theme:'dark'},
  {viewport:{width:390,height:844},theme:'light'},
  {viewport:{width:1280,height:720},theme:'light'}
]){
  test(`лента показывает полную оценку в ${scenario.theme} теме на ${scenario.viewport.width}px`,async({page})=>{
    await page.setViewportSize(scenario.viewport);
    if(scenario.theme==='light'){
      await page.addInitScript(()=>localStorage.setItem('fbz_appearance',JSON.stringify({theme:'light',accent:'emerald'})));
    }
    await prepare(page);
    await page.goto('/?__e2e=1#feed');
    await page.evaluate(()=>document.fonts.ready);
    const entry=page.locator('.feed-entry[data-rating-id="501"]');
    await expect(entry.locator('.feed-rating')).toHaveText('10/10');
    const verdictType=await entry.evaluate(element=>({match:getComputedStyle(element.querySelector('.feed-rating strong')).fontFamily,player:getComputedStyle(element.querySelector('.feed-players strong')).fontFamily,alignment:getComputedStyle(element.querySelector('.feed-rating')).alignItems}));
    expect(verdictType.match).toContain('Onest Variable');
    expect(verdictType.match).toBe(verdictType.player);
    expect(verdictType.alignment).toBe('baseline');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expect(entry).toHaveScreenshot(`feed-rating-${scenario.theme}-${scenario.viewport.width}x${scenario.viewport.height}.png`,{
      animations:'disabled',
      caret:'hide',
      maxDiffPixelRatio:0.05
    });
  });
}

for(const viewport of [{width:320,height:700},{width:390,height:844},{width:1280,height:720}]){
  test(`оценка матча сохраняет композицию ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    await prepare(page);
    await page.goto('/match/101?__e2e=1');
    await page.locator('.md-primary-action').click();
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('#rScoreDisp')).toHaveText('8/10');
    expect(await page.locator('#rScoreDisp').evaluate(element=>getComputedStyle(element).fontFamily)).toContain('Onest Variable');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expect(page).toHaveScreenshot(`rating-score-${viewport.width}x${viewport.height}.png`,{
      animations:'disabled',
      caret:'hide',
      maxDiffPixelRatio:0.05
    });

    await page.getByRole('button',{name:/Продолжить/}).click();
    await page.locator('#rating-player-5292').click();
    await expect(page.locator('#playerRatingEditor')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expect(page).toHaveScreenshot(`rating-player-${viewport.width}x${viewport.height}.png`,{
      animations:'disabled',
      caret:'hide',
      maxDiffPixelRatio:0.05
    });
  });
}

for(const scenario of [
  {viewport:{width:390,height:844},theme:'dark'},
  {viewport:{width:1280,height:720},theme:'dark'},
  {viewport:{width:390,height:844},theme:'light'},
  {viewport:{width:1280,height:720},theme:'light'}
]){
  test(`меню аккаунта сохраняет иерархию в ${scenario.theme} теме на ${scenario.viewport.width}px`,async({page})=>{
    await page.setViewportSize(scenario.viewport);
    await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),scenario.theme);
    await prepare(page);
    await page.goto('/?__e2e=1#home');
    await page.locator('#accountBtn').click();
    await page.mouse.move(0,0);
    const menu=page.locator('#accountMenu');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCSS('opacity','1');
    await expect(menu).toHaveScreenshot(`account-menu-${scenario.theme}-${scenario.viewport.width}x${scenario.viewport.height}.png`,{
      animations:'disabled',
      caret:'hide',
      maxDiffPixelRatio:0.05
    });
  });

  test(`настройки сохраняют контраст в ${scenario.theme} теме на ${scenario.viewport.width}px`,async({page})=>{
    await page.setViewportSize(scenario.viewport);
    await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),scenario.theme);
    await prepare(page);
    await page.goto('/?__e2e=1#home');
    await page.evaluate(()=>openSettings());
    const settings=page.locator('.settings-box');
    await expect(settings).toBeVisible();
    await expect(page.locator('#settingsOv .settings-head .icon-btn')).toBeFocused();
    await expect(settings).toHaveScreenshot(`settings-${scenario.theme}-${scenario.viewport.width}x${scenario.viewport.height}.png`,{
      animations:'disabled',
      caret:'hide',
      maxDiffPixelRatio:0.05
    });
  });
}

for(const viewport of [{width:390,height:844},{width:1280,height:720}]){
  test(`light theme сохраняет поле оценки ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    await page.addInitScript(()=>localStorage.setItem('fbz_appearance',JSON.stringify({theme:'light',accent:'emerald'})));
    await prepare(page);
    await page.goto('/match/101?__e2e=1');
    await page.locator('.md-primary-action').click();
    await page.getByRole('button',{name:/Продолжить/}).click();
    await page.locator('#rating-player-5292').click();
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('#playerRatingEditor')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expect(page).toHaveScreenshot(`rating-player-light-${viewport.width}x${viewport.height}.png`,{
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
