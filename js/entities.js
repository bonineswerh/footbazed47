(function(){
  'use strict';

  const positionGroups=[
    {key:'goalkeepers',label:'Вратари',codes:['GK','Вратарь']},
    {key:'defenders',label:'Защитники',codes:['LB','LWB','CB','RB','RWB','DF','Защитник']},
    {key:'midfielders',label:'Полузащитники',codes:['DM','CDM','CM','AM','CAM','LM','RM','MF','Полузащитник']},
    {key:'forwards',label:'Нападающие',codes:['LW','RW','CF','ST','SS','FW','Нападающий']}
  ];
  const positionNames={GK:'Вратарь',LB:'Левый защитник',LWB:'Левый латераль',CB:'Центральный защитник',RB:'Правый защитник',RWB:'Правый латераль',DM:'Опорный полузащитник',CDM:'Опорный полузащитник',CM:'Центральный полузащитник',AM:'Атакующий полузащитник',CAM:'Атакующий полузащитник',LM:'Левый полузащитник',RM:'Правый полузащитник',LW:'Левый вингер',RW:'Правый вингер',CF:'Оттянутый нападающий',ST:'Нападающий',SS:'Второй нападающий'};
  let clubPayload=null;
  let clubTab='overview';
  let clubRequest=0;
  let playerRequest=0;
  let competitionRequest=0;

  function initials(value){
    return String(value||'FB').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toLocaleUpperCase('ru-RU');
  }

  function identityVisual({entity={},name='',media=null,kind='other',className='entity-mark',loading='lazy'}){
    return window.FBZMedia.visual({entity:{...entity,name:name||entity.name,media:media||entity.media},kind,className,loading});
  }

  function positionLabel(value){return positionNames[value]||value||'Позиция не указана';}

  function ratingValue(value){
    if(value===null||value===undefined||value==='')return'—';
    const numeric=Number(value);
    return Number.isFinite(numeric)?numeric.toFixed(1):'—';
  }

  function ratingData(value){
    return window.FBZDomain.ratingPresentation(value,1);
  }

  function plural(count,one,few,many){
    const value=Math.abs(Number(count)||0)%100;
    const last=value%10;
    if(value>10&&value<20)return many;
    if(last===1)return one;
    if(last>=2&&last<=4)return few;
    return many;
  }

  function entityLoading(label){
    return`<div class="entity-loading"><div class="spin"></div><span>${esc(label)}</span></div>`;
  }

  function entityError(kind,id){
    const config={club:['loadClub','Клуб'],player:['loadPlayer','Игрок'],competition:['loadCompetition','Турнир']}[kind]||['loadClub','Объект'];
    return`<div class="entity-empty"><span class="entity-empty-code">404</span><h1>${config[1]} не найден</h1><p>Данные могли обновиться. Попробуй открыть страницу ещё раз.</p><button class="btn btn-g" type="button" onclick="FBZEntities.${config[0]}(${Number(id)})">Повторить</button></div>`;
  }

  function clubRoute(id,label){
    if(!id)return`<span>${esc(label||'Клуб')}</span>`;
    return`<button class="entity-text-link" type="button" onclick="go('club',{id:${Number(id)}})">${esc(label||'Клуб')}</button>`;
  }

  function playerRoute(id,label){
    return`<button class="entity-text-link" type="button" onclick="go('player',{id:${Number(id)}})">${esc(label)}</button>`;
  }

  function competitionRoute(id,label){
    if(!id)return`<span>${esc(label||'Турнир')}</span>`;
    return`<button class="entity-text-link" type="button" onclick="go('competition',{id:${Number(id)}})">${esc(label||'Турнир')}</button>`;
  }

  function matchStatus(match){
    return{live:'LIVE',finished:'Завершён',scheduled:'Предстоит'}[match.status]||match.status||'';
  }

  function matchDate(value){
    return new Date(value).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'});
  }

  function renderMatchRow(match,clubId){
    const isHome=Number(match.home_club_id)===Number(clubId);
    const opponent=isHome?match.away_team_name:match.home_team_name;
    const opponentId=isHome?match.away_club_id:match.home_club_id;
    const scored=isHome?match.home_score:match.away_score;
    const conceded=isHome?match.away_score:match.home_score;
    const score=match.status==='finished'||match.status==='live'?`${scored??'—'} : ${conceded??'—'}`:'—';
    return`<article class="entity-match-row">
      <button class="entity-match-main" type="button" onclick="go('md',{mid:${Number(match.id)}})">
        <span class="entity-match-date">${matchDate(match.match_date)}</span>
        <span class="entity-match-opponent"><small>${isHome?'Дома':'В гостях'} · ${esc(match.league_name||'')}</small><strong>${esc(opponent||'Соперник')}</strong></span>
        <span class="entity-match-score">${esc(score)}</span>
        <span class="entity-match-status status-${esc(match.status||'')}">${esc(matchStatus(match))}</span>
      </button>
      ${opponentId?`<button class="entity-match-club" type="button" onclick="go('club',{id:${Number(opponentId)}})" aria-label="Открыть ${esc(opponent)}">→</button>`:''}
    </article>`;
  }

  function squadGroup(player){
    return positionGroups.find(group=>group.codes.includes(player.position))||{key:'other',label:'Другие'};
  }

  function renderPlayerRow(player){
    const rating=ratingData(player.average);
    return`<button class="squad-player" type="button" onclick="go('player',{id:${Number(player.id)}})">
      ${identityVisual({entity:player,kind:'player',className:'squad-player-photo'})}
      <span class="squad-player-copy"><strong>${esc(player.name)}</strong><small>${esc(positionLabel(player.position))}</small></span>
      <span class="squad-player-number">${player.shirt_number?`#${esc(player.shirt_number)}`:'—'}</span>
      <span class="squad-player-rating" data-tone="${rating.tone}"><b>${rating.value}</b><small>${Number(player.rating_count)||0} ${plural(player.rating_count,'оценка','оценки','оценок')}</small></span>
      <span class="squad-player-arrow">→</span>
    </button>`;
  }

  function renderSquad(squad){
    if(!squad.length)return'<div class="entity-empty compact"><h2>Состав пока не опубликован</h2></div>';
    const groups=new Map(positionGroups.map(group=>[group.key,{label:group.label,players:[]}]));
    squad.forEach(player=>{
      const group=squadGroup(player);
      if(!groups.has(group.key))groups.set(group.key,{label:group.label,players:[]});
      groups.get(group.key).players.push(player);
    });
    return`<div class="squad-groups">${[...groups.values()].filter(group=>group.players.length).map(group=>`<section class="squad-group"><header><h2>${esc(group.label)}</h2><span>${group.players.length}</span></header><div>${group.players.map(renderPlayerRow).join('')}</div></section>`).join('')}</div>`;
  }

  function topPlayers(squad){
    return [...squad].filter(player=>Number(player.rating_count)>0).sort((a,b)=>Number(b.average||0)-Number(a.average||0)||Number(b.rating_count||0)-Number(a.rating_count||0)).slice(0,5);
  }

  function renderClubOverview(payload){
    const upcoming=payload.matches.filter(match=>match.status==='live'||match.status==='scheduled').slice(0,5);
    const rated=topPlayers(payload.squad);
    return`<div class="entity-overview-grid">
      <section class="entity-section">
        <header class="entity-section-head"><div><span>Календарь</span><h2>Ближайшие матчи</h2></div><button type="button" onclick="FBZEntities.setClubTab('matches')">Все матчи</button></header>
        <div class="entity-match-list">${upcoming.length?upcoming.map(match=>renderMatchRow(match,payload.club.id)).join(''):'<div class="entity-inline-empty">Предстоящих матчей пока нет</div>'}</div>
      </section>
      <aside class="entity-section entity-rankings">
        <header class="entity-section-head"><div><span>Сообщество</span><h2>Игроки клуба</h2></div></header>
        ${rated.length?rated.map((player,index)=>{const rating=ratingData(player.average);return`<div class="entity-ranking-row" data-tone="${rating.tone}"><span>${String(index+1).padStart(2,'0')}</span>${playerRoute(player.id,player.name)}<b>${rating.value}</b></div>`;}).join(''):'<div class="entity-inline-empty">Оценок игроков пока нет</div>'}
      </aside>
    </div>`;
  }

  function renderClubBody(){
    const target=document.getElementById('clubBody');
    if(!target||!clubPayload)return;
    if(clubTab==='squad')target.innerHTML=renderSquad(clubPayload.squad);
    else if(clubTab==='matches')target.innerHTML=`<section class="entity-section"><header class="entity-section-head"><div><span>Все турниры</span><h2>Матчи клуба</h2></div><strong>${clubPayload.matches.length}</strong></header><div class="entity-match-list">${clubPayload.matches.length?clubPayload.matches.map(match=>renderMatchRow(match,clubPayload.club.id)).join(''):'<div class="entity-inline-empty">Матчей пока нет</div>'}</div></section>`;
    else target.innerHTML=renderClubOverview(clubPayload);
  }

  function setClubTab(tab,button){
    if(!['overview','squad','matches'].includes(tab)||!clubPayload)return;
    clubTab=tab;
    document.querySelectorAll('#clubTabs .entity-tab').forEach(item=>{
      const active=item.dataset.tab===tab;
      item.classList.toggle('on',active);
      item.setAttribute('aria-selected',String(active));
    });
    renderClubBody();
    if(button)document.getElementById('clubBody')?.scrollIntoView({block:'start',behavior:'smooth'});
  }

  function renderClub(payload){
    const {club,stats}=payload;
    const competitions=Array.isArray(payload.competitions)?payload.competitions:[];
    return`<article class="entity-shell club-shell">
      <header class="entity-hero">
        ${identityVisual({entity:club,kind:'club',loading:'eager'})}
        <div class="entity-identity">
          <div class="entity-eyebrow"><span>Клуб</span>${club.tla?`<b>${esc(club.tla)}</b>`:''}</div>
          <h1>${esc(club.name)}</h1>
          <div class="entity-meta">${[club.area_name,club.venue,club.founded?`Основан в ${club.founded}`:''].filter(Boolean).map(item=>`<span>${esc(item)}</span>`).join('')}</div>
          ${competitions.length?`<div class="entity-chips">${competitions.map(item=>competitionRoute(item.id,item.name)).join('')}</div>`:''}
        </div>
        <div class="entity-hero-actions">
          <button class="entity-favorite${payload.is_favorite?' on':''}" id="clubFavoriteButton" type="button" aria-pressed="${String(Boolean(payload.is_favorite))}" onclick="FBZEntities.toggleFavorite()" title="${payload.is_favorite?'Убрать из избранного':'Добавить в избранное'}">${ico('star',18)}<span>${payload.is_favorite?'В избранном':'В избранное'}</span></button>
          <button class="entity-share" type="button" onclick="copyAppLink('/club/${Number(club.id)}','Ссылка на клуб')" aria-label="Поделиться клубом" title="Поделиться">${ico('share',18)}</button>
        </div>
      </header>
      <div class="entity-stat-strip">
        <div><strong>${Number(stats.squad_count)||0}</strong><span>Игроков</span></div>
        <div><strong>${Number(stats.match_count)||0}</strong><span>Матчей</span></div>
        <div><strong>${Number(stats.upcoming_count)||0}</strong><span>Впереди</span></div>
        <div><strong>${ratingValue(stats.player_rating)}</strong><span>Оценка состава</span></div>
      </div>
      <div class="entity-tabs" id="clubTabs" role="tablist" aria-label="Разделы клуба">
        <button class="entity-tab on" data-tab="overview" role="tab" aria-selected="true" type="button" onclick="FBZEntities.setClubTab('overview',this)">Обзор</button>
        <button class="entity-tab" data-tab="squad" role="tab" aria-selected="false" type="button" onclick="FBZEntities.setClubTab('squad',this)">Состав <span>${Number(stats.squad_count)||0}</span></button>
        <button class="entity-tab" data-tab="matches" role="tab" aria-selected="false" type="button" onclick="FBZEntities.setClubTab('matches',this)">Матчи <span>${Number(stats.match_count)||0}</span></button>
      </div>
      <div class="entity-body" id="clubBody"></div>
    </article>`;
  }

  async function loadClub(id){
    const numericId=Number(id);
    const target=document.getElementById('clubC');
    if(!target||!Number.isFinite(numericId))return;
    const request=++clubRequest;
    target.innerHTML=entityLoading('Загружаем клуб');
    try{
      const{data,error}=await sb.rpc('get_club_page',{p_club_id:numericId});
      if(error)throw error;
      if(request!==clubRequest)return;
      if(!data?.club){target.innerHTML=entityError('club',numericId);return;}
      clubPayload={...data,squad:Array.isArray(data.squad)?data.squad:[],matches:Array.isArray(data.matches)?data.matches:[]};
      clubTab='overview';
      target.innerHTML=renderClub(clubPayload);
      renderClubBody();
      window.FBZSEO?.club(data.club);
    }catch(error){
      console.error('Club page error:',error);
      if(request===clubRequest)target.innerHTML=entityError('club',numericId);
    }
  }

  async function toggleFavorite(){
    if(!clubPayload?.club)return;
    if(!CU){openAuth();return;}
    const button=document.getElementById('clubFavoriteButton');
    if(button)button.disabled=true;
    const next=!Boolean(clubPayload.is_favorite);
    try{
      const{data,error}=await sb.rpc('set_favorite_club',{p_club_id:Number(clubPayload.club.id),p_favorite:next});
      if(error)throw error;
      clubPayload.is_favorite=Boolean(data?.is_favorite);
      const{data:favorites,error:favoritesError}=await sb.rpc('get_my_favorite_clubs');
      if(favoritesError)throw favoritesError;
      CU.favorite_clubs=Array.isArray(favorites)?favorites:[];
      window.FBZData?.invalidate('profile:');
      window.FBZHome?.sync(CU);
      const activeTab=clubTab;
      document.getElementById('clubC').innerHTML=renderClub(clubPayload);
      clubTab=activeTab;
      renderClubBody();
      setClubTab(activeTab);
      toast(next?'Клуб добавлен в избранное':'Клуб удалён из избранного','ok');
    }catch(error){
      console.error('Favorite club error:',error);
      if(button)button.disabled=false;
      toast('Не удалось изменить избранное','err');
    }
  }

  function performanceRow(item){
    const rating=ratingData(item.average);
    return`<button class="performance-row" type="button" onclick="go('md',{mid:${Number(item.match_id)}})">
      <span class="performance-match"><small>${matchDate(item.match_date)} · ${esc(item.league_name||'')}</small><strong>${esc(item.home_team_name)} <b>${esc(item.home_score??'—')} : ${esc(item.away_score??'—')}</b> ${esc(item.away_team_name)}</strong></span>
      <span class="performance-community" data-tone="${rating.tone}"><b>${rating.value}</b><small>${Number(item.rating_count)||0} ${plural(item.rating_count,'оценка','оценки','оценок')}</small></span>
      <span class="squad-player-arrow">→</span>
    </button>`;
  }

  function teammateCard(player){
    return`<button class="teammate-card" type="button" onclick="go('player',{id:${Number(player.id)}})">
      ${identityVisual({entity:player,kind:'player',className:'teammate-photo'})}
      <span><strong>${esc(player.name)}</strong><small>${esc(positionLabel(player.position))}</small></span>
      <b>${player.shirt_number?`#${esc(player.shirt_number)}`:'→'}</b>
    </button>`;
  }

  function renderPlayer(payload){
    const {player,stats}=payload;
    const club=player.club;
    const performances=Array.isArray(payload.performances)?payload.performances:[];
    const teammates=Array.isArray(payload.teammates)?payload.teammates:[];
    return`<article class="entity-shell player-shell">
      <header class="entity-hero player-hero">
        ${identityVisual({entity:player,kind:'player',className:'entity-mark player-mark',loading:'eager'})}
        <div class="entity-identity">
          <div class="entity-eyebrow"><span>Игрок</span>${player.shirt_number?`<b>№ ${esc(player.shirt_number)}</b>`:''}</div>
          <h1>${esc(player.name)}</h1>
          <div class="entity-meta"><span>${esc(positionLabel(player.position))}</span>${club?`<span>${clubRoute(club.id,club.name)}</span>`:player.team?`<span>${esc(player.team)}</span>`:''}</div>
        </div>
        ${club?identityVisual({entity:club,kind:'club',className:'entity-corner-mark'}):''}
        <button class="entity-share" type="button" onclick="copyAppLink('/player/${Number(player.id)}','Ссылка на игрока')" aria-label="Поделиться игроком" title="Поделиться">${ico('share',18)}</button>
      </header>
      <div class="entity-stat-strip player-stats">
        <div><strong>${ratingValue(stats.average)}</strong><span>Средняя оценка</span></div>
        <div><strong>${Number(stats.rating_count)||0}</strong><span>Оценок</span></div>
        <div><strong>${Number(stats.matches_rated)||0}</strong><span>Матчей оценено</span></div>
        <div><strong>${Number(stats.best_votes)||0}</strong><span>Лучший игрок</span></div>
      </div>
      <div class="entity-body player-body">
        <section class="entity-section">
          <header class="entity-section-head"><div><span>Оценки болельщиков</span><h2>Матчи игрока</h2></div><strong>${performances.length}</strong></header>
          <div class="performance-list">${performances.length?performances.map(performanceRow).join(''):'<div class="entity-inline-empty">Оценок в матчах пока нет</div>'}</div>
        </section>
        <section class="entity-section">
          <header class="entity-section-head"><div><span>${club?esc(club.short_name||club.name):'Команда'}</span><h2>Одноклубники</h2></div>${club?clubRoute(club.id,'Весь состав'):''}</header>
          <div class="teammate-grid">${teammates.length?teammates.map(teammateCard).join(''):'<div class="entity-inline-empty">Состав пока не опубликован</div>'}</div>
        </section>
      </div>
    </article>`;
  }

  async function loadPlayer(id){
    const numericId=Number(id);
    const target=document.getElementById('playerC');
    if(!target||!Number.isFinite(numericId))return;
    const request=++playerRequest;
    target.innerHTML=entityLoading('Загружаем игрока');
    try{
      const{data,error}=await sb.rpc('get_player_page',{p_player_id:numericId});
      if(error)throw error;
      if(request!==playerRequest)return;
      if(!data?.player){target.innerHTML=entityError('player',numericId);return;}
      target.innerHTML=renderPlayer(data);
      window.FBZSEO?.player(data.player);
    }catch(error){
      console.error('Player page error:',error);
      if(request===playerRequest)target.innerHTML=entityError('player',numericId);
    }
  }

  function competitionMatchRow(match){
    const score=match.status==='finished'||match.status==='live'?`${match.home_score??'—'} : ${match.away_score??'—'}`:'—';
    return`<button class="competition-match-row" type="button" onclick="go('md',{mid:${Number(match.id)}})">
      <time>${matchDate(match.match_date)}</time>
      <span><strong>${esc(match.home_team_name)}</strong><b>${esc(score)}</b><strong>${esc(match.away_team_name)}</strong></span>
      <small class="status-${esc(match.status||'')}">${esc(matchStatus(match))}</small><i>→</i>
    </button>`;
  }

  function renderCompetition(payload){
    const {competition,stats}=payload;
    const clubs=Array.isArray(payload.clubs)?payload.clubs:[];
    const matches=Array.isArray(payload.matches)?payload.matches:[];
    return`<article class="entity-shell competition-shell">
      <header class="entity-hero">
        ${identityVisual({entity:competition,kind:'competition',loading:'eager'})}
        <div class="entity-identity">
          <div class="entity-eyebrow"><span>Турнир</span>${competition.code?`<b>${esc(competition.code)}</b>`:''}</div>
          <h1>${esc(competition.name)}</h1>
          <div class="entity-meta">${[competition.area_name,competition.competition_type].filter(Boolean).map(item=>`<span>${esc(item)}</span>`).join('')}</div>
        </div>
        <button class="entity-share" type="button" onclick="copyAppLink('/competition/${Number(competition.id)}','Ссылка на турнир')" aria-label="Поделиться турниром" title="Поделиться">${ico('share',18)}</button>
      </header>
      <div class="entity-stat-strip">
        <div><strong>${Number(stats.club_count)||0}</strong><span>Клубов</span></div>
        <div><strong>${Number(stats.match_count)||0}</strong><span>Матчей</span></div>
        <div><strong>${Number(stats.finished_count)||0}</strong><span>Завершено</span></div>
        <div><strong>${Number(stats.upcoming_count)||0}</strong><span>Впереди</span></div>
      </div>
      <div class="entity-body competition-body">
        <section class="entity-section">
          <header class="entity-section-head"><div><span>Участники</span><h2>Клубы турнира</h2></div><strong>${clubs.length}</strong></header>
          <div class="competition-club-grid">${clubs.length?clubs.map(club=>`<button type="button" onclick="go('club',{id:${Number(club.id)}})">${identityVisual({entity:club,kind:'club',className:'competition-club-mark'})}<span><strong>${esc(club.name)}</strong><small>${esc(club.tla||club.short_name||'Клуб')}</small></span><i>→</i></button>`).join(''):'<div class="entity-inline-empty">Клубы пока не добавлены</div>'}</div>
        </section>
        <section class="entity-section">
          <header class="entity-section-head"><div><span>Календарь</span><h2>Матчи турнира</h2></div><strong>${matches.length}</strong></header>
          <div class="competition-match-list">${matches.length?matches.map(competitionMatchRow).join(''):'<div class="entity-inline-empty">Матчей пока нет</div>'}</div>
        </section>
      </div>
    </article>`;
  }

  async function loadCompetition(id){
    const numericId=Number(id);
    const target=document.getElementById('competitionC');
    if(!target||!Number.isFinite(numericId))return;
    const request=++competitionRequest;
    target.innerHTML=entityLoading('Загружаем турнир');
    try{
      const{data,error}=await sb.rpc('get_competition_page',{p_competition_id:numericId});
      if(error)throw error;
      if(request!==competitionRequest)return;
      if(!data?.competition){target.innerHTML=entityError('competition',numericId);return;}
      target.innerHTML=renderCompetition(data);
      window.FBZSEO?.competition(data.competition);
    }catch(error){
      console.error('Competition page error:',error);
      if(request===competitionRequest)target.innerHTML=entityError('competition',numericId);
    }
  }

  window.FBZEntities={loadClub,loadCompetition,loadPlayer,setClubTab,toggleFavorite};
})();
