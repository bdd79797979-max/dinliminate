/* Dinliminate early boot: parser-blocking before first paint. */
try {
  const standalone = !!window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) document.documentElement.classList.add('dinliminate-standalone');
} catch(error){console.error('Dinliminate error',error)}
(() => {
  const root = document.documentElement;
  const hideForNavigation = () => {
    try { root.classList.add('dinliminate-page-unloading'); } catch(error){console.error('Dinliminate error',error)}
  };
  try { root.classList.add('dinliminate-booting'); } catch(error){console.error('Dinliminate error',error)}
  window.addEventListener('beforeunload', hideForNavigation, {capture:true});
  window.addEventListener('pagehide', hideForNavigation, {capture:true});
  window.addEventListener('pageshow', () => {
    try { root.classList.remove('dinliminate-page-unloading'); } catch(error){console.error('Dinliminate error',error)}
  }, {capture:true});
})();
try {
  const startRoute=String(localStorage.getItem('dinliminate:v1')||'').trim();
  let savedRoute='';
  try{
    const saved=JSON.parse(localStorage.getItem('dinliminate:v1')||'null');
    savedRoute=String(saved?.screen||'').trim();
  }catch(error){console.error('Dinliminate error',error)}
  const route=(['food','restaurant','winner','family'].includes(startRoute)
    ? startRoute
    : (['food','restaurant','winner','family'].includes(savedRoute)?savedRoute:'home'));
  if(route!=='home')document.documentElement.classList.add('dinliminate-start-'+route);
} catch(error){console.error('Dinliminate error',error)}
