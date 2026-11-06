// A disclosure in normal document flow keeps every destination reachable on small screens.
export function setupMobileNavigation(doc, isMobile = () => matchMedia('(max-width: 850px)').matches) {
 const menu = doc.querySelector('[data-menu]');
 const sidebar = doc.querySelector('#navigation-panel');
 const close = restoreFocus => {
  const wasOpen = sidebar.classList.contains('is-open');
  sidebar.classList.remove('is-open');
  menu.setAttribute('aria-expanded', 'false');
  if (restoreFocus && wasOpen) menu.focus();
 };
 const onKeydown = e => {
  if (e.key === 'Escape' && isMobile() && sidebar.classList.contains('is-open')) {
   e.preventDefault();
   close(true);
  }
 };
 const onClick = e => {
  if (e.target.closest('[data-menu]')) {
   const open = sidebar.classList.toggle('is-open');
   menu.setAttribute('aria-expanded', String(open));
   if (open) sidebar.querySelector('.nav-link.active')?.focus();
   return;
  }
  if (e.target.closest('#navigation-panel a') && isMobile()) {
   close(false);
   doc.querySelector('#main').focus({preventScroll:true});
  }
 };
 doc.addEventListener('keydown', onKeydown);
 doc.addEventListener('click', onClick);
 return () => {
  doc.removeEventListener('keydown', onKeydown);
  doc.removeEventListener('click', onClick);
 };
}
