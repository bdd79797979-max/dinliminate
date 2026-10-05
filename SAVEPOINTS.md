# CURRENT SAVEPOINT — BUILD 995 / CP995

Date: 2026-10-05

Working branch: `main`

## Recovery anchors

### CP995 — current source
CP995 is the current merged release source.

### CP994 — immediate rollback
`435a0312af4f137f58af6d0b4dece1e474907d71`

Use this as the first rollback point if CP995 tutorial/navigation changes regress.

### CP957 — restaurant-photo protection
`d03a75ab63f1708524f1406e33d5a09c74f689f4`

Recovery branch: `recovery/cp957-before-restaurant-photo-repair`

## Cleanup rule

Historical checkpoint branches and old verification notes are preserved in Git history. Routine work should branch from `main`, make one scoped change, verify it, and record a new checkpoint before the next surgical change.
