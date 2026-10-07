(function(root){
'use strict';
const model=root.FBZCalendarModel;
let day=null,favorites=false,owner=null,mounted=false;
function writeLocation(){
  const url=new URL(location.href);
  if(day)url.searchParams.set('m_day',day);else url.searchParams.delete('m_day');
  if(favorites)url.searchParams.set('m_favorites','1');else url.searchParams.delete('m_favorites');
  history.replaceState(history.state,'',url.pathname+url.search+url.hash);
}
function render(){
  const target=document.getElementById('matchCalendar');if(!target)return;
  const focus=document.activeElement?.dataset.calendarFocus;
  const language=root.FBZLocale.language==='en'?'en-GB':'ru-RU';
  const anchor=day||model.key(),today=model.key();
  const label=day?model.parse(day).toLocaleDateString(language,{day:'numeric',month:'long',year:'numeric'}):'Все даты';
  const days=Array.from({length:7},(_,i)=>model.shift(anchor,i-3)).filter(Boolean);
  target.innerHTML=`<div class="calendar-toolbar"><button type="button" class="calendar-all${!day?' on':''}" aria-pressed="${!day}" data-calendar-focus="all" data-fbz-click="calendar.all">Все даты</button><label class="calendar-date"><span class="sr-only">Выбрать дату</span><input type="date" id="matchDay" min="1000-01-01" max="9999-12-31" value="${day||''}" data-calendar-focus="date" data-fbz-change="calendar.date" aria-label="Выбрать дату"></label><button type="button" class="calendar-favorites${favorites?' on':''}" aria-label="Матчи любимых клубов" aria-pressed="${favorites}" data-calendar-focus="favorites" data-fbz-click="calendar.favorites">${ico('star',17)}<span>Избранное</span></button></div><div class="calendar-navigation"><button type="button" class="calendar-arrow" aria-label="Предыдущий день" data-calendar-focus="previous" data-fbz-click="calendar.shift" data-fbz-args="[-1]">‹</button><div class="calendar-days" role="group" aria-label="Дни матчей">${days.map(value=>{
    const date=model.parse(value),selected=value===day;
    return `<button type="button" class="calendar-day${selected?' on':''}${value===today?' today':''}" aria-pressed="${selected}" aria-label="${date.toLocaleDateString(language,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}" data-calendar-focus="${value}" ${FBZActions.attrs('calendar.day',[value])}><span>${value===today?'Сегодня':date.toLocaleDateString(language,{weekday:'short'})}</span><b>${date.getDate()}</b></button>`;
  }).join('')}</div><button type="button" class="calendar-arrow" aria-label="Следующий день" data-calendar-focus="next" data-fbz-click="calendar.shift" data-fbz-args="[1]">›</button></div><p class="calendar-caption" role="status">${label}${favorites?' · Любимые клубы':''}</p>`;
  if(focus){const control=[...target.querySelectorAll('[data-calendar-focus]')].find(el=>el.dataset.calendarFocus===focus);control?.focus({preventScroll:true});}
  target.querySelector('.calendar-day.on')?.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'});
}
function update(value){
  if(value!==null&&!model.parse(value))return;
  day=value;writeLocation();render();loadM(true);
}
function mount(){
  const params=new URL(location.href).searchParams;
  day=model.parse(params.get('m_day'))?params.get('m_day'):null;
  favorites=params.get('m_favorites')==='1';
  owner=CU?.id||null;mounted=true;render();
}
function syncSession(user){
  if(!mounted||owner===user)return;
  // A list derived from the previous account must disappear immediately.
  if(owner&&favorites){favorites=false;writeLocation();}
  owner=user;render();if(CP==='matches')loadM(true);
}
function active(){return Boolean(day||favorites);}
async function getPage({status,league,query,limit,offset}){
  const user=CU?.id||null,route=routeVersion;
  if(favorites&&!user)throw new Error('calendar_auth_required');
  const {data,error}=await sb.rpc('get_match_calendar_page',{
    p_filters:{status,league,query,favorites_only:favorites,...(day?model.bounds(day):{})},p_limit:limit,p_offset:offset
  });
  if(error)throw error;
  if(user!==(CU?.id||null)||route!==routeVersion)throw new Error('calendar_session_changed');
  await root.FBZData.enrichMatchMedia(data?.items||[]);
  if(user!==(CU?.id||null)||route!==routeVersion)throw new Error('calendar_session_changed');
  return data;
}
function empty(page){
  if(favorites&&!page.favorite_club_count)return '<div class="empty-state"><strong>Выберите любимые клубы</strong><span>Звёздочка на странице клуба добавит его матчи сюда.</span><button class="btn btn-g" data-fbz-click="shell.open-global-search">Найти клуб</button></div>';
  return '<div class="empty-state"><strong>Матчей не найдено</strong><span>Выберите другой день или измените фильтры.</span><button class="btn btn-g" data-fbz-click="calendar.all">Все даты</button></div>';
}
FBZActions.register({
  'calendar.all':()=>update(null),
  'calendar.day':(event,element,[value])=>update(value),
  'calendar.date':(event,element)=>update(element.value||null),
  'calendar.shift':(event,element,[amount])=>{const next=model.shift(day||model.key(),Number(amount));if(next)update(next);},
  'calendar.favorites':()=>{if(!CU){openAuth();return;}favorites=!favorites;writeLocation();render();loadM(true);}
});
root.FBZMatchCalendar=Object.freeze({mount,syncSession,active,getPage,empty});
})(window);
