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
test('MFA: большой SVG из настоящего SDK открывает QR вместо общей ошибки',async({page})=>{
  const {errors}=await prepare(page);await page.goto('/admin?__e2e=1');
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  const bytes=await page.evaluate(async()=>{
    // Synthetic pixel SVG and credentials only; this test never calls hosted Auth.
    let svg='<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 210 210"><rect width="210" height="210" fill="white"/>';
    for(let y=0;y<70;y++)for(let x=0;x<70;x++)if((x*13+y*7)%5<2)svg+=`<rect x="${x*3}" y="${y*3}" width="3" height="3" fill="black"/>`;
    svg+='</svg>';
    const user={id:'3615141a-7700-46b8-9ba5-e4f4450537fc',email:'sdk-interop@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-10-09T00:00:00Z'};
    const access=[{alg:'HS256',typ:'JWT'},{sub:user.id,exp:Math.floor(Date.now()/1000)+3600},'local-test-signature'].map(value=>btoa(typeof value==='string'?value:JSON.stringify(value)).replaceAll('=','').replaceAll('+','-').replaceAll('/','_')).join('.');
    const client=supabase.createClient('http://127.0.0.1:4173/local-sdk-test','local-test-public-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async input=>{
      const path=new URL(typeof input==='string'?input:input.url).pathname;
      if(path.endsWith('/token'))return new Response(JSON.stringify({access_token:access,refresh_token:'local-test-refresh-token',token_type:'bearer',expires_in:3600,user}),{headers:{'Content-Type':'application/json'}});
      if(path.endsWith('/factors'))return new Response(JSON.stringify({id:'22000000-0000-0000-0000-000000000002',type:'totp',totp:{qr_code:svg,secret:'JBSWY3DPEHPK3PXP'}}),{headers:{'Content-Type':'application/json'}});
      throw new Error('unexpected_local_sdk_request');
    }}});
    const login=await client.auth.signInWithPassword({email:user.email,password:'local-test-only'});if(login.error)throw login.error;
    sb.auth.mfa.enroll=params=>client.auth.mfa.enroll(params);
    return svg.length;
  });
  expect(bytes).toBeGreaterThan(100000);
  await page.getByRole('button',{name:'Подключить',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Сканируйте QR-код'})).toBeVisible();
  await expect.poll(()=>page.locator('#adminMfaQr').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await expect(page.locator('#adminConsole')).toBeHidden();expect(errors).toEqual([]);
});
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
    expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain('JBSWY3DPEHPK3PXP');expect(errors).toEqual([]);
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
  await expect(page.locator('#adminMfaQr')).toBeVisible();await page.getByText('Не могу сканировать QR-код',{exact:true}).click();await expect(page.locator('#adminMfaManualKey')).toHaveText('JBSWY3DPEHPK3PXP');
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
  await expect(page.locator('#adminMfaStatus')).toContainText('Не удалось показать QR-код');await expect(page.locator('#adminMfaQr')).toHaveCount(0);await expect(page.locator('#adminConsole')).toBeHidden();
  await expect(page.locator('#adminMfaManualKey')).toBeVisible();
});

const tinySvg='<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><rect width="220" height="220" fill="white"/></svg>';
for(const encoding of ['percent','base64'])test(`MFA: SVG ${encoding} отображается как изображение`,async({page})=>{
  const qr=encoding==='percent'?`data:image/svg+xml,${encodeURIComponent(tinySvg)}`:`data:image/svg+xml;base64,${Buffer.from(tinySvg).toString('base64')}`;
  const {errors}=await prepare(page,{mfaQr:qr});await page.goto('/admin?__e2e=1');
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.getByRole('button',{name:'Подключить',exact:true}).click();
  await expect.poll(()=>page.locator('#adminMfaQr').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await expect(page.locator('#adminConsole')).toBeHidden();expect(errors).toEqual([]);
});
for(const failure of ['external','oversized','malformed'])test(`MFA: ${failure} QR оставляет безопасный ручной ввод без нового фактора`,async({page})=>{
  const requests=[];page.on('request',request=>{if(request.url().includes('attacker.test'))requests.push(request.url());});
  const qr=failure==='external'?'https://attacker.test/qr.svg':failure==='oversized'?`data:image/svg+xml,${' '.repeat(1024*1024)}${tinySvg}`:'data:image/svg+xml,<invalid-image>';
  const {calls,errors}=await prepare(page,{mfaQr:qr});await page.goto('/admin?__e2e=1');
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.getByRole('button',{name:'Подключить',exact:true}).click();
  await expect(page.locator('#adminMfaStatus')).toContainText('Не удалось показать QR-код');await expect(page.locator('#adminMfaQr')).toHaveCount(0);
  await expect(page.locator('#adminMfaManualKey')).toBeVisible();await expect(page.locator('#adminConsole')).toBeHidden();
  expect((await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.mfa())).calls.filter(c=>c.method==='enroll')).toHaveLength(1);expect(requests).toEqual([]);
  await page.getByLabel('Код из приложения').fill('123456');await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
  await expect(page.locator('#adminConsole')).toBeVisible();expect(calls).toEqual(['access_status','access_status','overview']);expect(errors).toEqual([]);
});
test('MFA: повреждённый ответ подключения не показывает ключ и консоль',async({page})=>{
  const {errors}=await prepare(page,{mfaSecret:'invalid-secret'});await page.goto('/admin?__e2e=1');
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.getByRole('button',{name:'Подключить',exact:true}).click();
  await expect(page.locator('#adminMfaStatus')).toContainText('Не удалось получить данные подключения');
  await expect(page.locator('#adminMfaQr')).toHaveCount(0);await expect(page.locator('#adminMfaManualKey')).toHaveCount(0);await expect(page.locator('#adminConsole')).toBeHidden();
  await expect(page.getByRole('button',{name:'Подключить',exact:true})).toBeEnabled();expect(errors).toEqual([]);
});
test('MFA: позднее подключение после закрытия не возвращает QR и не создаёт второй фактор',async({page})=>{
  const {calls,errors}=await prepare(page);await page.goto('/admin?__e2e=1');await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await page.evaluate(()=>{const enroll=sb.auth.mfa.enroll;sb.auth.mfa.enroll=params=>new Promise(resolve=>{const result=enroll(params);window.__resolveEnroll=()=>resolve(result);});});
  await page.getByRole('button',{name:'Подключить',exact:true}).click();
  await expect(page.getByRole('button',{name:'Подключаем…',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await page.evaluate(()=>window.__resolveEnroll());
  // Escape hides the shared overlay; clear() removes it on route/session changes.
  await expect(page.locator('#adminMfaModal')).toBeHidden();await expect(page.locator('#adminMfaQr')).toHaveCount(0);await expect(page.locator('#adminConsole')).toBeHidden();
  await expect(page.getByRole('button',{name:'Продолжить',exact:true})).toBeFocused();
  expect(calls).toEqual(['access_status']);expect((await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.mfa())).calls.filter(c=>c.method==='enroll')).toHaveLength(1);expect(errors).toEqual([]);
});
test('MFA: английский ручной fallback сохраняет проверку кода',async({page})=>{
  await prepare(page,{mfaQr:'https://attacker.test/qr.svg'});await page.goto('/en/admin?__e2e=1');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Connect',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Add the account manually',exact:true})).toBeVisible();
  await expect(page.locator('#adminMfaStatus')).toContainText('Unable to display the QR code');await expect(page.locator('#adminConsole')).toBeHidden();
  await page.getByLabel('Authenticator code').fill('123456');await page.getByRole('button',{name:'Verify',exact:true}).click();await expect(page.locator('#adminConsole')).toBeVisible();
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
