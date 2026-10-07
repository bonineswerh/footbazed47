(function(root){
  'use strict';
  let version=0,busy=false;
  const el=id=>document.getElementById(id);
  function mount(){
    if(el('admin-view-experts'))return;
    document.querySelector('.admin-workspace').insertAdjacentHTML('beforeend',`<section class="admin-view" id="admin-view-experts" aria-labelledby="adminExpertsTitle"><header class="admin-section-head"><div><h2 id="adminExpertsTitle">Эксперты FOOTBAZED</h2><p>Авторы, которых вы приглашаете в экспертную ленту. Роль не зависит от числа оценок и не даёт административных прав.</p></div></header><section class="admin-panel"><form data-fbz-submit="admin-experts.assign"><label for="expertUsername">Никнейм пользователя</label><input class="input" id="expertUsername" required minlength="3" maxlength="30" autocomplete="off" placeholder="Без @"><button class="btn btn-l" type="submit">Назначить экспертом</button></form><p class="admin-provider-copy">Сначала договоритесь с автором. После назначения его публичные оценки попадут во вкладку «Эксперты». Закрытый профиль сохраняет свои ограничения видимости. Снять роль можно в списке ниже; оценки сохранятся.</p><div id="adminExpertList" aria-live="polite"></div></section></section>`);
  }
  async function load(username=null,enabled=null,button=null){
    if(!CU?.is_admin||CP!=='admin'||busy)return;
    const user=CU.id,route=routeVersion,token=++version;busy=true;
    const controls=[...el('admin-view-experts').querySelectorAll('button,input')];controls.forEach(c=>c.disabled=true);
    const current=()=>user===CU?.id&&route===routeVersion&&CP==='admin'&&token===version;
    el('adminExpertList').setAttribute('aria-busy','true');
    try{
      const data=await root.FBZAdmin.request('community_experts',{username,enabled});
      if(!current())return;
      el('adminExpertList').innerHTML=data.items?.length?data.items.map(u=>`<article class="admin-match-row"><div><strong>@${esc(u.username)}</strong><small>${esc(u.display_name||'')}${u.is_public?'':' · Закрытый профиль'}</small></div><button class="btn btn-g" type="button" ${FBZActions.attrs('admin-experts.remove',[u.username])}>Снять роль</button></article>`).join(''):'<div class="empty-state">Эксперты пока не назначены</div>';
      if(enabled===true){el('expertUsername').value='';toast('Эксперт назначен');}else if(enabled===false)toast('Роль эксперта снята');return true;
    }catch{if(current()){toast('Не удалось обновить экспертов. Проверьте никнейм и повторите.','err');if(enabled===null)el('adminExpertList').innerHTML='<button class="btn btn-g" type="button" data-fbz-click="admin-experts.retry">Обновить список экспертов</button>';}return false;}
    finally{if(token===version)busy=false;if(current()){controls.forEach(c=>{if(c.isConnected)c.disabled=false;});el('adminExpertList').setAttribute('aria-busy','false');}}
  }
  root.addEventListener('fbz:session-change',()=>{version++;busy=false;el('adminExpertList')?.replaceChildren();});
  root.FBZAdminExperts={mount,load};
  FBZActions.register({
    'admin-experts.retry':()=>load(),
    'admin-experts.assign':event=>{event.preventDefault();load(el('expertUsername').value.trim().replace(/^@/,''),true);},
    'admin-experts.remove':(event,button,[username])=>FBZConfirm.open({title:'Снять роль эксперта?',message:'Оценки сохранятся в общей ленте. Экспертная отметка будет убрана.',confirmText:'Снять роль',onConfirm:()=>load(username,false,button)})
  });
})(window);
