# Dinliminate Launch QA Gate — Build 707 / CP707

Date: 2026-10-02

## Current candidate
- Working branch: `cp707-audit-fixes-except-hidden-restaurant-controls`
- Clean recovery baseline: `clean-cp704-2026-10-02`
- Release: Version 1.0 / Build 707 / CP707
- Restaurant API: r25
- Radius tiers: 1 / 3 / 5 / 10 / 25 / 50 / 100 miles
- Hosted test target: `dinliminate22`
- Restaurant Search UI: intentionally hidden
- Restaurant Open/All UI: intentionally hidden

## Completed hardening
- Vercel release endpoint now reads `app-release.json`.
- App Diagnosis validates current release metadata dynamically.
- Service-worker shell cache advanced to v674.
- Home tagline restored to “Beautifully swipe until it’s revealed.”
- History calendar supports individual entry deletion.
- Restaurant card utilities use 44px touch targets.
- Active static/browser/iPhone/hosted QA contracts are synchronized to current release identity and r25.
- Notes retain per-note Add/Edit/Delete behavior for Meals and Restaurants.

## Launch gates still requiring real evidence
1. Static/data/syntax QA
2. Restaurant provider/search/radius/dedupe reliability QA
3. Browser/accessibility/iPhone-size QA
4. Hosted `dinliminate22` runtime QA
5. Food/restaurant image source and rights review
6. Physical iPhone Safari/PWA installation, GPS, touch/swipe, and share/add-to-home-screen checks

## Intentional UI deferrals
- Restaurant Search remains hidden.
- Restaurant Open/All remains hidden.

## Release rule
Keep this candidate off production until hosted `dinliminate22` runtime certification and physical iPhone certification are complete.
