# CURRENT RELEASE — BUILD 861 / CP861

Date: 2026-10-04

## CP861 — Family round navigation and finalist resolution
- Fixed the missing Family normal Back controller used by the top-left Back buttons.
- Family card Back works throughout Round 2 and Tiebreak, even before a browse-history entry exists.
- Round-start popups stay on screen until LET’S GO is tapped.
- Family ENTER control is centered, text-only, and hides the previous symbol.
- Hardened finalist/tiebreak reconciliation with fresh reads and a second finalize pass to catch simultaneous two-person submissions.
- Existing Compare Both flow is preserved.

## Verification
- Source syntax/static smoke checked before commit.
- Vercel deployment verification required after the single CP861 commit.
- Exact two-device interactive browser test remains blocked while TinyFish wallet credits are negative.
