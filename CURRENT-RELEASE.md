# CURRENT RELEASE — BUILD 1010 / CP1010

Date: 2026-10-05

## CP1010 — Device-aware full iPhone viewport

The laptop presentation remains intentionally centered with desktop side bands. Phone/touch layouts now use the full viewport.

### Why the earlier pass was insufficient

- CP1006/CP1008 keyed the shell only to `@media (max-width:600px)`.
- CSS width media features detect the browser's layout viewport, not the physical device. A phone can be presented with a wider layout viewport in some browser modes.
- The Home door background lives on `.app`, so any remaining desktop-width `max-width` on the app directly creates side bands on a phone.
- The service-worker registration previously had a race because `APP_BUILD` started at an older fallback while `app-release.json` was fetched asynchronously.

### CP1010 behavior

- Desktop/laptop: existing centered/max-width presentation remains.
- Phone: `max-width:600px` still activates the mobile shell.
- Touch/mobile environment with a wider layout viewport: `hover:none + pointer:coarse + max-width:1024px` also activates the same shell.
- The app and active screens occupy `100vw × 100dvh`.
- The Home door canvas reaches the phone edges.
- Meals, Restaurants, Winner, Family, and Menu interiors are not redesigned; only the outer viewport shell is adapted.
- Service-worker registration now starts from the current build fallback so an old worker version cannot be selected by a first-load race.

### Recovery anchors

- **CP1009:** `f06e1ba973c45fa8021f87ed52a049c2998f3211`
- **CP1008:** `c372191320df07db864508783ccc7dfa521e4aa3`
- **CP1007:** `00e7ebed09ed0558853d1b7fcb8f872866cf7038`
- **CP1006:** `a2d3fc659cafc699aa27db817f29d676a8db5b86`

Physical iPhone verification remains the final gate; laptop-side bands are expected and are not a failure.
