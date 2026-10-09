const MATCH_PAGE_SIZE=24;
let matchCatalog=[];
let matchLeagues=[];
let matchTotal=0;
let matchHasMore=false;
let matchNextOffset=0;
let matchLoading=false;
let matchRequestId=0;
let activeMatchRatingSegments=null;
let matchDetailRequest=0;

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

function matchClubMark(match,side,className,loading='lazy'){
  const name=match[`${side}_team_name`]||'Клуб';
  return window.FBZMedia.visual({entity:{...match[`${side}_club`],name},kind:'club',className,loading,fallbackText:teamMonogram(name)});
}

function matchRatingSegmentLabel(segment,match){
  return{all:'Все зрители',home:`Болельщики ${match.home_team_name}`,away:`Болельщики ${match.away_team_name}`,neutral:'Нейтральные зрители'}[segment]||'Все зрители';
}

function matchDistributionMarkup(segment){
  const distribution=Array.isArray(segment?.distribution)?segment.distribution:Array.from({length:10},(_,index)=>({score:10-index,count:0}));
  const max=Math.max(...distribution.map(item=>Number(item.count)||0),1);
  if(!Number(segment?.rating_count))return'<div class="empty-state compact"><strong>В этом сегменте пока нет оценок</strong><span>Показатель появится после первого публичного голоса.</span></div>';
  return`<div class="rdist">${distribution.map(item=>`<div class="rd-row" data-tone="${window.FBZDomain.ratingTone(item.score)}"><div class="rd-l">${item.score}</div><div class="rd-bar"><div class="rd-fill" style="width:${item.count?Math.round(item.count/max*100):0}%"></div></div><div class="rd-c">${item.count}</div></div>`).join('')}</div>`;
}

function setMatchRatingSegment(segment,button){
  const data=activeMatchRatingSegments?.segments?.[segment];
  if(!data)return;
  activeMatchRatingSegments.active=segment;
  document.querySelectorAll('.md-segment').forEach(item=>{
    const active=item===button||item.dataset.segment===segment;
    item.classList.toggle('on',active);
    item.setAttribute('aria-pressed',String(active));
  });
  const average=document.getElementById('mdCommunityAverage');
  const count=document.getElementById('mdCommunityCount');
  const label=document.getElementById('mdCommunityLabel');
  const distribution=document.getElementById('mdDistribution');
  if(average){
    const value=Number(data.rating_count)&&Number.isFinite(Number(data.average))?Number(data.average):null;
    average.textContent=value===null?'—':value.toFixed(1);
    average.dataset.tone=value===null?'':window.FBZDomain.ratingTone(value);
  }
  if(count)count.textContent=Number(data.rating_count)||0;
  if(label)label.textContent=matchRatingSegmentLabel(segment,activeMatchRatingSegments.match);
  if(distribution)distribution.innerHTML=matchDistributionMarkup(data);
}

function sortMatches(items){
  return window.FBZDomain.sortMatches(items);
}

async function fetchMatchPage({offset=0,limit=matchPageSize(),force=false}={}){
  return (window.FBZMatchCalendar?.active()?window.FBZMatchCalendar.getPage:window.FBZData.getMatchesPage)({
    status:MF,
    league:ML,
    query:document.getElementById('msearch')?.value||'',
    limit,
    offset,
    force
  });
}

function renderMCard(match){
  const presentation=FBZDomain.matchScorePresentation(match);
  const statusClass={live:'t-live',finished:'t-fin',scheduled:'t-sched'}[match.status]||'';
  const derby=isDerby(match.home_team_name,match.away_team_name);
  return`<article class="mcard mcard--${['live','finished','scheduled'].includes(match.status)?match.status:'other'}${derby?' derby':''}" style="${FBZDomain.matchPaletteStyle(match)}">
    <div class="mcard-body">
      <div class="mc-t">
        <span class="mc-lg">${esc(FBZNames.competition(match.league_name))}</span>
        <div class="mc-tags">${derby?`<span class="tag t-derby">${ico('fire',12)} Дерби</span>`:''}<span class="tag ${statusClass}">${esc(presentation.status)}</span></div>
      </div>
      <a class="mc-score-block mc-score-link" href="${esc(FBZLocale.path(`/match/${Number(match.id)}`))}" aria-label="Открыть матч: ${esc(FBZNames.club(match.home_team_name))} против ${esc(FBZNames.club(match.away_team_name))}" ${FBZActions.attrs("matches.go-md",[match.id])}>
        <span class="mc-score-team">${matchClubMark(match,'home','mc-score-mark')}<span class="mc-score-name">${esc(FBZDomain.matchTeamName(match,'home'))}</span></span>
        <span class="mc-score-result"><span class="mc-score-num">${presentation.home}<span class="mc-score-separator">:</span>${presentation.away}</span><span class="mc-score-vs">${presentation.label}</span></span>
        <span class="mc-score-team">${matchClubMark(match,'away','mc-score-mark')}<span class="mc-score-name">${esc(FBZDomain.matchTeamName(match,'away'))}</span></span>
      </a>
      <div class="mc-bottom">
        <span class="mc-meta-date">${ico('calendar',12)} ${fmtDate(match.match_date)}</span>
        <span class="mc-open-hint" aria-hidden="true">Подробнее <span>↗</span></span>
        <div class="mc-acts">
          ${match.status==='finished'||(match.status==='scheduled'&&Date.parse(match.match_date)>Date.now())?`<button class="mbtn lime" type="button" ${FBZActions.attrs("matches.open-rate",[match.id,match.status==='scheduled'?'expectation':'rating'])}>${ico('star',14)} ${match.status==='scheduled'?'Ожидание':'Оценить'}</button>`:''}
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
    window.FBZHome?.spotlight(page?.items||[]);
    window.FBZHome?.leagues(page?.leagues||[]);
    target.innerHTML=items.length?items.map(renderMCard).join(''):'<div class="empty-state"><div class="empty-icon">🏟️</div><strong>Матчей пока нет</strong><span>Новые встречи появятся после обновления календаря.</span></div>';
  }catch(error){
    console.warn('loadHomeM:',error);
    window.FBZHome?.spotlight([],true);
    target.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><strong>Не удалось загрузить матчи</strong><button class="btn btn-g btn-sm" data-fbz-click="matches.load-home-m">Повторить</button></div>';
  }
}

function renderLeagueTabs(){
  const target=document.getElementById('leagueTabs');
  if(!target)return;
  target.innerHTML=`<button type="button" class="league-tab${ML==='all'?' on':''}" aria-pressed="${ML==='all'}" data-fbz-click="shell.set-league-all">Все лиги</button>`+
    matchLeagues.map(league=>`<button type="button" class="league-tab${ML===league?' on':''}" aria-pressed="${ML===league}" ${FBZActions.attrs("matches.set-league",[league])}>${esc(FBZNames.competition(league))}</button>`).join('');
}

function matchCountLabel(count){
  if(FBZLocale.language==='en')return count===1?'match':'matches';
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
      <div class="league-group-hd"><h2 class="league-group-name">${esc(FBZNames.competition(league))}</h2><span class="league-group-count">${matches.length} ${matchCountLabel(matches.length)}</span></div>
      <div class="grid3">${matches.map(renderMCard).join('')}</div>
    </section>`).join('');
  }else{
    content=`<div class="grid3">${visible.map(renderMCard).join('')}</div>`;
  }

  const shown=visible.length,total=matchTotal;
  target.innerHTML=`<div class="match-results-summary"><span>Показано ${shown} из ${total}</span><span>${ML==='all'?'Все лиги':esc(FBZNames.competition(ML))}</span></div>${content}${matchHasMore?`<div class="load-more-wrap"><button class="btn btn-g load-more" type="button" data-fbz-click="matches.load-more-matches">Показать ещё <span>${Math.min(matchPageSize(),Math.max(total-shown,0))}</span></button></div>`:''}`;
}

async function loadM(reset=true){
  const target=document.getElementById('matchG');
  if(!target)return;
  const requestId=++matchRequestId;
  const route=routeVersion,user=CU?.id||null;
  const current=()=>requestId===matchRequestId&&route===routeVersion&&CP==='matches'&&(CU?.id||null)===user;
  matchLoading=true;
  target.setAttribute('aria-busy','true');
  target.innerHTML='<div class="loading"><div class="spin"></div><span>Загружаем календарь</span></div>';
  try{
    await FBZFeatures.load({key:'calendar-model',script:'js/calendar-model.js?v=20261009-controls',ready:()=>window.FBZCalendarModel});
    const calendar=await FBZFeatures.load({key:'match-calendar',styleId:'calendarStyles',style:'css/calendar.css?v=20261009-controls',script:'js/match-calendar.js?v=20261009-controls',ready:()=>window.FBZMatchCalendar});
    if(!current())return;
    calendar.mount();
    const page=await fetchMatchPage({offset:0,force:reset});
    if(!current())return;
    matchCatalog=Array.isArray(page?.items)?page.items:[];
    matchLeagues=Array.isArray(page?.leagues)?page.leagues:[];
    matchTotal=Number(page?.total)||0;
    matchHasMore=Boolean(page?.has_more);
    matchNextOffset=Number(page?.next_offset)||matchCatalog.length;
    renderLeagueTabs();
    renderMatchResults();
    if(!matchCatalog.length&&calendar.active())target.innerHTML=calendar.empty(page);
  }catch(error){
    if(!current())return;
    if(error.message==='calendar_auth_required'){
      target.innerHTML='<div class="empty-state"><strong>Войдите, чтобы увидеть матчи любимых клубов</strong><button class="btn btn-l" data-fbz-click="shell.open-auth">Войти</button></div>';return;
    }
    console.error('Matches error:',error);
    target.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><strong>Календарь временно недоступен</strong><span>Проверь соединение и попробуй ещё раз.</span><button class="btn btn-g btn-sm" data-fbz-click="matches.load-m">Повторить</button></div>';
  }finally{
    if(requestId===matchRequestId){matchLoading=false;target.setAttribute('aria-busy','false');}
  }
}

async function loadMoreMatches(){
  if(matchLoading||!matchHasMore)return;
  const requestId=matchRequestId;
  const route=routeVersion,user=CU?.id||null;
  const current=()=>requestId===matchRequestId&&route===routeVersion&&CP==='matches'&&(CU?.id||null)===user;
  matchLoading=true;
  const button=document.querySelector('.load-more');
  if(button){button.disabled=true;button.textContent='Загружаем...';}
  try{
    const page=await fetchMatchPage({offset:matchNextOffset});
    if(!current())return;
    const knownIds=new Set(matchCatalog.map(match=>String(match.id)));
    for(const match of page?.items||[])if(!knownIds.has(String(match.id))){matchCatalog.push(match);knownIds.add(String(match.id));}
    matchTotal=Number(page?.total)||matchTotal;
    matchHasMore=Boolean(page?.has_more);
    matchNextOffset=Number(page?.next_offset)||matchCatalog.length;
    renderMatchResults();
  }catch(error){
    if(!current())return;
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
  const request=++matchDetailRequest;
  const userId=CU?.id||null;
  const isCurrent=()=>request===matchDetailRequest&&CP==='md'&&Number(mdID)===Number(id)&&(CU?.id||null)===userId;
  const target=document.getElementById('mdC');
  activeMatchRatingSegments=null;
  target.setAttribute('aria-busy','true');
  target.innerHTML='<div class="loading" role="status"><div class="spin"></div><span>Загружаем матч</span></div>';
  try{
    const ownRatingRequest=userId
      ?sb.from('ratings').select('match_rating,comment,is_public,supporter_side,updated_at').eq('user_id',userId).eq('match_id',id).maybeSingle()
      :Promise.resolve({data:null,error:null});
    const[{data:match,error:matchError},{data:ratings,error:ratingsError},{data:insights,error:insightsError},{data:ownRating,error:ownRatingError}]=await Promise.all([
      sb.from('matches').select(MATCH_FIELDS).eq('id',id).single(),
      sb.from('ratings').select(RATING_FIELDS).eq('match_id',id).eq('is_public',true).order('created_at',{ascending:false}).limit(8),
      sb.rpc('get_match_insights',{p_match_id:Number(id)}),
      ownRatingRequest
    ]);
    if(!isCurrent())return;
    if(matchError)throw matchError;
    if(ratingsError)throw ratingsError;
    if(insightsError)throw insightsError;
    if(ownRatingError)throw ownRatingError;
    if(!match){target.innerHTML='<div class="empty-state"><strong>Матч не найден</strong></div>';return;}
    await window.FBZData.enrichMatchMedia([match]);
    if(!isCurrent())return;

    const userIds=[...new Set((ratings||[]).map(rating=>rating.user_id))];
    const{data:users}=userIds.length
      ?await sb.from('users').select('id,display_name,username,avatar_url').in('id',userIds)
      :{data:[]};
    if(!isCurrent())return;
    window.FBZSEO?.match(match);
    const userMap={};(users||[]).forEach(user=>{userMap[user.id]=user;});
    const ratingCount=Number(insights?.rating_count||0);
    const averageValue=Number(insights?.average);
    const hasAverage=ratingCount>0&&Number.isFinite(averageValue);
    const average=hasAverage?averageValue.toFixed(1):'—';
    const segments=insights?.segments&&typeof insights.segments==='object'?insights.segments:{all:{rating_count:ratingCount,average:insights?.average,distribution:insights?.distribution||[]}};
    activeMatchRatingSegments={segments,match,active:'all'};
    const topPlayers=Array.isArray(insights?.top_players)?insights.top_players:[];
    const statusLabel={live:'LIVE',finished:'Завершён',scheduled:'Предстоит'}[match.status]||match.status;
    const presentation=FBZDomain.matchScorePresentation(match);
    const competitionMeta=[match.season?`Сезон ${match.season}`:'',match.matchday?(FBZLocale.language==='en'?`Matchweek ${match.matchday}`:`${match.matchday}-й тур`):''].filter(Boolean).join(' · ');
    const segmentControls=ratingCount?`<div class="md-segments" role="group" aria-label="Чьи оценки показать">
      ${[['all','Все'],['home',FBZNames.club(match.home_team_name)],['neutral','Нейтральные'],['away',FBZNames.club(match.away_team_name)]].map(([key,label])=>{const value=segments[key]||{};const segmentAverage=Number(value.average);const segmentHasAverage=Number(value.rating_count)>0&&Number.isFinite(segmentAverage);return`<button class="md-segment${key==='all'?' on':''}" type="button" data-segment="${key}" aria-pressed="${key==='all'}" ${FBZActions.attrs("matches.set-match-rating-segment",[key])}><span>${esc(label)}</span><b data-tone="${segmentHasAverage?window.FBZDomain.ratingTone(segmentAverage):''}">${segmentHasAverage?segmentAverage.toFixed(1):'—'}</b><small>${Number(value.rating_count)||0}</small></button>`;}).join('')}
    </div>`:'';
    const communityMarkup=ratingCount?`<div class="md-comm">
      <div class="md-ci"><div class="md-cv" id="mdCommunityAverage" data-tone="${hasAverage?window.FBZDomain.ratingTone(averageValue):''}">${average}</div><div class="md-cl" id="mdCommunityLabel">Все зрители</div></div>
      <div class="md-ci"><div class="md-cv" id="mdCommunityCount">${ratingCount}</div><div class="md-cl">Публичных оценок</div></div>
      <div class="md-ci"><div class="md-cv md-cv-player">${esc(topPlayers[0]?.name||'—')}</div><div class="md-cl">Выбор болельщиков${Number(topPlayers[0]?.unverified_rating_count)>0?' · участие не подтверждено':''}</div></div>
    </div>${segmentControls}`:`<div class="md-community-empty"><strong>${match.status==='scheduled'?'Оценки откроются после матча':'Мнение сообщества ещё не сформировано'}</strong><span>${match.status==='scheduled'?'После финального свистка здесь появятся оценки болельщиков.':'Поставьте первую оценку и начните обсуждение матча.'}</span></div>`;
    const ownRatingMarkup=ownRating?`<section class="md-own-rating" aria-label="Ваша оценка"><span>Ваша оценка${ownRating.is_public===false?' · приватная':''}</span><strong class="rating-ink" data-tone="${FBZDomain.ratingTone(ownRating.match_rating)}">${Number(ownRating.match_rating)}<small>/10</small></strong></section>`:'';
    const distributionMarkup=matchDistributionMarkup(segments.all);

    target.innerHTML=`
      <section class="md-hero" style="${FBZDomain.matchPaletteStyle(match)}">
        <div class="md-lg"><span>${esc(FBZNames.competition(match.league_name))}</span><b class="md-status md-status-${esc(match.status)}">${esc(statusLabel)}</b></div>
        <div class="md-sl">
          <div class="md-team">${matchClubMark(match,'home','md-team-mark','eager')}${match.home_club_id?`<button class="md-tname md-club-link" type="button" ${FBZActions.attrs("matches.go-club",[Number(match.home_club_id)])}>${esc(FBZNames.club(match.home_team_name))}</button>`:`<div class="md-tname">${esc(FBZNames.club(match.home_team_name))}</div>`}<div class="md-score">${esc(presentation.home)}</div></div>
          <div class="md-vs">VS</div>
          <div class="md-team">${matchClubMark(match,'away','md-team-mark','eager')}${match.away_club_id?`<button class="md-tname md-club-link" type="button" ${FBZActions.attrs("matches.go-club",[Number(match.away_club_id)])}>${esc(FBZNames.club(match.away_team_name))}</button>`:`<div class="md-tname">${esc(FBZNames.club(match.away_team_name))}</div>`}<div class="md-score">${esc(presentation.away)}</div></div>
        </div>
        <div class="md-meta">${ico('calendar',12)} ${new Date(match.match_date).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}${competitionMeta?`<span>·</span>${esc(competitionMeta)}`:''}</div>
        ${match.status==='finished'?communityMarkup:''}
        ${match.status==='scheduled'?'<div id="mdExpectationSummary" aria-busy="true"></div>':''}
      </section>
      <div class="md-actions">
        ${match.status==='scheduled'&&Date.parse(match.match_date)>Date.now()?`<button class="btn btn-l md-primary-action" type="button" data-expectation-action ${FBZActions.attrs('matches.open-rate',[match.id,'expectation'])}>${ico('star',16)} Оценить ожидание</button>`:''}
        ${match.status==='finished'?`<button class="btn btn-l md-primary-action" ${FBZActions.attrs("matches.open-rate",[match.id])}>${ico('star',16)} ${ownRating?'Изменить оценку':'Оценить матч'}</button>`:''}
        <button class="btn btn-g" ${FBZActions.attrs("matches.copy-app-link",[match.id])}>${ico('link',14)} Ссылка</button>
      </div>
      <div id="mdExpectations" aria-busy="true"></div>
      ${ownRatingMarkup}
      <div class="md-grid" ${match.status!=='finished'?'hidden':''}>
        <div>
          <section class="mdcard"><div class="mdcard-title">Выбор болельщиков</div>${insights?.player_rating_scope==='confirmed_historical'&&Number(insights.unverified_player_rating_count)>0?`<p class="pr-evidence">Прежние оценки без подтверждения участия сохранены в истории игроков и не входят в этот выбор.</p>`:''}${topPlayers.length?topPlayers.map((player,index)=>{const presentation=window.FBZDomain.ratingPresentation(player.average,1);return`<button class="pr-row pr-row-link" data-tone="${presentation.tone}" type="button" ${FBZActions.attrs("matches.go-player",[Number(player.player_id)])}><span class="pr-rank">${index+1}</span><span class="pr-info"><span class="pr-name">${esc(player.name)}</span><span class="pr-team">${esc(FBZNames.club(player.team))} · ${FBZDomain.countLabel(Number(player.rating_count)||0,{one:'оценка',few:'оценки',many:'оценок'})}${Number(player.best_votes)?` · ${FBZDomain.countLabel(Number(player.best_votes),{one:'голос за лучшего игрока',few:'голоса за лучшего игрока',many:'голосов за лучшего игрока'})}`:''}</span>${Number(player.unverified_rating_count)>0?'<span class="pr-evidence">Участие в матче не подтверждено</span>':''}</span><span class="pr-r"><span class="pr-bar"><span class="pr-fill" style="width:${presentation.progress}%"></span></span><span class="pr-val">${presentation.value}<span class="score-denominator">/10</span></span></span></button>`;}).join(''):'<div class="empty-state compact"><strong>Оценок игроков пока нет</strong><span>Они появятся после оценок подтверждённых участников матча.</span></div>'}</section>
          <section class="mdcard"><div class="mdcard-title">Оценки болельщиков</div>${ratings?.length?ratings.slice(0,8).map(rating=>{const user=userMap[rating.user_id]||{};const sideLabel={home:FBZNames.club(match.home_team_name),away:FBZNames.club(match.away_team_name),neutral:'Нейтральный'}[rating.supporter_side]||'Нейтральный';return`<div class="rh-row"><div><button class="text-link rh-m" ${FBZActions.attrs("app.go-profile",[rating.user_id])}>${esc(user.username||'Аноним')}</button><div class="rh-l">@${esc(user.username||'user')} · ${esc(sideLabel)}${rating.comment?' · '+esc(rating.comment.substring(0,50)):''}</div></div><div class="rh-r"><div class="rh-bar"><div class="rh-fill" data-tone="${window.FBZDomain.ratingTone(rating.match_rating)}" style="width:${(rating.match_rating||0)*10}%"></div></div><div class="rh-v" data-tone="${window.FBZDomain.ratingTone(rating.match_rating)}">${rating.match_rating}<span class="score-denominator">/10</span></div></div></div>`;}).join(''):`<div class="empty-state compact"><strong>${match.status==='finished'?'Оценок пока нет':'Обсуждение начнётся после матча'}</strong><span>${match.status==='finished'?'Сформируйте первое мнение о матче.':'Здесь появятся оценки болельщиков.'}</span>${match.status==='finished'?`<button class="btn btn-g btn-sm" type="button" ${FBZActions.attrs("matches.open-rate",[match.id])}>Оценить первым</button>`:''}</div>`}</section>
        </div>
        <section class="mdcard"><div class="mdcard-title">Распределение оценок</div><div id="mdDistribution">${distributionMarkup}</div></section>
      </div>`;

    loadMatchExpectations(match,ownRating,isCurrent);
  }catch(error){
    if(!isCurrent())return;
    console.error('Match detail error:',error);
    target.innerHTML=`<div class="empty-state"><div class="empty-icon">⚠️</div><strong>Не удалось открыть матч</strong><button class="btn btn-g btn-sm" ${FBZActions.attrs('matches.retry-match',[Number(id)])}>Повторить</button></div>`;
  }finally{
    if(isCurrent())target.setAttribute('aria-busy','false');
  }
}

window.setMatchRatingSegment=setMatchRatingSegment;

function loadMatchExpectations(match,ownRating,isCurrent){
  FBZFeatures.load({key:'expectations',styleId:'expectationStyles',script:'js/match-expectations.js?v=20261009-controls',style:'css/expectations.css?v=20261008-sheets',ready:()=>window.FBZExpectations}).then(()=>{
    if(isCurrent())window.FBZExpectations.mount(match,ownRating);
  }).catch(()=>{
    if(!isCurrent())return;
    document.getElementById('mdExpectations').setAttribute('aria-busy','false');
    document.getElementById('mdExpectationSummary')?.setAttribute('aria-busy','false');
    document.getElementById('mdExpectations').innerHTML='<div class="empty-state compact"><strong>Не удалось загрузить ожидания</strong><button type="button" class="btn btn-g btn-sm" '+FBZActions.attrs('matches.retry-match',[match.id])+'>Повторить</button></div>';
  });
}

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "matches.retry-match":(event,element,[id])=>loadMD(id),
  "matches.go-md":(event,element,[id])=>FBZActions.follow(event,element,()=>go('md',{mid:id})),
  "matches.open-rate":(event,element,[id,mode])=>openRate(id,mode),
  "matches.load-home-m":()=>loadHomeM(),
  "matches.set-league":(event,element,[league])=>setLeague(league,element),
  "matches.load-more-matches":()=>loadMoreMatches(),
  "matches.load-m":()=>loadM(true),
  "matches.set-match-rating-segment":(event,element,[kind])=>setMatchRatingSegment(kind,element),
  "matches.go-club":(event,element,[id])=>go('club',{id:id}),
  "matches.copy-app-link":(event,element,[url])=>copyAppLink(("/match/"+url),'Ссылка на матч'),
  "matches.go-player":(event,element,[id])=>go('player',{id:id})
});
