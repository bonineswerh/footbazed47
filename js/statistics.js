(function(root){
  'use strict';
  let state=null,dispose=null;
  const kinds={matches:'Матчи',clubs:'Клубы',players:'Игроки',leagues:'Турниры'};
  const methodology={matches:'Средняя оценка матча по публичным голосам болельщиков.',clubs:'Средняя оценка матчей с участием клуба. Это впечатление от игр, а не оценка силы команды.',players:'Средняя оценка игрока по публичным оценкам его выступлений. Клуб определяется по составу конкретного матча, поэтому трансфер не переносит старые оценки в новую команду.',leagues:'Средняя оценка матчей турнира. Каждый публичный голос учитывается один раз.'};
  const count=(n,one,few,many)=>root.FBZDomain.countLabel(Number(n),{one,few,many});
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
    document.getElementById('statisticsRoot').innerHTML=`<header class="statistics-head"><span class="section-kicker">Футбол глазами сообщества</span><h1>Обзор оценок</h1><p>Впечатления о матчах и выступлениях — с учётом периода и числа авторов.</p></header><div class="statistics-tabs" role="group" aria-label="Раздел обзора">${Object.entries(kinds).map(([key,label])=>`<button type="button" data-kind="${key}" aria-pressed="${key==='matches'}" ${FBZActions.attrs("statistics.change-kind",[key])}>${label}</button>`).join('')}</div>${root.FBZExplore.filters('statisticsFilters')}<div class="statistics-summary" id="statisticsSummary"></div><div class="statistics-context" id="statisticsContext" role="status" hidden></div><details class="statistics-method-details"><summary>Как считаются оценки</summary><p class="statistics-method" id="statisticsMethod"></p></details><div class="collection-toolbar"><h2 id="statisticsTitle">Матчи</h2><p id="statisticsCount" aria-live="polite"></p></div><div id="statisticsError"></div><div id="statisticsList" class="statistics-list" aria-busy="true"></div><div class="collection-pagination"><span id="statisticsPage" aria-live="polite"></span><div><button class="btn btn-g btn-sm" id="statisticsPrevious" data-fbz-click="statistics.previous-page">Назад</button><button class="btn btn-g btn-sm" id="statisticsNext" data-fbz-click="statistics.next-page">Далее →</button></div></div>`;
    const s=state,form=document.getElementById('statisticsFilters');
    form.insertAdjacentHTML('beforeend',`<div class="statistics-tabs statistics-participation" id="statisticsParticipation" role="group" aria-label="Подтверждение выступлений" hidden><select name="participation" hidden aria-label="Режим выступлений"><option value="confirmed">Только подтверждённые</option><option value="all">Вся история оценок</option></select><button type="button" data-participation="confirmed" ${FBZActions.attrs('statistics.participation',['confirmed'])}>Только подтверждённые</button><button type="button" data-participation="all" ${FBZActions.attrs('statistics.participation',['all'])}>Вся история оценок</button></div>`);
    root.FBZExplore.restore(form,s.filters);participationControls();
    document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===s.kind)));
    dispose=root.FBZExplore.bind(form,(filters,mode)=>{if(current(s)){s.filters=filters;s.offset=0;participationControls();root.FBZExplore.writeLocation(form,filters,{kind:s.kind},mode);load();}},()=>{if(current(s)){s.version++;s.loading=true;s.hasMore=false;controls();}},()=>{
      if(!current(s))return;
      s.loading=false;s.offset=0;s.hasMore=false;controls();
      for(const id of ['statisticsSummary','statisticsContext','statisticsCount','statisticsPage','statisticsError','statisticsList'])document.getElementById(id).replaceChildren();
      document.getElementById('statisticsContext').hidden=true;
      document.getElementById('statisticsList').setAttribute('aria-busy','false');
    });
    return load();
  }
  async function load(){
    const s=state;if(!s||!current(s))return;
    const version=++s.version;s.loading=true;controls();
    const target=document.getElementById('statisticsList');target.setAttribute('aria-busy','true');
    document.getElementById('statisticsError').innerHTML='';
    document.getElementById('statisticsCount').textContent='';
    document.getElementById('statisticsPage').textContent='Загрузка…';
    document.getElementById('statisticsSummary').replaceChildren();
    document.getElementById('statisticsContext').replaceChildren();
    document.getElementById('statisticsContext').hidden=true;
    document.getElementById('statisticsTitle').textContent=kinds[s.kind];
    document.getElementById('statisticsMethod').textContent=methodology[s.kind]+(s.kind==='players'?(s.filters.participation==='all'?' Вся история включает прежние оценки без подтверждения участия; они отмечены отдельно.':' Включены только стартовые игроки и вышедшие на замену. Оставшиеся на скамейке не учитываются.')+' При выборе клуба показаны только подтверждённые выступления за него.':'')+' Обзор включает публичные оценки открытых профилей. Оценки «Только вам» не участвуют. Средние на страницах матчей учитывают все публичные оценки, поэтому могут отличаться от обзора. При менее чем пяти оценках или пяти авторах результат отмечен как предварительный.';
    target.innerHTML='<div class="loading" role="status"><div class="spin"></div><span class="sr-only">Загрузка обзора</span></div>';
    try{
      const data=await root.FBZData.getFootballStatistics(s.kind,{filters:{...s.filters,confirmed_only:s.kind==='players'&&s.filters.participation!=='all'},offset:s.offset,limit:12});
      if(!current(s)||version!==s.version)return;
      s.hasMore=Boolean(data.has_more);root.FBZExplore.populate(document.getElementById('statisticsFilters'),data);
      const summary=data.summary||{},items=data.items||[];
      document.getElementById('statisticsSummary').innerHTML=[['matches','Матчей в выборке'],[s.kind==='players'?'performance_votes':'votes',s.kind==='players'?'Оценок выступлений':'Оценок матчей'],['voters','Авторов оценок']].map(([key,label])=>`<div><strong>${summary[key]==null?'—':Number(summary[key]).toLocaleString('ru-RU')}</strong><span>${label}</span></div>`).join('');
      const context=document.getElementById('statisticsContext'),contextNotes=[];
      if(Number(summary.votes)>0&&Number(summary.voters)<5)contextNotes.push(`Пока это предварительные мнения: ${count(summary.voters,'автор','автора','авторов')}. Для устойчивой подборки нужно больше независимых оценок.`);
      if(s.kind==='players'&&Number(summary.unverified_performance_votes)>0)contextNotes.push(`${count(summary.unverified_performance_votes,'ранее сохранённая оценка','ранее сохранённые оценки','ранее сохранённых оценок')}: участие игроков в этих матчах ещё не подтверждено.`);
      if(s.kind==='players'&&Number(summary.excluded_unverified_performance_votes)>0)contextNotes.push(`${count(summary.excluded_unverified_performance_votes,'прежняя оценка не включена','прежние оценки не включены','прежних оценок не включено')}: участие не подтверждено. Их можно посмотреть в режиме «Вся история оценок».`);
      context.hidden=!contextNotes.length;context.textContent=contextNotes.join(' ');
      document.getElementById('statisticsCount').textContent='Найдено: '+Number(data.total||0).toLocaleString('ru-RU');
      document.getElementById('statisticsPage').textContent=items.length?`${s.offset+1}–${s.offset+items.length} из ${Number(data.total)}`:'Нет результатов';
      target.innerHTML=items.length?items.map(item=>{
        const rating=root.FBZDomain.ratingPresentation(item.average,1),evidence=root.FBZDomain.ratingEvidence({votes:item.votes,voters:item.voters,unverified:item.unverified_votes}),id=Number(item.entity_id),route={matches:'md',clubs:'club',players:'player',leagues:'competition'}[s.kind];
        const action=Number.isSafeInteger(id)&&id>0?FBZActions.attrs('statistics.open-entity',[route,id]):'';
        const tag=action?'button':'article',score=s.kind==='matches'&&item.home_score!==null?`${Number(item.home_score)} : ${Number(item.away_score)} · `:'';
        const marks=s.kind==='matches'?root.matchClubMark(item,'home','collection-mark')+root.matchClubMark(item,'away','collection-mark'):root.FBZMedia.visual({entity:{id,name:item.title,media:item.media},kind:{clubs:'club',players:'player',leagues:'competition'}[s.kind],className:'collection-mark'});
        const title=s.kind==='matches'?root.FBZDomain.matchTeamName(item,'home')+' — '+root.FBZDomain.matchTeamName(item,'away'):item.title;
        return `<${tag} class="statistics-row${evidence.preliminary?' is-preliminary':''}" ${action?`type="button" ${action}`:''}><span class="statistics-rank" aria-label="${evidence.preliminary?'Предварительная оценка':'Место в выборке'}">${evidence.preliminary?'·':Number(item.rank)}</span><span class="statistics-content"><span class="collection-marks" aria-hidden="true">${marks}</span><span><strong class="statistics-title">${esc(title)}</strong><span class="statistics-meta">${score}${esc(item.subtitle)}${s.kind==='matches'?' · '+esc(new Date(item.latest).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'})):''}</span>${evidence.preliminary?'<span class="statistics-evidence">Предварительная оценка</span>':''}${evidence.unverified?'<span class="statistics-evidence">Участие в матче не подтверждено</span>':''}</span></span><span class="statistics-sample">${esc(count(item.votes,'оценка','оценки','оценок'))}<small>${esc(count(item.voters,'автор','автора','авторов'))}</small></span><span class="statistics-score rating-ink" data-tone="${rating.tone}">${rating.value}<small>/10</small></span></${tag}>`;
      }).join(''):`<div class="empty-state"><strong>Для этой выборки пока нет оценок${s.kind==='players'&&s.filters.participation!=='all'?' подтверждённых выступлений':''}</strong><p>${s.kind==='players'&&s.filters.participation!=='all'?'Можно посмотреть прежние сохранённые оценки в режиме «Вся история оценок». Они не подтверждают участие в матче.':'Измените фильтры или оцените завершённый матч.'}</p><button class="btn btn-g" data-fbz-click="shell.go-matches">Открыть календарь</button></div>`;
    }catch(error){if(current(s)&&version===s.version){s.hasMore=false;target.innerHTML='';document.getElementById('statisticsPage').textContent='';document.getElementById('statisticsError').innerHTML='<div class="collection-error" role="status"><span>Не удалось загрузить обзор</span><button class="btn btn-g btn-sm" data-fbz-click="statistics.retry">Повторить</button></div>';}}
    finally{if(current(s)&&version===s.version){s.loading=false;target.setAttribute('aria-busy','false');controls();}}
  }
  function changeKind(kind){if(!state||!kinds[kind]||state.kind===kind)return;state.kind=kind;state.offset=0;participationControls();document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));document.getElementById('statisticsFilters').dispatchEvent(new Event('submit',{cancelable:true}));}
  function participation(mode){if(!state||state.kind!=='players'||!['all','confirmed'].includes(mode))return;const form=document.getElementById('statisticsFilters');if(form.elements.namedItem('participation').value===mode)return;form.elements.namedItem('participation').value=mode;form.dispatchEvent(new Event('submit',{cancelable:true}));}
  function page(direction){if(!state||state.loading)return;if(direction>0&&!state.hasMore||direction<0&&state.offset===0)return;state.offset=Math.max(0,state.offset+direction*12);load();}
  root.FBZStatistics=Object.freeze({mount,changeKind,participation,page,retry:load});
})(window);

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "statistics.open-entity":(event,element,[route,id])=>{if(['md','club','player','competition'].includes(route))return go(route,route==='md'?{mid:id}:{id});},
  "statistics.change-kind":(event,element,[kind])=>FBZStatistics.changeKind(kind),
  "statistics.previous-page":()=>FBZStatistics.page(-1),
  "statistics.next-page":()=>FBZStatistics.page(1),
  "statistics.retry":()=>FBZStatistics.retry()
});
FBZActions.register({'statistics.participation':(event,element,[mode])=>FBZStatistics.participation(mode)});
