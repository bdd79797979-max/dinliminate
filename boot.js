/* Dinliminate early boot: parser-blocking before first paint. */
try {
  const standalone = !!window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) document.documentElement.classList.add('dinliminate-standalone');
} catch {}
(() => {
  const root = document.documentElement;
  const hideForNavigation = () => {
    try { root.classList.add('dinliminate-page-unloading'); } catch {}
  };
  try { root.classList.add('dinliminate-booting'); } catch {}
  window.addEventListener('beforeunload', hideForNavigation, {capture:true});
  window.addEventListener('pagehide', hideForNavigation, {capture:true});
  window.addEventListener('pageshow', () => {
    try { root.classList.remove('dinliminate-page-unloading'); } catch {}
  }, {capture:true});
})();
try {
  const startRoute=String(localStorage.getItem('dinliminate.start-screen')||'').trim();
  let savedRoute='';
  try{
    const saved=JSON.parse(localStorage.getItem('dinliminate.clean.cp1')||'null');
    savedRoute=String(saved?.screen||'').trim();
  }catch{}
  const route=(['food','restaurant','winner','family'].includes(startRoute)
    ? startRoute
    : (['food','restaurant','winner','family'].includes(savedRoute)?savedRoute:'home'));
  if(route!=='home')document.documentElement.classList.add('dinliminate-start-'+route);
} catch {}
