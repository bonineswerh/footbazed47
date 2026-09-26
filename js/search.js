(function(){
  'use strict';

  const STORAGE_KEY='fbz:recent-searches';
  let timer=null;
  let requestVersion=0;
  let activeIndex=-1;
  let currentResults=[];
  let initialized=false;

  function init(){
    if(initialized)return;
    const input=document.getElementById('globalSearchInput');
    if(!input)return;
    initialized=true;
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls','globalSearchList');
    input.addEventListener('input',()=>{
      clearTimeout(timer);
      requestVersion++;currentResults=[];activeIndex=-1;
      input.removeAttribute('aria-activedescendant');input.setAttribute('aria-expanded','false');
      if(window.FBZDomain.normalizeSearchQuery(input.value).length<2){renderStart();return;}
      renderLoading();
      timer=setTimeout(()=>run(input.value),180);
    });
    input.addEventListener('keydown',onInputKeydown);
    document.getElementById('searchOv')?.addEventListener('fbz:overlay-close',cancelRequest);
  }

  function cancelRequest(){
    requestVersion++;clearTimeout(timer);currentResults=[];activeIndex=-1;
    const input=document.getElementById('globalSearchInput');
    input?.removeAttribute('aria-activedescendant');input?.setAttribute('aria-expanded','false');
  }

  function open(){
    window.FBZAccount?.close();
    cancelRequest();
    const input=document.getElementById('globalSearchInput');
    input.value='';
    activeIndex=-1;
    currentResults=[];
    renderStart();
    window.FBZOverlay?.open('searchOv','#globalSearchInput');
  }

  function close(){
    cancelRequest();
    window.FBZOverlay?.close('searchOv');
  }

  async function run(rawQuery){
    clearTimeout(timer);
    const query=window.FBZDomain.normalizeSearchQuery(rawQuery);
    activeIndex=-1;currentResults=[];
    document.getElementById('globalSearchInput').removeAttribute('aria-activedescendant');
    document.getElementById('globalSearchInput').setAttribute('aria-expanded','false');
    if(query.length<2){requestVersion++;renderStart();return;}
    const version=++requestVersion;
    renderLoading();
    try{
      const{data,error}=await sb.rpc('search_footbazed',{p_query:query,p_limit:14});
      if(error)throw error;
      if(version!==requestVersion)return;
      currentResults=data||[];
      renderResults(currentResults,query);
    }catch(error){
      if(version!==requestVersion)return;
      console.error('Global search error:',error);
      currentResults=[];
      document.getElementById('globalSearchResults').setAttribute('aria-busy','false');
      document.getElementById('globalSearchResults').innerHTML='<div class="search-state"><strong>Поиск временно недоступен</strong><button class="btn btn-g btn-sm" type="button" onclick="FBZSearch.retry()">Повторить</button></div>';
    }
  }

  function retry(){run(document.getElementById('globalSearchInput').value);}

  function renderLoading(){
    document.getElementById('globalSearchResults').setAttribute('aria-busy','true');
    document.getElementById('globalSearchResults').innerHTML='<div class="search-loading"><div class="spin"></div><span>Ищем в FOOTBAZED</span></div>';
  }

  function readRecent(){
    try{
      const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
      return Array.isArray(value)?value.filter(item=>typeof item==='string').slice(0,5):[];
    }catch{return[];}
  }

  function saveRecent(query){
    const next=[query,...readRecent().filter(item=>item.toLocaleLowerCase('ru-RU')!==query.toLocaleLowerCase('ru-RU'))].slice(0,5);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{}
  }

  function renderStart(){
    const recent=readRecent();
    const target=document.getElementById('globalSearchResults');
    target.setAttribute('aria-busy','false');
    if(recent.length){
      currentResults=[];
      target.innerHTML=`<div class="search-section-title"><span>Недавние</span><button type="button" onclick="FBZSearch.clearRecent()">Очистить</button></div><div class="search-recent">${recent.map(query=>`<button type="button" onclick="FBZSearch.useRecent(${jsStr(query)})">${ico('search',14)}<span>${esc(query)}</span></button>`).join('')}</div>`;
      return;
    }
    const featured=typeof featuredMatches==='function'&&Array.isArray(matchCatalog)?featuredMatches(matchCatalog).slice(0,4):[];
    currentResults=featured.map(match=>({entity_type:'match',entity_id:String(match.id),title:`${match.home_team_name} — ${match.away_team_name}`,subtitle:match.league_name,meta:match.status}));
    document.getElementById('globalSearchInput').setAttribute('aria-expanded',String(currentResults.length>0));
    target.innerHTML=currentResults.length?`<div class="search-section-title"><span>Ближайшие матчи</span></div><div class="search-result-list" id="globalSearchList" role="listbox" aria-label="Ближайшие матчи">${currentResults.map(searchResultMarkup).join('')}</div>`:'<div class="search-state search-state-brand"><span>FOOTBAZED</span><strong>Клубы, игроки, матчи и болельщики</strong></div>';
  }

  function clearRecent(){
    try{localStorage.removeItem(STORAGE_KEY);}catch{}
    renderStart();
  }

  function useRecent(query){
    const input=document.getElementById('globalSearchInput');
    input.value=query;
    input.focus();
    run(query);
  }

  function resultLabel(type){
    return{club:'Клуб',competition:'Турнир',player:'Игрок',match:'Матч',user:'Профиль'}[type]||'Результат';
  }

  function resultIcon(type){
    return{club:'trophy',competition:'globe',player:'star',match:'football',user:'users'}[type]||'search';
  }

  function statusLabel(status){
    return{live:'LIVE',finished:'Завершён',scheduled:'Предстоит'}[status]||'';
  }

  function positionLabel(position){
    return{GK:'Вратарь',LB:'Левый защитник',LWB:'Левый латераль',CB:'Центральный защитник',RB:'Правый защитник',RWB:'Правый латераль',DM:'Опорный полузащитник',CDM:'Опорный полузащитник',CM:'Центральный полузащитник',AM:'Атакующий полузащитник',CAM:'Атакующий полузащитник',LM:'Левый полузащитник',RM:'Правый полузащитник',LW:'Левый вингер',RW:'Правый вингер',CF:'Нападающий',ST:'Нападающий'}[position]||position||'';
  }

  function searchResultMarkup(item,index){
    // Older hosted RPC definitions emitted these UTF-8 labels as Windows-1251.
    // Repair only known service text, never attempt to decode user names.
    const subtitle=({'РљР»СѓР±':'Клуб','РўСѓСЂРЅРёСЂ':'Турнир'})[item.subtitle]||item.subtitle||'';
    const title=item.entity_type==='match'?String(item.title||'').replaceAll(' вЂ” ',' — '):item.title;
    const rawMeta=item.entity_type==='match'?statusLabel(item.meta):(item.entity_type==='player'?positionLabel(item.meta):(item.meta||resultLabel(item.entity_type)));
    const meta=rawMeta&&rawMeta!==subtitle?rawMeta:'';
    return`<button class="search-result" id="global-search-option-${index}" type="button" role="option" aria-selected="false" data-index="${index}" onclick="FBZSearch.select(${index})"><span class="search-result-icon">${ico(resultIcon(item.entity_type),17)}</span><span class="search-result-copy"><strong>${esc(title)}</strong><small>${esc(subtitle)}${meta?`<span>·</span>${esc(meta)}`:''}</small></span><span class="search-result-arrow">→</span></button>`;
  }

  function renderResults(results,query){
    const target=document.getElementById('globalSearchResults');
    target.setAttribute('aria-busy','false');
    document.getElementById('globalSearchInput').setAttribute('aria-expanded',String(results.length>0));
    if(!results.length){
      target.innerHTML=`<div class="search-state"><strong>Ничего не найдено</strong><span>«${esc(query)}»</span></div>`;
      return;
    }
    target.innerHTML=`<div class="search-section-title"><span>Результаты</span><small>${results.length}</small></div><div class="search-result-list" id="globalSearchList" role="listbox" aria-label="Результаты поиска">${results.map(searchResultMarkup).join('')}</div>`;
  }

  function onInputKeydown(event){
    if(!currentResults.length)return;
    if(event.key==='ArrowDown'){
      event.preventDefault();
      setActive(Math.min(activeIndex+1,currentResults.length-1));
    }else if(event.key==='ArrowUp'){
      event.preventDefault();
      setActive(Math.max(activeIndex-1,0));
    }else if(event.key==='Enter'&&activeIndex>=0){
      event.preventDefault();
      select(activeIndex);
    }
  }

  function setActive(index){
    activeIndex=index;
    document.getElementById('globalSearchInput').setAttribute('aria-activedescendant',`global-search-option-${index}`);
    document.querySelectorAll('.search-result[data-index]').forEach(button=>{
      const selected=Number(button.dataset.index)===index;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-selected',String(selected));
      if(selected)button.scrollIntoView({block:'nearest'});
    });
  }

  function select(index){
    const item=currentResults[index];
    if(!item)return;
    const query=document.getElementById('globalSearchInput').value.trim();
    if(query)saveRecent(query);
    close();
    if(item.entity_type==='match'){
      go('md',{mid:Number(item.entity_id)});
      return;
    }
    if(item.entity_type==='user'){
      go('profile',{uid:item.entity_id});
      return;
    }
    if(item.entity_type==='club'){
      go('club',{id:Number(item.entity_id)});
      return;
    }
    if(item.entity_type==='player'){
      go('player',{id:Number(item.entity_id)});
      return;
    }
    if(item.entity_type==='competition'){
      go('competition',{id:Number(item.entity_id)});
      return;
    }
    if(item.entity_type==='team')openTeamMatches(item.title);
  }

  async function openTeamMatches(team){
    go('matches');
    try{await fetchMatchCatalog();}catch{}
    const input=document.getElementById('msearch');
    if(input){input.value=team;visibleMatchCount=matchPageSize();renderMatchResults();input.focus({preventScroll:true});}
  }

  function resetSession(){close();document.getElementById('globalSearchResults').replaceChildren();document.getElementById('globalSearchInput').value='';}

  window.FBZSearch={clearRecent,close,init,open,resetSession,retry,select,useRecent};
})();
