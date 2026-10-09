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
  window.setTimeout(() => {
    if (root.classList.contains('dinliminate-ready')) return;
    const message = document.createElement('button');
    message.id = 'dinliminateBootFailure';
    message.type = 'button';
    message.textContent = 'Dinliminate failed to start, tap to reload';
    Object.assign(message.style, {
      position: 'fixed', inset: 'auto 16px 16px', zIndex: '2147483647',
      display: 'block', maxWidth: 'calc(100vw - 32px)', margin: '0 auto',
      padding: '16px 18px', border: '1px solid #c6a46a', borderRadius: '12px',
      background: '#171512', color: '#f5f1e8', font: '600 14px/1.4 system-ui, sans-serif',
      textAlign: 'center', cursor: 'pointer', boxShadow: '0 8px 28px rgba(0,0,0,.5)'
    });
    message.addEventListener('click', () => window.location.reload());
    (document.body || document.documentElement).appendChild(message);
    root.classList.remove('dinliminate-booting');
    console.error('Dinliminate failed to start: dinliminate-ready was not set within 6000ms');
  }, 6000);
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
