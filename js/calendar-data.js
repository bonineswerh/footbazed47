(function(root){
'use strict';
let cached=null,sessionUser=null,sessionVersion=0,requestVersion=0;
function setSessionUser(user){if(user===sessionUser)return;sessionUser=user;sessionVersion++;requestVersion++;cached=null;}
async function getRange({force=false}={}){
  const now=new Date(),year=now.getFullYear();
  if(force){cached=null;requestVersion++;}
  if(cached?.year===year&&Date.now()-cached.createdAt<300_000)return structuredClone(cached.value);
  const session=sessionVersion,request=++requestVersion,controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8_000);
  try{
    // Two indexed edge reads: dates only, never a catalogue or provider request.
    const cutoff=new Date(year+1,0,1).toISOString();
    const edge=ascending=>root.sb.from('matches').select('match_date').lt('match_date',cutoff)
      .order('match_date',{ascending}).limit(1).abortSignal(controller.signal);
    const responses=await Promise.all([edge(true),edge(false)]);
    if(session!==sessionVersion)throw Object.assign(new Error('Session changed'),{name:'AbortError'});
    for(const response of responses)if(response.error)throw response.error;
    const value={first:responses[0].data?.[0]?.match_date||null,last:responses[1].data?.[0]?.match_date||null};
    if(request===requestVersion)cached={year,value:structuredClone(value),createdAt:Date.now()};
    return value;
  }finally{clearTimeout(timer);}
}
root.FBZCalendarData=Object.freeze({getRange,setSessionUser});
})(window);
