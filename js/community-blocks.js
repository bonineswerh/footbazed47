(function(root){
  'use strict';
  const overlayId='blockOverlay';let state=null;const mutations=new Set();
  const current=s=>state===s&&CU?.id===s.user&&routeVersion===s.route;
  function close(restore=true){root.FBZOverlay.close(overlayId,restore);state=null;}
  function mount(){
    if(document.getElementById(overlayId))return;
    const overlay=document.createElement('div');overlay.id=overlayId;overlay.className='overlay block-overlay';overlay.tabIndex=-1;
    overlay.setAttribute('aria-hidden','true');overlay.dataset.closeBackdrop='true';
    overlay.innerHTML='<section class="block-panel" role="dialog" aria-modal="true" aria-labelledby="blockTitle" aria-describedby="blockHelp"><header><div><span class="section-kicker">Ваше сообщество</span><h2 id="blockTitle">Заблокированные</h2></div><button class="btn btn-g block-close" type="button" aria-label="Закрыть блокировки" data-fbz-click="block.close">'+ico('close',20)+'</button></header><p id="blockHelp">В этом аккаунте вы не видите записи друг друга и не получаете новые отклики или заявки. Старые оценки и общие футбольные показатели сохраняются. Общедоступные записи по-прежнему доступны гостям.</p><div id="blockList" aria-live="polite"></div><p id="blockStatus" role="status"></p></section>';
    overlay.addEventListener('fbz:overlay-close',()=>{state=null;document.getElementById('blockList').replaceChildren();document.getElementById('blockStatus').textContent='';});document.body.append(overlay);
  }
  function open(){
    if(!CU)return openAuth();mount();close(false);state={user:CU.id,route:routeVersion,offset:0,version:0,busy:false,hasMore:false};root.FBZOverlay.open(overlayId,'.block-close');return load();
  }
  async function load(){
    const s=state;if(!s||!current(s))return;const version=++s.version,host=document.getElementById('blockList');s.busy=true;host.setAttribute('aria-busy','true');
    host.innerHTML='<div class="loading" role="status"><div class="spin"></div><span class="sr-only">Загрузка блокировок</span></div>';
    try{
      const {data,error}=await sb.rpc('get_my_user_blocks',{p_offset:s.offset,p_limit:10});if(error)throw error;
      if(!current(s)||version!==s.version)return;
      const items=Array.isArray(data?.items)?data.items:[],total=Number(data?.total)||0;s.hasMore=Boolean(data?.has_more);
      host.innerHTML=items.length?'<ol class="block-list">'+items.map(item=>'<li><div><strong>'+esc(item.display_name||item.username||'Пользователь')+'</strong><span>@'+esc(item.username||'user')+'</span></div><button class="btn btn-g btn-sm" type="button" '+FBZActions.attrs('block.unblock',[item.user_id])+' aria-label="Снять блокировку с '+esc(item.display_name||item.username||'пользователя')+'">Снять</button></li>').join('')+'</ol>':'<div class="empty-state"><strong>Блокировок нет</strong><p>Управляйте контактами через кнопку в профиле пользователя.</p></div>';
      host.insertAdjacentHTML('beforeend','<footer class="block-pagination"><span role="status">'+(items.length?(s.offset+1)+'–'+(s.offset+items.length)+' из '+total:'Нет блокировок')+'</span><button class="btn btn-g btn-sm" type="button" data-fbz-click="block.previous" '+(s.offset===0?'disabled':'')+'>Назад</button><button class="btn btn-g btn-sm" type="button" data-fbz-click="block.next" '+(!s.hasMore?'disabled':'')+'>Далее →</button></footer>');
    }catch(error){if(current(s)&&version===s.version)host.innerHTML='<div class="collection-error" role="status"><span>Не удалось загрузить блокировки</span><button class="btn btn-g" type="button" data-fbz-click="block.retry">Повторить</button></div>';}
    finally{if(current(s)&&version===s.version){s.busy=false;host.setAttribute('aria-busy','false');}}
  }
  function page(direction){const s=state;if(!s||s.busy)return;if(direction>0&&s.hasMore)s.offset+=10;else if(direction<0&&s.offset>0)s.offset=Math.max(0,s.offset-10);else return;load();document.querySelector('.block-panel')?.scrollTo({top:0,behavior:'instant'});}
  function confirm(uid,name){
    if(!CU||!uid||uid===CU.id)return;
    const user=CU.id,route=routeVersion;
    root.FBZConfirm.open({title:'Заблокировать '+String(name||'пользователя')+'?',message:'В этом аккаунте вы перестанете видеть записи друг друга и получать новые отклики или заявки. Общедоступные записи останутся доступны гостям. История оценок сохраняется. Блокировку можно снять в своём профиле.',confirmText:'Заблокировать',onConfirm:()=>mutate(uid,true,user,route)});
  }
  async function mutate(uid,blocked,user=CU?.id,route=routeVersion){
    if(!user||CU?.id!==user||route!==routeVersion)return;
    const key=user+':'+uid;if(mutations.has(key))return false;mutations.add(key);
    try{
      const {data,error}=await sb.rpc('set_user_block',{p_user_id:uid,p_blocked:blocked});if(error)throw error;
      if(CU?.id!==user)return;
      if(data?.user_id!==uid||data?.blocked!==blocked)throw new Error('invalid_block_response');
      // Even a route change during the mutation must invalidate the old visibility cache.
      root.dispatchEvent(new CustomEvent('fbz:community-visibility-change'));
      toast(blocked?'Пользователь заблокирован.':'Блокировка снята.','ok');
    }catch(error){
      if(CU?.id===user&&route===routeVersion){toast(error.message==='user_unavailable'?'Этот профиль больше недоступен.':'Не удалось изменить блокировку. Попробуйте ещё раз.','err');return false;}
    }finally{mutations.delete(key);}
  }
  async function unblock(uid,button){
    const s=state;if(!s||!current(s)||s.busy)return;s.busy=true;button.disabled=true;
    try{await mutate(uid,false,s.user,s.route);}finally{if(current(s)){s.busy=false;button.disabled=false;}}
  }
  root.FBZCommunityBlocks=Object.freeze({open,confirm,close});
  root.FBZActions.register({'block.close':()=>close(),'block.retry':()=>load(),'block.previous':()=>page(-1),'block.next':()=>page(1),'block.unblock':(event,button,[uid])=>unblock(uid,button)});
  root.addEventListener('fbz:session-change',()=>close(false));
})(window);
