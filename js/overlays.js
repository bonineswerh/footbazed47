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
    if(activeOverlay===overlay)return;
    const previousFocus=activeOverlay?returnFocus:document.activeElement;
    if(activeOverlay)close(activeOverlay.id,false);
    returnFocus=previousFocus instanceof HTMLElement?previousFocus:null;
    activeOverlay=overlay;
    overlay.classList.add('on');
    overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
    requestAnimationFrame(()=>setTimeout(()=>{
      if(activeOverlay!==overlay||overlay.contains(document.activeElement))return;
      const target=(focusSelector&&overlay.querySelector(focusSelector))||focusableElements(overlay)[0]||overlay;
      target.focus({preventScroll:true});
    },30));
  }

  function close(id,restoreFocus=true){
    const overlay=typeof id==='string'?document.getElementById(id):id;
    if(!overlay||!overlay.classList.contains('on'))return;
    const wasActive=activeOverlay===overlay;
    overlay.classList.remove('on');
    overlay.setAttribute('aria-hidden','true');
    if(wasActive)activeOverlay=null;
    document.body.classList.toggle('modal-open',Boolean(activeOverlay));
    if(wasActive){
      if(restoreFocus&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
      returnFocus=null;
    }
    overlay.dispatchEvent(new CustomEvent('fbz:overlay-close',{bubbles:true}));
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
