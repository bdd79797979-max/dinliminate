# CURRENT RELEASE — BUILD 1008 / CP1008

Date: 2026-10-05

## CP1008 — Managed Meal + Restaurant Image Cache

- Image caching is now size-managed rather than unlimited.
- The shared image cache has a **75 MiB upper budget** and trims back to **60 MiB** when the budget is exceeded.
- Least-recently-used images are evicted first, so frequently viewed meal and restaurant photos stay available longer.
- Cache usage metadata is persisted in IndexedDB and reconciled on service-worker activation.
- Oversized single image responses are not admitted when they exceed the cache budget.
- The existing image cache name is retained so the change does not intentionally throw away the current photo working set.
- The shell/data/restaurant behavior is otherwise unchanged.

## Recovery anchors

- **CP1007:** `00e7ebed09ed0558853d1b7fcb8f872866cf7038`
- **CP1006:** `a2d3fc659cafc699aa27db817f29d676a8db5b86`
- **CP1005:** `3dd492653be3bfa620229df6d16bbbcb8fb036f3`

Production remains unverified because the current Vercel deployment limit is exhausted.
