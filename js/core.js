(function(){
  'use strict';

  const config=Object.freeze({
    supabaseUrl:'https://uukacnyvjvgmmhbkmfzf.supabase.co',
    supabaseKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1a2Fjbnl2anZnbW1oYmttZnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MDM3MzcsImV4cCI6MjA4NzA3OTczN30.hZIYkrWFqRwu0IciG2iF3TyP8WnVQcV1sFyjfeVUpRc'
  });

  window.FBZ_CONFIG=config;
  window.sb=window.supabase.createClient(config.supabaseUrl,config.supabaseKey);
  window.PUBLIC_USER_FIELDS='id,username,display_name,avatar_url,bio,favorite_teams,ratings_count,avg_rating,streak,streak_date,is_public,created_at';
  window.SELF_USER_FIELDS=`${window.PUBLIC_USER_FIELDS},invite_code,is_admin,last_seen`;
  window.MATCH_FIELDS='id,league_name,home_team_name,away_team_name,match_date,status,home_score,away_score,external_id,league_code,matchday,season';
  window.RATING_FIELDS='id,user_id,match_id,match_rating,comment,is_public,created_at';
  window.PLAYER_FIELDS='id,name,team,position,photo_url,shirt_number';

  window.CACHE_TTL=Object.freeze({
    matches:5*60*1000,
    feed:10*60*1000,
    profile:15*60*1000,
    stats:30*60*1000,
    players:60*60*1000
  });

  window.esc=function(value){
    return String(value??'').replace(/[&<>'"]/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    }[ch]));
  };

  // Safe for a JavaScript string embedded in a double-quoted HTML attribute.
  window.jsStr=function(value){
    return JSON.stringify(String(value??''))
      .replace(/&/g,'\\u0026')
      .replace(/</g,'\\u003c')
      .replace(/>/g,'\\u003e')
      .replace(/"/g,'&quot;');
  };

  window.safeImageUrl=function(value){
    const url=String(value||'').trim();
    if(/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(url))return window.esc(url);
    try{
      const parsed=new URL(url,window.location.origin);
      return /^https?:$/.test(parsed.protocol)?window.esc(parsed.href):'';
    }catch(e){
      return'';
    }
  };

  window.setCache=function(key,data){
    try{localStorage.setItem(`fb_${key}`,JSON.stringify({data,ts:Date.now()}));}catch(e){}
  };

  window.getCache=function(key,ttl){
    try{
      const cached=JSON.parse(localStorage.getItem(`fb_${key}`));
      if(!cached)return null;
      if(Date.now()-cached.ts>(ttl||window.CACHE_TTL[key]||300000)){
        localStorage.removeItem(`fb_${key}`);
        return null;
      }
      return cached.data;
    }catch(e){
      return null;
    }
  };

  window.clearAppCache=function(){
    try{
      Object.keys(localStorage)
        .filter(key=>key.startsWith('fb_'))
        .forEach(key=>localStorage.removeItem(key));
    }catch(e){}
  };
})();
