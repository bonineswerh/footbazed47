(function(){
  'use strict';

  const state={
    conversationId:null,
    friend:null,
    messages:[],
    channel:null,
    viewVersion:0,
    messageVersion:0,
    sending:false,
    uploading:false,
    recorder:null,
    recordingStream:null,
    recordingChunks:[],
    forwardRatingId:null,
    signedUrls:new Map(),
    drafts:new Map(),
    hasMore:false,
    beforeId:null,
    loadingOlder:false,
    editingId:null,
    recordingPending:false
  };

  const el=id=>document.getElementById(id);

  function context(){return{version:state.viewVersion,conversationId:state.conversationId,userId:CU?.id};}
  function isCurrent(snapshot){return snapshot.version===state.viewVersion&&snapshot.conversationId===state.conversationId&&snapshot.userId===CU?.id;}

  function resizeComposer(){
    const input=el('directChatInput');
    input.style.height='auto';input.style.height=`${Math.min(input.scrollHeight,116)}px`;
  }

  function saveDraft(){
    if(state.friend?.id)state.drafts.set(state.friend.id,el('directChatInput').value);
  }

  function stopRecording(send=false){
    const recorder=state.recorder;
    if(recorder){recorder.sendOnStop=send;if(recorder.state==='recording')recorder.stop();}
    state.recordingStream?.getTracks().forEach(track=>track.stop());
    state.recordingStream=null;state.recorder=null;state.recordingPending=false;
    const button=el('directChatVoice');
    button.classList.remove('recording');button.setAttribute('aria-pressed','false');
    button.setAttribute('aria-label','Записать голосовое сообщение');button.title='Голосовое сообщение';
  }

  function leaveView(){
    saveDraft();state.viewVersion++;state.messageVersion++;
    stopRecording();unsubscribe();
    state.conversationId=null;state.friend=null;state.messages=[];state.signedUrls.clear();
    state.sending=false;state.uploading=false;state.loadingOlder=false;state.hasMore=false;state.beforeId=null;state.editingId=null;
    el('directChatInput').value='';el('directChatInput').style.height='';el('directChatSend').disabled=false;
    el('directChatMedia').value='';setComposer(false);setBusy('');
    el('directChatBody').replaceChildren();
  }

  function errorState(message,action,label='Повторить'){
    return`<div class="dm-empty"><span>${esc(message)}</span><button class="btn btn-g btn-sm" type="button" ${action}>${esc(label)}</button></div>`;
  }

  function absoluteTime(value){
    const date=new Date(value);
    return date.toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  }

  function dayLabel(value){
    const date=new Date(value);
    const today=new Date();
    const yesterday=new Date(today);yesterday.setDate(today.getDate()-1);
    const key=date.toLocaleDateString('ru-RU');
    if(key===today.toLocaleDateString('ru-RU'))return'Сегодня';
    if(key===yesterday.toLocaleDateString('ru-RU'))return'Вчера';
    return date.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
  }

  function initials(user){
    return String(user?.display_name||user?.username||'F').trim().split(/\s+/u).slice(0,2)
      .map(part=>part[0]||'').join('').toLocaleUpperCase('ru-RU');
  }

  function avatarMarkup(user){
    const image=safeImageUrl(user?.avatar_url);
    return image?`<img src="${image}" alt="" decoding="async">`:`<span>${esc(initials(user))}</span>`;
  }

  function setPerson(user,subtitle='Личный чат'){
    state.friend=user||null;
    el('directChatAvatar').innerHTML=avatarMarkup(user);
    el('directChatTitle').textContent=user?.display_name||user?.username||'Сообщения';
    el('directChatSubtitle').textContent=user?.username?`@${user.username} · ${subtitle}`:subtitle;
    const person=el('directChatPerson');
    person.disabled=!user?.id;
    person.onclick=user?.id?()=>{close();go('profile',{uid:user.id});}:null;
  }

  function setBusy(message='',error=false){
    const host=el('directChatUploadState');
    host.hidden=!message;
    host.textContent=message;
    host.classList.toggle('error',Boolean(error));
  }

  function setComposer(visible){
    el('directChatComposer').hidden=!visible;
    el('directChatBack').hidden=!visible;
  }

  async function friendUser(friendId){
    const{data,error}=await sb.from('users').select(PUBLIC_USER_FIELDS).eq('id',friendId).maybeSingle();
    if(error)throw error;
    return data;
  }

  function supporterLabel(side){
    if(side==='home')return'болельщик хозяев';
    if(side==='away')return'болельщик гостей';
    return'нейтральный зритель';
  }

  function ratingCard(message){
    const rating=message.rating;
    if(!rating)return'';
    const score=Number(rating.score)||0;
    const presentation=window.FBZDomain.ratingPresentation(score,Number.isInteger(score)?0:1);
    const title=`${rating.home_team_name||'Команда'} — ${rating.away_team_name||'Команда'}`;
    const result=rating.home_score===null||rating.home_score===undefined?'Матч':`${rating.home_score} : ${rating.away_score}`;
    return`<button class="dm-rating-card" type="button" ${FBZActions.attrs("messages.open-match",[Number(rating.match_id)||0])}>
      <strong class="dm-rating-score" data-tone="${presentation.tone}" aria-label="Оценка ${presentation.label}">${presentation.label}</strong>
      <small>Оценка матча · ${esc(supporterLabel(rating.supporter_side))}</small>
      <b>${esc(title)}</b><span>${esc(result)} · Открыть матч →</span>
    </button>`;
  }

  function mediaMarkup(message){
    const url=state.signedUrls.get(message.media_path)?.url||'';
    if(!url)return message.media_kind&&message.media_kind!=='rating'?'<div class="dm-text">Медиа недоступно</div>':'';
    const safe=safeImageUrl(url);
    if(message.media_kind==='image')return`<img class="dm-media" src="${safe}" alt="Отправленное изображение" loading="lazy" decoding="async">`;
    if(message.media_kind==='video')return`<video class="dm-media" src="${safe}" controls preload="metadata"></video>`;
    if(message.media_kind==='audio')return`<audio class="dm-media" src="${safe}" controls preload="metadata"></audio>`;
    return'';
  }

  function messageMarkup(message){
    const own=message.sender_id===CU?.id;
    const sender=message.sender||{};
    const name=sender.display_name||sender.username||'Болельщик';
    return`<article class="dm-message${own?' own':''}" data-message-id="${Number(message.id)}">
      <div class="dm-message-avatar"><button type="button" ${FBZActions.attrs("messages.open-profile",[message.sender_id])} aria-label="Профиль ${esc(name)}">${avatarMarkup(sender)}</button></div>
      <div class="dm-bubble">
        <div class="dm-author">
          <button type="button" ${FBZActions.attrs("messages.open-profile",[message.sender_id])}>@${esc(sender.username||'user')}</button>
          ${message.edited_at?'<small>ред.</small>':''}
          <time datetime="${esc(message.created_at)}">${esc(absoluteTime(message.created_at))}</time>
          ${message.can_edit&&message.body?`<button class="dm-edit" type="button" ${FBZActions.attrs("messages.edit",[Number(message.id)])}>Изменить</button>`:''}
        </div>
        ${state.editingId===Number(message.id)?`<form class="dm-edit-form" ${FBZActions.attrs("messages.save-edit",[Number(message.id)],"submit")}><label class="sr-only" for="dm-edit-${Number(message.id)}">Изменить сообщение</label><textarea id="dm-edit-${Number(message.id)}" maxlength="2000" rows="3" required>${esc(message.body)}</textarea><div><button class="btn btn-g btn-sm" type="button" data-fbz-click="messages.cancel-edit">Отмена</button><button class="btn btn-l btn-sm" type="submit">Сохранить</button></div></form>`:message.body?`<div class="dm-text">${esc(message.body)}</div>`:''}
        ${mediaMarkup(message)}${ratingCard(message)}
      </div>
    </article>`;
  }

  async function hydrateMedia(messages,snapshot){
    const paths=[...new Set(messages.filter(message=>['image','video','audio'].includes(message.media_kind)&&message.media_path)
      .map(message=>message.media_path).filter(path=>(state.signedUrls.get(path)?.expiresAt||0)<Date.now()+60000))];
    await Promise.all(paths.map(async path=>{
      const{data,error}=await sb.storage.from('chat-media').createSignedUrl(path,3600);
      if(isCurrent(snapshot)&&!error&&data?.signedUrl)state.signedUrls.set(path,{url:data.signedUrl,expiresAt:Date.now()+3600000});
    }));
  }

  function renderMessages({scroll='preserve'}={}){
    const host=el('directChatBody');
    const previousTop=host.scrollTop,previousHeight=host.scrollHeight;
    const atBottom=previousHeight-previousTop-host.clientHeight<80;
    const editor=host.querySelector('.dm-edit-form textarea');
    const draft=editor?.value,selection=editor?[editor.selectionStart,editor.selectionEnd]:null;
    const editorFocused=editor===document.activeElement;
    if(!state.messages.length){host.innerHTML='<div class="dm-empty">Здесь пока нет сообщений.<br>Начните разговор или отправьте оценку матча.</div>';return;}
    let currentDay='';
    const older=state.hasMore?`<div class="dm-history"><button class="btn btn-g btn-sm" type="button" data-fbz-click="messages.load-older" ${state.loadingOlder?'disabled':''}>${state.loadingOlder?'Загружаем…':'Более ранние сообщения'}</button></div>`:'';
    host.innerHTML=older+state.messages.map(message=>{
      const label=dayLabel(message.created_at);
      const divider=label===currentDay?'':`<div class="dm-day"><span>${esc(label)}</span></div>`;
      currentDay=label;
      return divider+messageMarkup(message);
    }).join('');
    const nextEditor=host.querySelector('.dm-edit-form textarea');
    if(nextEditor&&draft!==undefined){nextEditor.value=draft;if(editorFocused){nextEditor.focus({preventScroll:true});nextEditor.setSelectionRange(...selection);}}
    if(scroll==='bottom'||(scroll==='preserve'&&atBottom))host.scrollTop=host.scrollHeight;
    else if(scroll==='prepend')host.scrollTop=previousTop+host.scrollHeight-previousHeight;
    else host.scrollTop=previousTop;
  }

  async function loadMessages({older=false,scroll='preserve'}={}){
    if(!state.conversationId)return;
    const snapshot=context(),version=++state.messageVersion;
    const{data,error}=await sb.rpc('get_direct_messages',{p_conversation_id:snapshot.conversationId,p_limit:80,p_before_id:older?state.beforeId:null});
    if(!isCurrent(snapshot)||version!==state.messageVersion)return;
    if(error)throw error;
    const incoming=Array.isArray(data?.items)?data.items:[];
    await hydrateMedia(incoming,snapshot);
    if(!isCurrent(snapshot)||version!==state.messageVersion)return;
    const existing=new Map(state.messages.map(message=>[Number(message.id),message]));
    incoming.forEach(message=>existing.set(Number(message.id),message));
    state.messages=[...existing.values()].sort((a,b)=>Number(a.id)-Number(b.id));
    if(older||state.beforeId===null){state.beforeId=data?.next_before_id||null;state.hasMore=Boolean(data?.has_more&&state.beforeId);}
    state.loadingOlder=false;
    renderMessages({scroll:older?'prepend':scroll});
  }

  async function loadOlder(){
    if(!state.hasMore||state.loadingOlder)return;
    const snapshot=context();state.loadingOlder=true;renderMessages({scroll:'keep'});
    try{await loadMessages({older:true});}
    catch{if(isCurrent(snapshot))setBusy('Не удалось загрузить историю. Повторите попытку.',true);}
    finally{if(isCurrent(snapshot)){state.loadingOlder=false;renderMessages({scroll:'keep'});}}
  }

  function unsubscribe(){
    if(state.channel){sb.removeChannel(state.channel);state.channel=null;}
  }

  function subscribe(){
    unsubscribe();
    if(!state.conversationId||!sb.channel)return;
    state.channel=sb.channel(`direct-${state.conversationId}-${Date.now()}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'direct_messages',filter:`conversation_id=eq.${state.conversationId}`},()=>loadMessages().catch(()=>setBusy('Не удалось обновить сообщения. Откройте чат снова.',true)))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'direct_messages',filter:`conversation_id=eq.${state.conversationId}`},()=>loadMessages().catch(()=>setBusy('Не удалось обновить сообщения. Откройте чат снова.',true)))
      .subscribe();
  }

  async function openFriend(friendId){
    if(!CU){openAuth();return;}
    leaveView();
    const version=state.viewVersion,userId=CU.id;
    state.forwardRatingId=null;
    FBZOverlay.open('directChatOv','#directChatInput');
    setComposer(false);setBusy('');setPerson(null,'Загрузка');
    el('directChatBody').innerHTML='<div class="dm-loading"><span class="spin"></span>Открываем защищённый чат</div>';
    try{
      const[{data:conversation,error},user]=await Promise.all([
        sb.rpc('get_or_create_direct_conversation',{p_friend_id:friendId}),friendUser(friendId)
      ]);
      if(version!==state.viewVersion||userId!==CU?.id)return;
      if(error)throw error;
      state.conversationId=Number(conversation.id);
      setPerson(user);setComposer(true);
      el('directChatInput').value=state.drafts.get(friendId)||'';resizeComposer();
      await loadMessages({scroll:'bottom'});
      if(version!==state.viewVersion||userId!==CU?.id)return;
      subscribe();el('directChatInput').focus({preventScroll:true});
    }catch(error){
      if(version!==state.viewVersion||userId!==CU?.id)return;
      console.error('Direct chat error:',error);
      setComposer(false);el('directChatBack').hidden=false;
      el('directChatBody').innerHTML=errorState('Не удалось открыть чат. Проверьте соединение и дружбу с пользователем.',FBZActions.attrs('messages.open-friend',[friendId]));
      setBusy('Чат временно недоступен',true);
    }
  }

  async function acceptedFriends(){
    const{data:rows,error}=await sb.from('friendships').select('friend_id').eq('user_id',CU.id).eq('status','accepted');
    if(error)throw error;
    const ids=(rows||[]).map(row=>row.friend_id);
    if(!ids.length)return[];
    const{data:users,error:userError}=await sb.from('users').select(PUBLIC_USER_FIELDS).in('id',ids).order('username');
    if(userError)throw userError;
    return users||[];
  }

  async function showPicker(){
    if(!CU){close();openAuth();return;}
    leaveView();
    const version=state.viewVersion,userId=CU.id;
    setComposer(false);setBusy('');
    el('directChatBack').hidden=true;
    el('directChatTitle').textContent=state.forwardRatingId?'Кому отправить':'Сообщения';
    el('directChatSubtitle').textContent=state.forwardRatingId?'Выберите друга':'Ваши личные чаты';
    el('directChatAvatar').textContent=state.forwardRatingId?'↗':'F';
    el('directChatPerson').disabled=true;
    const host=el('directChatBody');
    host.innerHTML='<div class="dm-loading"><span class="spin"></span>Загружаем друзей</div>';
    try{
      const friends=await acceptedFriends();
      if(version!==state.viewVersion||userId!==CU?.id)return;
      if(!friends.length){host.innerHTML=errorState('Чтобы начать личный чат, сначала добавьте пользователя в друзья.',FBZActions.attrs('messages.find-friends'),'Найти друзей');return;}
      host.innerHTML=`<h2 class="dm-picker-title">${state.forwardRatingId?'Отправить оценку':'Выберите чат'}</h2><div class="dm-picker-list">${friends.map(user=>`<button class="dm-picker-item" type="button" ${FBZActions.attrs("messages.choose-friend",[user.id])}><span class="dm-avatar">${avatarMarkup(user)}</span><span><b>${esc(user.display_name||user.username||'Болельщик')}</b><small>@${esc(user.username||'user')}</small></span><span>→</span></button>`).join('')}</div>`;
    }catch(error){
      if(version!==state.viewVersion||userId!==CU?.id)return;
      console.error('Friend picker error:',error);host.innerHTML=errorState('Не удалось загрузить список друзей.',FBZActions.attrs('shell.messages-show-picker'));
    }
  }

  function pickFriend(ratingId){
    if(!CU){openAuth();return;}
    state.forwardRatingId=Number(ratingId)||null;
    FBZOverlay.open('directChatOv');
    showPicker();
  }

  async function chooseFriend(friendId){
    if(state.sending)return;
    const ratingId=state.forwardRatingId;
    if(!ratingId){await openFriend(friendId);return;}
    state.sending=true;
    const snapshot=context();
    el('directChatBody').innerHTML='<div class="dm-loading"><span class="spin"></span>Отправляем оценку</div>';
    try{
      const{data:conversation,error}=await sb.rpc('get_or_create_direct_conversation',{p_friend_id:friendId});
      if(!isCurrent(snapshot))return;
      if(error)throw error;
      const{error:sendError}=await sb.rpc('send_direct_message',{p_conversation_id:Number(conversation.id),p_body:null,p_media_kind:'rating',p_media_path:null,p_rating_id:ratingId});
      if(sendError)throw sendError;
      if(!isCurrent(snapshot))return;
      toast('Оценка отправлена другу','ok');
      await openFriend(friendId);
    }catch(error){
      if(!isCurrent(snapshot))return;
      console.error('Forward rating error:',error);toast('Не удалось отправить оценку','err');await showPicker();
    }finally{if(isCurrent(snapshot))state.sending=false;}
  }

  async function send(event){
    event?.preventDefault();
    if(state.uploading||state.sending||!state.conversationId)return;
    const input=el('directChatInput');
    const body=input.value.trim();
    if(!body)return;
    if(body.length>2000){toast('Сообщение не должно превышать 2000 символов','err');return;}
    const snapshot=context(),friendId=state.friend?.id,original=input.value;
    state.sending=true;
    const button=el('directChatSend');button.disabled=true;
    try{
      const{error}=await sb.rpc('send_direct_message',{p_conversation_id:snapshot.conversationId,p_body:body,p_media_kind:null,p_media_path:null,p_rating_id:null});
      if(error)throw error;
      if(!isCurrent(snapshot)){if(snapshot.userId===CU?.id&&state.drafts.get(friendId)===original)state.drafts.delete(friendId);return;}
      if(input.value===original){input.value='';input.style.height='';state.drafts.delete(friendId);}
      setBusy('');
      await loadMessages({scroll:'bottom'}).catch(()=>setBusy('Сообщение отправлено. Не удалось обновить историю.',true));
    }catch(error){if(isCurrent(snapshot)){console.error('Send message error:',error);toast(error.message==='message_rate_limited'?'Слишком много сообщений. Подождите немного.':'Не удалось отправить сообщение. Текст сохранён.','err');}}
    finally{if(isCurrent(snapshot)){state.sending=false;button.disabled=false;input.focus();}}
  }

  function composerKeydown(event){
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();send();}
  }

  function extensionFor(type,name=''){
    const known={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','audio/webm':'webm','audio/ogg':'ogg','audio/mpeg':'mp3','audio/mp4':'m4a'};
    return known[type]||String(name).split('.').pop()?.replace(/[^a-z0-9]/gi,'').slice(0,5).toLowerCase()||'bin';
  }

  async function upload(file,kind,fileName=''){
    if(state.uploading||!state.conversationId||!file)return;
    const snapshot=context();
    const max=kind==='video'?30*1024*1024:kind==='audio'?12*1024*1024:8*1024*1024;
    if(file.size>max){toast(`Файл больше ${Math.round(max/1024/1024)} МБ`,'err');return;}
    state.uploading=true;setBusy(kind==='audio'?'Отправляем голосовое сообщение…':'Загружаем медиа…');
    const path=`${snapshot.conversationId}/${snapshot.userId}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(file.type,fileName||file.name)}`;
    try{
      const contentType=String(file.type||'application/octet-stream').split(';')[0];
      const{error:uploadError}=await sb.storage.from('chat-media').upload(path,file,{contentType,upsert:false,cacheControl:'3600'});
      if(uploadError)throw uploadError;
      if(!isCurrent(snapshot)){await sb.storage.from('chat-media').remove([path]);return;}
      const{error:sendError}=await sb.rpc('send_direct_message',{p_conversation_id:snapshot.conversationId,p_body:null,p_media_kind:kind,p_media_path:path,p_rating_id:null});
      if(sendError){await sb.storage.from('chat-media').remove([path]);throw sendError;}
      if(!isCurrent(snapshot))return;
      setBusy('');await loadMessages({scroll:'bottom'}).catch(()=>setBusy('Файл отправлен. Не удалось обновить историю.',true));
    }catch(error){if(isCurrent(snapshot)){console.error('Media upload error:',error);setBusy('Не удалось отправить файл. Выберите его повторно.',true);toast('Не удалось отправить файл','err');}}
    finally{if(isCurrent(snapshot)){state.uploading=false;el('directChatMedia').value='';}}
  }

  function attach(file){
    if(!file)return;
    const kind=file.type.startsWith('image/')?'image':file.type.startsWith('video/')?'video':'';
    if(!kind){toast('Поддерживаются изображения и видео','err');return;}
    upload(file,kind);
  }

  async function toggleVoice(){
    if(state.recorder&&state.recorder.state==='recording'){stopRecording(true);return;}
    if(state.recordingPending||state.uploading||!state.conversationId)return;
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('Запись голоса не поддерживается этим браузером','err');return;}
    const snapshot=context();state.recordingPending=true;
    let stream;
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!isCurrent(snapshot)){stream.getTracks().forEach(track=>track.stop());return;}
      const mime=['audio/webm;codecs=opus','audio/webm','audio/ogg'].find(type=>MediaRecorder.isTypeSupported(type))||'';
      const recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
      state.recordingStream=stream;state.recorder=recorder;state.recordingChunks=[];
      const chunks=[];recorder.sendOnStop=false;
      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      recorder.onstop=async()=>{
        const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
        stream.getTracks().forEach(track=>track.stop());
        if(!isCurrent(snapshot))return;
        if(state.recorder===recorder){state.recordingStream=null;state.recorder=null;}
        setBusy('');
        if(recorder.sendOnStop&&blob.size>1000)await upload(blob,'audio','voice.webm');
      };
      recorder.start(500);el('directChatVoice').classList.add('recording');el('directChatVoice').setAttribute('aria-pressed','true');
      el('directChatVoice').setAttribute('aria-label','Завершить и отправить голосовое сообщение');el('directChatVoice').title='Завершить и отправить';
      setBusy('Идёт запись. Нажмите микрофон для отправки. Закрытие чата отменит запись.');
    }catch(error){stream?.getTracks().forEach(track=>track.stop());if(isCurrent(snapshot)){console.error('Voice recording error:',error);toast('Нет доступа к микрофону','err');}}
    finally{if(isCurrent(snapshot))state.recordingPending=false;}
  }

  function edit(messageId){
    const message=state.messages.find(item=>Number(item.id)===Number(messageId));
    if(!message?.can_edit||!message.body)return;
    state.editingId=Number(messageId);renderMessages({scroll:'keep'});
    el(`dm-edit-${state.editingId}`)?.focus({preventScroll:true});
  }

  function cancelEdit(){state.editingId=null;renderMessages({scroll:'keep'});}

  async function saveEdit(event,messageId){
    event.preventDefault();
    const form=event.target.closest('form'),button=form.querySelector('[type="submit"]');
    if(button.disabled)return;
    const body=form.querySelector('textarea').value.trim();
    if(!body||body.length>2000){toast('Введите сообщение от 1 до 2000 символов','err');return;}
    const snapshot=context();button.disabled=true;
    try{
      const{error}=await sb.rpc('edit_direct_message',{p_message_id:Number(messageId),p_body:body});
      if(error)throw error;
      if(!isCurrent(snapshot))return;
      state.editingId=null;
      await loadMessages();
    }catch(error){if(isCurrent(snapshot))toast('Не удалось изменить сообщение. Текст сохранён.','err');}
    finally{button.disabled=false;}
  }

  function close(){
    leaveView();state.forwardRatingId=null;FBZOverlay.close('directChatOv');
  }

  function resetSession(){close();state.drafts.clear();}

  el('directChatOv').addEventListener('fbz:overlay-close',()=>{leaveView();state.forwardRatingId=null;});
  el('directChatInput').addEventListener('input',resizeComposer);
  window.FBZMessages=Object.freeze({attach,cancelEdit,chooseFriend,close,composerKeydown,edit,loadOlder,openFriend,pickFriend,resetSession,saveEdit,send,showPicker,toggleVoice});
})();

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "messages.open-friend":(event,element,[id])=>FBZMessages.openFriend(id),
  "messages.find-friends":()=>{FBZMessages.close();return go('friends');},
  "messages.open-match":(event,element,[id])=>{FBZMessages.close();return go('md',{mid:id});},
  "messages.open-profile":(event,element,[id])=>{FBZMessages.close();return go('profile',{uid:id});},
  "messages.edit":(event,element,[id])=>FBZMessages.edit(id),
  "messages.save-edit":(event,element,[id])=>FBZMessages.saveEdit(event,id),
  "messages.cancel-edit":()=>FBZMessages.cancelEdit(),
  "messages.load-older":()=>FBZMessages.loadOlder(),
  "messages.choose-friend":(event,element,[userId])=>FBZMessages.chooseFriend(userId)
});
