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
      target.innerHTML=`<div class="home-team-list">${clubs.map(club=>`<button type="button" ${FBZActions.attrs("home.go-club",[Number(club.id)])}>${root.FBZMedia.visual({entity:club,kind:'club',className:'home-club-mark'})}<span>${root.esc(club.short_name||club.name)}</span></button>`).join('')}</div><p>Откройте клуб, чтобы посмотреть его состав и календарь.</p><button class="text-action" type="button" data-fbz-click="shell.open-global-search">Добавить клуб →</button>`;
      return;
    }
    target.innerHTML=`<div class="home-club-empty">${root.ico('football',21)}<strong>Клубы пока не выбраны</strong><p>Добавьте любимые клубы в избранное, чтобы быстро открывать их составы и матчи.</p><button class="btn btn-g btn-sm" type="button" data-fbz-click="shell.open-global-search">Найти клуб</button></div>`;
  }

  function spotlight(items){
    const target=document.getElementById('homeMatchSpotlight');
    if(!target)return;
    const matches=Array.isArray(items)?items:[];
    const now=Date.now();
    const match=matches.find(item=>item.status==='live')
      ||matches.find(item=>item.status==='scheduled'&&new Date(item.match_date).getTime()>=now)
      ||matches.find(item=>item.status==='finished')
      ||matches[0];
    if(!match){
      target.innerHTML=`<div class="home-spotlight-empty"><span class="section-kicker">Матч в фокусе</span><strong>Футбольный календарь готовится</strong><p>Когда появятся встречи, здесь будет главное событие для вас.</p><button class="btn btn-g" type="button" data-fbz-click="shell.go-matches">Открыть календарь</button></div>`;
      return;
    }
    const id=Number(match.id);
    if(!Number.isSafeInteger(id)||id<=0){target.replaceChildren();return;}
    const date=new Date(match.match_date);
    const dateLabel=Number.isFinite(date.getTime())?date.toLocaleDateString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):'Дата уточняется';
    const finished=match.status==='finished',live=match.status==='live';
    const homeName=String(match.home_team_name||'Команда хозяев');
    const awayName=String(match.away_team_name||'Команда гостей');
    const mark=name=>root.teamMonogram?root.teamMonogram(name):name.slice(0,2).toLocaleUpperCase('ru-RU');
    target.innerHTML=`<article class="home-spotlight${live?' is-live':''}" style="${root.FBZDomain.matchPaletteStyle(match)}" aria-label="Матч в фокусе: ${root.esc(homeName)} — ${root.esc(awayName)}">
      <div class="home-spotlight-main">
        <div class="home-spotlight-top"><span class="home-spotlight-overline">FOOTBAZED <i></i> МАТЧ В ФОКУСЕ</span><span class="home-spotlight-status">${live?'<span class="live-dot"></span>LIVE':finished?'Финальный свисток':'В календаре'}</span></div>
        <p class="home-spotlight-league">${root.esc(match.league_name||'Футбол')} <span>·</span> ${root.esc(dateLabel)}</p>
        <h2 class="home-spotlight-title">${finished?'Недавний матч':live?'Игра идёт прямо сейчас':'Ближайший матч'}</h2>
        <div class="home-spotlight-score" role="group" aria-label="${root.esc(homeName)} ${root.esc(match.home_score??'без счёта')}, ${root.esc(awayName)} ${root.esc(match.away_score??'без счёта')}">
          <div class="home-spotlight-team">${root.matchClubMark(match,'home','home-spotlight-mark','eager')}<strong>${root.esc(homeName)}</strong><b>${root.esc(match.home_score??'—')}</b></div>
          <div class="home-spotlight-team">${root.matchClubMark(match,'away','home-spotlight-mark','eager')}<strong>${root.esc(awayName)}</strong><b>${root.esc(match.away_score??'—')}</b></div>
        </div>
        <div class="home-spotlight-actions"><button class="home-spotlight-primary" type="button" ${FBZActions.attrs("home.go-md",[id])}>Открыть матч <span aria-hidden="true">↗</span></button><button class="home-spotlight-secondary" type="button" data-fbz-click="shell.go-matches">Весь календарь</button></div>
      </div>
      <div class="home-spotlight-art" aria-hidden="true"><div class="home-spotlight-field">${root.matchClubMark(match,'home','home-spotlight-art-mark','eager')}<span class="home-spotlight-art-cross">×</span>${root.matchClubMark(match,'away','home-spotlight-art-mark','eager')}</div><span class="home-spotlight-art-caption">ИГРА БОЛЕЛЬЩИКОВ</span></div>
    </article>`;
  }

  function pendingMatch(match){
    const date=new Date(match.match_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
    return`<article class="home-pending-match">
      <button type="button" ${FBZActions.attrs("home.go-md",[Number(match.id)])}>
        <span class="home-pending-meta">${root.esc(match.league_name)} · ${root.esc(date)}</span>
        <strong><span>${root.esc(match.home_team_name)}</span><b>${root.esc(match.home_score??'—')} : ${root.esc(match.away_score??'—')}</b><span>${root.esc(match.away_team_name)}</span></strong>
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
