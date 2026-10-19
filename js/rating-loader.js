(function(root){
  'use strict';

  let loading=null;
  let openVersion=0;

  function loadRatings(){
    if(loading)return loading;
    loading=root.FBZFeatures.load({key:'ratings',styleId:'ratingsStyles',script:'js/ratings.js?v=20261009-community1',style:'css/ratings.css?v=20261009-controls',ready:()=>root.__FOOTBAZED_RATINGS_READY__}).catch(error=>{loading=null;throw error;});
    return loading;
  }

  async function openRateLazy(matchId,mode='rating'){
    const intent=++openVersion,route=routeVersion,user=CU?.id||null;
    const current=()=>intent===openVersion&&route===routeVersion&&(CU?.id||null)===user;
    try{
      await loadRatings();
      if(!current())return;
      if(!root.FBZRatings?.open)throw new Error('ratings_not_initialized');
      return root.FBZRatings.open(matchId,mode);
    }catch(error){
      if(!current())return;
      console.error('Rating module error:',error);
      root.toast?.('Не удалось открыть форму оценки','err');
    }
  }

  root.openRate=openRateLazy;
  root.FBZRatingsLoader=Object.freeze({load:loadRatings});
})(window);
