(function(root){
  'use strict';
  let state=null;
  const overlayId='comparisonOverlay';
  function current(s){return state===s&&CU?.id===s.user&&routeVersion===s.route&&profileVersion===s.profile&&CP==='profile';}
  function mount(){
    if(document.getElementById(overlayId))return;
    const overlay=document.createElement('div');
    overlay.id=overlayId;overlay.className='overlay comparison-overlay';overlay.tabIndex=-1;
    overlay.setAttribute('aria-hidden','true');overlay.dataset.closeBackdrop='true';
    overlay.innerHTML='<section class="comparison-panel" role="dialog" aria-modal="true" aria-labelledby="comparisonTitle" aria-describedby="comparisonWith">'
      +'<header><div><span class="section-kicker">Два взгляда на футбол</span><h2 id="comparisonTitle">Сравнение оценок</h2><p id="comparisonWith"></p></div><button class="btn btn-g comparison-close" type="button" aria-label="Закрыть сравнение" data-fbz-click="comparison.close">'+ico('close',20)+'</button></header>'
      +'<div class="comparison-body"><p class="comparison-method">Учитываем только публичные оценки завершённых матчей. Близкими считаем мнения с разницей не больше одного балла.</p>'
      +'<form id="comparisonFilters" class="comparison-filters"><div><label for="comparisonCompetition">Турнир</label><select id="comparisonCompetition" class="input" name="competition_id"><option value="">Все общие турниры</option></select></div><div><label for="comparisonSort">Порядок матчей</label><select id="comparisonSort" class="input" name="sort"><option value="recent">Сначала новые</option><option value="closest">Самые близкие мнения</option><option value="different">Самая большая разница</option></select></div></form>'
      +'<div id="comparisonContent" aria-busy="true"></div></div></section>';
    overlay.addEventListener('fbz:overlay-close',()=>{
      state=null;document.getElementById('comparisonContent').replaceChildren();document.getElementById('comparisonWith').textContent='';
    });
    const form=overlay.querySelector('form');form.addEventListener('submit',event=>event.preventDefault());
    form.addEventListener('change',()=>{if(!state)return;state.filters={competition_id:form.elements.competition_id.value,sort:form.elements.sort.value};state.offset=0;load();});
    document.body.append(overlay);
  }
  function score(value,decimals=0){const s=root.FBZDomain.ratingPresentation(value,decimals);return '<b class="comparison-rating rating-ink" data-tone="'+s.tone+'">'+s.value+'<span class="score-denominator">/10</span></b>';}
  function row(item){
    const date=new Date(item.match_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
    const result=item.home_score!==null&&item.away_score!==null?Number(item.home_score)+' : '+Number(item.away_score)+' · ':'';
    return '<li><button type="button" class="comparison-match" '+FBZActions.attrs('comparison.match',[Number(item.match_id)])+'><span class="comparison-match-info"><span class="collection-marks" aria-hidden="true">'+root.matchClubMark(item,'home','collection-mark')+root.matchClubMark(item,'away','collection-mark')+'</span><span><strong>'+esc(item.home_team_name)+' — '+esc(item.away_team_name)+'</strong><small>'+esc(result+item.league_name+' · '+date)+'</small></span></span><span class="comparison-pair"><span><small>Вы</small>'+score(item.my_score)+'</span><span><small>Болельщик</small>'+score(item.their_score)+'</span></span><span class="comparison-gap">'+(Number(item.gap)===0?'Одинаково':'Разница '+Number(item.gap))+'</span></button></li>';
  }
  function interests(data){
    const favorites=(data.favorites||[]).map(club=>'<button class="comparison-interest" type="button" '+FBZActions.attrs('comparison.club',[Number(club.id)])+'>'+root.FBZMedia.visual({entity:club,kind:'club',className:'collection-mark'})+'<span><strong>'+esc(club.short_name||club.name)+'</strong><small>'+({both:'Любимый клуб у вас обоих',mine:'Ваш любимый клуб',theirs:'Любимый клуб болельщика'}[club.side]||'Любимый клуб')+'</small></span></button>').join('');
    const tournaments=(data.tournaments||[]).map(t=>'<li><span>'+esc(t.name)+'</span><span><b>'+Number(t.my_votes)+'</b> / <b>'+Number(t.their_votes)+'</b></span></li>').join('');
    const players=(data.players||[]).map(p=>'<button class="comparison-interest" type="button" '+FBZActions.attrs('comparison.player',[Number(p.id)])+'>'+root.FBZMedia.visual({entity:p,kind:'player',className:'collection-mark'})+'<span><strong>'+esc(p.name)+'</strong><small>'+Number(p.my_votes)+' / '+Number(p.their_votes)+' оценок · средние '+root.FBZDomain.ratingPresentation(p.my_average,1).value+' / '+root.FBZDomain.ratingPresentation(p.their_average,1).value+'</small></span></button>').join('');
    return '<section class="comparison-interests" aria-labelledby="comparisonInterests"><h3 id="comparisonInterests">Футбольные интересы</h3><p>Любимые клубы выбраны в профилях. Остальные показатели — по публичным оценкам'+(state.filters.competition_id?' выбранного турнира':'')+'. В парах чисел сначала ваши данные.</p><div class="comparison-interest-grid"><section><h4>Любимые клубы</h4>'+(favorites||'<p>Любимые клубы пока не выбраны.</p>')+'</section><section><h4>Турниры, которые вы оцениваете</h4>'+(tournaments?'<ul class="comparison-tournaments">'+tournaments+'</ul>':'<p>Публичных оценок турниров пока нет.</p>')+'</section></div><section class="comparison-players"><h4>Игроки, которых вы оба оцениваете</h4><p>Не менее двух публичных оценок игрока у каждого.</p>'+(players||'<p>Общих часто оцениваемых игроков пока нет.</p>')+'</section></section>';
  }
  function render(data,s){
    const sum=data.summary||{},total=Number(data.total)||0,items=data.items||[],similar=Number(sum.similar_matches)||0;
    const metrics=[['Общих матчей',total],['Точно совпали',Number(sum.exact_matches)||0],['Близкие мнения',total?Number(sum.similar_percent)+'%':'—'],['Средняя разница',total?Number(sum.average_gap).toFixed(1):'—']];
    const summary='<div class="comparison-summary">'+metrics.map(([label,value])=>'<div><strong>'+value+'</strong><span>'+label+'</span></div>').join('')+'</div>';
    const sample=total?'<p class="comparison-sample">Близкие оценки в '+similar+' из '+total+' общих матчей.'+(total<5?' Пока мало общих оценок — результат может заметно меняться.':'')+' Средняя разница измеряется в баллах из 10.</p>':'';
    const page=items.length?'<ol class="comparison-matches" aria-label="Общие оценки матчей">'+items.map(row).join('')+'</ol>':'<div class="empty-state"><strong>'+(s.filters.competition_id?'Нет общих оценок этого турнира':'Общих оценок пока нет')+'</strong><p>Сравнение появится, когда вы оба публично оцените один завершённый матч.</p></div>';
    const pagination='<div class="collection-pagination"><span role="status">'+(items.length?(s.offset+1)+'–'+(s.offset+items.length)+' из '+total:'Нет записей')+'</span><div><button class="btn btn-g btn-sm" type="button" data-fbz-click="comparison.previous" '+(s.offset===0?'disabled':'')+'>Назад</button><button class="btn btn-g btn-sm" type="button" data-fbz-click="comparison.next" '+(!data.has_more?'disabled':'')+'>Далее →</button></div></div>';
    return summary+sample+page+pagination+interests(data);
  }
  async function load(){
    const s=state;if(!s||!current(s))return;
    const version=++s.version;s.loading=true;
    const content=document.getElementById('comparisonContent');content.setAttribute('aria-busy','true');
    content.innerHTML='<div class="loading" role="status"><div class="spin"></div><span class="sr-only">Загрузка сравнения</span></div>';
    try{
      const data=await root.FBZData.getProfileComparisonPage(s.uid,{filters:s.filters,offset:s.offset,limit:12});
      if(!current(s)||version!==s.version)return;
      if(!data){content.innerHTML='<div class="empty-state"><strong>Сравнение недоступно</strong><p>Профиль закрыт или больше недоступен.</p></div>';return;}
      const select=document.getElementById('comparisonFilters').elements.competition_id;
      const selected=s.filters.competition_id;
      select.innerHTML='<option value="">Все общие турниры</option>'+(data.competitions||[]).map(c=>'<option value="'+Number(c.id)+'">'+esc(c.name)+'</option>').join('');
      select.value=selected;
      document.getElementById('comparisonWith').textContent='Вы и @'+(data.profile?.username||'болельщик');
      s.hasMore=Boolean(data.has_more);s.nextOffset=Number(data.next_offset);content.innerHTML=render(data,s);
    }catch(error){if(current(s)&&version===s.version){content.innerHTML='<div class="collection-error" role="status"><span>Не удалось загрузить сравнение</span><button class="btn btn-g btn-sm" type="button" data-fbz-click="comparison.retry">Повторить</button></div>';}}
    finally{if(current(s)&&version===s.version){s.loading=false;content.setAttribute('aria-busy','false');}}
  }
  function open(uid){
    if(!CU||uid===CU.id||CP!=='profile')return;
    mount();state={uid,user:CU.id,route:routeVersion,profile:profileVersion,filters:{competition_id:'',sort:'recent'},offset:0,version:0,loading:false,hasMore:false};
    const form=document.getElementById('comparisonFilters');form.reset();form.elements.competition_id.innerHTML='<option value="">Все общие турниры</option>';
    root.FBZOverlay.open(overlayId,'.comparison-close');return load();
  }
  function close(restore=true){root.FBZOverlay.close(overlayId,restore);state=null;}
  function page(direction){if(!state||state.loading)return;if(direction>0&&state.hasMore)state.offset=state.nextOffset;else if(direction<0&&state.offset>0)state.offset=Math.max(0,state.offset-12);else return;load();document.querySelector('.comparison-body')?.scrollTo({top:0,behavior:'instant'});}
  root.FBZComparison=Object.freeze({open,close});
  root.FBZActions.register({
    'comparison.close':()=>close(),'comparison.retry':()=>load(),
    'comparison.previous':()=>page(-1),'comparison.next':()=>page(1),
    'comparison.match':(event,element,[id])=>{close(false);go('md',{mid:id});},
    'comparison.club':(event,element,[id])=>{close(false);go('club',{id});},
    'comparison.player':(event,element,[id])=>{close(false);go('player',{id});}
  });
})(window);
