# CURRENT RELEASE — BUILD 1223 / CP1223

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

## Recovery

CP1210 remains the functional baseline for this change. CP1211 is a UI/behavior simplification on top of the existing Open Now enrichment system. No production deployment was made.
