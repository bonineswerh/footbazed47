(function(root){
  'use strict';
  const profileFriendActions=new Set();
  let diary=null,disposeDiary=null;
  function diaryMarkup(){
    return '<section class="pcard" aria-labelledby="diaryTitle"><div class="collection-toolbar"><h2 id="diaryTitle">История оценок</h2><p id="diaryCount" aria-live="polite"></p></div>'+root.FBZExplore.filters('diaryFilters',{diary:true})+'<div id="diaryError"></div><div class="diary-list" id="diaryList" aria-busy="true"></div><div class="collection-pagination"><span id="diaryPage" aria-live="polite"></span><div><button class="btn btn-g btn-sm" id="diaryPrevious" type="button" data-fbz-click="profile.diary-previous">Назад</button><button class="btn btn-g btn-sm" id="diaryNext" type="button" data-fbz-click="profile.diary-next">Далее →</button></div></div></section>';
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
      list.innerHTML=items.length?root.FBZExploreModel.monthGroups(items,data.months||[]).map(group=>{
        const monthLabel=new Date(group.month+'-01T00:00:00Z').toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}),summary=group.summary;
        const heading=`<header class="diary-month-head"><h3>${esc(monthLabel)}</h3>${summary?`<p>${esc(root.FBZDomain.countLabel(summary.matches,{one:'матч',few:'матча',many:'матчей'}))} · средняя оценка <strong>${root.FBZDomain.ratingPresentation(summary.average,1).value}</strong></p>`:''}</header>`;
        return `<section class="diary-month" aria-label="${esc(monthLabel)}">${heading}`+group.items.map(r=>{
        const score=root.FBZDomain.ratingPresentation(r.match_rating),date=new Date(r.match_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
        const result=r.home_score!==null&&r.away_score!==null?`<span class="diary-scoreline">${Number(r.home_score)} : ${Number(r.away_score)}</span> · `:'';
        const marks=root.matchClubMark(r,'home','collection-mark')+root.matchClubMark(r,'away','collection-mark');
        return `<button class="rh-row" type="button" ${FBZActions.attrs("profile.go-md",[Number(r.match_id)])}><span class="diary-content"><span class="collection-marks" aria-hidden="true">${marks}</span><span><span class="rh-m">${esc(r.home_team_name)} — ${esc(r.away_team_name)}</span><span class="rh-l">${result}${esc(r.league_name)} · ${esc(date)}${r.is_public?'':' · Только вам'}</span></span></span><span class="rh-r"><span class="rh-v" data-tone="${score.tone}">${score.value}<span class="score-denominator">/10</span></span></span></button>`;
      }).join('')+'</section>';}).join(''):(root.FBZExplore.activeCount(document.getElementById('diaryFilters'))?'<div class="empty-state"><strong>Оценок по этим условиям нет</strong><p>Измените поиск или сбросьте фильтры.</p></div>':'<div class="empty-state"><strong>История оценок пока пуста</strong><p>Здесь появятся оценки просмотренных матчей.</p><button class="btn btn-g" type="button" data-fbz-click="shell.go-matches">Найти матч</button></div>');
      document.getElementById('diaryCount').textContent=root.FBZDomain.countLabel(Number(data.total),{one:'оценка',few:'оценки',many:'оценок'});
      document.getElementById('diaryPage').textContent=items.length?`${s.index*8+1}–${s.index*8+items.length} из ${Number(data.total)}`:'Нет записей';
    }catch(error){if(diaryCurrent(s)&&version===s.version){s.hasMore=false;document.getElementById('diaryPage').textContent='';document.getElementById('diaryError').innerHTML='<div class="collection-error" role="status"><span>Не удалось загрузить историю</span><button class="btn btn-g btn-sm" data-fbz-click="profile.retry-diary">Повторить</button></div>';list.innerHTML='';}}
    finally{if(diaryCurrent(s)&&version===s.version){s.loading=false;list.setAttribute('aria-busy','false');diaryControls();}}
  }
  function changeDiaryPage(direction){if(!diary||diary.loading)return;if(direction>0&&diary.hasMore){diary.cursors[++diary.index]=diary.next;}else if(direction<0&&diary.index>0){diary.index--;}else return;loadDiary();}
  function mountDiary(uid){
    disposeDiary?.();diary={uid,user:CU?.id,route:routeVersion,profile:profileVersion,filters:root.FBZExplore.locationFilters(location.search,'di'),cursors:[null],index:0,version:0,loading:false,hasMore:false};
    const s=diary,form=document.getElementById('diaryFilters');root.FBZExplore.restore(form,s.filters);
    disposeDiary=root.FBZExplore.bind(form,(filters,mode)=>{if(!diaryCurrent(s))return;s.filters=filters;s.index=0;s.cursors=[null];root.FBZExplore.writeLocation(form,filters,{},mode);loadDiary();},()=>{if(diaryCurrent(s)){s.version++;s.loading=true;s.hasMore=false;diaryControls();}},()=>{
      if(!diaryCurrent(s))return;
      s.loading=false;s.index=0;s.hasMore=false;diaryControls();
      const list=document.getElementById('diaryList');list.replaceChildren();list.setAttribute('aria-busy','false');
      for(const id of ['diaryCount','diaryPage','diaryError'])document.getElementById(id).replaceChildren();
    });
    return loadDiary();
  }
function renderProfileInsights(ratings,matchMap,summary){
  if(summary){
    const total=Number(summary.total)||0,tournaments=summary.tournaments||[];
    const scope=summary.scope==='own'?'По всей вашей истории, включая оценки «Только вам».':'По всей публичной истории оценок этого болельщика.';
    return '<section class="pcard" aria-labelledby="profileInsightsTitle"><h2 class="pcard-title" id="profileInsightsTitle">Футбол в деталях</h2>'
      +'<p class="profile-sample">'+esc(scope)+'</p>'
      +(total?'<div class="p-insight-grid"><div class="p-mini"><span>'+Number(summary.reviewed)+'</span><small>с комментарием</small></div><div class="p-mini"><span>'+Number(summary.tournament_count)+'</span><small>турниров</small></div><div class="p-mini"><span>'+Number(summary.minimum)+'–'+Number(summary.maximum)+'</span><small>диапазон оценок</small></div></div>'
        +(tournaments.length?'<h3 class="profile-subtitle">'+(Number(summary.tournament_count)>tournaments.length?'Чаще всего оценивает':'Оценки по турнирам')+'</h3><div class="p-leagues">'+tournaments.map(t=>'<button class="p-league profile-tournament" type="button" '+FBZActions.attrs('profile.go-competition',[Number(t.id)])+'><span>'+esc(t.name)+'<small>'+esc(FBZDomain.countLabel(Number(t.votes),{one:'оценка',few:'оценки',many:'оценок'}))+'</small></span><span class="profile-tournament-average rating-ink" data-tone="'+FBZDomain.ratingTone(Number(t.average))+'">'+FBZDomain.ratingPresentation(t.average,1).value+'<span class="sr-only"> — средняя оценка</span></span></button>').join('')+'</div>':'')
        :'<div class="profile-empty"><strong>У каждой истории есть первый матч</strong><p>Здесь появятся турниры и впечатления из доступных оценок.</p></div>')+'</section>';
  }
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

function renderRatingDistribution(ratings,summary){
  const list=(ratings||[]).filter(r=>Number(r.match_rating)>0);
  const total=summary?Number(summary.total):list.length;
  if(!total)return`<section class="pcard" aria-labelledby="profileDistributionTitle"><h2 class="pcard-title" id="profileDistributionTitle">${ico('chart',14)} Распределение оценок</h2><div class="empty-state" style="padding:18px 0">Оценок пока нет</div></section>`;
  const counts=Array.from({length:10},(_,i)=>10-i).map(n=>({n,c:summary?Number(summary.distribution?.find(x=>Number(x.rating)===n)?.count)||0:list.filter(r=>Number(r.match_rating)===n).length}));
  const max=Math.max(...counts.map(x=>x.c),1);
  return`<section class="pcard" aria-labelledby="profileDistributionTitle"><h2 class="pcard-title" id="profileDistributionTitle">${ico('chart',14)} Распределение оценок</h2>
    <div class="prdist">${counts.map(x=>`
      <div class="prdist-row" data-tone="${FBZDomain.ratingTone(x.n)}">
        <span>${x.n}</span>
        <div class="prdist-bar"><i style="width:${Math.max((x.c/max)*100, x.c?8:0)}%"></i></div>
        <b>${x.c}</b>
      </div>`).join('')}
    </div>
    <div class="prdist-note">${FBZDomain.countLabel(total,{one:'доступная оценка',few:'доступные оценки',many:'доступных оценок'})}. ${summary?'Вся '+(summary.scope==='own'?'ваша':'публичная')+' история.':'Полная история может быть больше.'}</div>
  </section>`;
}
function renderFootballDiary(count,isOwner){
  const activity=FBZDomain.profileActivity(count);
  const remaining=FBZDomain.countLabel(activity.remaining,{one:'матч',few:'матча',many:'матчей'});
  return '<section class="profile-diary" aria-label="Футбольный дневник"><span class="section-kicker">Футбольный дневник</span><h2>'+esc(activity.label)+'</h2><p>'+(isOwner?esc(activity.description):'История оценок этого болельщика.')+'</p>'
    +(isOwner?'<div class="diary-milestone"><div><span>Следующая отметка</span><strong>'+esc(FBZDomain.countLabel(activity.next,{one:'матч',few:'матча',many:'матчей'}))+'</strong></div><div class="diary-track" role="progressbar" aria-label="До следующей отметки в дневнике" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+activity.progress+'" aria-valuetext="Осталось '+esc(remaining)+'"><i style="width:'+activity.progress+'%"></i></div><small>Осталось '+esc(remaining)+'. В своём темпе.</small></div>':'')
    +'<div class="diary-note">Количество записей показывает участие, а не уровень знаний о футболе.</div></section>';
}

async function loadProfile(uid){
  root.FBZComparison?.close(false);
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
    const summary=payload.rating_summary||null;
    const profileInsights=renderProfileInsights(ratings,matchMap,summary);
    const ratingDistribution=renderRatingDistribution(ratings,summary);
    window.FBZSEO?.profile(u);

    const cnt=summary?Number(summary.total)||0:u.ratings_count||0;
    const avg=cnt?Number(summary?summary.average:u.avg_rating||0).toFixed(1):'—';
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
      if(fr?.status==='accepted')friendBtn=`<button class="btn btn-g btn-sm" disabled style="opacity:0.7;cursor:default">${ico('users',13)} В друзьях</button>`;
      else if(fr?.status==='pending'&&fr.direction==='outgoing')friendBtn=`<button class="btn btn-g btn-sm" disabled style="opacity:0.6;cursor:default">⏳ Заявка отправлена</button>`;
      else if(fr?.status==='pending')friendBtn=`<button class="btn btn-l btn-sm" id="profAddBtn" ${FBZActions.attrs("profile.accept-friend-from-profile",[uid])}>${ico('users',13)} Принять заявку</button>`;
      else friendBtn=`<button class="btn btn-l btn-sm" id="profAddBtn" ${FBZActions.attrs("profile.add-friend-from-profile",[uid])}>${ico('users',13)} Добавить в друзья</button>`;
    }else if(!isMe){
      friendBtn=`<button class="btn btn-l btn-sm" data-fbz-click="shell.open-auth">Войти чтобы добавить</button>`;
    }
    const ownerActions=isMe?`<button class="btn btn-g btn-sm" data-fbz-click="profile.edit-profile">${ico('edit',13)} Редактировать</button>`:friendBtn;

    w.innerHTML=`
    <div class="phero">
      ${avatarHtml}
      <h1 class="phero-name">${esc(u.display_name||u.username||'Болельщик')}</h1><p class="phero-hand">@${esc(u.username||'user')}</p>
      ${u.bio?`<div class="phero-bio">${esc(u.bio)}</div>`:''}
      ${favoriteClubs.length?`<div class="profile-favorite-clubs" aria-label="Любимые клубы">${favoriteClubs.map(club=>`<button type="button" ${FBZActions.attrs("profile.go-club",[Number(club.id)])}>${window.FBZMedia.visual({entity:club,kind:'club',className:'profile-club-mark'})}<span>${esc(club.short_name||club.name)}</span></button>`).join('')}</div>`:''}
      <div class="phero-badges">
        <span class="pbadge pb-l">Болельщик</span>
        ${activeProfileStreak(u)>0?`<span class="pbadge pb-s">${ico('fire',12)} ${FBZDomain.countLabel(activeProfileStreak(u),{one:'день',few:'дня',many:'дней'})} подряд</span>`:''}
        <span class="pbadge pb-j">С ${j.getDate()} ${ms2[j.getMonth()]} ${j.getFullYear()}</span>
      </div>
      <div class="pstats">
        <div class="pst"><div class="pst-v">${cnt}</div><div class="pst-l">${summary&&summary.scope==='public'?'Публичных оценок':'Оценок'}</div></div>
        <div class="pst"><div class="pst-v rating-ink" data-tone="${FBZDomain.ratingTone(Number(avg))}">${avg}</div><div class="pst-l">Средняя</div></div>
        <div class="pst"><div class="pst-v">${tl}</div><div class="pst-l">Лайков</div></div>
        <div class="pst"><div class="pst-v">${friendCount}</div><div class="pst-l">Друзей</div></div>
      </div>
      <div class="phero-acts">
        ${ownerActions}
        ${!isMe&&CU?`<button class="btn btn-g btn-sm" ${FBZActions.attrs('profile.compare',[uid])}>${ico('chart',14)} Сравнить</button>`:''}
        ${!isMe&&CU?`<button class="btn btn-g btn-sm" ${FBZActions.attrs('app.report-content',['profile',uid])} aria-label="Пожаловаться на профиль" title="Пожаловаться на профиль">${ico('shield',14)} Жалоба</button>`:''}
        <button class="btn btn-g btn-sm" ${FBZActions.attrs("profile.copy-app-link",['/profile/'+encodeURIComponent(uid)])}>${ico('link',13)} Ссылка</button>
      </div>
    </div>
    <div class="pgrid">
      <div>
        ${profileInsights}
        ${diaryMarkup()}
      </div>
      <div>
        ${footballDiary}
        ${ratingDistribution}
        ${isMe&&u.invite_code?`<div class="pcard"><div class="pcard-title">${ico('link',14)} Пригласи друга</div><div style="background:var(--bg3);border:1px solid var(--b1);border-radius:9px;padding:12px;margin-bottom:12px;word-break:break-all;font-size:var(--type-meta);color:var(--accent2)">${esc(invitationUrl(u.invite_code))}</div><button class="btn btn-l" style="width:100%" ${FBZActions.attrs("profile.copy-inv",[u.invite_code])}>${ico('copy',13)} Копировать ссылку</button></div>`:''}
        <div class="pcard"><div class="pcard-title">${ico('share',14)} Поделиться</div>
          <button class="btn btn-l" style="width:100%;margin-bottom:8px" ${FBZActions.attrs("profile.open-share-profile",[u.display_name||'',u.username||'user',cnt,avg,tl,friendCount,FBZDomain.profileActivity(cnt).label])}>${ico('photo',13)} Создать карточку</button>
          <button class="btn btn-g" style="width:100%" ${FBZActions.attrs("profile.exp-stats",[cnt,avg,u.username||'user'])}>${ico('copy',13)} Копировать текст</button>
          ${isMe?`<button class="btn btn-g profile-own-reports" type="button" ${FBZActions.attrs('app.report-content',['history',''])}>${ico('shield',14)} Мои обращения</button>`:''}
        </div>
      </div>
    </div>`;
    await mountDiary(uid);
  }catch(e){
    if(!current())return;
    console.error('Profile error:',e);
    w.innerHTML=`<div class="empty-state"><strong>Не удалось загрузить профиль</strong><p>Проверьте соединение и попробуйте ещё раз.</p><button class="btn btn-g" ${FBZActions.attrs("profile.load-profile",[uid])}>Повторить</button></div>`;
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

  async function compare(uid,button){
    if(!CU||uid===CU.id||CP!=='profile'||button.disabled)return;
    const user=CU.id,route=routeVersion,profile=profileVersion;button.disabled=true;
    try{
      const comparison=await ensureFeatureModule({key:'comparison',styleId:'comparisonStyles',style:'css/comparison.css?v=1',script:'js/comparison.js?v=1',ready:()=>root.FBZComparison});
      if(CU?.id===user&&route===routeVersion&&profile===profileVersion&&CP==='profile'){button.disabled=false;button.focus({preventScroll:true});await comparison.open(uid);}
    }catch(error){if(CU?.id===user&&route===routeVersion)toast('Не удалось открыть сравнение. Попробуйте ещё раз.','err');}
    finally{if(button.isConnected)button.disabled=false;}
  }
  root.FBZProfile=Object.freeze({mount:loadProfile,mutateFriendship:mutateProfileFriendship,diaryPage:changeDiaryPage,retryDiary:loadDiary,compare});
})(window);

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "profile.compare":(event,element,[uid])=>FBZProfile.compare(uid,element),
  "profile.diary-previous":()=>FBZProfile.diaryPage(-1),
  "profile.diary-next":()=>FBZProfile.diaryPage(1),
  "profile.go-md":(event,element,[id])=>go('md',{mid:id}),
  "profile.retry-diary":()=>FBZProfile.retryDiary(),
  "profile.accept-friend-from-profile":(event,element,[userId])=>acceptFriendFromProfile(userId),
  "profile.add-friend-from-profile":(event,element,[userId])=>addFriendFromProfile(userId),
  "profile.edit-profile":()=>editProfile(),
  "profile.go-club":(event,element,[id])=>go('club',{id:id}),
  "profile.go-competition":(event,element,[id])=>go('competition',{id:id}),
  "profile.copy-app-link":(event,element,[url])=>copyAppLink(url,'Ссылка на профиль'),
  "profile.copy-inv":(event,element,[code])=>copyInv(code),
  "profile.open-share-profile":(event,element,[name,username,ratings,average,likes,friends,activity])=>openShare('profile',{name:name,username:username,ratings:ratings,avg:average,likes:likes,friends:friends,activity:activity}),
  "profile.exp-stats":(event,element,[count,average,username])=>expStats(count,average,username),
  "profile.load-profile":(event,element,[userId])=>loadProfile(userId)
});
