import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

test('guests see the featured match, can open its score, and have one page heading',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await installSupabaseMock(page,{sessionUser:null});
  await page.goto('/?__e2e=1');
  await expect(page.locator('.guest-home-intro')).toBeVisible();
  await expect(page.locator('#homeDashboard')).toBeHidden();
  await expect(page.locator('#homeEditorialTitle')).toContainText('Футбол, который');
  const feature=page.locator('#homeMatchSpotlight');
  await expect(feature.locator('.mc-score-num')).toHaveText('2:1');
  await expect(feature.locator('.fbz-media')).toHaveCount(2);
  await expect(page.locator('#page-home h1')).toHaveCount(1);
  await feature.getByRole('link',{name:/Открыть матч:/}).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/match\/101/);
  await expect(page.locator('.md-hero')).toContainText('Ман Сити');
  expect(errors).toEqual([]);
});

for(const theme of ['dark','light'])for(const accent of ['emerald','ice','gold','mono']){
  test(`editorial home preserves ${theme}/${accent} and mobile club geometry`,async({page},testInfo)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await installSupabaseMock(page);
    await page.addInitScript(value=>localStorage.setItem('fbz_appearance',JSON.stringify(value)),{theme,accent});
    await page.setViewportSize({width:320,height:844});
    await page.goto('/en?__e2e=1');
    await expect(page.locator('#homeEditorialTitle')).toContainText('Football that');
    await expect(page.locator('#homeMatchSpotlight .mc-score-num')).toHaveText('2:1');
    await page.evaluate(()=>document.fonts.ready);
    const geometry=await page.locator('.home-spotlight-score').evaluate(el=>{
      const score=el.querySelector('.mc-score-result').getBoundingClientRect();
      const box=el.getBoundingClientRect();
      if(Math.abs((score.left+score.right-box.left-box.right)/2)>1)return [];
      return [...el.querySelectorAll('.mc-score-team')].map(team=>{
        const name=team.querySelector('.mc-score-name').getBoundingClientRect(),mark=team.querySelector('.fbz-media').getBoundingClientRect();
        return name.top>=mark.bottom-1&&(name.right<=score.left+1||name.left>=score.right-1);
      });
    });
    expect(geometry).toEqual([true,true]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await expect(page.locator('html')).toHaveAttribute('data-accent',accent);
    await page.screenshot({path:testInfo.outputPath(`editorial-${theme}-${accent}-320.png`)});
    expect(errors).toEqual([]);
  });
}

test('scheduled placeholder scores stay absent on both home and calendar',async({page})=>{
  await installSupabaseMock(page,{matches:[{id:101,competition_id:7,league_name:'Champions League',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',home_club_id:24,away_club_id:31,match_date:'2030-08-08T19:00:00Z',status:'scheduled',home_score:0,away_score:0}]});
  await page.goto('/?__e2e=1');
  await expect(page.locator('#homeMatchSpotlight .mc-score-num')).toHaveText('—:—');
  await expect(page.locator('#homeMatchSpotlight')).toContainText('Предстоит');
  await expect(page.locator('#homeMatchSpotlight').getByRole('button',{name:/Оценить/})).toHaveCount(0);
  await page.locator('.nav-center').getByRole('button',{name:'Матчи',exact:true}).click();
  await expect(page.locator('#matchG .mc-score-num')).toHaveText('—:—');
  await expect(page.locator('#matchG')).toContainText('Без счёта');
});

test('a failed featured match is retryable and distinct from an empty calendar',async({page})=>{
  await installSupabaseMock(page);
  await page.goto('/?__e2e=1');
  const feature=page.locator('#homeMatchSpotlight');
  await expect(feature.locator('.mc-score-num')).toHaveText('2:1');
  await page.evaluate(async()=>{
    window.__EDITORIAL_RPC__=sb.rpc.bind(sb);
    sb.rpc=(name,args)=>name==='get_matches_page'?Promise.resolve({error:{message:'offline'}}):window.__EDITORIAL_RPC__(name,args);
    FBZData.invalidate('matches');
    await loadHomeM();
  });
  await expect(feature).toContainText('Не удалось загрузить матчи');
  await expect(feature).not.toContainText('Футбольный календарь готовится');
  await page.evaluate(()=>{sb.rpc=window.__EDITORIAL_RPC__;});
  await feature.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(feature.locator('.mc-score-num')).toHaveText('2:1');
});
