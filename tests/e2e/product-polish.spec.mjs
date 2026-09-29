import {expect,test} from '@playwright/test';

import {installSupabaseMock} from './mock-supabase.mjs';

const own='3615141a-7700-46b8-9ba5-e4f4450537fc';
test.beforeEach(async({page})=>{await installSupabaseMock(page);});

test('профиль показывает факты, загружается по запросу и экспортирует чёткую карточку',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?__e2e=1');
  await expect(page.locator('#homeDashboardTitle')).toBeVisible();
  expect(await page.evaluate(()=>Boolean(window.FBZProfile||window.FBZShare))).toBe(false);
  await page.evaluate(()=>goOwnProfile());
  await expect(page.getByRole('heading',{name:'Bazed',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'11 матчей в дневнике'})).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuetext','Осталось 14 матчей');
  await expect(page.locator('#profileW')).not.toContainText(/FBZ Score|Футбольный рассказчик|В игре|Легенда сектора/u);
  expect(await page.evaluate(()=>Boolean(window.FBZShare))).toBe(false);
  await page.getByRole('button',{name:'Создать карточку'}).click();
  const card=page.locator('#shareCanvas');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('width','1200');
  await expect(card).toHaveAttribute('height','800');
  await expect(card).toHaveAccessibleName(/11 матчей в дневнике/u);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:/Скачать PNG/}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('footbazed-card.png');
  await download.saveAs(testInfo.outputPath('profile-card.png'));
  await testInfo.attach('profile-card',{path:testInfo.outputPath('profile-card.png'),contentType:'image/png'});
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
  expect(errors).toEqual([]);
});

for(const width of [320,360,390,430,768,1024,1440,1920]){
  test(`профиль переносит длинные строки и сохраняет читаемость на ${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/?__e2e=1');
    await expect(page.locator('#homeDashboardTitle')).toBeVisible();
    await page.evaluate(()=>{
      const rpc=sb.rpc.bind(sb);
      sb.rpc=async(name,args)=>{
        const result=await rpc(name,args);
        if(name==='get_profile_page'){
          result.data.profile.display_name='Александр Константинопольский';
          result.data.profile.bio='ОченьДлинноеСловоБезПробелов'.repeat(7);
        }
        return result;
      };
      goOwnProfile();
    });
    await expect(page.locator('.phero-name')).toHaveText('Александр Константинопольский');
    await page.evaluate(()=>document.fonts.ready);
    const layout=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      bioSize:parseFloat(getComputedStyle(document.querySelector('.phero-bio')).fontSize),
      metaSize:parseFloat(getComputedStyle(document.querySelector('.pst-l')).fontSize),
      actionSize:document.querySelector('.phero-acts button').getBoundingClientRect().height,
      loadedFont:document.fonts.check('650 16px "Onest Variable"','Футбол')
    }));
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.bioSize).toBeGreaterThanOrEqual(14);
    expect(layout.metaSize).toBeGreaterThanOrEqual(12);
    expect(layout.actionSize).toBeGreaterThanOrEqual(44);
    expect(layout.loadedFont).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`profile-${width}.png`),fullPage:true});
  });
}

test('профиль выдерживает удвоенный размер текста',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(`/profile/${own}?__e2e=1`);
  await expect(page.locator('.phero-name')).toBeVisible();
  await page.addStyleTag({content:'html{font-size:200%!important}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button',{name:'Редактировать',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Никнейм'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('поздний lazy-профиль не заменяет новую страницу',async({page})=>{
  let release;
  const hold=new Promise(resolve=>{release=resolve;});
  await page.route('**/js/profile.js*',async route=>{await hold;await route.continue();});
  await page.goto('/?__e2e=1');
  await expect(page.locator('#homeDashboardTitle')).toBeVisible();
  await page.evaluate(()=>{goOwnProfile();go('matches');});
  release();
  await expect(page.locator('#matchG .mcard').first()).toBeVisible();
  await expect(page).toHaveURL(/\/matches\?__e2e=1$/u);
  await expect(page.locator('#profileW .phero')).toHaveCount(0);
});

test('приглашение безопасно кодирует текст и ведёт на корень текущего сайта',async({page})=>{
  await page.goto('/?__e2e=1');
  await expect(page.locator('#homeDashboardTitle')).toBeVisible();
  await page.evaluate(()=>{
    const rpc=sb.rpc.bind(sb);
    sb.rpc=async(name,args)=>{const result=await rpc(name,args);if(name==='get_profile_page')result.data.profile.invite_code="CODE'\"><img src=x onerror=alert(1)>";return result;};
    window.copyText=value=>{window.copiedInvitation=value;};
    goOwnProfile();
  });
  await page.getByRole('button',{name:'Копировать ссылку',exact:true}).click();
  const href=await page.evaluate(()=>window.copiedInvitation);
  const url=new URL(href);
  expect(url.origin).toBe('http://127.0.0.1:4173');
  expect(url.pathname).toBe('/');
  expect(url.searchParams.get('invite')).toBe("CODE'\"><img src=x onerror=alert(1)>");
  await expect(page.locator('#profileW img[src=x]')).toHaveCount(0);
});

for(const theme of ['dark','light']){
  test(`профиль сохраняет контраст во всех акцентах темы ${theme}`,async({page})=>{
    await page.setViewportSize({width:390,height:844});
    for(const accent of ['emerald','ice','gold','mono']){
      await page.addInitScript(value=>localStorage.setItem('fbz_appearance',JSON.stringify(value)),{theme,accent});
      await page.goto(`/profile/${own}?__e2e=1`);
      await expect(page.locator('.profile-diary')).toBeVisible();
      await page.addScriptTag({url: "/node_modules/axe-core/axe.min.js"});
      const violations=await page.evaluate(async()=>{
        const result=await axe.run(document.querySelector('#profileW'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
        return result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));
      });
      expect(violations).toEqual([]);
    }
  });
}


for(const width of [320,390,1440]){
  test('гостевой экран и вход сохраняют читаемость на '+width+'px',async({page},testInfo)=>{
    await page.setViewportSize({width,height:900});
    await page.addInitScript(()=>{window.__FOOTBAZED_TEST_CLIENT__.auth.getSession=async()=>({data:{session:null},error:null});});
    await page.goto('/?__e2e=1');
    await expect(page.locator('.hero h1')).toContainText('У каждого матча');
    await expect(page.locator('.guest-guide')).toBeVisible();
    expect(await page.locator('.hero-btns button').first().evaluate(e=>e.getBoundingClientRect().height)).toBeLessThanOrEqual(64);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.evaluate(()=>document.fonts.ready);
    await expect(page).toHaveScreenshot('guest-'+width+'.png',{animations:'disabled',maxDiffPixelRatio:.03});
    await page.locator('.hero-btns').getByRole('button',{name:'Начать свой дневник'}).click();
    await expect(page.locator('#authOv')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:testInfo.outputPath('guest-auth.png')});
  });
}

for(const width of [390,1440]){
  test('профиль и публикация сохраняют композицию '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/profile/'+own+'?__e2e=1');
    await expect(page.locator('.profile-diary')).toBeVisible();
    await page.evaluate(()=>document.fonts.ready);
    await expect(page).toHaveScreenshot('profile-'+width+'.png',{animations:'disabled',maxDiffPixelRatio:.03});
    await page.getByRole('button',{name:'Создать карточку'}).click();
    await expect(page.locator('#shareCanvas')).toBeVisible();
    expect(await page.locator('.share-box').evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator('.share-box')).toHaveScreenshot('share-'+width+'.png',{animations:'disabled',maxDiffPixelRatio:.03});
  });
}


test('девятка и десятка используют одинаковый голубой для матча и игрока',async({page})=>{
  await page.goto('/match/101?__e2e=1');
  await page.locator('.md-primary-action').click();
  await page.locator('.rate-star').nth(8).click();
  await expect(page.locator('#rScoreDisp')).toHaveAttribute('data-tone','elite');
  await expect(page.locator('#rScoreDisp')).toHaveCSS('color','rgb(56, 189, 248)');
  await page.locator('.rate-star').nth(9).click();
  await expect(page.locator('#rScoreDisp')).toHaveCSS('color','rgb(56, 189, 248)');
  await page.getByRole('button',{name:/Продолжить/}).click();
  await page.locator('#rating-player-5292').click();
  await page.locator('#playerRatingRange').fill('9');
  await page.locator('#playerRatingRange').dispatchEvent('input');
  await expect(page.locator('#playerRatingValue')).toHaveAttribute('data-tone','elite');
  await expect(page.locator('#playerRatingValue')).toContainText('9/10');
  await expect(page.locator('#playerRatingValue')).toHaveCSS('color','rgb(56, 189, 248)');
  expect(await page.locator('.rating-player-name').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12);
});
