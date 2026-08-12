(function(){
  'use strict';

  const metrics={lcp:null,cls:0,inp:null};
  let clsSessionValue=0;
  let clsSessionStart=0;
  let clsLastEntry=0;

  function publish(final=false){
    window.dispatchEvent(new CustomEvent('fbz:web-vitals',{
      detail:Object.freeze({...metrics,final})
    }));
  }

  function observe(type,callback,options={}){
    if(!('PerformanceObserver'in window))return;
    try{
      const observer=new PerformanceObserver(list=>callback(list.getEntries()));
      observer.observe({type,buffered:true,...options});
    }catch{}
  }

  observe('largest-contentful-paint',entries=>{
    const latest=entries.at(-1);
    if(!latest)return;
    metrics.lcp=Math.round(latest.startTime);
    publish();
  });

  observe('layout-shift',entries=>{
    for(const entry of entries){
      if(entry.hadRecentInput)continue;
      const continuesSession=clsLastEntry
        &&entry.startTime-clsLastEntry<1_000
        &&entry.startTime-clsSessionStart<5_000;
      if(continuesSession)clsSessionValue+=entry.value;
      else{
        clsSessionValue=entry.value;
        clsSessionStart=entry.startTime;
      }
      clsLastEntry=entry.startTime;
      metrics.cls=Math.max(metrics.cls,clsSessionValue);
    }
    metrics.cls=Number(metrics.cls.toFixed(4));
    publish();
  });

  observe('event',entries=>{
    for(const entry of entries){
      if(!entry.interactionId)continue;
      metrics.inp=Math.max(metrics.inp||0,Math.round(entry.duration));
    }
    publish();
  },{durationThreshold:40});

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')publish(true);
  });

  window.FBZPerformance={getSnapshot:()=>({...metrics})};
})();
