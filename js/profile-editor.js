(function(){
  'use strict';
  let generation=0,avatarGeneration=0,avatar=null,avatarUrl='',saving=false;
  const el=id=>document.getElementById(id);
  function resetSession(){generation++;avatarGeneration++;avatar=null;saving=false;if(avatarUrl)URL.revokeObjectURL(avatarUrl);avatarUrl='';}
  function open(){
    if(!CU){openAuth();return;}
    resetSession();
    const src=safeImageUrl(CU.avatar_url);
    el('profileW').innerHTML=`<div class="profile-editor"><header><span class="section-kicker">Мой профиль</span><h1>Ваш футбольный профиль</h1><p>Так вас видят другие болельщики.</p></header><form data-fbz-submit="profile-editor.profile-editor-save">
      <div class="profile-photo"><button class="profile-photo-button" type="button" data-fbz-click="profile-editor.choose-avatar" aria-label="Выбрать фотографию профиля"><span id="avPreview">${src?`<img src="${src}" alt="">`:`<span class="phero-av ${avColor(CU.username)}">${esc((CU.username||'U')[0].toUpperCase())}</span>`}</span><span class="profile-photo-edit">${ico('photo',16)}</span></button><div><strong>Фото профиля</strong><p>JPG, PNG или WebP, до 5 МБ.<br>Сохраним квадратный аватар.</p></div><input id="avFile" type="file" accept="image/jpeg,image/png,image/webp" hidden data-fbz-change="profile-editor.profile-editor-preview"></div>
      <label for="ep_user">Никнейм</label><input class="input" id="ep_user" value="${esc(CU.username)}" minlength="3" maxlength="30" required autocomplete="nickname" aria-describedby="usernameHint"><p class="field-hint" id="usernameHint">3–30 символов: буквы, цифры и нижнее подчёркивание.</p>
      <label for="ep_email">Email</label><input class="input" id="ep_email" value="${esc(CU.email||'')}" readonly aria-describedby="emailHint"><p class="field-hint" id="emailHint">Доступен только вам.</p>
      <label for="ep_bio">О себе <span>Необязательно</span></label><textarea class="input" id="ep_bio" rows="3" maxlength="120" placeholder="За кого болеете и что цените в футболе" data-fbz-input="profile-editor.profile-editor-update-count" aria-describedby="bioCount">${esc(CU.bio||'')}</textarea><p class="field-hint field-counter" id="bioCount">${String(CU.bio||'').length}/120</p>
      <div class="profile-favorites-help"><b>Любимые клубы</b><p>Откройте клуб через поиск и добавьте его в избранное.</p><button class="text-action" type="button" data-fbz-click="shell.open-global-search">Найти клуб →</button></div>
      <p class="form-error" id="profileEditError" role="alert" hidden></p>
      <div class="profile-editor-actions"><button class="btn btn-g" type="button" data-fbz-click="profile-editor.profile-editor-cancel">Отмена</button><button class="btn btn-l" id="epSaveBtn" type="submit">Сохранить</button></div>
    </form></div>`;
    el('ep_user').focus({preventScroll:true});
  }
  function error(message){const target=el('profileEditError');if(target){target.textContent=message;target.hidden=!message;}}
  function updateCount(){el('bioCount').textContent=`${el('ep_bio').value.length}/120`;}
  function cancel(){if(saving)return;resetSession();loadProfile(CU?.id);}
  async function preview(input){
    const file=input.files?.[0];if(!file)return;
    const token=++avatarGeneration,view=generation;
    if(file.size>5*1024*1024){error('Выберите изображение размером до 5 МБ.');input.value='';return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){error('Поддерживаются изображения JPG, PNG и WebP.');input.value='';return;}
    error('');el('epSaveBtn').disabled=true;
    let bitmap;
    try{
      bitmap=await createImageBitmap(file);
      const canvas=document.createElement('canvas');canvas.width=canvas.height=200;
      const size=Math.min(bitmap.width,bitmap.height);
      canvas.getContext('2d').drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,200,200);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));
      if(view!==generation||token!==avatarGeneration||!el('avPreview'))return;
      if(!blob)throw new Error('image_decode_failed');
      avatar=blob;if(avatarUrl)URL.revokeObjectURL(avatarUrl);avatarUrl=URL.createObjectURL(blob);
      const image=document.createElement('img');image.src=avatarUrl;image.alt='Предпросмотр аватара';el('avPreview').replaceChildren(image);
    }catch(failure){if(view===generation&&token===avatarGeneration)error('Не удалось открыть изображение. Попробуйте другой файл.');}
    finally{bitmap?.close();if(view===generation&&token===avatarGeneration&&el('epSaveBtn'))el('epSaveBtn').disabled=saving;}
  }
  async function save(event){
    event?.preventDefault();
    if(saving||!CU)return;
    const user=CU.id,view=generation,name=el('ep_user').value.trim(),bio=el('ep_bio').value.trim(),photo=avatar;
    if(!/^[a-zA-Z0-9_а-яёА-ЯЁ]{3,30}$/u.test(name)){error('Никнейм: от 3 до 30 букв, цифр или знаков подчёркивания.');el('ep_user').focus();return;}
    const current=()=>view===generation&&CU?.id===user;
    saving=true;error('');
    const button=el('epSaveBtn');button.disabled=true;button.textContent='Сохраняем…';
    const controls=[...el('profileW').querySelectorAll('input,textarea,button')];controls.forEach(control=>control.disabled=true);
    try{
      const update={username:name,display_name:name,bio:bio||null};
      if(photo){
        const path=`${user}/avatar.jpg`;
        const result=await sb.storage.from('avatars').upload(path,photo,{upsert:true,contentType:'image/jpeg',cacheControl:'31536000'});
        if(result.error)throw result.error;
        if(!current())return;
        const {data}=sb.storage.from('avatars').getPublicUrl(path);
        const url=safeImageUrl(data?.publicUrl);if(!url)throw new Error('avatar_url_missing');
        update.avatar_url=`${url}?v=${Date.now()}`;
      }
      if(!current())return;
      const result=await sb.from('users').update(update).eq('id',user);
      if(result.error)throw result.error;
      if(!current())return;
      CU={...CU,...update};clearAppCache();window.FBZData?.invalidate('profile:');
      resetSession();renderNav();await loadProfile(user);toast('Профиль обновлён');
    }catch(failure){if(current())error(failure?.code==='23505'?'Этот никнейм уже занят. Выберите другой.':'Не удалось сохранить профиль. Ваши изменения остались в форме. Попробуйте ещё раз.');}
    finally{if(current()){saving=false;controls.forEach(control=>{if(control.isConnected)control.disabled=false;});button.textContent='Сохранить';}}
  }
  window.FBZProfileEditor={open,preview,save,cancel,updateCount,resetSession};
})();

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "profile-editor.profile-editor-save":(event)=>FBZProfileEditor.save(event),
  "profile-editor.choose-avatar":()=>document.getElementById('avFile').click(),
  "profile-editor.profile-editor-preview":(event,element)=>FBZProfileEditor.preview(element),
  "profile-editor.profile-editor-update-count":()=>FBZProfileEditor.updateCount(),
  "profile-editor.profile-editor-cancel":()=>FBZProfileEditor.cancel()
});
