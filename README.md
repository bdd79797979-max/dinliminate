# Dinliminate

Dinliminate is a phone-first dinner decision app built around fast, stable meal and restaurant elimination.

## Current release

- **Version:** 1.0
- **Build:** 910
- **Checkpoint:** CP910
- **Branch:** `main`
- **Release state:** candidate source; Vercel production verification pending the account deployment-rate reset.
- **Architecture:** root-level HTML/CSS/JS PWA with Vercel API routes; Netlify files remain as legacy/backup hosting configuration.

## CP910 — Surgical cleanup

- Removed confirmed unused/no-op runtime variables and the stale CP693 verification marker.
- Simplified Restaurant Search pool construction so fresh provider rows are deduped directly without an always-empty intermediate array.
- Synchronized `index.html`, `app.js`, `sw.js`, and release metadata to build 910.
- Kept the existing single-file runtime architecture intact; no broad refactor or file split was introduced.

## Recent stability fixes

- **CP909:** synchronized runtime entry, service-worker registration, and release metadata; fixed the App Diagnosis undefined-source bug.
- **CP908:** expanded App Diagnosis with interaction-stability checks for search, swipe coaching, wheel repeat spins, restaurant photography, prefetching, and PWA versioning.
- **CP907:** fixed Restaurant Search keyboard Enter/card-flash behavior by keeping typing state-only and preserving the active card while search runs.
- **CP906:** isolated Hungry wheel repeat spins from stale celebration and stop callbacks.
- **CP904:** bounded restaurant photo memory and throttled prefetch to reduce phone memory pressure.
- **CP903:** removed Details-photo source-change flashing through preloaded image swaps.
- **CP902:** corrected Restaurant Search/Cuisine stacking above the restaurant card stage.
- **CP901:** removed swipe-card handoff flashing at completion.

## Project structure

The deployable app lives at the repository root. Key runtime files are:

- `index.html` — app shell and entry points
- `styles.css` — UI system and responsive/iPhone styling
- `app.js` — application runtime
- `sw.js` — PWA service worker/cache
- `api/` — Vercel serverless API routes
- `data/` — meal and restaurant taxonomy data
- `qa/` — retained checkpoint/verification scripts

## Verification

Repository checks for CP910 cover:

- JavaScript syntax and source integrity
- matching 910 asset/cache references
- no confirmed dead cleanup targets
- Restaurant Search preserving the active card during submit/loading
- wheel repeat-spin reset/token isolation
- bounded restaurant-photo caching and throttled prefetch
- release metadata consistency

Physical iPhone Safari/PWA behavior still requires a device run; repository checks cannot certify real touch, keyboard, GPS, install, or memory behavior.

## Deployment

Vercel is the official runtime target. The current connected Vercel account has exhausted its Hobby 24-hour deployment allowance, so the CP910 source is committed to `main` but cannot be newly deployed until that limit resets. Netlify remains available as legacy/backup configuration.
