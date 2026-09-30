(function(root){
  'use strict';

  const cache=new Map();
  let sessionUserId=null;
  let cacheVersion=0;
  let sessionVersion=0;

  async function rpc(name,args,cacheKey,ttl=0){
    if(cacheKey&&ttl>0){
      const cached=cache.get(cacheKey);
      if(cached&&Date.now()-cached.createdAt<ttl)return structuredClone(cached.value);
    }
    const requestSession=sessionVersion;
    const requestCache=cacheVersion;
    const{data,error}=await root.sb.rpc(name,args);
    if(requestSession!==sessionVersion){
      throw Object.assign(new Error('Session changed'),{name:'AbortError'});
    }
    if(error)throw error;
    if(cacheKey&&ttl>0&&requestCache===cacheVersion)cache.set(cacheKey,{value:structuredClone(data),createdAt:Date.now()});
    return data;
  }

  async function getProfilePage(userId,{force=false}={}){
    const key=`profile:${userId}`;
    if(force)cache.delete(key);
    return rpc('get_profile_page',{p_user_id:userId,p_rating_limit:50},key,60_000);
  }

  async function getMatchesPage({status='all',league='all',query='',limit=24,offset=0,force=false}={}){
    const normalizedStatus=['live','scheduled','finished','postponed','cancelled'].includes(status)?status:'all';
    const normalizedLeague=String(league||'all').slice(0,120);
    const normalizedQuery=root.FBZDomain.normalizeSearchQuery(query);
    const normalizedLimit=Math.min(Math.max(Number(limit)||24,1),48);
    const normalizedOffset=Math.max(Number(offset)||0,0);
    const key=`matches:${normalizedStatus}:${normalizedLeague}:${normalizedQuery}:${normalizedLimit}:${normalizedOffset}`;
    if(force)cache.delete(key);
    const page=await rpc('get_matches_page',{
      p_status:normalizedStatus,
      p_league:normalizedLeague,
      p_query:normalizedQuery,
      p_limit:normalizedLimit,
      p_offset:normalizedOffset
    },key,30_000);
    await enrichMatchMedia(page?.items||[],{force});
    return page;
  }

  async function enrichMatchMedia(matches,{force=false}={}){
    const ids=[...new Set(matches.flatMap(match=>[match.home_club_id,match.away_club_id]).map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))].slice(0,96).sort((a,b)=>a-b);
    if(!ids.length)return matches;
    const key=`club-marks:${ids.join(',')}`;
    if(force)cache.delete(key);
    let timer;
    try{
      const clubs=await Promise.race([rpc('get_club_marks',{p_ids:ids},key,60_000),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),1500);})]);
      if(!Array.isArray(clubs))return matches;
      const byId=new Map(clubs.map(club=>[Number(club.id),club]));
      for(const match of matches){match.home_club=byId.get(Number(match.home_club_id))||null;match.away_club=byId.get(Number(match.away_club_id))||null;}
    }catch(error){
      if(error.name==='AbortError')throw error;
      // Optional media must never prevent opening a match or rating.
    }finally{clearTimeout(timer);}
    return matches;
  }

  function invalidate(prefix=''){
    cacheVersion++;
    for(const key of cache.keys())if(!prefix||key.startsWith(prefix))cache.delete(key);
  }

  function getProfileDiary(userId,{filters={},cursor=null,limit=8}={}){
    return rpc('get_profile_diary',{p_user_id:userId,p_filters:filters,p_cursor:cursor,p_limit:limit});
  }
  function getFootballStatistics(kind,{filters={},offset=0,limit=12}={}){
    return rpc('get_football_statistics',{p_kind:kind,p_filters:filters,p_offset:offset,p_limit:limit});
  }

  function setSessionUser(userId){
    const next=userId||null;
    if(next===sessionUserId)return;
    sessionUserId=next;
    sessionVersion++;
    invalidate();
  }

  root.FBZData=Object.freeze({getMatchesPage,getProfilePage,getProfileDiary,getFootballStatistics,enrichMatchMedia,invalidate,setSessionUser});
})(window);
