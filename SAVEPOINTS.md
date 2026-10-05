# CURRENT SAVEPOINT — BUILD 1008 / CP1008

Date: 2026-10-05

Working branch: `cp1008-managed-image-cache`

## CP1008 — Managed Meal + Restaurant Image Cache

- Keeps meal and restaurant photos in the existing image cache while adding a storage budget.
- Uses a 75 MiB ceiling and evicts least-recently-used entries back to 60 MiB.
- Uses persistent IndexedDB metadata so image usage survives service-worker restarts.
- Does not impose a hard photo-count limit.

## Recovery anchor

- **CP1007:** `00e7ebed09ed0558853d1b7fcb8f872866cf7038`
