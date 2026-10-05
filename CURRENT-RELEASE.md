# CURRENT RELEASE — BUILD 1005 / CP1005

Date: 2026-10-05

## CP1005 — Buttermilk Image / Faster Swipe Response

- Replaced the **Buttermilk & Cornbread** meal image with a clearer Wikimedia Commons photo centered on a glass of buttermilk.
- Reduced the minimum flick-speed needed for a short, fast swipe from 0.62 px/ms to 0.55 px/ms.
- Made the fast-swipe exit handoff slightly quicker without changing the normal swipe distance or card layout.
- Refreshed the app/meal script URLs and service-worker shell cache so phone/PWA clients can receive the new behavior.

## CP1004 — Menu / Modal Flash Hardening

- Fixed the first-frame menu-to-modal flash on mobile by making modal backdrops opaque immediately when a modal is inserted.
- This covers Manage Meals, Add Meal, Settings, History, and other modal handoffs instead of treating Manage Meals as a one-off.
- Preserved the existing modal entrance motion and all existing screen designs.
- Refreshed the stylesheet URL and service-worker shell cache so mobile/PWA clients do not retain the old opening-backdrop CSS.
- CP1003 remains the rollback anchor.

## CP1003 — Full iPhone Viewport Adaptation

- Mobile app shell now occupies the complete iPhone dynamic viewport.
- The existing global top bar keeps the same 58px content area while moving the safe-area inset into the bar itself.
- Each screen background/canvas runs edge-to-edge horizontally while the existing 14px content geometry is preserved.
- Meals, Restaurants, Winner, and Menu are not redesigned; their current controls, cards, text, and visual relationships remain intact.
- Home keeps its existing CP1002/CP1003 visual treatment; this pass only adapts the viewport.
- Bottom safe-area handling remains inside mobile screens rather than outside the app canvas.
- No swipe, Tutorial, restaurant-photo, Family Mode, meal, or restaurant-search behavior changes.

## Protected rollback anchors

- **CP1002:** `d28e4bb31d887b286659cd3c78a7f625b5e0f7ce`
- **CP999:** `784b41c066818cc097be189ff76ab8b17b0bff72`

Production is not verified until CP1003 is deployed and browser/phone runtime certification passes.
