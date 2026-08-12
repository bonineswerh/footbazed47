(function(){
  'use strict';

  const isLocalTest=['localhost','127.0.0.1'].includes(window.location.hostname)
    &&new URLSearchParams(window.location.search).has('__e2e');
  const testClient=isLocalTest?window.__FOOTBAZED_TEST_CLIENT__:null;
  const runtime=window.__FOOTBAZED_RUNTIME_CONFIG__||{};
  const config=Object.freeze({
    environment:String(runtime.environment||'unknown'),
    supabaseUrl:String(runtime.supabaseUrl||''),
    supabaseKey:String(runtime.supabaseKey||'')
  });

  function jwtRole(key){
    try{
      const payload=key.split('.')[1];
      if(!payload)return'';
      return JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/'))).role||'';
    }catch{return'';}
  }

  window.FBZ_CONFIG=config;
  window.FBZ_BOOT_ERROR='';
  if(testClient){
    window.sb=testClient;
  }else if(runtime.error){
    window.sb=null;
    window.FBZ_BOOT_ERROR=String(runtime.error);
  }else if(!config.supabaseUrl||!config.supabaseKey){
    window.sb=null;
    window.FBZ_BOOT_ERROR='runtime_config_missing';
  }else if(jwtRole(config.supabaseKey)==='service_role'){
    window.sb=null;
    window.FBZ_BOOT_ERROR='unsafe_runtime_key';
  }else if(!window.supabase?.createClient){
    window.sb=null;
    window.FBZ_BOOT_ERROR='supabase_client_unavailable';
  }else{
    window.sb=window.supabase.createClient(config.supabaseUrl,config.supabaseKey);
  }
  window.PUBLIC_USER_FIELDS='id,username,display_name,avatar_url,bio,favorite_teams,ratings_count,avg_rating,streak,streak_date,is_public,created_at';
  window.MATCH_FIELDS='id,league_name,home_team_name,away_team_name,home_club_id,away_club_id,match_date,status,home_score,away_score,external_id,league_code,matchday,season';
  window.RATING_FIELDS='id,user_id,match_id,match_rating,comment,is_public,created_at';
  window.PLAYER_FIELDS='id,name,team,club_id,position,photo_url,shirt_number';

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
    if(!url)return'';
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
