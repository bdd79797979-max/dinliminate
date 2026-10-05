# CURRENT RELEASE — BUILD 996 / CP996

Date: 2026-10-05

## Release state

- Source of truth: `main`
- Production verification: **not yet verified**
- Reason: the connected Vercel Hobby deployment allowance is currently exhausted.
- Restaurant photo policy: **no Google photo/API credentials**

## CP996 — Tutorial Launch & Home Icon Repair

- Restores **Settings → Tutorial Mode**.
- Fixes the Home Tutorial icon through the shared Home action router.
- Makes Add to phone, Share, and Tutorial share the same Home utility icon treatment.
- Removes the Tutorial-only transparent/black styling override.
- Preserves CP995 Tutorial Mode state/navigation and Choose → Winner → Start Over resume behavior.
- No restaurant-photo, Family Mode, or swipe-engine runtime changes.

## Protected rollback anchors

- **CP995 cleanup baseline:** `49c21ad82cd47bda221146c518a643988e3d5a6d`
- **CP995 Tutorial merge:** `e076eb98f5802aae3ff6474a23fcfb92c4276929`
- **CP957 restaurant-photo baseline:** `d03a75ab63f1708524f1406e33d5a09c74f689f4`
- **Recovery branch:** `recovery/cp957-before-restaurant-photo-repair`

## Launch gate

Production is not verified until CP996 is deployed and browser/phone runtime certification passes.
