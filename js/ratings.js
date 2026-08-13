'use strict';

let rMID=null;
let rScore=null;
let rPS={};
let rBest=null;
let rExisting=false;
let rActivePlayer=null;
let rSupporterSide=null;
const squadCache=new Map();
const ratingPlayers=new Map();

const TEAM_MAP={
  'man city':'Manchester City FC','man united':'Manchester United FC',
  'arsenal':'Arsenal FC','chelsea':'Chelsea FC','liverpool':'Liverpool FC',
  'tottenham':'Tottenham Hotspur FC','spurs':'Tottenham Hotspur FC',
  'newcastle':'Newcastle United FC','aston villa':'Aston Villa FC',
  'west ham':'West Ham United FC','brighton hove':'Brighton & Hove Albion FC',
  'crystal palace':'Crystal Palace FC','bournemouth':'AFC Bournemouth',
  'fulham':'Fulham FC','brentford':'Brentford FC','everton':'Everton FC',
  'wolverhampton':'Wolverhampton Wanderers FC','wolves':'Wolverhampton Wanderers FC',
  'nottingham':'Nottingham Forest FC','burnley':'Burnley FC',
  'leeds united':'Leeds United FC','sunderland':'Sunderland AFC',
  'barça':'FC Barcelona','barca':'FC Barcelona','barcelona':'FC Barcelona',
  'real madrid':'Real Madrid CF','atleti':'Club Atlético de Madrid',
  'atletico':'Club Atlético de Madrid','sevilla':'Sevilla FC',
  'real betis':'Real Betis Balompié','betis':'Real Betis Balompié',
  'real sociedad':'Real Sociedad de Fútbol','sociedad':'Real Sociedad de Fútbol',
  'villarreal':'Villarreal CF','athletic':'Athletic Club','bilbao':'Athletic Club',
  'valencia':'Valencia CF','getafe':'Getafe CF','girona':'Girona FC',
  'alavés':'Deportivo Alavés','celta':'RC Celta de Vigo',
  'mallorca':'RCD Mallorca','osasuna':'CA Osasuna',
  'rayo vallecano':'Rayo Vallecano de Madrid','espanyol':'RCD Espanyol de Barcelona',
  'elche':'Elche CF','levante':'Levante UD',
  'bayern':'FC Bayern München','dortmund':'Borussia Dortmund',
  'leverkusen':'Bayer 04 Leverkusen','leipzig':'RB Leipzig',
  'frankfurt':'Eintracht Frankfurt','stuttgart':'VfB Stuttgart',
  'freiburg':'SC Freiburg','wolfsburg':'VfL Wolfsburg',
  "m'gladbach":'Borussia Mönchengladbach','gladbach':'Borussia Mönchengladbach',
  'augsburg':'FC Augsburg','hoffenheim':'TSG 1899 Hoffenheim',
  'mainz':'1. FSV Mainz 05','bremen':'SV Werder Bremen',
  'union berlin':'1. FC Union Berlin','heidenheim':'1. FC Heidenheim 1846',
  'st. pauli':'FC St. Pauli 1910','hsv':'Hamburger SV',
  'inter':'FC Internazionale Milano','juventus':'Juventus FC','juve':'Juventus FC',
  'milan':'AC Milan','napoli':'SSC Napoli','roma':'AS Roma','lazio':'SS Lazio',
  'atalanta':'Atalanta BC','fiorentina':'ACF Fiorentina',
  'bologna':'Bologna FC 1909','torino':'Torino FC',
  'udinese':'Udinese Calcio','cagliari':'Cagliari Calcio',
  'genoa':'Genoa CFC','lecce':'US Lecce','verona':'Hellas Verona FC',
  'parma':'Parma Calcio 1913','como':'Como 1907',
  'sassuolo':'US Sassuolo Calcio','cremonese':'US Cremonese',
  'ac pisa':'AC Pisa 1909',
  'psg':'Paris Saint-Germain FC','marseille':'Olympique de Marseille',
  'olympique lyon':'Olympique Lyonnais','lyon':'Olympique Lyonnais',
  'monaco':'AS Monaco FC','lille':'Lille OSC','nice':'OGC Nice',
  'strasbourg':'RC Strasbourg Alsace','stade rennais':'Stade Rennais FC 1901',
  'rennes':'Stade Rennais FC 1901','nantes':'FC Nantes',
  'toulouse':'Toulouse FC','rc lens':'Racing Club de Lens','lens':'Racing Club de Lens',
  'brest':'Stade Brestois 29','le havre':'Le Havre AC',
  'auxerre':'AJ Auxerre','lorient':'FC Lorient',
  'sporting cp':'Sporting Clube de Portugal','galatasaray':'Galatasaray SK',
  'bodø/glimt':'FK Bodø/Glimt'
};

const POSITION_GROUP={
  GK:'gk',Goalkeeper:'gk',CB:'def','Centre-Back':'def',LB:'def','Left-Back':'def',RB:'def','Right-Back':'def',Defence:'def',
  DM:'mid','Defensive Midfield':'mid',CM:'mid','Central Midfield':'mid',AM:'mid','Attacking Midfield':'mid',LM:'mid','Left Midfield':'mid',RM:'mid','Right Midfield':'mid',Midfield:'mid',
  LW:'att','Left Winger':'att',RW:'att','Right Winger':'att',ST:'att','Centre-Forward':'att',Offence:'att'
};
const POSITION_ORDER={GK:1,Goalkeeper:1,CB:2,'Centre-Back':2,LB:3,'Left-Back':3,RB:4,'Right-Back':4,Defence:5,DM:6,'Defensive Midfield':6,CM:7,'Central Midfield':7,AM:8,'Attacking Midfield':8,LM:9,RM:10,Midfield:11,LW:12,'Left Winger':12,RW:13,'Right Winger':13,ST:14,'Centre-Forward':14,Offence:15};
const POSITION_LABEL={gk:'Вратари',def:'Защита',mid:'Полузащита',att:'Атака',other:'Другие'};
const RATING_LABELS=['','Ужасно','Плохо','Слабо','Ниже среднего','Средне','Неплохо','Хорошо','Отлично','Великолепно','Шедевр'];

async function openRate(mid){
  if(!CU){openAuth();return;}
  rMID=Number(mid);rScore=null;rPS={};rBest=null;rExisting=false;rSupporterSide=null;
  resetRatingForm();
  window.FBZOverlay?.open('rateOv','.rate-star');
  try{
    const[{data:match,error:matchError},{data:existing,error:ratingError},{data:playerScores,error:playerError}]=await Promise.all([
      sb.from('matches').select('home_team_name,away_team_name,status').eq('id',rMID).single(),
      sb.from('ratings').select('match_rating,comment,is_public,supporter_side').eq('user_id',CU.id).eq('match_id',rMID).maybeSingle(),
      sb.from('player_ratings').select('player_id,rating,is_best_player').eq('user_id',CU.id).eq('match_id',rMID)
    ]);
    if(matchError)throw matchError;
    if(ratingError)throw ratingError;
    if(playerError)throw playerError;
    if(match.status!=='finished'){
      closeRate();
      toast('Оценить можно после завершения матча','err');
      return;
    }

    document.getElementById('rMI').textContent=`${match.home_team_name} — ${match.away_team_name}`;
    document.getElementById('rSupportHome').textContent=match.home_team_name;
    document.getElementById('rSupportAway').textContent=match.away_team_name;
    setRatingMode(Boolean(existing));
    if(existing){
      selScore(existing.match_rating,RATING_LABELS);
      document.getElementById('rCmt').value=existing.comment||'';
      document.getElementById('rPub').checked=existing.is_public!==false;
      selectSupporterSide(existing.supporter_side||'neutral');
      updateRatingCommentCount();
    }
    await loadRatePlayers(match);
    (playerScores||[]).forEach(item=>{
      rPS[item.player_id]=Number(item.rating);
      updatePlayerRatingVisual(item.player_id);
      if(item.is_best_player)rBest=item.player_id;
    });
    syncBestPlayerVisuals();
  }catch(error){
    console.error('Rating form error:',error);
    closeRate();
    toast('Не удалось открыть форму оценки','err');
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
    button.innerHTML=`<span class="rate-star-num">${value}</span>`;
    button.onclick=()=>selScore(value,RATING_LABELS);
    row.appendChild(button);
  }
  document.getElementById('rScoreDisp').textContent='—';
  document.getElementById('rScoreDisp').classList.remove('active');
  document.getElementById('rScoreDisp').dataset.tone='neutral';
  document.getElementById('rScoreLabel').textContent='Выберите оценку';
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
  rScore=value;
  document.querySelectorAll('.rate-star').forEach((button,index)=>{
    const filled=index<value;
    const selected=index===value-1;
    button.classList.toggle('on',filled);
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
  const display=document.getElementById('rScoreDisp');
  display.textContent=value+'/10';
  display.classList.add('active');
  display.dataset.tone=window.FBZDomain.ratingTone(value);
  document.getElementById('starsR').dataset.tone=window.FBZDomain.ratingTone(value);
  document.getElementById('rScoreLabel').textContent=labels[value]||'';
}

function selectSupporterSide(side){
  if(!['home','away','neutral'].includes(side))return;
  rSupporterSide=side;
  const input=document.querySelector(`input[name="ratingSupporterSide"][value="${side}"]`);
  if(input)input.checked=true;
}

function rBack(){
  closePlayerRatingEditor(false);
  document.getElementById('rS1').style.display='block';
  document.getElementById('rS2').style.display='none';
  document.getElementById('ss1').classList.add('on');
  document.getElementById('ss2').classList.remove('on');
}

function rNext(){
  if(!rSupporterSide){toast('Выберите, за какую сторону вы болеете','err');document.querySelector('input[name="ratingSupporterSide"]')?.focus();return;}
  if(!rScore){toast('Выберите оценку','err');return;}
  document.getElementById('rS1').style.display='none';
  document.getElementById('rS2').style.display='block';
  document.getElementById('ss2').classList.add('on');
  document.querySelector('#rS2 .rating-player, #rS2 textarea')?.focus({preventScroll:true});
}

function closeRate(){window.FBZOverlay?.close('rateOv');}

function mappedTeamName(name){
  const normalized=String(name||'').toLocaleLowerCase('ru-RU').trim();
  return TEAM_MAP[normalized]||name;
}

async function loadRatePlayers(match){
  const requestedTeams=[mappedTeamName(match.home_team_name),match.home_team_name,mappedTeamName(match.away_team_name),match.away_team_name]
    .filter(Boolean)
    .filter((name,index,items)=>items.indexOf(name)===index);
  const cacheKey=[...requestedTeams].sort().join('|');
  let players=squadCache.get(cacheKey);
  if(!players){
    const{data,error}=await sb.from('players').select(PLAYER_FIELDS).in('team',requestedTeams).order('team').order('position').limit(160);
    if(error)throw error;
    players=data||[];
    squadCache.set(cacheKey,players);
  }
  const homePlayers=findPlayersForTeam(players,match.home_team_name);
  const awayPlayers=findPlayersForTeam(players,match.away_team_name);
  ratingPlayers.clear();
  [...homePlayers,...awayPlayers].forEach(player=>ratingPlayers.set(Number(player.id),player));
  const container=document.getElementById('rPlayers');
  if(!homePlayers.length&&!awayPlayers.length){
    container.innerHTML='<div class="empty-state compact"><strong>Составы пока недоступны</strong><span>Оценку матча и комментарий всё равно можно сохранить.</span></div>';
    return;
  }
  container.innerHTML=`<div class="rating-team-tabs" role="tablist" aria-label="Выберите команду">
    <button class="on" type="button" role="tab" aria-selected="true" onclick="showRatingTeam('home',this)">${esc(match.home_team_name)}</button>
    <button type="button" role="tab" aria-selected="false" onclick="showRatingTeam('away',this)">${esc(match.away_team_name)}</button>
  </div><div class="rating-squad-grid">${renderTeamSquad(match.home_team_name,homePlayers,'home')}${renderTeamSquad(match.away_team_name,awayPlayers,'away')}</div>`;
}

function findPlayersForTeam(players,matchTeamName){
  const mapped=mappedTeamName(matchTeamName);
  const normalizedMapped=String(mapped).toLocaleLowerCase('ru-RU');
  const normalizedOriginal=String(matchTeamName).toLocaleLowerCase('ru-RU');
  return players.filter(player=>{
    const team=String(player.team||'').toLocaleLowerCase('ru-RU');
    return team===normalizedMapped||team===normalizedOriginal;
  });
}

function renderTeamSquad(teamName,players,side){
  if(!players.length)return'';
  const groups={gk:[],def:[],mid:[],att:[],other:[]};
  [...players]
    .sort((a,b)=>(POSITION_ORDER[a.position]||99)-(POSITION_ORDER[b.position]||99)||String(a.name).localeCompare(String(b.name),'ru'))
    .forEach(player=>groups[POSITION_GROUP[player.position]||'other'].push(player));
  let html=`<section class="rating-squad${side==='home'?' is-active':''}" data-side="${side}" aria-label="Состав ${esc(teamName)}"><header class="rating-team-head"><div><span>${side==='home'?'Хозяева':'Гости'}</span><h3>${esc(teamName)}</h3></div><small>${players.length} игроков</small></header><div class="rating-pitch">`;
  ['att','mid','def','gk','other'].forEach(group=>{
    if(!groups[group].length)return;
    const label=POSITION_LABEL[group];
    html+=`<div class="rating-pitch-line rating-line-${group}" aria-label="${label}"><span class="rating-position">${label}</span><div class="rating-player-row" style="--player-count:${Math.min(groups[group].length,5)}">${groups[group].map(renderPlayerRating).join('')}</div></div>`;
  });
  return html+'</div></section>';
}

function showRatingTeam(side,button){
  document.querySelectorAll('.rating-squad').forEach(squad=>squad.classList.toggle('is-active',squad.dataset.side===side));
  document.querySelectorAll('.rating-team-tabs button').forEach(tab=>{
    const selected=tab===button;
    tab.classList.toggle('on',selected);
    tab.setAttribute('aria-selected',String(selected));
  });
  closePlayerRatingEditor(false);
}

function renderPlayerRating(player){
  const number=player.shirt_number?`<small>${Number(player.shirt_number)}</small>`:'';
  return`<button class="rating-player" id="rating-player-${Number(player.id)}" data-player-id="${Number(player.id)}" data-tone="neutral" type="button" onclick="openPlayerRating(${Number(player.id)})" aria-label="Оценить игрока ${esc(player.name)}">
    <span class="rating-player-score" aria-hidden="true">—</span>
    <span class="rating-player-best" aria-hidden="true">${ico('star',10)}</span>
    <span class="rating-player-avatar" aria-hidden="true">${esc(playerInitials(player.name))}${number}</span>
    <span class="rating-player-name">${esc(player.name)}</span>
    <span class="rating-player-position">${esc(player.position||'—')}</span>
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
  document.getElementById('playerRatingInitials').textContent=playerInitials(player.name);
  document.getElementById('playerRatingName').textContent=player.name;
  document.getElementById('playerRatingMeta').textContent=`${player.team||''}${player.position?' · '+player.position:''}`;
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
  const hasScore=Number.isInteger(Number(score));
  value.textContent=hasScore?`${score}/10`:'—';
  value.dataset.tone=tone;
  label.textContent=hasScore?RATING_LABELS[score]:'Передвиньте ползунок';
  range.style.setProperty('--rating-progress',hasScore?`${((score-1)/9)*100}%`:'0%');
  range.dataset.tone=tone;
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
    player_not_in_match:'Игрок не входит в состав одной из команд этого матча',
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
  const comment=document.getElementById('rCmt').value.trim();
  const playerRatings=ratingPayload();
  const validation=window.FBZDomain.validateRatingDraft({matchRating:rScore,supporterSide:rSupporterSide,comment,playerRatings,bestPlayerId:rBest});
  if(!validation.valid){toast(validation.error,'err');return;}

  const button=document.getElementById('rSave');
  button.disabled=true;
  button.textContent='Сохраняем...';
  try{
    const{data,error}=await sb.rpc('save_match_rating',{
      p_match_id:rMID,
      p_match_rating:rScore,
      p_comment:comment||null,
      p_is_public:document.getElementById('rPub').checked,
      p_player_ratings:playerRatings,
      p_supporter_side:rSupporterSide
    }).single();
    if(error)throw error;
    if(data)Object.assign(CU,{ratings_count:data.ratings_count,avg_rating:data.avg_rating,streak:data.streak,streak_date:data.streak_date});
    const savedRatingId=Number(data?.rating_id)||null;
    const wasExisting=Boolean(rExisting);
    toast(rExisting?'Оценка обновлена':'Оценка сохранена','ok');
    closeRate();
    refreshAfterRatingChange();
    if(savedRatingId&&!wasExisting){
      setTimeout(()=>window.FBZConfirm?.open({
        title:'Оценка сохранена',
        message:'Можно сразу отправить карточку оценки другу в личный чат.',
        confirmText:'Отправить другу',
        tone:'neutral',
        onConfirm:()=>{forwardRating(savedRatingId);return true;}
      }),250);
    }
  }catch(error){
    console.error('Rating save error:',error);
    toast(ratingErrorMessage(error),'err');
  }finally{
    button.disabled=false;
    button.innerHTML=ico('save',13)+(rExisting?' Сохранить изменения':' Сохранить оценку');
  }
}

function requestDeleteRating(){
  if(!rExisting)return;
  window.FBZConfirm.open({
    title:'Удалить оценку?',
    message:'Оценка матча, комментарий и оценки игроков будут удалены. Это действие нельзя отменить.',
    confirmText:'Удалить оценку',
    onConfirm:deleteRating
  });
}

async function deleteRating(){
  try{
    const{data,error}=await sb.rpc('delete_match_rating',{p_match_id:rMID}).single();
    if(error)throw error;
    if(data)Object.assign(CU,{ratings_count:data.ratings_count,avg_rating:data.avg_rating,streak:data.streak,streak_date:data.streak_date});
    closeRate();
    toast('Оценка удалена','ok');
    refreshAfterRatingChange();
    return true;
  }catch(error){
    console.error('Rating delete error:',error);
    toast('Не удалось удалить оценку','err');
    return false;
  }
}

function refreshAfterRatingChange(){
  refreshHomeDashboard();
  if(CP==='md')loadMD(rMID);
  else if(CP==='feed')loadFeed();
}

window.__FOOTBAZED_RATINGS_READY__=true;
window.openRate=openRate;
window.selectSupporterSide=selectSupporterSide;
