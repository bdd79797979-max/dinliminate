# CURRENT RELEASE — BUILD 860 / CP860

Date: 2026-10-04

## CP860 — Final Family Mode audit hardening
- Family Back now uses the dedicated Round 2/Tiebreak browse history before normal decision history.
- Compare Both state is explicitly cleared when a Family dinner is ended or the user leaves Family Mode.
- Added regression contract coverage for Round 2 swipe/back browsing, Enter routing, immediate winner handling, Compare Both routing, and release/cache identity.
- App/service-worker identity advanced to v860.

## Verification
Static parsing and contract checks pass on the CP860 source. Vercel deployment identity and runtime error health are checked after deployment. Live two-device swipe/Enter testing remains a physical/browser gate while TinyFish browser automation is unavailable.
