(function(){
  'use strict';

  let pendingAction=null;
  let running=false;

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
    if(running)return;
    if(!pendingAction)return close();
    const action=pendingAction;
    const button=document.getElementById('confirmAction');
    button.disabled=true;
    running=true;
    try{
      const shouldClose=await action();
      if(pendingAction===action&&shouldClose!==false)close();
    }catch(error){
      console.error('Confirmed action failed:',error);
      if(pendingAction===action)window.toast?.('Не удалось выполнить действие. Попробуйте ещё раз.','err');
    }finally{
      running=false;
      if(pendingAction===action)button.disabled=false;
    }
  }

  document.getElementById('confirmOv')?.addEventListener('fbz:overlay-close',()=>{pendingAction=null;});

  window.FBZConfirm={close,open,run};
})();
