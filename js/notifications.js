(function(){
  'use strict';
  let version=0,session=0,opened=false,items=[],writing=false,totalUnread=0;
  const pending=new Set();
  const el=id=>document.getElementById(id);
  function render(){
    const unread=totalUnread;
    el('notifList').setAttribute('aria-busy','false');
    const badge=el('notifBadge');
    if(badge){badge.textContent=String(unread);badge.classList.toggle('on',unread>0);}
    el('notifBtn')?.setAttribute('aria-label',unread?`Уведомления: ${unread} непрочитанных`:'Уведомления');
    el('notifMarkAll').disabled=writing||!unread;
    el('notifList').innerHTML=items.length?items.map(item=>`<button type="button" class="notif-item${item.read?'':' unread'}" data-notification="${Number(item.id)}" ${FBZActions.attrs("notifications.open-item",[Number(item.id)])}><span class="notif-ico">${ico({friend_request:'users',like:'heart',comment:'chat'}[item.type]||'bell',18)}</span><span class="notif-content"><span class="notif-text">${esc(item.message||'Уведомление')}</span><time class="notif-time" datetime="${esc(item.created_at)}">${new Date(item.created_at).toLocaleDateString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></span>${item.read?'':'<span class="notif-unread" aria-label="Непрочитанное"></span>'}</button>`).join(''):'<div class="notif-empty">'+ico('bell',26)+'<strong>Пока тихо</strong><p>Заявки в друзья и отклики на ваши оценки появятся здесь.</p></div>';
  }
  async function load(){
    const user=CU?.id,token=++version;
    if(!user){resetSession();return;}
    el('notifList').setAttribute('aria-busy','true');
    try{
      const [result,count]=await Promise.all([
        sb.from('notifications').select('id,type,message,read,created_at,rating_id').eq('user_id',user).order('created_at',{ascending:false}).limit(20),
        sb.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user).eq('read',false)
      ]);
      if(result.error||count.error)throw result.error||count.error;
      if(token!==version||CU?.id!==user)return;
      items=result.data||[];totalUnread=Number(count.count)||0;render();
    }catch(error){
      if(token!==version||CU?.id!==user)return;
      el('notifList').innerHTML='<div class="notif-empty"><strong>Не удалось загрузить уведомления</strong><p>Попробуйте ещё раз.</p><button class="btn btn-g btn-sm" data-fbz-click="notifications.load-notifications">Повторить</button></div>';
    }finally{if(token===version)el('notifList').setAttribute('aria-busy','false');}
  }
  function toggle(){
    if(opened){close(true);return;}
    if(!CU)return;
    window.FBZAccount?.close();opened=true;
    const panel=el('notifPanel');panel.style.display='flex';panel.classList.add('on');panel.setAttribute('aria-hidden','false');
    el('notifBtn')?.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>{if(opened)(panel.querySelector('button:not([disabled])')||panel).focus();});
    load();
  }
  function close(returnFocus=false){
    opened=false;const panel=el('notifPanel');
    panel.style.display='none';panel.classList.remove('on');panel.setAttribute('aria-hidden','true');
    el('notifBtn')?.setAttribute('aria-expanded','false');
    if(returnFocus)el('notifBtn')?.focus();
  }
  async function openItem(id,button){
    const item=items.find(row=>Number(row.id)===id),user=CU?.id,epoch=session;
    if(!item||!user||pending.has(id))return;
    pending.add(id);if(button)button.disabled=true;
    try{
      if(!item.read){
        const result=await sb.from('notifications').update({read:true}).eq('id',id).eq('user_id',user);
        if(result.error)throw result.error;
      }
      if(CU?.id!==user||epoch!==session)return;
      version++;if(!item.read)totalUnread=Math.max(0,totalUnread-1);
      items=items.map(row=>Number(row.id)===id?{...row,read:true}:row);render();close(true);
      if(item.type==='friend_request'){FT='incoming';go('friends');}
      else if(['like','comment'].includes(item.type)&&item.rating_id)go('feed',{ratingId:item.rating_id});
    }catch(error){if(CU?.id===user&&epoch===session)toast('Не удалось отметить уведомление. Попробуйте ещё раз.','err');}
    finally{if(epoch===session)pending.delete(id);if(button?.isConnected)button.disabled=false;}
  }
  async function markAll(){
    if(writing||!CU||!totalUnread)return;
    const user=CU.id,epoch=session;writing=true;el('notifMarkAll').disabled=true;
    try{
      const result=await sb.from('notifications').update({read:true}).eq('user_id',user);
      if(result.error)throw result.error;
      if(CU?.id!==user||epoch!==session)return;
      version++;totalUnread=0;items=items.map(item=>({...item,read:true}));render();
      toast('Все уведомления прочитаны');
    }catch(error){if(CU?.id===user&&epoch===session)toast('Не удалось отметить уведомления. Попробуйте ещё раз.','err');}
    finally{if(epoch===session){writing=false;if(CU?.id===user)el('notifMarkAll').disabled=!totalUnread;}}
  }
  function resetSession(){version++;session++;items=[];totalUnread=0;pending.clear();writing=false;close();render();}
  document.addEventListener('keydown',event=>{if(opened&&event.key==='Escape'){event.preventDefault();close(true);}});
  document.addEventListener('click',event=>{if(opened&&!event.target.closest('#notifPanel')&&!event.target.closest('#notifBtn'))close();});
  document.addEventListener('focusin',event=>{if(opened&&!event.target.closest('#notifPanel')&&!event.target.closest('#notifBtn'))close();});
  window.FBZNotifications={load,toggle,close,openItem,markAll,resetSession};
})();

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "notifications.open-item":(event,element,[id])=>FBZNotifications.openItem(id,element),
  "notifications.load-notifications":()=>loadNotifications()
});
