(function(root){
  'use strict';

  // Only functions registered by our own scripts can run. HTML carries an
  // action name and JSON data, never JavaScript or a global function path.
  const handlers=new Map();
  const events=new Set(['click','input','change','submit','keydown']);
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function register(actions){
    for(const [name,handler] of Object.entries(actions)){
      if(handlers.has(name)||typeof handler!=='function')throw new Error('Invalid or duplicate UI action');
      handlers.set(name,handler);
    }
  }
  function attrs(name,args=[],event='click'){
    if(!events.has(event)||!Array.isArray(args))throw new Error('Invalid UI action attributes');
    return `data-fbz-${event}="${escape(name)}" data-fbz-args="${escape(JSON.stringify(args))}"`;
  }
  function report(){
    console.error('UI action failed');
    root.toast?.('Не удалось выполнить действие. Попробуйте ещё раз.','err');
  }
  for(const type of events){
    document.addEventListener(type,event=>{
      const element=event.target instanceof Element?event.target.closest(`[data-fbz-${type}]`):null;
      if(!element||element.matches(':disabled')||element.closest('[inert]'))return;
      const handler=handlers.get(element.getAttribute(`data-fbz-${type}`));
      if(!handler)return;
      if(type==='submit')event.preventDefault();
      try{
        const args=JSON.parse(element.getAttribute('data-fbz-args')||'[]');
        if(!Array.isArray(args))return;
        Promise.resolve(handler(event,element,args)).catch(report);
      }catch{report();}
    });
  }
  root.FBZActions=Object.freeze({register,attrs});
})(window);
