# CURRENT RELEASE — BUILD 862 / CP862

Date: 2026-10-04

## CP862 — Meal multi-photo upload hardening
- Meal Editor accepts up to 8 photos in one iPhone picker selection or repeated Add Photos selections.
- The first saved photo is the main meal image.
- Additional photos use stable per-meal IndexedDB keys and no longer overwrite previous uploads.
- The editor supports making another photo the main image or removing photos before save.
- Existing single-photo meals remain backward compatible.
- The existing primary Meal card/rendering path remains unchanged.

## Verification
- JavaScript parse and source-contract smoke checks included.
- Physical iPhone multi-photo picker testing remains a device-level gate.
