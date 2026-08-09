(function(){
  'use strict';

  let pendingAction=null;

  function open({title='Подтвердите действие',message='',confirmText='Продолжить',tone='danger',onConfirm}={}){
    pendingAction=typeof onConfirm==='function'?onConfirm:null;
    document.getElementById('confirmTitle').textContent=title;
    document.getElementById('confirmMessage').textContent=message;
    const button=document.getElementById('confirmAction');
    button.textContent=confirmText;
    button.classList.toggle('btn-danger',tone==='danger');
    button.disabled=false;
    window.FBZOverlay?.open('confirmOv','#confirmAction');
  }

  function close(){
    pendingAction=null;
    window.FBZOverlay?.close('confirmOv');
  }

  async function run(){
    if(!pendingAction)return close();
    const action=pendingAction;
    const button=document.getElementById('confirmAction');
    button.disabled=true;
    try{
      const shouldClose=await action();
      if(shouldClose!==false)close();
    }catch(error){
      console.error('Confirmed action failed:',error);
      button.disabled=false;
    }
  }

  window.FBZConfirm={close,open,run};
})();
