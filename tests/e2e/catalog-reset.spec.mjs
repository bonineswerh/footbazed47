import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

test('замена каталога требует шесть подготовленных турниров и контрольную фразу',async({page})=>{
  await installSupabaseMock(page);await page.clock.install();
  const calls=[];
  await page.route('**/api/admin*',async route=>{
    const body=route.request().postDataJSON();if(body)calls.push(body);
    const data=body?.action==='prepare_catalog'?{batch:body.batch,league:body.league,matches:12,players:40}:
      body?.action==='cleanup_development_data'?{scope:'all',backup_id:'backup-test',deleted:{matches:202,players:4348,ratings:25},imported:{matches:72,players:220,clubs:100}}:
      {counts:{matches:202,players:4348,ratings:25,users:6},recentMatches:[],footballApiConfigured:true};
    await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/admin?__e2e=1');
  await page.getByRole('button',{name:'Очистка',exact:true}).click();
  await page.locator('#adminCleanupConfirm').fill('DELETE FOOTBAZED DATA');
  await expect(page.getByRole('button',{name:'Заменить всё тестовое'})).toBeDisabled();
  await page.getByRole('button',{name:'Подготовить новый каталог'}).click();
  for(let i=1;i<=6;i++){
    await expect.poll(()=>calls.filter(c=>c.action==='prepare_catalog').length).toBe(i);
    if(i<6){await expect(page.locator('#adminCatalogProgress')).toContainText('Пауза');await page.clock.runFor(15000);}
  }
  await expect(page.locator('#adminCatalogProgress')).toContainText('Все 6 турниров подготовлены');
  expect(new Set(calls.map(c=>c.batch)).size).toBe(1);
  await page.getByRole('button',{name:'Заменить всё тестовое'}).click();
  await page.getByRole('button',{name:'Заменить каталог',exact:true}).click();
  await expect(page.locator('#adminCleanupResult')).toContainText('Каталог заменён');
  await expect(page.locator('#adminCleanupResult')).toContainText('backup-test');
  expect(calls.filter(c=>c.action==='cleanup_development_data')).toHaveLength(1);
  await expect(page.getByRole('button',{name:'Заменить всё тестовое'})).toBeDisabled();
});

test('ошибка поставщика оставляет очистку заблокированной',async({page})=>{
  await installSupabaseMock(page);const actions=[];
  await page.route('**/api/admin*',route=>{
    const body=route.request().postDataJSON();if(body)actions.push(body.action);
    return route.fulfill({status:body?502:200,contentType:'application/json',body:JSON.stringify(body?{}:{counts:{matches:202},recentMatches:[],footballApiConfigured:true})});
  });
  await page.goto('/admin?__e2e=1');await page.getByRole('button',{name:'Очистка',exact:true}).click();
  await page.locator('#adminCleanupConfirm').fill('DELETE FOOTBAZED DATA');
  await page.getByRole('button',{name:'Подготовить новый каталог'}).click();
  await expect(page.locator('#adminCatalogProgress')).toContainText('Старые данные сохранены');
  await expect(page.getByRole('button',{name:'Заменить всё тестовое'})).toBeDisabled();
  expect(actions).toEqual(['prepare_catalog']);
});
