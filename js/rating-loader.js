(function(root){
  'use strict';

  let loading=null;

  function loadRatings(){
    if(root.__FOOTBAZED_RATINGS_READY__)return Promise.resolve();
    if(loading)return loading;
    loading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='js/ratings.js?v=42';
      script.async=true;
      script.dataset.feature='ratings';
      script.onload=resolve;
      script.onerror=()=>{
        loading=null;
        reject(new Error('ratings_load_failed'));
      };
      document.head.appendChild(script);
    });
    return loading;
  }

  async function openRateLazy(matchId){
    try{
      await loadRatings();
      if(root.openRate===openRateLazy)throw new Error('ratings_not_initialized');
      return root.openRate(matchId);
    }catch(error){
      console.error('Rating module error:',error);
      root.toast?.('Не удалось открыть форму оценки','err');
    }
  }

  root.openRate=openRateLazy;
  root.FBZRatingsLoader=Object.freeze({load:loadRatings});
})(window);
