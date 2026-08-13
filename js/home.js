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
    const streak=Number(user?.streak)||0;
    target.innerHTML=`
      <button class="home-overview-item" type="button" onclick="goOwnProfile()">
        <span>${root.ico('star',17)} Оценки</span><strong>${ratings.toLocaleString('ru-RU')}</strong><small>ваша история матчей</small>
      </button>
      <button class="home-overview-item" type="button" onclick="goOwnProfile()">
        <span>${root.ico('chart',17)} Средняя</span><strong>${Number.isFinite(average)&&ratings?average.toFixed(1):'—'}</strong><small>${ratings?'ваш футбольный почерк':'появится после оценки'}</small>
      </button>
      <button class="home-overview-item" type="button" onclick="goOwnProfile()">
        <span>${root.ico('fire',17)} Серия</span><strong>${streak||'—'}</strong><small>${streak?`${streak} ${streak===1?'день':'дней'} подряд`:'начните с одного матча'}</small>
      </button>`;
  }

  function renderFavorites(user){
    const target=document.getElementById('homeFavoriteTeams');
    if(!target)return;
    const clubs=Array.isArray(user?.favorite_clubs)?user.favorite_clubs.slice(0,6):[];
    if(clubs.length){
      target.innerHTML=`<div class="home-team-list">${clubs.map(club=>`<button type="button" onclick="go('club',{id:${Number(club.id)}})">${root.FBZMedia.visual({entity:club,kind:'club',className:'home-club-mark'})}<span>${root.esc(club.short_name||club.name)}</span></button>`).join('')}</div><p>Основа будущих персональных матчей, ленты и уведомлений.</p><button class="text-action" type="button" onclick="FBZSearch.open()">Добавить клуб →</button>`;
      return;
    }
    target.innerHTML=`<div class="home-club-empty">${root.ico('football',21)}<strong>Клубы пока не выбраны</strong><p>Найдите любимый клуб и добавьте его в избранное. Эмблема для этого не нужна.</p><button class="btn btn-g btn-sm" type="button" onclick="FBZSearch.open()">Найти клуб</button></div>`;
  }

  function pendingMatch(match){
    const date=new Date(match.match_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
    return`<article class="home-pending-match">
      <button type="button" onclick="go('md',{mid:${Number(match.id)}})">
        <span class="home-pending-meta">${root.esc(match.league_name)} · ${root.esc(date)}</span>
        <strong><span>${root.esc(match.home_team_name)}</span><b>${root.esc(match.home_score??'—')} : ${root.esc(match.away_score??'—')}</b><span>${root.esc(match.away_team_name)}</span></strong>
      </button>
      <button class="home-pending-rate" type="button" onclick="openRate(${Number(match.id)})">${root.ico('star',15)} Оценить</button>
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
        :`<div class="home-priority-empty">${root.ico('check',22)}<div><strong>Всё оценено</strong><p>${matches.length?'В недавних матчах нет незавершённых оценок.':'Завершённые матчи появятся здесь после обновления календаря.'}</p></div></div>`;
    }catch(error){
      if(version!==requestVersion)return;
      console.warn('Home dashboard load error:',error);
      target.innerHTML='<div class="home-priority-empty"><div><strong>Не удалось загрузить рекомендации</strong><p>Остальные разделы продолжают работать.</p></div><button class="btn btn-g btn-sm" type="button" onclick="FBZHome.reload()">Повторить</button></div>';
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

  root.FBZHome=Object.freeze({reload,sync});
})(window);
