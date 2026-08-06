(function(){
  const KEY='fbz_appearance';
  const defaults={theme:'dark',accent:'emerald',density:'comfortable'};
  const allowed={
    theme:['dark','light','system'],
    accent:['emerald','ice','gold','mono'],
    density:['comfortable','compact']
  };
  let listening=false;

  function normalize(value){
    const next={...defaults,...(value||{})};
    Object.keys(allowed).forEach(key=>{
      if(!allowed[key].includes(next[key]))next[key]=defaults[key];
    });
    return next;
  }

  function readStored(){
    try{return normalize(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(e){return {...defaults};}
  }

  function resolvedTheme(theme){
    if(theme!=='system')return theme;
    return window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
  }

  function apply(settings){
    const next=normalize(settings);
    const root=document.documentElement;
    root.dataset.theme=resolvedTheme(next.theme);
    root.dataset.themeChoice=next.theme;
    root.dataset.accent=next.accent;
    root.dataset.density=next.density;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',root.dataset.theme==='light'?'#f5f7f2':'#04080d');
    return next;
  }

  function save(settings){
    const next=apply(settings);
    try{localStorage.setItem(KEY,JSON.stringify(next));}catch(e){}
    return next;
  }

  function syncControls(){
    const settings=readStored();
    ['Theme','Accent','Density'].forEach(name=>{
      const el=document.getElementById('set'+name);
      if(el)el.value=settings[name.toLowerCase()];
    });
    return settings;
  }

  function readControls(){
    return normalize({
      theme:document.getElementById('setTheme')?.value,
      accent:document.getElementById('setAccent')?.value,
      density:document.getElementById('setDensity')?.value
    });
  }

  function init(){
    apply(readStored());
    if(window.matchMedia&&!listening){
      listening=true;
      const mq=window.matchMedia('(prefers-color-scheme: light)');
      const refresh=()=>{const s=readStored();if(s.theme==='system')apply(s);};
      if(mq.addEventListener)mq.addEventListener('change',refresh);
      else if(mq.addListener)mq.addListener(refresh);
    }
  }

  window.FBZAppearance={init,apply,save,syncControls,readControls,get:readStored};
  init();
})();
