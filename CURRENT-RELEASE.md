# CURRENT RELEASE — BUILD 868 / CP868

## CP868 — Uniform meal photo navigation
- The meal card's photo count is now the only control for advancing through multiple photos.
- Tapping the photo itself no longer changes photos.
- Meal Details uses the same top-right photo-count control for the same interaction.
- Removed the Previous / Next arrows from the Details gallery.
- Card swiping remains reserved for CUT / MAYBE; the photo-count control is excluded from swipe capture.
- The first ordered photo remains the Cover photo from CP867.

## Verification
- app.js parse: PASS
- sw.js parse: PASS
- Card photo itself: non-navigating
- Card top-right count: advances photo
- Details top-right count: advances photo
- Details arrows: removed
- App/cache version synchronized to v868
