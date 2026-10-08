import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
const crest={asset_type:'club_logo',usage_status:'identification',source_provider:'api-football',url:'https://media.api-sports.io/football/teams/541.png'};
for(const language of ['ru','en'])test(`entity choice uses one search, bilingual names and approved marks: ${language}`,async({page})=>{
  await installSupabaseMock(page,{clubMarks:[{id:24,name:'Real Madrid CF',media:crest}]});
  await page.route('https://media.api-sports.io/football/teams/541.png',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="white"/></svg>'}));
  await page.goto((language==='en'?'/en':'')+'/discover?__e2e=1');await expect(page.locator('.statistics-row')).toBeVisible();
  await page.locator('#statisticsFilters-open').click();await expect(page.locator('[data-options-query]')).toHaveCount(0);await page.locator('#statisticsFilters-club_id').click();
  const popup=page.locator('.fbz-control-panel'),search=popup.getByRole('searchbox');await expect(search).toHaveCount(1);
  await search.fill(language==='ru'?'Real Madrid':'Реал Мадрид');await expect(popup.getByRole('option')).toHaveCount(1);const choice=popup.getByRole('option');
  await expect(choice.locator('img')).toBeVisible();await expect(choice.locator('img')).toHaveAttribute('src',crest.url);await expect(search).toBeFocused();
  await choice.click();await expect(page.locator('#statisticsFilters-club_id')).toHaveValue('24');await expect(page).toHaveURL(/ov_club_id=24/);
});
test('visible club marks are batched, reused across searches, and survive media failure',async({page})=>{
  await installSupabaseMock(page);
  await page.addInitScript(()=>{const rpc=window.__FOOTBAZED_TEST_CLIENT__.rpc;window.__choiceMarkCalls=[];window.__choiceStatsCalls=0;window.__FOOTBAZED_TEST_CLIENT__.rpc=async(name,args)=>{const result=await rpc(name,args);if(name==='get_football_statistics'){window.__choiceStatsCalls++;result.data.clubs.push(...Array.from({length:120},(_,i)=>({id:900+i,name:'Club '+String(i).padStart(3,'0'),competition_ids:[7]})));}if(name==='get_club_marks')window.__choiceMarkCalls.push(args.p_ids);return result;};});
  await page.goto('/discover?__e2e=1');await expect(page.locator('.statistics-row')).toBeVisible();const stats=await page.evaluate(()=>window.__choiceStatsCalls);
  await page.locator('#statisticsFilters-open').click();await page.locator('#statisticsFilters-club_id').click();const search=page.locator('.fbz-control-panel').getByRole('searchbox');
  await page.locator('.fbz-control-list').evaluate(el=>{el.scrollTop=el.scrollHeight;});await expect.poll(()=>page.evaluate(()=>window.__choiceMarkCalls.some(ids=>ids.includes(1019)))).toBe(true);
  await search.fill('Club 119');await expect(page.locator('.fbz-control-panel').getByRole('option')).toHaveCount(1);await expect(page.locator('.fbz-control-panel').getByRole('option').locator('.is-fallback')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__choiceMarkCalls.some(ids=>ids.includes(1019)))).toBe(true);const calls=await page.evaluate(()=>window.__choiceMarkCalls.length);
  await search.fill('Club 11');await search.fill('Club 119');await page.waitForTimeout(200);
  expect(await page.evaluate(()=>window.__choiceStatsCalls)).toBe(stats);expect(await page.evaluate(()=>window.__choiceMarkCalls.length)).toBeLessThanOrEqual(calls+1);expect(await page.evaluate(()=>window.__choiceMarkCalls.every(ids=>ids.length<=48))).toBe(true);
  await page.locator('.fbz-control-panel').getByRole('option').click();await expect(page.locator('#statisticsFilters-club_id')).toHaveValue('1019');
});
for(const width of [320,390,1440])test(`entity choices stay within the viewport with enlarged text: ${width}`,async({page})=>{
  await installSupabaseMock(page);await page.setViewportSize({width,height:844});await page.goto('/discover?__e2e=1');await expect(page.locator('.statistics-row')).toBeVisible();await page.addStyleTag({content:'html{font-size:200%}'});
  await page.locator('#statisticsFilters-open').click();await page.locator('#statisticsFilters-club_id').click();const popup=page.locator('.fbz-control-panel');await expect(popup).toBeVisible();
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});expect(await page.evaluate(async()=>(await axe.run(document.querySelector('.fbz-control-panel'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>v.id))).toEqual([]);
  const box=await popup.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');await expect(page.locator('#statisticsFilters-club_id')).toBeFocused();
});
test('late catalogue remains searchable without stealing keyboard focus',async({page})=>{
  await installSupabaseMock(page);await page.addInitScript(()=>{const rpc=window.__FOOTBAZED_TEST_CLIENT__.rpc;window.__FOOTBAZED_TEST_CLIENT__.rpc=async(name,args)=>{const result=await rpc(name,args);if(name==='get_football_statistics')await new Promise(resolve=>setTimeout(resolve,1000));return result;};});
  await page.goto('/discover?__e2e=1');await page.locator('#statisticsFilters-open').click();await page.locator('#statisticsFilters-club_id').click();const search=page.locator('.fbz-control-panel').getByRole('searchbox');
  await search.fill('Манчестер Сити');await expect(search).toBeFocused();await expect(page.getByRole('option',{name:'Ман Сити',exact:true})).toBeVisible();await expect(search).toHaveValue('Манчестер Сити');await expect(search).toBeFocused();
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect(page.locator('#statisticsFilters-club_id')).toHaveValue('31');
});
for(const theme of ['dark','light'])test(`selected league uses primary button text color: ${theme}`,async({page})=>{
  await installSupabaseMock(page);await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'ice'})),theme);await page.goto('/matches?__e2e=1');await expect(page.locator('.league-tab.on')).toBeVisible();
  const leagueColor=await page.locator('.league-tab.on').evaluate(el=>getComputedStyle(el).color),buttonColor=await page.locator('.mbtn.lime').first().evaluate(el=>getComputedStyle(el).color);
  expect(leagueColor).toBe(buttonColor);if(theme==='dark')expect(leagueColor).toBe('rgb(6, 17, 13)');
});
