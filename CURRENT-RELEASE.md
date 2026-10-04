# CURRENT RELEASE — BUILD 863 / CP863

Date: 2026-10-04

## CP863 — Meal photo upload polish

- Deduplicates meal photo references at read, upload, URL-entry, save, and IndexedDB storage boundaries.
- Multiple selected files are filtered against existing and newly selected photos, preventing repeated copies of the same image in one selection.
- Photo URL promotion no longer creates a duplicate copy of an existing photo.
- Meal Editor shows a compact `N / 8 photos · first is Main` status.
- IndexedDB hydration now finishes before legacy migration begins, removing the startup race between the two workflows.
- Legacy migration only runs when real data-image content still needs migration.
- Application and service-worker references advanced to v863.

## Verification

- JavaScript parse/static smoke checks completed on the source.
- iPhone multi-photo picker behavior remains a physical-device verification item.
