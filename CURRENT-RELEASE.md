# CURRENT RELEASE — BUILD 893 / CP893

## CP893 — Home background source cleanup
- Replaced the legacy home background asset with the generated double wooden doors image.
- Removed the remote home-door image source from the runtime.
- Home now has one local global background source: `home-background.jpg`.
- Service-worker shell/image cache versions are synchronized to build 893.
- Existing AT HOME / RESTAURANT card imagery remains separate from the global home background.

## Verification
- `home-background.jpg?v=893` is the sole global home background asset.
- Remote `HOME_DOOR_SOURCE` binding removed.
- Service-worker cache version synchronized to v893.
