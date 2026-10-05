# CURRENT RELEASE — BUILD 1009 / CP1009

Date: 2026-10-05

## CP1009 — True Full iPhone Viewport Shell

- The mobile app shell is pinned directly to the live viewport.
- The active Home, Meals, Restaurants, Winner, and Family screens now own the full viewport instead of relying on document-flow height.
- The Home top bar overlays the full-screen Home canvas, so the supplied door background can extend behind it.
- Existing interior screen geometry is preserved; this is a shell/viewport adaptation, not a redesign of Meals, Restaurants, Winner, or Menu.
- Mobile horizontal overflow is locked at the shell level while scrollable supporting screens retain vertical scrolling.
- Asset versions are bumped to prevent phones from retaining the earlier viewport CSS.

## Recovery anchors

- **CP1008:** `c372191320df07db864508783ccc7dfa521e4aa3`
- **CP1007:** `00e7ebed09ed0558853d1b7fcb8f872866cf7038`
- **CP1006:** `a2d3fc659cafc699aa27db817f29d676a8db5b86`

Production verification will follow the new deployment.
