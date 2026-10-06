(function(root,factory){
  const media=root?.FBZMedia||(typeof module==='object'?require('./media.js'):null);
  const names=root?.FBZNames||(typeof module==='object'?require('./football-names.js'):null);
  const api=factory(root,media,names,root?.FBZLocale?.language||'ru');
  if(root)root.FBZSEO=api;
  if(typeof module==='object'&&module.exports)module.exports={...api,forLanguage:language=>factory(null,media,names,language)};
})(typeof window==='undefined'?null:window,function(root,media,names,language){
  'use strict';

  const origin='https://footbazed47.vercel.app';
  const en=language==='en';
  const localizedPath=path=>(en?'/en':'')+(path==='/'&&en?'':path);
  const labels={'Профиль':'Profile','Клуб':'Club','Игрок':'Player','Турнир':'Competition','Матч':'Match'};
  const text=value=>en?(labels[value]||value):value;
  const defaults=Object.freeze({
    title:en?'FOOTBAZED — Rate football together':'FOOTBAZED — Оценивай футбол вместе',
    description:en?'Rate matches and players, keep your football diary and share your views with other fans.':'Футбольная платформа для оценок матчей и игроков, личной статистики и общения с болельщиками.',
    image:`${origin}/assets/stadium-bg.webp`
  });
  const translate=value=>!root&&en?(require('../locales/en.json')[value]||value):value;
  const staticPages=Object.freeze({
    home:{path:'/',title:defaults.title,description:defaults.description,index:true},
    matches:{path:'/matches',title:'Матчи — FOOTBAZED',description:'Календарь футбольных матчей, прогнозы и оценки сообщества FOOTBAZED.',index:true},
    leaderboard:{path:'/discover',title:'Обзор оценок — FOOTBAZED',description:'Средние оценки матчей, клубов, игроков и турниров с фильтрами по периоду и размеру выборки.',index:true},
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
    const rawPath=String(path||'/').startsWith('/')?String(path||'/'):`/${path}`;
    const cleanPath=en&&!/^\/en(?:\/|$)/u.test(rawPath)?localizedPath(rawPath):rawPath;
    const canonical=`${origin}${cleanPath}`;
    const cleanDescription=String(description||defaults.description).slice(0,220);
    if(!root)return {title,description:cleanDescription,path:cleanPath,canonical,image:absoluteImage(image),type,index,structuredData};
    document.title=title;
    meta('meta[name="description"]','content',cleanDescription);
    meta('meta[name="robots"]','content',index?'index,follow':'noindex,nofollow');
    meta('link[rel="canonical"]','href',canonical);
    const basePath=cleanPath.replace(/^\/en(?=\/|$)/u,'')||'/';
    for(const [lang,url] of [['ru',origin+basePath],['en',origin+'/en'+(basePath==='/'?'':basePath)],['x-default',origin+basePath]]){
      let link=document.querySelector('link[rel="alternate"][hreflang="'+lang+'"]');
      if(!link){link=document.createElement('link');link.rel='alternate';link.hreflang=lang;document.head.append(link);}
      link.href=url;
    }
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
    const base=staticPages[page];
    return apply(base?{...base,title:translate(base.title),description:translate(base.description)}:{title:`${text(page==='profile'?'Профиль':page==='club'?'Клуб':page==='player'?'Игрок':page==='competition'?'Турнир':'Матч')} — FOOTBAZED`,index:false});
  }

  function club(value){
    const club=value||{};
    const name=names?.club(club,'',true,language)||club.name||text('Клуб');
    const description=[club.area_name,club.venue,club.founded?`основан в ${club.founded} году`:null].filter(Boolean).join(' · ');
    return apply({
      title:`${name} — FOOTBAZED`,
      description:en?`${name} on FOOTBAZED. Squad, matches and player ratings.`:`${name} в FOOTBAZED${description?`: ${description}`:''}. Состав, матчи и оценки игроков.`,
      path:`/club/${Number(club.id)}`,
      image:media?.resolveAsset(club.media,'club_logo')?.url,
      type:'profile',
      structuredData:{'@type':'SportsTeam',name:club.name,url:`${origin}/club/${Number(club.id)}`,logo:media?.resolveAsset(club.media,'club_logo')?.url,sport:'Football',location:club.area_name||undefined}
    });
  }

  function player(value){
    const player=value||{};
    const club=player.club;
    return apply({
      title:`${player.name||'Игрок'} — FOOTBAZED`,
      description:en?`${player.name||'Football player'}. Fan ratings and matches on FOOTBAZED.`:`${player.name||'Футболист'}${player.position?` · ${player.position}`:''}${club?.name?` · ${names?.club(club,'',true,language)||club.name}`:''}. Оценки болельщиков и матчи в FOOTBAZED.`,
      path:`/player/${Number(player.id)}`,
      image:media?.resolveAsset(player.media,'player_photo')?.url||media?.resolveAsset(club?.media,'club_logo')?.url,
      type:'profile',
      structuredData:{'@type':'Person',name:player.name,url:`${origin}/player/${Number(player.id)}`,image:media?.resolveAsset(player.media,'player_photo')?.url,jobTitle:'Football player',affiliation:club?{'@type':'SportsTeam',name:club.name,url:`${origin}/club/${Number(club.id)}`}:undefined}
    });
  }

  function competition(value){
    const item=value||{};
    const name=names?.competition(item,language)||item.name||text('Турнир');
    return apply({
      title:`${name} — FOOTBAZED`,
      description:en?`${name} on FOOTBAZED. Clubs, matches and fan ratings.`:`${name} в FOOTBAZED. Клубы, матчи и оценки болельщиков.`,
      path:`/competition/${Number(item.id)}`,
      image:media?.resolveAsset(item.media,'competition_logo')?.url,
      structuredData:{'@type':'SportsOrganization',name:item.name,url:`${origin}/competition/${Number(item.id)}`,sport:'Football'}
    });
  }

  function match(value){
    const match=value||{};
    const name=names?.matchTitle(match,language)||`${match.home_team_name||'Команда'} — ${match.away_team_name||'Команда'}`;
    return apply({
      title:`${name} — FOOTBAZED`,
      description:en?`${name}. Match ratings, player ratings and views from the FOOTBAZED community.`:`${name}${match.league_name?` · ${names?.competition(match.league_name,language)||match.league_name}`:''}. Оценки матча, игроков и мнение сообщества FOOTBAZED.`,
      path:`/match/${Number(match.id)}`,
      type:'article',
      structuredData:{'@type':'SportsEvent',name,startDate:match.match_date,url:`${origin}/match/${Number(match.id)}`,sport:'Football',homeTeam:{'@type':'SportsTeam',name:match.home_team_name},awayTeam:{'@type':'SportsTeam',name:match.away_team_name}}
    });
  }

  function profile(value){
    const user=value||{};
    const name=user.display_name||user.username||'Профиль';
    return apply({
      title:`${name} — FOOTBAZED`,
      description:`Футбольный профиль ${name}: оценки матчей, средний балл и активность в FOOTBAZED.`,
      path:`/profile/${encodeURIComponent(user.id||'')}`,
      type:'profile',
      image:user.avatar_url,
      index:user.is_public!==false,
      structuredData:user.is_public===false?null:{'@type':'ProfilePage',name:`Профиль ${name}`,url:`${origin}/profile/${encodeURIComponent(user.id||'')}`}
    });
  }

  return Object.freeze({apply,club,competition,match,player,profile,setStatic});
});
