# CURRENT SAVEPOINT — BUILD 1006 / CP1006

Date: 2026-10-05

Working branch: `cp1006-full-iphone-viewport-fix`

## CP1006 — Full iPhone Viewport Fix

- Definitive mobile shell fix for full-width/full-height iPhone viewport use.
- Safe-area inset is internal to the top bar; the app no longer carries legacy outer mobile padding.
- Existing screen designs are intentionally unchanged.
- Asset/service-worker versions are bumped to force the corrected shell onto phone/PWA clients.

## Recovery anchor

- **CP1005:** `3dd492653be3bfa620229df6d16bbbcb8fb036f3`
