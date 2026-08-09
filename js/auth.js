'use strict';

let authEmailStored='';
let authMode='login';
let authSessionUserId=null;
let authStateVersion=0;
let profileCompletionUser=null;
let profileLoadPromise=null;

async function onLogin(user){
  if(!user)return false;
  if(authSessionUserId===user.id&&CU)return true;
  if(authSessionUserId===user.id&&profileLoadPromise)return profileLoadPromise;

  authSessionUserId=user.id;
  const version=++authStateVersion;
  profileLoadPromise=loadSessionProfile(user,version);
  try{return await profileLoadPromise;}
  finally{if(version===authStateVersion)profileLoadPromise=null;}
}

async function loadSessionProfile(user,version){
  const{data:profile,error}=await sb.rpc('get_my_profile').maybeSingle();
  if(error){
    if(version===authStateVersion)authSessionUserId=null;
    throw error;
  }
  if(version!==authStateVersion)return false;
  if(!profile){
    CU=null;
    renderNav();
    openProfileCompletion(user);
    return false;
  }

  profileCompletionUser=null;
  CU={...profile,email:user.email};
  renderNav();
  loadNotifications();
  return true;
}

function onLogout(){
  authStateVersion++;
  authSessionUserId=null;
  profileLoadPromise=null;
  profileCompletionUser=null;
  CU=null;
  window.FBZAccount?.close();
  renderNav();
}

function hideAllAuth(){
  ['authLogin','authStep1','authStep2','authStep3'].forEach(id=>{
    const element=document.getElementById(id);
    if(element)element.style.display='none';
  });
}

function openAuth(){
  switchToLogin();
  window.FBZOverlay?.open('authOv','#loginEmail');
}

function openRegister(){
  switchToRegister();
  window.FBZOverlay?.open('authOv','#authEmail');
}

function closeAuth(){window.FBZOverlay?.close('authOv');}

function switchToLogin(){
  authMode='login';
  hideAllAuth();
  document.getElementById('authLogin').style.display='block';
  clearAuthError('loginErr');
}

function switchToRegister(){
  authMode='register';
  hideAllAuth();
  document.getElementById('authStep1').style.display='block';
  clearAuthError('authE');
}

function showAuthStep(step){
  hideAllAuth();
  const target=document.getElementById(`authStep${step}`);
  if(target)target.style.display='block';
}

function openProfileCompletion(user){
  profileCompletionUser=user;
  authEmailStored=user.email||authEmailStored;
  showAuthStep(3);
  window.FBZOverlay?.open('authOv','#rU');
}

function clearAuthError(id){
  const target=document.getElementById(id);
  if(target)target.textContent='';
}

function setAuthError(id,message){
  const target=document.getElementById(id);
  if(target)target.textContent=message;
}

function safeAuthError(error,fallback){
  console.warn('Auth operation failed:',error?.code||error?.message||error);
  return window.FBZDomain.authErrorMessage(error,fallback);
}

async function doLogin(){
  const email=document.getElementById('loginEmail').value.trim();
  const password=document.getElementById('loginPass').value;
  if(!email){setAuthError('loginErr','Введите email');return;}
  if(!password){setAuthError('loginErr','Введите пароль');return;}

  const button=document.getElementById('loginBtn');
  button.disabled=true;
  button.textContent='Входим...';
  clearAuthError('loginErr');
  try{
    const{data,error}=await sb.auth.signInWithPassword({email,password});
    if(error)throw error;
    const ready=await onLogin(data.user);
    if(ready){closeAuth();toast('С возвращением!','ok');}
  }catch(error){
    setAuthError('loginErr',safeAuthError(error,'Не удалось войти. Попробуйте ещё раз'));
  }finally{
    button.disabled=false;
    button.textContent='Войти';
  }
}

async function sendOTP(){
  const email=document.getElementById('authEmail').value.trim();
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    setAuthError('authE','Введите корректный email');
    return;
  }

  const button=document.getElementById('authSendBtn');
  button.disabled=true;
  button.textContent='Отправляем...';
  clearAuthError('authE');
  try{
    const{error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
    if(error)throw error;
    authEmailStored=email;
    document.getElementById('authEmailShow').textContent=email;
    showAuthStep(2);
    document.getElementById('authCode').focus();
    toast('Код отправлен на почту','ok');
  }catch(error){
    setAuthError('authE',safeAuthError(error,'Не удалось отправить код. Попробуйте позже'));
  }finally{
    button.disabled=false;
    button.textContent='Отправить код →';
  }
}

async function verifyOTP(){
  const code=document.getElementById('authCode').value.trim();
  if(!/^\d{6}$/.test(code)){
    setAuthError('authE2','Введите 6-значный код');
    return;
  }

  const button=document.getElementById('authVerifyBtn');
  button.disabled=true;
  button.textContent='Проверяем...';
  clearAuthError('authE2');
  try{
    const{data,error}=await sb.auth.verifyOtp({email:authEmailStored,token:code,type:'email'});
    if(error)throw error;
    const ready=await onLogin(data.user);
    if(ready){closeAuth();toast('Добро пожаловать!','ok');}
  }catch(error){
    setAuthError('authE2',safeAuthError(error,'Не удалось подтвердить код'));
  }finally{
    button.disabled=false;
    button.textContent='Подтвердить';
  }
}

async function saveProfile(){
  const username=document.getElementById('rU').value.trim();
  const password=document.getElementById('rP').value;
  const bio=document.getElementById('rB').value.trim();
  const teams=document.getElementById('rT').value.trim();
  if(!username){setAuthError('authE3','Введите никнейм');return;}
  if(!/^[a-zA-Z0-9_а-яёА-ЯЁ]{3,30}$/.test(username)){
    setAuthError('authE3','Никнейм: 3–30 символов без пробелов');
    return;
  }
  if(password.length<8){setAuthError('authE3','Пароль должен содержать минимум 8 символов');return;}
  if(bio.length>100){setAuthError('authE3','Описание слишком длинное');return;}

  const button=document.getElementById('profileSaveBtn');
  button.disabled=true;
  button.textContent='Создаём профиль...';
  clearAuthError('authE3');
  try{
    const{data:{user},error:userError}=await sb.auth.getUser();
    if(userError||!user)throw userError||new Error('auth_required');
    profileCompletionUser=user;

    const{data:existingProfile,error:profileLookupError}=await sb.rpc('get_my_profile').maybeSingle();
    if(profileLookupError)throw profileLookupError;
    if(existingProfile){
      const ready=await onLogin(user);
      if(ready){closeAuth();toast('Профиль уже был создан','ok');}
      return;
    }

    const{data:usedName,error:nameError}=await sb.from('users').select('id').ilike('username',username).limit(1).maybeSingle();
    if(nameError)throw nameError;
    if(usedName){setAuthError('authE3','Никнейм уже занят');return;}

    const{error:passwordError}=await sb.auth.updateUser({password});
    if(passwordError)throw passwordError;
    const{error:insertError}=await sb.from('users').insert({
      id:user.id,
      username,
      display_name:username,
      bio:bio||null,
      favorite_teams:teams||null,
      is_public:true
    });
    if(insertError){
      if(insertError.code==='23505'){
        const{data:profileAfterConflict}=await sb.rpc('get_my_profile').maybeSingle();
        if(profileAfterConflict){
          const ready=await onLogin(user);
          if(ready){closeAuth();toast('Профиль создан','ok');}
          return;
        }
        setAuthError('authE3','Никнейм уже занят');
        return;
      }
      throw insertError;
    }

    authSessionUserId=null;
    const ready=await onLogin(user);
    if(ready){closeAuth();toast('Добро пожаловать в FOOTBAZED!','ok');}
  }catch(error){
    setAuthError('authE3',safeAuthError(error,'Не удалось создать профиль. Попробуйте ещё раз'));
  }finally{
    button.disabled=false;
    button.textContent='Создать аккаунт →';
  }
}

async function doLogout(){
  const{error}=await sb.auth.signOut();
  if(error){toast('Не удалось выйти. Попробуйте ещё раз','err');return;}
  onLogout();
  toast('Вы вышли','ok');
  go('home');
}

function initAuthInteractions(){
  document.getElementById('loginPass')?.addEventListener('keydown',event=>{
    if(event.key==='Enter')doLogin();
  });
  document.getElementById('authEmail')?.addEventListener('keydown',event=>{
    if(event.key==='Enter')sendOTP();
  });
  document.getElementById('authCode')?.addEventListener('keydown',event=>{
    if(event.key==='Enter')verifyOTP();
  });
  document.getElementById('rP')?.addEventListener('keydown',event=>{
    if(event.key==='Enter')saveProfile();
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAuthInteractions,{once:true});
else initAuthInteractions();
