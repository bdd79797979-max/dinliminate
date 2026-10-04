# CP958 Recovery — Restaurant Photo First Paint

## Protected baseline
CP957 commit: `d03a75ab63f1708524f1406e33d5a09c74f689f4`

Recovery branch:
`recovery/cp957-before-restaurant-photo-repair`

## CP958 changes
- Restaurant first card is photo-primed before the first deck paint.
- First-card photo priming is capped at 4.5 seconds; failure falls back to the existing trusted restaurant-category artwork.
- The next three Restaurant cards are warmed in parallel.
- The old 450 ms prefetch delay is removed.
- No Google photo API or Google photo credentials were added.
- Existing exact-venue resolver, validation, persistent cache, and wrong-photo protections remain in place.
- App/service-worker cache markers moved from CP957 to CP958.

## Rollback
Move `main` back to the protected CP957 commit if CP958 causes a regression.

## Acceptance target
Restaurant search should present a useful restaurant image immediately, with an exact venue photo already present whenever the permitted resolver can obtain one quickly; otherwise the card keeps a safe restaurant-specific fallback and the resolver can complete in the background.
