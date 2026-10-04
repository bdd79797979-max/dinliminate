# CURRENT RELEASE — BUILD 895 / CP895

## CP895 — remove legacy Home photo sources
- Deleted the obsolete local `home-background.jpg` asset and all runtime/CSS/service-worker references to it.
- Removed the retired persistent Home background image layer from the document and runtime.
- Removed obsolete front-page photo-rail bindings and legacy `home-photo-img` fallback/listener code.
- Removed the old AT HOME / RESTAURANT inline photo URLs so those controls remain clean window panels over the new Home background.
- Home now has one visual background source: the current double-door photo delivered through the existing `/api/image` proxy.
- Service-worker registration and cache versions are bumped to prevent stale Home assets from resurfacing.
- Release metadata is synchronized to CP895.

## Verification
- No `home-background.jpg` references remain in the active Home files.
- No `home-photo-img` bindings remain in the Home runtime.
- No old inline front-page photo URLs remain on the Home buttons.
- AT HOME / RESTAURANT controls remain present.
