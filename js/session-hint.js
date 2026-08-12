(function(){
  'use strict';
  try{
    if(localStorage.getItem('fbz_session_hint')==='1'){
      document.documentElement.classList.add('session-hint-authenticated');
    }
  }catch{}
})();
