(function(){
  'use strict';
  let count=0,version=0,timer=null,pending=false,userId=null;
  function render(){
    const badge=document.getElementById('notifBadge'),button=document.getElementById('notifBtn');
    if(badge){badge.textContent=count>99?'99+':String(count);badge.classList.toggle('on',count>0);}
    button?.setAttribute('aria-label',count?`Уведомления: ${FBZDomain.countLabel(count,{one:'непрочитанное',few:'непрочитанных',many:'непрочитанных'})}`:'Уведомления');
  }
  function schedule(){clearTimeout(timer);if(userId&&!document.hidden)timer=setTimeout(refresh,60000);}
  function set(value){version++;count=Math.max(0,Number(value)||0);render();schedule();document.dispatchEvent(new CustomEvent('fbz:notification-count',{detail:{count}}));}
  async function refresh(){
    if(!userId||document.hidden||pending)return;
    const user=userId,token=version;pending=true;
    try{
      const result=await sb.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user).eq('read',false);
      if(!result.error&&userId===user&&version===token){count=Number(result.count)||0;render();document.dispatchEvent(new CustomEvent('fbz:notification-count',{detail:{count}}));}
    }catch{/* Keep the last confirmed count during a temporary network failure. */}
    finally{pending=false;schedule();if(userId&&version!==token)refresh();}
  }
  function resetSession(){userId=null;version++;count=0;clearTimeout(timer);render();}
  function syncSession(id){if(userId===id)return;resetSession();userId=id||null;schedule();}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else refresh();});
  window.addEventListener('focus',refresh);
  window.FBZNotificationCounter={refresh,render,set,resetSession,syncSession};
})();
