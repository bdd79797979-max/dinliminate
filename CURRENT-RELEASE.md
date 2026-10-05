# CURRENT RELEASE — BUILD 995 / CP995

Date: 2026-10-05

## Release state

- Source of truth: `main`
- Production verification: **not yet verified**
- Reason: the connected Vercel Hobby deployment allowance is currently exhausted.
- Restaurant photo policy: **no Google photo/API credentials**

## CP995 — Tutorial State & Navigation Repair

- Tutorial launches always begin from the Home screen.
- The first bubble teaches that the bubble itself advances the tutorial.
- The Home opening sequence ends with: “Tap At Home or Restaurant to get started.”
- The Menu button is a tutorial target; buttons inside the opened Menu are not tutorial steps.
- Tutorial bubbles avoid the Meal Times/Cuisine controls and their visible rails.
- Choose → Winner → Start Over returns to the same Meals/Restaurant path and resumes the tutorial.
- Normal Start Over and Family Mode behavior remain unchanged outside Tutorial Mode.
- The Home Tutorial icon has no black circle/background enclosure.

## Protected rollback anchors

- **CP994:** `435a0312af4f137f58af6d0b4dece1e474907d71`
- **CP957 restaurant-photo baseline:** `d03a75ab63f1708524f1406e33d5a09c74f689f4`
- **Recovery branch:** `recovery/cp957-before-restaurant-photo-repair`

## Launch gates still open

Production should not be called verified until the CP995 source is deployed successfully and the release receives browser/phone runtime certification.
