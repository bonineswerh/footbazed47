(function(root){
  'use strict';

  const origin='https://footbazed47.vercel.app';
  const defaults=Object.freeze({
    title:'FOOTBAZED — Оценивай футбол вместе',
    description:'Футбольная платформа для оценок матчей и игроков, личной статистики и общения с болельщиками.',
    image:`${origin}/assets/stadium-bg.webp`
  });
  const staticPages=Object.freeze({
    home:{path:'/',title:defaults.title,description:defaults.description,index:true},
    matches:{path:'/matches',title:'Матчи — FOOTBAZED',description:'Календарь футбольных матчей, прогнозы и оценки сообщества FOOTBAZED.',index:true},
    leaderboard:{path:'/leaderboard',title:'Рейтинги болельщиков — FOOTBAZED',description:'Рейтинг болельщиков FOOTBAZED по отклику сообщества и активности.',index:true},
    feed:{path:'/feed',title:'Лента — FOOTBAZED',description:'Оценки и мнения футбольного сообщества FOOTBAZED.',index:false},
    friends:{path:'/friends',title:'Друзья — FOOTBAZED',description:defaults.description,index:false},
    admin:{path:'/admin',title:'Управление платформой — FOOTBAZED',description:defaults.description,index:false}
  });

  function meta(selector,attribute,value){
    const element=document.querySelector(selector);
    if(element)element.setAttribute(attribute,value);
  }

  function absoluteImage(value){
    try{
      const parsed=new URL(String(value||defaults.image),origin);
      return /^https?:$/u.test(parsed.protocol)?parsed.href:defaults.image;
    }catch{return defaults.image;}
  }

  function apply({title=defaults.title,description=defaults.description,path='/',image=defaults.image,type='website',index=true,structuredData=null}={}){
    const cleanPath=String(path||'/').startsWith('/')?String(path||'/'):`/${path}`;
    const canonical=`${origin}${cleanPath}`;
    const cleanDescription=String(description||defaults.description).slice(0,220);
    document.title=title;
    meta('meta[name="description"]','content',cleanDescription);
    meta('meta[name="robots"]','content',index?'index,follow':'noindex,nofollow');
    meta('link[rel="canonical"]','href',canonical);
    meta('meta[property="og:type"]','content',type);
    meta('meta[property="og:title"]','content',title);
    meta('meta[property="og:description"]','content',cleanDescription);
    meta('meta[property="og:url"]','content',canonical);
    meta('meta[property="og:image"]','content',absoluteImage(image));
    let script=document.getElementById('fbzStructuredData');
    if(!structuredData){script?.remove();return;}
    if(!script){script=document.createElement('script');script.type='application/ld+json';script.id='fbzStructuredData';document.head.append(script);}
    script.textContent=JSON.stringify({'@context':'https://schema.org',...structuredData});
  }

  function setStatic(page){
    apply(staticPages[page]||{title:`${page==='profile'?'Профиль':page==='club'?'Клуб':page==='player'?'Игрок':page==='competition'?'Турнир':'Матч'} — FOOTBAZED`,index:false});
  }

  function club(value){
    const club=value||{};
    const description=[club.area_name,club.venue,club.founded?`основан в ${club.founded} году`:null].filter(Boolean).join(' · ');
    apply({
      title:`${club.name||'Клуб'} — FOOTBAZED`,
      description:`${club.name||'Футбольный клуб'} в FOOTBAZED${description?`: ${description}`:''}. Состав, матчи и оценки игроков.`,
      path:`/club/${Number(club.id)}`,
      image:window.FBZMedia?.resolveAsset(club.media,'club_logo')?.url,
      type:'profile',
      structuredData:{'@type':'SportsTeam',name:club.name,url:`${origin}/club/${Number(club.id)}`,logo:absoluteImage(window.FBZMedia?.resolveAsset(club.media,'club_logo')?.url),sport:'Football',location:club.area_name||undefined}
    });
  }

  function player(value){
    const player=value||{};
    const club=player.club;
    apply({
      title:`${player.name||'Игрок'} — FOOTBAZED`,
      description:`${player.name||'Футболист'}${player.position?` · ${player.position}`:''}${club?.name?` · ${club.name}`:''}. Оценки болельщиков и матчи в FOOTBAZED.`,
      path:`/player/${Number(player.id)}`,
      image:window.FBZMedia?.resolveAsset(player.media,'player_photo')?.url||window.FBZMedia?.resolveAsset(club?.media,'club_logo')?.url,
      type:'profile',
      structuredData:{'@type':'Person',name:player.name,url:`${origin}/player/${Number(player.id)}`,image:absoluteImage(window.FBZMedia?.resolveAsset(player.media,'player_photo')?.url),jobTitle:'Football player',affiliation:club?{'@type':'SportsTeam',name:club.name,url:`${origin}/club/${Number(club.id)}`}:undefined}
    });
  }

  function competition(value){
    const item=value||{};
    apply({
      title:`${item.name||'Турнир'} — FOOTBAZED`,
      description:`${item.name||'Футбольный турнир'} в FOOTBAZED. Клубы, матчи и оценки болельщиков.`,
      path:`/competition/${Number(item.id)}`,
      image:window.FBZMedia?.resolveAsset(item.media,'competition_logo')?.url,
      structuredData:{'@type':'SportsOrganization',name:item.name,url:`${origin}/competition/${Number(item.id)}`,sport:'Football'}
    });
  }

  function match(value){
    const match=value||{};
    const name=`${match.home_team_name||'Команда'} — ${match.away_team_name||'Команда'}`;
    apply({
      title:`${name} — FOOTBAZED`,
      description:`${name}${match.league_name?` · ${match.league_name}`:''}. Оценки матча, игроков и мнение сообщества FOOTBAZED.`,
      path:`/match/${Number(match.id)}`,
      type:'article',
      structuredData:{'@type':'SportsEvent',name,startDate:match.match_date,url:`${origin}/match/${Number(match.id)}`,sport:'Football',homeTeam:{'@type':'SportsTeam',name:match.home_team_name},awayTeam:{'@type':'SportsTeam',name:match.away_team_name}}
    });
  }

  function profile(value){
    const user=value||{};
    const name=user.display_name||user.username||'Профиль';
    apply({
      title:`${name} — FOOTBAZED`,
      description:`Футбольный профиль ${name}: оценки матчей, средний балл и активность в FOOTBAZED.`,
      path:`/profile/${encodeURIComponent(user.id||'')}`,
      type:'profile',
      image:user.avatar_url,
      index:user.is_public!==false,
      structuredData:user.is_public===false?null:{'@type':'ProfilePage',name:`Профиль ${name}`,url:`${origin}/profile/${encodeURIComponent(user.id||'')}`}
    });
  }

  root.FBZSEO=Object.freeze({apply,club,competition,match,player,profile,setStatic});
})(window);
