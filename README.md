# Dinliminate

Dinliminate is a phone-first meal and restaurant decision app built around fast, simple elimination.

## Current release

- **Version:** 1.0
- **Build metadata:** `app-release.json`
- **Source:** `main`
- **Release state:** candidate source; production verification is still pending because the connected Vercel account has exhausted its Hobby daily deployment allowance.
- **Photo policy:** Google Places photos are allowed and preferred when they pass exact restaurant identity validation; official restaurant, exact venue, OSM, and other validated sources remain fallbacks.
- **Hosting:** Vercel is the official runtime target.

## What is active

The deployable app lives at the repository root.

- `index.html` — app shell and screen markup
- `styles.css` — visual/UI system and responsive phone styling
- `app.js` — application runtime
- `sw.js` — PWA service worker and cache management
- `api/` — Vercel serverless routes, including restaurant photography
- `data/` — meal and restaurant taxonomy data
- `tests/` — release, API, and browser behavior verification

## Restaurant photo rule

Google Places restaurant photos are intentionally supported.

The resolver prefers an existing verified/cached photo first, then uses Google Places when the restaurant identity matches by name, address, and location. It then falls back through official restaurant sources, exact public venue pages, OSM/Photon imagery, and tightly validated exact-restaurant search imagery.

Google Places usage is protected by a durable Neon-backed SKU budget tracker and monthly hard stops. Google media is not persisted as an app-owned photo cache.

## Restaurant website discovery

Website discovery does not scrape Google search-result HTML. It uses deterministic domain candidates plus Bing and DuckDuckGo result pages, followed by restaurant identity verification.

## Recovery strategy

Keep `main` as the current source of truth. Historical recovery anchors remain available through Git history and preserved history; active documentation does not depend on a retired branch name.

## Verification

Repository-level CI covers JavaScript syntax, release/cache-version consistency, deterministic API contracts, and end-to-end behavior in mobile Chromium and WebKit.

Real iPhone Safari/PWA checks are still required for touch, GPS, installation, keyboard behavior, image loading, memory, and deployment verification.

## Refactoring policy

The runtime may be reorganized as needed. Keep behavior stable unless a task explicitly changes it; prefer moving code before improving it.
