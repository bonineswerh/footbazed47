const MATCH_PAGE_SIZE=24;
let matchCatalog=[];
let filteredMatches=[];
let visibleMatchCount=matchPageSize();

function matchPageSize(){
  return window.matchMedia('(max-width: 900px)').matches?12:MATCH_PAGE_SIZE;
}

function isDerby(home,away){
  return DERBY.some(item=>(item.h===home&&item.a===away)||(item.h===away&&item.a===home));
}

function fmtDate(value){
  return new Date(value).toLocaleDateString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}

function sortMatches(items){
  const now=Date.now();
  return [...items].sort((a,b)=>{
    const rank={live:0,scheduled:1,finished:2};
    const statusDiff=(rank[a.status]??3)-(rank[b.status]??3);
    if(statusDiff)return statusDiff;
    const aTime=new Date(a.match_date).getTime()||0;
    const bTime=new Date(b.match_date).getTime()||0;
    if(a.status==='finished')return bTime-aTime;
    if(a.status==='scheduled'){
      const aPast=aTime<now?1:0,bPast=bTime<now?1:0;
      return aPast-bPast||aTime-bTime;
    }
    return aTime-bTime;
  });
}

async function fetchMatchCatalog(force=false){
  if(matchCatalog.length&&!force)return matchCatalog;
  const cached=!force&&getCache('matches',CACHE_TTL.matches);
  if(cached?.length){matchCatalog=sortMatches(cached);return matchCatalog;}
  const{data,error}=await sb.from('matches').select(MATCH_FIELDS).order('match_date',{ascending:false}).limit(1000);
  if(error)throw error;
  matchCatalog=sortMatches(data||[]);
  setCache('matches',matchCatalog);
  return matchCatalog;
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
    const items=featuredMatches(await fetchMatchCatalog());
    target.innerHTML=items.length?items.map(renderMCard).join(''):'<div class="empty-state"><div class="empty-icon">🏟️</div><strong>Матчей пока нет</strong><span>Новые встречи появятся после обновления календаря.</span></div>';
  }catch(error){
    console.warn('loadHomeM:',error);
    target.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><strong>Не удалось загрузить матчи</strong><button class="btn btn-g btn-sm" onclick="loadHomeM()">Повторить</button></div>';
  }
}

function applyMatchFilters(){
  const query=document.getElementById('msearch')?.value?.trim().toLocaleLowerCase('ru-RU')||'';
  filteredMatches=matchCatalog.filter(match=>{
    const matchesSearch=!query||String(match.home_team_name||'').toLocaleLowerCase('ru-RU').includes(query)||String(match.away_team_name||'').toLocaleLowerCase('ru-RU').includes(query);
    const matchesStatus=MF==='all'||match.status===MF;
    const matchesLeague=ML==='all'||match.league_name===ML;
    return matchesSearch&&matchesStatus&&matchesLeague;
  });
}

function renderLeagueTabs(){
  const leagues=[...new Set(matchCatalog.map(match=>match.league_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
  const target=document.getElementById('leagueTabs');
  if(!target)return;
  target.innerHTML=`<button class="league-tab${ML==='all'?' on':''}" onclick="setLeague('all',this)">Все лиги</button>`+
    leagues.map(league=>`<button class="league-tab${ML===league?' on':''}" onclick="setLeague(${jsStr(league)},this)">${esc(league)}</button>`).join('');
}

function matchCountLabel(count){
  const mod10=count%10,mod100=count%100;
  if(mod10===1&&mod100!==11)return'матч';
  if(mod10>=2&&mod10<=4&&(mod100<12||mod100>14))return'матча';
  return'матчей';
}

function renderMatchResults(){
  applyMatchFilters();
  const target=document.getElementById('matchG');
  if(!target)return;
  if(!filteredMatches.length){
    target.innerHTML='<div class="empty-state"><div class="empty-icon">⌕</div><strong>Ничего не найдено</strong><span>Измени команду, лигу или статус матча.</span></div>';
    return;
  }

  const visible=filteredMatches.slice(0,visibleMatchCount);
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

  const shown=visible.length,total=filteredMatches.length;
  target.innerHTML=`<div class="match-results-summary"><span>Показано ${shown} из ${total}</span><span>${ML==='all'?'Все лиги':esc(ML)}</span></div>${content}${shown<total?`<div class="load-more-wrap"><button class="btn btn-g load-more" onclick="loadMoreMatches()">Показать ещё <span>${Math.min(matchPageSize(),total-shown)}</span></button></div>`:''}`;
}

async function loadM(reset=true){
  const target=document.getElementById('matchG');
  if(!target)return;
  if(reset)visibleMatchCount=matchPageSize();
  target.innerHTML='<div class="loading"><div class="spin"></div><span>Загружаем календарь</span></div>';
  try{
    await fetchMatchCatalog();
    renderLeagueTabs();
    renderMatchResults();
  }catch(error){
    console.error('Matches error:',error);
    target.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><strong>Календарь временно недоступен</strong><span>Проверь соединение и попробуй ещё раз.</span><button class="btn btn-g btn-sm" onclick="loadM(true)">Повторить</button></div>';
  }
}

function loadMoreMatches(){
  visibleMatchCount+=matchPageSize();
  renderMatchResults();
}

function setLeague(league,button){
  ML=league;
  visibleMatchCount=matchPageSize();
  document.querySelectorAll('.league-tab').forEach(item=>item.classList.remove('on'));
  button?.classList.add('on');
  renderMatchResults();
}

function filterM(){
  clearTimeout(window._ft);
  window._ft=setTimeout(()=>{visibleMatchCount=matchPageSize();renderMatchResults();},220);
}

function setMF(filter,button){
  MF=filter;
  visibleMatchCount=matchPageSize();
  document.querySelectorAll('#mf .btn').forEach(item=>{item.className='btn btn-g btn-sm';item.setAttribute('aria-pressed','false');});
  button.className='btn btn-l btn-sm';
  button.setAttribute('aria-pressed','true');
  renderMatchResults();
}

async function loadMD(id){
  if(!id)return;
  const target=document.getElementById('mdC');
  target.innerHTML='<div class="loading"><div class="spin"></div><span>Загружаем матч</span></div>';
  try{
    const[{data:match,error:matchError},{data:ratings,error:ratingsError},{data:playerRatings,error:playersError}]=await Promise.all([
      sb.from('matches').select(MATCH_FIELDS).eq('id',id).single(),
      sb.from('ratings').select(RATING_FIELDS).eq('match_id',id).eq('is_public',true).order('created_at',{ascending:false}).limit(200),
      sb.from('player_ratings').select('player_id,rating').eq('match_id',id).order('rating',{ascending:false}).limit(1000)
    ]);
    if(matchError)throw matchError;
    if(ratingsError)throw ratingsError;
    if(playersError)throw playersError;
    if(!match){target.innerHTML='<div class="empty-state"><strong>Матч не найден</strong></div>';return;}

    const userIds=[...new Set((ratings||[]).map(rating=>rating.user_id))];
    const playerIds=[...new Set((playerRatings||[]).map(rating=>rating.player_id))];
    const[{data:users},{data:players}]=await Promise.all([
      userIds.length?sb.from('users').select('id,display_name,username,avatar_url').in('id',userIds):Promise.resolve({data:[]}),
      playerIds.length?sb.from('players').select('id,name,team,position').in('id',playerIds):Promise.resolve({data:[]})
    ]);
    const userMap={};(users||[]).forEach(user=>{userMap[user.id]=user;});
    const playerMap={};(players||[]).forEach(player=>{playerMap[player.id]=player;});
    const average=ratings?.length?(ratings.reduce((sum,rating)=>sum+(rating.match_rating||0),0)/ratings.length).toFixed(1):'—';
    const distribution=Array.from({length:10},(_,index)=>10-index).map(score=>({score,count:ratings?.filter(rating=>rating.match_rating===score).length||0}));
    const maxDistribution=Math.max(...distribution.map(item=>item.count),1);
    const playerAggregate={};
    (playerRatings||[]).forEach(item=>{
      const player=playerMap[item.player_id];
      if(!playerAggregate[item.player_id])playerAggregate[item.player_id]={name:player?.name||'Игрок',team:player?.team||'',total:0,count:0};
      playerAggregate[item.player_id].total+=item.rating;
      playerAggregate[item.player_id].count++;
    });
    const topPlayers=Object.values(playerAggregate).map(player=>({...player,average:(player.total/player.count).toFixed(1)})).sort((a,b)=>b.average-a.average).slice(0,10);
    const statusLabel={live:'LIVE',finished:'Завершён',scheduled:'Предстоит'}[match.status]||match.status;
    const prediction=match.status==='scheduled'?`<section class="md-prediction"><div class="mdcard-title">${ico('target',15)} Прогноз на матч</div>${renderPredBlock(match)}</section>`:'';

    target.innerHTML=`
      <section class="md-hero">
        <div class="md-lg">${esc(match.league_name)} · ${esc(statusLabel)}</div>
        <div class="md-sl">
          <div class="md-team"><div class="md-tname">${esc(match.home_team_name)}</div><div class="md-score">${esc(match.home_score??'—')}</div></div>
          <div class="md-vs">VS</div>
          <div class="md-team"><div class="md-tname">${esc(match.away_team_name)}</div><div class="md-score">${esc(match.away_score??'—')}</div></div>
        </div>
        <div class="md-meta">${ico('calendar',12)} ${new Date(match.match_date).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}</div>
        <div class="md-comm">
          <div class="md-ci"><div class="md-cv">${average}</div><div class="md-cl">Средняя оценка</div></div>
          <div class="md-ci"><div class="md-cv">${ratings?.length||0}</div><div class="md-cl">Оценок</div></div>
          <div class="md-ci"><div class="md-cv md-cv-player">${esc(topPlayers[0]?.name||'—')}</div><div class="md-cl">Лучший игрок</div></div>
        </div>
      </section>
      ${prediction}
      <div class="md-actions">
        ${match.status==='finished'?`<button class="btn btn-l" onclick="openRate(${match.id})">${ico('star',14)} Оценить матч</button>`:''}
        <button class="btn btn-g" onclick="go('chat',{mid:${match.id},title:'Чат матча'})">${ico('chat',14)} Обсуждение</button>
        <button class="btn btn-g" onclick="copyAppLink('#match/${match.id}','Ссылка на матч')">${ico('link',14)} Ссылка</button>
      </div>
      <div class="md-grid">
        <div>
          <section class="mdcard"><div class="mdcard-title">Топ игроков</div>${topPlayers.length?topPlayers.map((player,index)=>`<div class="pr-row"><div class="pr-rank">${index+1}</div><div class="pr-info"><div class="pr-name">${esc(player.name)}</div><div class="pr-team">${esc(player.team)}</div></div><div class="pr-r"><div class="pr-bar"><div class="pr-fill" style="width:${Number(player.average)*10}%"></div></div><div class="pr-val">${player.average}</div></div></div>`).join(''):'<div class="empty-state compact"><strong>Оценок игроков пока нет</strong></div>'}</section>
          <section class="mdcard"><div class="mdcard-title">Оценки болельщиков</div>${ratings?.length?ratings.slice(0,8).map(rating=>{const user=userMap[rating.user_id]||{};return`<div class="rh-row"><div><button class="text-link rh-m" onclick="go('profile',{uid:'${rating.user_id}'})">${esc(user.username||'Аноним')}</button><div class="rh-l">@${esc(user.username||'user')}${rating.comment?' · '+esc(rating.comment.substring(0,50)):''}</div></div><div class="rh-r"><div class="rh-bar"><div class="rh-fill" style="width:${(rating.match_rating||0)*10}%"></div></div><div class="rh-v">${rating.match_rating}/10</div></div></div>`;}).join(''):'<div class="empty-state compact"><strong>Будь первым, кто оценит матч</strong></div>'}</section>
        </div>
        <section class="mdcard"><div class="mdcard-title">Распределение оценок</div><div class="rdist">${distribution.map(item=>`<div class="rd-row"><div class="rd-l">${item.score}</div><div class="rd-bar"><div class="rd-fill" style="width:${item.count?Math.round(item.count/maxDistribution*100):0}%"></div></div><div class="rd-c">${item.count}</div></div>`).join('')}</div></section>
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
