# Dinliminate image-source governance

## Restaurant imagery

### Resolver order

1. Existing verified Dinliminate restaurant photo that already meets the quality gate
2. Google Places Photo for the exact verified restaurant
3. Official restaurant website, gallery, or exact location page
4. Exact public venue page
5. Exact OpenStreetMap/POI venue image
6. No card

A generic restaurant/category image is not a valid Restaurant swipe fallback.

### Verification

Candidates must pass exact-venue identity and image-quality checks. Wrong businesses, nearby locations, suppliers, stock imagery, menus, logos, collages, screenshots, placeholders, and unusably small/blurry media are rejected.

### Google

Google photo requests stop at 900 per America/Los_Angeles billing month. Google media is not persisted in the Dinliminate browser restaurant-photo cache. Durable budget tracking fails closed.

### Restaurant information

Google is used first for on-demand fields that require it. Missing fields fall back to the verified official restaurant site/venue source. Unknown data stays unknown.

### Rights

Automated identity/quality checks do not establish copyright permission for every third-party image. Usage rights still need review before public launch.
