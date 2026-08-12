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

  function initials(value){
    return String(value||'FB').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toLocaleUpperCase('ru-RU');
  }

  function identityVisual({name,image,className='entity-mark',number=''}){
    const safe=safeImageUrl(image);
    if(safe)return`<span class="${className} has-image"><img src="${safe}" alt="" loading="eager" decoding="async"></span>`;
    return`<span class="${className}" aria-hidden="true"><span>${esc(number||initials(name))}</span></span>`;
  }

  function positionLabel(value){return positionNames[value]||value||'Позиция не указана';}

  function ratingValue(value){
    if(value===null||value===undefined||value==='')return'—';
    const numeric=Number(value);
    return Number.isFinite(numeric)?numeric.toFixed(1):'—';
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
    const method=kind==='club'?'loadClub':'loadPlayer';
    return`<div class="entity-empty"><span class="entity-empty-code">404</span><h1>${kind==='club'?'Клуб':'Игрок'} не найден</h1><p>Данные могли обновиться. Попробуй открыть страницу ещё раз.</p><button class="btn btn-g" type="button" onclick="FBZEntities.${method}(${Number(id)})">Повторить</button></div>`;
  }

  function clubRoute(id,label){
    if(!id)return`<span>${esc(label||'Клуб')}</span>`;
    return`<button class="entity-text-link" type="button" onclick="go('club',{id:${Number(id)}})">${esc(label||'Клуб')}</button>`;
  }

  function playerRoute(id,label){
    return`<button class="entity-text-link" type="button" onclick="go('player',{id:${Number(id)}})">${esc(label)}</button>`;
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
    return`<button class="squad-player" type="button" onclick="go('player',{id:${Number(player.id)}})">
      ${identityVisual({name:player.name,image:player.photo_url,className:'squad-player-photo',number:player.shirt_number})}
      <span class="squad-player-copy"><strong>${esc(player.name)}</strong><small>${esc(positionLabel(player.position))}</small></span>
      <span class="squad-player-number">${player.shirt_number?`#${esc(player.shirt_number)}`:'—'}</span>
      <span class="squad-player-rating"><b>${ratingValue(player.average)}</b><small>${Number(player.rating_count)||0} ${plural(player.rating_count,'оценка','оценки','оценок')}</small></span>
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
        ${rated.length?rated.map((player,index)=>`<div class="entity-ranking-row"><span>${String(index+1).padStart(2,'0')}</span>${playerRoute(player.id,player.name)}<b>${ratingValue(player.average)}</b></div>`).join(''):'<div class="entity-inline-empty">Оценок игроков пока нет</div>'}
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
        ${identityVisual({name:club.name,image:club.crest_url})}
        <div class="entity-identity">
          <div class="entity-eyebrow"><span>Клуб</span>${club.tla?`<b>${esc(club.tla)}</b>`:''}</div>
          <h1>${esc(club.name)}</h1>
          <div class="entity-meta">${[club.area_name,club.venue,club.founded?`Основан в ${club.founded}`:''].filter(Boolean).map(item=>`<span>${esc(item)}</span>`).join('')}</div>
          ${competitions.length?`<div class="entity-chips">${competitions.map(item=>`<span>${esc(item)}</span>`).join('')}</div>`:''}
        </div>
        <button class="entity-share" type="button" onclick="copyAppLink('/club/${Number(club.id)}','Ссылка на клуб')" aria-label="Поделиться клубом" title="Поделиться">${ico('share',18)}</button>
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

  function performanceRow(item){
    return`<button class="performance-row" type="button" onclick="go('md',{mid:${Number(item.match_id)}})">
      <span class="performance-match"><small>${matchDate(item.match_date)} · ${esc(item.league_name||'')}</small><strong>${esc(item.home_team_name)} <b>${esc(item.home_score??'—')} : ${esc(item.away_score??'—')}</b> ${esc(item.away_team_name)}</strong></span>
      <span class="performance-community"><b>${ratingValue(item.average)}</b><small>${Number(item.rating_count)||0} ${plural(item.rating_count,'оценка','оценки','оценок')}</small></span>
      <span class="squad-player-arrow">→</span>
    </button>`;
  }

  function teammateCard(player){
    return`<button class="teammate-card" type="button" onclick="go('player',{id:${Number(player.id)}})">
      ${identityVisual({name:player.name,image:player.photo_url,className:'teammate-photo',number:player.shirt_number})}
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
        ${identityVisual({name:player.name,image:player.photo_url,className:'entity-mark player-mark',number:player.shirt_number})}
        <div class="entity-identity">
          <div class="entity-eyebrow"><span>Игрок</span>${player.shirt_number?`<b>№ ${esc(player.shirt_number)}</b>`:''}</div>
          <h1>${esc(player.name)}</h1>
          <div class="entity-meta"><span>${esc(positionLabel(player.position))}</span>${club?`<span>${clubRoute(club.id,club.name)}</span>`:player.team?`<span>${esc(player.team)}</span>`:''}</div>
        </div>
        ${club?identityVisual({name:club.name,image:club.crest_url,className:'entity-corner-mark'}):''}
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

  window.FBZEntities={loadClub,loadPlayer,setClubTab};
})();
