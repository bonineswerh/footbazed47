'use strict';

let rMID=null;
let rScore=null;
let rPS={};
let rBest=null;
let rExisting=false;
let rActivePlayer=null;
let rSupporterSide=null;
const ratingPlayers=new Map();
let ratingContext=null;

function isRatingCurrent(context){
  return Boolean(context&&ratingContext===context&&CU?.id===context.userId&&location.href===context.route&&document.getElementById('rateOv').classList.contains('on'));
}

function setRatingLoading(loading){
  document.getElementById('rateOv').setAttribute('aria-busy',String(loading));
  document.querySelectorAll('#rS1 input,.rate-star,#rS1 button[data-fbz-click="shell.r-next"],#rSave,#rDelete').forEach(control=>{control.disabled=loading;});
  document.getElementById('matchRatingClear').disabled=loading||rScore===null;
}

document.getElementById('rateOv')?.addEventListener('fbz:overlay-close',()=>{ratingContext=null;});

const POSITION_GROUP={
  GK:'gk',DF:'def',CB:'def',LB:'def',LWB:'def',RB:'def',RWB:'def',
  MF:'mid',DM:'mid',CM:'mid',AM:'mid',LM:'mid',RM:'mid',
  FW:'att',LW:'att',RW:'att',ST:'att',CF:'att',SS:'att'
};
const POSITION_LABEL={gk:'Вратари',def:'Защита',mid:'Полузащита',att:'Атака',other:'Другие'};
const RATING_LABELS=['','Ужасно','Плохо','Слабо','Ниже среднего','Средне','Неплохо','Хорошо','Отлично','Великолепно','Исключительно'];

async function openRatingForm(mid){
  if(!CU){openAuth();return;}
  const matchId=Number(mid);
  if(!Number.isSafeInteger(matchId)||matchId<1)return;
  const context={matchId,userId:CU.id,route:location.href,ready:false,saving:false};
  ratingContext=context;
  rMID=Number(mid);rScore=null;rPS={};rBest=null;rExisting=false;rSupporterSide=null;
  resetRatingForm();
  setRatingLoading(true);
  window.FBZOverlay?.open('rateOv','.rate-close');
  try{
    const[{data:match,error:matchError},{data:existing,error:ratingError},{data:playerScores,error:playerError}]=await Promise.all([
      sb.from('matches').select('home_team_name,away_team_name,status').eq('id',matchId).single(),
      sb.from('ratings').select('match_rating,comment,is_public,supporter_side').eq('user_id',context.userId).eq('match_id',matchId).maybeSingle(),
      sb.from('player_ratings').select('player_id,rating,is_best_player,player:players(name)').eq('user_id',context.userId).eq('match_id',matchId)
    ]);
    if(!isRatingCurrent(context))return;
    if(matchError)throw matchError;
    if(ratingError)throw ratingError;
    if(playerError)throw playerError;
    if(match.status!=='finished'){
      closeRate();
      toast('Оценить можно после завершения матча','err');
      return;
    }

    document.getElementById('rMI').textContent=FBZNames.matchTitle(match);
    document.getElementById('rSupportHome').textContent=FBZDomain.matchTeamName(match,'home');
    document.getElementById('rSupportAway').textContent=FBZDomain.matchTeamName(match,'away');
    setRatingMode(Boolean(existing));
    if(existing){
      selScore(existing.match_rating,RATING_LABELS);
      document.getElementById('rCmt').value=existing.comment||'';
      document.getElementById('rPub').checked=existing.is_public!==false;
      selectSupporterSide(existing.supporter_side||'neutral');
      updateRatingCommentCount();
    }
    context.match=match;
    context.playerScores=playerScores||[];
    context.playerScores.forEach(item=>{rPS[item.player_id]=Number(item.rating);if(item.is_best_player)rBest=item.player_id;});
    await loadRatePlayers(match,context);
    if(!isRatingCurrent(context))return;
    Object.keys(rPS).forEach(updatePlayerRatingVisual);
    syncBestPlayerVisuals();
    context.ready=true;
    setRatingLoading(false);
  }catch(error){
    if(!isRatingCurrent(context))return;
    console.error('Rating form error:',error);
    document.getElementById('rateOv').setAttribute('aria-busy','false');
    document.getElementById('rMI').innerHTML=`<span role="status">Не удалось загрузить оценку.</span> <button class="btn btn-g btn-sm" type="button" ${FBZActions.attrs("ratings.open-rate",[matchId])}>Повторить</button>`;
  }
}

function resetRatingForm(){
  document.getElementById('rMI').textContent='Загружаем матч...';
  const row=document.getElementById('starsR');
  row.innerHTML='';
  for(let value=1;value<=10;value++){
    const button=document.createElement('button');
    button.className='rate-star';
    button.type='button';
    button.setAttribute('aria-label',`${value} из 10 — ${RATING_LABELS[value]}`);
    button.setAttribute('aria-pressed','false');
    button.innerHTML=`<span class="rate-star-num">${value}</span>`;
    button.onclick=()=>selScore(value,RATING_LABELS);
    row.appendChild(button);
  }
  document.getElementById('rScoreDisp').textContent='—';
  document.getElementById('rScoreDisp').classList.remove('active');
  document.getElementById('rScoreDisp').dataset.tone='neutral';
  document.getElementById('rScoreLabel').textContent='Выберите оценку';
  updateMatchRatingRail(null);
  document.getElementById('rSupportHome').textContent='Первая команда';
  document.getElementById('rSupportAway').textContent='Вторая команда';
  document.getElementById('rCmt').value='';
  document.getElementById('rPub').checked=true;
  document.querySelectorAll('input[name="ratingSupporterSide"]').forEach(input=>{input.checked=false;});
  document.getElementById('rPlayers').innerHTML='<div class="rating-loading"><div class="spin"></div><span>Загружаем составы</span></div>';
  ratingPlayers.clear();
  closePlayerRatingEditor(false);
  updateRatingCommentCount();
  setRatingMode(false);
  rBack();
}

function setRatingMode(existing){
  rExisting=existing;
  document.getElementById('rateTitle').textContent=existing?'Изменить оценку':'Оценить матч';
  document.getElementById('rDelete').hidden=!existing;
  document.getElementById('rSave').innerHTML=ico('save',13)+(existing?' Сохранить изменения':' Сохранить оценку');
}

function selScore(value,labels=RATING_LABELS){
  value=Number(value);
  if(!Number.isInteger(value)||value<1||value>10)return;
  rScore=value;
  document.querySelectorAll('.rate-star').forEach((button,index)=>{
    const filled=index<value;
    const selected=index===value-1;
    button.classList.toggle('on',filled);
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
  const display=document.getElementById('rScoreDisp');
  renderRatingValue(display,value);
  display.classList.add('active');
  display.dataset.tone=window.FBZDomain.ratingTone(value);
  document.getElementById('starsR').dataset.tone=window.FBZDomain.ratingTone(value);
  document.getElementById('rScoreLabel').textContent=labels[value]||'';
  updateMatchRatingRail(value);
}

function renderRatingValue(element,score){
  if(!Number.isInteger(score)||score<1||score>10){element.textContent='—';return;}
  const number=document.createElement('span');
  number.className='rating-score-number';
  number.textContent=String(score);
  const total=document.createElement('span');
  total.className='rating-score-total';
  total.textContent='/10';
  element.replaceChildren(number,total);
}

function syncRatingRail(range,score){
  const selected=Number.isInteger(score)&&score>=1&&score<=10;
  range.value=selected?score:5;
  range.dataset.tone=window.FBZDomain.ratingTone(selected?score:null);
  range.dataset.selected=String(selected);
  range.style.setProperty('--rating-progress',`${((Number(range.value)-1)/9)*100}%`);
  range.setAttribute('aria-valuetext',selected?`${score} из 10 — ${RATING_LABELS[score]}`:'Оценка не выбрана. Начальное положение — 5 из 10. Нажмите Enter, чтобы выбрать 5.');
}

function updateMatchRatingRail(score){
  syncRatingRail(document.getElementById('matchRatingRange'),score);
  document.getElementById('matchRatingClear').disabled=score===null||!ratingContext?.ready;
}

function clearMatchScore(){
  rScore=null;
  document.querySelectorAll('.rate-star').forEach(button=>{
    button.classList.remove('on','selected');
    button.setAttribute('aria-pressed','false');
  });
  document.getElementById('starsR').dataset.tone='neutral';
  const display=document.getElementById('rScoreDisp');
  renderRatingValue(display,null);
  display.classList.remove('active');
  display.dataset.tone='neutral';
  document.getElementById('rScoreLabel').textContent='Выберите оценку';
  updateMatchRatingRail(null);
  document.getElementById('matchRatingRange').focus({preventScroll:true});
}

function commitRailKey(event,element,setScore){
  if(element.disabled||event.ctrlKey||event.metaKey||event.altKey)return;
  const value=Number(element.value);
  const keys={Home:1,End:10,ArrowLeft:Math.max(1,value-1),ArrowDown:Math.max(1,value-1),ArrowRight:Math.min(10,value+1),ArrowUp:Math.min(10,value+1),Enter:value,' ':value};
  if(!Object.hasOwn(keys,event.key))return;
  event.preventDefault();
  setScore(keys[event.key]);
}

function selectSupporterSide(side){
  if(!['home','away','neutral'].includes(side))return;
  rSupporterSide=side;
  const input=document.querySelector(`input[name="ratingSupporterSide"][value="${side}"]`);
  if(input)input.checked=true;
}

function rBack(){
  closePlayerRatingEditor(false);
  document.querySelector('.rate-box').classList.add('is-match-step');
  document.getElementById('rS1').style.display='block';
  document.getElementById('rS2').style.display='none';
  document.getElementById('ss1').classList.add('on');
  document.getElementById('ss2').classList.remove('on');
  document.querySelector('.rate-box').scrollTop=0;
}

function rNext(){
  if(!ratingContext?.ready)return;
  if(!rSupporterSide){toast('Выберите, за какую сторону вы болеете','err');document.querySelector('input[name="ratingSupporterSide"]')?.focus();return;}
  if(!rScore){toast('Выберите оценку','err');return;}
  document.querySelector('.rate-box').classList.remove('is-match-step');
  document.getElementById('rS1').style.display='none';
  document.getElementById('rS2').style.display='block';
  document.getElementById('ss2').classList.add('on');
  document.querySelector('.rate-box').scrollTop=0;
  document.querySelector('#rS2 .rating-player, #rS2 textarea')?.focus({preventScroll:true});
}

function closeRate(){ratingContext=null;window.FBZOverlay?.close('rateOv');}

async function loadRatePlayers(match,context){
  let lineup=null,failed=false;
  try{
    const{data,error}=await sb.rpc('get_match_lineup',{p_match_id:context.matchId});
    if(error)throw error;
    lineup=data;
  }catch(error){console.error('Match lineup error:',error);failed=true;}
  if(!isRatingCurrent(context))return;
  ratingPlayers.clear();
  const players=lineup?.available&&Array.isArray(lineup.players)?lineup.players.filter(p=>p.participation!=='bench'):[];
  players.forEach(player=>{player.team=Number(player.club_id)===Number(lineup.home.club_id)?match.home_team_name:match.away_team_name;if(player.eligible&&Number.isSafeInteger(Number(player.id))&&Number(player.id)>0)ratingPlayers.set(Number(player.id),player);});
  const container=document.getElementById('rPlayers');
  if(!players.length){
    container.innerHTML=`<div class="rating-roster-empty" role="status">${ico('football',22)}<strong>${failed?'Не удалось загрузить состав':'Состав этого матча пока недоступен'}</strong><p>Для оценки игроков нужно подтверждение их участия именно в этой игре.</p><span>Оценку матча и рецензию можно сохранить сейчас.</span>${failed?`<button type="button" class="btn btn-g btn-sm" data-fbz-click="ratings.retry-lineup">Повторить загрузку состава</button>`:''}</div>`;
  }else{
    container.innerHTML=`<p class="rating-lineup-note">${ico('check',14)} Состав на этот матч · ${lineup.provider==='api-football'?'API-Football':'подтверждённое участие'}</p>${players.some(p=>!p.eligible)?'<p class="rating-lineup-note">Для части игроков оценки пока недоступны.</p>':''}<div class="rating-team-tabs" role="group" aria-label="Выберите команду">
      <button class="on" type="button" aria-pressed="true" aria-controls="rating-squad-home" data-fbz-click="ratings.show-rating-team-home">${esc(match.home_team_name)}</button>
      <button type="button" aria-pressed="false" aria-controls="rating-squad-away" data-fbz-click="ratings.show-rating-team-away">${esc(match.away_team_name)}</button>
    </div><div class="rating-squad-grid">${renderTeamSquad(match.home_team_name,players.filter(p=>Number(p.club_id)===Number(lineup.home.club_id)),'home',lineup.home.formation)}${renderTeamSquad(match.away_team_name,players.filter(p=>Number(p.club_id)===Number(lineup.away.club_id)),'away',lineup.away.formation)}</div>`;
  }
  const legacy=context.playerScores.filter(item=>!ratingPlayers.has(Number(item.player_id))&&rPS[item.player_id]!=null);
  if(legacy.length)container.insertAdjacentHTML('beforeend',`<section class="rating-legacy"><h3>Ранее сохранённые оценки</h3><p>Участие этих игроков ещё не подтверждено. Ваши оценки сохранятся вместе с рецензией. Удаление выбранных оценок вступит в силу после сохранения.</p><ul>${legacy.map(item=>`<li data-legacy-player-id="${Number(item.player_id)}"><span>${esc(item.player?.name||`Игрок №${Number(item.player_id)}`)}</span><strong data-tone="${FBZDomain.ratingTone(item.rating)}">${Number(item.rating)}/10</strong><button type="button" class="btn btn-g btn-sm" aria-label="Убрать ранее сохранённую оценку ${esc(item.player?.name||'игрока')}" ${FBZActions.attrs('ratings.clear-legacy',[Number(item.player_id)])}>Убрать</button></li>`).join('')}</ul></section>`);
}

function clearLegacyRating(id){
  if(!isRatingCurrent(ratingContext)||ratingContext.saving||ratingPlayers.has(Number(id)))return;
  delete rPS[id];if(Number(rBest)===Number(id))rBest=null;
  const row=document.querySelector(`[data-legacy-player-id="${Number(id)}"]`),section=row?.closest('.rating-legacy');
  const next=row?.nextElementSibling?.querySelector('button')||row?.previousElementSibling?.querySelector('button')||document.getElementById('rCmt');row?.remove();
  if(!section?.querySelector('li'))section?.remove();
  next?.focus({preventScroll:true});
}

async function retryLineup(){
  const context=ratingContext;
  if(!isRatingCurrent(context)||context.saving||context.loadingLineup)return;
  context.loadingLineup=true;
  try{await loadRatePlayers(context.match,context);if(isRatingCurrent(context)){Object.keys(rPS).forEach(updatePlayerRatingVisual);syncBestPlayerVisuals();}}
  finally{context.loadingLineup=false;}
}

function renderTeamSquad(teamName,players,side,formation){
  if(!players.length)return`<section id="rating-squad-${side}" class="rating-squad${side==='home'?' is-active':''}" data-side="${side}" aria-label="Состав ${esc(FBZNames.club(teamName))}"><div class="rating-roster-empty"><strong>${esc(FBZNames.club(teamName))}</strong><p>Состав команды пока недоступен.</p><span>Можно оценить матч и игроков другой команды. Отсутствующие данные не считаются нулевой оценкой.</span></div></section>`;
  const starters=players.filter(p=>p.participation==='starter'),substitutes=players.filter(p=>p.participation==='substitute');
  const groups={};
  const onGrid=starters.length>0&&starters.every(p=>/^[1-6]:[1-5]$/u.test(p.grid||''));
  starters.forEach(player=>{const key=onGrid?player.grid.split(':')[0]:POSITION_GROUP[FBZNames.positionCode(player.position)]||'other';(groups[key]??=[]).push(player);});
  let html=`<section id="rating-squad-${side}" class="rating-squad${side==='home'?' is-active':''}" data-side="${side}" aria-label="Состав ${esc(FBZNames.club(teamName))}"><header class="rating-team-head"><div><span>${side==='home'?'Хозяева':'Гости'} · Стартовый состав</span><h3>${esc(FBZNames.club(teamName))}</h3></div><small>${esc(formation||'Схема недоступна')}</small></header><div class="rating-pitch">`;
  (onGrid?Object.keys(groups).sort((a,b)=>Number(a)-Number(b)):['gk','def','mid','att','other']).forEach(group=>{
    if(!groups[group]?.length)return;
    groups[group].sort((a,b)=>onGrid?Number(a.grid.split(':')[1])-Number(b.grid.split(':')[1]):String(a.name).localeCompare(String(b.name),'ru'));
    const positions=[...new Set(groups[group].map(p=>POSITION_GROUP[FBZNames.positionCode(p.position)]||'other'))];
    const label=onGrid?(positions.length===1?POSITION_LABEL[positions[0]]:'Стартовый состав'):POSITION_LABEL[group];
    html+=`<div class="rating-pitch-line rating-line-${group}" aria-label="${label}"><span class="rating-position">${label}</span><div class="rating-player-row" style="--player-count:${Math.min(groups[group].length,5)}">${groups[group].map(renderPlayerRating).join('')}</div></div>`;
  });
  html+='</div>';
  if(substitutes.length)html+=`<section class="rating-substitutes"><h4>Вышли на замену</h4><div class="rating-player-row" style="--player-count:${Math.min(substitutes.length,3)}">${substitutes.map(renderPlayerRating).join('')}</div></section>`;
  return html+'</section>';
}

function showRatingTeam(side,button){
  document.querySelectorAll('.rating-squad').forEach(squad=>squad.classList.toggle('is-active',squad.dataset.side===side));
  document.querySelectorAll('.rating-team-tabs button').forEach(tab=>{
    const selected=tab===button;
    tab.classList.toggle('on',selected);
    tab.setAttribute('aria-pressed',String(selected));
  });
  closePlayerRatingEditor(false);
}

function renderPlayerRating(player){
  const eligible=player.eligible!==false&&Number(player.id)>0;
  const number=player.shirt_number?`<small>${Number(player.shirt_number)}</small>`:'';
  const details=[player.minutes_played!=null?`${Number(player.minutes_played)} мин`:null,player.participation==='substitute'&&player.entered_minute!=null?`Вышел ${Number(player.entered_minute)}${player.entered_extra?'+'+Number(player.entered_extra):''}′`:null,player.goals>0?`Голы: ${Number(player.goals)}`:null,player.assists>0?`Передачи: ${Number(player.assists)}`:null,player.yellow_cards>0?'Жёлтая карточка':null,player.red_cards>0?'Красная карточка':null].filter(Boolean);
  return`<button class="rating-player${eligible?'':' is-unlinked'}" ${eligible?`id="rating-player-${Number(player.id)}" data-player-id="${Number(player.id)}"`:''} data-tone="neutral" type="button" ${eligible?FBZActions.attrs("ratings.open-player-rating",[Number(player.id)]):'disabled'} aria-label="${eligible?'Оценить игрока':'Профиль ещё не сопоставлен:'} ${esc(player.name)}">
    <span class="rating-player-score" aria-hidden="true">—</span>
    <span class="rating-player-best" aria-hidden="true">${ico('star',12)} <b>MOTM</b></span>
    <span class="rating-player-avatar" aria-hidden="true">${FBZMedia.visual({entity:player,kind:'player',className:'rating-player-portrait'})}${number}</span>
    <span class="rating-player-name">${esc(player.name)}</span>
    <span class="rating-player-position">${esc(FBZNames.position(player.position,'—'))}</span>
    ${details.length?`<span class="rating-player-events">${esc(details.join(' · '))}</span>`:''}
  </button>`;
}

function playerInitials(name){
  return String(name||'?').trim().split(/\s+/u).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase('ru-RU')||'?';
}

function openPlayerRating(id){
  const player=ratingPlayers.get(Number(id));
  if(!player)return;
  rActivePlayer=Number(id);
  const editor=document.getElementById('playerRatingEditor');
  editor.hidden=false;
  document.getElementById('rPlayers').inert=true;
  document.getElementById('playerRatingInitials').textContent=playerInitials(player.name);
  document.getElementById('playerRatingName').textContent=player.name;
  document.getElementById('playerRatingMeta').textContent=[player.team?FBZNames.club(player.team):'',FBZNames.position(player.position)].filter(Boolean).join(' · ');
  const score=rPS[rActivePlayer]||null;
  document.getElementById('playerRatingRange').value=score||5;
  updatePlayerRatingEditor(score);
  editor.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  document.getElementById('playerRatingRange').focus({preventScroll:true});
}

function closePlayerRatingEditor(returnFocus=true){
  const activeId=rActivePlayer;
  const editor=document.getElementById('playerRatingEditor');
  if(editor)editor.hidden=true;
  document.getElementById('rPlayers').inert=false;
  rActivePlayer=null;
  if(returnFocus&&activeId)document.getElementById(`rating-player-${activeId}`)?.focus({preventScroll:true});
}

function updatePlayerRatingEditor(score){
  const value=document.getElementById('playerRatingValue');
  const label=document.getElementById('playerRatingLabel');
  const range=document.getElementById('playerRatingRange');
  const best=document.getElementById('playerBestButton');
  if(!value||!range)return;
  const tone=window.FBZDomain.ratingTone(score);
  const hasScore=Number.isInteger(score)&&score>=1&&score<=10;
  renderRatingValue(value,score);
  value.dataset.tone=tone;
  label.textContent=hasScore?RATING_LABELS[score]:'Выберите оценку на шкале';
  syncRatingRail(range,score);
  best.disabled=!hasScore;
  best.classList.toggle('on',Number(rBest)===Number(rActivePlayer));
  best.setAttribute('aria-pressed',String(Number(rBest)===Number(rActivePlayer)));
}

function setActivePlayerScore(value){
  if(!rActivePlayer)return;
  setPScore(rActivePlayer,value);
  updatePlayerRatingEditor(rPS[rActivePlayer]||null);
}

function clearActivePlayerRating(){
  if(!rActivePlayer)return;
  setPScore(rActivePlayer,'');
  document.getElementById('playerRatingRange').value=5;
  updatePlayerRatingEditor(null);
}

function toggleActiveBest(){
  if(!rActivePlayer)return;
  selBest(rActivePlayer,document.getElementById('playerBestButton'));
  updatePlayerRatingEditor(rPS[rActivePlayer]||null);
}

function selBest(id,button){
  if(!rPS[id]){
    toast('Сначала поставьте игроку оценку','err');
    openPlayerRating(id);
    return;
  }
  const deselect=Number(rBest)===Number(id);
  rBest=deselect?null:id;
  syncBestPlayerVisuals();
  button?.classList.toggle('on',!deselect);
  button?.setAttribute('aria-pressed',String(!deselect));
}

function setPScore(id,value){
  const score=Number(value);
  if(Number.isInteger(score)&&score>=1&&score<=10){
    rPS[id]=score;
    updatePlayerRatingVisual(id);
    return;
  }
  delete rPS[id];
  if(Number(rBest)===Number(id)){
    rBest=null;
    syncBestPlayerVisuals();
  }
  updatePlayerRatingVisual(id);
}

function updatePlayerRatingVisual(id){
  const button=document.getElementById(`rating-player-${Number(id)}`);
  if(!button)return;
  const player=ratingPlayers.get(Number(id));
  const score=rPS[id];
  const hasScore=Number.isInteger(Number(score));
  button.classList.toggle('has-rating',hasScore);
  button.dataset.tone=window.FBZDomain.ratingTone(score);
  button.querySelector('.rating-player-score').textContent=hasScore?score:'—';
  button.setAttribute('aria-label',`${hasScore?'Изменить оценку':'Оценить игрока'} ${player?.name||''}${hasScore?`, сейчас ${score} из 10`:''}`);
}

function syncBestPlayerVisuals(){
  document.querySelectorAll('.rating-player').forEach(button=>button.classList.toggle('is-best',Number(button.dataset.playerId)===Number(rBest)));
  const best=document.getElementById('playerBestButton');
  if(best&&rActivePlayer){
    const selected=Number(rBest)===Number(rActivePlayer);
    best.classList.toggle('on',selected);
    best.setAttribute('aria-pressed',String(selected));
  }
}

function updateRatingCommentCount(){
  const input=document.getElementById('rCmt');
  const counter=document.getElementById('rCmtCount');
  if(input&&counter)counter.textContent=`${input.value.length}/1000`;
}

function ratingErrorMessage(error){
  const message=String(error?.message||'');
  const messages={
    auth_required:'Войдите, чтобы сохранить оценку',
    match_not_found:'Матч не найден',
    match_not_finished:'Оценить можно после завершения матча',
    rating_out_of_range:'Выберите оценку от 1 до 10',
    comment_too_long:'Комментарий слишком длинный',
    player_ratings_invalid:'Проверьте оценки игроков',
    duplicate_player_rating:'Один игрок добавлен дважды',
    multiple_best_players:'Можно выбрать только одного лучшего игрока',
    player_not_found:'Один из игроков больше недоступен',
    player_not_in_match:'Участие игрока в этом матче не подтверждено. Обновите состав и попробуйте снова.',
    supporter_side_required:'Выберите, за какую сторону вы болеете'
  };
  const key=Object.keys(messages).find(item=>message.includes(item));
  return key?messages[key]:'Не удалось сохранить оценку';
}

function ratingPayload(){
  return Object.entries(rPS).map(([playerId,rating])=>({
    player_id:Number(playerId),
    rating,
    is_best_player:Number(playerId)===Number(rBest)
  }));
}

async function saveRating(){
  if(!CU){openAuth();return;}
  const context=ratingContext;
  if(!isRatingCurrent(context)||!context.ready||context.saving)return;
  const comment=document.getElementById('rCmt').value.trim();
  const playerRatings=ratingPayload();
  const validation=window.FBZDomain.validateRatingDraft({matchRating:rScore,supporterSide:rSupporterSide,comment,playerRatings,bestPlayerId:rBest});
  if(!validation.valid){toast(validation.error,'err');return;}

  const button=document.getElementById('rSave');
  const wasExisting=Boolean(rExisting);
  context.saving=true;
  button.disabled=true;
  button.textContent='Сохраняем...';
  try{
    const{data,error}=await sb.rpc('save_match_rating',{
      p_match_id:context.matchId,
      p_match_rating:rScore,
      p_comment:comment||null,
      p_is_public:document.getElementById('rPub').checked,
      p_player_ratings:playerRatings,
      p_supporter_side:rSupporterSide
    }).single();
    if(error)throw error;
    if(CU?.id!==context.userId)return;
    if(data)Object.assign(CU,{ratings_count:data.ratings_count,avg_rating:data.avg_rating,streak:data.streak,streak_date:data.streak_date});
    const current=isRatingCurrent(context);
    if(current){toast(wasExisting?'Оценка обновлена':'Оценка сохранена','ok');closeRate();}
    refreshAfterRatingChange(context.matchId);
  }catch(error){
    console.error('Rating save error:',error);
    if(isRatingCurrent(context))toast(ratingErrorMessage(error),'err');
  }finally{
    context.saving=false;
    if(isRatingCurrent(context)){
      button.disabled=false;
      button.innerHTML=ico('save',13)+(wasExisting?' Сохранить изменения':' Сохранить оценку');
    }
  }
}

function requestDeleteRating(){
  const context=ratingContext;
  if(!rExisting||!isRatingCurrent(context)||!context.ready||context.saving)return;
  window.FBZConfirm.open({
    title:'Удалить оценку?',
    message:'Оценка матча, комментарий и оценки игроков будут удалены. Это действие нельзя отменить.',
    confirmText:'Удалить оценку',
    onConfirm:()=>deleteRating(context)
  });
}

async function deleteRating(context){
  if(!context||CU?.id!==context.userId)return true;
  try{
    const{data,error}=await sb.rpc('delete_match_rating',{p_match_id:context.matchId}).single();
    if(error)throw error;
    if(CU?.id!==context.userId)return true;
    if(data)Object.assign(CU,{ratings_count:data.ratings_count,avg_rating:data.avg_rating,streak:data.streak,streak_date:data.streak_date});
    if(isRatingCurrent(context))closeRate();
    toast('Оценка удалена','ok');
    refreshAfterRatingChange(context.matchId);
    return true;
  }catch(error){
    console.error('Rating delete error:',error);
    toast('Не удалось удалить оценку','err');
    return false;
  }
}

function refreshAfterRatingChange(matchId){
  refreshHomeDashboard();
  if(CP==='md'&&Number(mdID)===Number(matchId))loadMD(matchId);
  else if(CP==='feed')loadFeed();
}

window.FBZRatings=Object.freeze({open:openRatingForm});
window.__FOOTBAZED_RATINGS_READY__=true;
window.selectSupporterSide=selectSupporterSide;

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "ratings.select-match-score":(event,element)=>selScore(element.value),
  "ratings.clear-match-score":()=>clearMatchScore(),
  "ratings.commit-match-score":(event,element)=>commitRailKey(event,element,selScore),
  "ratings.commit-player-score":(event,element)=>commitRailKey(event,element,setActivePlayerScore),
  "ratings.open-rate":(event,element,[id])=>window.openRate(id),
  "ratings.retry-lineup":()=>retryLineup(),
  "ratings.clear-legacy":(event,element,[id])=>clearLegacyRating(id),
  "ratings.show-rating-team-home":(event,element)=>showRatingTeam('home',element),
  "ratings.show-rating-team-away":(event,element)=>showRatingTeam('away',element),
  "ratings.open-player-rating":(event,element,[id])=>openPlayerRating(id)
});
