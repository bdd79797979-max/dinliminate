# CURRENT SAVEPOINT — CP1109

Date: 2026-10-06

Working branch: cp1109-iphone-width-fix

## Checkpoint

- CP1108: 6d45bad0edb1af944708e368bbee7d2948261f3d — Home choice text-size refinement.
- CP1109: corrected Home to use an iPhone-sized portrait canvas on desktop previews while remaining full-width on actual iPhones. No deployment has been made.

## CP1109 scope

The Home app shell is capped at 430px wide for desktop/tablet browser previews and centered on screen. At actual iPhone widths (600px and below), it expands to the full viewport width. The Home content uses the shell width instead of desktop 100vw overflow.

No deployment has been made from CP1109.
