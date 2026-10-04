## CP906 — Hungry wheel second-spin reset
- Starting a new Hungry wheel spin now clears any previous fireworks/celebration layer.
- The wheel spin token is advanced at spin start so an older stop/finish callback cannot resolve into a later spin.
- Runtime and service-worker asset versioning synchronized to CP906.

## CP904 — Phone freeze / photo-memory stability
- Bounded the in-memory restaurant photo cache to 18 entries and revokes evicted blob URLs; currently visible restaurant photos are protected from eviction.
- Coalesced restaurant photo prefetch work so rapid swipes do not queue a growing set of background image loads.
- Corrected the runtime build marker/cache query to 904 and synchronized release metadata.

## CP903 — Details photo flash fix
- Removed the independent Details photo fade/scale animation; the modal alone handles opening motion.
- Hydrated restaurant/detail photos through a preloaded image before swapping the visible source, preventing a source-change repaint flash.
- Applied the same ready-to-swap behavior to the meal Details gallery.
- Refreshed the service-worker cache and release metadata to CP903.

## CP902 — Restaurant Search/Cuisine stacking fix
- Elevated the Restaurant discovery rail above the card stage so Search, Cuisine, and the expanded search field cannot be painted underneath the card.
- Kept the card geometry unchanged; the fix is isolated to the intended layout stacking hierarchy.
- Refreshed the service-worker shell cache and release metadata to CP902.

## CP901 — eliminate swipe card handoff flash
- Removed the CSS `!important` transform that was overriding the live pointer-driven card transform during active swipes.
- Changed swipe completion so the new card/state renders before the detached outgoing card is reset, eliminating the visible reset frame at handoff.
- Bumped the service-worker shell cache and release metadata to CP901.

# CURRENT RELEASE — BUILD 903 / CP903

## CP900 — Meal Time editing lives with the meal
- Removed the standalone Meal Time management section from Manage Meals.
- Kept Meal Time configuration in the shared saved-data model so the feature remains persistent.
- Moved Meal Time customization directly into Add Meal / Edit Meal.
- The existing Meal Times field remains the primary assignment control for each meal.
- Added an inline **Edit Meal Times** control inside that field.
- Inline editing supports renaming defaults, adding custom Meal Times, reordering, enabling/disabling, and deleting custom Meal Times.
- A newly added Meal Time is immediately selected for the meal being created or edited, so the association is seamless.
- Renaming a Meal Time updates existing meal assignments and the current selection without requiring the user to leave the meal editor.
- The main Meal Times filter automatically uses the same configured active list.
- Styled the inline editor to match the existing Add/Edit Meal controls.
- Release metadata and asset versions are synchronized to CP900.

## Verification
- No standalone Meal Time manager functions or Manage Meals manager CSS remain.
- Meal editor uses the configurable Meal Time catalog.
- Saved Meal Time settings continue to survive reloads.
- At least one Meal Time must remain active and each meal must retain at least one selection.
