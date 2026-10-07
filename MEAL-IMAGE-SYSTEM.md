# Dinliminate meal image system

Built-in meal cards store remote image URLs only. Dinliminate does not bundle built-in meal JPEG/PNG/WebP files or copy built-in meal images into IndexedDB.

## Runtime flow

1. The catalog supplies the preferred official URL when available, the primary meal URL, an exact same-meal backup URL, and optional additional meal photo URLs.
2. Built-in meal images go through `/api/image?meal=1`.
3. The meal proxy follows only safe HTTPS redirects and validates the final image host.
4. The service worker keeps the built-in meal fallback asset available in the app shell, but meal proxy responses are not put into the app-controlled image cache.
5. The swipe deck preloads the next three meal cards as an optimization. Preloading is never a swipe dependency.
6. Every visible meal card renders immediately with `fallback-food.svg` as its emergency image. The real photo is then loaded asynchronously and replaces the emergency image when ready.
7. A failed primary uses only an exact backup. If both real candidates fail or are unavailable, the emergency Dinliminate food image remains visible. The meal is never removed from the deck because of image failure.
8. Each card load carries a meal-generation token so a late response for an old meal cannot overwrite a recycled card.

## Verification

`npm run audit:meal-images` checks all 117 built-in meals for working remote image URLs, allowed final hosts, image content, and usable dimensions.

`npm run audit:meal-images:two` additionally makes the build fail until every meal has at least two distinct remote image candidates.

The automated audit verifies image availability and technical validity, not whether a human would judge the photograph semantically accurate to the meal name. That accuracy review remains a separate content QA step.

## Deck guarantee

The active meal swipe is never blocked waiting for a remote photo. A slow or failed image can therefore never freeze the deck, while every catalog meal remains available to the user.
