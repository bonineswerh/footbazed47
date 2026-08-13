(function(){
  'use strict';

  const state={
    conversationId:null,
    friend:null,
    messages:[],
    channel:null,
    uploading:false,
    recorder:null,
    recordingStream:null,
    recordingChunks:[],
    forwardRatingId:null,
    signedUrls:new Map()
  };

  const el=id=>document.getElementById(id);

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
    return image?`<img src="${image}" alt="">`:`<span>${esc(initials(user))}</span>`;
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
    return`<button class="dm-rating-card" type="button" onclick="FBZMessages.close();go('md',{mid:${Number(rating.match_id)||0}})">
      <strong class="dm-rating-score" data-tone="${presentation.tone}" aria-label="Оценка ${presentation.label}">${presentation.label}</strong>
      <small>Оценка матча · ${esc(supporterLabel(rating.supporter_side))}</small>
      <b>${esc(title)}</b><span>${esc(result)} · Открыть матч →</span>
    </button>`;
  }

  function mediaMarkup(message){
    const url=state.signedUrls.get(message.media_path)||'';
    if(!url)return message.media_kind&&message.media_kind!=='rating'?'<div class="dm-text">Медиа недоступно</div>':'';
    const safe=safeImageUrl(url);
    if(message.media_kind==='image')return`<img class="dm-media" src="${safe}" alt="Отправленное изображение" loading="lazy">`;
    if(message.media_kind==='video')return`<video class="dm-media" src="${safe}" controls preload="metadata"></video>`;
    if(message.media_kind==='audio')return`<audio class="dm-media" src="${safe}" controls preload="metadata"></audio>`;
    return'';
  }

  function messageMarkup(message){
    const own=message.sender_id===CU?.id;
    const sender=message.sender||{};
    const name=sender.display_name||sender.username||'Болельщик';
    return`<article class="dm-message${own?' own':''}" data-message-id="${Number(message.id)}">
      <div class="dm-message-avatar"><button type="button" onclick="FBZMessages.close();go('profile',{uid:${jsStr(message.sender_id)}})" aria-label="Профиль ${esc(name)}">${avatarMarkup(sender)}</button></div>
      <div class="dm-bubble">
        <div class="dm-author">
          <button type="button" onclick="FBZMessages.close();go('profile',{uid:${jsStr(message.sender_id)}})">@${esc(sender.username||'user')}</button>
          ${message.edited_at?'<small>ред.</small>':''}
          <time datetime="${esc(message.created_at)}">${esc(absoluteTime(message.created_at))}</time>
          ${message.can_edit&&message.body?`<button class="dm-edit" type="button" onclick="FBZMessages.edit(${Number(message.id)})">Изменить</button>`:''}
        </div>
        ${message.body?`<div class="dm-text">${esc(message.body)}</div>`:''}
        ${mediaMarkup(message)}${ratingCard(message)}
      </div>
    </article>`;
  }

  async function hydrateMedia(messages){
    const paths=[...new Set(messages.filter(message=>['image','video','audio'].includes(message.media_kind)&&message.media_path)
      .map(message=>message.media_path).filter(path=>!state.signedUrls.has(path)))];
    await Promise.all(paths.map(async path=>{
      const{data,error}=await sb.storage.from('chat-media').createSignedUrl(path,3600);
      if(!error&&data?.signedUrl)state.signedUrls.set(path,data.signedUrl);
    }));
  }

  function renderMessages(){
    const host=el('directChatBody');
    if(!state.messages.length){host.innerHTML='<div class="dm-empty">Здесь пока нет сообщений.<br>Начните разговор или отправьте оценку матча.</div>';return;}
    let currentDay='';
    host.innerHTML=state.messages.map(message=>{
      const label=dayLabel(message.created_at);
      const divider=label===currentDay?'':`<div class="dm-day"><span>${esc(label)}</span></div>`;
      currentDay=label;
      return divider+messageMarkup(message);
    }).join('');
    requestAnimationFrame(()=>{host.scrollTop=host.scrollHeight;});
  }

  async function loadMessages(){
    if(!state.conversationId)return;
    const{data,error}=await sb.rpc('get_direct_messages',{p_conversation_id:state.conversationId,p_limit:80,p_before_id:null});
    if(error)throw error;
    state.messages=Array.isArray(data?.items)?data.items:[];
    await hydrateMedia(state.messages);
    renderMessages();
  }

  function unsubscribe(){
    if(state.channel){sb.removeChannel(state.channel);state.channel=null;}
  }

  function subscribe(){
    unsubscribe();
    if(!state.conversationId||!sb.channel)return;
    state.channel=sb.channel(`direct-${state.conversationId}-${Date.now()}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'direct_messages',filter:`conversation_id=eq.${state.conversationId}`},()=>loadMessages().catch(()=>{}))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'direct_messages',filter:`conversation_id=eq.${state.conversationId}`},()=>loadMessages().catch(()=>{}))
      .subscribe();
  }

  async function openFriend(friendId){
    if(!CU){openAuth();return;}
    state.forwardRatingId=null;
    FBZOverlay.open('directChatOv','#directChatInput');
    setComposer(false);setBusy('');setPerson(null,'Загрузка');
    el('directChatBody').innerHTML='<div class="dm-loading"><span class="spin"></span>Открываем защищённый чат</div>';
    try{
      const[{data:conversation,error},user]=await Promise.all([
        sb.rpc('get_or_create_direct_conversation',{p_friend_id:friendId}),friendUser(friendId)
      ]);
      if(error)throw error;
      state.conversationId=Number(conversation.id);
      setPerson(user);setComposer(true);
      await loadMessages();subscribe();
    }catch(error){
      console.error('Direct chat error:',error);
      el('directChatBody').innerHTML='<div class="dm-empty">Не удалось открыть чат. Проверьте, что пользователь остаётся в списке друзей.</div>';
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
    unsubscribe();
    state.conversationId=null;state.friend=null;
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
      if(!friends.length){host.innerHTML='<div class="dm-empty">Чтобы начать личный чат, сначала добавьте пользователя в друзья.</div>';return;}
      host.innerHTML=`<h2 class="dm-picker-title">${state.forwardRatingId?'Отправить оценку':'Выберите чат'}</h2><div class="dm-picker-list">${friends.map(user=>`<button class="dm-picker-item" type="button" onclick="FBZMessages.chooseFriend('${user.id}')"><span class="dm-avatar">${avatarMarkup(user)}</span><span><b>${esc(user.display_name||user.username||'Болельщик')}</b><small>@${esc(user.username||'user')}</small></span><span>→</span></button>`).join('')}</div>`;
    }catch(error){
      console.error('Friend picker error:',error);host.innerHTML='<div class="dm-empty">Не удалось загрузить список друзей.</div>';
    }
  }

  function pickFriend(ratingId){
    if(!CU){openAuth();return;}
    state.forwardRatingId=Number(ratingId)||null;
    FBZOverlay.open('directChatOv');
    showPicker();
  }

  async function chooseFriend(friendId){
    const ratingId=state.forwardRatingId;
    if(!ratingId){await openFriend(friendId);return;}
    el('directChatBody').innerHTML='<div class="dm-loading"><span class="spin"></span>Отправляем оценку</div>';
    try{
      const{data:conversation,error}=await sb.rpc('get_or_create_direct_conversation',{p_friend_id:friendId});
      if(error)throw error;
      const{error:sendError}=await sb.rpc('send_direct_message',{p_conversation_id:Number(conversation.id),p_body:null,p_media_kind:'rating',p_media_path:null,p_rating_id:ratingId});
      if(sendError)throw sendError;
      toast('Оценка отправлена другу','ok');
      await openFriend(friendId);
    }catch(error){
      console.error('Forward rating error:',error);toast('Не удалось отправить оценку','err');await showPicker();
    }
  }

  async function send(event){
    event?.preventDefault();
    if(state.uploading||!state.conversationId)return;
    const input=el('directChatInput');
    const body=input.value.trim();
    if(!body)return;
    const button=el('directChatSend');button.disabled=true;
    try{
      const{error}=await sb.rpc('send_direct_message',{p_conversation_id:state.conversationId,p_body:body,p_media_kind:null,p_media_path:null,p_rating_id:null});
      if(error)throw error;
      input.value='';input.style.height='';await loadMessages();
    }catch(error){console.error('Send message error:',error);toast(error.message==='message_rate_limited'?'Слишком много сообщений. Подождите немного.':'Не удалось отправить сообщение','err');}
    finally{button.disabled=false;input.focus();}
  }

  function composerKeydown(event){
    const input=event.currentTarget;
    input.style.height='auto';input.style.height=`${Math.min(input.scrollHeight,116)}px`;
    if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send();}
  }

  function extensionFor(type,name=''){
    const known={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','audio/webm':'webm','audio/ogg':'ogg','audio/mpeg':'mp3','audio/mp4':'m4a'};
    return known[type]||String(name).split('.').pop()?.replace(/[^a-z0-9]/gi,'').slice(0,5).toLowerCase()||'bin';
  }

  async function upload(file,kind,fileName=''){
    if(state.uploading||!state.conversationId||!file)return;
    const max=kind==='video'?30*1024*1024:kind==='audio'?12*1024*1024:8*1024*1024;
    if(file.size>max){toast(`Файл больше ${Math.round(max/1024/1024)} МБ`,'err');return;}
    state.uploading=true;setBusy(kind==='audio'?'Отправляем голосовое сообщение…':'Загружаем медиа…');
    const path=`${state.conversationId}/${CU.id}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(file.type,fileName||file.name)}`;
    try{
      const contentType=String(file.type||'application/octet-stream').split(';')[0];
      const{error:uploadError}=await sb.storage.from('chat-media').upload(path,file,{contentType,upsert:false,cacheControl:'3600'});
      if(uploadError)throw uploadError;
      const{error:sendError}=await sb.rpc('send_direct_message',{p_conversation_id:state.conversationId,p_body:null,p_media_kind:kind,p_media_path:path,p_rating_id:null});
      if(sendError){await sb.storage.from('chat-media').remove([path]);throw sendError;}
      await loadMessages();setBusy('');
    }catch(error){console.error('Media upload error:',error);setBusy('Не удалось отправить файл',true);toast('Не удалось отправить файл','err');}
    finally{state.uploading=false;el('directChatMedia').value='';}
  }

  function attach(file){
    if(!file)return;
    const kind=file.type.startsWith('image/')?'image':file.type.startsWith('video/')?'video':'';
    if(!kind){toast('Поддерживаются изображения и видео','err');return;}
    upload(file,kind);
  }

  async function toggleVoice(){
    if(state.recorder&&state.recorder.state==='recording'){state.recorder.stop();return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('Запись голоса не поддерживается этим браузером','err');return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mime=['audio/webm;codecs=opus','audio/webm','audio/ogg'].find(type=>MediaRecorder.isTypeSupported(type))||'';
      const recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
      state.recordingStream=stream;state.recorder=recorder;state.recordingChunks=[];
      recorder.ondataavailable=event=>{if(event.data.size)state.recordingChunks.push(event.data);};
      recorder.onstop=async()=>{
        const blob=new Blob(state.recordingChunks,{type:recorder.mimeType||'audio/webm'});
        stream.getTracks().forEach(track=>track.stop());state.recordingStream=null;state.recorder=null;
        el('directChatVoice').classList.remove('recording');el('directChatVoice').setAttribute('aria-pressed','false');
        if(blob.size>1000)await upload(blob,'audio','voice.webm');
      };
      recorder.start(500);el('directChatVoice').classList.add('recording');el('directChatVoice').setAttribute('aria-pressed','true');
      setBusy('Идёт запись. Нажмите красную кнопку ещё раз, чтобы отправить.');
    }catch(error){console.error('Voice recording error:',error);toast('Нет доступа к микрофону','err');}
  }

  async function edit(messageId){
    const message=state.messages.find(item=>Number(item.id)===Number(messageId));
    if(!message?.can_edit||!message.body)return;
    const next=prompt('Изменить сообщение',message.body);
    if(next===null||next.trim()===message.body)return;
    const{error}=await sb.rpc('edit_direct_message',{p_message_id:Number(messageId),p_body:next.trim()});
    if(error){toast('Не удалось изменить сообщение','err');return;}
    await loadMessages();
  }

  function close(){
    if(state.recorder?.state==='recording')state.recorder.stop();
    state.recordingStream?.getTracks().forEach(track=>track.stop());
    unsubscribe();setBusy('');FBZOverlay.close('directChatOv');
  }

  window.FBZMessages=Object.freeze({attach,chooseFriend,close,composerKeydown,edit,openFriend,pickFriend,send,showPicker,toggleVoice});
})();
