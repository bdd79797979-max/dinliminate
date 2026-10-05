# Dinliminate image-source governance

## Current policy

All built-in image URLs must use HTTPS.

### Meal imagery

### CP1031–CP1032 Buttermilk & Cornbread
The built-in catalog contains **Buttermilk & Cornbread** only; the standalone **Buttermilk** meal was removed.
The current image is the **Cornbread & Buttermilk** photograph from *Our State* (photograph by Tim Robison), which specifically depicts cornbread with buttermilk. Usage rights should be reviewed before public distribution.
Meal images are tied to the meal catalog and should be dish-specific. Third-party image sources require the appropriate rights/usage review before public distribution.

### Restaurant imagery

Google Places Photos are supported as a **server-side fallback**, not as the first source. The restaurant-photo resolver follows this priority:

1. official restaurant website, gallery, or exact location page
2. exact public venue page
3. exact OpenStreetMap/Photon venue image
4. Google Places Photo for an identity-checked exact venue
5. tightly validated exact-restaurant search imagery
6. safe restaurant/category fallback

The Google photo path is budget-controlled with a durable monthly request counter and fails closed when the budget tracker is unavailable.

Identity checks should use restaurant name plus address/phone/site evidence so a nearby or similarly named venue cannot supply the photo.

Resolved restaurant photos may be cached for faster repeat display, but a cached image must remain tied to the exact restaurant identity.

## Rights review

Automated runtime checks can confirm source/identity behavior, but they cannot establish copyright permission for every third-party image. Review or replace any asset whose usage rights are not clear before public launch.

Historical source inventories and older checkpoint-specific image notes remain in Git history rather than the active policy file.
