(function(root){
  'use strict';
  // Poll the shared catalogue, never the football provider or a visitor-triggered import.
  const fields='id,status,home_score,away_score,match_date';
  let context=null,version=0,timer=null,active=null,lastAttempt=0;
  const signature=item=>JSON.stringify([item.status,item.home_score,item.away_score,item.match_date,item.status==='scheduled'&&Date.parse(item.match_date)<=Date.now(),item.status==='live'&&Date.now()-Date.parse(item.match_date)>21600000]);
  function available(){return context&&context.isCurrent()&&!document.hidden&&navigator.onLine!==false;}
  function cancel(){clearTimeout(timer);active?.abort();active=null;}
  function stop(){version++;cancel();context=null;}
  function schedule(){
    clearTimeout(timer);
    if(!available()||!context.items.length)return;
    const near=context.items.some(item=>item.status==='live'||Math.abs(Date.parse(item.match_date)-Date.now())<14400000);
    timer=setTimeout(refresh,near?60000:300000);
  }
  function watch(options){
    stop();
    const items=[...new Map(options.items.filter(item=>['scheduled','live'].includes(item.status)&&Number.isSafeInteger(Number(item.id))).map(item=>[Number(item.id),{...item}])).values()].slice(0,48);
    context={...options,items,signatures:new Map(items.map(item=>[Number(item.id),signature(item)]))};lastAttempt=Date.now();schedule();
  }
  async function refresh(){
    if(!available()||active||!context.items.length)return;
    const current=context,token=version,controller=new AbortController();active=controller;lastAttempt=Date.now();
    const timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const{data,error}=await root.sb.from('matches').select(fields).in('id',current.items.map(item=>Number(item.id))).limit(48).abortSignal(controller.signal);
      if(error||controller.signal.aborted||token!==version||!available())return;
      const known=new Map(current.items.map(item=>[Number(item.id),item]));
      const changed=(data||[]).filter(item=>known.has(Number(item.id))&&signature(item)!==current.signatures.get(Number(item.id)));
      if(changed.length&&await current.apply(changed)!==false&&token===version){
        for(const item of changed){Object.assign(known.get(Number(item.id)),item);current.signatures.set(Number(item.id),signature(item));}
        current.items=current.items.filter(item=>['live','scheduled'].includes(item.status));
      }
    }catch{/* A failed refresh must not erase the last confirmed score. */}
    finally{clearTimeout(timeout);if(active===controller){active=null;schedule();}}
  }
  function resume(){if(Date.now()-lastAttempt>=15000)return refresh();schedule();}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();else resume();});
  root.addEventListener('offline',cancel);
  root.addEventListener('online',resume);
  root.addEventListener('focus',resume);
  root.FBZMatchUpdates=Object.freeze({watch,stop});
})(window);
