(function(root){
  'use strict';
  const escape=value=>root.esc(String(value??'')),model=root.FBZExploreModel,catalogues=new WeakMap();
  const labels={query:'Поиск',competition_id:'Турнир',club_id:'Клуб',from:'С',to:'По',min_rating:'Оценка от',max_rating:'Оценка до',home_score:'Голы хозяев',away_score:'Голы гостей',min_votes:'Минимум оценок',sort:'Порядок',participation:'Выступления'};
  const sheet=form=>document.getElementById(form.id+'-sheet');
  function filters(id,{diary=false,owner=true}={}){
    const field=(name,label,type='text',extra='')=>`<label for="${id}-${name}"><span>${label}</span><input class="input" id="${id}-${name}" name="${name}" type="${type}" ${extra}></label>`;
    const select=(name,label,options)=>`<label for="${id}-${name}"><span>${label}</span><select class="input" id="${id}-${name}" name="${name}">${options}</select></label>`;
    const picker=(name,label,all)=>`<div class="explore-picker"><label for="${id}-${name}">${label}</label><select class="input" id="${id}-${name}" name="${name}" data-choice-kind="${name==='club_id'?'club':'competition'}"><option value="">${all}</option></select><span class="explore-option-count" data-options-count="${name}" aria-live="polite"></span></div>`;
    return `<form class="explore-filters" id="${id}" data-diary="${diary}" data-scope="${diary?'di':'ov'}" novalidate aria-label="${diary?'Фильтры дневника':'Фильтры обзора'}">
      <div class="explore-toolbar"><div class="explore-search">${root.ico('search',18)}<label class="sr-only" for="${id}-query">${diary?'Найти оценённый матч':'Поиск в обзоре'}</label><input id="${id}-query" name="query" type="search" maxlength="80" placeholder="${diary?(owner?'Найти в своей истории':'Найти в истории'):'Матч, клуб или игрок'}" autocomplete="off"></div><button class="btn btn-g explore-open" id="${id}-open" type="button" aria-haspopup="dialog" aria-controls="${id}-sheet">${root.ico('filter',16)} Фильтры <span class="explore-active-count"></span></button></div>
      <div class="explore-filter-footer"><div class="explore-chips" aria-label="Выбранные фильтры"></div><button class="text-action" type="reset">Сбросить фильтры</button></div>
      <p class="explore-inline-validation" id="${id}-inline-validation" role="status" hidden></p>
      <div class="overlay explore-sheet" id="${id}-sheet" aria-hidden="true" data-close-backdrop="true"><div class="explore-panel" role="dialog" aria-modal="true" aria-labelledby="${id}-title" tabindex="-1"><header><div><span class="section-kicker">${diary?(owner?'Ваш дневник':'История оценок'):'Футбол глазами сообщества'}</span><h2 id="${id}-title">Фильтры</h2></div><button class="btn btn-g explore-close" type="button" aria-label="Закрыть фильтры">${root.ico('close',18)}</button></header><div class="explore-panel-body">
      <div class="explore-filter-row">${picker('competition_id','Турнир','Все турниры')}${picker('club_id','Клуб','Все клубы')}</div><div class="explore-filter-grid">${field('from','Матчи с','date')}${field('to','Матчи по','date')}
      ${diary?field('min_rating','Оценка от','number','min="1" max="10" step="1" placeholder="1"')+field('max_rating','Оценка до','number','min="1" max="10" step="1" placeholder="10"')+field('home_score','Голы хозяев','number','min="0" max="99" step="1" placeholder="Любые"')+field('away_score','Голы гостей','number','min="0" max="99" step="1" placeholder="Любые"'):select('min_votes','Минимум оценок','<option value="1">От 1 оценки</option><option value="5">От 5 оценок</option><option value="10">От 10 оценок</option><option value="25">От 25 оценок</option>')+select('sort','Порядок','<option value="average">По средней оценке</option><option value="votes">По числу оценок</option><option value="recent">По дате матча</option>')}
      </div><p class="explore-hint">Фильтры применяются автоматически. Период относится к дате матча. Клубы доступны по участию в выбранном турнире.</p><p class="explore-validation" id="${id}-validation" role="status" hidden></p></div><footer><button class="btn btn-g explore-panel-reset" type="button">Сбросить</button><button class="btn btn-l explore-done" type="button">Готово</button></footer></div></div>
    </form>`;
  }
  function read(form){return model.normalize(Object.fromEntries(new FormData(form)),form.dataset.diary==='true');}
  function entered(form){return Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,String(v).trim()]).filter(([k,v])=>v&&!(k==='min_votes'&&v==='1')&&!(k==='sort'&&v==='average')&&!(k==='participation'&&v==='confirmed')));}
  function restore(form,filters){for(const [name,value] of Object.entries(filters)){const field=form.elements.namedItem(name);if(!field)continue;if(field.tagName==='SELECT'&&name.endsWith('_id'))field.add(new Option('Загрузка выбранного фильтра…',value));field.value=value;}}
  function valid(form){
    const f=read(form),from=form.elements.namedItem('from'),max=form.elements.namedItem('max_rating');
    from.setCustomValidity(f.from&&f.to&&f.from>f.to?'Начало периода должно быть раньше его окончания':'');
    max?.setCustomValidity(f.min_rating&&f.max_rating&&Number(f.min_rating)>Number(f.max_rating)?'Верхняя оценка должна быть не меньше нижней':'');
    const invalid=[...form.elements].filter(field=>field.willValidate&&!field.validity.valid);
    const open=sheet(form).classList.contains('on');
    for(const field of form.elements){if(!field.willValidate)continue;field.setAttribute('aria-invalid',String(invalid.includes(field)));if(invalid.includes(field))field.setAttribute('aria-describedby',`${form.id}-${open?'':'inline-'}validation`);else field.removeAttribute('aria-describedby');}
    const field=invalid[0],messageText=!field?'':field.validity.customError?field.validationMessage:field.type==='date'?'Введите существующую дату':field.name==='min_rating'||field.name==='max_rating'?'Оценка должна быть целым числом от 1 до 10':field.name==='home_score'||field.name==='away_score'?'Число голов должно быть целым числом от 0 до 99':'Проверьте значение фильтра';
    for(const message of [sheet(form).querySelector('.explore-validation'),form.querySelector('.explore-inline-validation')]){message.hidden=!invalid.length||message.classList.contains('explore-inline-validation')&&open;message.textContent=messageText;}return !invalid.length;
  }
  function activeCount(form){return Object.keys(entered(form)).length+[...form.elements].filter(f=>f.willValidate&&f.validity.badInput).length;}
  function options(form,name){
    const data=catalogues.get(form)||{},select=form.elements.namedItem(name),selected=select.value;
    let rows=name==='competition_id'?(data.competitions||[]):model.clubsForCompetition(data.clubs,form.elements.namedItem('competition_id').value);
    rows=rows.map(row=>({...row,source_name:row.name,name:name==='club_id'?FBZNames.club(row):FBZNames.competition(row)})).sort((a,b)=>a.name.localeCompare(b.name,root.FBZLocale?.intl||'ru-RU'));
    select.innerHTML=`<option value="">${name==='club_id'?'Все клубы':'Все турниры'}</option>`+rows.map(row=>`<option value="${escape(row.id)}">${escape(row.name)}</option>`).join('');
    // Choice metadata stays in memory; native option values remain provider IDs.
    rows.forEach((row,index)=>{
      const kind=name==='club_id'?'club':'competition',present=kind==='club'?FBZNames.club:FBZNames.competition;
      const entity={...row,name:row.source_name,media:data.marks?.get(String(row.id))||row.media};
      const names=kind==='club'?[present(entity,'',true,'ru'),present(entity,'',true,'en')]:[present(entity,'ru'),present(entity,'en')];
      select.options[index+1].fbzChoice={entity,kind,keywords:[row.name,row.source_name,row.short_name,...names].filter(Boolean).join(' ')};
    });
    if(selected&&!rows.some(row=>String(row.id)===selected))select.add(new Option('Недоступный '+(name==='club_id'?'клуб':'турнир')+' #'+selected,selected));select.value=selected;
    sheet(form).querySelector(`[data-options-count="${name}"]`).textContent=name==='club_id'?'Клубов в выборке: '+rows.length:'';
  }
  function sync(form){
    const f=entered(form),count=activeCount(form),data=catalogues.get(form)||{};
    form.querySelector('.explore-active-count').textContent=count?String(count):'';
    form.querySelector('[type="reset"]').disabled=!count;sheet(form).querySelector('.explore-panel-reset').disabled=!count;
    form.querySelector('.explore-chips').innerHTML=Object.entries(f).map(([key,value])=>{
      const rows=key==='competition_id'?data.competitions:key==='club_id'?data.clubs:null,rawLabel=rows?.find(row=>String(row.id)===value)?.name,label=rawLabel?(key==='club_id'?FBZNames.club(rawLabel):FBZNames.competition(rawLabel)):({sort:{votes:'По числу оценок',recent:'По дате матча'},participation:{all:'Вся история оценок'}}[key]?.[value])||value;
      return `<button class="explore-chip" type="button" data-clear="${escape(key)}" aria-label="Убрать фильтр ${escape(labels[key])}: ${escape(label)}"><span>${escape(labels[key])}: ${escape(label)}</span>${root.ico('close',12)}</button>`;
    }).join('');form.querySelector('.explore-filter-footer').classList.toggle('has-filters',Boolean(count));
  }
  function bind(form,onChange,onInvalidate=()=>{},onInvalid=()=>{}){
    let timer;const controller=new AbortController(),eventOptions={signal:controller.signal};
    const panel=sheet(form);
    // Page transitions create stacking contexts. Keep dialogs at body level and
    // retain native form ownership for all controls rather than duplicating them.
    panel.querySelectorAll('input,select').forEach(field=>field.setAttribute('form',form.id));
    document.body.append(panel);
    const listen=(name,handler)=>{form.addEventListener(name,handler,eventOptions);panel.addEventListener(name,handler,eventOptions);};
    const run=(mode='push')=>{clearTimeout(timer);timer=null;sync(form);if(valid(form))onChange(read(form),mode);else onInvalid();};
    listen('input',event=>{sync(form);onInvalidate();clearTimeout(timer);timer=setTimeout(()=>run(event.target.name==='query'?'replace':'push'),event.target.name==='query'?250:350);});
    listen('fbz:choices-visible',async event=>{
      const field=event.target,data=catalogues.get(form);
      if(field.name!=='club_id'||!data)return;
      const ids=(event.detail?.values||[]).filter(id=>id&&!data.marks.has(id)&&Date.now()-(data.attempted.get(id)||0)>30_000).slice(0,48);
      if(!ids.length)return;
      ids.forEach(id=>data.attempted.set(id,Date.now()));
      const matches=ids.map(id=>({home_club_id:Number(id)}));
      try{
        await root.FBZData.enrichMatchMedia(matches);
        if(controller.signal.aborted||!field.isConnected)return;
        matches.forEach((match,index)=>{if(match.home_club?.media)data.marks.set(ids[index],match.home_club.media);});
        for(const option of field.options)if(option.fbzChoice&&data.marks.has(option.value))option.fbzChoice.entity.media=data.marks.get(option.value);
        root.FBZFormControls?.refresh(field);
      }catch(error){if(error.name!=='AbortError')ids.forEach(id=>data.attempted.delete(id));}
    });
    listen('change',event=>{
      if(event.target.tagName!=='SELECT')return;
      if(event.target.name==='competition_id'){
        const club=form.elements.namedItem('club_id'),data=catalogues.get(form);
        if(club.value&&data&&!model.clubsForCompetition(data.clubs,event.target.value).some(c=>String(c.id)===club.value))club.value='';
        options(form,'club_id');
      }onInvalidate();run();
    });
    form.addEventListener('submit',event=>{event.preventDefault();run();},eventOptions);
    form.addEventListener('reset',()=>{clearTimeout(timer);onInvalidate();timer=setTimeout(()=>{for(const name of ['competition_id','club_id'])options(form,name);run();},0);},eventOptions);
    listen('click',event=>{
      const target=event.target.closest('button');if(!target)return;
      if(target.classList.contains('explore-open')){root.FBZOverlay.open(form.id+'-sheet','select[name="competition_id"]');valid(form);}
      else if(target.classList.contains('explore-close'))root.FBZOverlay.close(form.id+'-sheet');
      else if(target.classList.contains('explore-done')){if(timer){run();timer=null;}if(valid(form))root.FBZOverlay.close(form.id+'-sheet');else panel.querySelector('[aria-invalid="true"]')?.focus();}
      else if(target.classList.contains('explore-panel-reset'))form.reset();
      else if(target.dataset.clear){const key=target.dataset.clear,field=form.elements.namedItem(key);field.value=key==='min_votes'?'1':key==='sort'?'average':key==='participation'?'confirmed':'';if(key==='competition_id')options(form,'club_id');onInvalidate();run();form.querySelector('.explore-open').focus();}
    });
    panel.addEventListener('fbz:overlay-close',()=>valid(form),eventOptions);
    sync(form);return ()=>{clearTimeout(timer);controller.abort();root.FBZOverlay.close(panel.id,false);panel.remove();};
  }
  function populate(form,data){const previous=catalogues.get(form);catalogues.set(form,{competitions:data.competitions||[],clubs:data.clubs||[],marks:previous?.marks||new Map(),attempted:previous?.attempted||new Map()});options(form,'competition_id');options(form,'club_id');sync(form);}
  function writeLocation(form,filters,extras={},mode='push'){
    const query=model.searchParams(root.location.search,form.dataset.scope,filters,extras),url=root.location.pathname+(query?'?'+query:'');if(url===root.location.pathname+root.location.search)return;
    const state={...root.history.state,fbzIndex:(Number(root.history.state?.fbzIndex)||0)+(mode==='push'?1:0)};root.history[mode==='replace'?'replaceState':'pushState'](state,'',url);
  }
  function closePanels(){document.querySelectorAll('.explore-sheet.on').forEach(panel=>root.FBZOverlay.close(panel.id,false));}
  function focusResults(id,origin){
    if(!origin||document.querySelector('.overlay.on')||document.activeElement!==origin&&document.activeElement!==document.body)return;
    const heading=document.getElementById(id);if(!heading)return;
    heading.tabIndex=-1;heading.focus({preventScroll:true});
    heading.scrollIntoView({block:'start',behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  root.FBZExplore=Object.freeze({filters,read,restore,bind,populate,activeCount,writeLocation,closePanels,focusResults,locationFilters:model.locationFilters});
})(window);
