(function(root){
  'use strict';

  let loading=null;

  function loadRatings(){
    if(loading)return loading;
    loading=root.FBZFeatures.load({key:'ratings',script:'js/ratings.js?v=56',ready:()=>root.__FOOTBAZED_RATINGS_READY__}).catch(error=>{loading=null;throw error;});
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
