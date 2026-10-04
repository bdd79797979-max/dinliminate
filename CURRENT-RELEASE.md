# CURRENT RELEASE — BUILD 916 / CP916

## CP916 — Meal swipe iPhone hardening
- Corrected CP915 scope: Restaurant swipe behavior remains unchanged.
- Reverted the unnecessary Home-card gesture handling change.
- Hardened only the Meal swipe card’s iPhone compositor path by removing paint containment during transforms and enabling backface stability.
- Preserved Meal Cut/Maybe swipe logic, thresholds, controls, and multi-photo behavior.

## CP915 — iPhone Home card gesture hardening
- Removed the Home choice cards from generic touch manipulation behavior.
- Home cards now allow vertical page movement while blocking horizontal overscroll.
- Press feedback cancels once a real finger move begins, preventing the card from visually sticking, shifting, or fighting iPhone swipe gestures.
- Preserved the existing tap actions for AT HOME and RESTAURANT.

## CP914 — Premium Home choice photography
- Replaced the Home AT HOME and RESTAURANT card photography with stronger, more luxurious Pexels imagery selected for the existing wide mobile card crop.
- Preserved the existing card IDs, layout, overlays, labels, and interactions.
- Bumped the service-worker shell cache so the new Home photography is picked up after the next deployment.

## CP913 — Luxury Home utility controls
- Elevated the Home Add to phone and Share app controls with a discreet concierge-style metallic-gold finish, improved depth, brushed-gold edge detailing, and refined typography.
- Preserved the existing actions, IDs, hit targets, and interaction routing.

## CP912 — Startup syntax repair + luxury metallic-gold brand polish
- Replaced the canonical Dinliminate wordmark treatment with a restrained polished-metal gold finish.
- Applied the same identity consistently across Home, Meals, Restaurants, Family, Winner, and the navigation drawer.
- Preserved the existing wordmark structure, sizing, responsive layout, and animation architecture.
- Updated the shell cache/style query and release metadata to build 911.
- Refreshed the SVG app mark with the same dimensional metallic-gold direction.
- Refreshed the raster PWA icons to match the metallic-gold app identity.
- Repaired the CP900 Meal Time editor parser failure in `app.js`, which was preventing the entire client runtime from initializing.
- Updated the JavaScript fallback build marker and PWA shell asset versions to 912 so browsers request the corrected runtime.

## CP910 — Surgical cleanup and runtime synchronization
- Removed confirmed dead/no-op runtime fragments without changing the application architecture.
- Simplified the fresh restaurant result pool construction by removing the always-empty previous-row array.
- Synchronized HTML, runtime, service-worker shell, and release metadata to build 910.
- Refreshed README recovery/release documentation to the current main branch.

## CP909 — Runtime entry / PWA version synchronization
- Synchronized the HTML, app runtime, service-worker registration, and release metadata to the same build.
- Fixed App Diagnosis so its interaction checks no longer reference an undefined source variable.
- The new service-worker shell version forces phones/PWAs off the mixed 900/907/908 asset chain that could leave stale runtime code running.

## CP908 — App Diagnosis expansion
- Added Interaction Stability diagnostics for Restaurant Search keyboard Enter, search card preservation, Swipe/Cut/Maybe lesson placement, Hungry wheel repeat-spin isolation, restaurant-photo memory/flash protection, photo prefetch throttling, and PWA runtime versioning.
- Diagnosis now flags the exact client-side regressions that were identified from recent iPhone testing instead of treating them only as manual checks.
- Release metadata and service-worker/app asset versions synchronized to CP908.

## CP907 — Restaurant search keyboard submit stability
- Enter/search now reads the current field value directly and performs one submit without an extra card redraw.
- Restaurant search typing no longer redraws the active card on every keystroke; provider search remains debounced.
- Search keeps the existing card visible while results are loading instead of clearing the card stage first.
- Search errors now preserve the current card rather than wiping the restaurant pool.

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

# CURRENT RELEASE — BUILD 910 / CP910

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
