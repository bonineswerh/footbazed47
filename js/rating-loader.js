(function(root){
  'use strict';

  let loading=null;

  function loadRatings(){
    if(loading)return loading;
    loading=root.FBZFeatures.load({key:'ratings',styleId:'ratingsStyles',script:'js/ratings.js?v=59',style:'css/ratings.css?v=2',ready:()=>root.__FOOTBAZED_RATINGS_READY__}).catch(error=>{loading=null;throw error;});
    return loading;
  }

  async function openRateLazy(matchId){
    try{
      await loadRatings();
      if(!root.FBZRatings?.open)throw new Error('ratings_not_initialized');
      return root.FBZRatings.open(matchId);
    }catch(error){
      console.error('Rating module error:',error);
      root.toast?.('Не удалось открыть форму оценки','err');
    }
  }

  root.openRate=openRateLazy;
  root.FBZRatingsLoader=Object.freeze({load:loadRatings});
})(window);
