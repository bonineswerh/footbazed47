import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
const own='3615141a-7700-46b8-9ba5-e4f4450537fc';
const events=(count=26)=>Array.from({length:count},(_,i)=>({id:1001+i,user_id:own,from_user_id:null,type:'system',message:`Событие ${i+1}`,read:false,created_at:'2026-10-03T12:00:00Z',rating_id:null,comment_id:null}));
async function start(page,overrides={}){await installSupabaseMock(page,overrides);await page.goto('/matches?__e2e=1');await expect(page.locator('#notifBtn')).toBeVisible();}
test('счётчик показывает 99+ и обновляется при возврате без загрузки истории',async({page})=>{
  await start(page,{notifications:events(120)});await expect(page.locator('#notifBadge')).toBeVisible();await expect(page.locator('#notifBadge')).toHaveText('99+');
  await expect(page.locator('#notifBtn')).toHaveAttribute('aria-label','Уведомления: 120 непрочитанных');
  await page.evaluate(async()=>{await sb.rpc('set_notification_read',{p_notification_id:1001,p_read:true});window.dispatchEvent(new Event('focus'));});
  await expect(page.locator('#notifBtn')).toHaveAttribute('aria-label','Уведомления: 119 непрочитанных');
  expect(await page.evaluate(()=>Boolean(window.FBZNotifications))).toBe(false);await expect(page.locator('.notif-item')).toHaveCount(0);
});
test('полная история, одинаковое время, фильтр и отдельная отметка сохраняются',async({page})=>{
  await start(page,{notifications:events()});await expect(page.locator('#notifBadge')).toHaveText('26');
  await expect(page.locator('.notif-item')).toHaveCount(0);await page.locator('#notifBtn').click();
  await expect(page.locator('.notif-item')).toHaveCount(20);await expect(page.locator('#notifBadge')).toHaveText('26');
  await page.locator('#notifMore').click();await expect(page.locator('.notif-item')).toHaveCount(26);
  expect(await page.locator('.notif-item').evaluateAll(rows=>new Set(rows.map(r=>r.dataset.notificationId)).size)).toBe(26);
  await page.locator('.notif-read').first().click();await expect(page.locator('#notifBadge')).toHaveText('25');
  await page.locator('#notifUnread').click();await expect(page.locator('.notif-item')).toHaveCount(20);
  await page.locator('#notifMore').click();await expect(page.locator('.notif-item')).toHaveCount(25);
  await page.locator('#notifAll').click();await expect(page.locator('.notif-item')).toHaveCount(20);
  await page.getByRole('button',{name:'Отметить непрочитанным',exact:true}).click();await expect(page.locator('#notifBadge')).toHaveText('26');
  await page.keyboard.press('Escape');await expect(page.locator('#notifBtn')).toBeFocused();
});
test('новое событие после снимка не попадает в Прочитать все',async({page})=>{
  await start(page,{notifications:events()});
  await page.evaluate(()=>{const original=sb.rpc.bind(sb);let first=true;sb.rpc=async(name,args)=>{const r=await original(name,args);if(name==='get_notifications_page'&&first){first=false;r.data.through_id=1025;r.data.unread_count=25;r.data.items=r.data.items.filter(n=>n.id!==1026);}return r;};});
  await page.locator('#notifBtn').click();await expect(page.locator('#notifBadge')).toHaveText('25');
  await page.locator('#notifMarkAll').click();await expect(page.locator('#notifBadge')).toHaveText('1');await expect(page.locator('#notifUpdate')).toBeVisible();
  await page.locator('#notifUpdate').click();await page.locator('#notifUnread').click();
  await expect(page.locator('.notif-item')).toHaveCount(1);await expect(page.locator('.notif-item')).toContainText('Событие 26');
});
test('ошибка следующей страницы сохраняет историю и курсор для повтора',async({page})=>{
  await start(page,{notifications:events()});await page.locator('#notifBtn').click();await expect(page.locator('.notif-item')).toHaveCount(20);
  await page.evaluate(()=>{const original=sb.rpc.bind(sb);let fail=true;sb.rpc=(name,args)=>name==='get_notifications_page'&&args.p_cursor_id&&fail?(fail=false,Promise.resolve({error:{message:'offline'}})):original(name,args);});
  await page.locator('#notifMore').click();await expect(page.locator('#notifStatus')).toContainText('Не удалось');await expect(page.locator('.notif-item')).toHaveCount(20);
  await page.locator('#notifMore').click();await expect(page.locator('.notif-item')).toHaveCount(26);
});
test('закрытие во время отметки не вызывает поздний переход',async({page})=>{
  await start(page);await page.locator('#notifBtn').click();await expect(page.locator('.notif-item')).toHaveCount(2);
  await page.evaluate(()=>{const original=sb.rpc.bind(sb);sb.rpc=(name,args)=>name==='set_notification_read'?new Promise(resolve=>{window.finishNotification=()=>resolve(original(name,args));}):original(name,args);});
  await page.locator('.notif-open').first().click();await page.keyboard.press('Escape');await page.evaluate(()=>window.finishNotification());
  await expect(page.locator('#notifBadge')).toHaveText('1');await expect(page).toHaveURL(/\/matches\?__e2e=1$/);await expect(page.locator('#notifPanel')).toBeHidden();
});
test('точный старый комментарий открывается без перебора страниц ленты',async({page})=>{
  const comments=Array.from({length:61},(_,i)=>({id:700+i,user_id:own,comment:`Комментарий ${i+1}`,created_at:'2026-08-09T10:00:00Z',user:{username:'bazed'}}));
  await start(page,{notifications:[{...events(1)[0],type:'comment',rating_id:502,comment_id:760}],comments:{502:comments}});
  await page.evaluate(()=>{window.rpcCalls=[];const original=sb.rpc.bind(sb);sb.rpc=(name,args)=>{window.rpcCalls.push(name);return original(name,args);};});
  await page.locator('#notifBtn').click();await page.locator('.notif-open').click();
  await expect(page.locator('[data-comment-id="760"]')).toHaveClass(/focused/);await expect(page.locator('[data-comment-id="760"]')).toBeFocused();
  const calls=await page.evaluate(()=>window.rpcCalls);expect(calls).toContain('get_rating_entry');expect(calls).toContain('get_rating_comment');expect(calls).not.toContain('get_social_feed_page');
});
test('недоступная запись не уводит пользователя на другой матч',async({page})=>{
  await start(page,{notifications:[{...events(1)[0],type:'like',rating_id:999}]});await page.locator('#notifBtn').click();await page.locator('.notif-open').click();
  await expect(page.locator('#toast')).toContainText('недоступна');await expect(page.locator('#notifPanel')).toBeVisible();await expect(page).toHaveURL(/\/matches\?__e2e=1$/);
});
for(const theme of ['dark','light'])for(const width of [320,390,1440])test(`уведомления: геометрия, клавиатура и WCAG ${theme} ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:850});await page.addInitScript(value=>localStorage.setItem('fbz_appearance',JSON.stringify({theme:value,accent:'emerald'})),theme);
  await start(page,{notifications:events()});await page.locator('#notifBtn').click();await expect(page.locator('.notif-item')).toHaveCount(20);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getElementById('notifPanel').getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  const geometry=await page.locator('.notif-sheet').evaluate(node=>({left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right,scrollWidth:node.scrollWidth,width:node.clientWidth}));
  expect(geometry.left).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(width);expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
  const violations=await page.evaluate(async()=> (await axe.run(document.getElementById('notifPanel'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.filter(v=>['critical','serious','moderate'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
  expect(violations).toEqual([]);await info.attach('notifications.png',{body:await page.locator('.notif-sheet').screenshot(),contentType:'image/png'});
  await page.keyboard.press('Escape');await expect(page.locator('#notifBtn')).toBeFocused();
});
