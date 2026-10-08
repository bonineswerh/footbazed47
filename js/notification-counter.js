(function(){
  'use strict';
  let count=0,version=0,timer=null,active=null,userId=null,fast=false;
  function render(){
    const badge=document.getElementById('notifBadge'),button=document.getElementById('notifBtn');
    if(badge){badge.textContent=count>99?'99+':String(count);badge.classList.toggle('on',count>0);}
    button?.setAttribute('aria-label',count?`Уведомления: ${FBZDomain.countLabel(count,{one:'непрочитанное',few:'непрочитанных',many:'непрочитанных'})}`:'Уведомления');
  }
  function schedule(){clearTimeout(timer);if(userId&&!document.hidden)timer=setTimeout(refresh,fast?15000:30000);}
  function cancel(){active?.abort();active=null;}
  function set(value){version++;cancel();count=Math.max(0,Number(value)||0);render();schedule();document.dispatchEvent(new CustomEvent('fbz:notification-count',{detail:{count}}));}
  async function refresh(){
    if(!userId||document.hidden||active)return;
    const user=userId,token=version,controller=new AbortController();active=controller;
    const timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const result=await sb.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user).eq('read',false).abortSignal(controller.signal);
      if(!result.error&&!controller.signal.aborted&&userId===user&&version===token){count=Number(result.count)||0;render();document.dispatchEvent(new CustomEvent('fbz:notification-count',{detail:{count}}));}
    }catch{/* Keep the last confirmed count during a temporary network failure. */}
    finally{clearTimeout(timeout);if(active===controller){active=null;schedule();}}
  }
  function resetSession(){userId=null;version++;cancel();fast=false;count=0;clearTimeout(timer);render();}
  function syncSession(id){if(userId===id)return;resetSession();userId=id||null;schedule();}
  function setFastPolling(value){fast=Boolean(value);schedule();}
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();clearTimeout(timer);}else refresh();});
  window.addEventListener('focus',refresh);
  window.FBZNotificationCounter={refresh,render,set,resetSession,syncSession,setFastPolling};
})();
