# Known CI failures at the  baseline

Baseline commit: [`14db5f97b7d5d51f01b9bdb01d8853187dceb8f6`](https://github.com/bdd79797979-max/dinliminate/commit/14db5f97b7d5d51f01b9bdb01d8853187dceb8f6)  
Baseline CI: [failed Playwright run #483](https://github.com/bdd79797979-max/dinliminate/actions/runs/38029042272)  
Observed result: **87 failed, 231 passed (318 total)**. This is a baseline record only. These tests remain enabled; this file does not skip, quarantine, or modify them.

The CI report contains **19 distinct failing scenarios**. The 17 mobile scenarios below each failed in Chromium at 360×740, 375×667, 390×844, 412×915, and WebKit Mobile (five configurations each). The final two are desktop-only, accounting for 87 failed cases in total.

## Mobile scenarios (17 × 5 configurations)

1. `tests/e2e/behavior.spec.mjs:433` — **swipe tint follows direction, reverses with the finger, and fills solid on commit**. Right-swipe tint did not match expected green (`rgb(24, 134, 83)`).
2. `tests/e2e/behavior.spec.mjs:661` — **phone swipe controls and first-entry directions remain responsive**. Back control measured 44 px instead of the test's expected 42 px.
3. `tests/e2e/behavior.spec.mjs:952` — **Restaurant Details fetches missing contact and hours when opened**. Expected phone label `931-555-0147` was not found; hours assertions were downstream.
4. `tests/e2e/behavior.spec.mjs:1318` — **Restaurant photo misses keep deck order and show neutral art instead of blank cards**. Waiting card did not acquire `data-swipe-promoted="1"`.
5. `tests/e2e/behavior.spec.mjs:1347` — **Restaurant deck promotes the ready waiting card and hides no-photo art until lookup settles**. Test timed out after 30 seconds.
6. `tests/e2e/behavior.spec.mjs:1403` — **Restaurant waiting card stays promoted while its verified photo replaces pending art**. Waiting card promotion attribute remained empty.
7. `tests/e2e/behavior.spec.mjs:1496` — **Google restaurant photos are on-demand, not persisted, while Place IDs are retained**. Expected photo source `google-places` was null.
8. `tests/e2e/behavior.spec.mjs:1543` — **Standalone Restaurant waiting card is promoted after its photo is decoded**. Waiting card promotion attribute remained empty.
9. `tests/e2e/behavior.spec.mjs:1597` — ** successive Restaurant swipes never repeat a cut result or leave a blank card**. Expected deck count `3` was null.
10. `tests/e2e/behavior.spec.mjs:2022` — ** keeps the shared menu directly under its hamburger and Family Mode exits to the menu**. Close-control horizontal alignment differed by about 341 px.
11. `tests/e2e/behavior.spec.mjs:2244` — ** Restaurant Maybe and Back reuse the prior photo on restore**. Back returned `fallback-restaurant.svg` rather than the manually injected data URL. The fixture injects an image directly into the DOM, so this failure needs a representative cache/state fixture before concluding the production restoration path is broken.
12. `tests/e2e/behavior.spec.mjs:2332` — ** menu navigation retains the full-screen handoff cover until the destination backdrop is ready**. Family backdrop class was `family-drawer-bg hidden`, not `is-open`.
13. `tests/e2e/behavior.spec.mjs:2431` — **phone panel close actions restore the main menu before the panel closes**. Menu was still hidden in the close-click task.
14. `tests/e2e/behavior.spec.mjs:2509` — **app-wide interaction polish keeps decision feedback subtle and Radius dark**. Measured pressed scale was 1 instead of at least 1.03; assertion reads computed transform immediately after adding the pressed class.
15. `tests/e2e/behavior.spec.mjs:2593` — **homepage press highlight, one-time logo entrance, and bottom controls stay consistent**. The test expects the computed `transformOrigin` string to contain `bottom`, but the browser serializes it as coordinates (`35px 50px`).
16. `tests/e2e/behavior.spec.mjs:2620` — **CUT and MAYBE buttons visibly enlarge with matching color feedback while pressed**. Measured scale was 1.032 while the assertion expects at least 1.075; it is read during the transition.
17. `tests/e2e/mobile-drawers.spec.mjs:71` — ** all four phone panels share hamburger anchoring, visible header, and return-to-menu behavior**. One panel alignment measurement was 54 px against an expected 52 px.

## Desktop scenarios (2)

18. `tests/e2e/desktop-drawers.spec.mjs:172` — **desktop Family Mode is a right-side drawer that closes without changing its underlying screen**. Family drawer right edge differed from the expected edge by 435 px.
19. `tests/e2e/desktop-drawers.spec.mjs:212` — ** all four desktop windows share hamburger alignment, layering, and return-to-menu behavior**. Manage Meals started at 64 px versus the expected 54 px.

## How to compare future CI runs

Use this list to recognize the existing baseline failures. Do not classify every subsequent failure with the same test name as automatically harmless: compare its assertion, browser configuration, and error details with the recorded baseline. Any new failing test/scenario not listed above should be treated as new until investigated.
