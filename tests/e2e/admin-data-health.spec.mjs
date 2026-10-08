import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

for(const width of [390,1280])for(const theme of ['dark','light']){
  test(`админка: актуальность и постоянный журнал ${width}px ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:844});await installSupabaseMock(page);
    const entries=Array.from({length:20},(_,i)=>({id:40-i,action:i===1?'sync_matches_failed':'sync_matches',league:'PL',failed:i===1,at:'2026-10-07T14:00:00.000Z',processed:i===1?undefined:12,dateFrom:'2026-10-01',dateTo:'2026-10-07'}));
    const calls=[];
    await page.route('**/api/admin*',async route=>{
      const body=route.request().postDataJSON();if(body)calls.push(body);
      const data=body?.action==='audit_history'?{items:[{id:20,action:'update_match',at:'2026-10-06T12:00:00.000Z',failed:false}],hasMore:false,nextCursor:null}:body?.action==='test_connection'?{ok:true,competition:'Premier League'}:{counts:{matches:261,players:2656,ratings:12,users:6},recentMatches:[],footballApiConfigured:true,apiFootballConfigured:true,checkedAt:'2026-10-08T14:00:00Z',freshness:{latestFinishedAt:'2026-09-20T18:00:00Z',nextMatchAt:'2026-10-09T18:00:00Z',overdueMatches:3,confirmedLineups:0,latestImport:entries[0]},activity:{items:entries,hasMore:true,nextCursor:21}};
      await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto('/admin?__e2e=1');await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
    await expect(page.locator('#adminFreshness')).toContainText('Последний импорт матчей');
    await expect(page.locator('#adminFreshness')).toContainText('2026-10-01 — 2026-10-07');
    await expect(page.locator('#adminFreshness')).toContainText('Проверьте статусы: 3');
    await expect(page.locator('#adminUpdatedAt')).toContainText('Проверено');
    await expect(page.locator('#adminFootballStatus')).toHaveText('Не проверен');
    await page.screenshot({path:test.info().outputPath(`admin-freshness-${width}-${theme}.png`),fullPage:true});
    await page.getByRole('button',{name:'Журнал',exact:true}).click();
    await expect(page.locator('#adminAuditList .admin-audit-row')).toHaveCount(20);
    await expect(page.locator('#adminAuditList .failed')).toHaveCount(1);
    await page.getByRole('button',{name:'Ещё операции',exact:true}).click();
    await expect(page.locator('#adminAuditList .admin-audit-row')).toHaveCount(21);
    await expect(page.locator('#adminAuditList')).toContainText('Ручное изменение матча');
    await expect(page.locator('#adminAuditMore')).toBeHidden();
    expect(calls).toEqual([{action:'audit_history',before_id:21}]);
    await page.reload();await page.getByRole('button',{name:'Журнал',exact:true}).click();await expect(page.locator('#adminAuditList .admin-audit-row')).toHaveCount(20);
    await page.getByRole('button',{name:'Синхронизация',exact:true}).click();
    await expect(page.locator('#adminApiState')).toHaveText('Ключ настроен · API не проверен');
    await page.getByRole('button',{name:'Проверить API',exact:true}).click();
    await expect(page.locator('#adminApiState')).toHaveText('API отвечает');
    await expect(page.locator('#adminFootballStatus')).toHaveText('Отвечает');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    await page.screenshot({path:test.info().outputPath(`admin-data-health-${width}-${theme}.png`),fullPage:true});
  });
}

test('админка: английская версия показателей и журнала',async({page})=>{
  await page.setViewportSize({width:390,height:844});await installSupabaseMock(page);
  await page.route('**/api/admin*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({counts:{},recentMatches:[],footballApiConfigured:true,checkedAt:'2026-10-08T14:00:00Z',freshness:{confirmedLineups:0,latestFinishedAt:null,nextMatchAt:null,overdueMatches:0,latestImport:null},activity:{items:[],hasMore:false,nextCursor:null}})}));
  await page.goto('/en/admin?__e2e=1');
  await expect(page.locator('#adminFreshness')).toContainText('Latest match import');
  await page.getByRole('button',{name:'Log',exact:true}).click();
  await expect(page.locator('#adminAuditPanel')).toContainText('No operations yet.');
  await expect(page.locator('#adminUpdatedAt')).toContainText('Checked');
  await expect(page.locator('#adminUpdatedAt')).toContainText('Oct');
  await expect(page.locator('#adminFootballStatus')).toHaveText('Not checked');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});
