(function(root){
  'use strict';
  const model=root.FBZCalendarModel;
  let active=null,sequence=0;
  const language=()=>root.FBZLocale?.intl||'ru-RU';
  function close(focus=true){
    if(!active)return;
    const {field,panel,abort,expanded,controls,hidden,tabindex}=active;active=null;abort.abort();panel.remove();
    for(const [name,value] of [['aria-expanded',expanded],['aria-controls',controls],['aria-hidden',hidden],['tabindex',tabindex]])if(value===null)field.removeAttribute(name);else field.setAttribute(name,value);
    if(focus&&field.isConnected&&!field.disabled)field.focus({preventScroll:true});
  }
  function position(){
    if(!active)return;
    const {field,panel}=active,box=field.getBoundingClientRect(),width=Math.min(field.type==='date'?340:Math.max(box.width,280),innerWidth-24);
    panel.style.width=width+'px';const paintedWidth=panel.getBoundingClientRect().width,height=Math.min(panel.scrollHeight,innerHeight-24);panel.style.left=Math.max(12,Math.min(box.left,innerWidth-paintedWidth-12))+'px';
    panel.style.top=Math.max(12,Math.min(box.bottom+8+height>innerHeight-12?box.top-height-8:box.bottom+8,innerHeight-height-12))+'px';
  }
  function commit(value){
    const field=active?.field;if(!field||!field.isConnected||field.disabled)return;
    if(field.tagName==='SELECT'&&![...field.options].some(option=>option.value===value&&!option.disabled&&option.parentElement.disabled!==true))return;
    const changed=field.value!==value;field.value=value;close();
    if(changed){field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));}
  }
  function button(label,handler,className='fbz-control-option'){
    const node=document.createElement('button');node.type='button';node.className=className;node.textContent=label;
    node.addEventListener('click',handler);return node;
  }
  function selectPanel(field,panel){
    const list=document.createElement('div');list.className='fbz-control-list';list.id=panel.id+'-list';list.setAttribute('role','listbox');list.setAttribute('aria-label',active.label);
    field.setAttribute('aria-controls',list.id);let query='',focused=field.value;
    const search=field.options.length>7?document.createElement('input'):null;
    if(search){search.type='search';search.className='input fbz-control-search';search.placeholder='Найти вариант';search.setAttribute('aria-label','Поиск вариантов');panel.append(search);}
    panel.append(list);
    function render(){
      list.replaceChildren();
      const rows=[...field.options].filter(option=>!option.hidden&&option.textContent.toLocaleLowerCase(language()).includes(query));
      for(const option of rows){
        const item=button(option.textContent,()=>commit(option.value));item.dataset.value=option.value;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.value===field.value));item.disabled=option.disabled||option.parentElement.disabled===true;item.tabIndex=-1;
        if(option.value===field.value)item.classList.add('selected');list.append(item);
        if(field.classList.contains('rating-exact-score')&&Number(option.value)>0)item.dataset.tone=root.FBZDomain.ratingTone(Number(option.value));
      }
      if(!rows.length){const empty=document.createElement('p');empty.className='fbz-control-empty';empty.setAttribute('role','status');empty.textContent='Ничего не найдено';list.append(empty);}
      position();
    }
    function focusItem(value){const items=[...list.querySelectorAll('button:not(:disabled)')],item=items.find(item=>item.dataset.value===value)||items[0];if(item){focused=item.dataset.value;item.focus({preventScroll:true});const a=item.getBoundingClientRect(),b=list.getBoundingClientRect();if(a.top<b.top)list.scrollTop-=b.top-a.top;else if(a.bottom>b.bottom)list.scrollTop+=a.bottom-b.bottom;}}
    search?.addEventListener('input',event=>{event.stopPropagation();query=search.value.trim().toLocaleLowerCase(language());render();});
    let typeahead='',typeTime=0;
    panel.addEventListener('keydown',event=>{
      if(event.target===search&&!['ArrowDown','ArrowUp'].includes(event.key))return;
      const items=[...list.querySelectorAll('button:not(:disabled)')];if(!items.length)return;
      let index=items.findIndex(item=>item===document.activeElement);
      if(event.key==='ArrowDown')index=Math.min(items.length-1,index+1);
      else if(event.key==='ArrowUp')index=index<0?items.length-1:Math.max(0,index-1);
      else if(event.key==='Home')index=0;
      else if(event.key==='End')index=items.length-1;
      else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&event.key!==' '){
        const now=Date.now();typeahead=(now-typeTime>700?'':typeahead)+event.key.toLocaleLowerCase(language());typeTime=now;index=items.findIndex(item=>item.textContent.toLocaleLowerCase(language()).startsWith(typeahead));
      }else return;
      event.preventDefault();if(items[index])focusItem(items[index].dataset.value);
    });
    render();if(search)search.focus({preventScroll:true});else focusItem(focused);
    // Observe only the open select: catalogues can arrive or change while it is open.
    const observer=new MutationObserver(()=>{if(active?.field!==field)return;const hadFocus=list.contains(document.activeElement);render();if(hadFocus)focusItem(focused);});
    observer.observe(field,{childList:true,subtree:true,characterData:true});active.abort.signal.addEventListener('abort',()=>observer.disconnect(),{once:true});
  }
  function datePanel(field,panel){
    let focus=model.parse(field.value)?field.value:model.key(),month=model.month(focus);
    const nav=document.createElement('div');nav.className='fbz-control-month';
    const title=document.createElement('strong');title.id=panel.id+'-month';title.setAttribute('aria-live','polite');
    const previous=button('‹',()=>browse(-1),'fbz-control-arrow'),next=button('›',()=>browse(1),'fbz-control-arrow');previous.setAttribute('aria-label','Предыдущий месяц');next.setAttribute('aria-label','Следующий месяц');nav.append(previous,title,next);panel.append(nav);
    const weekdays=document.createElement('div');weekdays.className='fbz-control-weekdays';weekdays.setAttribute('aria-hidden','true');
    for(let i=0;i<7;i++){const day=document.createElement('span');day.textContent=new Date(2026,9,5+i).toLocaleDateString(language(),{weekday:'short'});weekdays.append(day);}panel.append(weekdays);
    const grid=document.createElement('div');grid.className='fbz-control-days';grid.setAttribute('role','group');grid.setAttribute('aria-labelledby',title.id);panel.append(grid);
    const footer=document.createElement('footer');footer.append(button('Сбросить',()=>commit(''),'btn btn-g'),button('Сегодня',()=>commit(model.key()),'btn btn-l'));panel.append(footer);
    const allowed=day=>Boolean(day)&&(!field.min||day>=field.min)&&(!field.max||day<=field.max);
    footer.lastChild.disabled=!allowed(model.key());
    function render(){
      title.textContent=model.parse(month).toLocaleDateString(language(),{month:'long',year:'numeric'});previous.disabled=!model.month(month,-1);next.disabled=!model.month(month,1);grid.replaceChildren();
      const days=model.monthDays(month),first=model.parse(month);
      if(!days.includes(focus)||!allowed(focus))focus=days.find(day=>allowed(day)&&model.parse(day).getMonth()===first.getMonth())||days.find(allowed);
      for(const day of days){
        if(!day){grid.append(document.createElement('span'));continue;}
        const date=model.parse(day),item=button(String(date.getDate()),()=>commit(day),'fbz-control-day');item.dataset.day=day;item.tabIndex=day===focus?0:-1;item.disabled=!allowed(day);item.setAttribute('aria-pressed',String(day===field.value));item.setAttribute('aria-label',date.toLocaleDateString(language(),{day:'numeric',month:'long',year:'numeric'}));
        if(day===model.key())item.setAttribute('aria-current','date');if(date.getMonth()!==first.getMonth())item.classList.add('outside');grid.append(item);
      }position();
    }
    function focusDay(){grid.querySelector('[data-day="'+focus+'"]')?.focus({preventScroll:true});}
    function browse(amount){const target=model.month(month,amount);if(!target)return;month=target;focus=month;render();focusDay();}
    panel.addEventListener('keydown',event=>{
      const item=event.target.closest('[data-day]');if(!item)return;const date=model.parse(item.dataset.day),weekday=(date.getDay()+6)%7;let target;
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))target=model.shift(item.dataset.day,{ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-weekday,End:6-weekday}[event.key]);
      else if(['PageUp','PageDown'].includes(event.key)){const m=model.month(item.dataset.day,event.key==='PageUp'?-1:1),d=model.parse(m);if(d)target=model.shift(m,Math.min(date.getDate(),new Date(d.getFullYear(),d.getMonth()+1,0).getDate())-1);}
      else return;event.preventDefault();if(!allowed(target))return;focus=target;month=model.month(target);render();focusDay();
    });
    render();focusDay();
  }
  function open(field){
    if(active?.field===field){close();return;}close(false);
    const panel=document.createElement('div'),abort=new AbortController();panel.id='fbz-control-'+(++sequence);panel.className='fbz-control-panel'+(field.type==='date'?' is-date':'');panel.setAttribute('role','group');
    const source=field.labels?.[0]?.cloneNode(true);source?.querySelectorAll('input,select,textarea,button').forEach(node=>node.remove());
    const label=field.getAttribute('aria-label')||source?.textContent.trim()||'Выбор';panel.setAttribute('aria-label',label);
    active={field,panel,abort,label,expanded:field.getAttribute('aria-expanded'),controls:field.getAttribute('aria-controls'),hidden:field.getAttribute('aria-hidden'),tabindex:field.getAttribute('tabindex')};
    (field.closest('.overlay.on')||document.body).append(panel);field.setAttribute('aria-expanded','true');
    if(field.tagName==='SELECT')selectPanel(field,panel);else datePanel(field,panel);field.setAttribute('aria-hidden','true');field.tabIndex=-1;position();
    const signal=abort.signal;
    document.addEventListener('pointerdown',event=>{if(active&&!panel.contains(event.target)&&event.target!==field)close(false);},{capture:true,signal});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}else if(event.key==='Tab')close();},{capture:true,signal});
    field.closest('.overlay')?.addEventListener('fbz:overlay-close',()=>close(false),{signal});
    field.form?.addEventListener('reset',()=>close(false),{signal});
    root.addEventListener('resize',position,{signal});root.addEventListener('scroll',event=>{if(!panel.contains(event.target))position();},{capture:true,signal});
  }
  root.addEventListener('fbz:session-change',()=>close(false));
  root.FBZFormControls=Object.freeze({open,close});
})(window);
