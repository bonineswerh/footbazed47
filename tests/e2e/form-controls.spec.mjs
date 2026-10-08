import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
async function accessible(page,selector){
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
  expect(await page.evaluate(async selector=>(await axe.run(document.querySelector(selector),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})),selector)).toEqual([]);
}
test.beforeEach(async({page})=>{await installSupabaseMock(page);});
test('one rating axis has eleven aligned ticks; exact choice updates both editors',async({page})=>{
  await page.goto('/match/101?__e2e=1');await page.locator('.md-primary-action').click();
  await page.locator('#matchRatingRange').fill('9');await expect(page.locator('#matchRatingRange')).toHaveValue('9');await expect(page.locator('#rScoreDisp')).toHaveText('9/10');await expect(page.locator('#starsR')).toHaveCount(0);
  await page.getByRole('button',{name:/Продолжить/}).click();await page.locator('#rating-player-5291').click();await page.locator('#playerExactScore').click();await expect(page.locator('.fbz-control-panel')).toBeVisible();await page.locator('.fbz-control-panel').getByRole('option',{name:'10 / 10',exact:true}).click();await expect(page.locator('#playerRatingRange')).toHaveValue('10');await expect(page.locator('#playerRatingValue')).toHaveText('10/10');
  await page.locator('#playerRatingRange').press('ArrowLeft');await expect(page.locator('#playerExactScore')).toHaveValue('9');
});
test('keyboard selects a filter and Escape closes only its picker',async({page})=>{
  await page.goto('/discover?__e2e=1');await page.locator('#statisticsFilters-open').click();
  const field=page.locator('#statisticsFilters-min_votes');await field.focus();await field.press('Enter');await expect(page.locator('.fbz-control-panel')).toBeVisible();
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect(field).toHaveValue('5');await expect(field).toBeFocused();await expect(page).toHaveURL(/ov_min_votes=5/);
  await field.press('Enter');await page.keyboard.press('Escape');await expect(page.locator('.fbz-control-panel')).toHaveCount(0);await expect(page.getByRole('dialog',{name:'Фильтры'})).toBeVisible();await expect(field).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Фильтры'})).toBeHidden();await expect(page.locator('#statisticsFilters-open')).toBeFocused();
});
test('picker choices retain actual club dependencies and reset behavior',async({page})=>{
  await page.goto('/discover?__e2e=1');await page.locator('#statisticsFilters-open').click();await page.getByLabel('Турнир',{exact:true}).click();
  await expect(page.locator('.fbz-control-panel')).toBeVisible();
  await page.getByRole('option',{name:'Лига чемпионов',exact:true}).click();await expect(page.getByLabel('Турнир',{exact:true})).toHaveValue('7');
  await page.getByLabel('Клуб',{exact:true}).click();await expect(page.getByRole('option',{name:/Ювентус/})).toHaveCount(0);await expect(page.getByRole('option',{name:'Реал Мадрид',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Сбросить',exact:true}).click();await expect(page.getByLabel('Турнир',{exact:true})).toHaveValue('');
});
for(const theme of ['dark','light'])for(const width of [320,390,1440])test(`custom lists and calendars remain accessible ${theme} ${width}`,async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:844});await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'ice'})),theme);
  await page.goto('/discover?__e2e=1');await page.getByLabel('Порядок').click();await expect(page.locator('.fbz-control-panel')).toBeVisible();await accessible(page,'.fbz-control-panel');
  for(const option of await page.locator('.fbz-control-option').all()){const box=await option.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);}
  await info.attach('select.png',{body:await page.locator('.fbz-control-panel').screenshot(),contentType:'image/png'});await page.keyboard.press('Escape');await page.locator('#statisticsFilters-open').click();
  const date=page.getByLabel('Матчи с');await date.fill('2024-03-31');await date.click();const calendar=page.locator('.fbz-control-panel.is-date');await expect(calendar).toBeVisible();
  await accessible(page,'#statisticsFilters-sheet');
  await page.keyboard.press('PageUp');await expect(calendar.locator('[data-day="2024-02-29"]')).toBeFocused();await accessible(page,'#statisticsFilters-sheet');
  for(const day of await calendar.locator('.fbz-control-day').all()){const box=await day.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
  await info.attach('date.png',{body:await calendar.screenshot(),contentType:'image/png'});await page.keyboard.press('Enter');await expect(date).toHaveValue('2024-02-29');await expect(date).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.addStyleTag({content:'html{font-size:200%}'});await date.click();await expect(calendar).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);await page.keyboard.press('Escape');expect(errors).toEqual([]);
});
test('outside click and route changes release the picker without stale selection',async({page})=>{
  await page.goto('/discover?__e2e=1');await page.getByLabel('Порядок').click();await page.getByRole('heading',{name:'Обзор',exact:true}).click();await expect(page.locator('.fbz-control-panel')).toHaveCount(0);
  await page.getByLabel('Порядок').click();await page.evaluate(()=>go('matches'));await expect(page.locator('.fbz-control-panel')).toHaveCount(0);await expect(page.locator('body')).not.toHaveClass(/modal-open/);
});
test('player numeric choices retain an exact value without duplicate match descriptions',async({page})=>{
  await page.goto('/match/101?__e2e=1');await page.locator('.md-primary-action').click();await page.locator('#matchRatingRange').fill('9');await expect(page.locator('#rScoreLabel')).toHaveText('Великолепно');await expect(page.locator('#rS1 select')).toHaveCount(0);
  await page.getByRole('button',{name:/Продолжить/}).click();await page.locator('#rating-player-5291').click();await page.locator('#playerExactScore').click();await page.getByRole('searchbox',{name:'Поиск вариантов'}).fill('9 / 10');await expect(page.getByRole('option')).toHaveCount(1);await page.getByRole('option').click();await expect(page.locator('#playerRatingRange')).toHaveValue('9');
});

test('search inside a picker does not reload football statistics',async({page})=>{
  await page.addInitScript(()=>{const rpc=window.__FOOTBAZED_TEST_CLIENT__.rpc;window.__controlStatsCalls=0;window.__FOOTBAZED_TEST_CLIENT__.rpc=async(name,args)=>{const result=await rpc(name,args);if(name==='get_football_statistics'){window.__controlStatsCalls++;result.data.clubs.push(...Array.from({length:8},(_,i)=>({id:900+i,name:'Club '+i,competition_ids:[7]})));}return result;};});
  await page.goto('/discover?__e2e=1');await expect(page.locator('.statistics-row')).toBeVisible();const calls=await page.evaluate(()=>window.__controlStatsCalls);await page.locator('#statisticsFilters-open').click();await page.getByLabel('Клуб',{exact:true}).click();await page.getByRole('searchbox',{name:'Поиск клубов'}).fill('Club 5');await expect(page.locator('.fbz-control-panel').getByRole('option')).toHaveCount(1);await page.waitForTimeout(450);expect(await page.evaluate(()=>window.__controlStatsCalls)).toBe(calls);
});
test('Escape cancels a picker still loading without a late popup',async({page})=>{
  let release;await page.route('**/js/form-controls.js?*',async route=>{await new Promise(resolve=>release=resolve);await route.continue();});
  await page.goto('/discover?__e2e=1');await page.getByLabel('Порядок').click();await expect.poll(()=>Boolean(release)).toBe(true);await page.keyboard.press('Escape');release();await expect.poll(()=>page.evaluate(()=>Boolean(window.FBZFormControls)&&document.querySelector('#formControlStyles')?.dataset.loaded==='true')).toBe(true);await expect(page.locator('.fbz-control-panel')).toHaveCount(0);
  await page.getByLabel('Порядок').click();await expect(page.locator('.fbz-control-panel')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByLabel('Порядок')).toBeFocused();
});
test('a failed picker stylesheet can be retried through the lazy loader',async({page})=>{
  let blocked=true;await page.route('**/css/form-controls.css?*',route=>{if(blocked){blocked=false;return route.abort();}return route.continue();});
  await page.goto('/discover?__e2e=1');await page.getByLabel('Порядок').click();await expect(page.locator('#toast')).toContainText('Не удалось загрузить раздел');await expect(page.locator('.fbz-control-panel')).toHaveCount(0);
  await page.getByLabel('Порядок').click();await expect(page.locator('.fbz-control-panel')).toBeVisible();await expect(page.locator('#formControlStyles')).toHaveAttribute('data-loaded','true');
});
