// CP1059 — deterministic iPhone/iPad viewport gate, CSP-safe.
// Loaded before the main stylesheet so the phone shell is selected before first paint.
// Do not rely on the layout viewport width: iPhone "Request Desktop Website"
// can report a desktop-sized CSS viewport while the physical screen is still small.
(() => {
  try {
    const root = document.documentElement;
    const ua = String(navigator.userAgent || '');
    const platform = String(navigator.platform || '');
    const touchPoints = Number(navigator.maxTouchPoints || 0);
    const touch = touchPoints > 0 || 'ontouchstart' in window;

    const screenW = Number(window.screen && window.screen.width || 0);
    const screenH = Number(window.screen && window.screen.height || 0);
    const physicalShort = Math.min(screenW || Infinity, screenH || Infinity);
    const physicalLong = Math.max(screenW || 0, screenH || 0);

    const uaPhone = /iPhone|iPod/i.test(ua);
    const uaTablet = /iPad/i.test(ua) || (platform === 'MacIntel' && touch);
    const smallTouchScreen = touch && physicalShort <= 600 && physicalLong <= 1400;

    if (uaPhone || uaTablet || smallTouchScreen) {
      root.classList.add('dinliminate-ios');
    }
  } catch {}
})();
