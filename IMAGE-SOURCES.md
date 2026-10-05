# Dinliminate image-source governance

## Current policy

All built-in image URLs must use HTTPS.

### Meal imagery

### CP1005 Buttermilk & Cornbread
The built-in Buttermilk & Cornbread meal now uses Wikimedia Commons **Buttermilk-(right)-and-Milk-(left).jpg**, a CC BY-SA 3.0 image by Ukko.
Meal images are tied to the meal catalog and should be dish-specific. Third-party image sources require the appropriate rights/usage review before public distribution.

### Restaurant imagery — no Google photos

Google photo APIs, Google photo credentials, and Google Places photo metadata are **not** used for restaurant photography.

The restaurant-photo resolver follows this priority:

1. official restaurant website, gallery, or exact location page
2. exact public venue page
3. exact OpenStreetMap/Photon venue image
4. tightly validated exact-restaurant search imagery
5. safe restaurant/category fallback

Identity checks should use restaurant name plus address/phone/site evidence so a nearby or similarly named venue cannot supply the photo.

Resolved restaurant photos may be cached for faster repeat display, but a cached image must remain tied to the exact restaurant identity.

## Rights review

Automated runtime checks can confirm source/identity behavior, but they cannot establish copyright permission for every third-party image. Review or replace any asset whose usage rights are not clear before public launch.

Historical source inventories and older checkpoint-specific image notes remain in Git history rather than the active policy file.
