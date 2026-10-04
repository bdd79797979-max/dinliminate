# CURRENT RELEASE — BUILD 934 / CP934

## CP934 — Restaurant Search field correction
- Corrected the Restaurant Search input box so its border, field surface, and text remain fully visible on iPhone Safari.
- Replaced the conflicting older narrow-height rule with one stable box-sized input height.
- Preserved Restaurant Search behavior, keyboard submit, Cuisine controls, and card geometry.


## CP933 — Maximize Meals + Restaurant decision cards
- Made the Meal and Restaurant card stages flex to the exact space between their top controls and bottom swipe controls on phone widths.
- Removed the fixed mobile card height caps so short/tall iPhones and expanded discovery rails adapt naturally.
- Maximized card width with a controlled phone-safe negative gutter while preventing horizontal page overflow.
- Preserved card content, swipe behavior, Restaurant search/Cuisine layers, and the CP932 Menu-lines-only treatment.


## CP932 — Menu lines only
- Removed the remaining decorative box/enclosure around the Menu control.
- Menu now presents only the three metallic-gold lines while retaining its full invisible touch target and far-right placement.


## CP931 — Restaurant iPhone fit pass
- Hardened the Restaurant location row for narrow phones through 340px widths without changing its control order or behavior.
- Shrunk the final narrow-phone location controls and kept Radius compact and directly before the far-right Menu.
- Prevented Restaurant address/search focus from triggering Safari auto-zoom by using a 16px input font on phone widths while preserving compact control heights.
- Kept the Restaurant discovery row, search/cuisine controls, Maybe control, count, card geometry, and swipe behavior intact.


## CP930 — iPhone Meals layout hardening
- Hardened the Meals top navigation for narrow phone widths so Meal Times, Cuisine, All Maybes/count, and Menu remain on one line.
- Fixed Cuisine state binding after moving its control from the lower discovery row into the Meals top navigation.
- Preserved the existing Meal Times rail, Cuisine rail, Maybe deck, Menu action, and Meal swipe behavior.


## CP929 — Meals top navigation
- Moved Meal Times and Cuisine into the Meals top navigation row.
- Meals now reads left-to-right: Meal Times · Cuisine · All Maybes count · Menu.
- Kept the existing Meal Times/Cuisine rails, Maybe toggle, Menu action, and runtime handlers intact.
- Corrected the Meals Maybe renderer so the live Maybe count remains visible instead of being overwritten by the Restaurant-style ALL/MAYBES markup.
- Preserved CP928 Restaurant Radius/Menu sizing and CP926 Meal swipe stability.


## CP928 — tighter Radius + smaller interior Menu
- Shrunk the interior metallic-gold Menu control on Meals and Restaurant screens while preserving its far-right placement and touch target.
- Reduced the Restaurant Radius footprint so the value sits closer to Refresh and leaves a cleaner far-right Menu position.
- Preserved the Restaurant location row order, address field, search behavior, and Radius functionality.
- Preserved CP927 headerless navigation and CP926 Meal swipe stability.

## CP927 — headerless luxury interior navigation
- Removed the repeated Dinliminate wordmark and persistent top Back arrow from the main interior screens; the Front Page remains the branded entrance.
- Replaced Meals, Family, and Winner top chrome with a compact interior navigation row and far-right polished metallic-gold Menu control.
- Moved the Meals All/Maybes control into the centered top row and added its live Maybe count.
- Rebuilt the Restaurant location row as one line: Current Location, Enter Address, Refresh, Radius, Menu.
- Preserved the existing Restaurant minimalist controls, hidden status row, search behavior, and radius selector.
- Reclaimed the removed header height so Meal and Restaurant cards can grow vertically on iPhone without changing swipe logic.
- Kept CP926 Meal swipe image handoff hardening and Restaurant swipe behavior intact.

## CP926 — Meal swipe image handoff
- Fixed the Meal-only swipe flashback by waiting for the incoming meal image to load/decode before restoring the card after a committed swipe.
- Removed the earlier Meal compositor containment rule and retained only backface stability.
- Restaurant swipe behavior is unchanged.

## CP925 — Swipe direction positioning
- Moved the Meal and Restaurant CUT / SWIPE / MAYBE guidance out of the card and anchored it to the shared swipe-control rail.
- The guidance now sits just above the bottom swipe controls on both screens.
- Preserved Meal swipe logic, Restaurant swipe behavior, and all decision controls.

## CP924 — Consolidated Home + Restaurant polish pass
- Synchronized the HTML shell, JavaScript, stylesheet, service-worker cache, and release metadata to one release version.
- Preserved the luxury Home photography and utility controls.
- Preserved the Meal-only swipe hardening; Restaurant swipe behavior remains unchanged.
- Preserved the minimalist Restaurant location row: no enclosing container, no control pills, no Radius chevron, and no visible status row.
- Preserved guaranteed-first Restaurant photography with asynchronous verified venue-photo replacement.
- Preserved the quiet Restaurant Refresh busy state.

## CP923 — Reclaim Restaurant location space
- Removed the visible informational status row below the Restaurant location controls so it no longer consumes vertical space.
- Kept status messaging available to assistive technology without reserving layout space.
- Tightened the location strip and removed extra top spacing so the Search/Cuisine controls and Restaurant card move upward beneath the location row.

## CP922 — Quiet Restaurant Refresh busy state
- Removed the bright/white busy-state ring and focus chrome from Restaurant Refresh.
- Busy searching now uses a subtle muted-gold spinner with no surrounding box or outline.
- Preserved Refresh behavior and the minimalist location row.

## CP921 — Remove Restaurant location container
- Removed the large enclosing black container around Current Location, Address, Refresh/Search, and Radius.
- Kept the address field as the only subtle surfaced input; location/search controls remain minimalist and functional.
- Preserved the existing Restaurant layout, search behavior, radius selection, and swipe interaction.

## CP920 — Final minimalist Radius treatment
- Removed the remaining gold border/box around Radius.
- Removed native white focus/selection chrome from the Radius dropdown.
- Kept Radius as a quiet text-only selector with its existing values and functionality.

## CP919 — Minimal Restaurant location controls
- Removed the circular/pill chrome from Current Location and Refresh while preserving their full tap targets and actions.
- Removed the Radius chevron; Radius remains a text-only selector.
- Preserved the Restaurant location row, search behavior, and existing functionality.

## CP918 — Remove Radius pill
- Removed the rounded pill container around the Restaurant Radius selector.
- Kept the existing radius values, selector behavior, chevron, and location-row layout intact.
- Restyled Radius as a quiet text control to better match the premium Restaurant interface.

## CP917 — Restaurant photo first-render hardening
- Restaurant cards now start with a guaranteed proxied restaurant-category image instead of an unverified raw venue URL.
- The verified restaurant-photo resolver still runs immediately afterward and replaces the fallback when a venue-specific image is found.
- Preserved Restaurant swipe behavior and card layout.

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

## Historical release notes — CP910 and earlier

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
