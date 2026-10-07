# CURRENT RELEASE — BUILD 1237 / CP1237

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
