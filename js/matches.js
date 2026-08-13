const MATCH_PAGE_SIZE=24;
let matchCatalog=[];
let matchLeagues=[];
let matchTotal=0;
let matchHasMore=false;
let matchNextOffset=0;
let matchLoading=false;
let matchRequestId=0;

function matchPageSize(){
  return window.matchMedia('(max-width: 900px)').matches?12:MATCH_PAGE_SIZE;
}

function isDerby(home,away){
  return DERBY.some(item=>(item.h===home&&item.a===away)||(item.h===away&&item.a===home));
}

function fmtDate(value){
  return new Date(value).toLocaleDateString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}

function teamMonogram(name){
  const ignored=new Set(['fc','cf','afc','rc','fk','club']);
  const words=String(name||'').match(/[\p{L}\p{N}]+/gu)||[];
  const meaningful=words.filter(word=>!ignored.has(word.toLocaleLowerCase('en-US')));
  const source=meaningful.length?meaningful:words;
  if(!source.length)return'FB';
  if(source.length===1)return source[0].slice(0,2).toLocaleUpperCase('ru-RU');
  return`${source[0][0]}${source[1][0]}`.toLocaleUpperCase('ru-RU');
}

function sortMatches(items){
  return window.FBZDomain.sortMatches(items);
}

async function fetchMatchPage({offset=0,limit=matchPageSize(),force=false}={}){
  return window.FBZData.getMatchesPage({
    status:MF,
    league:ML,
    query:document.getElementById('msearch')?.value||'',
    limit,
    offset,
    force
  });
}

function renderMCard(match){
  const statusLabel={live:'LIVE',finished:'Завершён',scheduled:'Предстоит'}[match.status]||match.status;
  const statusClass={live:'t-live',finished:'t-fin',scheduled:'t-sched'}[match.status]||'';
  const derby=isDerby(match.home_team_name,match.away_team_name);
  return`<article class="mcard${derby?' derby':''}">
    <div class="mcard-gradient"></div>
    <div class="mcard-body">
      <div class="mc-t">
        <span class="mc-lg">${esc(match.league_name)}</span>
        <div class="mc-tags">${derby?`<span class="tag t-derby">${ico('fire',12)} Дерби</span>`:''}<span class="tag ${statusClass}">${esc(statusLabel)}</span></div>
      </div>
      <button class="mc-score-block mc-score-link" type="button" aria-label="${esc(match.home_team_name)} против ${esc(match.away_team_name)}" onclick="go('md',{mid:${match.id}})">
        <div class="mc-score-team"><div class="mc-score-name">${esc(match.home_team_name)}</div><div class="mc-score-num">${esc(match.home_score??'—')}</div></div>
        <div class="mc-score-vs">VS</div>
        <div class="mc-score-team"><div class="mc-score-name">${esc(match.away_team_name)}</div><div class="mc-score-num">${esc(match.away_score??'—')}</div></div>
      </button>
      <div class="mc-bottom">
        <span class="mc-meta-date">${ico('calendar',12)} ${fmtDate(match.match_date)}</span>
        <div class="mc-acts">
          ${match.status==='finished'?`<button class="mbtn lime" onclick="openRate(${match.id})">${ico('star',14)} Оценить</button>`:''}
          <button class="mbtn" aria-label="Обсуждение матча" title="Обсуждение" onclick="go('chat',{mid:${match.id},title:'Чат матча'})">${ico('chat',14)}</button>
        </div>
      </div>
    </div>
  </article>`;
}

function featuredMatches(items){
  const upcoming=sortMatches(items).filter(match=>match.status==='live'||match.status==='scheduled');
  if(upcoming.length)return upcoming.slice(0,6);
  return sortMatches(items).slice(0,6);
}

async function loadHomeM(){
  const target=document.getElementById('homeM');
  if(!target)return;
  try{
    const page=await window.FBZData.getMatchesPage({limit:6});
    const items=featuredMatches(page?.items||[]);
    target.innerHTML=items.length?items.map(renderMCard).join(''):'<div class="empty-state"><div class="empty-icon">🏟️</div><strong>Матчей пока нет</strong><span>Новые встречи появятся после обновления календаря.</span></div>';
  }catch(error){
    console.warn('loadHomeM:',error);
    target.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><strong>Не удалось загрузить матчи</strong><button class="btn btn-g btn-sm" onclick="loadHomeM()">Повторить</button></div>';
  }
}

function renderLeagueTabs(){
  const target=document.getElementById('leagueTabs');
  if(!target)return;
  target.innerHTML=`<button type="button" class="league-tab${ML==='all'?' on':''}" aria-pressed="${ML==='all'}" onclick="setLeague('all',this)">Все лиги</button>`+
    matchLeagues.map(league=>`<button type="button" class="league-tab${ML===league?' on':''}" aria-pressed="${ML===league}" onclick="setLeague(${jsStr(league)},this)">${esc(league)}</button>`).join('');
}

function matchCountLabel(count){
  const mod10=count%10,mod100=count%100;
  if(mod10===1&&mod100!==11)return'матч';
  if(mod10>=2&&mod10<=4&&(mod100<12||mod100>14))return'матча';
  return'матчей';
}

function renderMatchResults(){
  const target=document.getElementById('matchG');
  if(!target)return;
  if(!matchCatalog.length){
    target.innerHTML='<div class="empty-state"><div class="empty-icon">⌕</div><strong>Ничего не найдено</strong><span>Измени команду, лигу или статус матча.</span></div>';
    return;
  }

  const visible=matchCatalog;
  let content='';
  if(ML==='all'){
    const grouped=new Map();
    visible.forEach(match=>{
      const league=match.league_name||'Другое';
      if(!grouped.has(league))grouped.set(league,[]);
      grouped.get(league).push(match);
    });
    content=[...grouped.entries()].map(([league,matches])=>`<section class="league-group">
      <div class="league-group-hd"><h2 class="league-group-name">${esc(league)}</h2><span class="league-group-count">${matches.length} ${matchCountLabel(matches.length)}</span></div>
      <div class="grid3">${matches.map(renderMCard).join('')}</div>
    </section>`).join('');
  }else{
    content=`<div class="grid3">${visible.map(renderMCard).join('')}</div>`;
  }

  const shown=visible.length,total=matchTotal;
  target.innerHTML=`<div class="match-results-summary"><span>Показано ${shown} из ${total}</span><span>${ML==='all'?'Все лиги':esc(ML)}</span></div>${content}${matchHasMore?`<div class="load-more-wrap"><button class="btn btn-g load-more" type="button" onclick="loadMoreMatches()">Показать ещё <span>${Math.min(matchPageSize(),Math.max(total-shown,0))}</span></button></div>`:''}`;
}

async function loadM(reset=true){
  const target=document.getElementById('matchG');
  if(!target)return;
  const requestId=++matchRequestId;
  matchLoading=true;
  target.innerHTML='<div class="loading"><div class="spin"></div><span>Загружаем календарь</span></div>';
  try{
    const page=await fetchMatchPage({offset:0,force:reset});
    if(requestId!==matchRequestId)return;
    matchCatalog=Array.isArray(page?.items)?page.items:[];
    matchLeagues=Array.isArray(page?.leagues)?page.leagues:[];
    matchTotal=Number(page?.total)||0;
    matchHasMore=Boolean(page?.has_more);
    matchNextOffset=Number(page?.next_offset)||matchCatalog.length;
    renderLeagueTabs();
    renderMatchResults();
  }catch(error){
    if(requestId!==matchRequestId)return;
    console.error('Matches error:',error);
    target.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><strong>Календарь временно недоступен</strong><span>Проверь соединение и попробуй ещё раз.</span><button class="btn btn-g btn-sm" onclick="loadM(true)">Повторить</button></div>';
  }finally{
    if(requestId===matchRequestId)matchLoading=false;
  }
}

async function loadMoreMatches(){
  if(matchLoading||!matchHasMore)return;
  const requestId=matchRequestId;
  matchLoading=true;
  const button=document.querySelector('.load-more');
  if(button){button.disabled=true;button.textContent='Загружаем...';}
  try{
    const page=await fetchMatchPage({offset:matchNextOffset});
    if(requestId!==matchRequestId)return;
    const knownIds=new Set(matchCatalog.map(match=>String(match.id)));
    for(const match of page?.items||[])if(!knownIds.has(String(match.id)))matchCatalog.push(match);
    matchTotal=Number(page?.total)||matchTotal;
    matchHasMore=Boolean(page?.has_more);
    matchNextOffset=Number(page?.next_offset)||matchCatalog.length;
    renderMatchResults();
  }catch(error){
    if(requestId!==matchRequestId)return;
    console.error('More matches error:',error);
    toast('Не удалось загрузить ещё матчи','err');
    if(button){button.disabled=false;button.textContent='Повторить';}
  }finally{
    if(requestId===matchRequestId)matchLoading=false;
  }
}

function setLeague(league,button){
  ML=league;
  document.querySelectorAll('.league-tab').forEach(item=>{item.classList.remove('on');item.setAttribute('aria-pressed','false');});
  button?.classList.add('on');
  button?.setAttribute('aria-pressed','true');
  loadM(true);
}

function filterM(){
  clearTimeout(window._ft);
  window._ft=setTimeout(()=>loadM(true),280);
}

function setMF(filter,button){
  MF=filter;
  document.querySelectorAll('#mf .btn').forEach(item=>{item.className='btn btn-g btn-sm';item.setAttribute('aria-pressed','false');});
  button.className='btn btn-l btn-sm';
  button.setAttribute('aria-pressed','true');
  loadM(true);
}

async function loadMD(id){
  if(!id)return;
  const target=document.getElementById('mdC');
  target.innerHTML='<div class="loading"><div class="spin"></div><span>Загружаем матч</span></div>';
  try{
    const ownRatingRequest=CU
      ?sb.from('ratings').select('match_rating,comment,is_public,updated_at').eq('user_id',CU.id).eq('match_id',id).maybeSingle()
      :Promise.resolve({data:null,error:null});
    const[{data:match,error:matchError},{data:ratings,error:ratingsError},{data:insights,error:insightsError},{data:ownRating,error:ownRatingError}]=await Promise.all([
      sb.from('matches').select(MATCH_FIELDS).eq('id',id).single(),
      sb.from('ratings').select(RATING_FIELDS).eq('match_id',id).eq('is_public',true).order('created_at',{ascending:false}).limit(200),
      sb.rpc('get_match_insights',{p_match_id:Number(id)}),
      ownRatingRequest
    ]);
    if(matchError)throw matchError;
    if(ratingsError)throw ratingsError;
    if(insightsError)throw insightsError;
    if(ownRatingError)throw ownRatingError;
    if(!match){target.innerHTML='<div class="empty-state"><strong>Матч не найден</strong></div>';return;}
    window.FBZSEO?.match(match);

    const userIds=[...new Set((ratings||[]).map(rating=>rating.user_id))];
    const{data:users}=userIds.length
      ?await sb.from('users').select('id,display_name,username,avatar_url').in('id',userIds)
      :{data:[]};
    const userMap={};(users||[]).forEach(user=>{userMap[user.id]=user;});
    const ratingCount=Number(insights?.rating_count||0);
    const averageValue=Number(insights?.average);
    const hasAverage=ratingCount>0&&Number.isFinite(averageValue);
    const average=hasAverage?averageValue.toFixed(1):'—';
    const distribution=Array.isArray(insights?.distribution)?insights.distribution:Array.from({length:10},(_,index)=>({score:10-index,count:0}));
    const maxDistribution=Math.max(...distribution.map(item=>item.count),1);
    const topPlayers=Array.isArray(insights?.top_players)?insights.top_players:[];
    const statusLabel={live:'LIVE',finished:'Завершён',scheduled:'Предстоит'}[match.status]||match.status;
    const prediction=match.status==='scheduled'?`<section class="md-prediction"><div class="mdcard-title">${ico('target',15)} Прогноз на матч</div>${renderPredBlock(match)}</section>`:'';
    const competitionMeta=[match.season?`Сезон ${match.season}`:'',match.matchday?`${match.matchday}-й тур`:''].filter(Boolean).join(' · ');
    const communityMarkup=ratingCount?`<div class="md-comm">
      <div class="md-ci"><div class="md-cv">${average}</div><div class="md-cl">Средняя сообщества</div></div>
      <div class="md-ci"><div class="md-cv">${ratingCount}</div><div class="md-cl">Публичных оценок</div></div>
      <div class="md-ci"><div class="md-cv md-cv-player">${esc(topPlayers[0]?.name||'—')}</div><div class="md-cl">Лучший игрок</div></div>
    </div>`:`<div class="md-community-empty"><strong>${match.status==='scheduled'?'Оценки откроются после матча':'Мнение сообщества ещё не сформировано'}</strong><span>${match.status==='scheduled'?'После финального свистка здесь появятся оценки болельщиков.':'Поставьте первую оценку и начните обсуждение матча.'}</span></div>`;
    const difference=ownRating&&hasAverage?Number(ownRating.match_rating)-averageValue:null;
    const differenceLabel=difference===null?'Сравнение появится после публичных оценок':Math.abs(difference)<0.05?'Вы совпали с мнением сообщества':difference>0?'Вы оценили матч выше сообщества':'Вы оценили матч ниже сообщества';
    const differenceValue=difference===null?'—':`${difference>0?'+':''}${difference.toFixed(1)}`;
    const ownRatingMarkup=ownRating?`<section class="md-rating-comparison" aria-label="Сравнение оценок">
      <div class="md-comparison-copy"><span class="section-kicker">Ваш вердикт${ownRating.is_public===false?' · приватный':''}</span><strong>${esc(differenceLabel)}</strong></div>
      <div class="md-comparison-values">
        <div><span>Ваша оценка</span><b>${ownRating.match_rating}</b></div>
        <div><span>Сообщество</span><b>${average}</b></div>
        <div><span>Разница</span><b class="${difference===null||Math.abs(difference)<0.05?'neutral':difference>0?'positive':'negative'}">${differenceValue}</b></div>
      </div>
    </section>`:'';
    const distributionMarkup=ratingCount
      ?`<div class="rdist">${distribution.map(item=>`<div class="rd-row"><div class="rd-l">${item.score}</div><div class="rd-bar"><div class="rd-fill" style="width:${item.count?Math.round(item.count/maxDistribution*100):0}%"></div></div><div class="rd-c">${item.count}</div></div>`).join('')}</div>`
      :'<div class="empty-state compact"><strong>Недостаточно данных</strong><span>Распределение появится после первой публичной оценки.</span></div>';

    target.innerHTML=`
      <section class="md-hero">
        <div class="md-lg"><span>${esc(match.league_name)}</span><b class="md-status md-status-${esc(match.status)}">${esc(statusLabel)}</b></div>
        <div class="md-sl">
          <div class="md-team"><span class="md-team-mark" aria-hidden="true">${esc(teamMonogram(match.home_team_name))}</span>${match.home_club_id?`<button class="md-tname md-club-link" type="button" onclick="go('club',{id:${Number(match.home_club_id)}})">${esc(match.home_team_name)}</button>`:`<div class="md-tname">${esc(match.home_team_name)}</div>`}<div class="md-score">${esc(match.home_score??'—')}</div></div>
          <div class="md-vs">VS</div>
          <div class="md-team"><span class="md-team-mark" aria-hidden="true">${esc(teamMonogram(match.away_team_name))}</span>${match.away_club_id?`<button class="md-tname md-club-link" type="button" onclick="go('club',{id:${Number(match.away_club_id)}})">${esc(match.away_team_name)}</button>`:`<div class="md-tname">${esc(match.away_team_name)}</div>`}<div class="md-score">${esc(match.away_score??'—')}</div></div>
        </div>
        <div class="md-meta">${ico('calendar',12)} ${new Date(match.match_date).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}${competitionMeta?`<span>·</span>${esc(competitionMeta)}`:''}</div>
        ${communityMarkup}
      </section>
      ${prediction}
      <div class="md-actions">
        ${match.status==='finished'?`<button class="btn btn-l md-primary-action" onclick="openRate(${match.id})">${ico('star',16)} ${ownRating?'Изменить оценку':'Оценить матч'}</button>`:''}
        <button class="btn btn-g" onclick="go('chat',{mid:${match.id},title:'Чат матча'})">${ico('chat',14)} Чат матча</button>
        <button class="btn btn-g" onclick="copyAppLink('/match/${match.id}','Ссылка на матч')">${ico('link',14)} Ссылка</button>
      </div>
      ${ownRatingMarkup}
      <div class="md-grid">
        <div>
          <section class="mdcard"><div class="mdcard-title">Топ игроков</div>${topPlayers.length?topPlayers.map((player,index)=>`<button class="pr-row pr-row-link" type="button" onclick="go('player',{id:${Number(player.player_id)}})"><span class="pr-rank">${index+1}</span><span class="pr-info"><span class="pr-name">${esc(player.name)}</span><span class="pr-team">${esc(player.team)} · ${Number(player.rating_count)||0} оценок${Number(player.best_votes)?` · ${Number(player.best_votes)} выборов лучшим`:''}</span></span><span class="pr-r"><span class="pr-bar"><span class="pr-fill" style="width:${Number(player.average)*10}%"></span></span><span class="pr-val">${Number(player.average).toFixed(1)}</span></span></button>`).join(''):'<div class="empty-state compact"><strong>Оценок игроков пока нет</strong><span>Они появятся, когда болельщики оценят составы.</span></div>'}</section>
          <section class="mdcard"><div class="mdcard-title">Оценки болельщиков</div>${ratings?.length?ratings.slice(0,8).map(rating=>{const user=userMap[rating.user_id]||{};return`<div class="rh-row"><div><button class="text-link rh-m" onclick="go('profile',{uid:'${rating.user_id}'})">${esc(user.username||'Аноним')}</button><div class="rh-l">@${esc(user.username||'user')}${rating.comment?' · '+esc(rating.comment.substring(0,50)):''}</div></div><div class="rh-r"><div class="rh-bar"><div class="rh-fill" style="width:${(rating.match_rating||0)*10}%"></div></div><div class="rh-v">${rating.match_rating}/10</div></div></div>`;}).join(''):`<div class="empty-state compact"><strong>${match.status==='finished'?'Оценок пока нет':'Обсуждение начнётся после матча'}</strong><span>${match.status==='finished'?'Сформируйте первое мнение о матче.':'Здесь появятся оценки болельщиков.'}</span>${match.status==='finished'?`<button class="btn btn-g btn-sm" type="button" onclick="openRate(${match.id})">Оценить первым</button>`:''}</div>`}</section>
        </div>
        <section class="mdcard"><div class="mdcard-title">Распределение оценок</div>${distributionMarkup}</section>
      </div>`;

    if(match.status==='scheduled'&&CU)loadPrediction(match.id,document.getElementById(`pred-${match.id}`));
  }catch(error){
    console.error('Match detail error:',error);
    target.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><strong>Не удалось открыть матч</strong><button class="btn btn-g btn-sm" onclick="loadMD('+Number(id)+')">Повторить</button></div>';
  }
}

async function loadPrediction(matchId,container){
  if(!CU||!container)return;
  const{data:prediction,error}=await sb.from('predictions').select('home_pred,away_pred').eq('user_id',CU.id).eq('match_id',matchId).maybeSingle();
  if(error){console.warn('Prediction load error:',error);return;}
  if(!prediction)return;
  container.querySelector('.pred-input[data-side="home"]').value=prediction.home_pred??'';
  container.querySelector('.pred-input[data-side="away"]').value=prediction.away_pred??'';
  const button=container.querySelector('.pred-btn');
  if(button)button.innerHTML=ico('save',13)+' Обновить прогноз';
}

async function savePrediction(matchId,button){
  if(!CU){openAuth();return;}
  const container=button.closest('.pred-wrap');
  const home=Number.parseInt(container.querySelector('.pred-input[data-side="home"]').value,10);
  const away=Number.parseInt(container.querySelector('.pred-input[data-side="away"]').value,10);
  if(!Number.isInteger(home)||!Number.isInteger(away)||home<0||away<0||home>20||away>20){toast('Введите корректный счёт','err');return;}
  button.disabled=true;
  button.textContent='Сохраняем...';
  try{
    const{error}=await sb.from('predictions').upsert({user_id:CU.id,match_id:matchId,home_pred:home,away_pred:away},{onConflict:'user_id,match_id'});
    if(error)throw error;
    button.innerHTML=ico('save',13)+' Прогноз сохранён';
    toast('Прогноз сохранён','ok');
  }catch(error){
    console.error('Prediction save error:',error);
    button.textContent='Повторить';
    toast('Не удалось сохранить прогноз','err');
  }finally{
    button.disabled=false;
  }
}

function renderPredBlock(match){
  return`<div class="pred-wrap" id="pred-${match.id}">
    <div class="pred-teams"><span>${esc(match.home_team_name)}</span><span>${esc(match.away_team_name)}</span></div>
    <div class="pred-row">
      <label class="sr-only" for="pred-home-${match.id}">Голы ${esc(match.home_team_name)}</label>
      <input class="pred-input" id="pred-home-${match.id}" data-side="home" inputmode="numeric" type="number" min="0" max="20" placeholder="—">
      <span class="pred-vs">:</span>
      <label class="sr-only" for="pred-away-${match.id}">Голы ${esc(match.away_team_name)}</label>
      <input class="pred-input" id="pred-away-${match.id}" data-side="away" inputmode="numeric" type="number" min="0" max="20" placeholder="—">
    </div>
    <button class="pred-btn" onclick="savePrediction(${match.id},this)">${ico('save',13)} ${CU?'Сохранить прогноз':'Войти и сохранить'}</button>
  </div>`;
}

function renderPredResult(prediction,match){
  if(!prediction||match.status!=='finished')return'';
  const exact=prediction.home_pred===match.home_score&&prediction.away_pred===match.away_score;
  const predictedDifference=prediction.home_pred-prediction.away_pred;
  const realDifference=match.home_score-match.away_score;
  const rightOutcome=(predictedDifference>0&&realDifference>0)||(predictedDifference<0&&realDifference<0)||(predictedDifference===0&&realDifference===0);
  if(exact)return'<div class="pred-result correct">Точный счёт · 3 очка</div>';
  if(rightOutcome)return'<div class="pred-result close">Верный исход · 1 очко</div>';
  return'<div class="pred-result wrong">Прогноз не сыграл</div>';
}
