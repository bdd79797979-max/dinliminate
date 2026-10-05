# Dinliminate Launch QA Gate — Build 1006 / CP1006

Date: 2026-10-05

## Current candidate

- Release: Version 1.0 / Build 1006 / CP1006
- Working branch: `cp1006-full-iphone-viewport-fix`
- Production deployment: not yet verified
- Restaurant photography: no Google photo/API credentials

## Tutorial/UI gates

- Meals tutorial ends with Enter Restaurant and launches the Restaurant tutorial.
- Restaurant tutorial ends with Enter Meals and launches the Meals tutorial.
- Choose → Winner → Start Over remains an explicit tutorial path.
- Meal Times/Cuisine bubbles do not cover their neighboring controls or rails.



- Home Tutorial launches through the shared Home action router.
- Settings → Tutorial Mode starts from Home.
- Add to phone, Share, and Tutorial use the same Home utility icon styling.

## CP1004 menu/modal flash gate

- Menu → Manage Meals opens without exposing the previous screen.
- Manage Meals → Add Meal opens without exposing the previous screen.
- Menu → Settings and Menu → History open without exposing the previous screen.
- Modal opening backdrops are opaque on first paint.
- Mobile CSS/service-worker cache versions are refreshed.

## Full iPhone viewport gate

- App shell is exactly full-width and full-height on mobile.
- iPhone safe-area inset is contained inside the shared top bar.
- Screen canvases reach the viewport edges without the legacy outer 14px app padding.
- Home background reaches the full mobile app canvas.
- No content/design changes are made to Meals, Restaurants, Winner, or Menu.

## Home image gate

- Home page uses only the original uploaded door photo.
- At Home and Restaurant Home cards contain no photo source or overlay.
- The obsolete Home door asset is absent from the repository.

## Tutorial Engine gates

- Choose button activation advances the tutorial into Winner.
- Choose tutorial bubble advances into Winner without creating fake history.
- Screen transitions invalidate the previous tutorial overlay before the next screen paints.
- Stale tutorial tokens cannot position a bubble on the wrong screen.

## Repository gates

Before calling CP997 launch-ready:

1. JavaScript syntax and data integrity pass.
2. Build/cache/release references are synchronized to CP997.
3. Tutorial state and navigation invariants remain intact.
4. Swipe controls do not introduce card handoff or waiting-card regressions.
5. Restaurant search/radius/deduplication behavior is checked.
6. Restaurant photo resolver preserves the no-Google source ladder and rejects wrong-venue imagery.
7. Browser/iPhone-size QA passes without console errors or navigation flashes.
8. Physical iPhone Safari/PWA checks cover touch, GPS, install, keyboard, swipe, image loading, and share/add-to-home-screen behavior.
9. Hosted Vercel runtime is successfully deployed and verified.

## Intentional UI deferrals

- Restaurant Search/Open/All controls that are currently hidden should stay hidden until the related refinement work is intentionally reintroduced.

## Release rule

Do not mark production verified until the hosted CP997 build has been deployed and the required browser/physical-device checks pass.
