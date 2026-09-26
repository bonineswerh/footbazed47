(function(root){
  'use strict';
  const escape=value=>root.esc(String(value??''));
  function filters(id,{diary=false}={}){
    const field=(name,label,type='text',extra='')=>`<label for="${id}-${name}"><span>${label}</span><input class="input" id="${id}-${name}" name="${name}" type="${type}" ${extra}></label>`;
    const select=(name,label,options)=>`<label for="${id}-${name}"><span>${label}</span><select class="input" id="${id}-${name}" name="${name}">${options}</select></label>`;
    return `<form class="explore-filters" id="${id}" aria-label="${diary?'Фильтры дневника':'Фильтры обзора'}">
      <div class="explore-search">${root.ico('search',18)}<label class="sr-only" for="${id}-query">${diary?'Найти оценённый матч':'Поиск в обзоре'}</label><input id="${id}-query" name="query" type="search" maxlength="80" placeholder="${diary?'Команда или пара соперников':'Название матча, клуба или игрока'}" autocomplete="off"></div>
      <div class="explore-filter-row">${select('league','Турнир','<option value="">Все турниры</option>')}${select('team',diary?'Команда':'Матчи команды','<option value="">Все команды</option>')}</div>
      <details class="explore-advanced"><summary>Ещё фильтры <span class="explore-active-count"></span></summary><div class="explore-filter-grid">
        ${field('from','Матчи с','date')}${field('to','Матчи по','date')}
        ${diary?field('min_rating','Оценка от','number','min="1" max="10" step="1" placeholder="1"')+field('max_rating','Оценка до','number','min="1" max="10" step="1" placeholder="10"')+field('home_score','Голы хозяев','number','min="0" max="99" step="1" placeholder="Любые"')+field('away_score','Голы гостей','number','min="0" max="99" step="1" placeholder="Любые"'):select('min_votes','Минимум оценок','<option value="1">От 1 оценки</option><option value="5">От 5 оценок</option><option value="10">От 10 оценок</option><option value="25">От 25 оценок</option>')+select('sort','Порядок','<option value="average">По средней оценке</option><option value="votes">По числу оценок</option><option value="recent">По дате матча</option>')}
      </div><p>Период относится к дате матча.</p></details>
      <div class="explore-filter-footer"><span class="explore-filter-caption">Все матчи</span><button class="text-action" type="reset">Сбросить фильтры</button></div>
    </form>`;
  }
  function read(form){return Object.fromEntries([...new FormData(form)].filter(([,v])=>String(v).trim()).map(([k,v])=>[k,String(v).trim()]));}
  function valid(form){
    const f=read(form),from=form.elements.namedItem('from'),max=form.elements.namedItem('max_rating');
    from.setCustomValidity(f.from&&f.to&&f.from>f.to?'Начало периода должно быть раньше его окончания':'');
    max?.setCustomValidity(f.min_rating&&f.max_rating&&Number(f.min_rating)>Number(f.max_rating)?'Верхняя оценка должна быть не меньше нижней':'');
    return form.checkValidity();
  }
  function bind(form,onChange,onInvalidate=()=>{}){
    let timer;
    const run=()=>{clearTimeout(timer);if(valid(form))onChange(read(form));else form.reportValidity();};
    form.addEventListener('input',event=>{onInvalidate();clearTimeout(timer);timer=setTimeout(run,event.target.name==='query'?250:350);});
    form.addEventListener('change',event=>{if(event.target.tagName==='SELECT'){onInvalidate();run();}});
    form.addEventListener('submit',event=>{event.preventDefault();run();});
    form.addEventListener('reset',()=>{clearTimeout(timer);onInvalidate();timer=setTimeout(run,0);});
    return ()=>clearTimeout(timer);
  }
  function populate(form,data){
    for(const [name,key,label] of [['league','leagues','Все турниры'],['team','teams','Все команды']]){
      const select=form.elements.namedItem(name),value=select.value;
      const values=[...new Set([...(data[key]||[]),...(value?[value]:[])])].sort((a,b)=>a.localeCompare(b,'ru'));
      select.innerHTML=`<option value="">${label}</option>`+values.map(v=>`<option value="${escape(v)}">${escape(v)}</option>`).join('');select.value=value;
    }
    const f=read(form),count=Object.entries(f).filter(([k,v])=>!(k==='sort'&&v==='average')&&!(k==='min_votes'&&v==='1')).length;
    form.querySelector('.explore-active-count').textContent=count?String(count):'';
    form.querySelector('.explore-filter-caption').textContent=count?'Фильтров: '+count:'Без ограничений';
    form.querySelector('[type="reset"]').disabled=!count;
  }
  root.FBZExplore=Object.freeze({filters,read,bind,populate});
})(window);
