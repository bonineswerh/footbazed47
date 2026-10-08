import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
const own='3615141a-7700-46b8-9ba5-e4f4450537fc';
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);}
async function accessible(page,selector){
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
  expect(await page.evaluate(async selector=>(await axe.run(document.querySelector(selector),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),selector)).toEqual([]);
}
test('calendar browses without loading matches, clamps leap dates and restores trigger focus',async({page})=>{
  await installSupabaseMock(page);await page.goto('/matches?__e2e=1&m_day=2024-03-31&m_favorites=1');
  await expect(page.locator('#matchG')).toHaveAttribute('aria-busy','false');
  const calls=await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.calls().length),trigger=page.getByRole('button',{name:'Выбрать дату',exact:true});
  await trigger.click();const picker=page.getByRole('dialog',{name:'Выбрать дату',exact:true});await expect(picker).toBeVisible();
  await expect(picker.locator('[data-picker-day="2024-03-31"]')).toBeFocused();
  await page.keyboard.press('PageUp');await expect(picker.locator('[data-picker-day="2024-02-29"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');await expect(picker.locator('[data-picker-day="2024-03-01"]')).toBeFocused();
  expect(await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.calls().length)).toBe(calls);
  await page.keyboard.press('Enter');await expect(picker).toBeHidden();await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/m_day=2024-03-01.*m_favorites=1/);
  await trigger.click();await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
});
test('calendar cannot browse past supported years and is closed on a route change',async({page})=>{
  await installSupabaseMock(page);await page.goto('/matches?__e2e=1&m_day=1000-01-01');await page.getByRole('button',{name:'Выбрать дату',exact:true}).click();
  await expect(page.getByRole('button',{name:'Предыдущий месяц'})).toBeDisabled();
  await page.keyboard.press('Escape');await page.goto('/matches?__e2e=1&m_day=9999-12-31');await page.getByRole('button',{name:'Выбрать дату',exact:true}).click();
  await expect(page.getByRole('button',{name:'Следующий месяц'})).toBeDisabled();
  await page.evaluate(()=>go('leaderboard'));await expect(page.locator('#calendarDateOv')).toBeHidden();expect(await page.locator('body').evaluate(el=>el.classList.contains('modal-open'))).toBe(false);
});
for(const theme of ['dark','light'])for(const accent of ['emerald','ice','gold','mono'])test(`calendar selection has accessible contrast in ${theme} ${accent}`,async({page})=>{
  await installSupabaseMock(page);await page.addInitScript(({theme,accent})=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent})),{theme,accent});
  await page.goto('/matches?__e2e=1&m_day=2024-02-29');await page.getByRole('button',{name:'Выбрать дату',exact:true}).click();await expect(page.locator('[data-picker-day="2024-02-29"]')).toHaveAttribute('aria-pressed','true');await accessible(page,'#calendarDateOv');
});
for(const theme of ['dark','light'])for(const width of [320,390,1440])test(`panels keep readable fields and reachable actions ${theme} ${width}`,async({page},info)=>{
  await installSupabaseMock(page);await page.setViewportSize({width,height:width===1440?1000:844});await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'ice'})),theme);
  await page.goto('/matches?__e2e=1&m_day=2024-02-29');await page.getByRole('button',{name:'Выбрать дату',exact:true}).click();
  await accessible(page,'#calendarDateOv');await noOverflow(page);
  for(const button of await page.locator('.calendar-month-day').all()){const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
  await expect(page.locator('#calendarDateOv footer')).toBeInViewport();await info.attach('calendar-panel.png',{body:await page.locator('.calendar-panel').screenshot(),contentType:'image/png'});
  if(width!==320)await expect(page.locator('.calendar-panel')).toHaveScreenshot(`calendar-${theme}-${width}.png`,{animations:'disabled',maxDiffPixelRatio:.01});
  await page.addStyleTag({content:'html{font-size:200%}'});await noOverflow(page);await expect(page.locator('#calendarDateOv footer')).toBeInViewport();await page.keyboard.press('Escape');
  await page.goto('/profile/'+own+'?__e2e=1');await page.getByRole('button',{name:'Редактировать',exact:true}).click();
  await expect(page.locator('#epSaveBtn')).toBeInViewport();await accessible(page,'#profileEditOv');await noOverflow(page);
  await page.locator('.profile-editor-body').evaluate(el=>el.scrollTop=el.scrollHeight);await expect(page.locator('#epSaveBtn')).toBeInViewport();
  await info.attach('profile-editor.png',{body:await page.locator('.profile-editor').screenshot(),contentType:'image/png'});
  if(width!==320)await expect(page.locator('.profile-editor')).toHaveScreenshot(`profile-editor-${theme}-${width}.png`,{animations:'disabled',maxDiffPixelRatio:.01});
  await page.addStyleTag({content:'html{font-size:200%}'});await noOverflow(page);await expect(page.locator('#epSaveBtn')).toBeInViewport();await page.keyboard.press('Escape');
});
for(const width of [320,390,1440])test(`scores and crests occupy separate central cells ${width}`,async({page})=>{
  await installSupabaseMock(page);await page.setViewportSize({width,height:1000});await page.goto('/discover?__e2e=1');
  const row=page.locator('.statistics-row').first();await expect(row).toBeVisible();
  const teams=await row.locator('.statistics-team').all(),score=await row.locator('.statistics-result').boundingBox();
  const left=await teams[0].boundingBox(),right=await teams[1].boundingBox();expect(left.x+left.width).toBeLessThanOrEqual(score.x);expect(score.x+score.width).toBeLessThanOrEqual(right.x);
  for(const team of teams){const mark=await team.locator('.collection-mark').boundingBox(),name=await team.locator('span').last().boundingBox();expect(mark.y+mark.height).toBeLessThanOrEqual(name.y);expect(mark.width).toBeGreaterThanOrEqual(36);}
  await page.getByRole('button',{name:'Клубы',exact:true}).click();const styles=await page.locator('.statistics-row').evaluateAll(rows=>rows.map(row=>({primary:row.style.getPropertyValue('--club-home'),secondary:row.style.getPropertyValue('--club-home-secondary'),paint:getComputedStyle(row).backgroundImage})));
  expect(styles.length).toBe(2);expect(styles[0].primary).not.toBe(styles[1].primary);expect(styles[0].paint).not.toBe(styles[1].paint);await noOverflow(page);
});
test('long names do not move either crest or the central score',async({page})=>{
  await installSupabaseMock(page);await page.setViewportSize({width:320,height:844});
  await page.addInitScript(()=>{const rpc=window.__FOOTBAZED_TEST_CLIENT__.rpc;window.__FOOTBAZED_TEST_CLIENT__.rpc=async(name,args)=>{const result=await rpc(name,args);if(name==='get_football_statistics')result.data.items[0]={...result.data.items[0],home_team_name:'Tottenham Hotspur FC',away_team_name:'Borussia Mönchengladbach'};return result;};});
  await page.goto('/discover?__e2e=1');const row=page.locator('.statistics-row').first();await expect(row).toBeVisible();
  const marks=await row.locator('.collection-mark').all(),a=await marks[0].boundingBox(),b=await marks[1].boundingBox(),score=await row.locator('.statistics-result').boundingBox();
  expect(Math.abs(a.y-b.y)).toBeLessThanOrEqual(1);expect(Math.abs(a.y+a.height/2-score.y-score.height/2)).toBeLessThanOrEqual(1);
  await noOverflow(page);await accessible(page,'#statisticsRoot');
});
for(const width of [320,390,1440])test(`rail ticks agree with actual slider positions ${width}`,async({page})=>{
  await installSupabaseMock(page);await page.setViewportSize({width,height:1000});await page.goto('/match/101?__e2e=1');await page.locator('.md-primary-action').click();
  const rail=page.locator('#matchRatingRange');await expect(rail).toBeVisible();const box=await rail.boundingBox();
  const centres=await page.locator('#rS1 .rating-rail-labels span').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect();return box.x+box.width/2;}));
  for(const [i,value] of [0,5,10].entries()){const x=box.x+14+(box.width-28)*value/10;expect(Math.abs(x-centres[i])).toBeLessThanOrEqual(1);await page.mouse.click(x,box.y+box.height/2);await expect(rail).toHaveValue(String(value));}
  await page.mouse.click(box.x+14+(box.width-28)/10,box.y+box.height/2);await expect(rail).toHaveValue('1');
  await page.locator('#starsR .rate-star').filter({hasText:/^10$/}).click();await expect(rail).toHaveValue('10');await expect(page.locator('#rScoreDisp')).toHaveAttribute('data-tone','elite');await noOverflow(page);
});
