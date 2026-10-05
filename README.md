# Dinliminate

Dinliminate is a phone-first meal and restaurant decision app built around fast, simple elimination.

## Current release

- **Version:** 1.0
- **Build:** 997
- **Checkpoint:** CP997
- **Source:** `main`
- **Release state:** candidate source; production verification is still pending because the connected Vercel account has exhausted its Hobby daily deployment allowance.
- **Photo policy:** restaurant photography uses the no-Google resolver/source ladder.
- **Hosting:** Vercel is the official runtime target; Netlify remains legacy/backup configuration.

## What is active

The deployable app lives at the repository root.

- `index.html` — app shell and screen markup
- `styles.css` — visual/UI system and responsive phone styling
- `app.js` — application runtime
- `sw.js` — PWA service worker and cache management
- `api/` — Vercel serverless routes, including restaurant photography
- `data/` — meal and restaurant taxonomy data
- `qa/` — current release verification and regression checks

The large single-file runtime is intentional for now. Do not split or broadly refactor `app.js` or `styles.css` as part of routine cleanup.

## CP995 highlights

CP996 restores Settings → Tutorial Mode, fixes the Home Tutorial launch wiring, and makes Add to phone, Share, and Tutorial visually consistent while preserving CP995 Tutorial Mode state/navigation.

## Restaurant photo rule

Restaurant cards must not use Google photo/API credentials.

The resolver prefers:
1. official restaurant website/gallery/location page
2. exact public venue page
3. exact OSM/Photon venue imagery
4. tightly validated exact-restaurant search imagery
5. safe restaurant/category fallback

Exact identity validation and cached results protect against wrong-venue photos.

## Recovery strategy

Keep `main` as the current source of truth and preserve these rollback anchors until the current release has been physically verified:

- **CP994** — immediate pre-CP995 tutorial baseline: `435a0312af4f137f58af6d0b4dece1e474907d71`
- **CP957** — protected restaurant-photo baseline: `d03a75ab63f1708524f1406e33d5a09c74f689f4`
- `recovery/cp957-before-restaurant-photo-repair`

Historical checkpoint detail remains available in Git history and preserved branches rather than being repeated in the active README.

## Verification

Repository-level checks should cover JavaScript syntax, release/cache-version consistency, tutorial state hooks, restaurant-photo source policy, and regression-sensitive swipe/navigation invariants.

Real iPhone Safari/PWA checks are still required for touch, GPS, installation, keyboard behavior, image loading, memory, and deployment verification.
