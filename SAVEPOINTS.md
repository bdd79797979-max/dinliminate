# CURRENT SAVEPOINT — CP1112

Date: 2026-10-06

Working branch: cp1112-history-menu-restaurant-card-polish

## Checkpoint

- CP1111: 78daa714e88748b827af0b9df593774ef6249e9f — lowered Home footer utilities a little more.
- CP1112: history month navigation no longer removes/rebuilds the modal, the Home hamburger hides while the drawer is open, and Restaurant card information is lifted slightly without moving photo credit.

## Scope

Requested polish only:
- Switching History calendar months updates the existing modal in place so the page underneath cannot flash.
- On Home, the original top-right hamburger hides while the menu drawer is open; the drawer's X remains the visible close control.
- Restaurant card category/title/address content is moved slightly upward. Photo credit remains anchored at its existing bottom position.

## Validation

Source checks passed after editing:
- History month handlers call `render()` without removing `historyModal` or `historyModalBg`.
- Home menu has an explicit `aria-expanded="true"` visual hide rule.
- Restaurant card copy is lifted to `bottom:33px`, while `.restaurant-photo-credit` remains at `bottom:11px`.
- Stylesheet and app script cache versions bumped to 1112.
