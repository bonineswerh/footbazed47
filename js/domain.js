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

  // Curated visual swatches, never inferred from an image or an arbitrary input color.
  // Unknown clubs stay neutral; aliases use exact normalized identity matching.
  const CLUB_SWATCHES=[
    ['#eee6d4',['Real Madrid CF','Real Madrid','Реал Мадрид','Реал']],
    ['#8bbddd',['Manchester City FC','Manchester City','Man City','Манчестер Сити','Ман Сити']],
    ['#ac3c4c',['FC Barcelona','Barcelona','Барселона']],
    ['#b74743',['Manchester United FC','Manchester United','Манчестер Юнайтед']],
    ['#bd4948',['Liverpool FC','Liverpool','Ливерпуль']],
    ['#b94745',['Arsenal FC','Arsenal','Арсенал']],
    ['#587ebc',['Chelsea FC','Chelsea','Челси']],
    ['#e6e6dc',['Tottenham Hotspur FC','Tottenham Hotspur','Тоттенхэм']],
    ['#b74947',['FC Bayern München','Bayern Munich','Bayern München','Бавария']],
    ['#d9c25d',['Borussia Dortmund','BV Borussia 09 Dortmund','Боруссия Дортмунд']],
    ['#6584bb',['Paris Saint-Germain FC','Paris Saint-Germain','PSG','ПСЖ']],
    ['#d8d7d2',['Juventus FC','Juventus','Ювентус']],
    ['#aa4246',['AC Milan','Milan','Милан']],
    ['#568abd',['FC Internazionale Milano','Inter Milan','Internazionale','Inter','Интер']],
    ['#86bdd4',['SSC Napoli','Napoli','Наполи']],
    ['#ae4b4d',['Club Atlético de Madrid','Atlético de Madrid','Atletico Madrid','Атлетико Мадрид']],
    ['#7193c3',['Динамо Москва','Dynamo Moscow','Dinamo Moscow']],
    ['#73b7cd',['Зенит','Zenit','Zenit St. Petersburg']],
    ['#b85758',['Спартак Москва','Spartak Moscow']],
    ['#73a28a',['Краснодар','FC Krasnodar','Krasnodar']]
  ];
  const clubKey=name=>String(name||'').normalize('NFKC').toLocaleLowerCase('ru-RU').trim().replace(/\s+/gu,' ');
  const clubSwatches=new Map(CLUB_SWATCHES.flatMap(([color,names])=>names.map(name=>[clubKey(name),color])));
  function clubColor(name){return clubSwatches.get(clubKey(name))||'#99a5ad';}
  function matchPaletteStyle(match={}){
    return `--club-home:${clubColor(match.home_team_name)};--club-away:${clubColor(match.away_team_name)}`;
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

  return Object.freeze({authErrorMessage,clubColor,matchPaletteStyle,countLabel,profileActivity,normalizeSearchQuery,ratingPresentation,ratingTone,sortMatches,validateRatingDraft});
});
