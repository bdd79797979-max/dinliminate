# Dinliminate meal image system

Built-in meal cards store **remote image URLs only**. Dinliminate does not bundle meal JPEG/PNG/WebP files or copy built-in meal images into IndexedDB.

## Runtime flow

1. The catalog supplies the primary URL and, when available, an exact same-meal backup URL.
2. Built-in meal images go through `/api/image?meal=1`.
3. The meal proxy follows only safe HTTPS redirects and validates the final image host.
4. The service worker does **not** put meal-image responses into the app-controlled Cache Storage image cache.
5. The swipe deck preloads the next three meal cards; this is an in-memory/browser fetch optimization, not an app-owned meal-image database.
6. A failed primary uses only an exact backup. There is no generic category fallback for built-in meal cards.

## Verification

`npm run audit:meal-images` checks all 117 built-in meals for working remote image URLs, allowed final hosts, image content, and usable dimensions.

`npm run audit:meal-images:two` additionally makes the build fail until every meal has at least two distinct remote image candidates.

The automated audit verifies **image availability and technical validity**, not whether a human would judge the photograph semantically accurate to the meal name. That accuracy review remains a separate content QA step.
