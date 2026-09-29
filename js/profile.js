(function(root){
  'use strict';
  const profileFriendActions=new Set();
  let diary=null,disposeDiary=null;
  function diaryMarkup(){
    return '<section class="pcard" aria-labelledby="diaryTitle"><div class="collection-toolbar"><h2 id="diaryTitle">История оценок</h2><p id="diaryCount" aria-live="polite"></p></div>'+root.FBZExplore.filters('diaryFilters',{diary:true})+'<div id="diaryError"></div><div class="diary-list" id="diaryList" aria-busy="true"></div><div class="collection-pagination"><span id="diaryPage" aria-live="polite"></span><div><button class="btn btn-g btn-sm" id="diaryPrevious" type="button" onclick="FBZProfile.diaryPage(-1)">Назад</button><button class="btn btn-g btn-sm" id="diaryNext" type="button" onclick="FBZProfile.diaryPage(1)">Далее →</button></div></div></section>';
  }
  function diaryCurrent(s){return diary===s&&s.user===CU?.id&&s.route===routeVersion&&s.profile===profileVersion&&CP==='profile';}
  function diaryControls(){if(!diary)return;document.getElementById('diaryPrevious').disabled=diary.loading||diary.index===0;document.getElementById('diaryNext').disabled=diary.loading||!diary.hasMore;}
  async function loadDiary(){
    const s=diary;if(!s||!diaryCurrent(s))return;
    const version=++s.version;s.loading=true;diaryControls();
    const list=document.getElementById('diaryList');list.setAttribute('aria-busy','true');
    document.getElementById('diaryError').innerHTML='';
    document.getElementById('diaryCount').textContent='';
    document.getElementById('diaryPage').textContent='Загрузка…';
    list.innerHTML='<div class="loading" role="status"><div class="spin"></div><span class="sr-only">Загрузка истории</span></div>';
    try{
      const data=await root.FBZData.getProfileDiary(s.uid,{filters:s.filters,cursor:s.cursors[s.index],limit:8});
      if(!diaryCurrent(s)||version!==s.version)return;
      if(!data)throw new Error('Profile unavailable');
      const items=data.items||[];s.hasMore=Boolean(data.has_more);s.next=data.next_cursor;
      root.FBZExplore.populate(document.getElementById('diaryFilters'),data);
      list.innerHTML=items.length?items.map(r=>{
        const score=root.FBZDomain.ratingPresentation(r.match_rating),date=new Date(r.match_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'});
        const result=r.home_score!==null&&r.away_score!==null?`<span class="diary-scoreline">${Number(r.home_score)} : ${Number(r.away_score)}</span> · `:'';
        return `<button class="rh-row" type="button" onclick="go('md',{mid:${Number(r.match_id)}})"><div><div class="rh-m">${esc(r.home_team_name)} — ${esc(r.away_team_name)}</div><div class="rh-l">${result}${esc(r.league_name)} · ${esc(date)}${r.is_public?'':' · Только вам'}</div></div><div class="rh-r"><div class="rh-v" data-tone="${score.tone}">${score.value}<span class="score-denominator">/10</span></div></div></button>`;
      }).join(''):(root.FBZExplore.activeCount(document.getElementById('diaryFilters'))?'<div class="empty-state"><strong>Оценок по этим условиям нет</strong><p>Измените поиск или сбросьте фильтры.</p></div>':'<div class="empty-state"><strong>История оценок пока пуста</strong><p>Здесь появятся оценки просмотренных матчей.</p><button class="btn btn-g" type="button" onclick="go(\'matches\')">Найти матч</button></div>');
      document.getElementById('diaryCount').textContent=root.FBZDomain.countLabel(Number(data.total),{one:'оценка',few:'оценки',many:'оценок'});
      document.getElementById('diaryPage').textContent=items.length?`${s.index*8+1}–${s.index*8+items.length} из ${Number(data.total)}`:'Нет записей';
    }catch(error){if(diaryCurrent(s)&&version===s.version){s.hasMore=false;document.getElementById('diaryPage').textContent='';document.getElementById('diaryError').innerHTML='<div class="collection-error" role="status"><span>Не удалось загрузить историю</span><button class="btn btn-g btn-sm" onclick="FBZProfile.retryDiary()">Повторить</button></div>';list.innerHTML='';}}
    finally{if(diaryCurrent(s)&&version===s.version){s.loading=false;list.setAttribute('aria-busy','false');diaryControls();}}
  }
  function changeDiaryPage(direction){if(!diary||diary.loading)return;if(direction>0&&diary.hasMore){diary.cursors[++diary.index]=diary.next;}else if(direction<0&&diary.index>0){diary.index--;}else return;loadDiary();}
  function mountDiary(uid){
    disposeDiary?.();diary={uid,user:CU?.id,route:routeVersion,profile:profileVersion,filters:{},cursors:[null],index:0,version:0,loading:false,hasMore:false};
    const s=diary;
    disposeDiary=root.FBZExplore.bind(document.getElementById('diaryFilters'),filters=>{if(!diaryCurrent(s))return;s.filters=filters;s.index=0;s.cursors=[null];loadDiary();},()=>{if(diaryCurrent(s)){s.version++;s.loading=true;s.hasMore=false;diaryControls();}},()=>{
      if(!diaryCurrent(s))return;
      s.loading=false;s.index=0;s.hasMore=false;diaryControls();
      const list=document.getElementById('diaryList');list.replaceChildren();list.setAttribute('aria-busy','false');
      for(const id of ['diaryCount','diaryPage','diaryError'])document.getElementById(id).replaceChildren();
    });
    return loadDiary();
  }
function renderProfileInsights(ratings,matchMap){
  const list=ratings||[];
  if(!list.length)return '<section class="pcard"><h2 class="pcard-title">Футбол в деталях</h2><div class="profile-empty"><strong>У каждой истории есть первый матч</strong><p>Здесь появятся турниры и впечатления из доступных оценок.</p></div></section>';
  const leagueMap={};
  list.forEach(r=>{const league=matchMap[r.match_id]?.league_name;if(league)leagueMap[league]=(leagueMap[league]||0)+1;});
  const leagues=Object.entries(leagueMap).sort((a,b)=>b[1]-a[1]);
  const reviewed=list.filter(r=>String(r.comment||'').trim()).length;
  const nums=list.map(r=>Number(r.match_rating)).filter(n=>n>=1&&n<=10);
  return '<section class="pcard"><h2 class="pcard-title">Футбол в деталях</h2>'
    +'<p class="profile-sample">По '+esc(FBZDomain.countLabel(list.length,{one:'доступной оценке',few:'доступным оценкам',many:'доступным оценкам'}))+'. Это часть истории, видимая в профиле.</p>'
    +'<div class="p-insight-grid"><div class="p-mini"><span>'+reviewed+'</span><small>с комментарием</small></div><div class="p-mini"><span>'+leagues.length+'</span><small>турниров</small></div><div class="p-mini"><span>'+(nums.length?Math.min(...nums)+'–'+Math.max(...nums):'—')+'</span><small>диапазон оценок</small></div></div>'
    +(leagues.length?'<h3 class="profile-subtitle">Турниры в этой выборке</h3><div class="p-leagues">'+leagues.slice(0,3).map(([league,count])=>'<div class="p-league"><span>'+esc(league)+'</span><b>'+count+'</b></div>').join('')+'</div>':'')+'</section>';
}

function renderProfileComparison(comparison,friend){
  if(!comparison)return'';
  const common=Number(comparison.common_matches)||0;
  if(!common)return`<div class="pcard pcompare"><div class="pcard-title">${ico('users',14)} Ваш футбольный ракурс</div><div class="empty-state" style="padding:12px 0">Пока нет общих публично оценённых матчей.</div></div>`;
  const agreement=Math.max(0,Math.min(100,Number(comparison.agreement_score)||0));
  const rows=(comparison.closest||[]).map(item=>`<button type="button" onclick="go('md',{mid:${Number(item.match_id)}})"><span>${esc(item.home_team_name)} — ${esc(item.away_team_name)}</span><b>${item.my_score} : ${item.friend_score}</b></button>`).join('');
  return`<div class="pcard pcompare"><div class="pcard-title">${ico('users',14)} Ваш футбольный ракурс</div>
    <div class="pcompare-score"><div><strong>${agreement}%</strong><span>совпадение оценок</span></div><div><b>${common}</b><span>общих матчей</span></div><div><b>${Number(comparison.exact_matches)||0}</b><span>точных совпадений</span></div></div>
    <div class="pcompare-track"><i style="width:${agreement}%"></i></div>
    ${rows?`<div class="pcompare-list"><small>Самые близкие мнения · сначала ваша оценка</small>${rows}</div>`:''}
  </div>`;
}
function renderRatingDistribution(ratings){
  const list=(ratings||[]).filter(r=>Number(r.match_rating)>0);
  if(!list.length)return`<div class="pcard"><div class="pcard-title">${ico('chart',14)} Распределение оценок</div><div class="empty-state" style="padding:18px 0">Нет данных</div></div>`;
  const total=list.length;
  const counts=Array.from({length:10},(_,i)=>10-i).map(n=>({n,c:list.filter(r=>Number(r.match_rating)===n).length}));
  const max=Math.max(...counts.map(x=>x.c),1);
  return`<div class="pcard"><div class="pcard-title">${ico('chart',14)} Распределение оценок</div>
    <div class="prdist">${counts.map(x=>`
      <div class="prdist-row" data-tone="${FBZDomain.ratingTone(x.n)}">
        <span>${x.n}</span>
        <div class="prdist-bar"><i style="width:${Math.max((x.c/max)*100, x.c?8:0)}%"></i></div>
        <b>${x.c}</b>
      </div>`).join('')}
    </div>
    <div class="prdist-note">${FBZDomain.countLabel(total,{one:'доступная оценка',few:'доступные оценки',many:'доступных оценок'})}. Полная история может быть больше.</div>
  </div>`;
}
function renderFootballDiary(count,isOwner){
  const activity=FBZDomain.profileActivity(count);
  const remaining=FBZDomain.countLabel(activity.remaining,{one:'матч',few:'матча',many:'матчей'});
  return '<section class="profile-diary" aria-label="Футбольный дневник"><span class="section-kicker">Футбольный дневник</span><h2>'+esc(activity.label)+'</h2><p>'+(isOwner?esc(activity.description):'История оценок этого болельщика.')+'</p>'
    +(isOwner?'<div class="diary-milestone"><div><span>Следующая отметка</span><strong>'+esc(FBZDomain.countLabel(activity.next,{one:'матч',few:'матча',many:'матчей'}))+'</strong></div><div class="diary-track" role="progressbar" aria-label="До следующей отметки в дневнике" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+activity.progress+'" aria-valuetext="Осталось '+esc(remaining)+'"><i style="width:'+activity.progress+'%"></i></div><small>Осталось '+esc(remaining)+'. В своём темпе.</small></div>':'')
    +'<div class="diary-note">Количество записей показывает участие, а не уровень знаний о футболе.</div></section>';
}

async function loadProfile(uid){
  disposeDiary?.();diary=null;
  const token=++profileVersion,user=CU?.id,route=routeVersion;
  const current=()=>token===profileVersion&&CU?.id===user&&route===routeVersion&&CP==='profile';
  const w=document.getElementById('profileW');
  if(!uid){w.innerHTML='<div class="empty-state"><div class="empty-icon">👤</div>Войдите чтобы увидеть профиль</div>';return;}
  w.innerHTML='<div class="loading"><div class="spin"></div></div>';
  try{
    const ownsProfile=CU?.id===uid;
    const payload=await window.FBZData.getProfilePage(uid);
    if(!current())return;
    let u=payload?.profile;
    const favoriteClubs=Array.isArray(payload?.favorite_clubs)?payload.favorite_clubs:[];
    if(ownsProfile&&u){u={...u,email:CU?.email};CU={...CU,...u,favorite_clubs:favoriteClubs};}
    if(!u){w.innerHTML='<div class="empty-state"><div class="empty-icon">👤</div>Профиль не найден<br><span style="font-size:var(--type-small);color:var(--fog);margin-top:8px;display:block">Попробуйте войти заново</span></div>';return;}
    const ratings=payload.ratings||[];
    const friendCount=payload.stats?.friend_count||0;
    const tl=payload.stats?.like_count||0;
    const matchMap={};
    ratings.forEach(r=>{if(r.match)matchMap[r.match_id]=r.match;});
    const profileInsights=renderProfileInsights(ratings,matchMap);
    const ratingDistribution=renderRatingDistribution(ratings);
    let comparison=null;
    if(!ownsProfile&&CU&&payload.friendship?.status==='accepted'){
      const result=await sb.rpc('get_profile_comparison',{p_user_id:uid});
      if(!current())return;
      if(!result.error)comparison=result.data;
    }
    const profileComparison=renderProfileComparison(comparison,u);
    window.FBZSEO?.profile(u);

    const cnt=u.ratings_count||0;
    const avg=cnt?Number(u.avg_rating||0).toFixed(1):'—';
    const isMe=ownsProfile;
    const j=new Date(u.created_at||Date.now());
    const ms2=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    const cls=avColor(u.username||'x');
        const avatar=safeImageUrl(u.avatar_url);
        const avatarHtml=avatar?`<img src="${avatar}" class="phero-av-img" alt="">`:`<div class="phero-av ${cls}">${esc((u.username?.[0]||'U').toUpperCase())}</div>`;
    const footballDiary=renderFootballDiary(cnt,isMe);

    // Check friendship status for non-self profiles
    let friendBtn='';
    if(!isMe&&CU){
      const fr=payload.friendship;
      if(fr?.status==='accepted')friendBtn=`<button class="btn btn-g btn-sm" disabled style="opacity:0.7;cursor:default">${ico('users',13)} В друзьях</button><button class="btn btn-l btn-sm" type="button" onclick="openFriendChat(${jsStr(uid)})">${ico('chat',13)} Чат</button>`;
      else if(fr?.status==='pending'&&fr.direction==='outgoing')friendBtn=`<button class="btn btn-g btn-sm" disabled style="opacity:0.6;cursor:default">⏳ Заявка отправлена</button>`;
      else if(fr?.status==='pending')friendBtn=`<button class="btn btn-l btn-sm" id="profAddBtn" onclick="acceptFriendFromProfile(${jsStr(uid)})">${ico('users',13)} Принять заявку</button>`;
      else friendBtn=`<button class="btn btn-l btn-sm" id="profAddBtn" onclick="addFriendFromProfile(${jsStr(uid)})">${ico('users',13)} Добавить в друзья</button>`;
    }else if(!isMe){
      friendBtn=`<button class="btn btn-l btn-sm" onclick="openAuth()">Войти чтобы добавить</button>`;
    }
    const ownerActions=isMe?`<button class="btn btn-g btn-sm" onclick="editProfile()">${ico('edit',13)} Редактировать</button>`:friendBtn;

    w.innerHTML=`
    <div class="phero">
      ${avatarHtml}
      <h1 class="phero-name">${esc(u.display_name||u.username||'Болельщик')}</h1><p class="phero-hand">@${esc(u.username||'user')}</p>
      ${u.bio?`<div class="phero-bio">${esc(u.bio)}</div>`:''}
      ${favoriteClubs.length?`<div class="profile-favorite-clubs" aria-label="Любимые клубы">${favoriteClubs.map(club=>`<button type="button" onclick="go('club',{id:${Number(club.id)}})">${window.FBZMedia.visual({entity:club,kind:'club',className:'profile-club-mark'})}<span>${esc(club.short_name||club.name)}</span></button>`).join('')}</div>`:''}
      <div class="phero-badges">
        <span class="pbadge pb-l">Болельщик</span>
        ${activeProfileStreak(u)>0?`<span class="pbadge pb-s">${ico('fire',12)} ${FBZDomain.countLabel(activeProfileStreak(u),{one:'день',few:'дня',many:'дней'})} подряд</span>`:''}
        <span class="pbadge pb-j">С ${j.getDate()} ${ms2[j.getMonth()]} ${j.getFullYear()}</span>
      </div>
      <div class="pstats">
        <div class="pst"><div class="pst-v">${cnt}</div><div class="pst-l">Оценок</div></div>
        <div class="pst"><div class="pst-v rating-ink" data-tone="${FBZDomain.ratingTone(Number(avg))}">${avg}</div><div class="pst-l">Средняя</div></div>
        <div class="pst"><div class="pst-v">${tl}</div><div class="pst-l">Лайков</div></div>
        <div class="pst"><div class="pst-v">${friendCount}</div><div class="pst-l">Друзей</div></div>
      </div>
      <div class="phero-acts">
        ${ownerActions}
        <button class="btn btn-g btn-sm" onclick="copyAppLink(${jsStr('/profile/'+encodeURIComponent(uid))},'Ссылка на профиль')">${ico('link',13)} Ссылка</button>
      </div>
    </div>
    <div class="pgrid">
      <div>
        ${profileComparison}
        ${profileInsights}
        ${diaryMarkup()}
      </div>
      <div>
        ${footballDiary}
        ${ratingDistribution}
        ${isMe&&u.invite_code?`<div class="pcard"><div class="pcard-title">${ico('link',14)} Пригласи друга</div><div style="background:var(--bg3);border:1px solid var(--b1);border-radius:9px;padding:12px;margin-bottom:12px;word-break:break-all;font-size:var(--type-meta);color:var(--accent2)">${esc(invitationUrl(u.invite_code))}</div><button class="btn btn-l" style="width:100%" onclick="copyInv(${jsStr(u.invite_code)})">${ico('copy',13)} Копировать ссылку</button></div>`:''}
        <div class="pcard"><div class="pcard-title">${ico('share',14)} Поделиться</div>
          <button class="btn btn-l" style="width:100%;margin-bottom:8px" onclick="openShare('profile',{name:${jsStr(u.display_name||'')},username:${jsStr(u.username||'user')},ratings:${cnt},avg:${jsStr(avg)},likes:${tl},friends:${friendCount},activity:${jsStr(FBZDomain.profileActivity(cnt).label)}})">${ico('photo',13)} Создать карточку</button>
          <button class="btn btn-g" style="width:100%" onclick="expStats(${cnt},${jsStr(avg)},${jsStr(u.username||'user')})">${ico('copy',13)} Копировать текст</button>
        </div>
      </div>
    </div>`;
    await mountDiary(uid);
  }catch(e){
    if(!current())return;
    console.error('Profile error:',e);
    w.innerHTML=`<div class="empty-state"><strong>Не удалось загрузить профиль</strong><p>Проверьте соединение и попробуйте ещё раз.</p><button class="btn btn-g" onclick="loadProfile(${jsStr(uid)})">Повторить</button></div>`;
  }
}
async function mutateProfileFriendship(fid,accept){
  if(!CU){openAuth();return;}
  const user=CU.id,key=user+':'+fid,route=routeVersion,profile=profileVersion;
  if(profileFriendActions.has(key))return;
  const button=document.getElementById('profAddBtn');
  const current=()=>CU?.id===user&&routeVersion===route&&profileVersion===profile&&CP==='profile';
  profileFriendActions.add(key);if(button)button.disabled=true;
  try{
    const{data,error}=await sb.rpc(accept?'respond_friendship':'request_friendship',accept?{p_requester_id:fid,p_action:'accept'}:{p_friend_id:fid});
    if(error)throw error;
    if(CU?.id!==user)return;
    window.FBZData?.invalidate('profile:');
    if(!current())return;
    toast(accept||data?.status==='accepted'?'Теперь вы друзья':'Заявка отправлена','ok');
    loadNotifications();await loadProfile(fid);
  }catch(error){if(current())toast('Не удалось выполнить действие. Попробуйте ещё раз.','err');}
  finally{profileFriendActions.delete(key);if(button?.isConnected)button.disabled=false;}
}

  root.FBZProfile=Object.freeze({mount:loadProfile,mutateFriendship:mutateProfileFriendship,diaryPage:changeDiaryPage,retryDiary:loadDiary});
})(window);
