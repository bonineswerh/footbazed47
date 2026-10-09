(function(root){
'use strict';
const model=root.FBZCalendarModel;
let day=null,favorites=false,owner=null,mounted=false;
let pickerMonth=null,pickerFocus=null,periodMonth=null,periodYear=null,yearWindow=null;
const language=()=>root.FBZLocale.language==='en'?'en-GB':'ru-RU';
function close(){root.FBZOverlay.close('calendarDateOv',false);}
function ensurePicker(){
  if(document.getElementById('calendarDateOv'))return;
  const overlay=document.createElement('div');overlay.id='calendarDateOv';overlay.className='overlay calendar-overlay';overlay.dataset.closeBackdrop='true';overlay.tabIndex=-1;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-hidden','true');overlay.setAttribute('aria-labelledby','calendarDateTitle');
  overlay.innerHTML=`<section class="calendar-panel"><header><div><span class="section-kicker">Матчи</span><h2 id="calendarDateTitle">Выбрать дату</h2></div><button class="btn btn-g calendar-close" type="button" aria-label="Закрыть календарь" data-fbz-click="calendar.close">${ico('close',18)}</button></header><div class="calendar-panel-body"><div class="calendar-month-nav"><button class="calendar-arrow" type="button" aria-label="Предыдущий месяц" ${FBZActions.attrs('calendar.month',[-1])}>‹</button><button class="calendar-period-trigger" type="button" id="calendarPeriodTrigger" aria-expanded="false" aria-controls="calendarMonthPicker" data-fbz-click="calendar.period"><strong id="calendarMonthLabel" aria-live="polite"></strong>${ico('chevron',14)}</button><button class="calendar-arrow" type="button" aria-label="Следующий месяц" ${FBZActions.attrs('calendar.month',[1])}>›</button></div><div id="calendarDayPicker"><div class="calendar-weekdays" aria-hidden="true">${Array.from({length:7},(_,i)=>`<span>${new Date(2026,9,5+i).toLocaleDateString(language(),{weekday:'short'})}</span>`).join('')}</div><div class="calendar-month-grid" id="calendarMonthGrid" role="group" aria-labelledby="calendarMonthLabel"></div><form class="calendar-exact" data-fbz-submit="calendar.exact" novalidate><label for="matchDay">Перейти к дате</label><div><input class="input" type="text" inputmode="numeric" id="matchDay" maxlength="10" placeholder="ДД.ММ.ГГГГ" autocomplete="off" aria-describedby="calendarExactError" aria-label="Введите дату" data-fbz-input="calendar.exact-input"><button class="btn btn-l" type="submit" aria-label="Перейти к введённой дате">${ico('chevron',18)}</button></div><p id="calendarExactError" role="status" hidden></p></form></div><section class="calendar-period-picker" id="calendarMonthPicker" aria-labelledby="calendarBrowseTitle" hidden><h3 id="calendarBrowseTitle">Месяц и год</h3><div class="calendar-period-columns"><div id="calendarPeriodMonths" role="group" aria-label="Месяц"></div><div><div class="calendar-year-range"><button type="button" aria-label="Предыдущие годы" data-fbz-click="calendar.years" data-fbz-args="[-100]">‹</button><span id="calendarYearsRange"></span><button type="button" aria-label="Следующие годы" data-fbz-click="calendar.years" data-fbz-args="[100]">›</button></div><div id="calendarPeriodYears" role="group" aria-label="Год"></div></div></div><button class="btn btn-l calendar-period-apply" type="button" data-fbz-click="calendar.period-apply">Показать месяц</button></section></div><footer><button class="btn btn-g" type="button" data-fbz-click="calendar.all">Все даты</button><button class="btn btn-l" type="button" data-fbz-click="calendar.today">Сегодня</button></footer></section>`;
  document.body.append(overlay);
  overlay.addEventListener('keydown',event=>{
    const button=event.target.closest('[data-picker-day]');if(!button)return;
    const value=button.dataset.pickerDay,date=model.parse(value),weekday=(date.getDay()+6)%7;
    let next;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))next=model.shift(value,{ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-weekday,End:6-weekday}[event.key]);
    else if(['PageUp','PageDown'].includes(event.key)){
      const nextMonth=model.month(value,event.key==='PageUp'?-1:1),first=model.parse(nextMonth);
      if(first)next=model.shift(nextMonth,Math.min(date.getDate(),new Date(first.getFullYear(),first.getMonth()+1,0).getDate())-1);
    }else return;
    event.preventDefault();if(!next)return;
    pickerFocus=next;pickerMonth=model.month(next);renderPicker();overlay.querySelector('[data-picker-day="'+next+'"]')?.focus({preventScroll:true});
  });
  // A secondary view stays inside the same focus trap. Escape returns to days
  // before it closes the calendar; browsing never changes the server filters.
  overlay.addEventListener('keydown',event=>{
    if(document.getElementById('calendarMonthPicker').hidden)return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setPeriod(false);document.getElementById('calendarPeriodTrigger').focus();return;}
    const button=event.target.closest('[data-period-month],[data-period-year]');
    if(!button||!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();
    const siblings=[...button.parentElement.querySelectorAll('button')],index=siblings.indexOf(button);
    const next=event.key==='Home'?0:event.key==='End'?siblings.length-1:Math.max(0,Math.min(siblings.length-1,index+(event.key==='ArrowDown'?1:-1)));
    siblings[next]?.focus();
  },true);
}
function exactError(invalid){
  const input=document.getElementById('matchDay'),message=document.getElementById('calendarExactError');
  input.setAttribute('aria-invalid',String(invalid));message.hidden=!invalid;
  message.textContent=invalid?'Введите существующую дату в формате ДД.ММ.ГГГГ.':'';
}
function setPeriod(open){
  document.getElementById('calendarDayPicker').hidden=open;
  document.getElementById('calendarMonthPicker').hidden=!open;
  document.getElementById('calendarPeriodTrigger').setAttribute('aria-expanded',String(open));
  document.querySelectorAll('#calendarDateOv .calendar-month-nav>.calendar-arrow').forEach(button=>button.hidden=open);
}
function renderPeriod(){
  const months=document.getElementById('calendarPeriodMonths'),years=document.getElementById('calendarPeriodYears');
  months.innerHTML=Array.from({length:12},(_,month)=>`<button type="button" data-period-month="${month}" tabindex="${month===periodMonth?0:-1}" aria-pressed="${month===periodMonth}" ${FBZActions.attrs('calendar.period-month',[month])}>${esc(new Date(2026,month,1).toLocaleDateString(language(),{month:'long'}))}</button>`).join('');
  const from=Math.max(1000,yearWindow-60),until=Math.min(9999,yearWindow+60);
  document.getElementById('calendarYearsRange').textContent=from+'–'+until;
  const arrows=document.querySelectorAll('.calendar-year-range button');arrows[0].disabled=from===1000;arrows[1].disabled=until===9999;
  const focusYear=Math.max(from,Math.min(until,periodYear));
  years.innerHTML=Array.from({length:until-from+1},(_,i)=>from+i).map(year=>`<button type="button" data-period-year="${year}" tabindex="${year===focusYear?0:-1}" aria-pressed="${year===periodYear}" ${FBZActions.attrs('calendar.period-year',[year])}>${year}</button>`).join('');
  years.querySelector(`[data-period-year="${focusYear}"]`)?.scrollIntoView({block:'center'});
}
function openPeriod(){
  if(!document.getElementById('calendarMonthPicker').hidden){setPeriod(false);return;}
  const date=model.parse(pickerMonth);periodMonth=date.getMonth();periodYear=date.getFullYear();yearWindow=Math.max(1060,Math.min(9939,periodYear));
  setPeriod(true);renderPeriod();document.querySelector(`[data-period-month="${periodMonth}"]`)?.focus({preventScroll:true});
}
function renderPicker(){
  const overlay=document.getElementById('calendarDateOv'),first=model.parse(pickerMonth);if(!overlay||!first)return;
  document.getElementById('calendarMonthLabel').textContent=first.toLocaleDateString(language(),{month:'long',year:'numeric'});
  overlay.querySelector('[data-fbz-args="[-1]"]').disabled=!model.month(pickerMonth,-1);overlay.querySelector('[data-fbz-args="[1]"]').disabled=!model.month(pickerMonth,1);
  document.getElementById('calendarMonthGrid').innerHTML=model.monthDays(pickerMonth).map(value=>{
    if(!value)return '<span></span>';
    const date=model.parse(value),outside=date.getMonth()!==first.getMonth();
    return `<button class="calendar-month-day${outside?' outside':''}${value===model.key()?' today':''}" type="button" tabindex="${value===pickerFocus?0:-1}" data-picker-day="${value}" aria-pressed="${value===day}" ${value===model.key()?'aria-current="date"':''} aria-label="${esc(date.toLocaleDateString(language(),{day:'numeric',month:'long',year:'numeric'}))}" ${FBZActions.attrs('calendar.day',[value])}>${date.getDate()}</button>`;
  }).join('');
}
function openPicker(){
  ensurePicker();pickerFocus=day||model.key();pickerMonth=model.month(pickerFocus);renderPicker();document.getElementById('matchDay').value=model.formatted(day);setPeriod(false);exactError(false);root.FBZOverlay.open('calendarDateOv','[data-picker-day="'+pickerFocus+'"]');
}
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
  target.innerHTML=`<div class="calendar-toolbar"><button type="button" class="calendar-all${!day?' on':''}" aria-pressed="${!day}" data-calendar-focus="all" data-fbz-click="calendar.all">Все даты</button><button class="calendar-date" type="button" data-calendar-focus="date" data-fbz-click="calendar.open" aria-label="Выбрать дату" aria-haspopup="dialog" aria-controls="calendarDateOv">${ico('calendar',17)}<span>${day?model.parse(day).toLocaleDateString(language,{day:'numeric',month:'short'}):'Выбрать дату'}</span>${ico('chevron',14)}</button><button type="button" class="calendar-favorites${favorites?' on':''}" aria-label="Матчи любимых клубов" aria-pressed="${favorites}" data-calendar-focus="favorites" data-fbz-click="calendar.favorites">${ico('star',17)}<span>Избранное</span></button></div><div class="calendar-navigation"><button type="button" class="calendar-arrow" aria-label="Предыдущий день" data-calendar-focus="previous" data-fbz-click="calendar.shift" data-fbz-args="[-1]">‹</button><div class="calendar-days" role="group" aria-label="Дни матчей">${days.map(value=>{
    const date=model.parse(value),selected=value===day;
    return `<button type="button" class="calendar-day${selected?' on':''}${value===today?' today':''}" aria-pressed="${selected}" aria-label="${date.toLocaleDateString(language,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}" data-calendar-focus="${value}" ${FBZActions.attrs('calendar.day',[value])}><span>${value===today?'Сегодня':date.toLocaleDateString(language,{weekday:'short'})}</span><b>${date.getDate()}</b></button>`;
  }).join('')}</div><button type="button" class="calendar-arrow" aria-label="Следующий день" data-calendar-focus="next" data-fbz-click="calendar.shift" data-fbz-args="[1]">›</button></div><p class="calendar-caption" role="status">${label}${favorites?' · Любимые клубы':''}</p>`;
  const input=document.getElementById('matchDay');if(input)input.value=model.formatted(day);
  if(focus){const control=[...target.querySelectorAll('[data-calendar-focus]')].find(el=>el.dataset.calendarFocus===focus);control?.focus({preventScroll:true});}
  target.querySelector('.calendar-day.on')?.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'});
}
function update(value){
  if(value!==null&&!model.parse(value))return;
  root.FBZOverlay.close('calendarDateOv');
  day=value;writeLocation();render();loadM(true);
}
function mount(){
  ensurePicker();
  const params=new URL(location.href).searchParams;
  day=model.parse(params.get('m_day'))?params.get('m_day'):null;
  favorites=params.get('m_favorites')==='1';
  owner=CU?.id||null;mounted=true;render();
}
function syncSession(user){
  if(!mounted||owner===user)return;
  close();
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
  'calendar.open':()=>openPicker(),
  'calendar.close':()=>root.FBZOverlay.close('calendarDateOv'),
  'calendar.today':()=>update(model.key()),
  'calendar.month':(event,element,[amount])=>{const next=model.month(pickerMonth,Number(amount));if(next){pickerMonth=next;pickerFocus=next;renderPicker();}},
  'calendar.all':()=>update(null),
  'calendar.day':(event,element,[value])=>update(value),
  'calendar.exact':()=>{const value=model.exact(document.getElementById('matchDay').value);if(value)update(value);else{exactError(true);document.getElementById('matchDay').focus();}},
  'calendar.exact-input':()=>exactError(false),
  'calendar.period':()=>openPeriod(),
  'calendar.period-month':(event,element,[value])=>{periodMonth=Number(value);renderPeriod();document.querySelector(`[data-period-month="${periodMonth}"]`)?.focus({preventScroll:true});},
  'calendar.period-year':(event,element,[value])=>{periodYear=Number(value);renderPeriod();document.querySelector(`[data-period-year="${periodYear}"]`)?.focus({preventScroll:true});},
  'calendar.years':(event,element,[value])=>{yearWindow=Math.max(1060,Math.min(9939,yearWindow+Number(value)));renderPeriod();},
  'calendar.period-apply':()=>{const next=String(periodYear).padStart(4,'0')+'-'+String(periodMonth+1).padStart(2,'0')+'-01';if(!model.parse(next))return;pickerMonth=next;pickerFocus=next;setPeriod(false);renderPicker();document.getElementById('calendarPeriodTrigger').focus({preventScroll:true});},
  'calendar.shift':(event,element,[amount])=>{const next=model.shift(day||model.key(),Number(amount));if(next)update(next);},
  'calendar.favorites':()=>{if(!CU){openAuth();return;}favorites=!favorites;writeLocation();render();loadM(true);}
});
root.FBZMatchCalendar=Object.freeze({mount,syncSession,active,getPage,empty,close});
})(window);
