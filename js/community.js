(function(){
  'use strict';

  const PAGE_SIZE=24;
  const tabs=['list','incoming','outgoing','suggest'];
  let version=0,searchVersion=0,session=0,timer=null,offset=0,hasMore=false;
  let relationships=[];
  const pending=new Set();
  const el=id=>document.getElementById(id);
  const active=(token,user)=>token===version&&CU?.id===user&&CP==='friends';

  function state(title,description,action=''){
    return `<div class="community-state"><span class="community-state-icon">${ico('users',24)}</span><strong>${esc(title)}</strong><p>${esc(description)}</p>${action}</div>`;
  }
  async function rows(query){const result=await query;if(result.error)throw result.error;return result.data||[];}
  function relation(id){
    const found=relationships.filter(item=>item.user_id===id||item.friend_id===id);
    return found.find(item=>item.status==='accepted')||found[0];
  }
  function avatar(user){
    const src=safeImageUrl(user.avatar_url);
    return src?`<img class="fcard-av" src="${src}" alt="" loading="lazy" decoding="async">`:`<span class="fcard-av ${avColor(user.username)}">${esc((user.username||'U')[0].toUpperCase())}</span>`;
  }
  function card(user){
    const name=user.username||'Пользователь';
    const id=user.id;
    const rel=relation(user.id);
    const action=(kind,label,icon='',extra='')=>`<button class="fbtn ${kind}" type="button" data-person="${esc(user.id)}" ${FBZActions.attrs("community.act",[kind,id])} ${extra}>${icon?ico(icon,16):''}${esc(label)}</button>`;
    let actions='';
    if(user.id===CU?.id)actions='<span class="community-self">Это вы</span>';
    else if(rel?.status==='accepted')actions=`${action('remove','','close','aria-label="Удалить из друзей" title="Удалить из друзей"')}`;
    else if(rel?.status==='pending'&&rel.friend_id===CU?.id)actions=action('accept','Принять','check')+action('reject','','close','aria-label="Отклонить заявку" title="Отклонить заявку"');
    else if(rel?.status==='pending')actions=action('cancel','Отменить');
    else actions=action('add','Добавить','plus');
    const sub=rel?.status==='pending'?(rel.friend_id===CU?.id?'Хочет добавить вас в друзья':'Заявка отправлена'):`${Number(user.ratings_count)||0} оценок`;
    return `<article class="friend-card"><a class="friend-profile" href="/profile/${encodeURIComponent(user.id)}" ${FBZActions.attrs("community.open-profile",[id])}>${avatar(user)}<span class="fcard-info"><span class="fcard-name">${esc(name)}</span><span class="fcard-sub">@${esc(name)} · ${esc(sub)}</span></span></a><div class="fcard-action">${actions}</div></article>`;
  }
  async function loadRelations(user){
    const [sent,received]=await Promise.all([
      rows(sb.from('friendships').select('id,user_id,friend_id,status').eq('user_id',user).limit(1000)),
      rows(sb.from('friendships').select('id,user_id,friend_id,status').eq('friend_id',user).eq('status','pending').limit(1000))
    ]);
    return [...sent,...received];
  }
  function syncTabs(){
    document.querySelectorAll('.ftab2').forEach(button=>{
      const selected=button.dataset.tab===FT;
      button.classList.toggle('on',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  async function load(tab=FT,append=false){
    FT=tabs.includes(tab)?tab:'list';syncTabs();
    const token=++version,user=CU?.id,target=el('friendsContent');
    if(!append){offset=0;target.innerHTML='<div class="loading" role="status"><div class="spin"></div><span class="sr-only">Загрузка сообщества</span></div>';}
    el('friendsMore').innerHTML='';
    target.setAttribute('aria-busy','true');
    if(!user){target.innerHTML=state('Футбол интереснее вместе','Войдите, чтобы находить друзей, сравнивать оценки и обсуждать матчи.', '<button class="btn btn-l" type="button" data-fbz-click="shell.open-auth">Войти</button>');target.setAttribute('aria-busy','false');return;}
    try{
      const relations=await loadRelations(user);
      if(!active(token,user))return;
      relationships=relations;
      let users=[],nextOffset=offset,nextHasMore=false;
      if(FT==='suggest'){
        const top=await rows(sb.from('users').select(PUBLIC_USER_FIELDS).neq('id',user).order('ratings_count',{ascending:false}).limit(48));
        users=top.filter(item=>!relation(item.id)).slice(0,PAGE_SIZE);
      }else{
        const incoming=FT==='incoming';
        const matches=relations.filter(item=>incoming?item.friend_id===user&&item.status==='pending':item.user_id===user&&item.status===(FT==='list'?'accepted':'pending'));
        const ids=[...new Set(matches.map(item=>incoming?item.user_id:item.friend_id))];
        const pageIds=ids.slice(offset,offset+PAGE_SIZE);
        users=pageIds.length?await rows(sb.from('users').select(PUBLIC_USER_FIELDS).in('id',pageIds).order('username')):[];
        nextOffset+=pageIds.length;nextHasMore=nextOffset<ids.length;
      }
      if(!active(token,user))return;
      offset=nextOffset;hasMore=nextHasMore;
      if(users.length){if(append)target.insertAdjacentHTML('beforeend',users.map(card).join(''));else target.innerHTML=users.map(card).join('');}
      else if(!append){
        const messages={list:['Ваша футбольная компания','Найдите друзей по никнейму или пригласите их по ссылке.'],incoming:['Все заявки разобраны','Новые приглашения появятся здесь.'],outgoing:['Нет отправленных заявок','Найдите знакомых через поиск и добавьте их в друзья.'],suggest:['Вы уже знакомы','Новые болельщики появятся здесь. Попробуйте поиск по никнейму.']};
        target.innerHTML=state(...messages[FT],FT==='list'?'<button class="btn btn-g" type="button" data-fbz-click="community.focus-friend-search">Найти друзей</button>':'');
      }
      el('friendsMore').innerHTML=hasMore?'<button class="btn btn-g" type="button" data-fbz-click="community.load-more">Показать ещё</button>':'';
      const count=relations.filter(item=>item.friend_id===user&&item.status==='pending').length;
      el('inBadge').textContent=String(count);el('inBadge').hidden=!count;
    }catch(error){
      if(!active(token,user))return;
      const retry='<button class="btn btn-g" type="button" data-fbz-click="community.load">Повторить</button>';
      if(append)el('friendsMore').innerHTML=retry;else target.innerHTML=state('Не удалось загрузить сообщество','Проверьте соединение и попробуйте ещё раз.',retry);
    }finally{if(active(token,user))target.setAttribute('aria-busy','false');}
  }
  async function loadMore(button){if(button.disabled)return;button.disabled=true;await load(FT,true);}
  function changeTab(tab){
    el('friendSearch').value='';search();load(tab);
  }
  function search(){
    clearTimeout(timer);
    const token=++searchVersion,query=el('friendSearch').value.trim().slice(0,80),user=CU?.id;
    const target=el('friendSearchRes');
    el('friendsBrowse').hidden=query.length>=2;
    target.hidden=query.length<2;
    if(query.length<2){target.innerHTML='';return;}
    target.innerHTML='<div class="loading" role="status"><div class="spin"></div><span class="sr-only">Поиск пользователей</span></div>';
    timer=setTimeout(async()=>{
      try{
        const normalized=query.replace(/[\\%_]/gu,'\\$&');
        const [users,relations]=await Promise.all([
          normalized?rows(sb.from('users').select(PUBLIC_USER_FIELDS).ilike('username',`%${normalized}%`).limit(12)):Promise.resolve([]),
          user?loadRelations(user):Promise.resolve([])
        ]);
        if(token!==searchVersion||CU?.id!==user||CP!=='friends')return;
        relationships=relations;
        target.innerHTML=`<div class="community-result-label" role="status">${users.length?'Результаты поиска':'Ничего не найдено'}</div>`+(users.length?users.map(card).join(''):state('Попробуйте другой никнейм','Проверьте написание или введите первые несколько букв.'));
      }catch(error){
        if(token!==searchVersion||CU?.id!==user||CP!=='friends')return;
        target.innerHTML=state('Поиск временно недоступен','Ваш запрос сохранён. Попробуйте ещё раз.','<button class="btn btn-g" type="button" data-fbz-click="community.search">Повторить поиск</button>');
      }
    },250);
  }
  async function act(kind,id,button){
    if(!['add','accept','reject','cancel','remove'].includes(kind))return;
    if(!CU){openAuth();return;}
    if(pending.has(id))return;
    if(kind==='remove'){
      FBZConfirm.open({title:'Удалить из друзей?',message:'Оценки этого пользователя больше не будут входить в ленту друзей. Вы сможете отправить новую заявку позже.',confirmText:'Удалить',onConfirm:()=>mutate(kind,id,button)});
      return;
    }
    await mutate(kind,id,button);
  }
  async function mutate(kind,id,button){
    if(pending.has(id))return false;
    const user=CU?.id,epoch=session;if(!user)return false;
    pending.add(id);
    const buttons=[...document.querySelectorAll('.fbtn[data-person]')].filter(item=>item.dataset.person===id);
    buttons.forEach(item=>item.disabled=true);
    try{
      const result=kind==='add'?await sb.rpc('request_friendship',{p_friend_id:id}):['accept','reject'].includes(kind)?await sb.rpc('respond_friendship',{p_requester_id:id,p_action:kind}):await sb.rpc('remove_friendship',{p_other_id:id});
      if(result.error)throw result.error;
      if(CU?.id!==user||epoch!==session)return true;
      window.FBZData?.invalidate('profile:');
      toast(kind==='accept'||result.data?.status==='accepted'?'Теперь вы друзья':kind==='add'?'Заявка отправлена':kind==='remove'?'Пользователь удалён из друзей':'Заявка отменена');
      loadNotifications();
      if(CP==='friends'){
        if(el('friendSearch').value.trim().length>=2)search();
        else await load();
      }
      return true;
    }catch(error){if(CU?.id===user&&epoch===session)toast('Не удалось выполнить действие. Попробуйте ещё раз.','err');return false;}
    finally{if(epoch===session)pending.delete(id);buttons.forEach(item=>{if(item.isConnected)item.disabled=false;});}
  }
  function invite(){
    if(!CU){openAuth();return;}
    if(CU.invite_code)copyText(`${location.origin}/?invite=${encodeURIComponent(CU.invite_code)}`,'Ссылка-приглашение скопирована');
    else goOwnProfile();
  }
  function resetSession(){version++;searchVersion++;session++;clearTimeout(timer);relationships=[];pending.clear();el('friendsContent').innerHTML='';el('friendSearchRes').innerHTML='';el('friendSearch').value='';el('friendsBrowse').hidden=false;el('friendSearchRes').hidden=true;}
  window.FBZCommunity={load,loadMore,changeTab,search,act,invite,resetSession};
})();

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "community.act":(event,element,[kind,userId])=>FBZCommunity.act(kind,userId,element),
  "community.open-profile":(event,element,[id])=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();return go('profile',{uid:id});},
  "community.focus-friend-search":()=>document.getElementById('friendSearch').focus(),
  "community.load-more":(event,element)=>FBZCommunity.loadMore(element),
  "community.load":()=>FBZCommunity.load(),
  "community.search":()=>FBZCommunity.search()
});
