(function(root){
  'use strict';

  let requestVersion=0;

  function preferredName(user){
    return String(user?.display_name||user?.username||'болельщик').trim();
  }

  function renderOverview(user){
    const target=document.getElementById('homeOverview');
    if(!target)return;
    const ratings=Number(user?.ratings_count)||0;
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
      target.innerHTML=`<div class="home-team-list">${clubs.map(club=>`<button type="button" ${FBZActions.attrs("home.go-club",[Number(club.id)])}>${root.FBZMedia.visual({entity:club,kind:'club',className:'home-club-mark'})}<span>${root.esc(FBZNames.club(club))}</span></button>`).join('')}</div><p>Откройте клуб, чтобы посмотреть его состав и календарь.</p><button class="text-action" type="button" data-fbz-click="shell.open-global-search">Добавить клуб →</button>`;
      return;
    }
    target.innerHTML=`<div class="home-club-empty">${root.ico('football',21)}<strong>Клубы пока не выбраны</strong><p>Добавьте любимые клубы в избранное, чтобы быстро открывать их составы и матчи.</p><button class="btn btn-g btn-sm" type="button" data-fbz-click="shell.open-global-search">Найти клуб</button></div>`;
  }

  function spotlight(items,error=false){
    const target=document.getElementById('homeMatchSpotlight');
    if(!target)return;
    const matches=Array.isArray(items)?items:[];
    const now=Date.now();
    const match=matches.find(item=>item.status==='live')
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
    const finished=match.status==='finished',live=match.status==='live';
    const presentation=root.FBZDomain.matchScorePresentation(match);
    const homeName=root.FBZDomain.matchTeamName(match,'home');
    const awayName=root.FBZDomain.matchTeamName(match,'away');
    target.innerHTML=`<article class="home-spotlight${live?' is-live':''}" style="${root.FBZDomain.matchPaletteStyle(match)}" aria-label="Матч в фокусе: ${root.esc(homeName)} — ${root.esc(awayName)}">
      <div class="home-spotlight-main">
        <div class="home-spotlight-top"><span class="home-spotlight-overline">Матч в фокусе</span><span class="home-spotlight-status">${live?'<span class="live-dot"></span>':''}${presentation.status}</span></div>
        <p class="home-spotlight-league">${root.esc(FBZNames.competition(match.league_name)||'Футбол')}</p>
        <button class="mc-score-block mc-score-link home-spotlight-score" type="button" ${FBZActions.attrs("home.go-md",[id])} aria-label="Открыть матч: ${root.esc(homeName)} против ${root.esc(awayName)}, ${presentation.label} ${presentation.home} : ${presentation.away}">
          <span class="mc-score-team">${root.matchClubMark(match,'home','home-spotlight-mark','eager')}<span class="mc-score-name">${root.esc(homeName)}</span></span>
          <span class="mc-score-result"><span class="mc-score-num">${presentation.home}<span class="mc-score-separator">:</span>${presentation.away}</span><span class="mc-score-vs">${presentation.label}</span></span>
          <span class="mc-score-team">${root.matchClubMark(match,'away','home-spotlight-mark','eager')}<span class="mc-score-name">${root.esc(awayName)}</span></span>
        </button>
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
        <strong><span>${root.esc(FBZNames.club(match.home_team_name))}</span><b>${root.esc(match.home_score??'—')} : ${root.esc(match.away_score??'—')}</b><span>${root.esc(FBZNames.club(match.away_team_name))}</span></strong>
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
    if(title)title.textContent=`С возвращением, ${preferredName(user)}`;
    if(lead)lead.textContent='Ваши оценки, ближайшие матчи и сообщество — без лишних шагов.';
    renderOverview(user);
    renderFavorites(user);
    const version=requestVersion;
    loadPending(user,version);
  }

  function reload(){
    root.refreshHomeDashboard?.();
  }

  root.FBZHome=Object.freeze({reload,sync,spotlight});
})(window);

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "home.go-club":(event,element,[id])=>go('club',{id:id}),
  "home.go-md":(event,element,[id])=>go('md',{mid:id}),
  "home.open-rate":(event,element,[id])=>openRate(id),
  "home.home-reload":()=>FBZHome.reload()
});
