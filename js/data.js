(function(root){
  'use strict';

  const cache=new Map();

  async function rpc(name,args,cacheKey,ttl=0){
    if(cacheKey&&ttl>0){
      const cached=cache.get(cacheKey);
      if(cached&&Date.now()-cached.createdAt<ttl)return structuredClone(cached.value);
    }
    const{data,error}=await root.sb.rpc(name,args);
    if(error)throw error;
    if(cacheKey&&ttl>0)cache.set(cacheKey,{value:data,createdAt:Date.now()});
    return data;
  }

  async function getLeaderboard(metric='likes'){
    const normalized=metric==='ratings'?'ratings':'likes';
    return rpc('get_leaderboard',{p_metric:normalized,p_limit:50},`leaderboard:${normalized}`,60_000);
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
    return rpc('get_matches_page',{
      p_status:normalizedStatus,
      p_league:normalizedLeague,
      p_query:normalizedQuery,
      p_limit:normalizedLimit,
      p_offset:normalizedOffset
    },key,30_000);
  }

  function invalidate(prefix=''){
    for(const key of cache.keys())if(!prefix||key.startsWith(prefix))cache.delete(key);
  }

  root.FBZData=Object.freeze({getLeaderboard,getMatchesPage,getProfilePage,invalidate});
})(window);
