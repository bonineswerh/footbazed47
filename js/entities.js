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
  let entityRequest=0;
  const favoriteRequests=new Set();

  function startRequest(kind,target){
    const version=++entityRequest;
    const userId=CU?.id||null;
    target.setAttribute('aria-busy','true');
    return()=>version===entityRequest&&CP===kind&&(CU?.id||null)===userId;
  }

  function initials(value){
    return String(value||'FB').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toLocaleUpperCase('ru-RU');
  }

  function identityVisual({entity={},name='',media=null,kind='other',className='entity-mark',loading='lazy'}){
    return window.FBZMedia.visual({entity:{...entity,name:name||entity.name,media:media||entity.media},kind,className,loading});
  }

  function positionLabel(value){return positionNames[value]||value||'Позиция не указана';}

  function ratingValue(value){
    return ratingData(value).value;
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
    return`<div class="entity-loading" role="status"><div class="spin"></div><span>${esc(label)}</span></div>`;
  }

  function entityError(kind,id,missing=false){
    const config={club:['loadClub','Клуб'],player:['loadPlayer','Игрок'],competition:['loadCompetition','Турнир']}[kind]||['loadClub','Объект'];
    return`<div class="entity-empty" role="status">${missing?'<span class="entity-empty-code">404</span>':''}<h1>${missing?`${config[1]} не найден`:'Не удалось загрузить страницу'}</h1><p>${missing?'Проверьте ссылку или найдите нужную страницу через поиск.':'Проверьте соединение и попробуйте ещё раз.'}</p><button class="btn btn-g" type="button" ${FBZActions.attrs(missing?'shell.open-global-search':'entities.retry',[kind,Number(id)])}>${missing?'Открыть поиск':'Повторить'}</button></div>`;
  }

  function clubRoute(id,label){
    if(!id)return`<span>${esc(label||'Клуб')}</span>`;
    return`<button class="entity-text-link" type="button" ${FBZActions.attrs("entities.go-club",[Number(id)])}>${esc(label||'Клуб')}</button>`;
  }

  function playerRoute(id,label){
    return`<button class="entity-text-link" type="button" ${FBZActions.attrs("entities.go-player",[Number(id)])}>${esc(label)}</button>`;
  }

  function competitionRoute(id,label){
    if(!id)return`<span>${esc(label||'Турнир')}</span>`;
    return`<button class="entity-text-link" type="button" ${FBZActions.attrs("entities.go-competition",[Number(id)])}>${esc(label||'Турнир')}</button>`;
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
      <button class="entity-match-main" type="button" ${FBZActions.attrs("entities.go-md",[Number(match.id)])}>
        <span class="entity-match-date">${matchDate(match.match_date)}</span>
        <span class="entity-match-opponent"><small>${isHome?'Дома':'В гостях'} · ${esc(match.league_name||'')}</small><strong>${esc(opponent||'Соперник')}</strong></span>
        <span class="entity-match-score">${esc(score)}</span>
        <span class="entity-match-status status-${esc(match.status||'')}">${esc(matchStatus(match))}</span>
      </button>
      ${opponentId?`<button class="entity-match-club" type="button" ${FBZActions.attrs("entities.go-club",[Number(opponentId)])} aria-label="Открыть ${esc(opponent)}">→</button>`:''}
    </article>`;
  }

  function squadGroup(player){
    return positionGroups.find(group=>group.codes.includes(player.position))||{key:'other',label:'Другие'};
  }

  function renderPlayerRow(player){
    const rating=ratingData(player.average);
    return`<button class="squad-player" type="button" ${FBZActions.attrs("entities.go-player",[Number(player.id)])}>
      ${identityVisual({entity:player,kind:'player',className:'squad-player-photo'})}
      <span class="squad-player-copy"><strong>${esc(player.name)}</strong><small>${esc(positionLabel(player.position))}</small>${Number(player.unverified_rating_count)>0?'<small class="entity-evidence">Есть оценки без подтверждения участия</small>':''}</span>
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
    const rated=Array.isArray(payload.rated_performers)?payload.rated_performers:topPlayers(payload.squad);
    return`<div class="entity-overview-grid">
      <section class="entity-section">
        <header class="entity-section-head"><div><span>Календарь</span><h2>Ближайшие матчи</h2></div><button type="button" data-fbz-click="entities.set-club-tab-matches">Все матчи</button></header>
        <div class="entity-match-list">${upcoming.length?upcoming.map(match=>renderMatchRow(match,payload.club.id)).join(''):'<div class="entity-inline-empty">Предстоящих матчей пока нет</div>'}</div>
      </section>
      <aside class="entity-section entity-rankings">
        <header class="entity-section-head"><div><span>Сообщество</span><h2>${Array.isArray(payload.rated_performers)?'Выступления за клуб':'Игроки клуба'}</h2></div></header>
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
      item.tabIndex=active?0:-1;
    });
    document.getElementById('clubBody')?.setAttribute('aria-labelledby',`club-tab-${tab}`);
    renderClubBody();
  }

  function onClubTabKey(event){
    const tabs=[...document.querySelectorAll('#clubTabs .entity-tab')];
    const index=tabs.indexOf(event.target);
    if(index<0)return;
    const next={ArrowRight:(index+1)%tabs.length,ArrowLeft:(index+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[event.key];
    if(next===undefined)return;
    event.preventDefault();
    setClubTab(tabs[next].dataset.tab);
    tabs[next].focus();
  }

  function renderClub(payload){
    const {club,stats}=payload;
    const competitions=Array.isArray(payload.competitions)?payload.competitions:[];
    const historical=stats.performance_scope==='confirmed_historical';
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
          <button class="entity-favorite${payload.is_favorite?' on':''}" id="clubFavoriteButton" type="button" aria-pressed="${String(Boolean(payload.is_favorite))}" data-fbz-click="entities.toggle-favorite" title="${payload.is_favorite?'Убрать из избранного':'Добавить в избранное'}">${ico('star',18)}<span>${payload.is_favorite?'В избранном':'В избранное'}</span></button>
          <button class="entity-share" type="button" ${FBZActions.attrs("entities.share-club",[Number(club.id)])} aria-label="Поделиться клубом" title="Поделиться">${ico('share',18)}</button>
        </div>
      </header>
      <div class="entity-stat-strip">
        <div><strong>${Number(stats.squad_count)||0}</strong><span>Игроков</span></div>
        <div><strong>${Number(stats.match_count)||0}</strong><span>Матчей</span></div>
        <div><strong>${Number(stats.upcoming_count)||0}</strong><span>Впереди</span></div>
        <div><strong class="rating-ink" data-tone="${ratingData(stats.player_rating).tone}">${ratingValue(stats.player_rating)}</strong><span>Оценка выступлений</span></div>
      </div>
      <p class="entity-rating-context">${Number(stats.player_rating_count)>0?`${FBZDomain.countLabel(Number(stats.player_rating_count),{one:'оценка',few:'оценки',many:'оценок'})} выступлений${stats.rated_player_count!=null?` · ${FBZDomain.countLabel(Number(stats.rated_player_count),{one:'игрок',few:'игрока',many:'игроков'})}`:''}${stats.player_match_count!=null?` · ${FBZDomain.countLabel(Number(stats.player_match_count),{one:'матч',few:'матча',many:'матчей'})}`:''}. Это впечатления от отдельных выступлений, а не оценка всего состава.`:historical?'Оценок подтверждённых выступлений за этот клуб пока нет.':'Оценок выступлений пока нет.'}${historical?' Учитываются выступления за клуб на дату матча, включая игроков, которые позже сменили команду.':''}${Number(stats.unverified_player_rating_count)>0?(historical?` В матчах клуба есть ${FBZDomain.countLabel(Number(stats.unverified_player_rating_count),{one:'прежняя оценка',few:'прежние оценки',many:'прежних оценок'})} без подтверждения участия. Они сохранены в истории игроков и не приписываются ни одной команде.`:' Есть ранее сохранённые оценки игроков, участие которых в матче ещё не подтверждено.'):''}</p>
      <div class="entity-tabs" id="clubTabs" role="tablist" aria-label="Разделы клуба" data-fbz-keydown="entities.on-club-tab-key">
        <button class="entity-tab on" id="club-tab-overview" data-tab="overview" role="tab" aria-controls="clubBody" aria-selected="true" tabindex="0" type="button" data-fbz-click="entities.set-club-tab-overview">Обзор</button>
        <button class="entity-tab" id="club-tab-squad" data-tab="squad" role="tab" aria-controls="clubBody" aria-selected="false" tabindex="-1" type="button" data-fbz-click="entities.set-club-tab-squad">Состав <span>${Number(stats.squad_count)||0}</span></button>
        <button class="entity-tab" id="club-tab-matches" data-tab="matches" role="tab" aria-controls="clubBody" aria-selected="false" tabindex="-1" type="button" data-fbz-click="entities.set-club-tab-matches-2">Матчи <span>${Number(stats.match_count)||0}</span></button>
      </div>
      <div class="entity-body" id="clubBody" role="tabpanel" aria-labelledby="club-tab-overview" tabindex="0"></div>
      ${FBZMedia.resolveAsset(club.media,'club_logo')?.sourceProvider==='api-football'?'<p class="entity-media-credit">Эмблема клуба · <a href="https://www.api-football.com/terms" target="_blank" rel="noopener noreferrer">API-Football / API-Sports</a></p>':''}
    </article>`;
  }

  async function loadClub(id){
    const numericId=Number(id);
    const target=document.getElementById('clubC');
    if(!target||!Number.isSafeInteger(numericId)||numericId<1)return;
    const isCurrent=startRequest('club',target);
    clubPayload=null;
    target.innerHTML=entityLoading('Загружаем клуб');
    try{
      const{data,error}=await sb.rpc('get_club_page',{p_club_id:numericId});
      if(error)throw error;
      if(!isCurrent())return;
      if(!data?.club){target.innerHTML=entityError('club',numericId,true);return;}
      clubPayload={...data,squad:Array.isArray(data.squad)?data.squad:[],matches:Array.isArray(data.matches)?data.matches:[]};
      clubTab='overview';
      target.innerHTML=renderClub(clubPayload);
      renderClubBody();
      syncFavoriteButton();
      window.FBZSEO?.club(data.club);
    }catch(error){
      console.error('Club page error:',error);
      if(isCurrent())target.innerHTML=entityError('club',numericId);
    }finally{
      if(isCurrent())target.setAttribute('aria-busy','false');
    }
  }

  function syncFavoriteButton(){
    const button=document.getElementById('clubFavoriteButton');
    if(!button||!clubPayload)return;
    const favorite=Boolean(clubPayload.is_favorite);
    const busy=favoriteRequests.has(`${CU?.id}:${clubPayload.club.id}`);
    button.setAttribute('aria-disabled',String(busy));
    button.classList.toggle('on',favorite);
    button.setAttribute('aria-pressed',String(favorite));
    button.setAttribute('aria-busy',String(busy));
    button.title=favorite?'Убрать из избранного':'Добавить в избранное';
    button.querySelector('span').textContent=busy?'Сохраняем…':favorite?'В избранном':'В избранное';
  }

  async function toggleFavorite(){
    if(!clubPayload?.club)return;
    if(!CU){openAuth();return;}
    const payload=clubPayload;
    const clubId=Number(payload.club.id);
    const userId=CU.id;
    const key=`${userId}:${clubId}`;
    if(favoriteRequests.has(key))return;
    favoriteRequests.add(key);
    syncFavoriteButton();
    const next=!Boolean(payload.is_favorite);
    try{
      const{data,error}=await sb.rpc('set_favorite_club',{p_club_id:clubId,p_favorite:next});
      if(error)throw error;
      if(CU?.id!==userId)return;
      const favorite=Boolean(data?.is_favorite);
      if(Number(clubPayload?.club.id)===clubId)clubPayload.is_favorite=favorite;
      const favorites=(CU.favorite_clubs||[]).filter(club=>Number(club.id)!==clubId);
      if(favorite)favorites.push({...payload.club,favorited_at:new Date().toISOString()});
      CU.favorite_clubs=favorites;
      window.FBZData?.invalidate('profile:');
      window.FBZHome?.sync(CU);
      toast(favorite?'Клуб добавлен в избранное':'Клуб удалён из избранного','ok');
    }catch(error){
      console.error('Favorite club error:',error);
      if(CU?.id===userId)toast('Не удалось изменить избранное','err');
    }finally{
      favoriteRequests.delete(key);
      syncFavoriteButton();
    }
  }

  function performanceRow(item){
    const rating=ratingData(item.average);
    return`<button class="performance-row" type="button" ${FBZActions.attrs("entities.go-md",[Number(item.match_id)])}>
      <span class="performance-match"><small>${matchDate(item.match_date)} · ${esc(item.league_name||'')}</small><strong>${esc(item.home_team_name)} <b>${esc(item.home_score??'—')} : ${esc(item.away_score??'—')}</b> ${esc(item.away_team_name)}</strong>${item.historical_team?`<small>Выступление за ${esc(item.historical_team)}</small>`:''}${item.participation_verified===false?'<small class="entity-evidence">Участие в матче не подтверждено</small>':''}</span>
      <span class="performance-community" data-tone="${rating.tone}"><b>${rating.value}</b><small>${Number(item.rating_count)||0} ${plural(item.rating_count,'оценка','оценки','оценок')}</small></span>
      <span class="squad-player-arrow">→</span>
    </button>`;
  }

  function teammateCard(player){
    return`<button class="teammate-card" type="button" ${FBZActions.attrs("entities.go-player",[Number(player.id)])}>
      ${identityVisual({entity:player,kind:'player',className:'teammate-photo'})}
      <span><strong>${esc(player.name)}</strong><small>${esc(positionLabel(player.position))}</small></span>
      <b>${player.shirt_number?`#${esc(player.shirt_number)}`:'→'}</b>
    </button>`;
  }

  function renderPlayer(payload){
    const {player,stats}=payload;
    const club=player.club;
    const historical=stats.performance_scope==='confirmed_historical';
    const performances=Array.isArray(payload.performances)?payload.performances:[];
    const teammates=Array.isArray(payload.teammates)?payload.teammates:[];
    return`<article class="entity-shell player-shell">
      <header class="entity-hero player-hero">
        ${identityVisual({entity:player,kind:'player',className:'entity-mark player-mark',loading:'eager'})}
        <div class="entity-identity">
          <div class="entity-eyebrow"><span>Игрок</span>${player.shirt_number?`<b>№ ${esc(player.shirt_number)}</b>`:''}</div>
          <h1>${esc(player.name)}</h1>
          <div class="entity-meta"><span>${esc(positionLabel(player.position))}</span>${club?`<span>${historical?'Клуб в каталоге: ':''}${clubRoute(club.id,club.name)}</span>`:player.team?`<span>${esc(player.team)}</span>`:''}</div>
        </div>
        ${club?identityVisual({entity:club,kind:'club',className:'entity-corner-mark'}):''}
        <button class="entity-share" type="button" ${FBZActions.attrs("entities.share-player",[Number(player.id)])} aria-label="Поделиться игроком" title="Поделиться">${ico('share',18)}</button>
      </header>
      <div class="entity-stat-strip player-stats">
        <div><strong class="rating-ink" data-tone="${ratingData(stats.average).tone}">${ratingValue(stats.average)}</strong><span>${historical?'Оценка выступлений':'Средняя оценка'}</span></div>
        <div><strong>${Number(stats.rating_count)||0}</strong><span>Оценок</span></div>
        <div><strong>${Number(stats.matches_rated)||0}</strong><span>Матчей оценено</span></div>
        <div><strong>${Number(stats.best_votes)||0}</strong><span>Лучший игрок</span></div>
      </div>
      <div class="entity-body player-body">
        ${historical?'<p class="entity-rating-context">Средняя и выбор лучшего игрока учитывают только подтверждённых участников матча: стартовых игроков и вышедших на замену.</p>':''}
        ${Number(stats.unverified_rating_count)>0?(historical?`<details class="entity-legacy"><summary>Ранее сохранённые оценки · ${Number(stats.unverified_rating_count)}</summary><p>Средняя <strong class="rating-ink" data-tone="${ratingData(stats.unverified_average).tone}">${ratingValue(stats.unverified_average)}/10</strong> по ${FBZDomain.countLabel(Number(stats.unverified_rating_count),{one:'оценке',few:'оценкам',many:'оценкам'})}. Участие в этих матчах пока не подтверждено. Оценки сохранены в истории ниже и показаны отдельно от подтверждённых выступлений.</p></details>`:'<p class="entity-rating-context">Средняя включает ранее сохранённые оценки без подтверждения участия в матче. Они отмечены в списке ниже.</p>'):''}
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
    if(!target||!Number.isSafeInteger(numericId)||numericId<1)return;
    const isCurrent=startRequest('player',target);
    target.innerHTML=entityLoading('Загружаем игрока');
    try{
      const{data,error}=await sb.rpc('get_player_page',{p_player_id:numericId});
      if(error)throw error;
      if(!isCurrent())return;
      if(!data?.player){target.innerHTML=entityError('player',numericId,true);return;}
      target.innerHTML=renderPlayer(data);
      window.FBZSEO?.player(data.player);
    }catch(error){
      console.error('Player page error:',error);
      if(isCurrent())target.innerHTML=entityError('player',numericId);
    }finally{
      if(isCurrent())target.setAttribute('aria-busy','false');
    }
  }

  function competitionMatchRow(match){
    const score=match.status==='finished'||match.status==='live'?`${match.home_score??'—'} : ${match.away_score??'—'}`:'—';
    return`<button class="competition-match-row" type="button" ${FBZActions.attrs("entities.go-md",[Number(match.id)])}>
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
        <button class="entity-share" type="button" ${FBZActions.attrs("entities.share-competition",[Number(competition.id)])} aria-label="Поделиться турниром" title="Поделиться">${ico('share',18)}</button>
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
          <div class="competition-club-grid">${clubs.length?clubs.map(club=>`<button type="button" ${FBZActions.attrs("entities.go-club",[Number(club.id)])}>${identityVisual({entity:club,kind:'club',className:'competition-club-mark'})}<span><strong>${esc(club.name)}</strong><small>${esc(club.tla||club.short_name||'Клуб')}</small></span><i>→</i></button>`).join(''):'<div class="entity-inline-empty">Клубы пока не добавлены</div>'}</div>
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
    if(!target||!Number.isSafeInteger(numericId)||numericId<1)return;
    const isCurrent=startRequest('competition',target);
    target.innerHTML=entityLoading('Загружаем турнир');
    try{
      const{data,error}=await sb.rpc('get_competition_page',{p_competition_id:numericId});
      if(error)throw error;
      if(!isCurrent())return;
      if(!data?.competition){target.innerHTML=entityError('competition',numericId,true);return;}
      target.innerHTML=renderCompetition(data);
      window.FBZSEO?.competition(data.competition);
    }catch(error){
      console.error('Competition page error:',error);
      if(isCurrent())target.innerHTML=entityError('competition',numericId);
    }finally{
      if(isCurrent())target.setAttribute('aria-busy','false');
    }
  }

  window.FBZEntities={loadClub,loadCompetition,loadPlayer,onClubTabKey,setClubTab,toggleFavorite};
})();

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "entities.retry":(event,element,[kind,id])=>({club:FBZEntities.loadClub,player:FBZEntities.loadPlayer,competition:FBZEntities.loadCompetition}[kind]?.(id)),
  "entities.go-club":(event,element,[id])=>go('club',{id:id}),
  "entities.go-player":(event,element,[id])=>go('player',{id:id}),
  "entities.go-competition":(event,element,[id])=>go('competition',{id:id}),
  "entities.go-md":(event,element,[id])=>go('md',{mid:id}),
  "entities.set-club-tab-matches":()=>FBZEntities.setClubTab('matches'),
  "entities.toggle-favorite":()=>FBZEntities.toggleFavorite(),
  "entities.share-club":(event,element,[id])=>copyAppLink(("/club/"+id),'Ссылка на клуб'),
  "entities.on-club-tab-key":(event)=>FBZEntities.onClubTabKey(event),
  "entities.set-club-tab-overview":(event,element)=>FBZEntities.setClubTab('overview',element),
  "entities.set-club-tab-squad":(event,element)=>FBZEntities.setClubTab('squad',element),
  "entities.set-club-tab-matches-2":(event,element)=>FBZEntities.setClubTab('matches',element),
  "entities.share-player":(event,element,[id])=>copyAppLink(("/player/"+id),'Ссылка на игрока'),
  "entities.share-competition":(event,element,[id])=>copyAppLink(("/competition/"+id),'Ссылка на турнир')
});
