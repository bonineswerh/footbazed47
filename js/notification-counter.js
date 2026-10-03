(function(){
  'use strict';
  let count=0,version=0,timer=null,pending=false;
  function render(){
    const badge=document.getElementById('notifBadge'),button=document.getElementById('notifBtn');
    if(badge){badge.textContent=count>99?'99+':String(count);badge.classList.toggle('on',count>0);}
    button?.setAttribute('aria-label',count?`Уведомления: ${count} непрочитанных`:'Уведомления');
  }
  function schedule(){clearTimeout(timer);if(CU&&!document.hidden)timer=setTimeout(refresh,60000);}
  function set(value){version++;count=Math.max(0,Number(value)||0);render();schedule();document.dispatchEvent(new CustomEvent('fbz:notification-count',{detail:{count}}));}
  async function refresh(){
    if(!CU||document.hidden||pending)return;
    const user=CU.id,token=version;pending=true;
    try{
      const result=await sb.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user).eq('read',false);
      if(!result.error&&CU?.id===user&&version===token){count=Number(result.count)||0;render();document.dispatchEvent(new CustomEvent('fbz:notification-count',{detail:{count}}));}
    }catch{/* Keep the last confirmed count during a temporary network failure. */}
    finally{pending=false;schedule();if(CU&&version!==token)refresh();}
  }
  function resetSession(){version++;count=0;clearTimeout(timer);render();}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else refresh();});
  window.addEventListener('focus',refresh);
  window.FBZNotificationCounter={refresh,render,set,resetSession};
})();
