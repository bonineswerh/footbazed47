'use strict';

let rMID=null;
let rScore=null;
let rPS={};
let rBest=null;
let rExisting=false;
const squadCache=new Map();

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
  rMID=Number(mid);rScore=null;rPS={};rBest=null;rExisting=false;
  resetRatingForm();
  window.FBZOverlay?.open('rateOv','.rate-star');
  try{
    const[{data:match,error:matchError},{data:existing,error:ratingError},{data:playerScores,error:playerError}]=await Promise.all([
      sb.from('matches').select('home_team_name,away_team_name,status').eq('id',rMID).single(),
      sb.from('ratings').select('match_rating,comment,is_public').eq('user_id',CU.id).eq('match_id',rMID).maybeSingle(),
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
    setRatingMode(Boolean(existing));
    if(existing){
      selScore(existing.match_rating,RATING_LABELS);
      document.getElementById('rCmt').value=existing.comment||'';
      document.getElementById('rPub').checked=existing.is_public!==false;
      updateRatingCommentCount();
    }
    await loadRatePlayers(match);
    (playerScores||[]).forEach(item=>{
      rPS[item.player_id]=item.rating;
      const input=document.getElementById(`player-score-${item.player_id}`);
      if(input){input.value=item.rating;input.classList.add('has-value');}
      if(item.is_best_player){
        rBest=item.player_id;
        input?.closest('.pitem')?.querySelector('.pi-best')?.classList.add('on');
      }
    });
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
  document.getElementById('rScoreLabel').textContent='Выберите оценку';
  document.getElementById('rCmt').value='';
  document.getElementById('rPub').checked=true;
  document.getElementById('rPlayers').innerHTML='<div class="rating-loading"><div class="spin"></div><span>Загружаем составы</span></div>';
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
    const selected=index<value;
    button.classList.toggle('on',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
  const display=document.getElementById('rScoreDisp');
  display.textContent=value+'/10';
  display.classList.add('active');
  document.getElementById('rScoreLabel').textContent=labels[value]||'';
}

function rBack(){
  document.getElementById('rS1').style.display='block';
  document.getElementById('rS2').style.display='none';
  document.getElementById('ss1').classList.add('on');
  document.getElementById('ss2').classList.remove('on');
}

function rNext(){
  if(!rScore){toast('Выберите оценку','err');return;}
  document.getElementById('rS1').style.display='none';
  document.getElementById('rS2').style.display='block';
  document.getElementById('ss2').classList.add('on');
  document.querySelector('#rS2 input, #rS2 textarea')?.focus({preventScroll:true});
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
  const container=document.getElementById('rPlayers');
  if(!homePlayers.length&&!awayPlayers.length){
    container.innerHTML='<div class="empty-state compact"><strong>Составы пока недоступны</strong><span>Оценку матча и комментарий всё равно можно сохранить.</span></div>';
    return;
  }
  container.innerHTML=renderTeamSquad(match.home_team_name,homePlayers)+renderTeamSquad(match.away_team_name,awayPlayers);
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

function renderTeamSquad(teamName,players){
  if(!players.length)return'';
  const groups={gk:[],def:[],mid:[],att:[],other:[]};
  [...players]
    .sort((a,b)=>(POSITION_ORDER[a.position]||99)-(POSITION_ORDER[b.position]||99)||String(a.name).localeCompare(String(b.name),'ru'))
    .forEach(player=>groups[POSITION_GROUP[player.position]||'other'].push(player));
  let html=`<section class="rating-squad"><div class="pg-hd"><span>${esc(teamName)}</span><small>${players.length}</small></div>`;
  Object.entries(POSITION_LABEL).forEach(([group,label])=>{
    if(!groups[group].length)return;
    html+=`<div class="rating-position">${label}</div>${groups[group].map(renderPlayerRating).join('')}`;
  });
  return html+'</section>';
}

function renderPlayerRating(player){
  return`<div class="pitem"><div class="pi-i"><div class="pi-n">${esc(player.name)}</div><div class="pi-p">${esc(player.position||'Позиция не указана')}</div></div><div class="pi-r"><button class="pi-best" type="button" aria-label="Выбрать ${esc(player.name)} лучшим игроком" aria-pressed="false" title="Лучший игрок" onclick="selBest(${player.id},this)">${ico('star',14)}</button><label class="sr-only" for="player-score-${player.id}">Оценка игрока ${esc(player.name)}</label><input class="pi-num" id="player-score-${player.id}" inputmode="numeric" type="number" min="1" max="10" placeholder="—" onchange="setPScore(${player.id},this.value,this)"></div></div>`;
}

function selBest(id,button){
  if(!rPS[id]){
    toast('Сначала поставьте игроку оценку','err');
    document.getElementById(`player-score-${id}`)?.focus();
    return;
  }
  const deselect=Number(rBest)===Number(id);
  rBest=deselect?null:id;
  document.querySelectorAll('.pi-best').forEach(item=>{
    item.classList.remove('on');
    item.setAttribute('aria-pressed','false');
  });
  if(!deselect){
    button.classList.add('on');
    button.setAttribute('aria-pressed','true');
  }
}

function setPScore(id,value,input){
  const score=Number(value);
  if(Number.isInteger(score)&&score>=1&&score<=10){
    rPS[id]=score;
    input.classList.add('has-value');
    return;
  }
  delete rPS[id];
  input.value='';
  input.classList.remove('has-value');
  if(Number(rBest)===Number(id)){
    rBest=null;
    input.closest('.pitem')?.querySelector('.pi-best')?.classList.remove('on');
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
    player_not_found:'Один из игроков больше недоступен'
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
  const validation=window.FBZDomain.validateRatingDraft({matchRating:rScore,comment,playerRatings,bestPlayerId:rBest});
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
      p_player_ratings:playerRatings
    }).single();
    if(error)throw error;
    if(data)Object.assign(CU,{ratings_count:data.ratings_count,avg_rating:data.avg_rating,streak:data.streak,streak_date:data.streak_date});
    toast(rExisting?'Оценка обновлена':'Оценка сохранена','ok');
    closeRate();
    refreshAfterRatingChange();
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
