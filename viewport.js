// CP1058 — external, CSP-safe iPhone viewport gate.
// Loaded before the main stylesheet so iPhone layout is selected before first paint.
// Laptops retain the centered desktop presentation.
(() => {
  try {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const touch = Number(navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
    const isiPhoneLike = /iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && touch);
    if (!isiPhoneLike) return;
    document.documentElement.classList.add('dinliminate-ios');
  } catch {}
})();
