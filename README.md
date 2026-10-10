# Dinliminate

Dinliminate is a phone-first meal and restaurant decision app. The core loop is simple: swipe, cut what you do not want, keep what you might want, and stop when the choice is clear.

## Run locally

Use Node 24 or newer.

```bash
npm install
npx vercel dev
```

Open the local Vercel URL it prints. Vercel Dev is the preferred local path because it runs the `api/` serverless routes alongside the browser app.

For UI-only work, a static server is enough:

```bash
python -m http.server 4173
```

Static mode does not provide the serverless API routes.

Run the automated checks with:

```bash
npm test
```

Useful focused checks are `npm run lint`, `npm run format:check`, `npm run test:release`, and `npm run test:api`.

## Deploy

Vercel is the production host.

The normal release path is to push the intended commit to `main`. Vercel builds from that branch.

For a manual production deployment:

```bash
npx vercel --prod
```

Do not hand-edit generated release versions. `app-release.json` is the release source of truth and `scripts/stamp.mjs` keeps versioned browser/service-worker assets aligned.

## Environment variables

Secrets are server-side only. Do not put Google, Neon, or AI credentials in browser code.

### Google Places

`GOOGLE_PLACES_API_KEY` — primary Places API credential for restaurant search, details, and photos.

`GOOGLE_MAPS_API_KEY` — accepted compatibility/fallback credential for Places search.

`GOOGLE_MASTER_ENABLED` — global Google kill switch.

`GOOGLE_BUDGET_DATABASE_URL` — preferred durable Neon database connection for Google SKU accounting.

`GOOGLE_PHOTO_BUDGET_DATABASE_URL` — optional dedicated connection for photo budgeting; the Google usage layer can fall back to the shared database variables.

`GOOGLE_TEXT_SEARCH_PRO_HARD_LIMIT`, `GOOGLE_NEARBY_SEARCH_PRO_HARD_LIMIT`, `GOOGLE_TEXT_SEARCH_ENTERPRISE_HARD_LIMIT`, `GOOGLE_NEARBY_SEARCH_ENTERPRISE_HARD_LIMIT`, `GOOGLE_PLACE_DETAILS_ENTERPRISE_HARD_LIMIT`, `GOOGLE_PLACE_DETAILS_PRO_HARD_LIMIT`, `GOOGLE_PLACE_DETAILS_ESSENTIALS_HARD_LIMIT`, `GOOGLE_PHOTO_MONTHLY_HARD_LIMIT`, and `GOOGLE_PLACE_PHOTO_HARD_LIMIT` — durable SKU hard-stop controls.

`GOOGLE_UNTRACKED_SKU_LIMIT` — fallback allowance when durable usage tracking is unavailable. Keep this at zero for strict fail-closed budgeting.

### Neon and Family Mode

`FAMILY_DATABASE_URL` — database used by Family Mode. The same database can also serve as the fallback for shared Google/rate-limit storage.

`RATE_LIMIT_DATABASE_URL` — preferred durable database for API rate-limit state.

`RATE_LIMIT_KEY_SALT` — optional server-side salt for rate-limit key hashing.

When the dedicated database URLs are absent, the server code can fall back through `DATABASE_URL` and `POSTGRES_URL` where supported.

### Persistent restaurant library

`RESTAURANT_LIBRARY_DATABASE_URL` — preferred Neon connection for restaurant metadata and retained-photo records. `DATABASE_URL` or `POSTGRES_URL` can be used as a fallback; Family Mode storage is not used implicitly.

`BLOB_READ_WRITE_TOKEN` — Vercel Blob read/write credential. Connect a Blob store to this project and configure its credential for each environment where image ingestion is enabled.

`RESTAURANT_LIBRARY_RETENTION_HOSTS` — comma-separated hostnames whose image content has been explicitly approved for long-term retention. Only HTTPS images from these hosts may be stored; Google-owned photo hosts are always rejected. Leave this unset until each source's retention rights are confirmed.

The library creates its versioned Neon tables on first use. `GET /api/restaurant-library?mode=health` reports configuration and schema health; a name and address lookup returns saved metadata. The restaurant-photo endpoint serves a retained library image before running provider/search lookups. Google Places photo bytes are never copied into Blob or the library tables.

### AI meal autofill

`AI_GATEWAY_API_KEY` — credential for the meal autofill AI path.

`AI_GATEWAY_MODEL` — optional model selection for meal autofill.

Vercel-provided runtime variables such as `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_ENV`, and `VERCEL_OIDC_TOKEN` are read by server/runtime code where available and normally should not be manually copied from source into client code.

## Architecture

The migration uses a strangler pattern: old runtime behavior is moved into native ES modules in small slices, with tests between slices.

```text
┌────────────────────────────── Browser / PWA ──────────────────────────────┐
│                                                                          │
│  index.html → boot.js → src/main.js                                     │
│                         │                                                │
│                         ├── features/{swipe, meals, restaurants, ...}    │
│                         ├── ui/{dom, esc, modal}                         │
│                         ├── api/client.js → /api/*                       │
│                         └── state/store.js                               │
│                               ├── storage.js                              │
│                               └── migrations.js                           │
│                                                                          │
│  sw.js → shell + image caching                                           │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                 ┌──────────── Server / Vercel ────────────┐
                 │  /api/restaurants → Google Places       │
                 │  /api/restaurant-photo → photo resolver │
                 │  /api/family* → Neon Family Mode        │
                 │  /api/google-usage → durable SKU budget │
                 │  /api/meal-autofill → AI Gateway        │
                 └─────────────────────────────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Neon PostgreSQL  │
                         │ state/budgets    │
                         └──────────────────┘
```

Production does not include the diagnostics screen. Development diagnostics live separately at `/dev/diagnostics/`.

The application state is intended to have one owner: `src/state/store.js`. Feature modules read/write through the store and subscribe to state changes rather than creating new application-wide globals.

## Restaurant photos

Google Places photos are intentionally supported. The restaurant photo pipeline prefers a verified/cached image first, then uses exact Google Places identity matching, followed by validated official/public/OSM/search fallbacks.

Google web-result HTML scraping is not used. Website discovery uses deterministic candidates plus Bing and DuckDuckGo, with identity validation.

## How to add a meal

1. Open **Menu → Manage Meals → Add Nutrition**.
2. Enter the meal name, cuisine, and one or more meal times.
3. Add Calories, Protein, Carbs, Fat, and Sodium. These nutrition fields may be left blank when the current editor allows optional nutrition.
4. Add ingredients plus recipe/notes, then choose the meal photo.
5. Save. The meal is added to the editable catalog and can later be edited, hidden, restored, or deleted from **Manage Meals**.

The meal catalog is data-driven; meal content belongs in the data/state layer, not in global browser variables.

## Project layout

```text
src/
  main.js
  state/
    store.js
    storage.js
    migrations.js
  features/
    swipe/
    meals/
    restaurants/
    winner/
    history/
    family/
    settings/
    tutorial/
  api/
    client.js
  ui/
    dom.js
    esc.js
    modal.js

api/              Serverless routes and shared server helpers
data/             Meal catalog and restaurant taxonomy
tests/            Release, API, and browser behavior tests
dev/diagnostics/  Development-only diagnostics
sw.js             PWA shell and image cache
styles.css        Visual system
index.html        Browser shell
boot.js           CSP-safe boot/runtime setup
```

## Development rules

Keep behavior stable while the strangler migration is in progress. Move code unchanged first; improve implementation only in a later, explicitly scoped change.

Use native ES modules in browser code. Do not add `window`-backed application state, test globals, or string-based function inspection.

Every feature extraction should leave the repository testable. Run the checks before and after the move, and keep the working branch recoverable in Git history rather than maintaining hand-written recovery checkpoint files.
