# CURRENT RELEASE — BUILD 896 / CP896

## CP896 — restore Home imagery correctly
- Kept the obsolete front-page background/photo system deleted.
- Restored the new double-door image directly on the canonical Home surface.
- Restored two separate replacement photos inside the AT HOME and RESTAURANT window panels.
- Removed all dependency on the deleted `home-background.jpg` asset and the retired persistent image layer.
- Bumped stylesheet, runtime, and service-worker cache versions to prevent the blank cached Home from persisting.
- Release metadata is synchronized to CP896.

## Verification
- The deleted `home-background.jpg` file remains removed.
- The old `home-photo-img` / persistent background layer remains removed.
- Home has one full-page door image plus two independent window-panel photos.
