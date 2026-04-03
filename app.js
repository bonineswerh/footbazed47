const SBU='https://uukacnyvjvgmmhbkmfzf.supabase.co';
const SBK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1a2Fjbnl2anZnbW1oYmttZnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MDM3MzcsImV4cCI6MjA4NzA3OTczN30.hZIYkrWFqRwu0IciG2iF3TyP8WnVQcV1sFyjfeVUpRc';
const sb=window.supabase.createClient(SBU,SBK);

// ─── SVG ICONS (Heroicons style) ───
const I={
  home:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.955-8.955a1.126 1.126 0 0 1 1.59 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>`,
  football:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>`,
  feed:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3z"/></svg>`,
  trophy:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.996.078-1.927.228-2.25.346v2.168A2.75 2.75 0 0 0 5.25 9.5m0-5.264V4.5h13.5v-.264m0 0c.996.078 1.927.228 2.25.346v2.168A2.75 2.75 0 0 1 18.75 9.5m0-5.264V4.5"/></svg>`,
  users:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0z"/></svg>`,
  bell:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg>`,
  star:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5z"/></svg>`,
  heart:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>`,
  chat:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zM12 21a9 9 0 1 0-7.065-3.438L3 21l3.438-1.935A8.962 8.962 0 0 0 12 21z"/></svg>`,
  search:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z"/></svg>`,
  calendar:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>`,
  fire:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18z"/></svg>`,
  globe:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"/></svg>`,
  copy:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"/></svg>`,
  share:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/></svg>`,
  send:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12zm0 0h7.5"/></svg>`,
  inbox:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-17.5 0V6.108c0-1.135.845-2.098 1.976-2.192a48.424 48.424 0 0 1 11.048 0c1.131.094 1.976 1.057 1.976 2.192V13.5"/></svg>`,
  outbox:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7.875 14.25l1.214 1.942a2.25 2.25 0 001.908 1.058h2.006c.776 0 1.497-.4 1.908-1.058l1.214-1.942M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3"/></svg>`,
  sparkle:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456z"/></svg>`,
  save:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>`,
  link:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/></svg>`,
  edit:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/></svg>`,
  photo:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0z"/></svg>`,
  chart:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125z"/></svg>`,
  target:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 2.25V4.5m0 15v2.25M2.25 12H4.5m15 0h2.25"/></svg>`,
};
function ico(name,size){return(I[name]||'').replace('class="ico"',`class="ico" style="width:${size||16}px;height:${size||16}px"`);}

const DERBY=[{h:'Зенит',a:'Спартак'},{h:'Реал',a:'Барселона'},{h:'Ман Сити',a:'Ливерпуль'},{h:'Ювентус',a:'Милан'},{h:'Бавария',a:'Дортмунд'},{h:'Арсенал',a:'Тоттенхэм'}];
const LEVELS=[{n:'🌱 Новичок',m:0},{n:'🌿 Любитель',m:5},{n:'⭐ Профи',m:20},{n:'🏆 Эксперт',m:50},{n:'👑 Легенда',m:100}];
const AVCOLORS=['av-0','av-1','av-2','av-3','av-4','av-5','av-6','av-7'];
let CU=null,CP='home',PP='home';
let MF='all',ML='all',FS='all',LT='likes',FT='list';
let rMID=null,rScore=null,rPS={},rBest=null;
let chatMID=null,mdID=null,viewUID=null;
let notifOpen=false;

function avColor(str){let h=0;for(let c of(str||'x'))h=(h<<5)-h+c.charCodeAt(0);return AVCOLORS[Math.abs(h)%8];}

// ─── CACHE SYSTEM ───
const CACHE_TTL={matches:5*60*1000,feed:10*60*1000,profile:15*60*1000,stats:30*60*1000,players:60*60*1000};
function setCache(key,data){try{localStorage.setItem('fb_'+key,JSON.stringify({data,ts:Date.now()}));}catch(e){}}
function getCache(key,ttl){try{const c=JSON.parse(localStorage.getItem('fb_'+key));if(!c)return null;if(Date.now()-c.ts>(ttl||CACHE_TTL[key]||300000)){localStorage.removeItem('fb_'+key);return null;}return c.data;}catch(e){return null;}}

async function init(){
  try{
    const{data:{session}}=await sb.auth.getSession();
    if(session){
      await onLogin(session.user);
      go('matches'); // Logged in → skip landing, go to matches
    }
    sb.auth.onAuthStateChange((_,s)=>{if(s){onLogin(s.user);if(CP==='home')go('matches');}else onLogout();});
  }catch(e){console.warn('Auth init error:',e);}
  try{loadHeroStats();loadHomeM();loadHomeF();}catch(e){console.warn('Load error:',e);}
  setupReveal();injectIcons();
  const chatS=document.getElementById('chatS');
  const chatI=document.getElementById('chatI');
  if(chatS)chatS.onclick=sendChat;
  if(chatI)chatI.onkeypress=e=>{if(e.key==='Enter')sendChat();};
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
    const n=CU.username||CU.email?.split('@')[0]||'U';
    const cls=avColor(n);
    const navAv=CU.avatar_url?`<img src="${CU.avatar_url}" style="width:32px;height:32px;border-radius:8px;object-fit:cover">`:`<div class="nav-av ${cls}">${n[0].toUpperCase()}</div>`;
    nr.innerHTML=`<div class="notif-btn" id="notifBtn" onclick="toggleNotif()" style="display:flex">${ico('bell',18)}<div class="notif-badge" id="notifBadge"></div></div><div class="nav-user" onclick="go('profile')">${navAv}<span class="nav-uname">${n}</span></div><button class="nbtn nbtn-ghost" onclick="doLogout()">Выйти</button>`;
  }else{
    nr.innerHTML=`<button class="nbtn nbtn-lime" onclick="openAuth()">Войти</button>`;
  }
}

function go(p,d){
  PP=CP;
  document.querySelectorAll('.page').forEach(e=>e.classList.remove('on'));
  document.getElementById(`page-${p}`).classList.add('on');
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.remove('active'));
  const lk=document.querySelector(`.nav-link[onclick*="'${p}'"]`);
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
      <div class="mc-tags">${derby?'<span class="tag t-derby">'+ico('fire',12)+' ДЕРБИ</span>':''}<span class="tag ${sc}">${st}</span></div></div>
      <div class="mc-score-block">
        <div class="mc-score-team"><div class="mc-score-name">${m.home_team_name}</div><div class="mc-score-num">${m.home_score??'—'}</div></div>
        <div class="mc-score-vs">VS</div>
        <div class="mc-score-team"><div class="mc-score-name">${m.away_team_name}</div><div class="mc-score-num">${m.away_score??'—'}</div></div>
      </div>
      <div class="mc-bottom">
        <div class="mc-meta-left">
          <span class="mc-meta-date">${ico('calendar',12)} ${fmtDate(m.match_date)}</span>
        </div>
        <div class="mc-acts" onclick="event.stopPropagation()">
          ${m.status==='finished'?`<button class="mbtn lime" onclick="openRate(${m.id})">${ico('star',14)} Оценить</button>`:''}
          <button class="mbtn" onclick="go('chat',{mid:${m.id},title:'${m.home_team_name} vs ${m.away_team_name}'})">${ico('chat',14)}</button>
        </div>
      </div>
      ${renderPredBlock(m)}
    </div>
  </div>`;
}

async function loadHomeM(){
  try{
    const cached=getCache('homeMatches');
    if(cached){document.getElementById('homeM').innerHTML=cached.map(renderMCard).join('');return;}
    const{data,error}=await sb.from('matches').select('*').order('match_date',{ascending:false}).limit(6);
    if(error)throw error;
    if(data?.length)setCache('homeMatches',data);
    document.getElementById('homeM').innerHTML=data?.length?data.map(renderMCard).join(''):'<div class="empty-state"><div class="empty-icon">📭</div>Матчи появятся здесь</div>';
  }catch(e){console.warn('loadHomeM:',e);document.getElementById('homeM').innerHTML='<div class="empty-state">Ошибка загрузки</div>';}
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
    leagues.map(l=>`<button class="league-tab${ML===l?' on':''}" onclick="setLeague('${l}',this)">${l}</button>`).join('');

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
  try{
    const{data:m}=await sb.from('matches').select('*').eq('id',id).single();
    if(!m){el.innerHTML='<div class="empty-state">Матч не найден</div>';return;}
    const{data:ratings}=await sb.from('ratings').select('*').eq('match_id',id).eq('is_public',true).order('created_at',{ascending:false}).limit(20);
    const{data:prs}=await sb.from('player_ratings').select('player_id,rating').eq('match_id',id).order('rating',{ascending:false});
    // Get users for ratings
    const rUserIds=[...new Set((ratings||[]).map(r=>r.user_id))];
    let rUserMap={};
    if(rUserIds.length){const{data:us}=await sb.from('users').select('id,display_name,username').in('id',rUserIds);(us||[]).forEach(u=>rUserMap[u.id]=u);}
    // Get players for player_ratings
    const pIds=[...new Set((prs||[]).map(p=>p.player_id))];
    let pMap={};
    if(pIds.length){const{data:ps}=await sb.from('players').select('id,name,team,position').in('id',pIds);(ps||[]).forEach(p=>pMap[p.id]=p);}

    const avg=ratings?.length?(ratings.reduce((s,r)=>s+(r.match_rating||0),0)/ratings.length).toFixed(1):'—';
    const dist=Array.from({length:10},(_,i)=>10-i).map(n=>({n,c:ratings?.filter(r=>r.match_rating===n).length||0}));
    const maxD=Math.max(...dist.map(d=>d.c),1);
    const tpAgg={};
    (prs||[]).forEach(p=>{const k=p.player_id;const pl=pMap[k];if(!tpAgg[k])tpAgg[k]={name:pl?.name||'?',team:pl?.team||'',total:0,cnt:0};tpAgg[k].total+=p.rating;tpAgg[k].cnt++;});
    const tp=Object.values(tpAgg).map(p=>({...p,avg:(p.total/p.cnt).toFixed(1)})).sort((a,b)=>b.avg-a.avg).slice(0,10);
    const stText={live:'🔴 LIVE',finished:'Завершён',scheduled:'Предстоит'}[m.status]||m.status;
    el.innerHTML=`
    <div class="md-hero">
      <div class="md-lg">${m.league_name||''} · ${stText}</div>
      <div class="md-sl">
        <div class="md-team"><div class="md-tname">${m.home_team_name}</div><div class="md-score">${m.home_score??'—'}</div></div>
        <div class="md-vs">VS</div>
        <div class="md-team"><div class="md-tname">${m.away_team_name}</div><div class="md-score">${m.away_score??'—'}</div></div>
      </div>
      <div class="md-meta"><span>${ico('calendar',12)} ${new Date(m.match_date).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}</span></div>
      <div class="md-comm">
        <div class="md-ci"><div class="md-cv">${avg}</div><div class="md-cl">Средняя оценка</div></div>
        <div class="md-ci"><div class="md-cv">${ratings?.length||0}</div><div class="md-cl">Оценок</div></div>
        <div class="md-ci"><div class="md-cv">${tp[0]?.name||'—'}</div><div class="md-cl">Лучший игрок</div></div>
      </div>
    </div>
    <div style="margin-bottom:20px;display:flex;gap:10px">
      ${m.status==='finished'?`<button class="btn btn-l" onclick="openRate(${m.id})">${ico('star',14)} Оценить матч</button>`:''}
      <button class="btn btn-g" onclick="go('chat',{mid:${m.id},title:'${m.home_team_name} vs ${m.away_team_name}'})">${ico('chat',14)} Обсуждение</button>
    </div>
    <div class="md-grid">
      <div>
        <div class="mdcard"><div class="mdcard-title">Топ игроков</div>${tp.length?tp.map((p,i)=>`<div class="pr-row"><div class="pr-rank">${i+1}</div><div class="pr-info"><div class="pr-name">${p.name||'—'}</div><div class="pr-team">${p.team||''}</div></div><div class="pr-r"><div class="pr-bar"><div class="pr-fill" style="width:${p.avg*10}%"></div></div><div class="pr-val">${p.avg}</div></div></div>`).join(''):'<div class="empty-state" style="padding:20px 0">Нет оценок игроков</div>'}</div>
        <div class="mdcard"><div class="mdcard-title">Оценки</div>${ratings?.length?ratings.slice(0,8).map(r=>{const u=rUserMap[r.user_id]||{};return`<div class="rh-row"><div><div class="rh-m" style="cursor:pointer;color:var(--accent2)" onclick="go('profile',{uid:'${r.user_id}'})">${u.display_name||'Аноним'}</div><div class="rh-l">@${u.username||'user'}${r.comment?' · '+r.comment.substring(0,50):''}</div></div><div class="rh-r"><div class="rh-bar"><div class="rh-fill" style="width:${(r.match_rating||0)*10}%"></div></div><div class="rh-v">${r.match_rating}/10</div></div></div>`;}).join(''):'<div class="empty-state" style="padding:20px 0">Нет оценок</div>'}</div>
      </div>
      <div>
        <div class="mdcard"><div class="mdcard-title">Распределение оценок</div><div class="rdist">${dist.map(d=>`<div class="rd-row"><div class="rd-l">${d.n}</div><div class="rd-bar"><div class="rd-fill" style="width:${d.c?Math.round(d.c/maxD*100):0}%"></div></div><div class="rd-c">${d.c}</div></div>`).join('')}</div></div>
      </div>
    </div>`;
  }catch(e){
    console.error('MD error:',e);
    el.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div>Ошибка загрузки матча</div>';
  }
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
      <button class="lbtn" onclick="tLike(${r.id},this)">${ico('heart',13)} ${likes}</button>
      <button class="cbtn" onclick="loadCmnts(${r.id},this)">${ico('chat',13)} Комментарии</button>
    </div>
    <div id="fc-${r.id}"></div>
  </div>`;
}
async function loadHomeF(){
  try{
    const{data}=await sb.from('ratings').select('*').eq('is_public',true).order('created_at',{ascending:false}).limit(6);
    if(!data?.length){document.getElementById('homeF').innerHTML=`<div class="empty-state"><div class="empty-icon">⚽</div>Оценки появятся здесь</div>`;return;}
    const enriched=await enrichRatings(data);
    document.getElementById('homeF').innerHTML=enriched.map(renderFCard).join('');
  }catch(e){document.getElementById('homeF').innerHTML=`<div class="empty-state"><div class="empty-icon">⚽</div>Оценки появятся здесь</div>`;}
}
async function loadFeed(){
  document.getElementById('feedG').innerHTML='<div class="loading"><div class="spin"></div></div>';
  try{
    let uids=null;
    if(FS==='friends'&&CU){
      const{data:fs}=await sb.from('friendships').select('friend_id').eq('user_id',CU.id).eq('status','accepted');
      uids=fs?.map(f=>f.friend_id)||[];
      if(!uids.length){document.getElementById('feedG').innerHTML='<div class="empty-state"><div class="empty-icon">👥</div>Добавь друзей чтобы видеть их оценки</div>';return;}
    }
    let q=sb.from('ratings').select('*').eq('is_public',true);
    if(uids)q=q.in('user_id',uids);
    const{data:rt}=await q.order('created_at',{ascending:false}).limit(50);
    if(!rt?.length){document.getElementById('feedG').innerHTML=`<div class="empty-state"><div class="empty-icon">⚽</div>Пока нет оценок<br><button class="btn btn-l btn-sm" style="margin-top:16px" onclick="go('matches')">Перейти к матчам →</button></div>`;return;}
    const enriched=await enrichRatings(rt);
    let res=enriched;
    if(FS==='popular')res.sort((a,b)=>(b._likes||0)-(a._likes||0));
    document.getElementById('feedG').innerHTML=res.map(renderFCard).join('');
  }catch(e){
    document.getElementById('feedG').innerHTML=`<div class="empty-state"><div class="empty-icon">⚠️</div>Ошибка загрузки ленты</div>`;
  }
}
async function enrichRatings(ratings){
  if(!ratings?.length)return[];
  const userIds=[...new Set(ratings.map(r=>r.user_id))];
  const matchIds=[...new Set(ratings.map(r=>r.match_id))];
  const ratingIds=ratings.map(r=>r.id);
  const[{data:users},{data:matches},{data:likes}]=await Promise.all([
    sb.from('users').select('id,display_name,username').in('id',userIds),
    sb.from('matches').select('id,home_team_name,away_team_name,league_name').in('id',matchIds),
    sb.from('rating_likes').select('rating_id').in('rating_id',ratingIds)
  ]);
  const uMap={};(users||[]).forEach(u=>uMap[u.id]=u);
  const mMap={};(matches||[]).forEach(m=>mMap[m.id]=m);
  const lMap={};(likes||[]).forEach(l=>lMap[l.rating_id]=(lMap[l.rating_id]||0)+1);
  return ratings.map(r=>({...r,users:uMap[r.user_id]||{display_name:'Аноним',username:'user'},matches:mMap[r.match_id]||{home_team_name:'?',away_team_name:'?',league_name:''},_likes:lMap[r.id]||0,rating_likes:Array(lMap[r.id]||0).fill({id:0})}));
}
function setFS(s,btn){FS=s;document.querySelectorAll('#feedT .btn').forEach(b=>b.className='btn btn-g btn-sm');btn.className='btn btn-l btn-sm';loadFeed();}

async function tLike(id,btn){
  if(!CU){openAuth();return;}
  const{data:ex}=await sb.from('rating_likes').select('id').eq('user_id',CU.id).eq('rating_id',id).maybeSingle();
  if(ex){await sb.from('rating_likes').delete().eq('id',ex.id);btn.classList.remove('on');btn.innerHTML=btn.innerHTML.replace(/\d+/,n=>parseInt(n)-1);}
  else{await sb.from('rating_likes').insert({user_id:CU.id,rating_id:id});btn.classList.add('on');btn.innerHTML=btn.innerHTML.replace(/\d+/,n=>parseInt(n)+1);}
}
async function loadCmnts(rid,btn,force){
  const w=document.getElementById(`fc-${rid}`);
  if(!force&&w.innerHTML){w.innerHTML='';return;}
  const{data:cs}=await sb.from('rating_comments').select('*').eq('rating_id',rid).order('created_at',{ascending:true});
  // Get usernames
  const uids=[...new Set((cs||[]).map(c=>c.user_id))];
  let uMap={};
  if(uids.length){const{data:us}=await sb.from('users').select('id,display_name,username').in('id',uids);(us||[]).forEach(u=>uMap[u.id]=u);}
  w.innerHTML=`<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--b1)">
    ${(cs||[]).map(c=>{const u=uMap[c.user_id];return`<div style="padding:8px 10px;background:var(--bg3);border-radius:8px;margin-bottom:5px"><div style="font-size:10px;font-weight:700;color:var(--accent2);margin-bottom:2px">@${u?.username||'user'}</div><div style="font-size:13px;color:var(--text2)">${c.comment}</div></div>`;}).join('')}
    <div style="display:flex;gap:7px;margin-top:8px">
      <input id="ci-${rid}" style="flex:1;padding:8px 12px;background:var(--bg3);border:1px solid var(--b1);border-radius:8px;color:var(--snow);font-size:12px;font-family:inherit" placeholder="Комментарий...">
      <button onclick="addCmnt(${rid})" class="btn btn-l btn-sm">→</button>
    </div>
  </div>`;
}
async function addCmnt(rid){
  if(!CU){openAuth();return;}
  const inp=document.getElementById(`ci-${rid}`);
  const t=inp?.value?.trim();if(!t)return;
  const{error}=await sb.from('rating_comments').insert({rating_id:rid,user_id:CU.id,comment:t});
  if(error){toast('Ошибка','err');console.error(error);return;}
  inp.value='';loadCmnts(rid,null,true);
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
function setLT(t,btn){LT=t;document.querySelectorAll('.lb-tab').forEach(b=>{b.className='btn btn-g btn-sm lb-tab';});btn.className='btn btn-l btn-sm lb-tab';renderLB();}

// ─── PROFILE ───
async function loadProfile(uid){
  const w=document.getElementById('profileW');
  if(!uid){w.innerHTML='<div class="empty-state"><div class="empty-icon">👤</div>Войдите чтобы увидеть профиль</div>';return;}
  w.innerHTML='<div class="loading"><div class="spin"></div></div>';
  try{
    const{data:u}=await sb.from('users').select('*').eq('id',uid).maybeSingle();
    if(!u){w.innerHTML='<div class="empty-state"><div class="empty-icon">👤</div>Профиль не найден<br><span style="font-size:13px;color:var(--fog);margin-top:8px;display:block">Попробуйте войти заново</span></div>';return;}
    const{data:ratings}=await sb.from('ratings').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(20);
    let fs=[];
    try{const{data:f1}=await sb.from('friendships').select('id').eq('user_id',uid).eq('status','accepted');const{data:f2}=await sb.from('friendships').select('id').eq('friend_id',uid).eq('status','accepted');fs=[...(f1||[]),...(f2||[])];}catch(e){}
    // Get likes count
    const rIds=(ratings||[]).map(r=>r.id);
    let tl=0;
    if(rIds.length){const{data:lk}=await sb.from('rating_likes').select('id').in('rating_id',rIds);tl=lk?.length||0;}
    // Get match info for ratings
    const matchIds=[...new Set((ratings||[]).map(r=>r.match_id))];
    let matchMap={};
    if(matchIds.length){const{data:ms}=await sb.from('matches').select('id,home_team_name,away_team_name,league_name').in('id',matchIds);(ms||[]).forEach(m=>matchMap[m.id]=m);}

    const cnt=u.ratings_count||0;
    const lv=LEVELS.slice().reverse().find(l=>cnt>=l.m)||LEVELS[0];
    const nx=LEVELS[LEVELS.indexOf(lv)+1];
    const pct=nx?Math.min(((cnt-lv.m)/(nx.m-lv.m))*100,100):100;
    const avg=ratings?.length?(ratings.reduce((s,r)=>s+(r.match_rating||0),0)/ratings.length).toFixed(1):'—';
    const isMe=CU?.id===uid;
    const j=new Date(u.created_at||Date.now());
    const ms2=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    const cls=avColor(u.username||'x');
    const avatarHtml=u.avatar_url?`<img src="${u.avatar_url}" class="phero-av-img">`:`<div class="phero-av ${cls}">${(u.username?.[0]||'U').toUpperCase()}</div>`;

    w.innerHTML=`
    <div class="phero">
      ${avatarHtml}
      <div class="phero-name">${u.username||'Аноним'}</div>
      ${isMe?`<div class="phero-email">${u.email||''}</div>`:''}
      ${u.bio?`<div class="phero-bio">${u.bio}</div>`:''}
      ${u.favorite_teams?`<div style="font-size:12px;color:var(--accent2);margin-bottom:12px">❤️ ${u.favorite_teams}</div>`:''}
      <div class="phero-badges">
        <span class="pbadge pb-l">${lv.n}</span>
        ${u.streak>0?`<span class="pbadge pb-s">🔥 ${u.streak} дней подряд</span>`:''}
        <span class="pbadge pb-j">С ${j.getDate()} ${ms2[j.getMonth()]} ${j.getFullYear()}</span>
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
        ${isMe?`<button class="btn btn-g btn-sm" onclick="editProfile()">${ico('edit',13)} Редактировать</button><button class="btn btn-g btn-sm" onclick="doLogout()">Выйти</button>`:`<button class="btn btn-l btn-sm" onclick="addFriend('${uid}')">+ Добавить</button>`}
      </div>
    </div>
    <div class="pgrid">
      <div>
        <div class="pcard"><div class="pcard-title">${ico('chart',14)} История оценок</div>${ratings?.length?ratings.map(r=>{const mt=matchMap[r.match_id];return`<div class="rh-row"><div><div class="rh-m">${mt?mt.home_team_name+' vs '+mt.away_team_name:'Матч #'+r.match_id}</div><div class="rh-l">${mt?.league_name||''} · ${new Date(r.created_at).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</div></div><div class="rh-r"><div class="rh-bar"><div class="rh-fill" style="width:${(r.match_rating||0)*10}%"></div></div><div class="rh-v">${r.match_rating}/10</div></div></div>`;}).join(''):'<div class="empty-state" style="padding:20px 0">Нет оценок</div>'}</div>
      </div>
      <div>
        ${isMe&&u.invite_code?`<div class="pcard"><div class="pcard-title">${ico('link',14)} Пригласи друга</div><div style="background:var(--bg3);border:1px solid var(--b1);border-radius:9px;padding:12px;margin-bottom:12px;word-break:break-all;font-size:11px;color:var(--accent2)">https://footbazed47.vercel.app/?invite=${u.invite_code}</div><button class="btn btn-l" style="width:100%" onclick="copyInv('${u.invite_code}')">${ico('copy',13)} Копировать ссылку</button></div>`:''}
        <div class="pcard"><div class="pcard-title">${ico('share',14)} Поделиться</div>
          <button class="btn btn-l" style="width:100%;margin-bottom:8px" onclick="openShare('profile',{name:'${(u.display_name||'').replace(/'/g,"\\'")}',username:'${u.username||'user'}',ratings:${cnt},avg:'${avg}',likes:${tl},friends:${fs?.length||0},level:'${lv.n}'})">${ico('photo',13)} Создать карточку</button>
          <button class="btn btn-g" style="width:100%" onclick="expStats(${cnt},'${avg}','${u.username||'user'}')">${ico('copy',13)} Копировать текст</button>
        </div>
      </div>
    </div>`;
  }catch(e){
    console.error('Profile error:',e);
    w.innerHTML=`<div class="empty-state"><div class="empty-icon">⚠️</div>Ошибка загрузки профиля</div>`;
  }
}
async function addFriend(fid){
  if(!CU){openAuth();return;}
  const{data:ex}=await sb.from('friendships').select('id,status').eq('user_id',CU.id).eq('friend_id',fid).maybeSingle();
  if(ex){toast(ex.status==='pending'?'⏳ Заявка уже отправлена':'✓ Уже в друзьях','err');return;}
  await sb.from('friendships').insert({user_id:CU.id,friend_id:fid,status:'pending'});
  try{await sb.from('notifications').insert({user_id:fid,from_user_id:CU.id,type:'friend_request',message:`${CU.username||'Кто-то'} хочет дружить`});}catch(e){}
  toast('✅ Заявка отправлена!','ok');
}
function copyInv(c){navigator.clipboard.writeText(`https://footbazed47.vercel.app/?invite=${c}`);toast('📋 Скопировано!','ok');}
function expStats(c,a,u){const t=`⚽ FOOTBAZED\n👤 @${u}\n⭐ Оценок: ${c}\n📊 Средняя: ${a}/10`;if(navigator.share)navigator.share({title:'FOOTBAZED',text:t});else{navigator.clipboard.writeText(t);toast('📋 Скопировано!','ok');}}
function editProfile(){
  const w=document.getElementById('profileW');
  const cls=avColor(CU.username||'x');
  const avatarHtml=CU.avatar_url?`<img src="${CU.avatar_url}" class="phero-av-img" id="avPreview">`:`<div class="phero-av ${cls}" id="avPreview">${(CU.username?.[0]||'U').toUpperCase()}</div>`;
  w.innerHTML=`
  <div class="phero" style="max-width:500px;margin:0 auto">
    <div style="position:relative;cursor:pointer" onclick="document.getElementById('avFile').click()">
      ${avatarHtml}
      <div class="av-overlay">${ico('photo',20)}</div>
    </div>
    <input type="file" id="avFile" accept="image/*" style="display:none" onchange="previewAvatar(this)">
    <h2 style="font-family:'Bebas Neue',sans-serif;font-size:24px;margin:16px 0 20px">${ico('edit',20)} Редактирование профиля</h2>
    <div style="width:100%;max-width:380px">
      <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px;text-align:left">Никнейм</label>
      <input class="input" id="ep_user" value="${(CU.username||'').replace(/"/g,'&quot;')}" placeholder="Твой никнейм">
      <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px;text-align:left">Email</label>
      <input class="input" id="ep_email" value="${CU.email||''}" disabled style="opacity:0.5;cursor:not-allowed">
      <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px;text-align:left">О себе</label>
      <input class="input" id="ep_bio" value="${(CU.bio||'').replace(/"/g,'&quot;')}" placeholder="Расскажи о себе" maxlength="120">
      <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px;text-align:left">Любимые команды</label>
      <input class="input" id="ep_teams" value="${(CU.favorite_teams||'').replace(/"/g,'&quot;')}" placeholder="Барселона, Ман Сити...">
      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="btn btn-g" style="flex:1" onclick="loadProfile(CU.id)">Отмена</button>
        <button class="btn btn-l" style="flex:1" id="epSaveBtn" onclick="saveEditProfile()">Сохранить</button>
      </div>
    </div>
  </div>`;
}
let pendingAvatar=null;
function previewAvatar(input){
  if(!input.files||!input.files[0])return;
  const file=input.files[0];
  if(file.size>5*1024*1024){toast('Максимум 5MB','err');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    // Resize to 200x200
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas');
      const size=200;c.width=size;c.height=size;
      const ctx=c.getContext('2d');
      const s=Math.min(img.width,img.height);
      const sx=(img.width-s)/2,sy=(img.height-s)/2;
      ctx.drawImage(img,sx,sy,s,s,0,0,size,size);
      pendingAvatar=c.toDataURL('image/jpeg',0.8);
      const preview=document.getElementById('avPreview');
      if(preview.tagName==='IMG'){preview.src=pendingAvatar;}
      else{preview.outerHTML=`<img src="${pendingAvatar}" class="phero-av-img" id="avPreview">`;}
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}
async function saveEditProfile(){
  const user=document.getElementById('ep_user').value.trim();
  const bio=document.getElementById('ep_bio').value.trim();
  const teams=document.getElementById('ep_teams').value.trim();
  if(!user||user.length<3){toast('Никнейм: минимум 3 символа','err');return;}
  if(!/^[a-zA-Z0-9_а-яёА-ЯЁ]{3,30}$/.test(user)){toast('Без пробелов и спецсимволов','err');return;}
  // Check if username changed and is taken
  if(user!==CU.username){
    const{data:exU}=await sb.from('users').select('id').eq('username',user).maybeSingle();
    if(exU){toast('Никнейм занят','err');return;}
  }
  const btn=document.getElementById('epSaveBtn');
  btn.disabled=true;btn.textContent='Сохраняем...';
  const upd={username:user,display_name:user,bio:bio||null,favorite_teams:teams||null};
  if(pendingAvatar)upd.avatar_url=pendingAvatar;
  const{error}=await sb.from('users').update(upd).eq('id',CU.id);
  if(error){toast('Ошибка: '+error.message,'err');btn.disabled=false;btn.textContent='Сохранить';return;}
  CU.username=user;CU.display_name=user;CU.bio=bio;CU.favorite_teams=teams;
  if(pendingAvatar){CU.avatar_url=pendingAvatar;pendingAvatar=null;}
  renderNav();loadProfile(CU.id);toast('Профиль обновлён!','ok');
}

// ─── FRIENDS PAGE ───
async function loadFriendsTab(tab){
  FT=tab;
  const el=document.getElementById('friendsContent');
  el.innerHTML='<div class="loading"><div class="spin"></div></div>';
  if(!CU){el.innerHTML='<div class="friends-empty"><div class="empty-icon">🔐</div>Войди чтобы видеть друзей</div>';return;}
  try{
    if(tab==='list'){
      const{data:fs}=await sb.from('friendships').select('friend_id').eq('user_id',CU.id).eq('status','accepted');
      if(!fs?.length){el.innerHTML='<div class="friends-empty"><div class="empty-icon">👥</div>У тебя пока нет друзей<br><small style="font-size:13px">Найди их через поиск или поделись ссылкой</small></div>';return;}
      const fids=fs.map(f=>f.friend_id);
      const{data:users}=await sb.from('users').select('*').in('id',fids);
      el.innerHTML=(users||[]).map(u=>{
        const cls=avColor(u.display_name||'x');
        return`<div class="friend-card" onclick="go('profile',{uid:'${u.id}'})"><div class="fcard-av ${cls}">${(u.display_name?.[0]||'U').toUpperCase()}</div><div class="fcard-info"><div class="fcard-name">${u.display_name||'Аноним'}</div><div class="fcard-sub">@${u.username||'user'} · ${u.ratings_count||0} оценок</div></div><div class="fcard-action"><button class="fbtn remove" onclick="event.stopPropagation();removeFriend('${u.id}',this)">✕</button></div></div>`;
      }).join('')||'<div class="friends-empty">Нет друзей</div>';
    } else if(tab==='incoming'){
      const{data:inc}=await sb.from('friendships').select('user_id').eq('friend_id',CU.id).eq('status','pending');
      if(!inc?.length){el.innerHTML='<div class="friends-empty"><div class="empty-icon">📭</div>Нет входящих заявок</div>';return;}
      const uids=inc.map(f=>f.user_id);
      const{data:users}=await sb.from('users').select('*').in('id',uids);
      el.innerHTML=(users||[]).map(u=>{
        const cls=avColor(u.display_name||'x');
        return`<div class="friend-card"><div class="fcard-av ${cls}">${(u.display_name?.[0]||'U').toUpperCase()}</div><div class="fcard-info"><div class="fcard-name">${u.display_name||'Аноним'}</div><div class="fcard-sub">@${u.username||'user'}</div></div><div class="fcard-action"><button class="fbtn accept" onclick="acceptFriend('${u.id}',this.parentElement.parentElement)">✓ Принять</button><button class="fbtn reject" onclick="rejectFriend('${u.id}',this.parentElement.parentElement)">✕</button></div></div>`;
      }).join('');
    } else if(tab==='outgoing'){
      const{data:out}=await sb.from('friendships').select('friend_id').eq('user_id',CU.id).eq('status','pending');
      if(!out?.length){el.innerHTML='<div class="friends-empty"><div class="empty-icon">📤</div>Нет исходящих заявок</div>';return;}
      const fids=out.map(f=>f.friend_id);
      const{data:users}=await sb.from('users').select('*').in('id',fids);
      el.innerHTML=(users||[]).map(u=>{
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
  }catch(e){
    console.error('Friends error:',e);
    el.innerHTML='<div class="friends-empty"><div class="empty-icon">⚠️</div>Ошибка загрузки</div>';
  }
}
function setFTab(tab,btn){document.querySelectorAll('.ftab2').forEach(b=>{b.className='btn btn-g btn-sm ftab2';});btn.className='btn btn-l btn-sm ftab2';loadFriendsTab(tab);}
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
  await sb.from('friendships').insert({user_id:CU.id,friend_id:fid,status:'accepted'});
  // Mark friend_request notification as read
  await sb.from('notifications').update({read:true}).eq('user_id',CU.id).eq('from_user_id',fid).eq('type','friend_request');
  card.remove();toast('✅ Заявка принята!','ok');
  loadNotifications();
}
async function rejectFriend(fid,card){await sb.from('friendships').delete().eq('user_id',fid).eq('friend_id',CU.id);card.remove();}
async function removeFriend(fid,btn){if(!confirm('Удалить из друзей?'))return;await sb.from('friendships').delete().eq('user_id',CU.id).eq('friend_id',fid);await sb.from('friendships').delete().eq('user_id',fid).eq('friend_id',CU.id);btn.closest('.friend-card').remove();toast('Удалено','ok');}
async function cancelFriend(fid,card){await sb.from('friendships').delete().eq('user_id',CU.id).eq('friend_id',fid);card.remove();}
async function handleInvite(code){
  if(!CU){openAuth();return;}
  const{data:invUser}=await sb.from('users').select('id').eq('invite_code',code).maybeSingle();
  if(invUser&&invUser.id!==CU.id){await sb.from('friendships').insert({user_id:CU.id,friend_id:invUser.id,status:'accepted'});toast('🎉 Друг добавлен!','ok');}
}

// ─── NOTIFICATIONS ───
async function loadNotifications(){
  if(!CU)return;
  const{data:notifs}=await sb.from('notifications').select('*').eq('user_id',CU.id).order('created_at',{ascending:false}).limit(20);
  const unread=(notifs||[]).filter(n=>!n.read).length;
  const badge=document.getElementById('notifBadge');
  if(badge){badge.textContent=unread;badge.classList.toggle('on',unread>0);}
  const incBadge=document.getElementById('inBadge');
  const friendReqs=(notifs||[]).filter(n=>n.type==='friend_request'&&!n.read).length;
  if(incBadge){incBadge.textContent=friendReqs;incBadge.style.display=friendReqs>0?'inline':'none';}
  const list=document.getElementById('notifList');
  if(!notifs?.length){list.innerHTML='<div class="notif-item"><div class="notif-ico">🔔</div><div class="notif-text">Нет уведомлений</div></div>';return;}
  
  list.innerHTML=notifs.map(n=>`<div class="notif-item${!n.read?' unread':''}" onclick="clickNotif('${n.id}')"><div class="notif-ico">${ico({friend_request:'users',like:'heart',comment:'chat',system:'bell'}[n.type]||'bell',16)}</div><div><div class="notif-text">${n.message||'Уведомление'}</div><div class="notif-time">${new Date(n.created_at).toLocaleDateString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div></div>`).join('');
}
async function clickNotif(id){await sb.from('notifications').update({read:true}).eq('id',id);loadNotifications();}
async function markAllRead(){if(!CU)return;await sb.from('notifications').update({read:true}).eq('user_id',CU.id);loadNotifications();closeNotif();}
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
// ─── PLAYER CACHE & EXACT TEAM MATCHING ───
let allPlayersCache=null;
async function getAllPlayers(){
  if(allPlayersCache)return allPlayersCache;
  const cached=getCache('players',CACHE_TTL.players);
  if(cached){allPlayersCache=cached;return cached;}
  try{
    const{data}=await sb.from('players').select('*');
    allPlayersCache=data||[];
    if(data?.length)setCache('players',data);
    return allPlayersCache;
  }catch(e){console.warn('getAllPlayers:',e);return[];}
}

// EXACT mapping: match team name → players table team name
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
  'bodø/glimt':'FK Bodø/Glimt',
};

function findPlayersForTeam(allPlayers,matchTeamName){
  const key=matchTeamName.toLowerCase().trim();
  // 1. Direct map lookup
  const mapped=TEAM_MAP[key];
  if(mapped){const f=allPlayers.filter(p=>p.team===mapped);if(f.length)return f;}
  // 2. Exact match in players table
  const exact=allPlayers.filter(p=>p.team.toLowerCase()===key);
  if(exact.length)return exact;
  // 3. Full name in map values (e.g. match already has full name)
  const asValue=allPlayers.filter(p=>p.team.toLowerCase()===key||p.team===matchTeamName);
  if(asValue.length)return asValue;
  // 4. Fallback: nothing found
  return[];
}

async function loadRateP(mid){
  const{data:m}=await sb.from('matches').select('home_team_name,away_team_name').eq('id',mid).single();
  if(!m)return;
  const el=document.getElementById('rPlayers');
  el.innerHTML='<div style="color:var(--fog);font-size:12px">Загружаем игроков...</div>';
  const allPlayers=await getAllPlayers();
  const hp=findPlayersForTeam(allPlayers,m.home_team_name);
  const ap=findPlayersForTeam(allPlayers,m.away_team_name);
  if(!hp.length&&!ap.length){el.innerHTML='<div style="color:var(--fog);font-size:12px;margin-bottom:14px">Игроки не найдены для этого матча</div>';return;}
  el.innerHTML=renderTeamSquad(m.home_team_name,hp)+renderTeamSquad(m.away_team_name,ap);
}

function renderTeamSquad(teamName,players){
  if(!players.length)return`<div class="pg-hd">${teamName} (0)</div><div style="color:var(--fog);font-size:12px;padding:8px 0">Игроки не найдены</div>`;
  const posGroup={'GK':'gk','Goalkeeper':'gk','CB':'def','Centre-Back':'def','LB':'def','Left-Back':'def','RB':'def','Right-Back':'def','Defence':'def','DM':'mid','Defensive Midfield':'mid','CM':'mid','Central Midfield':'mid','AM':'mid','Attacking Midfield':'mid','LM':'mid','Left Midfield':'mid','RM':'mid','Right Midfield':'mid','Midfield':'mid','LW':'att','Left Winger':'att','RW':'att','Right Winger':'att','ST':'att','Centre-Forward':'att','Offence':'att'};
  const posOrder={'GK':1,'Goalkeeper':1,'CB':2,'Centre-Back':2,'LB':3,'Left-Back':3,'RB':4,'Right-Back':4,'Defence':5,'DM':6,'Defensive Midfield':6,'CM':7,'Central Midfield':7,'AM':8,'Attacking Midfield':8,'LM':9,'RM':10,'Midfield':11,'LW':12,'Left Winger':12,'RW':13,'Right Winger':13,'ST':14,'Centre-Forward':14,'Offence':15};
  const sorted=[...players].sort((a,b)=>(posOrder[a.position]||99)-(posOrder[b.position]||99));
  const groups={gk:[],def:[],mid:[],att:[],other:[]};
  sorted.forEach(p=>{const g=posGroup[p.position]||'other';groups[g].push(p);});
  const labels={gk:'🧤 Вратари',def:'🛡️ Защитники',mid:'⚡ Полузащитники',att:'⚽ Нападающие',other:'👤 Другие'};
  let html=`<div class="pg-hd">${teamName} (${players.length})</div>`;
  for(const[key,label]of Object.entries(labels)){
    if(!groups[key]?.length)continue;
    html+=`<div style="font-size:11px;color:var(--fog);font-weight:700;padding:6px 4px 4px;text-transform:uppercase;letter-spacing:0.5px">${label}</div>`;
    html+=groups[key].map(rPI).join('');
  }
  return html;
}
function rPI(p){
  const posColors={'GK':'#ffaa00','CB':'#00d4ff','LB':'#00d4ff','RB':'#00d4ff','Defence':'#00d4ff','DM':'#a855f7','CM':'#a855f7','AM':'#a855f7','LM':'#a855f7','RM':'#a855f7','Midfield':'#a855f7','LW':'#ff3a5c','RW':'#ff3a5c','ST':'#ff3a5c','Offence':'#ff3a5c'};
  const col=posColors[p.position]||'var(--fog)';
  return`<div class="pitem"><div class="pi-i"><div class="pi-n">${p.name}</div><div class="pi-p"><span style="color:${col};font-weight:700">${p.position||'—'}</span></div></div><div class="pi-r"><button class="pi-best" onclick="selBest(${p.id},this)">🏆</button><input class="pi-num" type="number" min="1" max="10" placeholder="—" onchange="setPScore(${p.id},this.value,this)"></div></div>`;
}
function selBest(id,btn){rBest=id;document.querySelectorAll('.pi-best').forEach(b=>b.classList.remove('on'));btn.classList.add('on');}
function setPScore(id,v,el){if(v>=1&&v<=10){rPS[id]=parseInt(v);el.style.borderColor='var(--accent2)';}else{delete rPS[id];el.style.borderColor='var(--b1)';}}
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
  finally{btn.disabled=false;btn.innerHTML=ico('save',13)+' Сохранить';}
}
async function updStreak(){
  try{
    const today=new Date().toISOString().split('T')[0];
    const lastDate=CU.streak_date;
    // Already rated today
    if(lastDate===today)return;
    const yesterday=new Date(Date.now()-86400000).toISOString().split('T')[0];
    let ns=1;
    if(lastDate===yesterday){
      // Consecutive day - increment
      ns=(CU.streak||0)+1;
    }
    // If lastDate is older than yesterday, reset to 1
    await sb.from('users').update({streak:ns,streak_date:today}).eq('id',CU.id);
    CU.streak=ns;CU.streak_date=today;
  }catch(e){}
}

// ─── CHAT ───
async function loadChat(mid){
  if(!mid)return;
  const body=document.getElementById('chatBody');
  body.innerHTML='<div class="loading"><div class="spin"></div></div>';
  const{data:msgs}=await sb.from('chat_messages').select('*').eq('match_id',mid).order('created_at',{ascending:true}).limit(80);
  if(!msgs?.length){body.innerHTML='<div class="empty-state" style="padding:40px">👋 Начни обсуждение!</div>';return;}
  const uids=[...new Set(msgs.map(m=>m.user_id))];
  let uMap={};
  if(uids.length){const{data:us}=await sb.from('users').select('id,username,display_name').in('id',uids);(us||[]).forEach(u=>uMap[u.id]=u);}
  body.innerHTML=msgs.map(m=>{const u=uMap[m.user_id];return`<div class="cmsg ${m.user_id===CU?.id?'own':''}">
    ${m.user_id!==CU?.id?`<div class="cmsg-auth">@${u?.username||'user'}</div>`:''}
    <div>${m.message}</div>
  </div>`;}).join('');
  body.scrollTop=body.scrollHeight;
}
async function sendChat(){
  if(!CU){openAuth();return;}
  const inp=document.getElementById('chatI');
  const msg=inp.value.trim();if(!msg)return;
  const{error}=await sb.from('chat_messages').insert({match_id:chatMID,user_id:CU.id,message:msg});
  if(error){toast('Ошибка отправки','err');console.error(error);return;}
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
  document.getElementById('authE').textContent='';
  try{
    const{error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
    if(error)throw error;
    authEmailStored=email;
    document.getElementById('authEmailShow').textContent=email;
    showAuthStep(2);
    document.getElementById('authCode').focus();
    toast('📬 Код отправлен на почту!','ok');
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
    const email=user.email||'';
    const name=email.split('@')[0]||'user';
    const code=Math.random().toString(36).substring(2,8).toUpperCase();
    const{error}=await sb.from('users').insert({
      id:user.id,
      username:name.replace(/[^a-zA-Z0-9_]/g,'_').substring(0,20),
      display_name:name,
      email:email,
      invite_code:code,
      ratings_count:0,
      avg_rating:0,
      streak:0,
      is_public:true
    });
    if(error)console.warn('Profile create error:',error);
  }catch(e){console.warn('ensureProfile error:',e);}
}

async function doLogout(){await sb.auth.signOut();onLogout();toast('Вы вышли','ok');go('home');}

// ─── PREDICTIONS ───
async function loadPrediction(mid,container){
  if(!CU||!container)return;
  const{data:pred}=await sb.from('predictions').select('*').eq('user_id',CU.id).eq('match_id',mid).maybeSingle();
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
    <div class="pred-title">${ico('target',13)} ТВОЙ ПРОГНОЗ</div>
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
    ctx.fillStyle='#6c5ce7';ctx.fillRect(24,56,80,3);

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
      ctx.font='bold 32px "Bebas Neue",sans-serif';ctx.fillStyle='#6c5ce7';
      ctx.fillText(s.v,x+16,startY+42);
      ctx.font='10px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#4a5070';
      ctx.fillText(s.l.toUpperCase(),x+16,startY+64);
    });

    // Level badge
    ctx.fillStyle='rgba(198,255,0,0.08)';
    ctx.beginPath();ctx.roundRect(24,280,200,36,18);ctx.fill();
    ctx.strokeStyle='rgba(198,255,0,0.2)';ctx.beginPath();ctx.roundRect(24,280,200,36,18);ctx.stroke();
    ctx.font='bold 13px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#6c5ce7';
    ctx.fillText(data.level||'🌱 Новичок',40,303);

    // Footer
    ctx.font='11px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#4a5070';
    ctx.fillText('footbazed.com',24,380);

  } else if(type==='rating'){
    // Match rating share card
    ctx.font='bold 16px "Bebas Neue",sans-serif';ctx.fillStyle='rgba(255,255,255,0.3)';
    ctx.fillText('FOOTBAZED',24,36);
    ctx.fillStyle='#6c5ce7';ctx.fillRect(24,56,80,3);

    ctx.font='bold 28px "Bebas Neue",sans-serif';ctx.fillStyle='#eef0ff';
    ctx.fillText(data.match||'',24,100);

    ctx.font='bold 120px "Bebas Neue",sans-serif';ctx.fillStyle='#6c5ce7';
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
function injectIcons(){
  // Nav links
  const navIcons={Главная:'home',Матчи:'football',Лента:'feed',Лидеры:'trophy',Друзья:'users'};
  document.querySelectorAll('.nav-link').forEach(a=>{
    const t=a.textContent.trim();if(navIcons[t])a.innerHTML=ico(navIcons[t],15)+' '+t;
  });
  // Mobile nav
  document.querySelectorAll('.mob-nav-icon[data-i]').forEach(s=>{s.innerHTML=ico(s.dataset.i,20);});
  // Page titles
  const pgIcons={'Матчи':'football','Лента оценок':'feed','Таблица лидеров':'trophy','Друзья и сообщество':'users'};
  document.querySelectorAll('.page-title').forEach(h=>{
    const t=h.textContent.trim();if(pgIcons[t])h.innerHTML=ico(pgIcons[t],28)+' '+t;
  });
}
function setupReveal(){
  const obs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('shown');});},{threshold:0.08});
  document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
}
let toastTimer=null;
function toast(msg,type='ok'){
  const el=document.getElementById('toast');
  if(!el)return;
  // Clear any existing timer
  if(toastTimer){clearTimeout(toastTimer);toastTimer=null;}
  // Reset state
  el.classList.remove('show');
  el.textContent=msg;
  el.className='toast '+type;
  // Show after tiny delay (force reflow)
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      el.classList.add('show');
      toastTimer=setTimeout(()=>{
        el.classList.remove('show');
        toastTimer=null;
      },3000);
    });
  });
}

// Nav scroll effect
window.addEventListener('scroll',()=>{
  const nav=document.getElementById('mainNav');
  if(nav)nav.classList.toggle('scrolled',window.scrollY>40);
});

init();
