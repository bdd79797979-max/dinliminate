# Google Audit

**Audit date:** October 8, 2026  
**Audited release:** CP1308 / build 1308  
**Decision recorded:** Google Places photos are intentionally wanted and must remain supported. Google web-search HTML scraping is not wanted for production and has now been removed from the live website-discovery source list.  
**Scope:** Current repository on `refactor/behavior-test-harness`. This audit does not delete, disable, or rewrite any Google/Bing/DuckDuckGo functionality.

## Executive summary

The repository contains two different kinds of Google usage:

1. **Google Places API usage** for restaurant discovery, exact place lookup, restaurant details/hours, and restaurant photos. These paths are production-reachable and materially affect the restaurant experience.
2. **Google web-search HTML scraping** used by the restaurant website-discovery resolver. The generic search resolver can scrape Google, Bing, and DuckDuckGo result pages. This is separate from Google Places and should not be confused with Google Places photo/API usage.

The README is currently inconsistent with the actual implementation. It still says restaurant photography uses a "no-Google resolver/source ladder," while `app-release.json` already records the intended photo policy as "existing verified quality photo > Google Places > official restaurant > exact venue > OSM > no card." The code also makes Google Places the first fresh-photo source. The correct product decision for this branch is: **Google Places restaurant photos are allowed and intentional.**

## Production route map

Vercel treats the `api/*.js` files as serverless API routes. The active production routes relevant to this audit are:

| Route | Production reachability | Google role |
|---|---|---|
| `/api/restaurants?mode=search` | **Live**; called by the restaurant screen | Google Places discovery, named search, and fallback/recovery search |
| `/api/restaurants?mode=details` | **Live**; restaurant details hydration calls it when a Google Place ID exists | Google Places details lookup |
| `/api/restaurants?mode=health` | **Live**; runtime diagnosis calls it | Reports Google Places configuration and Google usage status |
| `/api/restaurant-photo` | **Live**; restaurant-card photo loading calls it | First fresh-photo attempt is Google Places, then non-Google fallbacks |
| `/api/google-restaurant-photo` | **Directly reachable as a Vercel route**; current browser code does not call this URL directly | Dedicated Google Places photo/health endpoint |
| `/api/google-usage` | **Live**; runtime diagnosis calls it | Read-only durable Google SKU budget/usage status |

## Google Places: exact call sites

### 1. `api/google-restaurant-photo.js`

This file is the dedicated Google Places photo implementation.

**`googleJson()` — line 57**  
Central HTTP helper for Google Places JSON calls. It attaches `X-Goog-Api-Key`.

**`googlePhotoMedia()` — line 77**  
Calls:

`https://places.googleapis.com/v1/{photoName}/media`

This is the actual Google Places photo-media fetch.

**Reachability:** **Live.** `tryGoogleRestaurantPhoto()` calls it, and `api/google-restaurant-photo.js` also exposes it through its GET handler.

**If removed:** Google Places photos stop working. The primary `/api/restaurant-photo` resolver would continue to its official-website/public-venue/OSM/exact-search fallbacks, but any restaurant whose strongest available source is Google Places would lose that photo. The dedicated Google photo route would also fail.

**`findPlaceId()` — line 95**  
Calls:

`https://places.googleapis.com/v1/places:searchText`

It searches by restaurant name + address, optionally with a location bias, then requires an exact name/address/location match before accepting the Place ID.

**Reachability:** **Live** through Google photo resolution.

**If removed:** Google photo resolution cannot convert a restaurant name/address into a Google Place ID unless a valid Place ID was already supplied by the upstream restaurant result.

**`getPlaceDetails()` — line 115**  
Calls:

`https://places.googleapis.com/v1/places/{placeId}`

Requests identity/location plus photos.

**Reachability:** **Live** through Google photo resolution.

**If removed:** Google photo resolution can no longer verify the returned Place against the requested restaurant/address or obtain its Google photo list.

**`tryGoogleRestaurantPhoto()` — line 132**  
Orchestrates Place ID lookup, place details, exact identity validation, photo ranking, and media retrieval.

**Reachability:** **Live** from `api/restaurant-photo.js` and from the dedicated `/api/google-restaurant-photo` route.

**Important behavior:** Google is attempted before the non-Google restaurant-photo fallbacks.

### 2. `api/restaurants.js`

**`googleBudgetedJson()` — line 83**  
This is the Google request wrapper for restaurant search/details operations. Before making the request it reserves a durable Google SKU budget entry through `api/google-usage.js`.

**Reachability:** **Live** for the Google search/details paths below.

**If removed:** Google Places restaurant-search/details calls lose the durable SKU hard-stop and would need another budget guard. Removing the wrapper without replacing the guard would increase billing/quota risk.

**`googleSearchPlaces()` — line 809**  
Calls:

`POST https://places.googleapis.com/v1/places:searchText`

Used for named restaurant searches.

**Reachability:** **Live** from restaurant search mode, including the normal search path and named-search fallback.

**If removed:** Searches such as a restaurant/chain keyword would have less complete coverage and would rely more heavily on OSM/ArcGIS/Photon/Overpass recovery sources. Exact Google-provided place IDs, structured phone/website data, and Google opening-hour fields would be reduced.

**`googlePlaces()` — line 848**  
Calls:

`POST https://places.googleapis.com/v1/places:searchNearby`

Used for radius discovery when Google is configured.

**Reachability:** **Live** from restaurant radius search, including recovery and wide-radius paths.

**If removed:** Nearby restaurant coverage decreases, especially where OSM/ArcGIS/Photon do not return a restaurant. Radius counts and geographic completeness can drop.

**`googleContactEnrichment()` — line 875**  
Calls Google Places text search to fill missing phone/website/hours.

**Reachability:** **Currently not production-reachable from the route graph.** The function is defined and exposed through `handler._test`, but there is no runtime call site in the current file.

**If removed:** No expected production behavior change in the current branch. The helper and any tests/imports explicitly using its private test export would be affected.

**`googlePlaceDetails()` — line 922**  
Calls:

`GET https://places.googleapis.com/v1/places/{placeId}`

Requests structured restaurant identity, website, phone, regular hours, current `openNow`, business status, primary type, and types.

**Reachability:** **Live.** The `/api/restaurants?mode=details` route calls it when a Google Place ID is supplied. The hours enrichment chain can also call it, although that chain itself is currently not invoked by a production route.

**If removed:** The restaurant Details flow loses its Google Places details source. The UI can still use the official-website fallback in `mode=details`, but details/hours/phone/website completeness may be lower.

**`googleTextHoursForRow()` — line 1405**  
Calls Google Places text search to resolve missing hours/contact fields.

**Reachability:** **Currently indirect/dead in production.** It is called by `resolveHoursForRow()`, which is called by `enrichOpenNowHours()`; `enrichOpenNowHours()` has no current production caller.

**If removed:** No current production behavior change; the unused hours-enrichment chain and its tests/private exports would be affected.

**`resolveHoursForRow()` / `enrichOpenNowHours()` — lines 1450 / 1492**  
These form the Google details/text-search hours enrichment chain.

**Reachability:** **Not currently production-reachable.**

**If removed:** No current production behavior change, but future/explicit reuse of this enrichment feature would need a replacement. Do not confuse this with the live `googlePlaces()` search path, which already receives `currentOpeningHours.openNow` and regular opening hours directly from Google Places.

### 3. `api/google-usage.js`

This file does not make Google HTTP requests itself. It is the durable Google budget tracker.

**`reserveGoogleSku()` — line 146**  
Reserves usage against the Neon table:

`dinliminate_google_sku_usage_v1`

It is used by the live Google Places search/details/photo flows.

**Reachability:** **Live** as a dependency of those Google call paths.

**If removed:** Google calls lose their durable monthly SKU hard stops. That is a billing/quota safety regression, not merely a feature regression.

**`disableGoogleSkuForMonth()`**  
Disables a SKU for the current Pacific billing month after quota/rate-limit failures.

**Reachability:** **Live** from the Google Places clients.

**If removed:** Automatic monthly blocking after upstream quota/rate failures would disappear.

**`googleUsageHealth()` / `googleUsageSnapshot()`**  
Provide read-only usage information.

**Reachability:** **Live** through `/api/google-usage` and the restaurant health endpoint. The browser diagnosis screen explicitly requests `/api/google-usage`.

**If removed:** Runtime diagnosis loses the Google budget/usage display. It does not by itself stop Google Places calls unless the budget-reservation functions are also removed.

### 4. `api/restaurant-photo.js`

**Line 5:** imports `tryGoogleRestaurantPhoto`.

**Line 1077:** the restaurant-photo handler invokes Google Places first.

**Reachability:** **Live** through `/api/restaurant-photo`, which the browser calls for restaurant-card photo loading.

**If Google photo is removed:** the handler can continue through its existing official restaurant, exact public venue, OSM, and exact-venue search-photo layers, but Google is no longer the first fresh-photo opportunity.

## Google web-search HTML scraping

This is a separate mechanism from Google Places.

### Google result-page scraping — removed

The live `api/restaurants.js` website-discovery source list no longer includes `https://www.google.com/search`. The unused `fetchGoogleWebSearchPage()` wrapper has also been removed.

**Reachability:** **Not production-reachable.**

**Replacement:** `/api/restaurants?mode=website` continues to use deterministic domain candidates plus Bing and DuckDuckGo result pages, followed by restaurant identity verification. The `mode=details` official-website fallback therefore remains functional without Google HTML scraping.

**What changed:** Google web-result HTML is no longer fetched or parsed by the production website-discovery resolver. This does **not** affect Google Places API usage or Google Places restaurant photos.

### Defined but not currently used wrappers

**`fetchGoogleWebSearchPage()` — line 373**  
Defined in `api/restaurants.js`, exported in `handler._test`, but there is no production call to this wrapper. The live Google search path uses the generic `fetchPublicSearchPage()` with the Google URL in the source array.

**Reachability:** **Not production-reachable as a wrapper.**

**If removed:** No production behavior change; tests that use the private helper export would be affected.

**`fetchBingSearchPage()` — line 336** and **`fetchDuckDuckGoSearchPage()` — line 370** have the same status in `api/restaurants.js`: defined/test-exported but not the live call mechanism.

## Bing/DuckDuckGo scraping in restaurant photo resolution

`api/restaurant-photo.js` contains separate live public-web discovery.

**Line 666:** Bing web search is used to find official location pages on an already-known official domain.

**Lines 951 onward:** Bing + DuckDuckGo result pages are used to find verified public restaurant pages.

**Line 1007:** Bing Images is used for exact-venue photo candidates after stronger photo sources have been exhausted.

**Reachability:** **Live** through `/api/restaurant-photo`.

**If removed:** Restaurant-photo discovery becomes more dependent on direct official URLs, known public pages, OSM, and any already-cached/known photos. Exact public-venue discovery and the last-resort Bing Images layer become less capable.

**Important:** I did not find a live Google HTML-results scraper in `api/restaurant-photo.js`; its Google usage there is Google Places API code, not Google search-page scraping.

## Google environment variables

There are **15 distinct `GOOGLE_*` names present in the current source**. Two are alternate/fallback names for existing controls, so the practical configuration surface is smaller than the raw name count.

| Environment variable | Used by | Purpose |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | `api/google-restaurant-photo.js`, `api/restaurants.js` | Primary Google Places API credential |
| `GOOGLE_MAPS_API_KEY` | `api/restaurants.js` | Fallback API-key name if `GOOGLE_PLACES_API_KEY` is absent |
| `GOOGLE_MASTER_ENABLED` | `api/google-usage.js` | Global Google kill switch |
| `GOOGLE_TEXT_SEARCH_PRO_HARD_LIMIT` | `api/google-usage.js` | Monthly hard stop for Pro text search SKU |
| `GOOGLE_NEARBY_SEARCH_PRO_HARD_LIMIT` | `api/google-usage.js` | Monthly hard stop for Pro nearby search SKU |
| `GOOGLE_NEARBY_SEARCH_ENTERPRISE_HARD_LIMIT` | `api/google-usage.js` | Monthly hard stop for Enterprise nearby search |
| `GOOGLE_TEXT_SEARCH_ENTERPRISE_HARD_LIMIT` | `api/google-usage.js` | Monthly hard stop for Enterprise text search |
| `GOOGLE_PLACE_DETAILS_ENTERPRISE_HARD_LIMIT` | `api/google-usage.js` | Monthly hard stop for Enterprise Place Details |
| `GOOGLE_PLACE_DETAILS_ESSENTIALS_HARD_LIMIT` | `api/google-usage.js` | Monthly hard stop for Essentials Place Details |
| `GOOGLE_PHOTO_MONTHLY_HARD_LIMIT` | `api/google-usage.js` | Monthly hard stop for Place Photos |
| `GOOGLE_UNTRACKED_SKU_LIMIT` | `api/google-usage.js` | Optional cap when durable budget DB is unavailable |
| `GOOGLE_BUDGET_DATABASE_URL` | `api/google-usage.js` | Primary durable database connection for Google budget tracking |
| `GOOGLE_PHOTO_BUDGET_DATABASE_URL` | `api/google-usage.js` | Alternate database connection name for the Google budget tracker |
| `GOOGLE_OPEN_NOW_ENRICH_LIMIT` | `api/restaurants.js` | Maximum calls for the separate open-now enrichment chain |
| `GOOGLE_PLACE_PHOTO_HARD_LIMIT` | `api/google-usage.js` | Alternate Place Photo hard-limit name used when the monthly variable is absent |

Database aliases `FAMILY_DATABASE_URL`, `DATABASE_URL`, and `POSTGRES_URL` can also satisfy the Google budget database connection, but they are shared application database variables rather than Google-specific controls.

## Budget tracker behavior and risk notes

The Google budget tracker is intentionally durable when a supported database URL is configured. It stores counts by billing month and SKU and has a Google master kill switch.

One existing nuance is important: if no durable database connection is available and `GOOGLE_UNTRACKED_SKU_LIMIT` is greater than zero, `api/google-usage.js` falls back to process-local counters (`localCounts`). That fallback is not a durable distributed budget. The safer configuration is to keep a durable Neon database configured and keep the untracked fallback at zero.

The user-requested Meal Auto-Fill rate limiter is separate from this Google budget tracker.

## What should remain

Because Google Places photos are explicitly desired:

- Keep `api/google-restaurant-photo.js`.
- Keep the Google Places photo-media call.
- Keep the exact restaurant identity validation before accepting a Google photo.
- Keep the durable Google SKU budget tracker and monthly hard stops.
- Keep the `/api/restaurant-photo` Google-first photo ordering.
- Keep the Google Places search/details paths needed for restaurant coverage and structured data unless a later decision intentionally changes that behavior.

## Decision and implementation

The product decision is now:

1. **Keep Google Places.** Google Places remains the production source for restaurant discovery, structured details/hours, exact identity verification, and restaurant photos.
2. **Remove Google web-result scraping.** The live website-discovery resolver now uses deterministic domain candidates, Bing, and DuckDuckGo. The Google search-result HTML source and its unused wrapper are removed.
3. **Keep Bing and DuckDuckGo.** They remain non-Google web-discovery fallbacks for finding official/public restaurant pages.
4. **Keep the Google budget controls.** The durable Neon SKU tracker, monthly hard stops, and master kill switch remain in place.
5. **Do not collapse environment-variable aliases in this change.** Existing deployment compatibility is safer than removing aliases without first verifying the configured Vercel environment.
6. **Do not change the Google Places photo path.** Google Photos remain intentionally preferred after an existing verified/cache hit and before lower-confidence fallback sources.

No Google Places API, Google budget tracker, Bing/ DuckDuckGo discovery path, or restaurant-photo fallback was disabled. No deployment was performed as part of this change.
