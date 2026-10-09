(function(root){
  'use strict';
  let state=null;
  const tr=(ru,en)=>root.FBZLocale.language==='en'?en:ru;
  const valid=s=>state===s&&s.user===CU?.id&&s.route===routeVersion&&CP==='md'&&Number(mdID)===Number(s.match.id);
  const number=value=>Number.isFinite(Number(value))&&value!=null?Number(value):null;
  function score(value){const n=number(value);return n===null?'—':n.toFixed(1);}
  function delta(value){const n=number(value);return n===null?'—':`${n>0?'+':''}${n.toFixed(1)}`;}
  function value(label,n,extra=''){
    return `<div><span>${esc(label)}</span><strong class="rating-ink" data-tone="${number(n)===null?'neutral':FBZDomain.ratingTone(n)}">${score(n)}${number(n)===null?'':'<small>/10</small>'}</strong>${extra?`<small>${esc(extra)}</small>`:''}</div>`;
  }
  function render(s){
    if(!valid(s))return;
    const data=s.data,segments=data.segments||{},segment=segments[s.segment]||{},all=segments.all||{},own=data.own,finished=s.match.status==='finished';
    const target=document.getElementById('mdExpectations');
    const count=FBZDomain.countLabel(Number(all.count)||0,{one:'ожидание',few:'ожидания',many:'ожиданий'});
    const context=[['all',tr('Все','All')],['home',FBZDomain.matchTeamName(s.match,'home')],['neutral',tr('Нейтральные','Neutral')],['away',FBZDomain.matchTeamName(s.match,'away')]];
    const ownDifference=own&&s.ownRating?Number(s.ownRating.match_rating)-Number(own.rating):null;
    const paired=Number(segment.paired_count)||0;
    const button=document.querySelector('.md-primary-action[data-expectation-action]');
    if(button){button.hidden=!data.is_open;button.innerHTML=ico('star',16)+' '+(own?tr('Изменить ожидание','Edit expectation'):tr('Оценить ожидание','Rate expectation'));}
    if(s.match.status==='scheduled'){
      const summary=document.getElementById('mdExpectationSummary');if(!summary)return;
      const focused=summary.contains(document.activeElement)?s.segment:null;
      const average=Number(segment.count)>0?number(segment.average):null;
      summary.innerHTML=`<div class="md-comm" aria-label="${tr('Ожидания от матча','Match expectations')}">
        <div class="md-ci"><div class="md-cv" data-tone="${average===null?'neutral':FBZDomain.ratingTone(average)}">${score(average)}</div><div class="md-cl">${s.segment==='all'?tr('Ожидание зрителей','Fans’ expectation'):esc(context.find(([key])=>key===s.segment)?.[1]||'')}</div></div>
        <div class="md-ci"><div class="md-cv">${Number(segment.count)||0}</div><div class="md-cl">${tr('Публичных ожиданий','Public expectations')}</div></div>
        <div class="md-ci"><div class="md-cv">—</div><div class="md-cl">${tr('Оценка после игры','Rating after the match')}</div></div>
      </div><div class="md-segments" role="group" aria-label="${tr('Чьи ожидания показать','Whose expectations to show')}">${context.map(([key,label])=>{const group=segments[key]||{},n=Number(group.count)>0?number(group.average):null;return `<button class="md-segment${s.segment===key?' on':''}" type="button" data-expectation-segment="${key}" aria-pressed="${s.segment===key}" ${FBZActions.attrs('expectations.segment',[key])}><span>${esc(label)}</span><b data-tone="${n===null?'neutral':FBZDomain.ratingTone(n)}">${score(n)}</b><small>${Number(group.count)||0}</small></button>`;}).join('')}</div>`;
      summary.setAttribute('aria-busy','false');
      target.innerHTML=own?`<section class="md-own-rating expectation-personal" aria-label="${tr('Ваше ожидание','Your expectation')}"><span>${tr('Ваше ожидание','Your expectation')}</span><strong class="rating-ink" data-tone="${FBZDomain.ratingTone(own.rating)}">${score(own.rating)}<small>/10</small></strong></section>`:'';
      target.setAttribute('aria-busy','false');
      if(focused)summary.querySelector(`[data-expectation-segment="${focused}"]`)?.focus({preventScroll:true});
      return;
    }
    target.innerHTML=`<section class="expectation-panel" aria-labelledby="expectationTitle">
      <header><div><h2 id="expectationTitle">${tr('Ожидания от матча','Match expectations')}</h2><p>${all.count?esc(count):tr('Оценка качества игры до её начала','The quality of play fans expect')}</p></div><div class="expectation-community">${value(tr('Среднее ожидание','Average expectation'),all.average)}</div></header>
      ${all.count?`<div class="expectation-segments" role="group" aria-label="${tr('Чьи ожидания показать','Whose expectations to show')}">${context.map(([key,label])=>`<button type="button" aria-pressed="${s.segment===key}" ${FBZActions.attrs('expectations.segment',[key])}>${esc(label)}<small>${Number(segments[key]?.count)||0}</small></button>`).join('')}</div>`:''}
      ${s.segment!=='all'&&!finished?`<div class="expectation-values">${value(context.find(([key])=>key===s.segment)?.[1]||'',segment.average,FBZDomain.countLabel(Number(segment.count)||0,{one:'ожидание',few:'ожидания',many:'ожиданий'}))}</div>`:''}
      ${finished?`<details class="expectation-comparison"><summary>${tr('Ожидание и впечатление','Expectation and experience')}</summary>${paired?`<div class="expectation-values">${value(tr('До игры','Before kickoff'),segment.paired_expected)}${value(tr('После игры','After the match'),segment.paired_rating)}<div><span>${tr('Разница','Difference')}</span><strong class="expectation-delta">${delta(segment.paired_delta)}</strong></div></div><p>${tr('Обе оценки поставили:','Rated before and after:')} ${paired}</p>`:`<p>${tr('Сравнение появится, когда те же болельщики оценят завершённый матч.','A comparison appears once the same fans rate the finished match.')}</p>`}</details>`:''}
      ${own?`<div class="expectation-personal"><h3>${tr('Ваше ожидание','Your expectation')}</h3><div class="expectation-values">${value(tr('До игры','Before kickoff'),own.rating)}${finished?`${value(tr('Ваша оценка','Your rating'),s.ownRating?.match_rating)}<div><span>${tr('Разница','Difference')}</span><strong class="expectation-delta">${delta(ownDifference)}</strong></div>`:''}</div></div>`:''}
    </section>`;
    target.setAttribute('aria-busy','false');
  }
  async function mount(match,ownRating){
    const s={match,ownRating,user:CU?.id,route:routeVersion,segment:'all',data:null};state=s;
    const target=document.getElementById('mdExpectations');if(!target)return;
    target.setAttribute('aria-busy','true');
    try{
      const {data,error}=await sb.rpc('get_match_expectations',{p_match_id:Number(match.id)});
      if(!valid(s))return;
      if(error||!data)throw error||new Error('expectation_unavailable');
      s.data=data;
      // Historical fixtures without expectations need no empty analytics panel.
      if(match.status==='finished'&&!data.own&&!Number(data.segments?.all?.count)){target.replaceChildren();target.setAttribute('aria-busy','false');return;}
      render(s);
    }catch{
      if(!valid(s))return;
      target.setAttribute('aria-busy','false');
      const summary=document.getElementById('mdExpectationSummary');if(summary){summary.replaceChildren();summary.setAttribute('aria-busy','false');}
      target.innerHTML=`<div class="expectation-error" role="status"><span>${tr('Не удалось загрузить ожидания','Could not load expectations')}</span><button class="btn btn-g btn-sm" type="button" data-fbz-click="expectations.retry">${tr('Повторить','Retry')}</button></div>`;
    }
  }
  root.FBZExpectations=Object.freeze({mount});
  FBZActions.register({'expectations.segment':(event,element,[segment])=>{if(state?.data&&['all','home','neutral','away'].includes(segment)){state.segment=segment;render(state);}},'expectations.retry':()=>state&&mount(state.match,state.ownRating)});
})(window);
