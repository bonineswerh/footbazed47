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
const matchCardSnapshots=new Map();

function watchMatchCards(target){
  const route=routeVersion,user=CU?.id||null;
  const items=[...target.querySelectorAll('[data-match-id]')].map(card=>matchCardSnapshots.get(Number(card.dataset.matchId))).filter(Boolean);
  window.FBZMatchUpdates?.watch({items,isCurrent:()=>route===routeVersion&&(CU?.id||null)===user,apply:rows=>{
    // Keep keyboard focus and an open rating draft stable during background IO.
    const spotlight=document.getElementById('homeMatchSpotlight');
    if(document.body.classList.contains('modal-open')||target.contains(document.activeElement)||(CP==='home'&&spotlight?.contains(document.activeElement)))return false;
    let refilter=false;
    for(const row of rows){
      const previous=matchCardSnapshots.get(Number(row.id));
      const card=target.querySelector(`[data-match-id="${Number(row.id)}"]`);
      if(!previous||!card)continue;
      const match={...previous,...row};
      const index=matchCatalog.findIndex(item=>Number(item.id)===Number(row.id));
      if(index>=0)matchCatalog[index]=match;
      if(CP==='matches'&&MF!=='all'&&match.status!==MF){
        if(index>=0)matchCatalog.splice(index,1);
        matchTotal=Math.max(0,matchTotal-1);matchNextOffset=Math.max(0,matchNextOffset-1);
        refilter=true;continue;
      }
      card.outerHTML=renderMCard(match);
    }
    window.FBZData.invalidate('matches:');
    if(refilter)renderMatchResults();
    if(CP==='home')window.FBZHome?.spotlight(items.map(item=>matchCardSnapshots.get(Number(item.id))||item));
    return true;
  }});
}

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
  matchCardSnapshots.set(Number(match.id),match);
  if(matchCardSnapshots.size>200)matchCardSnapshots.delete(matchCardSnapshots.keys().next().value);
  const presentation=FBZDomain.matchScorePresentation(match);
  const statusClass=match.status==='live'&&!presentation.isLive?'t-sched':{live:'t-live',finished:'t-fin',scheduled:'t-sched'}[match.status]||'';
  const derby=isDerby(match.home_team_name,match.away_team_name);
  return`<article data-match-id="${Number(match.id)}" class="mcard mcard--${match.status==='live'&&!presentation.isLive?'other':['live','finished','scheduled'].includes(match.status)?match.status:'other'}${derby?' derby':''}" style="${FBZDomain.matchPaletteStyle(match)}">
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
  const route=routeVersion,user=CU?.id||null;
  const target=document.getElementById('homeM');
  if(!target)return;
  try{
    const page=await window.FBZData.getMatchesPage({limit:6});
    if(route!==routeVersion||CP!=='home'||(CU?.id||null)!==user)return;
    const items=featuredMatches(page?.items||[]);
    window.FBZHome?.spotlight(page?.items||[]);
    window.FBZHome?.leagues(page?.leagues||[]);
    target.innerHTML=items.length?items.map(renderMCard).join(''):'<div class="empty-state"><div class="empty-icon">🏟️</div><strong>Матчей пока нет</strong><span>Новые встречи появятся после обновления календаря.</span></div>';
    watchMatchCards(target);
  }catch(error){
    if(route!==routeVersion||CP!=='home'||(CU?.id||null)!==user)return;
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
  watchMatchCards(target);
}

async function loadM(reset=true){
  window.FBZMatchUpdates?.stop();
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

async function loadMD(id,options){
  const route=routeVersion,user=CU?.id||null;
  const current=()=>route===routeVersion&&CP==='md'&&Number(mdID)===Number(id)&&(CU?.id||null)===user;
  const target=document.getElementById('mdC');
  target.innerHTML='<div class="loading" role="status"><div class="spin"></div><span>Загружаем матч</span></div>';
  try{
    const detail=await FBZFeatures.load({key:'match-detail',script:'js/match-detail.js?v=20261012-freshness',ready:()=>window.FBZMatchDetail});
    if(current())return detail.load(id,options);
  }catch{
    if(current())target.innerHTML='<div class="empty-state"><strong>Не удалось открыть матч</strong><button class="btn btn-g btn-sm" '+FBZActions.attrs('matches.retry-match',[Number(id)])+'>Повторить</button></div>';
  }
}

window.setMatchRatingSegment=setMatchRatingSegment;

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
