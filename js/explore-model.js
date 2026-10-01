(function(root,factory){
  'use strict';
  const api=Object.freeze(factory());
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FBZExploreModel=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const common=['query','competition_id','club_id','from','to'];
  const diaryKeys=['min_rating','max_rating','home_score','away_score'];
  const overviewKeys=['min_votes','sort'];
  function normalize(input={},diary=false){
    const result={};
    for(const key of [...common,...(diary?diaryKeys:overviewKeys)]){
      const value=String(input[key]??'').trim();if(!value)continue;
      if(key==='query'){result.query=value.replace(/\s+/gu,' ').slice(0,80);continue;}
      if(key.endsWith('_id')){if(/^[1-9][0-9]{0,14}$/u.test(value))result[key]=value;continue;}
      if(key==='from'||key==='to'){
        if(/^\d{4}-\d{2}-\d{2}$/u.test(value)&&Number(value.slice(0,4))>=1000){
          const d=new Date(value+'T00:00:00Z');if(Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value)result[key]=value;
        }continue;
      }
      if(key==='sort'){if(['votes','recent'].includes(value))result.sort=value;continue;}
      const n=Number(value),minimum=key.endsWith('score')?0:1,maximum=key.endsWith('rating')?10:key.endsWith('score')?99:1000000;
      if(/^\d+$/u.test(value)&&Number.isInteger(n)&&n>=minimum&&n<=maximum&&!(key==='min_votes'&&n===1))result[key]=String(n);
    }return result;
  }
  function locationFilters(search,scope){
    const p=new URLSearchParams(search),input={};for(const key of [...common,...diaryKeys,...overviewKeys])input[key]=p.get(scope+'_'+key);
    return normalize(input,scope==='di');
  }
  function searchParams(search,scope,filters,extras={}){
    const p=new URLSearchParams(search);for(const key of [...p.keys()])if(key.startsWith(scope+'_'))p.delete(key);
    for(const [key,value] of Object.entries(normalize(filters,scope==='di')))p.set(scope+'_'+key,value);
    if(scope==='ov'&&['clubs','players','leagues'].includes(extras.kind))p.set('ov_kind',extras.kind);return p.toString();
  }
  function clubsForCompetition(clubs,competitionId){return (Array.isArray(clubs)?clubs:[]).filter(c=>!competitionId||(c.competition_ids||[]).map(String).includes(String(competitionId)));}
  function monthGroups(items,months=[]){
    const groups=new Map(),summaries=new Map(months.map(m=>[m.month,m]));
    for(const item of items){const month=String(item.match_date||'').slice(0,7);if(!/^\d{4}-\d{2}$/u.test(month))continue;
      if(!groups.has(month))groups.set(month,{month,summary:summaries.get(month)||null,items:[]});groups.get(month).items.push(item);
    }return [...groups.values()];
  }
  return{normalize,locationFilters,searchParams,clubsForCompetition,monthGroups};
});
