# Dinliminate

Dinliminate is a phone-first dinner decision app built around fast food and restaurant elimination.

Current build: Version 1.0, Build 845.

Clean recovery baseline: `clean-cp704-2026-10-02`.

CP708 keeps Restaurant Search and Open/All hidden for now while the rest of the app is hardened; Meal and Restaurant decision-button behavior is unified.

The deployable app lives at the repository root.

Milestones:
1. Home + Food decision engine
2. Live restaurant location/search pipeline
3. Restaurant elimination + details
4. History/settings
5. Pass Around
6. Launch QA


## CP709 decision-button motion
- Meal and Restaurant Back / Cut / Maybe share an explicit tap jump animation.
- Reduced-motion users receive a non-animated press state.

## CP708 hero photos + button parity
- Dine In hero refreshed with Pexels 37140465.
- Dine Out hero refreshed with Pexels 36850066.
- Meal Back / Cut / Maybe now use the same activation helper as Restaurant controls.

## CP704 Home hero photography
- Dine In now uses a vibrant overhead dinner spread.
- Dine Out now uses a close-up grilled steak with colorful vegetables.
- Existing entry behavior and CP703 copy are preserved.

## CP703 front-page naming
- Home entry cards now read **Dine In — Reveal Your Meal** and **Dine Out — Reveal Your Restaurant**.
- Existing entry-button IDs and behavior are preserved.

## CP843 Family Mode hardening
- Active Family decisions now support a clean participant exit without blocking everyone else.
- Family code sharing uses the native share sheet with clipboard fallback.
- Family decision time is simplified to 15, 30, 45, or 60 minutes.
- Family voting is server-validated for stage/item completeness and returns the updated round state immediately.
- Stale family members are cleaned up; host recovery uses a longer mobile-friendly grace period.
- Completed Family winners are shown only to participants, and restaurant winners use restaurant-specific photo fallbacks.
- App and service-worker asset versions are bumped to prevent stale cached Family UI.

## Current release hardening
- Working branch: cp704-hero-food-photos
- Base recovery: cp703-dine-in-out-copy
- Current release candidate stays off main until the exact release commit is fully verified.
- Vercel is the official runtime for the release candidate; Netlify remains legacy/backup. Vercel deployment is currently blocked by the connected account build-rate limit.


## CP845 Dinner Together integration
- Dinner Together is presented as a native Dinliminate choice rather than a separate decision experience.
- Shared decisions use the normal Dinliminate Meals/Restaurant swipe presentation and the normal winner surface.
- Create/Join instructions are condensed into a simple five-step explanation.
- The prior Family-specific swipe and winner presentation is hidden from the user-facing flow while its proven room/vote compatibility layer remains available.
- Family winners use the normal History data shape with Family metadata for deduplication; normal Stats remain the source of truth.
- Release and service-worker cache metadata are aligned to CP845.
