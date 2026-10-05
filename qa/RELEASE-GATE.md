# Dinliminate Launch QA Gate — Build 996 / CP996

Date: 2026-10-05

## Current candidate

- Release: Version 1.0 / Build 996 / CP996
- Working branch: `main`
- Production deployment: not yet verified
- Restaurant photography: no Google photo/API credentials

## Tutorial/UI gates

- Home Tutorial launches through the shared Home action router.
- Settings → Tutorial Mode starts from Home.
- Add to phone, Share, and Tutorial use the same Home utility icon styling.

## Repository gates

Before calling CP996 launch-ready:

1. JavaScript syntax and data integrity pass.
2. Build/cache/release references are synchronized to CP996.
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

Do not mark production verified until the hosted CP996 build has been deployed and the required browser/physical-device checks pass.
