(function(root){
  'use strict';

  let requestVersion=0;

  function leagues(names){
    const target=document.getElementById('homeLeagueRibbon');if(!target)return;
    const items=[...new Set((Array.isArray(names)?names:[]).filter(name=>typeof name==='string'&&name.trim()))].slice(0,12);
    target.hidden=target.parentElement.hidden=!items.length;
    // Each identical half covers the widest ribbon, even with one short name.
    const repeated=Array.from({length:Math.ceil(12/(items.length||1))},()=>items).flat();
    const batch=repeated.map((name,index)=>`<span${index>=items.length?' data-repeat':''}>${root.ico('football',14)} ${esc(FBZNames.competition(name))}</span>`).join('');
    target.innerHTML=items.length?`<div class="home-league-track"><div>${batch}</div><div>${batch}</div></div>`:'';
  }

  function toggleRibbon(event,button){
    const paused=button.getAttribute('aria-pressed')!=='true';
    button.setAttribute('aria-pressed',String(paused));
    button.setAttribute('aria-label',paused?'Продолжить движение турниров':'Остановить движение турниров');
    button.innerHTML=root.ico(paused?'play':'pause',16);
    document.getElementById('homeLeagueRibbon').parentElement.classList.toggle('is-paused',paused);
  }

  function preferredName(user){
    return String(user?.display_name||user?.username||'болельщик').trim();
  }

  function renderOverview(user){
    const target=document.getElementById('homeOverview');
    if(!target)return;
    const ratings=Number(user?.ratings_count)||0;
    target.classList.toggle('is-first-steps',ratings===0);
    if(!ratings){
      const hasClubs=Boolean(user?.favorite_clubs?.length);
      target.innerHTML=`<button class="home-overview-item home-first-step" type="button" data-fbz-click="home.find-match"><span>${root.ico('star',17)} Дневник матчей</span><strong>Оценить первый матч</strong><small>Впечатление от игры по шкале 1–10. Текст и игроки — по желанию.</small></button>
        <button class="home-overview-item home-first-step" type="button" data-fbz-click="${hasClubs?'home.favorite-matches':'home.find-club'}"><span>${root.ico('football',17)} Клубы</span><strong>${hasClubs?'Избранное':'Выбрать любимый клуб'}</strong><small>${hasClubs?'Календарь встреч выбранных клубов.':'Звёздочка на странице клуба добавит его в ваш календарь.'}</small></button>
        <button class="home-overview-item home-first-step" type="button" data-fbz-click="shell.go-feed"><span>${root.ico('users',17)} Лента</span><strong>Посмотреть оценки</strong><small>Читайте впечатления болельщиков. Сравнить оценки можно в их профиле.</small></button>`;
      return;
    }
    const average=Number(user?.avg_rating);
    const streak=root.activeProfileStreak(user);
    const streakDays=new Intl.PluralRules('ru-RU').select(streak);
    target.innerHTML=`
      <button class="home-overview-item" type="button" data-fbz-click="shell.go-own-profile">
        <span>${root.ico('star',17)} Оценки</span><strong>${ratings.toLocaleString('ru-RU')}</strong><small>ваша история матчей</small>
      </button>
      <button class="home-overview-item" type="button" data-fbz-click="shell.go-own-profile">
        <span>${root.ico('chart',17)} Средняя</span><strong class="rating-ink" data-tone="${root.FBZDomain.ratingTone(ratings?average:null)}">${Number.isFinite(average)&&ratings?average.toFixed(1):'—'}</strong><small>${ratings?'по вашим оценкам':'появится после оценки'}</small>
      </button>
      <button class="home-overview-item" type="button" data-fbz-click="shell.go-own-profile">
        <span>${root.ico('fire',17)} Серия</span><strong>${streak||'—'}</strong><small>${streak?`${streak} ${{one:'день',few:'дня',many:'дней',other:'дня'}[streakDays]} подряд`:'начните с одного матча'}</small>
      </button>`;
  }

  function renderFavorites(user){
    const target=document.getElementById('homeFavoriteTeams');
    if(!target)return;
    const clubs=Array.isArray(user?.favorite_clubs)?user.favorite_clubs.slice(0,6):[];
    if(clubs.length){
      target.innerHTML=`<div class="home-team-list">${clubs.map(club=>`<button type="button" ${FBZActions.attrs("home.go-club",[Number(club.id)])}>${root.FBZMedia.visual({entity:club,kind:'club',className:'home-club-mark'})}<span>${root.esc(FBZNames.club(club))}</span></button>`).join('')}</div><button class="btn btn-g btn-sm" type="button" data-fbz-click="home.favorite-matches">Избранное</button><button class="text-action" type="button" data-fbz-click="home.find-club">Добавить клуб →</button>`;
      return;
    }
    target.innerHTML=`<div class="home-club-empty">${root.ico('football',21)}<strong>Клубы пока не выбраны</strong><p>Добавьте любимые клубы в избранное, чтобы быстро открывать их составы и матчи.</p><button class="btn btn-g btn-sm" type="button" data-fbz-click="home.find-club">Найти клуб</button></div>`;
  }

  function spotlight(items,error=false){
    const target=document.getElementById('homeMatchSpotlight');
    if(!target)return;
    const matches=Array.isArray(items)?items:[];
    const now=Date.now();
    const match=matches.find(item=>root.FBZDomain.matchScorePresentation(item).isLive)
      ||matches.find(item=>item.status==='scheduled'&&new Date(item.match_date).getTime()>=now)
      ||matches.find(item=>item.status==='finished')
      ||matches[0];
    if(!match){
      target.innerHTML=`<div class="home-spotlight-empty"><span class="section-kicker">Матч в фокусе</span><strong>${error?'Не удалось загрузить матчи':'Футбольный календарь готовится'}</strong><p>${error?'Остальные разделы продолжают работать.':'Когда появятся встречи, здесь будет главное событие для вас.'}</p><button class="btn btn-g" type="button" data-fbz-click="${error?'matches.load-home-m':'shell.go-matches'}">${error?'Повторить':'Открыть календарь'}</button></div>`;
      return;
    }
    const id=Number(match.id);
    if(!Number.isSafeInteger(id)||id<=0){target.replaceChildren();return;}
    const date=new Date(match.match_date);
    const dateLabel=Number.isFinite(date.getTime())?date.toLocaleDateString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):'Дата уточняется';
    const presentation=root.FBZDomain.matchScorePresentation(match);
    const finished=match.status==='finished',live=presentation.isLive;
    const homeName=root.FBZDomain.matchTeamName(match,'home');
    const awayName=root.FBZDomain.matchTeamName(match,'away');
    target.innerHTML=`<article class="home-spotlight${live?' is-live':''}" style="${root.FBZDomain.matchPaletteStyle(match)}" aria-label="Матч в фокусе: ${root.esc(homeName)} — ${root.esc(awayName)}">
      <div class="home-spotlight-main">
        <div class="home-spotlight-top"><span class="home-spotlight-overline">Матч в фокусе</span><span class="home-spotlight-status">${live?'<span class="live-dot"></span>':''}${presentation.status}</span></div>
        <p class="home-spotlight-league">${root.esc(FBZNames.competition(match.league_name)||'Футбол')}</p>
        <a class="mc-score-block mc-score-link home-spotlight-score" href="${root.esc(FBZLocale.path(`/match/${id}`))}" ${FBZActions.attrs("home.go-md",[id])} aria-label="Открыть матч: ${root.esc(homeName)} против ${root.esc(awayName)}, ${presentation.label} ${presentation.home} : ${presentation.away}">
          <span class="mc-score-team">${root.matchClubMark(match,'home','home-spotlight-mark','eager')}<span class="mc-score-name">${root.esc(homeName)}</span></span>
          <span class="mc-score-result"><span class="mc-score-num">${presentation.home}<span class="mc-score-separator">:</span>${presentation.away}</span><span class="mc-score-vs">${presentation.label}</span></span>
          <span class="mc-score-team">${root.matchClubMark(match,'away','home-spotlight-mark','eager')}<span class="mc-score-name">${root.esc(awayName)}</span></span>
        </a>
        <div class="home-spotlight-footer"><span class="home-spotlight-date">${root.ico('calendar',15)} ${root.esc(dateLabel)}</span><div class="home-spotlight-actions"><button class="home-spotlight-primary" type="button" ${FBZActions.attrs(finished?'home.open-rate':'home.go-md',[id])}>${finished?'Оценить матч':'Открыть матч'} <span aria-hidden="true">↗</span></button></div></div>
        <p class="home-spotlight-caption">${finished?'Счёт — только часть истории. Какой была игра для вас?':live?'Матч идёт. Ваше впечатление можно будет сохранить после финального свистка.':'Откройте матч, чтобы посмотреть подробности встречи.'}</p>
      </div>
    </article>`;
  }

  function pendingMatch(match){
    const date=new Date(match.match_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
    return`<article class="home-pending-match">
      <button type="button" ${FBZActions.attrs("home.go-md",[Number(match.id)])}>
        <span class="home-pending-meta">${root.esc(FBZNames.competition(match.league_name))} · ${root.esc(date)}</span>
        <strong><span class="home-pending-club">${root.matchClubMark(match,'home','home-club-mark')}<span>${root.esc(FBZNames.club(match.home_team_name))}</span></span><b>${root.esc(match.home_score??'—')} : ${root.esc(match.away_score??'—')}</b><span class="home-pending-club">${root.matchClubMark(match,'away','home-club-mark')}<span>${root.esc(FBZNames.club(match.away_team_name))}</span></span></strong>
      </button>
      <button class="home-pending-rate" type="button" ${FBZActions.attrs("home.open-rate",[Number(match.id)])}>${root.ico('star',15)} Оценить</button>
    </article>`;
  }

  async function loadPending(user,version){
    const target=document.getElementById('homePendingRatings');
    if(!target)return;
    try{
      const page=await root.FBZData.getMatchesPage({status:'finished',limit:12});
      const matches=Array.isArray(page?.items)?page.items:[];
      const ids=matches.map(match=>Number(match.id)).filter(Number.isSafeInteger);
      let ratedIds=new Set();
      if(ids.length){
        const{data,error}=await root.sb.from('ratings').select('match_id').eq('user_id',user.id).in('match_id',ids);
        if(error)throw error;
        ratedIds=new Set((data||[]).map(item=>Number(item.match_id)));
      }
      if(version!==requestVersion)return;
      const pending=matches.filter(match=>!ratedIds.has(Number(match.id))).slice(0,3);
      target.innerHTML=pending.length
        ?`<div class="home-pending-list">${pending.map(pendingMatch).join('')}</div>`
        :`<div class="home-priority-empty">${root.ico('check',22)}<div><strong>${matches.length?'Всё оценено в этой подборке':'Пока нет недавних матчей'}</strong><p>${matches.length?'Все игры из этой подборки уже в вашем дневнике. Остальные матчи можно найти в календаре.':'Завершённые матчи появятся здесь после обновления календаря.'}</p></div></div>`;
    }catch(error){
      if(version!==requestVersion)return;
      console.warn('Home dashboard load error:',error);
      target.innerHTML='<div class="home-priority-empty"><div><strong>Не удалось загрузить рекомендации</strong><p>Остальные разделы продолжают работать.</p></div><button class="btn btn-g btn-sm" type="button" data-fbz-click="home.home-reload">Повторить</button></div>';
    }
  }

  function sync(user){
    requestVersion++;
    const dashboard=document.getElementById('homeDashboard');
    if(!dashboard)return;
    if(!user){dashboard.setAttribute('aria-hidden','true');return;}
    dashboard.removeAttribute('aria-hidden');
    const lead=document.getElementById('homeDashboardLead');
    const title=document.getElementById('homeDashboardTitle');
    const first=!(Number(user.ratings_count)>0);
    if(title)title.textContent=first?'Ваш первый матч в FOOTBAZED':`С возвращением, ${preferredName(user)}`;
    if(lead)lead.textContent=first?'Оцените игру, которую смотрели. Она останется в вашей истории.':'Недавние матчи и любимые клубы.';
    renderOverview(user);
    renderFavorites(user);
    const version=requestVersion;
    loadPending(user,version);
  }

  function reload(){
    root.refreshHomeDashboard?.();
  }

  function favoriteMatches(){
    if(!CU){openAuth();return;}
    MF='all';ML='all';
    const input=document.getElementById('msearch');if(input)input.value='';
    document.querySelectorAll('#mf .btn').forEach(button=>{
      const selected=button.dataset.fbzClick==='shell.set-mf-all';
      button.className=selected?'btn btn-l btn-sm':'btn btn-g btn-sm';
      button.setAttribute('aria-pressed',String(selected));
    });
    go('matches',{favoritesOnly:true});
  }

  root.FBZHome=Object.freeze({reload,sync,spotlight,leagues,toggleRibbon,favoriteMatches});
})(window);

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "home.find-match":()=>openGlobalSearch('match'),
  "home.find-club":()=>openGlobalSearch('club'),
  "home.favorite-matches":()=>FBZHome.favoriteMatches(),
  "home.toggle-ribbon":(event,button)=>FBZHome.toggleRibbon(event,button),
  "home.go-club":(event,element,[id])=>go('club',{id:id}),
  "home.go-md":(event,element,[id])=>FBZActions.follow(event,element,()=>go('md',{mid:id})),
  "home.open-rate":(event,element,[id])=>openRate(id),
  "home.home-reload":()=>FBZHome.reload()
});
