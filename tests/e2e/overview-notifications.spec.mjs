import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

test('overview offers subject search, inline sorting and native entity links',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await installSupabaseMock(page);await page.goto('/discover?__e2e=1');
  await expect(page.locator('#statisticsCount')).toHaveText('1 матч');
  await expect(page.getByPlaceholder('Найти матч',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Порядок',{exact:true})).toBeInViewport();
  const row=page.locator('.statistics-row').first();await expect(row).toHaveAttribute('href','/match/101');
  await expect(row.locator('.statistics-team')).toHaveCount(2);
  await expect(row.locator('.statistics-result')).toHaveText('2 : 1');
  await expect(row.locator('.statistics-score')).toHaveText('9.0/10');
  await page.getByLabel('Порядок',{exact:true}).selectOption('votes');
  await expect(page).toHaveURL(/ov_sort=votes/);await expect(row).toHaveAttribute('href','/match/101');
  await page.getByRole('button',{name:'Клубы',exact:true}).click();
  await expect(page.getByPlaceholder('Найти клуб',{exact:true})).toBeVisible();
  await expect(page.locator('#statisticsCount')).toHaveText('2 клуба');
  await expect(row).toHaveAttribute('href',/\/club\/\d+/);
  await expect(row.locator('.statistics-meta')).toHaveText('1 матч');
  await page.getByRole('button',{name:'Игроки',exact:true}).click();
  await expect(page.getByPlaceholder('Найти игрока',{exact:true})).toBeVisible();
  await expect(row).toHaveAttribute('href',/\/player\/\d+/);
  await page.getByRole('button',{name:'Турниры',exact:true}).click();
  await expect(page.getByPlaceholder('Найти турнир',{exact:true})).toBeVisible();
  await expect(row).toHaveAttribute('href',/\/competition\/\d+/);
  await row.focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/competition\/7/);
  expect(errors).toEqual([]);
});

test('overview distinguishes a genuine 0:0 from missing goals and bad dates',async({page})=>{
  await installSupabaseMock(page);
  await page.addInitScript(()=>{
    const rpc=window.__FOOTBAZED_TEST_CLIENT__.rpc;
    window.__FOOTBAZED_TEST_CLIENT__.rpc=async(name,args)=>{
      const result=await rpc(name,args);
      if(name==='get_football_statistics'){
        const item=result.data.items[0];
        result.data.items=[{...item,home_score:0,away_score:0},{...item,entity_id:102,home_score:2,away_score:null,latest:'bad-date'}];
        result.data.total=2;
      }return result;
    };
  });
  await page.goto('/discover?__e2e=1');
  await expect(page.locator('.statistics-result')).toHaveText(['0 : 0','Счёт уточняется']);
  await expect(page.locator('#statisticsList')).not.toContainText(/NaN|Invalid Date|2 : 0/);
  await expect(page.locator('.statistics-row').last().locator('time')).toHaveCount(0);
});

test('English overview links preserve native modified clicks',async({page})=>{
  await installSupabaseMock(page);await page.goto('/en/discover?__e2e=1');
  const row=page.locator('.statistics-row').first();await expect(row).toHaveAttribute('href','/en/match/101');
  const popupPromise=page.context().waitForEvent('page',{timeout:5000});await row.click({modifiers:['Control']});
  const popup=await popupPromise;await popup.waitForURL(/\/en\/match\/101$/,{waitUntil:'commit'});await popup.close();
  await expect(page).toHaveURL(/\/en\/discover/);await expect(page.getByLabel('Order',{exact:true})).toBeVisible();
});

test('a modal isolates the underlying controls and restores them and the trigger on close',async({page})=>{
  await installSupabaseMock(page);await page.goto('/discover?__e2e=1');await expect(page.locator('.statistics-row')).toBeVisible();
  await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Поиск'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Порядок',exact:true})).toHaveCount(0);
  expect(await page.locator('#page-leaderboard').evaluate(el=>el.inert)).toBe(true);
  await page.keyboard.press('Escape');await expect(page.locator('#globalSearchBtn')).toBeFocused();
  await expect(page.getByRole('combobox',{name:'Порядок',exact:true})).toBeVisible();
  expect(await page.locator('#page-leaderboard').evaluate(el=>el.inert)).toBe(false);
  // Detached filter controls remain usable even though their form owner is in the inert background.
  await page.locator('#statisticsFilters-open').click();
  await page.getByLabel('Минимум оценок').selectOption('5');await expect(page).toHaveURL(/ov_min_votes=5/);
  await page.getByRole('button',{name:'Готово',exact:true}).click();await expect(page.locator('#statisticsFilters-open')).toBeFocused();
  await expect(page.getByRole('button',{name:'Сбросить фильтры',exact:true})).toBeEnabled();
});

for(const theme of ['dark','light'])for(const width of [320,390,1440])test(`overview compact rows, sorting and WCAG ${theme} ${width}`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await installSupabaseMock(page);await page.setViewportSize({width,height:width===1440?1000:844});
  await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'ice'})),theme);
  await page.goto('/discover?__e2e=1');await expect(page.locator('.statistics-row')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  const box=await page.getByLabel('Порядок',{exact:true}).boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);
  const result=page.locator('.statistics-result').first(),average=page.locator('.statistics-score').first();
  expect((await result.boundingBox()).x+(await result.boundingBox()).width).toBeLessThanOrEqual((await average.boundingBox()).x);
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
  const violations=await page.evaluate(async()=>(await axe.run(document.querySelector('#statisticsRoot'))).violations.filter(v=>['critical','serious'].includes(v.impact)).map(v=>v.id));
  expect(violations).toEqual([]);expect(errors).toEqual([]);
  await info.attach('overview.png',{body:await page.locator('#statisticsRoot').screenshot(),contentType:'image/png'});
});

test('failed notification refresh preserves history, cursor, scroll and the snapshot boundary',async({page})=>{
  const own='3615141a-7700-46b8-9ba5-e4f4450537fc';
  const notifications=Array.from({length:41},(_,i)=>({id:1001+i,user_id:own,type:'system',message:`Событие ${i+1}`,read:false,created_at:'2026-10-08T12:00:00Z'}));
  await installSupabaseMock(page,{notifications});await page.goto('/matches?__e2e=1');await page.locator('#notifBtn').click();
  await expect(page.locator('.notif-item')).toHaveCount(20);await page.locator('#notifMore').click();await expect(page.locator('.notif-item')).toHaveCount(40);
  await page.locator('.notif-item').last().scrollIntoViewIfNeeded();const scroll=await page.locator('#notifList').evaluate(el=>el.scrollTop);
  await page.evaluate(()=>{const original=sb.rpc.bind(sb);let fail=true;sb.rpc=(name,args)=>name==='get_notifications_page_v2'&&fail?(fail=false,new Promise(resolve=>{window.__failNotificationRefresh=()=>resolve({error:{message:'offline'}});})):original(name,args);});
  await page.getByRole('button',{name:'Обновить уведомления',exact:true}).click();
  await expect(page.locator('.notif-open').first()).toBeDisabled();await expect(page.locator('.notif-read').first()).toBeDisabled();
  await expect(page.locator('.notif-item')).toHaveCount(40);await page.evaluate(()=>window.__failNotificationRefresh());
  await expect(page.locator('#notifStatus')).toContainText('Не удалось');await expect(page.locator('.notif-item')).toHaveCount(40);
  await expect(page.locator('.notif-open').first()).toBeEnabled();
  expect(await page.locator('#notifList').evaluate(el=>el.scrollTop)).toBe(scroll);
  await expect(page.locator('#notifBadge')).toHaveText('41');await expect(page.locator('#notifMarkAll')).toBeEnabled();
  await page.locator('#notifMore').click();await expect(page.locator('.notif-item')).toHaveCount(41);
  await page.getByRole('button',{name:'Обновить уведомления',exact:true}).click();await expect(page.locator('.notif-item')).toHaveCount(20);
  await expect(page.locator('#notifStatus')).toHaveText('Показано: 20');
});

test('new count during a pending history read remains visible and is reconciled',async({page})=>{
  await installSupabaseMock(page);await page.goto('/matches?__e2e=1');
  await page.evaluate(()=>{const rpc=sb.rpc.bind(sb);sb.rpc=(name,args)=>name==='get_notifications_page_v2'?new Promise(resolve=>{window.__finishNotif=()=>resolve(rpc(name,args));}):rpc(name,args);});
  await page.locator('#notifBtn').click();await expect.poll(()=>page.evaluate(()=>typeof window.__finishNotif)).toBe('function');
  await page.evaluate(()=>FBZNotificationCounter.set(3));await expect(page.locator('#notifUpdate')).toBeVisible();await expect(page.locator('#notifUpdate')).toBeDisabled();
  await page.evaluate(()=>window.__finishNotif());await expect(page.locator('.notif-item')).toHaveCount(2);
  await expect(page.locator('#notifUpdate')).toBeVisible();await expect(page.locator('#notifUpdate')).toBeEnabled();
  await expect(page.locator('#notifBadge')).toHaveText('2');
  await page.locator('#notifUpdate').click();await expect.poll(()=>page.evaluate(()=>document.getElementById('notifList').getAttribute('aria-busy'))).toBe('true');
  await page.evaluate(()=>window.__finishNotif());await expect(page.locator('#notifUpdate')).toBeHidden();
});
