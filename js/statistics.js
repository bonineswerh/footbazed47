(function(root){
  'use strict';
  let state=null,dispose=null;
  const kinds={matches:'Матчи',clubs:'Клубы',players:'Игроки',leagues:'Турниры'};
  const methodology={matches:'Средняя оценка матча по публичным голосам болельщиков.',clubs:'Средняя оценка матчей с участием клуба. Это впечатление от игр, а не оценка силы команды.',players:'Средняя оценка игрока по публичным оценкам его выступлений. Клуб определяется по составу конкретного матча, поэтому трансфер не переносит старые оценки в новую команду.',leagues:'Средняя оценка матчей турнира. Каждый публичный голос учитывается один раз.'};
  const count=(n,one,few,many)=>root.FBZDomain.countLabel(Number(n),{one,few,many});
  function kindControls(){
    const input=document.getElementById('statisticsFilters-query');
    input.placeholder={matches:'Найти матч',clubs:'Найти клуб',players:'Найти игрока',leagues:'Найти турнир'}[state.kind];
    document.getElementById('statisticsList').dataset.kind=state.kind;
    document.querySelectorAll('[data-statistics-votes]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.statisticsVotes)===Number(state.filters.min_votes||1))));
  }
  function row(item,kind){
    const rating=root.FBZDomain.ratingPresentation(item.average,1),evidence=root.FBZDomain.ratingEvidence({votes:item.votes,voters:item.voters,unverified:item.unverified_votes}),id=Number(item.entity_id),route={matches:'md',clubs:'club',players:'player',leagues:'competition'}[kind];
    const linked=Number.isSafeInteger(id)&&id>0,tag=linked?'a':'article';
    const path={matches:'match',clubs:'club',players:'player',leagues:'competition'}[kind];
    const action=linked?`href="${esc(root.FBZLocale.path('/'+path+'/'+id))}" ${FBZActions.attrs('statistics.open-entity',[route,id])}`:'';
    let identity,meta='';
    if(kind==='matches'){
      // This RPC includes only finished matches, but either goal can still be absent.
      const score=root.FBZDomain.matchScorePresentation({...item,status:'finished'}),date=new Date(item.latest);
      identity=`<strong class="statistics-title statistics-match-title"><span class="statistics-team"><span class="collection-marks" aria-hidden="true">${root.matchClubMark(item,'home','collection-mark')}</span><span>${esc(root.FBZDomain.matchTeamName(item,'home'))}</span></span><span class="statistics-result${score.hasScore?'':' is-pending'}" aria-label="${score.hasScore?esc(`${score.label}: ${score.home} : ${score.away}`):'Счёт уточняется'}">${score.hasScore?`${score.home} : ${score.away}`:'Счёт уточняется'}</span><span class="statistics-team"><span class="collection-marks" aria-hidden="true">${root.matchClubMark(item,'away','collection-mark')}</span><span>${esc(root.FBZDomain.matchTeamName(item,'away'))}</span></span></strong>`;
      meta=`<span>${esc(root.FBZNames.competition(item.subtitle))}</span>${Number.isFinite(date.getTime())?`<time datetime="${esc(date.toISOString())}">${esc(date.toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'}))}</time>`:''}`;
    }else{
      const title=kind==='clubs'?root.FBZNames.club(item.title):kind==='leagues'?root.FBZNames.competition(item.title):item.title;
      const mark=root.FBZMedia.visual({entity:{id,name:item.title,media:item.media},kind:{clubs:'club',players:'player',leagues:'competition'}[kind],className:'collection-mark'});
      identity=`<span class="statistics-entity"><span class="collection-marks" aria-hidden="true">${mark}</span><strong class="statistics-title">${esc(title)}</strong></span>`;
      const subtitle=kind==='players'?(Number(item.unverified_votes)===Number(item.votes)?'Прежние оценки':item.subtitle==='Несколько клубов в выбранном периоде'?'Несколько клубов в выбранном периоде':root.FBZNames.club(item.subtitle)):count(item.matches,'матч','матча','матчей');
      meta=esc(subtitle||'');
    }
    const evidenceLabel=evidence.unverified?'Участие в матче не подтверждено':evidence.preliminary?'Предварительная оценка':'';
    const palette=kind==='matches'||kind==='clubs'?` style="${root.FBZDomain.matchPaletteStyle(kind==='clubs'?{home_team_name:item.title,away_team_name:item.title}:item)}"`:'';
    return `<${tag} class="statistics-row${kind==='matches'?' is-match':kind==='clubs'?' is-club':''}${evidence.preliminary?' is-preliminary':''}" ${action}${palette}><span class="statistics-rank" aria-label="${evidence.preliminary?'Предварительная оценка':'Место в выборке'}">${evidence.preliminary?'·':Number(item.rank)}</span><span class="statistics-content"><span class="statistics-identity">${identity}<span class="statistics-meta">${meta}</span></span></span><span class="statistics-sample">${esc(count(item.votes,'оценка','оценки','оценок'))} <small>${esc(count(item.voters,'автор','автора','авторов'))}</small>${evidenceLabel?`<span class="statistics-evidence">${evidence.unverified?'':ico('info',13)}${esc(evidenceLabel)}</span>`:''}</span><span class="statistics-score rating-ink" data-tone="${rating.tone}" aria-label="Средняя оценка болельщиков: ${rating.label}">${rating.value}<small>/10</small></span></${tag}>`;
  }
  function current(s){return state===s&&s.route===routeVersion&&s.user===CU?.id&&CP==='leaderboard';}
  function controls(){if(!state)return;document.getElementById('statisticsPrevious').disabled=state.loading||state.offset===0;document.getElementById('statisticsNext').disabled=state.loading||!state.hasMore;}
  function participationControls(){
    if(!state)return;
    const group=document.getElementById('statisticsParticipation'),field=document.getElementById('statisticsFilters').elements.namedItem('participation');
    group.hidden=state.kind!=='players';field.disabled=state.kind!=='players';field.value=state.filters.participation==='all'?'all':'confirmed';
    group.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.participation===field.value)));
  }
  function mount(){
    const selectedKind=new URLSearchParams(location.search).get('ov_kind');
    dispose?.();state={kind:Object.hasOwn(kinds,selectedKind)?selectedKind:'matches',filters:root.FBZExplore.locationFilters(location.search,'ov'),offset:0,version:0,route:routeVersion,user:CU?.id,loading:false,hasMore:false};
    document.getElementById('statisticsRoot').innerHTML=`<header class="statistics-head"><h1>Обзор</h1></header><div class="statistics-tabs" role="group" aria-label="Раздел обзора">${Object.entries(kinds).map(([key,label])=>`<button type="button" data-kind="${key}" aria-pressed="${key==='matches'}" ${FBZActions.attrs("statistics.change-kind",[key])}>${label}</button>`).join('')}</div>${root.FBZExplore.filters('statisticsFilters')}<div class="statistics-summary" id="statisticsSummary"></div><div class="statistics-context" id="statisticsContext" role="status" hidden></div><details class="statistics-method-details"><summary>Как считаются оценки</summary><p class="statistics-method" id="statisticsMethod"></p></details><div class="collection-toolbar"><h2 id="statisticsTitle">Матчи</h2><p id="statisticsCount" aria-live="polite"></p></div><div id="statisticsError"></div><div id="statisticsList" class="statistics-list" aria-busy="true"></div><div class="collection-pagination"><span id="statisticsPage" aria-live="polite"></span><div><button class="btn btn-g btn-sm" id="statisticsPrevious" data-fbz-click="statistics.previous-page">Назад</button><button class="btn btn-g btn-sm" id="statisticsNext" data-fbz-click="statistics.next-page">Далее →</button></div></div>`;
    const s=state,form=document.getElementById('statisticsFilters');
    const order=form.elements.namedItem('sort').parentElement;
    form.elements.namedItem('sort').setAttribute('aria-label','Порядок');
    order.className='statistics-order';form.querySelector('.explore-toolbar').append(order);
    form.insertAdjacentHTML('beforeend',`<div class="statistics-tabs statistics-participation" id="statisticsParticipation" role="group" aria-label="Подтверждение выступлений" hidden><select name="participation" hidden aria-label="Режим выступлений"><option value="confirmed">Только подтверждённые</option><option value="all">Вся история оценок</option></select><button type="button" data-participation="confirmed" ${FBZActions.attrs('statistics.participation',['confirmed'])}>Только подтверждённые</button><button type="button" data-participation="all" ${FBZActions.attrs('statistics.participation',['all'])}>Вся история оценок</button></div>`);
    root.FBZExplore.restore(form,s.filters);participationControls();kindControls();
    document.querySelectorAll('.statistics-tabs [data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===s.kind)));
    dispose=root.FBZExplore.bind(form,(filters,mode)=>{if(current(s)){s.filters=filters;participationControls();root.FBZExplore.writeLocation(form,filters,{kind:s.kind},mode);load({offset:0});}},()=>{if(current(s)){s.version++;s.loading=true;controls();}},()=>{
      if(!current(s))return;
      s.loading=false;s.offset=0;s.hasMore=false;s.resultScope=null;s.retryRequest=null;controls();
      for(const id of ['statisticsSummary','statisticsContext','statisticsCount','statisticsPage','statisticsError','statisticsList'])document.getElementById(id).replaceChildren();
      document.getElementById('statisticsContext').hidden=true;
      document.getElementById('statisticsList').setAttribute('aria-busy','false');
    });
    form.insertAdjacentHTML('beforeend',`<div class="statistics-confidence" role="group" aria-label="Размер выборки"><span>Оценок на результат</span>${[[1,'Любое число'],[5,'От 5'],[10,'От 10']].map(([n,label])=>`<button type="button" data-statistics-votes="${n}" aria-pressed="${Number(s.filters.min_votes||1)===n}" ${FBZActions.attrs('statistics.votes',[n])}>${label}</button>`).join('')}</div>`);
    return load();
  }
  async function load({offset=state?.offset||0,origin=null}={}){
    const s=state;if(!s||!current(s))return;
    const scope=JSON.stringify([s.kind,s.filters]),retain=s.resultScope===scope;
    const version=++s.version;s.loading=true;s.retryRequest=null;controls();
    const target=document.getElementById('statisticsList');target.setAttribute('aria-busy','true');
    document.getElementById('statisticsError').innerHTML=retain?'<p class="collection-loading" role="status">Загрузка страницы…</p>':'';
    if(!retain){
    s.resultScope=null;s.hasMore=false;s.offset=0;
    document.getElementById('statisticsCount').textContent='';
    document.getElementById('statisticsPage').textContent='Загрузка…';
    document.getElementById('statisticsSummary').replaceChildren();
    document.getElementById('statisticsContext').replaceChildren();
    document.getElementById('statisticsContext').hidden=true;
    target.innerHTML='<div class="loading" role="status"><div class="spin"></div><span class="sr-only">Загрузка обзора</span></div>';
    }
    document.getElementById('statisticsTitle').textContent=kinds[s.kind];
    document.getElementById('statisticsMethod').textContent=methodology[s.kind]+(s.kind==='players'?(s.filters.participation==='all'?' Вся история включает прежние оценки без подтверждения участия; они отмечены отдельно.':' Включены только стартовые игроки и вышедшие на замену. Оставшиеся на скамейке не учитываются.')+' При выборе клуба показаны только подтверждённые выступления за него.':'')+' Обзор включает публичные оценки открытых профилей. Оценки «Только вам» не участвуют. Средние на страницах матчей учитывают все публичные оценки, поэтому могут отличаться от обзора. При менее чем пяти оценках или пяти авторах результат отмечен как предварительный.';
    try{
      const data=await root.FBZData.getFootballStatistics(s.kind,{filters:{...s.filters,confirmed_only:s.kind==='players'&&s.filters.participation!=='all'},offset,limit:12});
      if(!current(s)||version!==s.version)return;
      s.offset=offset;s.resultScope=scope;s.hasMore=Boolean(data.has_more);root.FBZExplore.populate(document.getElementById('statisticsFilters'),data);
      kindControls();
      const summary=data.summary||{},items=data.items||[];
      document.getElementById('statisticsSummary').innerHTML=[['matches','Матчей'],[s.kind==='players'?'performance_votes':'votes',s.kind==='players'?'Оценок выступлений':'Оценок матчей'],['voters','Авторов']].map(([key,label])=>`<div><strong>${summary[key]==null?'—':Number(summary[key]).toLocaleString('ru-RU')}</strong><span>${label}</span></div>`).join('');
      const context=document.getElementById('statisticsContext'),contextNotes=[];
      if(Number(summary.votes)>0&&Number(summary.voters)<5)contextNotes.push(`Пока оценки предварительные: ${count(summary.voters,'автор','автора','авторов')}.`);
      if(s.kind==='players'&&Number(summary.unverified_performance_votes)>0)contextNotes.push(`${count(summary.unverified_performance_votes,'ранее сохранённая оценка','ранее сохранённые оценки','ранее сохранённых оценок')}: участие игроков в этих матчах ещё не подтверждено.`);
      if(s.kind==='players'&&Number(summary.excluded_unverified_performance_votes)>0)contextNotes.push(`${count(summary.excluded_unverified_performance_votes,'прежняя оценка не включена','прежние оценки не включены','прежних оценок не включено')}: участие не подтверждено. Их можно посмотреть в режиме «Вся история оценок».`);
      context.hidden=!contextNotes.length;context.textContent=contextNotes.join(' ');
      document.getElementById('statisticsCount').textContent={matches:count(data.total||0,'матч','матча','матчей'),clubs:count(data.total||0,'клуб','клуба','клубов'),players:count(data.total||0,'игрок','игрока','игроков'),leagues:count(data.total||0,'турнир','турнира','турниров')}[s.kind];
      document.getElementById('statisticsPage').textContent=items.length?`${s.offset+1}–${s.offset+items.length} из ${Number(data.total)}`:'Нет результатов';
      const heading={matches:'Матч',clubs:'Клуб',players:'Игрок',leagues:'Турнир'}[s.kind];
      target.innerHTML=items.length?`<div class="statistics-columns" aria-hidden="true"><span>№</span><span>${heading}</span><span>Оценки / авторы</span><span>Средняя</span></div>`+items.map(item=>row(item,s.kind)).join(''):`<div class="empty-state"><strong>Для этой выборки пока нет оценок${s.kind==='players'&&s.filters.participation!=='all'?' подтверждённых выступлений':''}</strong><p>${s.kind==='players'&&s.filters.participation!=='all'?'Можно посмотреть прежние сохранённые оценки в режиме «Вся история оценок». Они не подтверждают участие в матче.':'Измените фильтры или оцените завершённый матч.'}</p>${root.FBZExplore.activeCount(document.getElementById('statisticsFilters'))?'<button class="btn btn-g" data-fbz-click="statistics.clear-filters">Показать без фильтров</button>':'<button class="btn btn-g" data-fbz-click="shell.go-matches">Открыть календарь</button>'}</div>`;
      document.getElementById('statisticsError').replaceChildren();
      root.FBZExplore.focusResults('statisticsTitle',origin);
    }catch(error){if(current(s)&&version===s.version){
      const keep=retain&&root.FBZDomain.canRetainReadResult(error);
      s.retryRequest={offset,origin};
      if(!keep){s.hasMore=false;s.resultScope=null;target.replaceChildren();for(const id of ['statisticsPage','statisticsCount','statisticsSummary','statisticsContext'])document.getElementById(id).replaceChildren();document.getElementById('statisticsContext').hidden=true;}
      document.getElementById('statisticsError').innerHTML=`<div class="collection-error" role="status"><span>${keep?'Не удалось открыть страницу. Показаны предыдущие результаты.':'Не удалось загрузить обзор'}</span><button class="btn btn-g btn-sm" data-fbz-click="statistics.retry">Повторить</button></div>`;
    }}
    finally{if(current(s)&&version===s.version){s.loading=false;target.setAttribute('aria-busy','false');controls();}}
  }
  function changeKind(kind){if(!state||!kinds[kind]||state.kind===kind)return;state.kind=kind;state.offset=0;participationControls();kindControls();document.querySelectorAll('.statistics-tabs [data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));document.getElementById('statisticsFilters').dispatchEvent(new Event('submit',{cancelable:true}));}
  function participation(mode){if(!state||state.kind!=='players'||!['all','confirmed'].includes(mode))return;const form=document.getElementById('statisticsFilters');if(form.elements.namedItem('participation').value===mode)return;form.elements.namedItem('participation').value=mode;form.dispatchEvent(new Event('submit',{cancelable:true}));}
  function votes(value){if(!state||![1,5,10].includes(value))return;const form=document.getElementById('statisticsFilters');form.elements.namedItem('min_votes').value=String(value);form.dispatchEvent(new Event('submit',{cancelable:true}));kindControls();}
  function page(direction){if(!state||state.loading)return;if(direction>0&&!state.hasMore||direction<0&&state.offset===0)return;load({offset:Math.max(0,state.offset+direction*12),origin:document.activeElement});}
  function retry(){return load({...state?.retryRequest,origin:state?.retryRequest?.origin?document.activeElement:null});}
  function clearFilters(){document.getElementById('statisticsFilters')?.reset();}
  root.FBZStatistics=Object.freeze({mount,changeKind,participation,votes,page,retry,clearFilters});
})(window);

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "statistics.open-entity":(event,element,[route,id])=>{if(['md','club','player','competition'].includes(route))return FBZActions.follow(event,element,()=>go(route,route==='md'?{mid:id}:{id}));},
  "statistics.change-kind":(event,element,[kind])=>FBZStatistics.changeKind(kind),
  "statistics.previous-page":()=>FBZStatistics.page(-1),
  "statistics.next-page":()=>FBZStatistics.page(1),
  "statistics.retry":()=>FBZStatistics.retry(),
  "statistics.clear-filters":()=>FBZStatistics.clearFilters()
});
FBZActions.register({'statistics.votes':(event,element,[value])=>FBZStatistics.votes(value)});
FBZActions.register({'statistics.participation':(event,element,[mode])=>FBZStatistics.participation(mode)});
