import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

for(const theme of ['dark','light']){
  test(`API-Football: явная диагностика, безопасный повтор и покрытие на телефоне (${theme})`,async({page})=>{
    await page.setViewportSize({width:390,height:844});await installSupabaseMock(page);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const calls=[];let checks=0;
    await page.route('**/api/admin*',async route=>{
      const body=route.request().postDataJSON();if(body)calls.push(body);
      let status=200,data={counts:{matches:261,players:2656,ratings:6,users:6},recentMatches:[],footballApiConfigured:true,apiFootballConfigured:true};
      if(body?.action==='api_football_status'){
        checks++;
        if(checks===1){status=502;data={error:'private upstream detail',code:'provider_timeout'};}
        else data={active:true,plan:'Free',dailyUsed:7,dailyLimit:100,dailyRemaining:93,quota:{dailyRemaining:93,minuteRemaining:8}};
      }
      if(body?.action==='api_football_competition')data={available:true,name:'Premier League',season:2024,coverage:{players:true,lineups:false,events:null,playerStatistics:null},quota:{dailyRemaining:92,minuteRemaining:7}};
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto('/admin?__e2e=1');await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
    await page.getByRole('button',{name:'Синхронизация',exact:true}).click();
    await expect(page.locator('#adminProviderConfigured')).toHaveText('Секрет настроен');
    expect(calls).toEqual([]);
    const check=page.getByRole('button',{name:'Проверить подключение',exact:true});
    await check.click();await expect(page.locator('#adminProviderAccount')).toContainText('не ответил вовремя');
    await expect(page.locator('#adminProviderAccount')).not.toContainText('private');await expect(check).toBeEnabled();
    await check.click();await expect(page.locator('#adminProviderAccount')).toContainText('Подключение работает · Free');
    await expect(page.locator('#adminProviderAccount')).toContainText('Осталось: 93');
    await page.getByLabel('Год начала сезона').fill('2024');
    await page.getByRole('button',{name:'Проверить покрытие',exact:true}).click();
    await expect(page.locator('#adminProviderCoverage')).toContainText('Premier League · 2024/25');
    await expect(page.locator('.admin-provider-coverage div').filter({hasText:'Составы на матч'})).toContainText('Нет');
    await expect(page.locator('.admin-provider-coverage div').filter({hasText:'События'})).toContainText('Неизвестно');
    expect(calls).toEqual([{action:'api_football_status'},{action:'api_football_status'},{action:'api_football_competition',league:'PL',season:2024}]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    await expect(page.locator('#adminApiFootballPanel input[type="password"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('API-Football: отсутствующий секрет отключает диагностику и не мешает старому источнику',async({page})=>{
  await installSupabaseMock(page);
  await page.route('**/api/admin*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({counts:{},recentMatches:[],footballApiConfigured:true,apiFootballConfigured:false})}));
  await page.goto('/admin?__e2e=1');await page.getByRole('button',{name:'Синхронизация',exact:true}).click();
  await expect(page.locator('#adminProviderConfigured')).toHaveText('Секрет не настроен');
  await expect(page.getByRole('button',{name:'Проверить подключение',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Проверить покрытие',exact:true})).toBeDisabled();
  await expect(page.locator('#adminSyncMatches')).toBeEnabled();
});
