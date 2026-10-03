(function(){
  'use strict';
  const el=id=>document.getElementById(id),pending=new Set();
  let session=0,view=0,request=0,opened=false,items=[],cursor=null,hasMore=false,throughId=null,unreadOnly=false,busy=false,writing=false,totalUnread=0;
  function controls(){
    el('notifSummary').textContent=totalUnread?`Непрочитанных: ${totalUnread}`:'Всё прочитано';
    el('notifAll').setAttribute('aria-pressed',String(!unreadOnly));el('notifUnread').setAttribute('aria-pressed',String(unreadOnly));
    for(const id of ['notifAll','notifUnread','notifRefresh'])el(id).disabled=writing||pending.size>0;
    el('notifMore').hidden=!hasMore;el('notifMore').disabled=busy||writing||pending.size>0;
    el('notifMarkAll').disabled=!throughId||!totalUnread||busy||writing||pending.size>0;
    el('notifList').setAttribute('aria-busy',String(busy));
  }
  function render(){
    let day='';
    el('notifList').innerHTML=items.length?items.map(item=>{
      const date=new Date(item.created_at),label=date.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
      const group=day!==label?`<h3 class="notif-day">${esc(label)}</h3>`:'';day=label;
      const actor=item.actor?.display_name||item.actor?.username||'Болельщик';
      const title={friend_request:item.friend_status==='pending'?'Заявка в друзья':item.friend_status==='accepted'?'Вы теперь друзья':'Заявка закрыта',friend_accepted:'Заявка в друзья принята',like:'Понравилась ваша оценка',comment:'Комментарий к вашей оценке',system:'Сообщение FOOTBAZED'}[item.type]||'Уведомление';
      const context=item.match?`${FBZDomain.matchTeamName(item.match,'home')} — ${FBZDomain.matchTeamName(item.match,'away')}`:item.type==='system'?item.message:actor;
      return`${group}<div class="notif-item${item.read?'':' unread'}" data-notification-id="${Number(item.id)}"><button class="notif-open" type="button" aria-label="${esc(`${title}. ${item.match?actor+'. ':''}${context||''}`)}" ${FBZActions.attrs('notifications.open-item',[Number(item.id)])} ${pending.has(item.id)?'disabled':''}><span class="notif-ico">${ico({friend_request:'users',friend_accepted:'users',like:'heart',comment:'chat'}[item.type]||'bell',18)}</span><span class="notif-content"><strong class="notif-text">${esc(title)}</strong>${item.match?`<span class="notif-actor">${esc(actor)}</span>`:''}<span class="notif-context">${esc(context||'')}</span><time class="notif-time" datetime="${esc(item.created_at)}">${date.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}${item.target_available===false?' · Запись недоступна':''}</time></span></button><button class="notif-read" type="button" ${FBZActions.attrs('notifications.read',[Number(item.id),!item.read])} aria-label="${item.read?'Отметить непрочитанным':'Отметить прочитанным'}" title="${item.read?'Отметить непрочитанным':'Отметить прочитанным'}" ${pending.has(item.id)||writing?'disabled':''}><span class="notif-dot"></span></button></div>`;
    }).join(''):`<div class="notif-empty">${ico('bell',26)}<strong>${unreadOnly?(totalUnread?'Есть новые уведомления':'Всё прочитано'):'Пока тихо'}</strong><p>${unreadOnly?'Новые отклики появятся здесь.':'Заявки в друзья и отклики на ваши оценки появятся здесь.'}</p>${unreadOnly&&totalUnread?'<button class="btn btn-g" type="button" data-fbz-click="notifications.refresh">Показать новые</button>':''}</div>`;
    controls();
  }
  async function load(append=false){
    if(!opened||!CU||writing||pending.size||(append&&busy))return;
    const user=CU.id,token=++request,epoch=session;
    if(!append){view++;items=[];cursor=null;hasMore=false;throughId=null;el('notifUpdate').hidden=true;el('notifList').innerHTML='<div class="notif-empty"><span class="spin"></span>Загружаем уведомления</div>';}
    busy=true;controls();el('notifStatus').textContent='';
    try{
      const result=await sb.rpc('get_notifications_page',{p_unread_only:unreadOnly,p_cursor_created_at:append?cursor?.created_at:null,p_cursor_id:append?cursor?.id:null,p_limit:20});
      if(result.error)throw result.error;
      if(token!==request||epoch!==session||CU?.id!==user||!opened)return;
      const data=result.data||{},seen=new Set(items.map(item=>item.id));
      items.push(...(data.items||[]).filter(item=>!seen.has(item.id)));
      cursor=data.next_cursor;hasMore=Boolean(data.has_more&&cursor);
      if(!append)throughId=data.through_id;
      totalUnread=Number(data.unread_count)||0;window.FBZNotificationCounter.set(totalUnread);
      render();if(!append)el('notifList').scrollTop=0;
      el('notifStatus').textContent=hasMore?`Показано: ${items.length}`:items.length?'Вся история':'';
    }catch{
      if(token!==request||epoch!==session||CU?.id!==user||!opened)return;
      el('notifStatus').textContent='Не удалось загрузить уведомления. Повторите попытку.';
      if(!append)el('notifList').innerHTML='<div class="notif-empty"><strong>Не удалось загрузить уведомления</strong><p>Попробуйте ещё раз.</p><button class="btn btn-g" type="button" data-fbz-click="notifications.refresh">Повторить</button></div>';
    }finally{if(token===request){busy=false;controls();}}
  }
  function toggle(){
    if(opened){close(true);return;}if(!CU)return;
    window.FBZAccount?.close();opened=true;window.FBZOverlay.open('notifPanel');el('notifBtn')?.setAttribute('aria-expanded','true');injectIcons();load();
  }
  function close(returnFocus=false){window.FBZOverlay.close('notifPanel',returnFocus);}
  el('notifPanel').addEventListener('fbz:overlay-close',()=>{opened=false;view++;request++;busy=false;el('notifBtn')?.setAttribute('aria-expanded','false');});
  async function read(id,value){
    const result=await sb.rpc('set_notification_read',{p_notification_id:id,p_read:value});
    if(result.error)throw result.error;return result.data;
  }
  async function update(id,value,navigate=false){
    const item=items.find(row=>row.id===id),user=CU?.id,epoch=session,intent=view;
    if(!item||!user||pending.size||writing||busy)return;
    pending.add(id);render();
    try{
      if(item.read!==value){const result=await read(id,value);if(epoch!==session||CU?.id!==user)return;totalUnread=Number(result.unread_count)||0;window.FBZNotificationCounter.set(totalUnread);item.read=value;}
      if(epoch!==session||CU?.id!==user||intent!==view||!opened)return;
      if(navigate){
        if(item.target_available===false){toast('Запись больше недоступна','err');return;}
        close(true);
        if(item.type==='friend_request'||item.type==='friend_accepted'){FT=item.friend_status==='pending'?'incoming':'list';go('friends');}
        else if(item.rating_id)go('feed',{ratingId:item.rating_id,commentId:item.comment_id});
      }else if(unreadOnly&&value)items=items.filter(row=>row.id!==id);
    }catch{if(epoch===session&&CU?.id===user&&opened)toast('Не удалось отметить уведомление. Попробуйте ещё раз.','err');}
    finally{if(epoch===session){pending.delete(id);if(opened){if(intent!==view)load();else{render();if(!navigate)el('notifUnread').focus({preventScroll:true});}}}}
  }
  async function markAll(){
    if(!opened||!CU||!throughId||writing||busy||pending.size||!totalUnread)return;
    const user=CU.id,epoch=session,intent=view,boundary=throughId;writing=true;render();
    try{
      const result=await sb.rpc('set_notification_read',{p_through_id:boundary,p_read:true});if(result.error)throw result.error;
      if(epoch!==session||CU?.id!==user)return;
      totalUnread=Number(result.data?.unread_count)||0;window.FBZNotificationCounter.set(totalUnread);
      if(intent!==view||!opened)return;
      items=items.map(item=>item.id<=boundary?{...item,read:true}:item);if(unreadOnly){items=items.filter(item=>!item.read);cursor=null;hasMore=false;}
      el('notifUpdate').hidden=!totalUnread;toast('Уведомления до открытия списка прочитаны');
    }catch{if(epoch===session&&CU?.id===user&&opened)toast('Не удалось отметить уведомления. Попробуйте ещё раз.','err');}
    finally{if(epoch===session){writing=false;if(opened){if(intent!==view)load();else render();}}}
  }
  function filter(value){if(writing||pending.size)return;unreadOnly=Boolean(value);load();}
  function resetSession(){session++;request++;view++;items=[];cursor=null;hasMore=false;throughId=null;unreadOnly=false;totalUnread=0;pending.clear();writing=false;busy=false;close();render();}
  document.addEventListener('fbz:notification-count',event=>{if(opened&&!busy&&!writing&&!pending.size&&event.detail.count!==totalUnread)el('notifUpdate').hidden=false;});
  window.FBZNotifications={load,toggle,close,markAll,resetSession,isOpen:()=>opened};
  FBZActions.register({
    'notifications.open-item':(event,element,[id])=>update(id,true,true),
    'notifications.read':(event,element,[id,value])=>update(id,value),
    'notifications.refresh':()=>load(),
    'notifications.filter':(event,element,[value])=>filter(value),
    'notifications.more':()=>load(true)
  });
})();
