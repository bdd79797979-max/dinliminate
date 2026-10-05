# CURRENT RELEASE — BUILD 997 / CP997

Date: 2026-10-05

## Release state

- Source of truth: `main`
- Production verification: **not yet verified**
- Reason: the connected Vercel Hobby deployment allowance is currently exhausted.
- Restaurant photo policy: **no Google photo/API credentials**

## CP997 — Full Tutorial Flow & Bubble Placement Repair

- Choose → Winner now receives an explicit Start Over tutorial step; Start Over resumes the same Meals or Restaurant path.
- Meal Times and Cuisine bubbles avoid their neighboring controls and visible rails.
- Meals ends with **Enter Restaurant**, which launches the Restaurant tutorial.
- Restaurants ends with **Enter Meals**, which launches the Meals tutorial.
- The Home Tutorial icon no longer gets a dark hover/touch box and matches Add to phone and Share.
- Settings → Tutorial Mode remains first under Tools and uses a unique satin-blue treatment.
- No restaurant-photo, Family Mode, or swipe-engine runtime changes.

## Protected rollback anchors

- **CP996:** `b4cbfc4f59e368acb7962a0871ae0ec7a8323a37`
- **CP995 cleanup:** `49c21ad82cd47bda221146c518a643988e3d5a6d`
- **CP957 restaurant-photo baseline:** `d03a75ab63f1708524f1406e33d5a09c74f689f4`

## Launch gate

Production is not verified until CP997 is deployed and browser/phone runtime certification passes.
