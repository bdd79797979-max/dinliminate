# Dinliminate

Dinliminate is a phone-first dinner decision app built around fast food and restaurant elimination.

Current build: Version 1.0, Build 709.

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

## Current release hardening
- Working branch: cp704-hero-food-photos
- Base recovery: cp703-dine-in-out-copy
- Current release candidate stays off main until the exact release commit is fully verified.
- Vercel is the official runtime for the release candidate; Netlify remains legacy/backup. Vercel deployment is currently blocked by the connected account build-rate limit.
