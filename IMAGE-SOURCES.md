# Dinliminate image-source governance

## Restaurant imagery

The production intent is **actual restaurant photography first**.

### Resolver order

1. Existing verified Dinliminate restaurant photo that already meets the quality gate
2. Google Places Photo for the exact verified restaurant
3. Official restaurant website, gallery, or exact location page
4. Exact public venue page
5. Exact OpenStreetMap/POI venue image
6. No card

A generic restaurant/category image is not a valid Restaurant swipe fallback.

### Verification

A candidate must pass exact-venue identity checks and image-quality checks before the Restaurant deck can use it. Wrong businesses, nearby locations, supplier pages, stock imagery, menus, logos, collages, screenshots, placeholders, and unusably small/blurry media are rejected.

### Google usage

Google photo requests are durably budgeted and stop at 900 successful photo-media reservations per America/Los_Angeles billing month. The other Google capabilities have independent hard stops. If durable budget tracking is unavailable, Google calls fail closed.

Google photo media is not persisted in Dinliminate's browser restaurant-photo cache. Place IDs and permitted metadata remain the reusable identity layer.

### Restaurant information

For detail enrichment, Google is queried first for fields that require Google Enterprise data. When those fields are missing or unavailable, Dinliminate falls back to the verified official restaurant website and then verified venue data. Unknown data remains unknown.

### Rights

Automated identity/quality checks do not establish copyright permission for every third-party image. Usage rights still need review before public launch.
