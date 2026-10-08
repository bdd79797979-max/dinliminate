// CP1063 — visual viewport fallback.
// Safari can expose a desktop-sized layout viewport when desktop-site mode is
// enabled on iPhone/iPad. visualViewport.width tracks the visible canvas instead.
// This class is only a presentation hook; app behavior is unchanged.
(() => {
  try {
    const root = document.documentElement;
    const readWidth = () => {
      const vv = window.visualViewport;
      return Number(vv?.width || window.innerWidth || 0);
    };
    const update = () => {
      const visualWidth = readWidth();
      const isVisualMobile = visualWidth > 0 && visualWidth <= 1100;
      root.classList.toggle('dinliminate-visual-mobile', isVisualMobile);
    };

    update();
    window.addEventListener('resize', update, {passive:true});
    window.visualViewport?.addEventListener('resize', update, {passive:true});
  } catch(error){console.error('Dinliminate error',error)}
})();
