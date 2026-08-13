(function(){
  'use strict';

  let open = false;

  function elements(){
    return {
      button: document.getElementById('accountBtn'),
      menu: document.getElementById('accountMenu')
    };
  }

  function setOpen(next, focusMenu = false){
    const {button, menu} = elements();
    open = Boolean(next && button && menu);
    if (!button || !menu) return;
    button.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('on', open);
    menu.setAttribute('aria-hidden', String(!open));
    if (open && focusMenu) {
      requestAnimationFrame(() => elements().menu?.querySelector('[role="menuitem"]')?.focus());
    }
  }

  function toggle(){
    setOpen(!open, !open);
  }

  function close({returnFocus = false} = {}){
    const {button} = elements();
    setOpen(false);
    if (returnFocus) button?.focus();
  }

  document.addEventListener('click', event => {
    if (!open || event.target.closest('#accountMenu') || event.target.closest('#accountBtn')) return;
    close();
  });

  document.addEventListener('keydown', event => {
    if (!open) return;
    const {menu} = elements();
    if (event.key === 'Escape') {
      event.preventDefault();
      close({returnFocus:true});
      return;
    }
    if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    const items = [...(menu?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (current + 1 + items.length) % items.length
      : (current - 1 + items.length) % items.length;
    items[next].focus();
  });

  window.FBZAccount = {toggle, close};
  window.toggleAccountMenu = toggle;
})();
