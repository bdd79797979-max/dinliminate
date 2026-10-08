
## CP1266 — quiet Meal Auto-Fill checkpoint
Adds an understated Auto-Fill Meal action to the existing Add/Edit Meal flow. Autofill stays reviewable and editable before saving, with independent refresh for nutrition, ingredients, recipe, cuisine, meal time, description, and photo. Nutrition is labeled as a typical-serving estimate. Photo matching prefers exact Pexels/Unsplash results and reports when no strong match is found. Similar-meal hints help prevent accidental duplicates. No production deployment was performed for this checkpoint.
# CURRENT RELEASE — BUILD 1266 / CP1266

Date: 2026-10-07

## Restaurant Open filter

CP1211 simplifies the Restaurant hours control to one binary filter.

The Restaurant discovery rail is now:
**Search — Cuisine — Open**

**Open inactive** — all restaurants in the current pool. The word Open is crossed out.

**Open active** — only restaurants confirmed open now. The word Open is white and underlined.

Turning Open on uses the existing smart hours enrichment/cache. Turning it off does not run enrichment and returns to the full restaurant pool.

The All restaurant count therefore represents all restaurants when Open is off, and only confirmed-open restaurants when Open is on.

Legacy saved Closed Now state is normalized to All.

## Restaurant All / Maybes count fix

CP1214/CP1215 fix a restaurant-count bug where photo preparation could mark unavailable photos and inadvertently remove those restaurants from the decision pool and the ALL count. A Maybe action now leaves the ALL count unchanged; only actual filters such as CUT, Search, Cuisine, and Open can change it. Photo-preparation failure is presentation-only and is no longer persisted in saved restaurant state.

## Restaurant Cuisine Cuts

CP1216 adds Indian and Mediterranean as first-class Restaurant Cuisine Cuts, with category search aliases, provider/name signals, menu corroboration, and dedicated chip imagery. The full Restaurant Cuisine Cut set is now 13 categories.

## Swipe interaction polish

CP1218–CP1220 refine the existing Meal and Restaurant swipe system without changing the card-stack lifecycle. Committed swipes now use a tighter 21% gesture threshold (72–108px clamp), a lighter flick threshold, faster off-screen completion, and a shorter clean return when a swipe is released before commit. Cut/Maybe buttons receive immediate press feedback and a light haptic. The All/Maybes count gives immediate commit-time feedback, including correct handling when the committed restaurant was already a Maybe. No next-card promotion animation or new stack behavior was added.

## Swipe button exit polish

CP1223 fixes the button activation handoff so Cut and Maybe enter the committed-swipe phase correctly before running the existing decision callback. The off-screen animation and waiting-card lifecycle remain unchanged.

CP1222 routes Meal and Restaurant Cut/Maybe button decisions through the existing committed-swipe exit path. A button decision now keeps the active card visible while it travels completely off-screen before the existing safe handoff/removal logic runs. The waiting card and card-stack lifecycle remain unchanged.

## Meal photo refresh

CP1221 refreshes the requested Southern Vegetable Plate, Meatloaf & Mashed Potatoes, Peanut Butter & Jelly, Chicken Pot Pie, BLT, Ham Dinner, Roast Beef Sandwich, Chicken & Dumplings, Shrimp & Grits, Biscuits & Gravy, Southern Vegetable Beef Soup, White Chicken Chili, and Buttermilk & Cornbread catalog images. The replacements use the approved built-in meal image hosts (Pexels/Unsplash); no provider/meal data or nutrition values were changed.

## Meal photo refresh

CP1224 refreshes the clearest weak matches from the requested meal-photo set: Meatloaf, Southern Vegetable Plate, Chicken Pot Pie, Roast Beef Sandwich, Chicken & Dumplings, and Biscuits & Gravy. The replacement catalog images use approved Pexels/Unsplash hosts.

The remaining requested items — Peanut Butter & Jelly, BLT, Ham Dinner, Shrimp & Grits, Southern Vegetable Beef Soup, and White Chicken Chili — were kept because the available approved-host alternatives were not clearly better or were less faithful to the meal.

## Meals deck order and Tour update

CP1225 keeps the built-in Fish Sticks meal as the final card in the Meals deck, including filtered/Maybe views when Fish Sticks remains eligible. The Tour now explains the current swipe behavior on both Meal and Restaurant cards, including that committed cards slide fully off-screen before the next choice takes over.

## Home Tour correction

CP1226 updates only the Home Tour. The Home page now has separate Tour steps for Home, Restaurant, the top-right Menu, and the Add/Share/Tour tools, matching the current homepage controls.

## Home Tour core-flow correction

CP1227 replaces the Home Tour with the three core elimination-app messages:
“tap this button to move on to the next step.”
“eliminate meals or restaurants until your choice is revealed.”
“tap home or restaurant to get started.”

The Meal and Restaurant Tour sections remain unchanged.

## Home Tour positioning fix

CP1228 keeps the three Home Tour messages unchanged but points each step at a real, visible homepage control. The first step targets the bottom Tour control instead of the tutorial bubble itself, preventing recursive positioning and keeping the tutorial bubble on-screen.

## Card Cuisine and Details sizing

CP1234 enlarges the Cuisine type text and Details control on Meal and Restaurant decision cards by approximately 50%. The Details control grows from the small inline target to a 42px tap target with a 23px icon, while card geometry and the upper controls remain unchanged. No Tutorial or swipe-stack behavior was modified.

## Recovery

CP1210 remains the functional baseline for this change. CP1211 is a UI/behavior simplification on top of the existing Open Now enrichment system. No production deployment was made.

## Card name sizing

CP1235 increases the Meal and Restaurant decision-card name text by approximately 50% (from 30px to 45px). Card geometry, upper controls, swipe behavior, and Tutorial behavior are unchanged.

## Meal photo refresh — Unsplash pass

CP1237 tests free Unsplash candidates against the requested meal-photo list. The clearly better matches now used in the catalog are Meatloaf & Mashed Potatoes, Peanut Butter & Jelly Sandwich & Chips, BLT, Ham Dinner, Roast Beef Sandwich & Chips, and Southern Vegetable Beef Soup. The remaining requested meals were intentionally retained because no free Unsplash result was clearly better or faithful enough to replace the current photo.

## Swipe continuation correction — CP1238

CP1238 changes the committed Meal and Restaurant swipe exit so the active card stays fully visible and continues from the exact finger-release position all the way off-screen. The release position is flushed synchronously before the animation starts, the destination is calculated from the card's actual viewport edges, and the card no longer fades out during the exit. The exit runs longer and remains locked until the transform finishes, reducing fast-swipe race conditions and the premature-disappear effect. The existing waiting-card and handoff lifecycle is unchanged.

## Swipe flight stabilization — CP1239

CP1239 replaces the committed Meal and Restaurant swipe exit with one browser-owned full-flight animation. The card starts at the exact release position, stays fully visible, travels until the entire card clears the viewport, and the visual handoff is not released until that flight completes.

## Meal photo refresh — CP1240

CP1240 replaces the Chicken Pot Pie card photo with a clearly better free Unsplash match. The Meatloaf card was already using a strong free Unsplash image; the remaining requested Southern dishes were retained because no clearly better faithful free Unsplash replacement was found.

## CP1241 — overlap the next swipe input

CP1241 keeps the outgoing card's full off-screen flight exactly intact, but creates a temporary active copy of the prepared next card after a 95ms handoff window. This lets the user begin dragging the next card while the previous card is still completing its visual flight.

The original preview remains intact underneath the temporary swipe card. If the user actually starts the next gesture, state redraw is held until the overlapping flights can finish in order, so the previous card cannot disappear early or interrupt the next swipe. Cancelling the second gesture restores the normal preview and completes the first decision normally.

The exit duration and full-card clearance from CP1239 are unchanged; CP1241 changes only the input handoff timing.

## CP1242 — tutorial target ownership and tour cleanup

CP1242 fixes the Home Tour first-step failure and hardens the full Tutorial/Tour interaction model. While the Tour is active, the currently highlighted control is owned by the Tour: its normal application handler is prevented from firing and the tutorial action runs instead. This prevents the first highlighted Tour button from toggling Tutorial Mode off, prevents instructional steps from accidentally cutting/keeping/choosing/opening controls, and keeps the action steps (Home choice, Choose, cross-screen continuation, and Winner Start Over) intentional.

The obsolete tutorial target/menu and scheduling stubs were removed. Target rendering now retries longer and ends cleanly with an explanatory message rather than silently hiding the overlay when a control is late to render. A dedicated CP1242 tutorial smoke test was added.

## CP1243 — tutorial pointer safety

CP1243 closes the remaining Tutorial/Tour interaction hole caused by decision controls using pointerup handlers. The Tour now guards pointerdown, pointerup, pointercancel, and click for the highlighted target, suppressing the underlying control event and consuming the tutorial action instead. The guard also suppresses the trailing synthetic click after a pointerup action, so Cut/Maybe/Choose cannot perform a real decision while being demonstrated.

CP1243 retains the CP1242 centralized target ownership and removes no useful app interaction outside the active highlighted tutorial target. The dedicated tutorial regression test now covers the pointer-level guard.

## CP1244 — one decision transaction for Cut/Maybe

CP1244 fixes a race where a second Cut/Maybe press during an active off-screen flight could bypass the swipe trigger and fall through to the raw decision function, mutating state while the first card was still completing. The decision buttons now use one authoritative click activation path. Their swipe trigger returns explicit transaction outcomes: accepted or busy. A busy active card consumes the later command instead of running the underlying Cut/Maybe handler.

This keeps the CP1241 early next-card input handoff intact: the outgoing card remains visually committed, the next promoted card owns the next transaction, and the old transaction cannot accept or leak a second decision.

## CP1245 — meal photo and catalog refresh

CP1245 refreshes the strongest affected meal photos with verified free Unsplash images where a clearly better match was available. The existing Peanut Butter & Jelly image remains the verified free Unsplash selection; Biscuits & Gravy and White Chicken Chili remain unchanged where a free Unsplash result did not clearly improve the current match. Chocolate Covered Peanuts is added as meal 117, and Fish Sticks is intentionally the final catalog entry.

## CP1246 — no-black swipe handoff

CP1246 keeps the already-prepared overlap next-card visible as a visual bridge while the recycled live card is redrawn and its new image is prepared. The bridge is removed only after the live card is painted visible, eliminating the brief empty/black frame between Cut/Maybe and the next card.

## CP1247 — Tutorial Home target repair

CP1247 fixes the first Home Tour transition by giving the Home slogan the stable `#home-slogan` target referenced by the tutorial. The tutorial target-positioning fallback now retries for 24 animation frames and shows an explicit failure message before stopping instead of silently disappearing.

## CP1248 — eliminate swipe handoff gap

CP1248 keeps the actual prepared waiting card visible throughout the outgoing-card handoff. The optional overlap clone remains available for early next-card input, but it is no longer the sole visual bridge. This guarantees that a prepared next card remains underneath the outgoing card instead of allowing the stack to become visually empty for a frame.

## CP1249 — commit-time next-card paint

CP1249 moves visual next-card promotion to the swipe commit point. The prepared waiting card is made visible and composited before the outgoing card begins its off-screen animation, closing the remaining paint window that could expose the black stage for a split second. CP1248's always-visible waiting-card safeguard remains in place.

## CP1250 — never hide the real waiting card

CP1250 removes the last known visual-gap path in the overlap handoff. When the optional interactive overlap clone is created, the real prepared waiting card stays visible underneath it instead of being hidden. This means an overlap clone that has not painted yet can never expose the black decision stage.

## CP1263 — Biscuits & Gravy Pixabay photo

The built-in Biscuits & Gravy meal now uses the exact Pixabay image selected by the user: `https://cdn.pixabay.com/photo/2014/10/04/03/11/biscuits-472409_1280.jpg`. `cdn.pixabay.com` is included in the built-in meal-photo allowlist so the catalog can display the selected source.

## CP1264 — five requested meal photos

Updated the built-in photos for Buttermilk & Cornbread, Cabbage & Sausage, Chocolate Covered Peanuts, Peanut Butter & Jelly Sandwich & Chips, and Chicken & Dumplings using the exact user-selected Pixabay/Unsplash images. Pixabay and Unsplash hosts were already in the approved built-in meal-photo allowlist.


## CP1265 — working meal photos

Replaced the four blocked Pixabay meal-photo sources with working Pexels sources for **Buttermilk & Cornbread**, **Cabbage & Sausage**, **Chocolate Covered Peanuts**, and **Chicken & Dumplings**. The selected Unsplash **Peanut Butter & Jelly Sandwich & Chips** photo remains unchanged. The service-worker shell cache was bumped so existing PWA installations can pick up the refreshed meal catalog rather than retaining the older cached `foods.js`.
