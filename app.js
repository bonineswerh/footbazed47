const SBU='https://uukacnyvjvgmmhbkmfzf.supabase.co';
const SBK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1a2Fjbnl2anZnbW1oYmttZnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MDM3MzcsImV4cCI6MjA4NzA3OTczN30.hZIYkrWFqRwu0IciG2iF3TyP8WnVQcV1sFyjfeVUpRc';
const sb=window.supabase.createClient(SBU,SBK);
const DERBY=[{h:'Зенит',a:'Спартак'},{h:'Реал',a:'Барселона'},{h:'Ман Сити',a:'Ливерпуль'},{h:'Ювентус',a:'Милан'},{h:'Бавария',a:'Дортмунд'},{h:'Арсенал',a:'Тоттенхэм'}];
const LEVELS=[{n:'🌱 Новичок',m:0},{n:'🌿 Любитель',m:5},{n:'⭐ Профи',m:20},{n:'🏆 Эксперт',m:50},{n:'👑 Легенда',m:100}];
const AVCOLORS=['av-0','av-1','av-2','av-3','av-4','av-5','av-6','av-7'];
let CU=null,CP='home',PP='home';
let MF='all',ML='all',FS='all',LT='likes',FT='list';
let rMID=null,rScore=null,rPS={},rBest=null;
let chatMID=null,mdID=null,viewUID=null;
let notifOpen=false;

function avColor(str){let h=0;for(let c of(str||'x'))h=(h<<5)-h+c.charCodeAt(0);return AVCOLORS[Math.abs(h)%8];}

async function init(){
  const{data:{session}}=await sb.auth.getSession();
  if(session)await onLogin(session.user);
  sb.auth.onAuthStateChange((_,s)=>{if(s)onLogin(s.user);else onLogout();});
  loadHeroStats();loadHomeM();loadHomeF();setupReveal();
  document.getElementById('chatS').onclick=sendChat;
  document.getElementById('chatI').onkeypress=e=>{if(e.key==='Enter')sendChat();};
  document.addEventListener('click',e=>{if(notifOpen&&!e.target.closest('#notifPanel')&&!e.target.closest('#notifBtn'))closeNotif();});
  const inv=new URLSearchParams(window.location.search).get('invite');
  if(inv)setTimeout(()=>handleInvite(inv),800);
}

async function onLogin(u){
  await ensureProfile(u);
  const{data:p}=await sb.from('users').select('*').eq('id',u.id).maybeSingle();
  CU=p?{...u,...p}:u;
  renderNav();loadNotifications();
}
function onLogout(){CU=null;renderNav();}

function renderNav(){
  const nr=document.getElementById('navRight');
  if(CU){
    const n=CU.display_name||CU.email||'U';
    const cls=avColor(n);
    nr.innerHTML=`<div class="notif-btn" id="notifBtn" onclick="toggleNotif()" style="display:flex">🔔<div class="notif-badge" id="notifBadge"></div></div><div class="nav-user" onclick="go('profile')"><div class="nav-av ${cls}">${n[0].toUpperCase()}</div><span class="nav-uname">${n}</span></div><button class="nbtn nbtn-ghost" onclick="doLogout()">Выйти</button>`;
  }else{
    nr.innerHTML=`<button class="nbtn nbtn-lime" onclick="openAuth()">Войти</button>`;
  }
}

function go(p,d){
  PP=CP;
  document.querySelectorAll('.page').forEach(e=>e.classList.remove('on'));
  document.getElementById(`page-${p}`).classList.add('on');
  document.querySelectorAll('.nl').forEach(l=>l.classList.remove('active'));
  const lk=document.querySelector(`.nl[onclick*="'${p}'"]`);
  if(lk)lk.classList.add('active');
  CP=p;window.scrollTo(0,0);closeNotif();
  // Update mobile nav
  document.querySelectorAll('.mob-nav-item').forEach(b=>b.classList.remove('active'));
  const mn=document.getElementById(`mn-${p}`);if(mn)mn.classList.add('active');
  if(p==='matches')loadM();
  else if(p==='feed')loadFeed();
  else if(p==='leaderboard')loadLB();
  else if(p==='profile'){viewUID=d?.uid||CU?.id;loadProfile(viewUID);}
  else if(p==='md'){mdID=d?.mid;loadMD(d?.mid);}
  else if(p==='chat'){chatMID=d?.mid;document.getElementById('chatTitle').textContent=d?.title||'Чат';loadChat(d?.mid);}
  else if(p==='friends')loadFriendsTab(FT);
}
function goBack(){go(PP);}

async function loadHeroStats(){
  const[{count:u},{count:r},{count:m}]=await Promise.all([
    sb.from('users').select('*',{count:'exact',head:true}),
    sb.from('ratings').select('*',{count:'exact',head:true}),
    sb.from('matches').select('*',{count:'exact',head:true})
  ]);
  anim('hU',u||0);anim('hR',r||0);anim('hM',m||0);
}
function anim(id,t){
  const el=document.getElementById(id);if(!el)return;
  if(!t){el.textContent='0';return;}
  let c=0;const s=Math.ceil(t/40);
  const iv=setInterval(()=>{c=Math.min(c+s,t);el.textContent=c.toLocaleString('ru-RU');if(c>=t)clearInterval(iv);},25);
}

function isDerby(h,a){return DERBY.some(d=>(d.h===h&&d.a===a)||(d.h===a&&d.a===h));}
function fmtDate(d){return new Date(d).toLocaleDateString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}

function renderMCard(m){
  const st={live:'🔴 LIVE',finished:'Завершён',scheduled:'Предстоит'}[m.status]||m.status;
  const sc={live:'t-live',finished:'t-fin',scheduled:'t-sched'}[m.status]||'';
  const derby=isDerby(m.home_team_name,m.away_team_name);
  return`<div class="mcard${derby?' derby':''}" onclick="go('md',{mid:${m.id}})">
    <div class="mcard-gradient"></div>
    <div class="mcard-body">
      <div class="mc-t"><span class="mc-lg">${m.league_name||''}</span>
      <div class="mc-tags">${derby?'<span class="tag t-derby">🔥 ДЕРБИ</span>':''}<span class="tag ${sc}">${st}</span></div></div>
      <div class="mc-score-block">
        <div class="mc-score-team"><div class="mc-score-name">${m.home_team_name}</div><div class="mc-score-num">${m.home_score??'—'}</div></div>
        <div class="mc-score-vs">VS</div>
        <div class="mc-score-team"><div class="mc-score-name">${m.away_team_name}</div><div class="mc-score-num">${m.away_score??'—'}</div></div>
      </div>
      <div class="mc-bottom">
        <div class="mc-meta-left">
          <span class="mc-meta-date">📅 ${fmtDate(m.match_date)}</span>
        </div>
        <div class="mc-acts" onclick="event.stopPropagation()">
          ${m.status==='finished'?`<button class="mbtn lime" onclick="openRate(${m.id})">⭐ Оценить</button>`:''}
          <button class="mbtn" onclick="go('chat',{mid:${m.id},title:'${m.home_team_name} vs ${m.away_team_name}'})">💬</button>
        </div>
      </div>
      ${renderPredBlock(m)}
    </div>
  </div>`;
}

async function loadHomeM(){
  const{data}=await sb.from('matches').select('*').order('match_date',{ascending:false}).limit(6);
  document.getElementById('homeM').innerHTML=data?.length?data.map(renderMCard).join(''):'<div class="empty-state"><div class="empty-icon">📭</div>Матчи появятся здесь</div>';
}
async function loadM(){
  document.getElementById('matchG').innerHTML='<div class="loading"><div class="spin"></div></div>';
  // Load all matches first to build league tabs
  const{data:allData}=await sb.from('matches').select('*').order('match_date',{ascending:false});
  if(!allData?.length){document.getElementById('matchG').innerHTML='<div class="empty-state"><div class="empty-icon">🏟️</div>Матчей не найдено</div>';return;}

  // Build league tabs dynamically
  const leagues=[...new Set(allData.map(m=>m.league_name).filter(Boolean))].sort();
  const LEAGUE_EMOJI={'La Liga':'🇪🇸','Premier League':'🏴','Bundesliga':'🇩🇪','Serie A':'🇮🇹','Ligue 1':'🇫🇷','Champions League':'🏆','Europa League':'🥈','Российская Премьер-лига':'🇷🇺','RPL':'🇷🇺'};
  const tabsEl=document.getElementById('leagueTabs');
  tabsEl.innerHTML=`<button class="league-tab${ML==='all'?' on':''}" onclick="setLeague('all',this)">🌍 Все лиги</button>`+
    leagues.map(l=>`<button class="league-tab${ML===l?' on':''}" onclick="setLeague('${l}',this)">${LEAGUE_EMOJI[l]||'⚽'} ${l}</button>`).join('');

  // Apply filters
  let data=allData;
  const s=document.getElementById('msearch')?.value?.trim();
  if(s)data=data.filter(m=>m.home_team_name.toLowerCase().includes(s.toLowerCase())||m.away_team_name.toLowerCase().includes(s.toLowerCase()));
  if(MF==='live')data=data.filter(m=>m.status==='live');
  else if(MF==='finished')data=data.filter(m=>m.status==='finished');
  else if(MF==='scheduled')data=data.filter(m=>m.status==='scheduled');
  if(ML!=='all')data=data.filter(m=>m.league_name===ML);

  if(!data.length){document.getElementById('matchG').innerHTML='<div class="empty-state"><div class="empty-icon">🏟️</div>Матчей не найдено</div>';return;}

  // Group by league
  if(ML==='all'){
    const grouped={};
    data.forEach(m=>{const lg=m.league_name||'Другое';if(!grouped[lg])grouped[lg]=[];grouped[lg].push(m);});
    document.getElementById('matchG').innerHTML=Object.entries(grouped).map(([lg,ms])=>`
      <div class="league-group">
        <div class="league-group-hd">
          <span style="font-size:20px">${LEAGUE_EMOJI[lg]||'⚽'}</span>
          <div class="league-group-name">${lg}</div>
          <span class="league-group-count">${ms.length} матчей</span>
        </div>
        <div class="grid3">${ms.map(renderMCard).join('')}</div>
      </div>
    `).join('');
  } else {
    document.getElementById('matchG').innerHTML=`<div class="grid3">${data.map(renderMCard).join('')}</div>`;
  }
}
function setLeague(l,btn){ML=l;document.querySelectorAll('.league-tab').forEach(b=>b.classList.remove('on'));btn.classList.add('on');loadM();}
function filterM(){clearTimeout(window._ft);window._ft=setTimeout(loadM,280);}
function setMF(f,btn){MF=f;document.querySelectorAll('#mf .btn').forEach(b=>{b.className='btn btn-g btn-sm';});btn.className='btn btn-l btn-sm';loadM();}

// ─── MATCH DETAIL ───
async function loadMD(id){
  if(!id)return;
  const el=document.getElementById('mdC');
  el.innerHTML='<div class="loading"><div class="spin"></div></div>';
  const[{data:m},{data:ratings},{data:prs}]=await Promise.all([
    sb.from('matches').select('*').eq('id',id).single(),
    sb.from('ratings').select('*,users(display_name,username)').eq('match_id',id).eq('is_public',true).order('created_at',{ascending:false}).limit(20),
    sb.from('player_ratings').select('player_id,rating,players(name,team,position)').eq('match_id',id).order('rating',{ascending:false})
  ]);
  if(!m){el.innerHTML='<div class="empty-state">Матч не найден</div>';return;}
  const avg=ratings?.length?(ratings.reduce((s,r)=>s+(r.match_rating||0),0)/ratings.length).toFixed(1):'—';
  const dist=Array.from({length:10},(_,i)=>10-i).map(n=>({n,c:ratings?.filter(r=>r.match_rating===n).length||0}));
  const maxD=Math.max(...dist.map(d=>d.c),1);
  const tpMap={};
  (prs||[]).forEach(p=>{const k=p.player_id;if(!tpMap[k])tpMap[k]={name:p.players?.name,team:p.players?.team,total:0,cnt:0};tpMap[k].total+=p.rating;tpMap[k].cnt++;});
  const tp=Object.values(tpMap).map(p=>({...p,avg:(p.total/p.cnt).toFixed(1)})).sort((a,b)=>b.avg-a.avg).slice(0,10);
  const stText={live:'🔴 LIVE',finished:'Завершён',scheduled:'Предстоит'}[m.status]||m.status;
  el.innerHTML=`
    <div class="md-hero">
      <div class="md-lg">${m.league_name||''} · ${stText}</div>
      <div class="md-sl">
        <div class="md-team"><div class="md-tname">${m.home_team_name}</div><div class="md-score">${m.home_score??'—'}</div></div>
        <div class="md-vs">VS</div>
        <div class="md-team"><div class="md-tname">${m.away_team_name}</div><div class="md-score">${m.away_score??'—'}</div></div>
      </div>
      <div class="md-meta"><span>📅 ${new Date(m.match_date).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}</span></div>
      <div class="md-comm">
        <div class="md-ci"><div class="md-cv">${avg}</div><div class="md-cl">Средняя оценка</div></div>
        <div class="md-ci"><div class="md-cv">${ratings?.length||0}</div><div class="md-cl">Оценок</div></div>
        <div class="md-ci"><div class="md-cv">${tp[0]?.name||'—'}</div><div class="md-cl">Лучший игрок</div></div>
      </div>
    </div>
    <div style="margin-bottom:20px;display:flex;gap:10px">
      ${m.status==='finished'?`<button class="btn btn-l" onclick="openRate(${m.id})">⭐ Оценить матч</button>`:''}
      <button class="btn btn-g" onclick="go('chat',{mid:${m.id},title:'${m.home_team_name} vs ${m.away_team_name}'})">💬 Чат матча</button>
    </div>
    <div class="md-grid">
      <div>
        <div class="mdcard"><div class="mdcard-title">Топ игроков сообщества</div>${tp.length?tp.map((p,i)=>`<div class="pr-row"><div class="pr-rank">${i+1}</div><div class="pr-info"><div class="pr-name">${p.name||'—'}</div><div class="pr-team">${p.team||''}</div></div><div class="pr-r"><div class="pr-bar"><div class="pr-fill" style="width:${p.avg*10}%"></div></div><div class="pr-val">${p.avg}</div></div></div>`).join(''):'<div class="empty-state" style="padding:20px 0">Нет оценок</div>'}</div>
        <div class="mdcard"><div class="mdcard-title">Оценки сообщества</div>${ratings?.length?ratings.slice(0,8).map(r=>{const cls=avColor(r.users?.display_name||'x');return`<div class="rh-row"><div><div class="rh-m" style="cursor:pointer;color:var(--lime)" onclick="go('profile',{uid:'${r.user_id}'})">${r.users?.display_name||'Аноним'}</div><div class="rh-l">@${r.users?.username||'user'}</div></div><div class="rh-r"><div class="rh-bar"><div class="rh-fill" style="width:${(r.match_rating||0)*10}%"></div></div><div class="rh-v">${r.match_rating}/10</div></div></div>`}).join(''):'<div class="empty-state" style="padding:20px 0">Нет оценок</div>'}</div>
      </div>
      <div>
        <div class="mdcard"><div class="mdcard-title">Распределение оценок</div><div class="rdist">${dist.map(d=>`<div class="rd-row"><div class="rd-l">${d.n}</div><div class="rd-bar"><div class="rd-fill" style="width:${d.c?Math.round(d.c/maxD*100):0}%"></div></div><div class="rd-c">${d.c}</div></div>`).join('')}</div></div>
      </div>
    </div>`;
}

// ─── FEED ───
function renderFCard(r){
  const likes=r.rating_likes?.length||0;
  const n=r.users?.display_name||'U';
  const cls=avColor(n);
  const date=new Date(r.created_at).toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
  const stars=Array.from({length:10},(_,i)=>`<div class="fstar ${i<(r.match_rating||0)?'on':'off'}"></div>`).join('');
  return`<div class="fcard">
    <div class="fc-hd">
      <div class="fc-av ${cls}" onclick="go('profile',{uid:'${r.user_id}'})">${n[0].toUpperCase()}</div>
      <div><div class="fc-uname" onclick="go('profile',{uid:'${r.user_id}'})">${n}</div><div class="fc-handle">@${r.users?.username||'user'}</div></div>
      <div class="fc-time">${date}</div>
    </div>
    <div class="fc-lg">${r.matches?.league_name||''}</div>
    <div class="fc-match" onclick="go('md',{mid:${r.match_id}})">${r.matches?.home_team_name||''} vs ${r.matches?.away_team_name||''}</div>
    <div class="fc-rating"><div class="fc-rnum">${r.match_rating||0}</div><div class="fc-rdenom">/10</div></div>
    <div class="fc-stars">${stars}</div>
    ${r.comment?`<div class="fc-cmt">${r.comment}</div>`:''}
    <div class="fc-ft">
      <button class="lbtn" onclick="tLike(${r.id},this)">❤ ${likes}</button>
      <button class="cbtn" onclick="loadCmnts(${r.id},this)">💬 Комментарии</button>
    </div>
    <div id="fc-${r.id}"></div>
  </div>`;
}
async function loadHomeF(){
  const{data}=await sb.from('ratings').select('*,users(display_name,username),matches(home_team_name,away_team_name,league_name),rating_likes(id)').eq('is_public',true).order('created_at',{ascending:false}).limit(6);
  document.getElementById('homeF').innerHTML=data?.length?data.map(renderFCard).join(''):`<div class="empty-state"><div class="empty-icon">⚽</div>Оценки появятся здесь, когда пользователи начнут оценивать матчи</div>`;
}
async function loadFeed(){
  document.getElementById('feedG').innerHTML='<div class="loading"><div class="spin"></div></div>';
  let q=sb.from('ratings').select('*,users(display_name,username),matches(home_team_name,away_team_name,league_name),rating_likes(id)').eq('is_public',true);
  if(FS==='friends'&&CU){
    const{data:fs}=await sb.from('friendships').select('friend_id').eq('user_id',CU.id).eq('status','accepted');
    const ids=fs?.map(f=>f.friend_id)||[];
    if(!ids.length){document.getElementById('feedG').innerHTML='<div class="empty-state"><div class="empty-icon">👥</div>Добавь друзей чтобы видеть их оценки</div>';return;}
    q=q.in('user_id',ids);
  }
  const{data:rt}=await q.order('created_at',{ascending:false});
  let res=rt||[];
  if(FS==='popular')res.sort((a,b)=>(b.rating_likes?.length||0)-(a.rating_likes?.length||0));
  document.getElementById('feedG').innerHTML=res.length?res.map(renderFCard).join(''):`<div class="empty-state"><div class="empty-icon">⚽</div>Пока нет оценок<br><span style="font-size:13px;color:var(--fog);display:block;margin-top:8px">Оцени матч первым — зайди в раздел Матчи!</span><button class="btn btn-l btn-sm" style="margin-top:16px" onclick="go('matches')">Перейти к матчам →</button></div>`;
}
function setFS(s,btn){FS=s;document.querySelectorAll('#feedT .btn').forEach(b=>b.className='btn btn-g btn-sm');btn.className='btn btn-l btn-sm';loadFeed();}

async function tLike(id,btn){
  if(!CU){openAuth();return;}
  const{data:ex}=await sb.from('rating_likes').select('id').eq('user_id',CU.id).eq('rating_id',id).maybeSingle();
  if(ex){await sb.from('rating_likes').delete().eq('id',ex.id);btn.classList.remove('on');btn.innerHTML=btn.innerHTML.replace(/\d+/,n=>parseInt(n)-1);}
  else{await sb.from('rating_likes').insert({user_id:CU.id,rating_id:id});btn.classList.add('on');btn.innerHTML=btn.innerHTML.replace(/\d+/,n=>parseInt(n)+1);}
}
async function loadCmnts(rid,btn){
  const w=document.getElementById(`fc-${rid}`);
  if(w.innerHTML){w.innerHTML='';return;}
  const{data:cs}=await sb.from('rating_comments').select('*,users(display_name,username)').eq('rating_id',rid).order('created_at',{ascending:true});
  w.innerHTML=`<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--b1)">
    ${(cs||[]).map(c=>`<div style="padding:8px 10px;background:var(--bg3);border-radius:8px;margin-bottom:5px"><div style="font-size:10px;font-weight:700;color:var(--lime);margin-bottom:2px">@${c.users?.username||'user'}</div><div style="font-size:13px;color:var(--mist)">${c.comment}</div></div>`).join('')}
    <div style="display:flex;gap:7px;margin-top:8px">
      <input id="ci-${rid}" style="flex:1;padding:8px 12px;background:var(--bg3);border:1px solid var(--b1);border-radius:8px;color:var(--snow);font-size:12px;font-family:'Plus Jakarta Sans',sans-serif" placeholder="Комментарий...">
      <button onclick="addCmnt(${rid})" class="btn btn-l btn-sm">→</button>
    </div>
  </div>`;
}
async function addCmnt(rid){
  if(!CU){openAuth();return;}
  const inp=document.getElementById(`ci-${rid}`);
  const t=inp?.value?.trim();if(!t)return;
  await sb.from('rating_comments').insert({rating_id:rid,user_id:CU.id,comment:t});
  inp.value='';loadCmnts(rid,null);
}

// ─── LEADERBOARD ───
let lbU=[];
async function loadLB(){
  document.getElementById('lbT').innerHTML='<div class="loading"><div class="spin"></div></div>';
  document.getElementById('lbPod').innerHTML='';
  const{data:users}=await sb.from('users').select('*').limit(30);
  if(!users?.length){document.getElementById('lbT').innerHTML='<div class="empty-state">Нет данных</div>';return;}
  const ids=users.map(u=>u.id);
  const{data:allR}=await sb.from('ratings').select('id,user_id').in('user_id',ids);
  const rIds=(allR||[]).map(r=>r.id);
  let lm={};
  if(rIds.length){const{data:lk}=await sb.from('rating_likes').select('rating_id').in('rating_id',rIds);(lk||[]).forEach(l=>{const r=allR.find(x=>x.id===l.rating_id);if(r)lm[r.user_id]=(lm[r.user_id]||0)+1;});}
  const rcm={};(allR||[]).forEach(r=>{rcm[r.user_id]=(rcm[r.user_id]||0)+1;});
  lbU=users.map(u=>({...u,tl:lm[u.id]||0,rc:rcm[u.id]||u.ratings_count||0}));
  renderLB();
}
function renderLB(){
  const sorted=[...lbU].sort((a,b)=>LT==='likes'?b.tl-a.tl:b.rc-a.rc);
  const top3=sorted.slice(0,3);
  const ord=top3.length>=3?[top3[1],top3[0],top3[2]]:top3;
  const pc=top3.length>=3?['p2','p1','p3']:['p1','p2','p3'];
  document.getElementById('lbPod').innerHTML=ord.map((u,i)=>{
    if(!u)return'';
    const val=LT==='likes'?u.tl:u.rc;const lbl=LT==='likes'?'лайков':'оценок';
    const cls=avColor(u.display_name||'x');
    return`<div class="lb-pod ${pc[i]}" onclick="go('profile',{uid:'${u.id}'})">
      <div class="lb-crown">${i===1&&top3.length>=3?'👑':'⠀'}</div>
      <div class="lb-av ${cls}">${(u.display_name?.[0]||'U').toUpperCase()}</div>
      <div class="lb-pname">${u.display_name||'Аноним'}</div>
      <div class="lb-phand">@${u.username||'user'}</div>
      <div class="lb-pval">${val}</div>
      <div class="lb-plbl">${lbl}</div>
    </div>`;
  }).join('');
  document.getElementById('lbT').innerHTML=sorted.slice(3).map((u,i)=>{
    const val=LT==='likes'?u.tl:u.rc;const lbl=LT==='likes'?'лайков':'оценок';
    const cls=avColor(u.display_name||'x');
    return`<div class="lb-row" onclick="go('profile',{uid:'${u.id}'})">
      <div class="lb-rank">${i+4}</div>
      <div class="lb-user"><div class="lb-uav ${cls}">${(u.display_name?.[0]||'U').toUpperCase()}</div><div><div class="lb-uname">${u.display_name||'Аноним'}</div><div class="lb-uhand">@${u.username||'user'}</div></div></div>
      <div class="lb-score"><div class="lb-sval">${val}</div><div class="lb-slbl">${lbl}</div></div>
    </div>`;
  }).join('');
}
function setLT(t,btn){LT=t;document.querySelectorAll('.lb-tab').forEach(b=>b.classList.remove('on'));btn.classList.add('on');renderLB();}

// ─── PROFILE ───
async function loadProfile(uid){
  const w=document.getElementById('profileW');
  if(!uid){w.innerHTML='<div class="empty-state"><div class="empty-icon">👤</div>Войдите чтобы увидеть профиль</div>';return;}
  w.innerHTML='<div class="loading"><div class="spin"></div></div>';
  const[{data:u},{data:ratings},{data:fs}]=await Promise.all([
    sb.from('users').select('*').eq('id',uid).maybeSingle(),
    sb.from('ratings').select('match_rating,matches(home_team_name,away_team_name,league_name),created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(20),
    sb.from('friendships').select('id').eq('user_id',uid).eq('status','accepted')
  ]);
  if(!u){w.innerHTML='<div class="empty-state">Профиль не найден</div>';return;}
  const{data:allR}=await sb.from('ratings').select('id').eq('user_id',uid);
  const rIds=(allR||[]).map(r=>r.id);
  let tl=0;
  if(rIds.length){const{data:lk}=await sb.from('rating_likes').select('id').in('rating_id',rIds);tl=lk?.length||0;}
  const cnt=u.ratings_count||0;
  const lv=LEVELS.slice().reverse().find(l=>cnt>=l.m)||LEVELS[0];
  const nx=LEVELS[LEVELS.indexOf(lv)+1];
  const pct=nx?Math.min(((cnt-lv.m)/(nx.m-lv.m))*100,100):100;
  const avg=ratings?.length?(ratings.reduce((s,r)=>s+(r.match_rating||0),0)/ratings.length).toFixed(1):'—';
  const isMe=CU?.id===uid;
  const j=new Date(u.created_at||Date.now());
  const ms=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const cls=avColor(u.display_name||'x');
  let compatHtml='';
  if(!isMe&&CU){
    const{data:myR}=await sb.from('ratings').select('match_id,match_rating').eq('user_id',CU.id);
    const{data:theirR}=await sb.from('ratings').select('match_id,match_rating').eq('user_id',uid);
    const shared=(myR||[]).filter(m=>theirR?.find(r=>r.match_id===m.match_id));
    if(shared.length>=3){
      const diffs=shared.map(m=>{const t=theirR.find(r=>r.match_id===m.match_id);return Math.abs(m.match_rating-(t?.match_rating||0));});
      const avgDiff=diffs.reduce((s,d)=>s+d,0)/diffs.length;
      const compat=Math.round(Math.max(0,(1-avgDiff/10)*100));
      compatHtml=`<div class="pcard" style="text-align:center;margin-bottom:18px">
        <div class="pcard-title">⚡ Совместимость оценок</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:64px;color:var(--lime);line-height:1">${compat}%</div>
        <div style="font-size:12px;color:var(--mist);margin-top:4px">на основе ${shared.length} общих матчей</div>
        <div style="height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;margin-top:12px"><div style="height:100%;width:${compat}%;background:linear-gradient(90deg,var(--lime),var(--green));border-radius:3px"></div></div>
      </div>`;
    }
  }
  w.innerHTML=`
    <div class="phero">
      <div class="phero-av ${cls}">${(u.display_name?.[0]||'U').toUpperCase()}</div>
      <div class="phero-name">${u.display_name||'Аноним'}</div>
      <div class="phero-hand">@${u.username||'user'}</div>
      ${u.bio?`<div class="phero-bio">${u.bio}</div>`:''}
      ${u.favorite_teams?`<div style="font-size:12px;color:var(--lime);margin-bottom:12px">❤️ ${u.favorite_teams}</div>`:''}
      <div class="phero-badges">
        <span class="pbadge pb-l">${lv.n}</span>
        ${u.streak>0?`<span class="pbadge pb-s">🔥 ${u.streak} дней подряд</span>`:''}
        <span class="pbadge pb-j">С ${j.getDate()} ${ms[j.getMonth()]} ${j.getFullYear()}</span>
      </div>
      <div class="lp" style="width:100%;max-width:400px">
        <div class="lp-t"><span class="lp-c">${lv.n}</span>${nx?`<span class="lp-n">${nx.n} при ${nx.m} оценках</span>`:''}</div>
        <div class="lp-bar"><div class="lp-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="pstats">
        <div class="pst"><div class="pst-v">${cnt}</div><div class="pst-l">Оценок</div></div>
        <div class="pst"><div class="pst-v">${avg}</div><div class="pst-l">Средняя</div></div>
        <div class="pst"><div class="pst-v">${tl}</div><div class="pst-l">Лайков</div></div>
        <div class="pst"><div class="pst-v">${fs?.length||0}</div><div class="pst-l">Друзей</div></div>
      </div>
      <div class="phero-acts">
        ${isMe?`<button class="btn btn-g btn-sm" onclick="editProfile()">✏️ Редактировать</button><button class="btn btn-g btn-sm" onclick="doLogout()">Выйти</button>`:`<button class="btn btn-l btn-sm" onclick="addFriend('${uid}')">+ Добавить</button>`}
      </div>
    </div>
    <div class="pgrid">
      <div>
        <div class="pcard"><div class="pcard-title">📊 История оценок</div>${ratings?.length?ratings.map(r=>`<div class="rh-row"><div><div class="rh-m">${r.matches?.home_team_name||'Матч'} vs ${r.matches?.away_team_name||''}</div><div class="rh-l">${r.matches?.league_name||''} · ${new Date(r.created_at).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</div></div><div class="rh-r"><div class="rh-bar"><div class="rh-fill" style="width:${(r.match_rating||0)*10}%"></div></div><div class="rh-v">${r.match_rating}/10</div></div></div>`).join(''):'<div class="empty-state" style="padding:20px 0">Нет оценок</div>'}</div>
      </div>
      <div>
        ${compatHtml}
        ${isMe&&u.invite_code?`<div class="pcard"><div class="pcard-title">🔗 Пригласи друга</div><div style="background:var(--bg3);border:1px solid var(--b1);border-radius:9px;padding:12px;margin-bottom:12px;word-break:break-all;font-size:11px;color:var(--lime)">https://bonineswerh.github.io/footbazed47/?invite=${u.invite_code}</div><button class="btn btn-l" style="width:100%" onclick="copyInv('${u.invite_code}')">📋 Копировать ссылку</button></div>`:''}
        <div class="pcard"><div class="pcard-title">📸 Поделиться</div>
          <button class="btn btn-l" style="width:100%;margin-bottom:8px" onclick="openShare('profile',{name:'${(u.display_name||'').replace(/'/g,"\\'")}',username:'${u.username||'user'}',ratings:${cnt},avg:'${avg}',likes:${tl},friends:${fs?.length||0},level:'${lv.n}'})">🖼 Создать карточку</button>
          <button class="btn btn-g" style="width:100%" onclick="expStats(${cnt},'${avg}','${u.username||'user'}')">📋 Копировать текст</button>
        </div>
      </div>
    </div>`;
}
async function addFriend(fid){
  if(!CU){openAuth();return;}
  const{data:ex}=await sb.from('friendships').select('id,status').eq('user_id',CU.id).eq('friend_id',fid).maybeSingle();
  if(ex){toast(ex.status==='pending'?'⏳ Заявка уже отправлена':'✓ Уже в друзьях','err');return;}
  await sb.from('friendships').insert({user_id:CU.id,friend_id:fid,status:'pending'});
  await sb.from('notifications').insert({user_id:fid,from_user_id:CU.id,type:'friend_request',message:`${CU.display_name||CU.username||'Кто-то'} хочет дружить`}).catch(()=>{});
  toast('✅ Заявка отправлена!','ok');
}
function copyInv(c){navigator.clipboard.writeText(`https://bonineswerh.github.io/footbazed47/?invite=${c}`);toast('📋 Скопировано!','ok');}
function expStats(c,a,u){const t=`⚽ FOOTBAZED\n👤 @${u}\n⭐ Оценок: ${c}\n📊 Средняя: ${a}/10`;if(navigator.share)navigator.share({title:'FOOTBAZED',text:t}).catch(()=>{});else{navigator.clipboard.writeText(t);toast('📋 Скопировано!','ok');}}
function editProfile(){const n=prompt('Имя:',CU?.display_name||'');if(!n)return;sb.from('users').update({display_name:n}).eq('id',CU.id).then(()=>{CU.display_name=n;renderNav();loadProfile(CU.id);toast('✅ Обновлено','ok');});}

// ─── FRIENDS PAGE ───
async function loadFriendsTab(tab){
  FT=tab;
  const el=document.getElementById('friendsContent');
  el.innerHTML='<div class="loading"><div class="spin"></div></div>';
  if(!CU){el.innerHTML='<div class="friends-empty"><div class="empty-icon">🔐</div>Войди чтобы видеть друзей</div>';return;}
  if(tab==='list'){
    const{data:fs}=await sb.from('friendships').select('friend_id,users!friendships_friend_id_fkey(id,display_name,username,ratings_count)').eq('user_id',CU.id).eq('status','accepted');
    if(!fs?.length){el.innerHTML='<div class="friends-empty"><div class="empty-icon">👥</div>У тебя пока нет друзей<br><small style="font-size:13px">Найди их через поиск или поделись ссылкой</small></div>';return;}
    el.innerHTML=fs.map(f=>{
      const u=f.users;if(!u)return'';
      const cls=avColor(u.display_name||'x');
      return`<div class="friend-card" onclick="go('profile',{uid:'${u.id}'})"><div class="fcard-av ${cls}">${(u.display_name?.[0]||'U').toUpperCase()}</div><div class="fcard-info"><div class="fcard-name">${u.display_name||'Аноним'}</div><div class="fcard-sub">@${u.username||'user'} · ${u.ratings_count||0} оценок</div></div><div class="fcard-action"><button class="fbtn remove" onclick="event.stopPropagation();removeFriend('${u.id}',this)">✕</button></div></div>`;
    }).join('');
  } else if(tab==='incoming'){
    const{data:inc}=await sb.from('friendships').select('user_id,users!friendships_user_id_fkey(id,display_name,username)').eq('friend_id',CU.id).eq('status','pending');
    if(!inc?.length){el.innerHTML='<div class="friends-empty"><div class="empty-icon">📭</div>Нет входящих заявок</div>';return;}
    el.innerHTML=inc.map(f=>{
      const u=f.users;if(!u)return'';
      const cls=avColor(u.display_name||'x');
      return`<div class="friend-card"><div class="fcard-av ${cls}">${(u.display_name?.[0]||'U').toUpperCase()}</div><div class="fcard-info"><div class="fcard-name">${u.display_name||'Аноним'}</div><div class="fcard-sub">@${u.username||'user'}</div></div><div class="fcard-action"><button class="fbtn accept" onclick="acceptFriend('${u.id}',this.parentElement.parentElement)">✓ Принять</button><button class="fbtn reject" onclick="rejectFriend('${u.id}',this.parentElement.parentElement)">✕</button></div></div>`;
    }).join('');
  } else if(tab==='outgoing'){
    const{data:out}=await sb.from('friendships').select('friend_id,users!friendships_friend_id_fkey(id,display_name,username)').eq('user_id',CU.id).eq('status','pending');
    if(!out?.length){el.innerHTML='<div class="friends-empty"><div class="empty-icon">📤</div>Нет исходящих заявок</div>';return;}
    el.innerHTML=out.map(f=>{
      const u=f.users;if(!u)return'';
      const cls=avColor(u.display_name||'x');
      return`<div class="friend-card"><div class="fcard-av ${cls}">${(u.display_name?.[0]||'U').toUpperCase()}</div><div class="fcard-info"><div class="fcard-name">${u.display_name||'Аноним'}</div><div class="fcard-sub">@${u.username||'user'} · Ожидает ответа</div></div><div class="fcard-action"><button class="fbtn reject" onclick="cancelFriend('${u.id}',this.parentElement.parentElement)">Отменить</button></div></div>`;
    }).join('');
  } else if(tab==='suggest'){
    const{data:top}=await sb.from('users').select('*').neq('id',CU.id).order('ratings_count',{ascending:false}).limit(12);
    if(!top?.length){el.innerHTML='<div class="friends-empty">Нет рекомендаций</div>';return;}
    const{data:myFs}=await sb.from('friendships').select('friend_id').eq('user_id',CU.id);
    const myFIds=(myFs||[]).map(f=>f.friend_id);
    const filtered=top.filter(u=>!myFIds.includes(u.id));
    el.innerHTML=filtered.slice(0,8).map(u=>{
      const cls=avColor(u.display_name||'x');
      return`<div class="friend-card" onclick="go('profile',{uid:'${u.id}'})"><div class="fcard-av ${cls}">${(u.display_name?.[0]||'U').toUpperCase()}</div><div class="fcard-info"><div class="fcard-name">${u.display_name||'Аноним'}</div><div class="fcard-sub">@${u.username||'user'} · ${u.ratings_count||0} оценок</div></div><div class="fcard-action"><button class="fbtn add" onclick="event.stopPropagation();addFriendQ('${u.id}',this)">+ Добавить</button></div></div>`;
    }).join('');
  }
}
function setFTab(tab,btn){document.querySelectorAll('.ftab2').forEach(b=>b.classList.remove('on'));btn.classList.add('on');loadFriendsTab(tab);}
async function searchFriends(){
  const q=document.getElementById('friendSearch').value.trim();
  const el=document.getElementById('friendSearchRes');
  if(q.length<2){el.innerHTML='';return;}
  const{data:users}=await sb.from('users').select('*').ilike('username','%'+q+'%').limit(8);
  if(!users?.length){el.innerHTML='<div style="padding:16px;color:var(--fog);font-size:13px;text-align:center">Не найдено</div>';return;}
  el.innerHTML=users.map(u=>{
    const cls=avColor(u.display_name||'x');
    const isSelf=CU&&u.id===CU.id;
    return`<div class="friend-card" onclick="go('profile',{uid:'${u.id}'})"><div class="fcard-av ${cls}" style="width:36px;height:36px;font-size:16px">${(u.display_name?.[0]||'U').toUpperCase()}</div><div class="fcard-info"><div class="fcard-name">${u.display_name||'Аноним'}</div><div class="fcard-sub">@${u.username}</div></div>${!isSelf?`<button class="fbtn add btn-sm" onclick="event.stopPropagation();addFriendQ('${u.id}',this)">+</button>`:''}</div>`;
  }).join('');
}
async function addFriendQ(fid,btn){await addFriend(fid);btn.textContent='✓';btn.classList.remove('add');btn.disabled=true;}
async function acceptFriend(fid,card){
  await sb.from('friendships').update({status:'accepted'}).eq('user_id',fid).eq('friend_id',CU.id);
  await sb.from('friendships').insert({user_id:CU.id,friend_id:fid,status:'accepted'}).catch(()=>{});
  card.remove();toast('✅ Заявка принята!','ok');
  const badge=document.getElementById('inBadge');
  if(badge){const n=parseInt(badge.textContent)-1;badge.textContent=n;if(n<=0)badge.style.display='none';}
}
async function rejectFriend(fid,card){await sb.from('friendships').delete().eq('user_id',fid).eq('friend_id',CU.id);card.remove();}
async function removeFriend(fid,btn){if(!confirm('Удалить из друзей?'))return;await sb.from('friendships').delete().eq('user_id',CU.id).eq('friend_id',fid);await sb.from('friendships').delete().eq('user_id',fid).eq('friend_id',CU.id);btn.closest('.friend-card').remove();toast('Удалено','ok');}
async function cancelFriend(fid,card){await sb.from('friendships').delete().eq('user_id',CU.id).eq('friend_id',fid);card.remove();}
async function handleInvite(code){
  if(!CU){openAuth();return;}
  const{data:invUser}=await sb.from('users').select('id').eq('invite_code',code).maybeSingle();
  if(invUser&&invUser.id!==CU.id){await sb.from('friendships').insert({user_id:CU.id,friend_id:invUser.id,status:'accepted'}).catch(()=>{});toast('🎉 Друг добавлен!','ok');}
}

// ─── NOTIFICATIONS ───
async function loadNotifications(){
  if(!CU)return;
  const{data:notifs}=await sb.from('notifications').select('*').eq('user_id',CU.id).order('created_at',{ascending:false}).limit(20);
  const unread=(notifs||[]).filter(n=>!n.is_read).length;
  const badge=document.getElementById('notifBadge');
  if(badge){badge.textContent=unread;badge.classList.toggle('on',unread>0);}
  const incBadge=document.getElementById('inBadge');
  const friendReqs=(notifs||[]).filter(n=>n.type==='friend_request'&&!n.is_read).length;
  if(incBadge){incBadge.textContent=friendReqs;incBadge.style.display=friendReqs>0?'inline':'none';}
  const list=document.getElementById('notifList');
  if(!notifs?.length){list.innerHTML='<div class="notif-item"><div class="notif-ico">🔔</div><div class="notif-text">Нет уведомлений</div></div>';return;}
  const icons={friend_request:'👥',like:'❤️',comment:'💬',system:'📣'};
  list.innerHTML=notifs.map(n=>`<div class="notif-item${!n.is_read?' unread':''}" onclick="clickNotif('${n.id}')"><div class="notif-ico">${icons[n.type]||'🔔'}</div><div><div class="notif-text">${n.message||'Уведомление'}</div><div class="notif-time">${new Date(n.created_at).toLocaleDateString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div></div>`).join('');
}
async function clickNotif(id){await sb.from('notifications').update({is_read:true}).eq('id',id);loadNotifications();}
async function markAllRead(){if(!CU)return;await sb.from('notifications').update({is_read:true}).eq('user_id',CU.id);loadNotifications();closeNotif();}
function toggleNotif(){notifOpen=!notifOpen;const p=document.getElementById('notifPanel');if(notifOpen){p.style.display='flex';p.classList.add('on');}else{p.style.display='none';p.classList.remove('on');}}
function closeNotif(){notifOpen=false;const p=document.getElementById('notifPanel');p.style.display='none';p.classList.remove('on');}

// ─── RATING ───
function openRate(mid){
  if(!CU){openAuth();return;}
  rMID=mid;rScore=null;rPS={};rBest=null;
  let info=`Матч #${mid}`;
  document.querySelectorAll('.mcard,.md-hero').forEach(c=>{
    if(c.textContent.includes(String(mid))||c.innerHTML.includes(`mid:${mid}`)){
      const ns=c.querySelectorAll('.mc-tmn,.md-tname');
      if(ns.length>=2)info=`${ns[0].textContent} vs ${ns[1].textContent}`;
    }
  });
  document.getElementById('rMI').textContent=info;
  const row=document.getElementById('starsR');row.innerHTML='';
  const LABELS=['','Ужасно','Плохо','Слабо','Ниже среднего','Средне','Неплохо','Хорошо','Отлично','Великолепно','Шедевр'];
  for(let i=1;i<=10;i++){const b=document.createElement('button');b.className='rate-star';b.innerHTML=`<span class="rate-star-num">${i}</span>`;b.onclick=()=>selScore(i,LABELS);row.appendChild(b);}
  document.getElementById('rScoreDisp').textContent='—';
  document.getElementById('rScoreDisp').classList.remove('active');
  document.getElementById('rScoreLabel').textContent='Выберите оценку';
  document.getElementById('rCmt').value='';
  rBack();
  document.getElementById('rateOv').classList.add('on');
  loadRateP(mid);
}
function selScore(v,labels){
  rScore=v;
  document.querySelectorAll('.rate-star').forEach((b,i)=>b.classList.toggle('on',i<v));
  const disp=document.getElementById('rScoreDisp');
  disp.textContent=v+'/10';disp.classList.add('active');
  const lbl=document.getElementById('rScoreLabel');
  if(labels&&labels[v])lbl.textContent=labels[v];
}
function rBack(){document.getElementById('rS1').style.display='block';document.getElementById('rS2').style.display='none';document.getElementById('ss1').classList.add('on');document.getElementById('ss2').classList.remove('on');}
function rNext(){if(!rScore){toast('Выберите оценку','err');return;}document.getElementById('rS1').style.display='none';document.getElementById('rS2').style.display='block';document.getElementById('ss2').classList.add('on');}
function closeRate(){document.getElementById('rateOv').classList.remove('on');}
async function loadRateP(mid){
  const{data:m}=await sb.from('matches').select('home_team_name,away_team_name').eq('id',mid).single();
  if(!m)return;
  // Fuzzy match: try exact first, then partial match
  let{data:ps}=await sb.from('players').select('*').in('team',[m.home_team_name,m.away_team_name]);
  if(!ps?.length){
    // Try partial match - search for teams containing the match name or vice versa
    const{data:allP}=await sb.from('players').select('*');
    if(allP?.length){
      ps=allP.filter(p=>{
        const pt=p.team.toLowerCase();
        const hn=m.home_team_name.toLowerCase();
        const an=m.away_team_name.toLowerCase();
        return pt.includes(hn)||hn.includes(pt)||pt.includes(an)||an.includes(pt);
      });
    }
  }
  const el=document.getElementById('rPlayers');
  if(!ps?.length){el.innerHTML='<div style="color:var(--fog);font-size:12px;margin-bottom:14px">Игроки не найдены для этого матча</div>';return;}

  // Sort by position: GK → CB/LB/RB → DM/CM/AM → LW/RW/ST
  const posOrder={'GK':1,'CB':2,'LB':3,'RB':4,'Defence':5,'DM':6,'CM':7,'AM':8,'LM':9,'RM':10,'LW':11,'RW':12,'ST':13,'Offence':14};
  const sortP=(a,b)=>(posOrder[a.position]||99)-(posOrder[b.position]||99);

  // Split by team (fuzzy)
  const hn=m.home_team_name.toLowerCase();
  const an=m.away_team_name.toLowerCase();
  const hp=ps.filter(p=>{const t=p.team.toLowerCase();return t.includes(hn)||hn.includes(t);}).sort(sortP);
  const ap=ps.filter(p=>{const t=p.team.toLowerCase();return t.includes(an)||an.includes(t);}).sort(sortP);

  el.innerHTML=`<div class="pg-hd">${m.home_team_name} (${hp.length})</div>${hp.map(rPI).join('')}<div class="pg-hd" style="margin-top:12px">${m.away_team_name} (${ap.length})</div>${ap.map(rPI).join('')}`;
}
function rPI(p){
  const posColors={'GK':'#ffaa00','CB':'#00d4ff','LB':'#00d4ff','RB':'#00d4ff','Defence':'#00d4ff','DM':'#a855f7','CM':'#a855f7','AM':'#a855f7','LM':'#a855f7','RM':'#a855f7','Midfield':'#a855f7','LW':'#ff3a5c','RW':'#ff3a5c','ST':'#ff3a5c','Offence':'#ff3a5c'};
  const col=posColors[p.position]||'var(--fog)';
  return`<div class="pitem"><div class="pi-i"><div class="pi-n">${p.name}</div><div class="pi-p"><span style="color:${col};font-weight:700">${p.position||'—'}</span></div></div><div class="pi-r"><button class="pi-best" onclick="selBest(${p.id},this)">🏆</button><input class="pi-num" type="number" min="1" max="10" placeholder="—" onchange="setPScore(${p.id},this.value,this)"></div></div>`;
}
function selBest(id,btn){rBest=id;document.querySelectorAll('.pi-best').forEach(b=>b.classList.remove('on'));btn.classList.add('on');}
function setPScore(id,v,el){if(v>=1&&v<=10){rPS[id]=parseInt(v);el.style.borderColor='var(--lime)';}else{delete rPS[id];el.style.borderColor='var(--b1)';}}
async function saveRating(){
  if(!rScore){toast('Выберите оценку','err');return;}
  if(!CU){openAuth();return;}
  const btn=document.getElementById('rSave');btn.disabled=true;btn.textContent='Сохраняем...';
  try{
    const cmt=document.getElementById('rCmt').value||null;
    const pub=document.getElementById('rPub').checked;
    const{data:ex}=await sb.from('ratings').select('id').eq('user_id',CU.id).eq('match_id',rMID).maybeSingle();
    const{error}=await sb.from('ratings').upsert({user_id:CU.id,match_id:rMID,match_rating:rScore,comment:cmt,is_public:pub},{onConflict:'user_id,match_id'});
    if(error)throw error;
    if(!ex){const nc=(CU.ratings_count||0)+1;await sb.from('users').update({ratings_count:nc}).eq('id',CU.id);CU.ratings_count=nc;}
    for(const[pid,rating]of Object.entries(rPS)){await sb.from('player_ratings').upsert({user_id:CU.id,match_id:rMID,player_id:parseInt(pid),rating,is_best_player:(pid==rBest)},{onConflict:'user_id,match_id,player_id'});}
    await updStreak();
    toast('✅ Оценка сохранена!','ok');closeRate();
    if(CP==='md')loadMD(rMID);else if(CP==='feed')loadFeed();
  }catch(e){toast('Ошибка: '+e.message,'err');}
  finally{btn.disabled=false;btn.textContent='💾 Сохранить';}
}
async function updStreak(){
  try{
    const today=new Date().toISOString().split('T')[0];
    const{data:last}=await sb.from('ratings').select('created_at').eq('user_id',CU.id).order('created_at',{ascending:false}).limit(2);
    if(last?.length>=2){const ld=new Date(last[1].created_at).toISOString().split('T')[0];const yd=new Date(Date.now()-86400000).toISOString().split('T')[0];const ns=ld<yd?1:(CU.streak||0)+1;await sb.from('users').update({streak:ns,streak_date:today}).eq('id',CU.id);CU.streak=ns;}
  }catch(e){}
}

// ─── CHAT ───
async function loadChat(mid){
  if(!mid)return;
  const body=document.getElementById('chatBody');
  body.innerHTML='<div class="loading"><div class="spin"></div></div>';
  const{data:msgs}=await sb.from('live_chat_messages').select('*').eq('match_id',mid).order('created_at',{ascending:true}).limit(80);
  if(!msgs?.length){body.innerHTML='<div class="empty-state" style="padding:40px">👋 Начни обсуждение!</div>';return;}
  body.innerHTML=msgs.map(m=>`<div class="cmsg ${m.user_id===CU?.id?'own':''}">
    ${m.user_id!==CU?.id?`<div class="cmsg-auth">@${m.username||'user'}</div>`:''}
    <div>${m.message}</div>
  </div>`).join('');
  body.scrollTop=body.scrollHeight;
}
async function sendChat(){
  if(!CU){openAuth();return;}
  const inp=document.getElementById('chatI');
  const msg=inp.value.trim();if(!msg)return;
  await sb.from('live_chat_messages').insert({match_id:chatMID,user_id:CU.id,username:CU.username||CU.email?.split('@')[0]||'user',message:msg});
  inp.value='';loadChat(chatMID);
}

// ─── AUTH (OTP) ───
let authEmailStored='';
function openAuth(){
  document.getElementById('authOv').classList.add('on');
  showAuthStep(1);
  document.getElementById('authE').textContent='';
}
function closeAuth(){document.getElementById('authOv').classList.remove('on');}
function showAuthStep(n){
  document.getElementById('authStep1').style.display=n===1?'block':'none';
  document.getElementById('authStep2').style.display=n===2?'block':'none';
  document.getElementById('authStep3').style.display=n===3?'block':'none';
  document.getElementById('authE').textContent='';
}

async function sendOTP(){
  const email=document.getElementById('authEmail').value.trim();
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    document.getElementById('authE').textContent='Введи корректный email';return;
  }
  const btn=document.getElementById('authSendBtn');
  btn.disabled=true;btn.textContent='Отправляем...';
  try{
    const{error}=await sb.auth.signInWithOtp({email});
    if(error)throw error;
    authEmailStored=email;
    document.getElementById('authEmailShow').textContent=email;
    showAuthStep(2);
    document.getElementById('authCode').focus();
    toast('📬 Код отправлен на почту','ok');
  }catch(e){
    document.getElementById('authE').textContent=e.message||'Ошибка отправки';
  }
  btn.disabled=false;btn.textContent='Отправить код →';
}

async function verifyOTP(){
  const code=document.getElementById('authCode').value.trim();
  if(!code||code.length<6){document.getElementById('authE').textContent='Введи 6-значный код';return;}
  const btn=document.getElementById('authVerifyBtn');
  btn.disabled=true;btn.textContent='Проверяем...';
  try{
    const{data,error}=await sb.auth.verifyOtp({email:authEmailStored,token:code,type:'email'});
    if(error)throw error;
    // Check if user has a profile
    const{data:profile}=await sb.from('users').select('id').eq('id',data.user.id).maybeSingle();
    if(!profile){
      // New user — show profile setup
      showAuthStep(3);
      btn.disabled=false;btn.textContent='Подтвердить';
      return;
    }
    // Existing user — done
    await onLogin(data.user);
    closeAuth();toast('Добро пожаловать! ⚽','ok');
  }catch(e){
    const msgs={'Token has expired or is invalid':'Неверный или просроченный код'};
    document.getElementById('authE').textContent=msgs[e.message]||e.message||'Ошибка';
  }
  btn.disabled=false;btn.textContent='Подтвердить';
}

async function saveProfile(){
  const u=document.getElementById('rU').value.trim();
  const b=document.getElementById('rB').value.trim();
  const t=document.getElementById('rT').value.trim();
  if(!u){document.getElementById('authE').textContent='Введи никнейм';return;}
  if(!/^[a-zA-Z0-9_а-яёА-ЯЁ]{3,30}$/.test(u)){document.getElementById('authE').textContent='3–30 символов, без пробелов';return;}
  const{data:exU}=await sb.from('users').select('id').eq('username',u).maybeSingle();
  if(exU){document.getElementById('authE').textContent='Никнейм уже занят';return;}
  const{data:{user}}=await sb.auth.getUser();
  if(!user)return;
  const code=Math.random().toString(36).substring(2,8).toUpperCase();
  await sb.from('users').insert({
    id:user.id,username:u,display_name:u,email:user.email,
    bio:b||null,favorite_teams:t||null,invite_code:code,
    ratings_count:0,streak:0,last_seen:new Date().toISOString()
  });
  await onLogin(user);
  closeAuth();toast('Добро пожаловать в FOOTBAZED! ⚽','ok');
}

async function ensureProfile(user){
  try{
    const{data:exists}=await sb.from('users').select('id').eq('id',user.id).maybeSingle();
    if(exists)return;
  }catch(e){}
}

async function doLogout(){await sb.auth.signOut();onLogout();toast('Вы вышли','ok');go('home');}

// ─── PREDICTIONS ───
async function loadPrediction(mid,container){
  if(!CU||!container)return;
  const{data:pred}=await sb.from('predictions').select('*').eq('user_id',CU.id).eq('match_id',mid).maybeSingle().catch(()=>({data:null}));
  if(!pred)return;
  container.querySelector('.pred-input[data-side="home"]').value=pred.home_pred??'';
  container.querySelector('.pred-input[data-side="away"]').value=pred.away_pred??'';
  const btn=container.querySelector('.pred-btn');
  if(btn){btn.textContent='✓ Обновить прогноз';btn.style.background='var(--lime4)';}
}
async function savePrediction(mid,btn){
  if(!CU){openAuth();return;}
  const wrap=btn.closest('.pred-wrap');
  const h=parseInt(wrap.querySelector('.pred-input[data-side="home"]').value);
  const a=parseInt(wrap.querySelector('.pred-input[data-side="away"]').value);
  if(isNaN(h)||isNaN(a)||h<0||a<0||h>20||a>20){toast('Введите корректный счёт','err');return;}
  btn.disabled=true;btn.textContent='Сохраняем...';
  try{
    await sb.from('predictions').upsert({user_id:CU.id,match_id:mid,home_pred:h,away_pred:a},{onConflict:'user_id,match_id'});
    btn.textContent='✅ Прогноз сохранён!';
    setTimeout(()=>{btn.textContent='✓ Обновить прогноз';btn.disabled=false;},1500);
  }catch(e){toast('Ошибка: '+e.message,'err');btn.disabled=false;btn.textContent='Сохранить прогноз';}
}
function renderPredBlock(m){
  if(m.status!=='scheduled')return'';
  return`<div class="pred-wrap" onclick="event.stopPropagation()">
    <div class="pred-title">🔮 Твой прогноз</div>
    <div class="pred-row">
      <input class="pred-input" data-side="home" type="number" min="0" max="20" placeholder="—">
      <span class="pred-vs">:</span>
      <input class="pred-input" data-side="away" type="number" min="0" max="20" placeholder="—">
    </div>
    <button class="pred-btn" onclick="savePrediction(${m.id},this)">Сохранить прогноз</button>
  </div>`;
}
function renderPredResult(pred,m){
  if(!pred||m.status!=='finished')return'';
  const exact=pred.home_pred===m.home_score&&pred.away_pred===m.away_score;
  const diff=pred.home_pred-pred.away_pred;const real=m.home_score-m.away_score;
  const rightDir=(diff>0&&real>0)||(diff<0&&real<0)||(diff===0&&real===0);
  if(exact)return`<div class="pred-result correct">🎯 Точный счёт! +3 очка</div>`;
  if(rightDir)return`<div class="pred-result close">📐 Верный исход! +1 очко</div>`;
  return`<div class="pred-result wrong">❌ Не угадал</div>`;
}

// ─── SHARE CARD ───
function openShare(type,data){
  const c=document.getElementById('shareCanvas');
  const ctx=c.getContext('2d');
  c.width=600;c.height=400;

  // Background
  const bg=ctx.createLinearGradient(0,0,600,400);
  bg.addColorStop(0,'#050810');bg.addColorStop(0.5,'#0a0f1c');bg.addColorStop(1,'#0f1530');
  ctx.fillStyle=bg;ctx.fillRect(0,0,600,400);

  // Grid pattern
  ctx.strokeStyle='rgba(255,255,255,0.03)';ctx.lineWidth=1;
  for(let i=0;i<600;i+=40){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,400);ctx.stroke();}
  for(let i=0;i<400;i+=40){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(600,i);ctx.stroke();}

  // Glow
  const glow=ctx.createRadialGradient(300,200,0,300,200,300);
  glow.addColorStop(0,'rgba(198,255,0,0.06)');glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow;ctx.fillRect(0,0,600,400);

  if(type==='profile'){
    // Logo
    ctx.font='bold 16px "Bebas Neue",sans-serif';ctx.fillStyle='rgba(255,255,255,0.3)';
    ctx.letterSpacing='3px';ctx.fillText('FOOTBAZED',24,36);

    // Lime accent line
    ctx.fillStyle='#c6ff00';ctx.fillRect(24,56,80,3);

    // Username
    ctx.font='bold 42px "Bebas Neue",sans-serif';ctx.fillStyle='#eef0ff';
    ctx.fillText(data.name||'Аноним',24,110);

    ctx.font='14px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#8890b8';
    ctx.fillText('@'+(data.username||'user'),24,132);

    // Stats boxes
    const stats=[
      {v:String(data.ratings||0),l:'Оценок'},
      {v:data.avg||'—',l:'Средняя'},
      {v:String(data.likes||0),l:'Лайков'},
      {v:String(data.friends||0),l:'Друзей'}
    ];
    const bw=130,bh=90,startX=24,startY=160,gap=10;
    stats.forEach((s,i)=>{
      const x=startX+i*(bw+gap);
      ctx.fillStyle='rgba(255,255,255,0.03)';
      ctx.beginPath();ctx.roundRect(x,startY,bw,bh,12);ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.beginPath();ctx.roundRect(x,startY,bw,bh,12);ctx.stroke();
      ctx.font='bold 32px "Bebas Neue",sans-serif';ctx.fillStyle='#c6ff00';
      ctx.fillText(s.v,x+16,startY+42);
      ctx.font='10px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#4a5070';
      ctx.fillText(s.l.toUpperCase(),x+16,startY+64);
    });

    // Level badge
    ctx.fillStyle='rgba(198,255,0,0.08)';
    ctx.beginPath();ctx.roundRect(24,280,200,36,18);ctx.fill();
    ctx.strokeStyle='rgba(198,255,0,0.2)';ctx.beginPath();ctx.roundRect(24,280,200,36,18);ctx.stroke();
    ctx.font='bold 13px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#c6ff00';
    ctx.fillText(data.level||'🌱 Новичок',40,303);

    // Footer
    ctx.font='11px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#4a5070';
    ctx.fillText('footbazed.com',24,380);

  } else if(type==='rating'){
    // Match rating share card
    ctx.font='bold 16px "Bebas Neue",sans-serif';ctx.fillStyle='rgba(255,255,255,0.3)';
    ctx.fillText('FOOTBAZED',24,36);
    ctx.fillStyle='#c6ff00';ctx.fillRect(24,56,80,3);

    ctx.font='bold 28px "Bebas Neue",sans-serif';ctx.fillStyle='#eef0ff';
    ctx.fillText(data.match||'',24,100);

    ctx.font='bold 120px "Bebas Neue",sans-serif';ctx.fillStyle='#c6ff00';
    ctx.fillText(data.score+'/10',24,240);

    if(data.comment){
      ctx.font='italic 14px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#8890b8';
      const words=data.comment.split(' ');let line='',y=280;
      words.forEach(w=>{
        if(ctx.measureText(line+w).width>540){ctx.fillText('"'+line.trim()+'"',24,y);y+=22;line='';}
        line+=w+' ';
      });
      if(line)ctx.fillText('"'+line.trim()+'"',24,y);
    }

    ctx.font='bold 13px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#8890b8';
    ctx.fillText('by @'+(data.username||'user'),24,360);
    ctx.font='11px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#4a5070';
    ctx.fillText('footbazed.com',24,380);
  }

  document.getElementById('shareOv').classList.add('on');
}
function closeShare(){document.getElementById('shareOv').classList.remove('on');}
function downloadShare(){
  const c=document.getElementById('shareCanvas');
  const a=document.createElement('a');
  a.download='footbazed-card.png';a.href=c.toDataURL('image/png');a.click();
}
async function copyShare(){
  try{
    const c=document.getElementById('shareCanvas');
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
    toast('📋 Карточка скопирована!','ok');
  }catch(e){downloadShare();toast('Скачано (копирование не поддерживается)','ok');}
}

// ─── REVEAL + MISC ───
function setupReveal(){
  const obs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('shown');});},{threshold:0.08});
  document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
}
function toast(msg,type='ok'){
  const el=document.getElementById('toast');
  el.textContent=msg;el.className=`toast show ${type}`;
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),3000);
}

// Nav scroll effect
window.addEventListener('scroll',()=>{
  document.getElementById('mainNav').classList.toggle('scrolled',window.scrollY>40);
});

init();
