# CURRENT SAVEPOINT — BUILD 1056 / CP1056

Date: 2026-10-06

Working branch: `cp1056-restaurant-hours-filter`

## Checkpoint

- **CP1045:** `a3533da54552a07db395ae1a0b3dbb58df2ea139` — protected starting point.
- **CP1055:** `5de674de07ce157d324e0d7045360d845b772f81` — production baseline.
- **CP1056:** Restaurant Hours filter candidate.

## CP1056 scope

Restaurant discovery keeps the existing Cuisine and Radius controls and adds **Hours** on the same row as Search and Cuisine. Hours offers **All / Open / Closed** and filters the loaded restaurant pool locally; it does not invoke Place Details.

The existing Restaurant Cuisine Cuts taxonomy remains the active set: Fast Food, Burgers, Pizza, Mexican, American, Italian, Asian, BBQ, Seafood, Breakfast.

CP1045 remains the recovery anchor. CP1056 has not been deployed.
