import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const fixture={id:101,competition_id:7,league_name:'Champions League',home_club_id:24,away_club_id:31,home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',match_date:'2026-09-19T23:30:00Z',status:'finished',home_score:0,away_score:0};
const fixtures=[fixture,{...fixture,id:102,status:'scheduled'}, {...fixture,id:103,home_score:2,away_score:null}, {...fixture,id:104,status:'postponed',match_date:null}, {...fixture,id:105,status:'UNEXPECTED_PROVIDER_STATUS'}, {...fixture,id:106,home_club_id:31,away_club_id:24,home_team_name:'Manchester City FC',away_team_name:'Real Madrid CF',home_score:1,away_score:3}];
const errors=new WeakMap();
test.beforeEach(async({page})=>{
  const list=[];errors.set(page,list);page.on('pageerror',error=>list.push(error.message));
  await installSupabaseMock(page,{matches:fixtures});
});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

for(const language of ['ru','en'])for(const width of [320,390,1440]){
  test(`football metadata, score states and entity layouts ${language} ${width}`,async({page},info)=>{
    const prefix=language==='en'?'/en':'',country=language==='en'?'Spain':'Испания';
    await page.setViewportSize({width,height:width<900?844:1000});
    await page.goto(prefix+'/club/24?__e2e=1');
    await expect(page.locator('.entity-meta')).toContainText(country);
    await expect(page.locator('.entity-meta')).toContainText('Santiago Bernabéu');
    await page.locator('#clubTabs [data-tab="matches"]').click();
    const clubRows=page.locator('.entity-match-main');
    await expect(clubRows).toHaveCount(6);
    await expect(clubRows.nth(0).locator('.entity-result-score')).toHaveText('0:0');
    for(const index of [1,2,3,4])await expect(clubRows.nth(index).locator('.entity-result-score')).toHaveText('—');
    await expect(clubRows.nth(5).locator('.entity-result-score')).toHaveText('3:1');
    await expect(clubRows.nth(3)).toContainText(language==='en'?'Date to be confirmed':'Дата уточняется');
    await expect(clubRows.nth(4)).not.toContainText('UNEXPECTED_PROVIDER_STATUS');
    await expect(clubRows.nth(0)).toHaveAttribute('href',prefix+'/match/101');
    const localDate=await page.evaluate(({date,language})=>new Date(date).toLocaleDateString(language==='en'?'en-GB':'ru-RU',{day:'numeric',month:'short',year:'numeric'}),{date:fixture.match_date,language});
    await expect(clubRows.first().locator('.entity-match-date')).toHaveText(localDate);
    await page.goto(prefix+'/competition/7?__e2e=1');
    await expect(page.locator('.entity-meta')).toHaveText(language==='en'?'EuropeCup':'ЕвропаКубок');
    const rows=page.locator('.competition-match-row');
    await expect(rows).toHaveCount(6);
    await expect(rows.nth(5).locator('.entity-result-score')).toHaveText('1:3');
    for(const theme of ['dark','light']){
      for(const accent of ['emerald','ice','gold','mono']){
        await page.evaluate(({theme,accent})=>{document.documentElement.dataset.theme=theme;document.documentElement.dataset.accent=accent;},{theme,accent});
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
        const boxes=await rows.first().evaluate(row=>{
          const names=[...row.querySelectorAll('strong')].map(element=>element.getBoundingClientRect().toJSON()),score=row.querySelector('.entity-result-score').getBoundingClientRect().toJSON(),rect=row.getBoundingClientRect();
          return {names,score,height:rect.height};
        });
        expect(boxes.height).toBeGreaterThanOrEqual(44);
        expect(boxes.names[0].right).toBeLessThanOrEqual(boxes.score.left+1);
        expect(boxes.score.right).toBeLessThanOrEqual(boxes.names[1].left+1);
      }
      await page.evaluate(()=>document.documentElement.dataset.accent='ice');
      await page.evaluate(()=>document.fonts.ready);
      if(language==='ru'&&width!==320&&info.project.name==='chromium'){
        // A tall element capture can put fixed navigation halfway through the image.
        // At phone width capture the real viewport with its navigation in place.
        if(width<900){await page.locator('.competition-match-list').evaluate(element=>element.parentElement.scrollIntoView({block:'start'}));await expect(page).toHaveScreenshot(`football-details-${width}-${theme}.png`,{animations:'disabled',caret:'hide',maxDiffPixelRatio:.015});}
        else await expect(page.locator('#competitionC')).toHaveScreenshot(`football-details-${width}-${theme}.png`,{animations:'disabled',caret:'hide',maxDiffPixelRatio:.015});
      }
    }
    await page.evaluate(()=>document.documentElement.style.fontSize='200%');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    const enlarged=await rows.first().evaluate(row=>{
      const [home,away]=[...row.querySelectorAll('strong')].map(e=>e.getBoundingClientRect().toJSON()),element=row.querySelector('.entity-result-score'),score=element.getBoundingClientRect().toJSON();
      return {home,away,score,fontSize:Number.parseFloat(getComputedStyle(element).fontSize)};
    });
    expect(enlarged.fontSize).toBe(34);
    expect(enlarged.home.right).toBeLessThanOrEqual(enlarged.score.left+1);expect(enlarged.score.right).toBeLessThanOrEqual(enlarged.away.left+1);
    await page.evaluate(()=>document.documentElement.style.fontSize='');
    await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
    expect(await page.evaluate(async()=>(await axe.run(document.getElementById('competitionC'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>v.id))).toEqual([]);
  });
}

for(const language of ['ru','en']){
  test(`country and position localization never translates fan names ${language}`,async({page})=>{
    const prefix=language==='en'?'/en':'';
    await page.addInitScript(()=>{
      const original=window.__FOOTBAZED_TEST_CLIENT__.rpc;
      window.__FOOTBAZED_TEST_CLIENT__.rpc=(name,args)=>name==='search_footbazed_v2'?Promise.resolve({error:null,data:[
        {entity_type:'club',entity_id:'24',title:'Real Madrid CF',subtitle:'Spain',meta:'RMA'},
        {entity_type:'competition',entity_id:'7',title:'Champions League',subtitle:'Europe',meta:'CL'},
        {entity_type:'player',entity_id:'5290',title:'Thibaut Courtois',subtitle:'Real Madrid CF',meta:'Вратарь'},
        {entity_type:'user',entity_id:'3615141a-7700-46b8-9ba5-e4f4450537fc',title:'England',subtitle:'@Spain',meta:'Профиль'}
      ]}):original(name,args);
    });
    await page.goto(prefix+'/club/24?__e2e=1');
    await page.locator('#globalSearchBtn').click();await page.locator('#globalSearchInput').fill('Real');
    await expect(page.getByRole('option',{name:/RMA/})).toContainText(language==='en'?'Spain':'Испания');
    await expect(page.getByRole('option',{name:/Thibaut Courtois/})).toContainText(language==='en'?'Goalkeeper':'Вратарь');
    await expect(page.getByRole('option',{name:/England/})).toHaveText('England@Spain→');
    await page.keyboard.press('Escape');
    await page.locator('#clubTabs [data-tab="squad"]').click();
    const player=page.getByRole('link',{name:/Thibaut Courtois/});
    await expect(player).toHaveAttribute('href',prefix+'/player/5290');
    await player.focus();await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(prefix+'/player/5290'));
    await expect(page).toHaveTitle(/Thibaut Courtois/);
    const club=page.locator('.entity-meta .entity-text-link');
    await expect(club).toHaveAttribute('href',prefix+'/club/24');await club.click();
    await expect(page).toHaveURL(new RegExp(prefix+'/club/24'));
  });
}

test('entity links retain modifier behavior and match targets',async({page})=>{
  await page.goto('/club/24?__e2e=1');
  await page.locator('#clubTabs [data-tab="matches"]').click();
  const link=page.locator('.entity-match-main').first();
  const popupPromise=page.context().waitForEvent('page');
  await link.click({modifiers:['Control']});const popup=await popupPromise;
  await expect(popup).toHaveURL(/\/match\/101/);await popup.close();
  await expect(page).toHaveURL(/\/club\/24/);
  await link.focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/match\/101/);await expect(page.locator('.md-hero')).toBeVisible();
});
