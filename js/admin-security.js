(function(root){
  'use strict';
  let owner=null,version=0,busy=false,setup=null;
  const valid=stamp=>stamp===version&&owner===CU?.id&&CU?.is_admin&&CP==='admin';
  const api=()=>sb.auth.mfa;
  function clear(){
    root.FBZOverlay.close('adminMfaModal');document.getElementById('adminMfaModal')?.remove();
    version++;busy=false;setup=null;
  }
  function syncSession(id){
    if(id===owner)return;
    clear();owner=id;root.FBZAdmin?.resetSession();
    const console=document.getElementById('adminConsole');if(console){console.hidden=true;console.inert=true;}
    document.getElementById('adminSecurityGate')?.remove();
  }
  function syncRoute(page){if(page!=='admin')clear();}
  function gate(message='Для доступа к административным данным нужен код из приложения-аутентификатора.'){
    const console=document.getElementById('adminConsole');if(!console)return;
    console.hidden=true;console.inert=true;
    let host=document.getElementById('adminSecurityGate');
    if(!host){host=document.createElement('section');host.id='adminSecurityGate';host.className='admin-security-gate';console.before(host);}
    host.innerHTML=`<span class="admin-security-icon">${ico('shield',26)}</span><span class="admin-security-eyebrow">FOOTBAZED CONTROL</span><h1>Защита администратора</h1><p>${esc(message)}</p><button type="button" class="btn btn-l admin-security-primary" data-fbz-click="admin-security.open">Продолжить</button><p class="admin-security-note">Обычные разделы сайта доступны без второго фактора.</p>`;
  }
  function errorText(error){
    if(error?.code==='admin_session_invalid')return 'Сессия завершена. Выйдите из аккаунта и войдите снова.';
    if(error?.code==='mfa_setup_response_invalid')return 'Не удалось получить данные подключения. Закройте окно, удалите незавершённый черновик и попробуйте снова.';
    const codes={mfa_verification_failed:'Неверный или устаревший код. Введите текущие шесть цифр из приложения.',mfa_challenge_expired:'Код устарел. Введите новый код из приложения.',over_request_rate_limit:'Слишком много попыток. Подождите и попробуйте снова.',over_mfa_rate_limit:'Слишком много попыток. Подождите и попробуйте снова.',mfa_factor_name_conflict:'Устройство с таким именем уже существует. Выберите другое имя.',too_many_enrolled_mfa_factors:'Достигнут лимит устройств. Удалите незавершённое подключение и повторите.',insufficient_aal:'Сначала подтвердите код с уже подключённого устройства.'};
    return codes[error?.code]||'Не удалось проверить защиту. Повторите попытку; доступ к админке пока закрыт.';
  }
  function qrImageSource(value){
    // Auth's pixel-by-pixel SVG can exceed 100 kB. Keep a bounded image only,
    // never insert SVG markup into the document or accept an external URL.
    if(typeof value!=='string'||value.length>1024*1024||!/^data:image\/svg\+xml[;,]/i.test(value))return null;
    const comma=value.indexOf(','),header=value.slice(0,comma);let payload=value.slice(comma+1);
    if(comma<0||!payload)return null;
    if(/;base64$/i.test(header))return `data:image/svg+xml;base64,${payload}`;
    if(!payload.trimStart().startsWith('<')){try{payload=decodeURIComponent(payload);}catch{return null;}}
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(payload)}`;
  }
  function manualFallback(stamp){
    if(!valid(stamp))return;
    document.getElementById('adminMfaQr')?.remove();
    const details=document.querySelector('#adminMfaModal .admin-security-manual');if(details)details.open=true;
    status('Не удалось показать QR-код. Добавьте FOOTBAZED вручную с ключом ниже, затем введите код из приложения.');
  }
  function status(message){const el=document.getElementById('adminMfaStatus');if(el)el.textContent=message;}
  function shell(title,body){
    document.getElementById('adminMfaModal')?.remove();
    document.body.insertAdjacentHTML('beforeend',`<div class="overlay" id="adminMfaModal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="adminMfaTitle" data-close-backdrop="true"><div class="admin-security-box"><header><span class="admin-security-icon">${ico('shield',22)}</span><button type="button" class="admin-security-close" aria-label="Закрыть" data-fbz-click="admin-security.close">${ico('close',18)}</button></header><h2 id="adminMfaTitle">${esc(title)}</h2>${body}<p id="adminMfaStatus" class="admin-security-status" role="status" aria-live="polite"></p></div></div>`);
    root.FBZOverlay.open('adminMfaModal');
  }
  const codeForm=()=>'<form data-fbz-submit="admin-security.verify"><label class="admin-security-label" for="adminMfaCode">Код из приложения</label><input id="adminMfaCode" class="admin-security-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required placeholder="000000"><button class="btn btn-l admin-security-primary" type="submit">Подтвердить</button></form>';
  async function mount(){
    syncSession(CU?.id||null);const stamp=++version;
    const console=document.getElementById('adminConsole');if(console){console.hidden=true;console.inert=true;}
    try{
      const {data,error}=await api().getAuthenticatorAssuranceLevel();
      if(!valid(stamp))return false;if(error)throw error;
      if(data?.currentLevel!=='aal2'){gate();return false;}
      document.getElementById('adminSecurityGate')?.remove();console.hidden=false;console.inert=false;return true;
    }catch{if(valid(stamp))gate('Не удалось проверить защиту. Повторите попытку; доступ к админке пока закрыт.');return false;}
  }
  async function open(recent=false){
    if(busy||!CU?.is_admin||CP!=='admin')return;
    syncSession(CU.id);clear();const stamp=version;busy=true;
    try{
      await root.FBZAdmin.request('access_status');
      const {data,error}=await api().listFactors();if(!valid(stamp))return;if(error)throw error;
      const factors=(data?.all||[]).filter(f=>f.factor_type==='totp'),verified=factors.filter(f=>f.status==='verified');
      if(verified.length){
        shell(recent?'Подтвердите очистку':'Подтвердите вход',`<p>${recent?'Очистка доступна в течение пяти минут после ввода кода. После подтверждения повторите действие вручную.':'Введите текущий код из приложения-аутентификатора.'}</p><label class="admin-security-label" for="adminMfaFactor">Устройство</label><select class="admin-security-select" id="adminMfaFactor">${verified.map(f=>`<option value="${esc(f.id)}">${esc(String(f.friendly_name||'Аутентификатор').slice(0,80))}</option>`).join('')}</select>${codeForm()}`);
      }else{
        shell('Подключите аутентификатор',`<p>Добавьте FOOTBAZED в приложение-аутентификатор на своём устройстве. Оно будет создавать код для входа в админку.</p><p class="admin-security-note">После подключения другие сеансы этого аккаунта завершатся. Сохраните резервную копию в своём аутентификаторе.</p><label class="admin-security-label" for="adminMfaName">Название устройства</label><input class="admin-security-select" id="adminMfaName" maxlength="40" value="FOOTBAZED"><button type="button" class="btn btn-l admin-security-primary" data-fbz-click="admin-security.enroll">Подключить</button>${factors.filter(f=>f.status==='unverified').map(f=>`<div class="admin-security-pending"><span>${esc(String(f.friendly_name||'Аутентификатор').slice(0,80))} · Подключение не завершено</span><button type="button" class="btn btn-g" ${FBZActions.attrs('admin-security.discard',[f.id])}>Удалить черновик</button></div>`).join('')}`);
      }
    }catch(error){if(valid(stamp)){gate(errorText(error));toast(errorText(error),'err');}}
    finally{if(stamp===version)busy=false;}
  }
  async function enroll(){
    if(busy||setup)return;const stamp=version;busy=true;
    const name=document.getElementById('adminMfaName')?.value.trim();
    if(!name){busy=false;status('Укажите название устройства.');return;}
    const button=document.querySelector('#adminMfaModal [data-fbz-click="admin-security.enroll"]');
    if(button){button.disabled=true;button.textContent='Подключаем…';}
    try{
      const {data,error}=await api().enroll({factorType:'totp',friendlyName:name,issuer:'FOOTBAZED'});
      if(!valid(stamp))return;if(error)throw error;
      if(typeof data?.id!=='string'||!data.id||typeof data.totp?.secret!=='string'||!/^([A-Z2-7]{16,128})={0,6}$/.test(data.totp.secret))throw Object.assign(new Error('mfa_setup_response_invalid'),{code:'mfa_setup_response_invalid'});
      const qr=qrImageSource(data.totp.qr_code);
      // Only a temporary factor ID is retained. QR/secret/code never enter storage or logs.
      root.FBZOverlay.close('adminMfaModal');const current=version;
      shell(qr?'Сканируйте QR-код':'Добавьте аккаунт вручную',`<p>${qr?'Откройте аутентификатор, добавьте аккаунт по QR-коду и введите полученные шесть цифр.':'В приложении-аутентификаторе выберите ввод ключа вручную. После добавления аккаунта введите полученные шесть цифр.'}</p>${qr?'<img id="adminMfaQr" class="admin-security-qr" alt="QR-код для приложения-аутентификатора" width="220" height="220">':''}<details class="admin-security-manual"><summary>Не могу сканировать QR-код</summary><p>Добавьте аккаунт вручную: название FOOTBAZED, ключ ниже, тип — по времени. Храните ключ только в своём аутентификаторе.</p><code id="adminMfaManualKey"></code></details>${codeForm()}`);
      setup={id:data.id};document.getElementById('adminMfaManualKey').textContent=data.totp.secret;
      if(qr){const image=document.getElementById('adminMfaQr');image.addEventListener('error',()=>manualFallback(current),{once:true});image.src=qr;}
      else manualFallback(current);
      if(current!==version)setup=null;
    }catch(error){if(valid(stamp))status(errorText(error));}
    finally{if(stamp===version){busy=false;if(button){button.disabled=false;button.textContent='Подключить';}}}
  }
  async function verify(event){
    event.preventDefault();if(busy)return;
    const stamp=version,factorId=setup?.id||document.getElementById('adminMfaFactor')?.value;
    const input=document.getElementById('adminMfaCode'),code=input?.value||'';
    if(!factorId||!/^\d{6}$/.test(code)){status('Введите шесть цифр из приложения.');return;}
    busy=true;const button=event.target.querySelector('button[type="submit"]');button.disabled=true;input.value='';status('Проверяем код…');
    try{
      const {error}=await api().challengeAndVerify({factorId,code});if(!valid(stamp))return;if(error)throw error;
      const access=await root.FBZAdmin.request('access_status');if(!valid(stamp))return;
      if(access.mfaRequired)throw new Error('assurance_not_upgraded');
      clear();document.getElementById('adminSecurityGate')?.remove();
      const console=document.getElementById('adminConsole');console.hidden=false;console.inert=false;
      toast('Защита подтверждена');root.FBZAdmin.mount();
    }catch(error){if(valid(stamp)){status(errorText(error));input.focus();}}
    finally{if(stamp===version){busy=false;button.disabled=false;}}
  }
  async function discard(id){
    if(busy)return;const stamp=version;busy=true;
    try{
      const {data,error}=await api().listFactors();if(!valid(stamp))return;if(error)throw error;
      if(!data?.all?.some(f=>f.id===id&&f.factor_type==='totp'&&f.status==='unverified'))throw new Error('not_pending');
      const {error:removeError}=await api().unenroll({factorId:id});if(!valid(stamp))return;if(removeError)throw removeError;
      busy=false;await open();
    }catch(error){if(valid(stamp))status(errorText(error));}finally{if(stamp===version)busy=false;}
  }
  function required(code){
    if(code==='admin_session_invalid'){clear();gate('Сессия завершена. Выйдите из аккаунта и войдите снова.');return;}
    if(code==='admin_mfa_required')gate();
    // Never replay operations automatically, especially cleanup.
    if(CP==='admin')void open(code==='admin_mfa_recent_required');
  }
  document.addEventListener('fbz:overlay-close',event=>{if(event.target.id==='adminMfaModal'){setup=null;event.target.querySelector('img')?.remove();event.target.querySelector('code')?.replaceChildren();event.target.querySelectorAll('input').forEach(input=>input.value='');version++;busy=false;}});
  document.addEventListener('fbz:session-change',event=>syncSession(event.detail?.userId||null));
  root.FBZAdminSecurity=Object.freeze({mount,syncSession,syncRoute,required});
  FBZActions.register({'admin-security.open':(event,element)=>{element.focus({preventScroll:true});return open();},'admin-security.close':()=>clear(),'admin-security.enroll':()=>enroll(),'admin-security.verify':event=>verify(event),'admin-security.discard':(event,element,[id])=>discard(id)});
})(window);
