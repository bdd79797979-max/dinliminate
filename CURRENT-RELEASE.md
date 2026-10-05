# CURRENT RELEASE — BUILD 1006 / CP1006

Date: 2026-10-05

## CP1006 — Full iPhone Viewport Fix

- Replaces the conflicting mobile viewport rules with one final full-iPhone shell.
- Keeps the existing 58px top-bar content height while placing the iPhone safe-area inset inside the bar.
- Removes the old mobile app padding so screen backgrounds can reach the complete viewport.
- Preserves existing Meals, Restaurants, Winner, Menu, and Home content/design geometry; this is a shell-only adaptation.
- Refreshes CSS/JS/meal cache URLs and the service-worker shell version so phones receive the corrected assets.

## Protected rollback anchors

- **CP1005:** `3dd492653be3bfa620229df6d16bbbcb8fb036f3`
- **CP1003 viewport baseline:** `d0cd6028b0054c8467162e23302951fff44ac193`

Production remains unverified until the CP1006 hosted build is browser-checked and the iPhone/PWA viewport is physically confirmed.
