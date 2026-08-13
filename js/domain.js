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
    if(score<10)return'high';
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

  return Object.freeze({authErrorMessage,normalizeSearchQuery,ratingPresentation,ratingTone,sortMatches,validateRatingDraft});
});
