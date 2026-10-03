import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
// Native font rasterization differs by OS; strict references remain separate and dates are deterministic.
test.use({timezoneId:'UTC'});
const owner='3615141a-7700-46b8-9ba5-e4f4450537fc',other='cd291181-2db6-42cb-9f3d-ef84ab3a9660';
const reportId=i=>'55000000-0000-4000-8000-'+String(i).padStart(12,'0');

async function setup(page,options={}){
  await installSupabaseMock(page,{...options.fixture,comments:{501:[{id:702,user_id:other,comment:'A visible comment',created_at:'2026-08-09T12:10:00Z',can_delete:false,user:{username:'gamlet',display_name:'Gamlet'}}]}});
  await page.addInitScript(options=>{
    const rpc=window.__FOOTBAZED_TEST_CLIENT__.rpc;window.__reportCalls=[];
    window.__FOOTBAZED_TEST_CLIENT__.rpc=(name,args)=>{
      if(name!=='submit_community_report')return rpc(name,args);
      window.__reportCalls.push(structuredClone(args));
      const response={data:{id:'55000000-0000-4000-8000-000000000001',status:'open',duplicate:Boolean(options.duplicate)},error:null};
      if(options.delay)return new Promise(resolve=>{window.__resolveReport=()=>resolve(response);});
      if(options.errorOnce&&window.__reportCalls.length===1)return Promise.resolve({data:null,error:{message:options.errorOnce}});
      return Promise.resolve(response);
    };
    const from=window.__FOOTBAZED_TEST_CLIENT__.from;let historyRequests=0;
    window.__FOOTBAZED_TEST_CLIENT__.from=table=>{
      const builder=from(table);if(table!=='community_reports')return builder;
      const then=builder.then;builder.then=(resolve,reject)=>{
        historyRequests++;
        if(options.historyErrorOnce&&historyRequests===1)return Promise.resolve({data:null,count:null,error:{message:'private server diagnostics'}}).then(resolve,reject);
        if(options.historyDelay)return new Promise(complete=>{window.__resolveHistory=complete;}).then(()=>then(resolve,reject));
        return then(resolve,reject);
      };return builder;
    };
  },options);
}
async function openReview(page){await page.goto('/feed?__e2e=1');await page.getByRole('button',{name:'Пожаловаться на запись',exact:true}).click();await expect(page.getByRole('dialog',{name:'Жалоба на запись'})).toBeVisible();}
async function submit(page){await page.getByLabel('Причина',{exact:true}).selectOption('spam');await page.getByLabel('Подробности необязательно',{exact:true}).fill('  <script>Untrusted details</script>  ');await page.getByRole('button',{name:'Отправить жалобу',exact:true}).click();}
async function layout(page,context){
  await page.evaluate(async selector=>{await document.fonts.ready;await Promise.all(document.querySelector(selector).getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));},context);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
  expect(await page.evaluate(async selector=>(await axe.run(document.querySelector(selector),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),context)).toEqual([]);
}

test('жалоба на запись загружается лениво и передаёт только цель, причину и текст',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);await page.goto('/feed?__e2e=1');
  await expect(page.getByRole('button',{name:'Пожаловаться на запись',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>Boolean(window.FBZCommunityReports))).toBe(false);await expect(page.locator('#communityReportStyles')).toHaveCount(0);
  const button=page.getByRole('button',{name:'Пожаловаться на запись',exact:true});await button.click();await submit(page);
  await expect(page.locator('#reportOverlay')).not.toHaveClass(/on/);await expect(button).toBeFocused();
  expect(await page.evaluate(()=>window.__reportCalls)).toEqual([{p_target_type:'rating',p_target_id:'501',p_reason:'spam',p_details:'<script>Untrusted details</script>'}]);expect(errors).toEqual([]);
});
test('жалобы на комментарий и профиль используют их собственные идентификаторы',async({page})=>{
  await setup(page);await page.goto('/feed?__e2e=1');await page.getByRole('button',{name:'Обсудить оценку',exact:true}).first().click();
  await page.getByRole('button',{name:'Пожаловаться на комментарий',exact:true}).click();await expect(page.getByRole('dialog',{name:'Жалоба на комментарий'})).toBeVisible();await submit(page);
  expect(await page.evaluate(()=>window.__reportCalls)).toEqual([{p_target_type:'comment',p_target_id:'702',p_reason:'spam',p_details:'<script>Untrusted details</script>'}]);
  await page.goto('/profile/'+other+'?__e2e=1');await page.getByRole('button',{name:'Пожаловаться на профиль',exact:true}).click();await submit(page);
  expect(await page.evaluate(()=>window.__reportCalls)).toEqual([{p_target_type:'profile',p_target_id:other,p_reason:'spam',p_details:'<script>Untrusted details</script>'}]);
});
test('повтор после лимита не теряет текст, дубликат остаётся одним обращением',async({page})=>{
  await setup(page,{errorOnce:'report_rate_limit',duplicate:true});await openReview(page);await submit(page);
  await expect(page.locator('#reportStatus')).toContainText('Попробуйте позже');await expect(page.getByLabel('Подробности необязательно')).toHaveValue('  <script>Untrusted details</script>  ');
  await page.getByRole('button',{name:'Отправить жалобу'}).click();await expect(page.locator('#reportOverlay')).not.toHaveClass(/on/);await expect(page.locator('#toast')).toContainText('уже отправили');
});
test('закрытие и смена маршрута отменяют поздний результат отправки',async({page})=>{
  await setup(page,{delay:true});await openReview(page);await submit(page);await expect(page.getByRole('button',{name:'Отправить жалобу'})).toBeDisabled();
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Матчи',exact:true}).first().click();await expect(page).toHaveURL(/\/matches/);
  await page.evaluate(()=>window.__resolveReport());await expect(page.locator('#reportOverlay')).not.toHaveClass(/on/);await expect(page.locator('#toast')).not.toContainText('Жалоба отправлена');
});
test('выход из аккаунта закрывает жалобу и не возвращает позднее подтверждение',async({page})=>{
  await setup(page,{delay:true});await openReview(page);await submit(page);
  await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.emit('SIGNED_OUT',null));await expect(page.locator('#accountBtn')).toHaveCount(0);
  await page.evaluate(()=>window.__resolveReport());await expect(page.locator('#reportOverlay')).not.toHaveClass(/on/);await expect(page.locator('#reportDetails')).toHaveValue('');await expect(page.locator('#toast')).not.toContainText('Жалоба отправлена');
});
test('ошибку загрузки формы можно повторить, смена страницы отменяет отложенное открытие',async({page})=>{
  await setup(page);let fail=true,release,requested=false;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/js/community-reports.js*',async route=>{if(fail){fail=false;return route.abort('failed');}requested=true;await gate;return route.continue();});
  await page.goto('/feed?__e2e=1');await page.getByRole('button',{name:'Пожаловаться на запись',exact:true}).click();await expect(page.locator('#toast')).toContainText('Не удалось открыть жалобу');
  await page.getByRole('button',{name:'Пожаловаться на запись',exact:true}).click();await expect.poll(()=>requested).toBe(true);
  await page.getByRole('button',{name:'Матчи',exact:true}).first().click();release();await expect.poll(()=>page.evaluate(()=>Boolean(window.FBZCommunityReports))).toBe(true);await expect(page.locator('#reportOverlay')).toHaveCount(0);
  await page.getByRole('button',{name:'Лента',exact:true}).first().click();await page.getByRole('button',{name:'Пожаловаться на запись',exact:true}).click();await expect(page.getByRole('dialog',{name:'Жалоба на запись'})).toBeVisible();
});
test('гость не получает кнопок жалоб и собственную запись нельзя отправить',async({page})=>{
  await installSupabaseMock(page,{sessionUser:null});await page.goto('/feed?__e2e=1');await expect(page.locator('.feed-entry')).toHaveCount(2);await expect(page.getByRole('button',{name:'Пожаловаться на запись'})).toHaveCount(0);
  await setup(page);await page.goto('/profile/'+owner+'?__e2e=1');await expect(page.locator('.phero-name')).toHaveText('Bazed');await expect(page.getByRole('button',{name:'Пожаловаться на профиль'})).toHaveCount(0);
});
for(const theme of ['dark','light'])for(const width of [320,390,1440])test(`диалог жалобы ${theme} ${width}px: контраст, клавиатура и детали`,async({page})=>{
  await setup(page);await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),theme);await page.setViewportSize({width,height:844});await openReview(page);
  await expect(page.getByLabel('Причина',{exact:true})).toBeFocused();await layout(page,'#reportOverlay');
  if(width!==320)await expect(page).toHaveScreenshot(`report-${width}-${theme}-${process.platform}.png`,{animations:'disabled'});
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Пожаловаться на запись'})).toBeFocused();
});

function queueRows(){return Array.from({length:27},(_,i)=>({id:reportId(i+1),target_type:i%3===0?'profile':i%3===1?'rating':'comment',target_id:i%3===0?other:String(501+i),reason:'spam',details:i===0?'<script>Not executable</script>':'Please check this content.',snapshot:{username:'gamlet',label:'Reported content '+(i+1),text:'Public content at report time.'},status:'open',created_at:new Date(Date.UTC(2026,8,1,0,i)).toISOString(),reviewed_at:null,decision_note:'',reporter:{username:'bazed'},subject_id:other}));}
async function adminSetup(page,{failOnce=false}={}){
  await installSupabaseMock(page);const calls=[],rows=queueRows();let requests=0;
  await page.route('**/api/admin*',async route=>{
    const body=route.request().postDataJSON();if(body)calls.push(body);let status=200,data={counts:{},recentMatches:[],footballApiConfigured:false,apiFootballConfigured:false};
    if(body?.action==='moderation_queue'){
      if(failOnce&&requests++===0){status=503;data={error:'server only error'};}
      else{const filtered=rows.filter(r=>(body.status==='all'||r.status===body.status)&&(body.target_type==='all'||r.target_type===body.target_type));data={items:filtered.slice(body.offset,body.offset+20),total:filtered.length,offset:body.offset,has_more:body.offset+20<filtered.length,counts:Object.fromEntries(['open','reviewed','dismissed'].map(key=>[key,rows.filter(r=>r.status===key).length]))};}
    }
    if(body?.action==='review_community_report'){const r=rows.find(r=>r.id===body.report_id);r.status=body.status;r.decision_note=body.note;r.reviewed_at='2026-10-03T10:00:00Z';data={id:r.id,status:r.status,already_reviewed:false};}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });return calls;
}
test('очередь жалоб: полные counts, фильтры, страницы и решение с причиной',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));const calls=await adminSetup(page,{failOnce:true});await page.goto('/admin?__e2e=1');await page.getByRole('button',{name:'Жалобы',exact:true}).click();
  await expect(page.locator('#adminReportList')).toContainText('Не удалось загрузить жалобы');await page.locator('#adminReportList').getByRole('button',{name:'Повторить'}).click();
  await expect(page.locator('.admin-report-card')).toHaveCount(20);await expect(page.locator('#adminReportPage')).toHaveText('1–20 из 27');await expect(page.locator('#adminReportCounts strong').first()).toHaveText('27');
  await page.getByRole('button',{name:'Далее →',exact:true}).click();await expect(page.locator('#adminReportPage')).toHaveText('21–27 из 27');await expect(page.getByRole('button',{name:'Далее →',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Назад',exact:true}).click();await page.getByLabel('Тип',{exact:true}).selectOption('profile');await expect(page.locator('.admin-report-card')).toHaveCount(9);
  const first=page.locator('.admin-report-card').first();await expect(first.locator('script')).toHaveCount(0);await expect(first).toContainText('<script>Not executable</script>');
  await first.getByLabel('Причина решения',{exact:true}).fill('Нарушений в указанной записи не обнаружено.');await first.getByLabel('Решение по обращению').selectOption('dismissed');await first.getByRole('button',{name:'Сохранить решение'}).click();
  await expect(page.locator('.admin-report-card')).toHaveCount(8);await page.getByLabel('Статус',{exact:true}).selectOption('dismissed');await expect(page.locator('.admin-report-card')).toHaveCount(1);await expect(page.locator('.admin-report-decision-note')).toContainText('Нарушений');
  expect(calls.find(c=>c.action==='review_community_report')).toEqual({action:'review_community_report',report_id:reportId(1),status:'dismissed',note:'Нарушений в указанной записи не обнаружено.'});expect(errors).toEqual([]);
});
for(const theme of ['dark','light'])for(const width of [390,1440])test(`очередь жалоб ${theme} ${width}px: доступность и оформление`,async({page})=>{
  await adminSetup(page);await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),theme);await page.setViewportSize({width,height:1000});await page.goto('/admin?__e2e=1');await page.getByRole('button',{name:'Жалобы',exact:true}).click();await expect(page.locator('.admin-report-card')).toHaveCount(20);await layout(page,'#admin-view-reports');await expect(page).toHaveScreenshot(`report-queue-${width}-${theme}-${process.platform}.png`,{animations:'disabled'});
});
test('мои обращения показывают только свою историю и решение, по десять на странице',async({page})=>{
  const rows=Array.from({length:13},(_,i)=>({id:reportId(i+1),reporter_id:owner,target_type:'rating',target_id:String(501+i),reason:'spam',details:'My report '+i,status:i?'open':'dismissed',decision_note:i?'':'Обращение проверено, нарушений не обнаружено.',created_at:new Date(Date.UTC(2026,8,20-i)).toISOString()}));rows.push({...rows[0],id:reportId(99),reporter_id:other,details:'Private report from another account'});
  await setup(page,{fixture:{communityReports:rows}});await page.goto('/profile/'+owner+'?__e2e=1');await page.getByRole('button',{name:'Мои обращения',exact:true}).click();await expect(page.getByRole('dialog',{name:'Мои обращения'})).toBeVisible();
  await expect(page.locator('.report-history-list>li')).toHaveCount(10);await expect(page.locator('#reportHistory')).not.toContainText('Private report');await expect(page.locator('.report-history-decision')).toContainText('нарушений не обнаружено');await expect(page.locator('.report-history-pagination')).toContainText('1–10 из 13');
  await page.getByRole('dialog',{name:'Мои обращения'}).getByRole('button',{name:'Далее →',exact:true}).click();await expect(page.locator('.report-history-list>li')).toHaveCount(3);await expect(page.locator('.report-history-pagination')).toContainText('11–13 из 13');await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Мои обращения',exact:true})).toBeFocused();
});
test('пустую историю можно открыть после ошибки без раскрытия диагностики сервера',async({page})=>{
  await setup(page,{historyErrorOnce:true});await page.goto('/profile/'+owner+'?__e2e=1');await page.getByRole('button',{name:'Мои обращения',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Мои обращения'});await expect(dialog).toContainText('Не удалось загрузить обращения');await expect(dialog).not.toContainText('private server diagnostics');
  await dialog.getByRole('button',{name:'Повторить',exact:true}).click();await expect(dialog).toContainText('Обращений пока нет');await expect(dialog.getByRole('button',{name:'Далее →',exact:true})).toBeDisabled();await expect(dialog.getByRole('button',{name:'Закрыть обращения',exact:true})).toBeVisible();
});
test('выход из аккаунта очищает историю и отбрасывает поздний ответ',async({page})=>{
  await setup(page,{historyDelay:true,fixture:{communityReports:[{id:reportId(1),reporter_id:owner,target_type:'rating',reason:'spam',details:'Private history after logout',status:'open',created_at:'2026-10-03T12:00:00Z'}]}});
  await page.goto('/profile/'+owner+'?__e2e=1');await page.getByRole('button',{name:'Мои обращения',exact:true}).click();await expect.poll(()=>page.evaluate(()=>typeof window.__resolveHistory)).toBe('function');
  await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.emit('SIGNED_OUT',null));await expect(page.locator('#accountBtn')).toHaveCount(0);await page.evaluate(()=>window.__resolveHistory());
  await expect(page.locator('#reportOverlay')).not.toHaveClass(/on/);await expect(page.locator('#reportHistory')).toBeEmpty();await expect(page.locator('body')).not.toContainText('Private history after logout');
});
test('поздний ответ очереди администратора не остаётся после выхода из аккаунта',async({page})=>{
  await adminSetup(page);let release,requested=false;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/api/admin*',async route=>{if(route.request().postDataJSON()?.action!=='moderation_queue')return route.fallback();requested=true;await gate;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:queueRows(),total:27,counts:{open:27}})});});
  await page.goto('/admin?__e2e=1');await page.getByRole('button',{name:'Жалобы',exact:true}).click();await expect.poll(()=>requested).toBe(true);
  await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.emit('SIGNED_OUT',null));await expect(page.locator('#accountBtn')).toHaveCount(0);
  const response=page.waitForResponse(r=>r.url().includes('/api/admin')&&r.request().postDataJSON()?.action==='moderation_queue');release();await response;
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect(page.locator('#adminReportList')).toBeEmpty();await expect(page.locator('#adminReportCounts')).toBeEmpty();
});
