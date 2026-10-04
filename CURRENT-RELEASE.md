# CURRENT RELEASE — BUILD 899 / CP899

## CP899 — customizable Meal Times in Manage Meals
- Added a native Meal Times manager inside Manage Meals.
- Users can rename default Meal Times, add custom Meal Times, reorder them, and turn individual Meal Times on or off.
- Custom Meal Time configuration is stored on-device and survives app reloads.
- Meal editing now reads the same configurable Meal Time catalog, so new and renamed times appear automatically in each meal editor.
- Removing a custom Meal Time safely moves its assigned meals to Lunch / Dinner.
- The main Meal Times filter remains a simple filter and uses the configured active Meal Time list.
- Styled the manager to match the existing Manage Meals library cards, typography, dark surfaces, and gold/green status treatment.
- Release and service-worker versions are synchronized to CP899.

## Verification
- Saved Meal Time configuration is serialized with app state.
- Legacy saved data without Meal Time configuration migrates to the three default Meal Times.
- At least one Meal Time must remain active.
- Default Meal Times remain recoverable and cannot be deleted.
