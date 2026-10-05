# CURRENT RELEASE — BUILD 999 / CP999

Date: 2026-10-05

## CP999 — Tutorial Engine Stabilization

- Tutorial screen changes now use a token-guarded transition path.
- Old Tutorial bubbles and spotlights are hidden and invalidated before another screen renders.
- Tutorial positioning will not paint a stale bubble onto a different screen.
- Choose button activation records the tutorial action before the normal Choose handler runs.
- The Choose tutorial bubble can advance into the Winner tutorial without recording a fake history entry.
- Winner → Start Over resumes the originating Meals or Restaurant tutorial.
- Meal Times/Cuisine keep-out positioning remains intact.
- Enter Restaurant / Enter Meals cross-path tutorial flow remains intact.
- No restaurant-photo, Family Mode, or normal swipe behavior changes.

## Protected rollback anchors

- **CP998:** `d83d45dcb41f8dae9f8c3c1104aeddd74e24c6cd`
- **CP997:** `ad8e508d87b0852ef4cb56f494c1bff9c9ee3185`
- **CP957 restaurant-photo baseline:** `d03a75ab63f1708524f1406e33d5a09c74f689f4`

Production is not verified until CP999 is deployed and browser/phone runtime certification passes.
