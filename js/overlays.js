(function(){
  'use strict';

  let activeOverlay=null;
  let returnFocus=null;

  function focusableElements(overlay){
    return [...overlay.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')]
      .filter(el=>!el.hidden&&el.offsetParent!==null);
  }

  function open(id,focusSelector){
    const overlay=document.getElementById(id);
    if(!overlay)return;
    returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    if(activeOverlay&&activeOverlay!==overlay)close(activeOverlay.id,false);
    activeOverlay=overlay;
    overlay.classList.add('on');
    overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
    requestAnimationFrame(()=>setTimeout(()=>{
      if(activeOverlay!==overlay)return;
      const target=(focusSelector&&overlay.querySelector(focusSelector))||focusableElements(overlay)[0]||overlay;
      target.focus({preventScroll:true});
    },30));
  }

  function close(id,restoreFocus=true){
    const overlay=typeof id==='string'?document.getElementById(id):id;
    if(!overlay)return;
    overlay.classList.remove('on');
    overlay.setAttribute('aria-hidden','true');
    if(activeOverlay===overlay)activeOverlay=null;
    document.body.classList.remove('modal-open');
    if(restoreFocus&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
    returnFocus=null;
  }

  document.addEventListener('keydown',event=>{
    if(!activeOverlay)return;
    if(event.key==='Escape'){
      event.preventDefault();
      close(activeOverlay.id);
      return;
    }
    if(event.key!=='Tab')return;
    const items=focusableElements(activeOverlay);
    if(!items.length){event.preventDefault();activeOverlay.focus();return;}
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });

  document.addEventListener('click',event=>{
    if(event.target===activeOverlay&&activeOverlay?.dataset.closeBackdrop==='true')close(activeOverlay.id);
  });

  window.FBZOverlay={open,close};
})();
