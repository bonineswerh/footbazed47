(function(root){
  'use strict';

async function loadMD(id,{quiet=false}={}){
  if(!id)return;
  const request=quiet?matchDetailRequest:++matchDetailRequest;
  const userId=CU?.id||null,route=routeVersion;
  const isCurrent=()=>route===routeVersion&&request===matchDetailRequest&&CP==='md'&&Number(mdID)===Number(id)&&(CU?.id||null)===userId;
  const target=document.getElementById('mdC');
  if(!quiet)activeMatchRatingSegments=null;
  target.setAttribute('aria-busy','true');
  if(!quiet)target.innerHTML='<div class="loading" role="status"><div class="spin"></div><span>Загружаем матч</span></div>';
  try{
    const ownRatingRequest=userId
      ?sb.from('ratings').select('match_rating,comment,is_public,supporter_side,updated_at').eq('user_id',userId).eq('match_id',id).maybeSingle()
      :Promise.resolve({data:null,error:null});
    const[{data:match,error:matchError},{data:ratings,error:ratingsError},{data:insights,error:insightsError},{data:ownRating,error:ownRatingError}]=await Promise.all([
      sb.from('matches').select(MATCH_FIELDS).eq('id',id).single(),
      sb.from('ratings').select(RATING_FIELDS).eq('match_id',id).eq('is_public',true).order('created_at',{ascending:false}).limit(8),
      sb.rpc('get_match_insights',{p_match_id:Number(id)}),
      ownRatingRequest
    ]);
    if(!isCurrent())return;
    if(matchError)throw matchError;
    if(ratingsError)throw ratingsError;
    if(insightsError)throw insightsError;
    if(ownRatingError)throw ownRatingError;
    if(!match){target.innerHTML='<div class="empty-state"><strong>Матч не найден</strong></div>';return;}
    await window.FBZData.enrichMatchMedia([match]);
    if(!isCurrent())return;

    const userIds=[...new Set((ratings||[]).map(rating=>rating.user_id))];
    const{data:users}=userIds.length
      ?await sb.from('users').select('id,display_name,username,avatar_url').in('id',userIds)
      :{data:[]};
    if(!isCurrent())return;
    if(quiet&&(document.hidden||document.body.classList.contains('modal-open')||target.contains(document.activeElement)))return false;
    window.FBZSEO?.match(match);
    const userMap={};(users||[]).forEach(user=>{userMap[user.id]=user;});
    const ratingCount=Number(insights?.rating_count||0);
    const averageValue=Number(insights?.average);
    const hasAverage=ratingCount>0&&Number.isFinite(averageValue);
    const average=hasAverage?averageValue.toFixed(1):'—';
    const segments=insights?.segments&&typeof insights.segments==='object'?insights.segments:{all:{rating_count:ratingCount,average:insights?.average,distribution:insights?.distribution||[]}};
    activeMatchRatingSegments={segments,match,active:'all'};
    const topPlayers=Array.isArray(insights?.top_players)?insights.top_players:[];
    const presentation=FBZDomain.matchScorePresentation(match);
    const statusLabel=presentation.status;
    const competitionMeta=[match.season?`Сезон ${match.season}`:'',match.matchday?(FBZLocale.language==='en'?`Matchweek ${match.matchday}`:`${match.matchday}-й тур`):''].filter(Boolean).join(' · ');
    const segmentControls=ratingCount?`<div class="md-segments" role="group" aria-label="Чьи оценки показать">
      ${[['all','Все'],['home',FBZNames.club(match.home_team_name)],['neutral','Нейтральные'],['away',FBZNames.club(match.away_team_name)]].map(([key,label])=>{const value=segments[key]||{};const segmentAverage=Number(value.average);const segmentHasAverage=Number(value.rating_count)>0&&Number.isFinite(segmentAverage);return`<button class="md-segment${key==='all'?' on':''}" type="button" data-segment="${key}" aria-pressed="${key==='all'}" ${FBZActions.attrs("matches.set-match-rating-segment",[key])}><span>${esc(label)}</span><b data-tone="${segmentHasAverage?window.FBZDomain.ratingTone(segmentAverage):''}">${segmentHasAverage?segmentAverage.toFixed(1):'—'}</b><small>${Number(value.rating_count)||0}</small></button>`;}).join('')}
    </div>`:'';
    const communityMarkup=ratingCount?`<div class="md-comm">
      <div class="md-ci"><div class="md-cv" id="mdCommunityAverage" data-tone="${hasAverage?window.FBZDomain.ratingTone(averageValue):''}">${average}</div><div class="md-cl" id="mdCommunityLabel">Все зрители</div></div>
      <div class="md-ci"><div class="md-cv" id="mdCommunityCount">${ratingCount}</div><div class="md-cl">Публичных оценок</div></div>
      <div class="md-ci"><div class="md-cv md-cv-player">${esc(topPlayers[0]?.name||'—')}</div><div class="md-cl">Выбор болельщиков${Number(topPlayers[0]?.unverified_rating_count)>0?' · участие не подтверждено':''}</div></div>
    </div>${segmentControls}`:`<div class="md-community-empty"><strong>${match.status==='scheduled'?'Оценки откроются после матча':'Мнение сообщества ещё не сформировано'}</strong><span>${match.status==='scheduled'?'После финального свистка здесь появятся оценки болельщиков.':'Поставьте первую оценку и начните обсуждение матча.'}</span></div>`;
    const ownRatingMarkup=ownRating?`<section class="md-own-rating" aria-label="Ваша оценка"><span>Ваша оценка${ownRating.is_public===false?' · приватная':''}</span><strong class="rating-ink" data-tone="${FBZDomain.ratingTone(ownRating.match_rating)}">${Number(ownRating.match_rating)}<small>/10</small></strong></section>`:'';
    const distributionMarkup=matchDistributionMarkup(segments.all);

    target.innerHTML=`
      <section class="md-hero" style="${FBZDomain.matchPaletteStyle(match)}">
        <div class="md-lg"><span>${esc(FBZNames.competition(match.league_name))}</span><b class="md-status md-status-${match.status==='live'&&!presentation.isLive?'other':esc(match.status)}">${esc(statusLabel)}</b></div>
        <div class="md-sl">
          <div class="md-team">${matchClubMark(match,'home','md-team-mark','eager')}${match.home_club_id?`<button class="md-tname md-club-link" type="button" ${FBZActions.attrs("matches.go-club",[Number(match.home_club_id)])}>${esc(FBZNames.club(match.home_team_name))}</button>`:`<div class="md-tname">${esc(FBZNames.club(match.home_team_name))}</div>`}<div class="md-score">${esc(presentation.home)}</div></div>
          <div class="md-vs">VS</div>
          <div class="md-team">${matchClubMark(match,'away','md-team-mark','eager')}${match.away_club_id?`<button class="md-tname md-club-link" type="button" ${FBZActions.attrs("matches.go-club",[Number(match.away_club_id)])}>${esc(FBZNames.club(match.away_team_name))}</button>`:`<div class="md-tname">${esc(FBZNames.club(match.away_team_name))}</div>`}<div class="md-score">${esc(presentation.away)}</div></div>
        </div>
        <div class="md-meta">${ico('calendar',12)} ${new Date(match.match_date).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}${competitionMeta?`<span>·</span>${esc(competitionMeta)}`:''}</div>
        ${match.status==='finished'?communityMarkup:''}
        ${match.status==='scheduled'?'<div id="mdExpectationSummary" aria-busy="true"></div>':''}
      </section>
      <div class="md-actions">
        ${match.status==='scheduled'&&Date.parse(match.match_date)>Date.now()?`<button class="btn btn-l md-primary-action" type="button" data-expectation-action ${FBZActions.attrs('matches.open-rate',[match.id,'expectation'])}>${ico('star',16)} Оценить ожидание</button>`:''}
        ${match.status==='finished'?`<button class="btn btn-l md-primary-action" ${FBZActions.attrs("matches.open-rate",[match.id])}>${ico('star',16)} ${ownRating?'Изменить оценку':'Оценить матч'}</button>`:''}
        <button class="btn btn-g" ${FBZActions.attrs("matches.copy-app-link",[match.id])}>${ico('link',14)} Ссылка</button>
      </div>
      <div id="mdExpectations" aria-busy="true"></div>
      ${ownRatingMarkup}
      <div class="md-grid" ${match.status!=='finished'?'hidden':''}>
        <div>
          <section class="mdcard"><div class="mdcard-title">Выбор болельщиков</div>${insights?.player_rating_scope==='confirmed_historical'&&Number(insights.unverified_player_rating_count)>0?`<p class="pr-evidence">Прежние оценки без подтверждения участия сохранены в истории игроков и не входят в этот выбор.</p>`:''}${topPlayers.length?topPlayers.map((player,index)=>{const presentation=window.FBZDomain.ratingPresentation(player.average,1);return`<button class="pr-row pr-row-link" data-tone="${presentation.tone}" type="button" ${FBZActions.attrs("matches.go-player",[Number(player.player_id)])}><span class="pr-rank">${index+1}</span><span class="pr-info"><span class="pr-name">${esc(player.name)}</span><span class="pr-team">${esc(FBZNames.club(player.team))} · ${FBZDomain.countLabel(Number(player.rating_count)||0,{one:'оценка',few:'оценки',many:'оценок'})}${Number(player.best_votes)?` · ${FBZDomain.countLabel(Number(player.best_votes),{one:'голос за лучшего игрока',few:'голоса за лучшего игрока',many:'голосов за лучшего игрока'})}`:''}</span>${Number(player.unverified_rating_count)>0?'<span class="pr-evidence">Участие в матче не подтверждено</span>':''}</span><span class="pr-r"><span class="pr-bar"><span class="pr-fill" style="width:${presentation.progress}%"></span></span><span class="pr-val">${presentation.value}<span class="score-denominator">/10</span></span></span></button>`;}).join(''):'<div class="empty-state compact"><strong>Оценок игроков пока нет</strong><span>Они появятся после оценок подтверждённых участников матча.</span></div>'}</section>
          <section class="mdcard"><div class="mdcard-title">Оценки болельщиков</div>${ratings?.length?ratings.slice(0,8).map(rating=>{const user=userMap[rating.user_id]||{};const sideLabel={home:FBZNames.club(match.home_team_name),away:FBZNames.club(match.away_team_name),neutral:'Нейтральный'}[rating.supporter_side]||'Нейтральный';return`<div class="rh-row"><div><button class="text-link rh-m" ${FBZActions.attrs("app.go-profile",[rating.user_id])}>${esc(user.username||'Аноним')}</button><div class="rh-l">@${esc(user.username||'user')} · ${esc(sideLabel)}${rating.comment?' · '+esc(rating.comment.substring(0,50)):''}</div></div><div class="rh-r"><div class="rh-bar"><div class="rh-fill" data-tone="${window.FBZDomain.ratingTone(rating.match_rating)}" style="width:${(rating.match_rating||0)*10}%"></div></div><div class="rh-v" data-tone="${window.FBZDomain.ratingTone(rating.match_rating)}">${rating.match_rating}<span class="score-denominator">/10</span></div></div></div>`;}).join(''):`<div class="empty-state compact"><strong>${match.status==='finished'?'Оценок пока нет':'Обсуждение начнётся после матча'}</strong><span>${match.status==='finished'?'Сформируйте первое мнение о матче.':'Здесь появятся оценки болельщиков.'}</span>${match.status==='finished'?`<button class="btn btn-g btn-sm" type="button" ${FBZActions.attrs("matches.open-rate",[match.id])}>Оценить первым</button>`:''}</div>`}</section>
        </div>
        <section class="mdcard"><div class="mdcard-title">Распределение оценок</div><div id="mdDistribution">${distributionMarkup}</div></section>
      </div>`;

    loadMatchExpectations(match,ownRating,isCurrent);
    window.FBZMatchUpdates?.watch({items:[match],isCurrent,apply:async()=>{
      if(document.body.classList.contains('modal-open')||target.contains(document.activeElement))return false;
      return await loadMD(id,{quiet:true})!==false;
    }});
  }catch(error){
    if(!isCurrent())return;
    console.error('Match detail error:',error);
    if(quiet&&FBZDomain.canRetainReadResult(error))return false;
    target.innerHTML=`<div class="empty-state"><div class="empty-icon">⚠️</div><strong>Не удалось открыть матч</strong><button class="btn btn-g btn-sm" ${FBZActions.attrs('matches.retry-match',[Number(id)])}>Повторить</button></div>`;
  }finally{
    if(isCurrent())target.setAttribute('aria-busy','false');
  }
}



function loadMatchExpectations(match,ownRating,isCurrent){
  FBZFeatures.load({key:'expectations',styleId:'expectationStyles',script:'js/match-expectations.js?v=20261009-controls',style:'css/expectations.css?v=20261008-sheets',ready:()=>window.FBZExpectations}).then(()=>{
    if(isCurrent())window.FBZExpectations.mount(match,ownRating);
  }).catch(()=>{
    if(!isCurrent())return;
    document.getElementById('mdExpectations').setAttribute('aria-busy','false');
    document.getElementById('mdExpectationSummary')?.setAttribute('aria-busy','false');
    document.getElementById('mdExpectations').innerHTML='<div class="empty-state compact"><strong>Не удалось загрузить ожидания</strong><button type="button" class="btn btn-g btn-sm" '+FBZActions.attrs('matches.retry-match',[match.id])+'>Повторить</button></div>';
  });
}

root.FBZMatchDetail=Object.freeze({load:loadMD});
})(window);
