# CURRENT RELEASE — BUILD 864 / CP864

## Meal multi-photo viewing
- Preserves the existing multi-upload/storage system of up to 8 photos per meal.
- The Meal card now visibly shows a compact photo count when multiple photos exist.
- Tapping the card photo cycles through the uploaded photos without triggering Cut or Maybe.
- IndexedDB-backed meal photos are resolved for the card instead of silently falling back to generic category art.
- Meal Details now provides Previous / Next controls for the complete uploaded photo set.
- Photo position is transient and is not persisted as meal data.
- Cache identity advanced to v864.

## Verification gate
Upload 3 photos → save → reopen → verify all 3 remain → card shows 1 / 3 → tap photo → 2 / 3 → Details shows the same complete set.
