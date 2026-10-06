# CURRENT RELEASE — BUILD 1056 / CP1056

Date: 2026-10-06

## Restaurant Hours filter

CP1056 adds a compact Restaurant Hours control beside Search and Cuisine.

The Restaurant discovery rail is now:
**Search — Cuisine — Hours**

Hours choices:
- **All** — keep all restaurants in the current pool
- **Open** — keep restaurants with an available open-state signal showing open
- **Closed** — keep restaurants with an available open-state signal showing closed

Hours filtering is local to the already-loaded restaurant pool. Selecting All/Open/Closed does not open Restaurant Details and does not make a Place Details request.

## Restaurant Cuisine

Cuisine continues to use the current Restaurant Cuisine Cuts taxonomy already in the app:
Fast Food, Burgers, Pizza, Mexican, American, Italian, Asian, BBQ, Seafood, Breakfast.

## Google protection

The existing Google hard stops remain unchanged: Photos 900; Text Search Pro 4500; Nearby Search Pro 4500; Text Search Enterprise 900; Place Details Enterprise 900; Place Details Essentials 9000. Billing month follows America/Los_Angeles. Unknown durable budget tracking fails closed.

## Recovery

CP1045 remains the protected recovery anchor. CP1055 is the production baseline for this new CP1056 candidate. No CP1056 deployment has been made.
