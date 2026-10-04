# CURRENT RELEASE — BUILD 898 / CP898

## CP898 — Home front-page cleanup
- Home now uses a single canonical full-page solid double-wood door background with no glass/window panels in the door.
- AT HOME and RESTAURANT keep their own independent photo panels.
- Removed the obsolete Home decorative orb layer.
- Removed remaining retired Home photo-rail and legacy image-element selectors.
- Fixed the Home card image CSS-variable markup so the replacement photos load through valid HTML/CSS.
- Kept the deleted legacy `home-background.jpg` asset and persistent image layer out of the build.
- Bumped cache versions to keep stale Home styling/assets from resurfacing.
- Release metadata is synchronized to CP898.

## Verification
- No `home-background.jpg`, `home-background-layer`, `homeBackgroundImage`, or `home-photo-img` references remain.
- Home contains the solid double-door background plus two independent choice-panel images.
- Home decorative orbs are removed from the DOM and stylesheet.
