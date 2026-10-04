(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.FBZDomain=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const AUTH_MESSAGES={
    'invalid login credentials':'Неверный email или пароль',
    'email not confirmed':'Email не подтверждён',
    'token has expired or is invalid':'Неверный или просроченный код',
    'otp expired':'Код истёк. Запросите новый',
    'email rate limit exceeded':'Слишком много писем. Попробуйте позже',
    'over_email_send_rate_limit':'Слишком много писем. Попробуйте позже',
    'user already registered':'Аккаунт с этим email уже существует',
    'weak_password':'Пароль недостаточно надёжный'
  };

  function authErrorMessage(error,fallback='Не удалось выполнить действие'){
    const code=String(error?.code||'').toLocaleLowerCase('en-US');
    const message=String(error?.message||'').toLocaleLowerCase('en-US');
    return AUTH_MESSAGES[code]||AUTH_MESSAGES[message]||fallback;
  }

  function validateRatingDraft({matchRating,supporterSide,comment='',playerRatings=[],bestPlayerId=null}={}){
    const score=Number(matchRating);
    if(!Number.isInteger(score)||score<1||score>10)return{valid:false,error:'Выберите оценку матча от 1 до 10'};
    if(!['home','away','neutral'].includes(String(supporterSide||'')))return{valid:false,error:'Выберите, с чьей позиции вы оцениваете матч'};
    if(String(comment).trim().length>1000)return{valid:false,error:'Комментарий не может быть длиннее 1000 символов'};
    if(!Array.isArray(playerRatings)||playerRatings.length>60)return{valid:false,error:'Слишком много оценок игроков'};

    const seen=new Set();
    for(const item of playerRatings){
      const playerId=Number(item?.player_id);
      const rating=Number(item?.rating);
      if(!Number.isSafeInteger(playerId)||playerId<1||!Number.isInteger(rating)||rating<1||rating>10){
        return{valid:false,error:'Проверьте оценки игроков'};
      }
      if(seen.has(playerId))return{valid:false,error:'Один игрок добавлен дважды'};
      seen.add(playerId);
    }

    if(bestPlayerId!==null&&!seen.has(Number(bestPlayerId))){
      return{valid:false,error:'Сначала поставьте оценку лучшему игроку'};
    }
    return{valid:true,error:''};
  }

  function ratingTone(value){
    const score=Number(value);
    if(!Number.isFinite(score)||score<1||score>10)return'neutral';
    if(score<=3)return'low';
    if(score<7)return'mid';
    if(score<9)return'high';
    return'elite';
  }

  function ratingPresentation(value,precision=0){
    const score=Number(value);
    if(!Number.isFinite(score)||score<1||score>10){
      return{score:null,value:'—',label:'Нет оценки',tone:'neutral',progress:0};
    }
    const digits=Number.isInteger(precision)?Math.min(Math.max(precision,0),1):0;
    const formatted=score.toFixed(digits);
    return{
      score,
      value:formatted,
      label:`${formatted}/10`,
      tone:ratingTone(score),
      progress:score*10
    };
  }

  function normalizeSearchQuery(value){
    return String(value||'').replace(/\s+/g,' ').trim().slice(0,80);
  }

  // Editorial matte swatches based on home-kit identities; sources in docs/sources/club-palettes.md.
  // Exact aliases only: unknown or untrusted names never become CSS.
  const CLUB_SWATCHES=`eee6d4|Real Madrid CF|Real Madrid|Реал Мадрид|Реал
8bbddd|Manchester City FC|Manchester City|Man City|Манчестер Сити|Ман Сити
294d89 923a58|FC Barcelona|Barcelona|Barça|Барселона
ce514e 4277bb|Club Atlético de Madrid|Atlético de Madrid|Atletico Madrid|Atleti|Атлетико Мадрид
283f6a|Paris Saint-Germain FC|Paris Saint-Germain|PSG|ПСЖ
347dc4 e5e9ed|Brighton & Hove Albion FC|Brighton & Hove Albion|Brighton Hove|Brighton
bd4948|Liverpool FC|Liverpool|Ливерпуль
b94745 e6ded5|Arsenal FC|Arsenal|Арсенал
bb4845 34383e|Manchester United FC|Manchester United|Man United|Манчестер Юнайтед
4276bd|Chelsea FC|Chelsea|Челси
e6e6dc 344765|Tottenham Hotspur FC|Tottenham Hotspur|Tottenham|Тоттенхэм
ac4250 96bacd|Aston Villa FC|Aston Villa
883e50 8bb7d0|West Ham United FC|West Ham United|West Ham
864451 93b4ce|Burnley FC|Burnley
c94d4f e3e3df|Brentford FC|Brentford
bf414d 2d3440|AFC Bournemouth|Bournemouth
dfb657 35383d|Wolverhampton Wanderers FC|Wolverhampton|Wolves
e8e5df 313740|Fulham FC|Fulham
e3e3de 394047|Newcastle United FC|Newcastle United|Newcastle
bd444b|Nottingham Forest FC|Nottingham Forest|Nottingham
c34e51 e6e3df|Sunderland AFC|Sunderland
eae5dc|Leeds United FC|Leeds United|Leeds
4374b8|Everton FC|Everton
3866a7 b74751|Crystal Palace FC|Crystal Palace
81b9d3|Coventry City FC|Coventry City|Coventry
cfaa50 35383c|Hull City AFC|Hull City|Hull
3972b6 e3e5e8|Ipswich Town FC|Ipswich Town|Ipswich
c14547 e4dcd8|Athletic Club|Athletic Bilbao|Athletic
b4404e 3b4e77|CA Osasuna|Osasuna
466caa e0e3e3|Deportivo Alavés|Alavés|Alaves
e6e6db 5a9868|Elche CF|Elche
396aad|Getafe CF|Getafe
c85154 e6dfdc|Girona FC|Girona
ac4054 3d6497|Levante UD|Levante
e9e5df b94a4e|Rayo Vallecano de Madrid|Rayo Vallecano|Rayo
8ebbd0|RC Celta de Vigo|Celta Vigo|Celta
4478b0 e4e5e0|RCD Espanyol de Barcelona|RCD Espanyol|Espanyol
c24b4c 373e45|RCD Mallorca|Mallorca
529b72 e7e5da|Real Betis Balompié|Real Betis|Betis
3c70b7 e4e6e0|Real Sociedad de Fútbol|Real Sociedad|Real Sociedad San Sebastián
3768a8|Real Oviedo|Oviedo
e5e2d9 b74950|Sevilla FC|Sevilla
e5e4dd 333941|Valencia CF|Valencia
e5cb62|Villarreal CF|Villarreal
80b4d1 e7e5dd|Málaga CF|Málaga|Malaga
4474a8 e2e4df|RC Deportivo La Coruña|Deportivo|Deportivo La Coruña
e3e5df 589173|Real Racing Club de Santander|Racing|Racing Santander
c3494b|FC Bayern München|Bayern Munich|Bayern München|Bayern|Бавария
dfc453 343c40|Borussia Dortmund|BV Borussia 09 Dortmund|Dortmund|Боруссия Дортмунд
e1e5dd 539879|Borussia Mönchengladbach|Mönchengladbach|M'gladbach|Gladbach
b74a4b 323b44|Bayer 04 Leverkusen|Bayer Leverkusen|Leverkusen
e4e3df c64f57|RB Leipzig|Leipzig
b7464b 343c43|Eintracht Frankfurt|Frankfurt
76b34e|VfL Wolfsburg|Wolfsburg
609f79 e3e5dc|SV Werder Bremen|Werder Bremen|Bremen
e5e3dc bc4c50|VfB Stuttgart|Stuttgart
446fa8|TSG 1899 Hoffenheim|Hoffenheim
c14f55 e3dedb|1. FSV Mainz 05|Mainz 05|Mainz
c15050 e5e2dc|1. FC Köln|Köln|Cologne
c9514d e4c05d|1. FC Union Berlin|Union Berlin
bb504d 42729c|1. FC Heidenheim 1846|Heidenheim
b44a4d 353d43|SC Freiburg|Freiburg
e6e2d9 589875|FC Augsburg|Augsburg
e5e6df 4979b4|Hamburger SV|Hamburg|HSV
856454 e2ded4|FC St. Pauli 1910|FC St. Pauli|St. Pauli
3f74b9 e5e5df|FC Schalke 04|Schalke 04|Schalke
4274ae 353b43|SC Paderborn 07|Paderborn
e4e5e0 343b43|SV 07 Elversberg|Elversberg
ad4247 303740|AC Milan|Milan|Милан
3e71ad 2e3642|FC Internazionale Milano|Inter Milan|Internazionale|Inter|Интер
e3e1da 343a44|Juventus FC|Juventus|Ювентус
80bad5|SSC Napoli|Napoli|Наполи
3f75ae 323a44|Atalanta BC|Atalanta
a74350 334d72|Bologna FC 1909|Bologna
913d4d d8a251|AS Roma|Roma
97c5da e5e5df|SS Lazio|Lazio
8766b6|ACF Fiorentina|Fiorentina
4d79b4|Como 1907|Como
93394c 354c6d|Cagliari Calcio|Cagliari
a64248 324d73|Genoa CFC|Genoa
3d6a9f d1b553|Hellas Verona FC|Hellas Verona|Verona
e4e3d9 373d43|Parma Calcio 1913|Parma
e0e3dd 343a42|Udinese Calcio|Udinese
934550|Torino FC|Torino
53966d 353b40|US Sassuolo Calcio|Sassuolo
dcc459 be5254|US Lecce|Lecce
b95153 a7aaa5|US Cremonese|Cremonese
477db4 343c46|AC Pisa 1909|Pisa
e3e6df 7cb5d0|Olympique de Marseille|Marseille|Olympique Marseille|OM
e7e5e0 4b75ae|Olympique Lyonnais|Lyon|OL
c54c53 e7e3dc|AS Monaco FC|AS Monaco|Monaco
b94d57 3b4f72|Lille OSC|Lille
dabb5d c34b4b|Racing Club de Lens|RC Lens|Lens
b8454c 343b42|OGC Nice|Nice
c04c4d 353c42|Stade Rennais FC 1901|Stade Rennais|Rennes
b95154 e1e1d9|Stade Brestois 29|Brest
4d79b3|RC Strasbourg Alsace|Strasbourg
8a73b4 e2e2da|Toulouse FC|Toulouse
8bbbce 3c5276|Le Havre AC|Le Havre
e1c65a 529277|FC Nantes|Nantes
e6e5df 477aaf|AJ Auxerre|Auxerre
e0e2db 393f43|Angers SCO|Angers
cd8151 353c40|FC Lorient|Lorient
964856|FC Metz|Metz
354f77|Paris FC|Paris
4f7bb1 e4e4dc|ES Troyes AC|Troyes
d9b456 b44b4e|Le Mans FC|Le Mans
c24f54 e5e4dd|AFC Ajax|Ajax
c34c51 e3e5dc|PSV|PSV Eindhoven
bb4d50 e4e2d9|Sport Lisboa e Benfica|SL Benfica|Benfica
53966f e3e4d9|Sporting Clube de Portugal|Sporting CP|Sporting
4775ad 343c45|Club Brugge KV|Club Brugge|Brugge
d4bc55 42699a|Royale Union Saint-Gilloise|Union SG|Union St. Gilloise
e2e3dd 4b75a8|FC København|FC Copenhagen|København|Copenhagen
e0c653 353d43|FK Bodø/Glimt|Bodø/Glimt|Bodø / Glimt
d4b358 343a40|FK Kairat|Kairat
c0574d d6ad55|Galatasaray SK|Galatasaray
c45255 e3e4dc|PAE Olympiakos SFP|Olympiakos|Olympiacos
83b7d0 e5e4dc|Paphos FC|Paphos
465570 e2e3df|Qarabağ Ağdam FK|Qarabağ|Qarabağ Ağdam|Qarabag
c65357 e5e2da|SK Slavia Praha|Slavia Praha|Slavia Prague
c34e53 e5e1d8|AC Monza|Monza
4177b7 e4e6df|FC Porto|Porto
d7be58 3a517b|Fenerbahçe SK|Fenerbahçe|Fenerbahce
bf4c51 e4e2dc|Feyenoord Rotterdam|Feyenoord
d08751 363d42|FK Shakhtar Donetsk|Shakhtar Donetsk|Shakhtar
dfc35c 4a77b0|Frosinone Calcio|Frosinone
394047 e4e3dc|LASK Linz|LASK
dcc052 363c42|PAE AEK|AEK Athens|AEK
477ba9 e4e5df|Sabah FK|Sabah FC|Sabah
8abbcf e6e6df|ŠK Slovan Bratislava|Slovan Bratislava|Slovan
c48251 528575|Venezia FC|Venezia
384e71 e2e5e0|Viking FK|Viking
73b7cd|Зенит|Zenit|Zenit St. Petersburg
c05958 e8e3dd|Спартак|Спартак Москва|Spartak Moscow
7193c3 e2e6e4|Динамо Москва|Dynamo Moscow|Dinamo Moscow
73a28a 3c4946|Краснодар|FC Krasnodar|Krasnodar`.split('\n').map(row=>{const [colors,...names]=row.split('|');return[colors.split(' ').map(hex=>'#'+hex),names];});
  const clubKey=name=>String(name||'').normalize('NFKC').toLocaleLowerCase('ru-RU').trim().replace(/\s+/gu,' ');
  const clubSwatches=new Map(CLUB_SWATCHES.flatMap(([colors,names])=>names.map(name=>[clubKey(name),Object.freeze([colors[0],colors[1]||colors[0]])])));
  const neutralPalette=Object.freeze(['#99a5ad','#99a5ad']);
  function clubPalette(name){return clubSwatches.get(clubKey(name))||neutralPalette;}
  function clubColor(name){return clubPalette(name)[0];}
  function matchPaletteStyle(match={}){
    const home=clubPalette(match.home_team_name),away=clubPalette(match.away_team_name);
    return '--club-home:'+home[0]+';--club-away:'+away[0]+';--club-home-secondary:'+home[1]+';--club-away-secondary:'+away[1];
  }

  function countLabel(value,forms){
    const count=Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):0;
    const category=new Intl.PluralRules('ru-RU').select(count);
    return `${count.toLocaleString('ru-RU')} ${forms[category]||forms.many}`;
  }

  // An activity record, never a measure of expertise or popularity.
  function profileActivity(value){
    const count=Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):0;
    const milestones=[1,10,25,50,100,250,500,1000];
    const next=milestones.find(target=>target>count)||Math.ceil((count+1)/500)*500;
    const previous=[0,...milestones].filter(target=>target<=count).at(-1)||0;
    const floor=count>=1000?Math.floor(count/500)*500:previous;
    return Object.freeze({
      count,
      label:count?countLabel(count,{one:'матч в дневнике',few:'матча в дневнике',many:'матчей в дневнике'}):'Дневник болельщика',
      next,
      remaining:next-count,
      progress:Math.min(99,Math.max(0,Math.round((count-floor)/(next-floor)*100))),
      description:count?'Каждая оценка сохраняет впечатление от матча.':'Первая оценка станет началом вашей футбольной истории.'
    });
  }

  function sortMatches(items,now=Date.now()){
    const statusRank={live:0,scheduled:1,finished:2};
    return [...(Array.isArray(items)?items:[])].sort((a,b)=>{
      const statusDifference=(statusRank[a?.status]??3)-(statusRank[b?.status]??3);
      if(statusDifference)return statusDifference;
      const aTime=new Date(a?.match_date).getTime()||0;
      const bTime=new Date(b?.match_date).getTime()||0;
      if(a?.status==='finished')return bTime-aTime;
      if(a?.status==='scheduled'){
        const aPast=aTime<now?1:0;
        const bPast=bTime<now?1:0;
        return aPast-bPast||aTime-bTime;
      }
      return aTime-bTime;
    });
  }

  function clubDisplayName(club,fallback=''){
    return String(club?.short_name||club?.name||fallback||'Клуб').trim()||'Клуб';
  }
  function matchTeamName(match,side){
    return clubDisplayName(match?.[`${side}_club`],match?.[`${side}_team_name`]);
  }
  function ratingEvidence({votes=0,voters=0,unverified=0}={}){
    const count=Math.max(0,Number(votes)||0),authors=Math.max(0,Number(voters)||0);
    const missing=Math.max(0,Number(unverified)||0);
    return Object.freeze({preliminary:count<5||authors<5||missing>0,unverified:missing,votes:count,voters:authors});
  }

  // The first returned result determines group order; keep relevance order inside
  // each group. Keyboard selection must use the same flattened order as the DOM.
  function searchResultGroups(results){
    const groups=new Map();
    for(const item of Array.isArray(results)?results:[]){
      const kind=item?.entity_type==='team'?'club':item?.entity_type;
      if(!['club','player','competition','match','user'].includes(kind))continue;
      if(!groups.has(kind))groups.set(kind,[]);
      groups.get(kind).push(item);
    }
    return [...groups].map(([kind,items])=>({kind,items}));
  }

  return Object.freeze({authErrorMessage,clubDisplayName,matchTeamName,ratingEvidence,searchResultGroups,clubPalette,clubColor,matchPaletteStyle,countLabel,profileActivity,normalizeSearchQuery,ratingPresentation,ratingTone,sortMatches,validateRatingDraft});
});
