import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {installSupabaseMock} from './mock-supabase.mjs';
const english=createRequire(import.meta.url)('../../locales/en.json');
const own='3615141a-7700-46b8-9ba5-e4f4450537fc';

test('language switch preserves the route, filters and appearance on reload',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await installSupabaseMock(page);
  await page.goto('/matches?__e2e=1&calendar_q=Real');
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await page.getByLabel('Язык интерфейса',{exact:true}).selectOption('en');
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(page).toHaveURL(/\/en\/matches\?__e2e=1&calendar_q=Real/);
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('#page-matches')).toBeVisible();await expect(page).toHaveTitle(/Matches/);
  await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');
  await page.getByRole('button',{name:english['Настройки'],exact:true}).click();
  await expect(page.locator('#setLanguage')).toHaveValue('en');
  await page.locator('#setLanguage').selectOption('ru');
  await page.getByRole('button',{name:english['Сохранить'],exact:true}).click();
  await expect(page).toHaveURL(/\/matches\?__e2e=1&calendar_q=Real/);
  await expect(page.locator('html')).toHaveAttribute('lang','ru');expect(errors).toEqual([]);
});

for(const theme of ['dark','light'])for(const width of [320,390,1440]){
  test(`English navigation, diary and overview remain usable ${theme} ${width}`,async({page},info)=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));await installSupabaseMock(page);
    await page.setViewportSize({width,height:width===1440?1000:844});
    await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'ice'})),theme);
    await page.goto('/en/matches?__e2e=1');await expect(page.locator('#matchG .mcard').first()).toBeVisible();
    await expect(page.locator('#matchG .mc-score-team').first()).toContainText('Real Madrid');
    await page.locator('#matchG .mc-score-block').first().click();await expect(page).toHaveURL(/\/en\/match\/101/);
    await expect(page).toHaveTitle(/Real Madrid/);
    await page.goto('/en/profile/'+own+'?__e2e=1');
    await expect(page.locator('#page-profile')).toBeVisible();
    await expect(page.getByText('Смотрю футбол внимательно.',{exact:true})).toBeVisible();
    await expect(page.locator('#diaryList .rh-row').first()).toContainText('Real Madrid');
    await page.goto('/en/discover?__e2e=1');await expect(page.locator('.statistics-row').first()).toBeVisible();
    await expect(page.locator('#statisticsTitle')).toHaveText(english['Матчи']);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    if(width<900){await page.locator('#accountBtn').click();await page.getByRole('menuitem',{name:/Settings/}).click();}
    else await page.getByRole('button',{name:english['Настройки'],exact:true}).click();
    await expect(page.locator('#setLanguage')).toHaveValue('en');
    await page.evaluate(async()=>{
      await document.fonts.ready;
      await Promise.all(document.getElementById('settingsOv').getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));
    });
    await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
    const violations=await page.evaluate(async()=>(await axe.run(document.getElementById('settingsOv'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>({target:n.target,detail:n.failureSummary}))})));
    expect(violations).toEqual([]);expect(errors).toEqual([]);
    await info.attach('english-settings.png',{body:await page.locator('#settingsOv .settings-box').screenshot(),contentType:'image/png'});
  });
}
test('English lazy search, feed and notifications preserve fan content and localized links',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await installSupabaseMock(page);
  await page.goto('/en/feed?__e2e=1');
  await expect(page.getByText('Сильный второй тайм и отличный контроль центра поля.',{exact:true})).toBeVisible();
  await page.locator('#globalSearchBtn').click();await page.locator('#globalSearchInput').fill('Real');
  await expect(page.getByRole('option',{name:/Real Madrid/}).first()).toBeVisible();
  await page.getByRole('option',{name:/Real Madrid/}).first().click();await expect(page).toHaveURL(/\/en\/(?:club|match)\//);
  await page.locator('#notifBtn').click();await expect(page.locator('.notif-item').first()).toBeVisible();
  await expect(page.locator('.notif-text').first()).not.toContainText(/[А-Яа-яЁё]/u);
  await expect(page.locator('html')).toHaveAttribute('lang','en');expect(errors).toEqual([]);
});

test('English community profile links and copied invitations keep the selected language',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await installSupabaseMock(page);
  await page.goto('/en/friends?__e2e=1');
  await page.locator('[data-tab="incoming"]').click();
  await expect(page.locator('.friend-profile').first()).toHaveAttribute('href','/en/profile/2b854020-9701-4f49-9c36-2b65c9dcd449');
  await page.evaluate(()=>{
    CU.invite_code='EN invitation & test';
    window.copyText=value=>{window.copiedInvitation=value;};
  });
  await page.locator('[data-fbz-click="shell.invite-friend"]').click();
  await expect.poll(()=>page.evaluate(()=>window.copiedInvitation)).toBeTruthy();
  const url=new URL(await page.evaluate(()=>window.copiedInvitation));
  expect(url.pathname).toBe('/en');expect(url.searchParams.get('invite')).toBe('EN invitation & test');
  await page.locator('.friend-profile').first().click();
  await expect(page).toHaveURL(/\/en\/profile\/2b854020-9701-4f49-9c36-2b65c9dcd449/);
  expect(errors).toEqual([]);
});

test('English squad preserves legacy position identities and uses English count rules',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await installSupabaseMock(page);
  await page.goto('/en/club/24?__e2e=1');await expect(page.locator('.entity-hero h1')).toHaveText('Real Madrid CF');
  await page.evaluate(async()=>{
    const rpc=sb.rpc.bind(sb);
    sb.rpc=async(name,args)=>{
      const result=await rpc(name,args);
      if(name==='get_club_page')result.data.squad[0]={...result.data.squad[0],position:'Вратарь',rating_count:21};
      return result;
    };
    await FBZEntities.loadClub(24);
  });
  await page.locator('#clubTabs [data-tab="squad"]').click();
  const goalkeepers=page.locator('.squad-group').filter({has:page.getByRole('heading',{name:'Goalkeepers',exact:true})});
  await expect(goalkeepers.locator('.squad-player-copy')).toContainText('Thibaut Courtois');
  await expect(goalkeepers.locator('.squad-player-copy small')).toHaveText('Goalkeeper');
  await expect(goalkeepers.locator('.squad-player-rating small')).toHaveText('21 ratings');
  expect(errors).toEqual([]);
});
