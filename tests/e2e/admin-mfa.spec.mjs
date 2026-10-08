import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

async function accessibility(page){
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
  const violations=await page.evaluate(async()=>{const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return result.violations.filter(v=>['critical','serious','moderate'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});expect(violations).toEqual([]);
}

async function prepare(page,options={}){
  const calls=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
  await installSupabaseMock(page,{mfaLevel:'aal1',mfaFactors:[],...options});
  await page.route('**/api/admin*',async route=>{
    const action=route.request().postDataJSON()?.action||new URL(route.request().url()).searchParams.get('action')||'overview';calls.push(action);
    const mfa=await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.mfa());
    const data=action==='access_status'?{mfaRequired:mfa.level!=='aal2'}:{counts:{},recentMatches:[],activity:{items:[],hasMore:false},freshness:{},checkedAt:'2026-10-08T19:00:00Z'};
    await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  return{calls,errors};
}
for(const width of [320,390,1440])for(const theme of ['dark','light']){
  test(`MFA: закрытая админка и подключение ${width}px ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:844});const {calls,errors}=await prepare(page);
    await page.goto('/admin?__e2e=1');await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
    await expect(page.locator('#adminSecurityGate')).toContainText('Защита администратора');await expect(page.locator('#adminConsole')).toBeHidden();expect(calls).toEqual([]);
    await accessibility(page);
    await page.getByRole('button',{name:'Продолжить',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Подключите аутентификатор'})).toBeVisible();expect(calls).toEqual(['access_status']);
    await page.getByLabel('Название устройства').fill('My phone');await page.getByRole('button',{name:'Подключить',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Сканируйте QR-код'})).toBeVisible();
    await expect.poll(()=>page.locator('#adminMfaQr').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    await accessibility(page);
    await page.screenshot({path:test.info().outputPath(`mfa-setup-${width}-${theme}.png`),fullPage:true});
    await page.getByLabel('Код из приложения').fill('123456');await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
    await expect(page.locator('#adminConsole')).toBeVisible();await expect(page.locator('#adminMfaModal')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Инструкция',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Эксперты',exact:true})).toBeVisible();
    await expect(page.locator('#adminDateFrom')).not.toHaveValue('');
    expect(calls).toEqual(['access_status','access_status','overview']);
    expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain('LOCAL-TEST-ONLY');expect(errors).toEqual([]);
  });
}
test('MFA: неверный код, retry и отсутствие автоматического повторения очистки',async({page})=>{
  const {calls,errors}=await prepare(page,{mfaLevel:'aal2',mfaFactors:[{id:'22000000-0000-0000-0000-000000000001',factor_type:'totp',status:'verified',friendly_name:'Phone'}],mfaVerifyError:'mfa_verification_failed'});
  await page.unroute('**/api/admin*');
  await page.route('**/api/admin*',async route=>{
    const action=route.request().postDataJSON()?.action||new URL(route.request().url()).searchParams.get('action')||'overview';calls.push(action);
    await route.fulfill({status:action==='cleanup_development_data'?403:200,contentType:'application/json',body:JSON.stringify(action==='cleanup_development_data'?{code:'admin_mfa_recent_required'}:action==='access_status'?{mfaRequired:false}:{counts:{},recentMatches:[],activity:{items:[]},freshness:{}})});
  });
  await page.goto('/admin?__e2e=1');await expect(page.locator('#adminConsole')).toBeVisible();
  await page.evaluate(async()=>{try{await window.FBZAdmin.request('cleanup_development_data',{scope:'ratings',confirmation:'DELETE FOOTBAZED DATA'});}catch{}});
  await expect(page.getByRole('dialog',{name:'Подтвердите очистку'})).toBeVisible();
  await page.getByLabel('Код из приложения').fill('123456');await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Неверный или устаревший код'})).toBeVisible();await expect(page.getByLabel('Код из приложения')).toHaveValue('');
  await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.mfaError(null));
  await page.getByLabel('Код из приложения').fill('654321');await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
  await expect(page.locator('#adminMfaModal')).toHaveCount(0);expect(calls.filter(c=>c==='cleanup_development_data')).toHaveLength(1);expect(errors).toEqual([]);
});
test('MFA: Escape очищает QR и ключ, маршрут очищает окно, черновик удаляется явно',async({page})=>{
  await prepare(page);await page.goto('/admin?__e2e=1');await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.getByRole('button',{name:'Подключить',exact:true}).click();
  await expect(page.locator('#adminMfaQr')).toBeVisible();await page.getByText('Не могу сканировать QR-код',{exact:true}).click();await expect(page.locator('#adminMfaManualKey')).toHaveText('LOCAL-TEST-ONLY');
  await page.keyboard.press('Escape');await expect(page.locator('#adminMfaQr')).toHaveCount(0);await expect(page.locator('#adminMfaManualKey')).toBeEmpty();
  await expect(page.getByRole('button',{name:'Продолжить',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.getByRole('button',{name:'Удалить черновик',exact:true}).click();
  await expect(page.getByRole('button',{name:'Удалить черновик',exact:true})).toHaveCount(0);
  expect((await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.mfa())).calls.filter(c=>c.method==='unenroll')).toHaveLength(1);
  await page.evaluate(()=>go('home'));await expect(page.locator('#adminMfaModal')).toHaveCount(0);
});
test('MFA: недоступная Auth проверка и небезопасный QR не открывают консоль',async({page})=>{
  await prepare(page,{mfaUnavailable:true,mfaQr:'https://attacker.test/qr.svg'});await page.goto('/admin?__e2e=1');
  await expect(page.locator('#adminSecurityGate')).toContainText('Не удалось проверить защиту');
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.getByRole('button',{name:'Подключить',exact:true}).click();
  await expect(page.locator('#adminMfaStatus')).toContainText('Не удалось проверить защиту');await expect(page.locator('#adminMfaQr')).toHaveCount(0);await expect(page.locator('#adminConsole')).toBeHidden();
});
test('MFA: смена пользователя отменяет поздний ответ и очищает окно',async({page})=>{
  await prepare(page);await page.goto('/admin?__e2e=1');await expect(page.locator('#adminSecurityGate')).toBeVisible();
  await page.evaluate(()=>{sb.auth.mfa.listFactors=()=>new Promise(resolve=>window.__resolveMfa=resolve);});
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();await expect.poll(()=>page.evaluate(()=>typeof window.__resolveMfa)).toBe('function');
  await page.evaluate(()=>{window.__FOOTBAZED_TEST_AUTH__.emit('SIGNED_OUT',null);});await expect(page.locator('#adminSecurityGate')).toHaveCount(0);
  await page.evaluate(()=>window.__resolveMfa({data:{all:[]},error:null}));await expect(page.locator('#adminMfaModal')).toHaveCount(0);await expect(page.locator('#adminConsole')).toBeHidden();
});
test('MFA: английский экран подтверждения',async({page})=>{
  await prepare(page,{mfaFactors:[{id:'22000000-0000-0000-0000-000000000001',factor_type:'totp',status:'verified',friendly_name:'Phone'}]});await page.goto('/en/admin?__e2e=1');
  await expect(page.locator('#adminSecurityGate')).toContainText('Administrator security');await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Verify your sign-in'})).toBeVisible();await page.getByLabel('Authenticator code').fill('123456');await page.getByRole('button',{name:'Verify',exact:true}).click();await expect(page.locator('#adminConsole')).toBeVisible();
});
