# CURRENT RELEASE — BUILD 1055 / CP1055

Date: 2026-10-06

## Final restaurant intelligence audit candidate

CP1055 is the final pre-deployment checkpoint built from CP1045.

### Restaurant photos

The Restaurant deck requires an acceptable verified photo. New photo lookup is Google-first, followed by the verified official restaurant website/location page, exact public venue sources, exact OSM/POI imagery, and finally no card.

Generic, stock, neutral, supplier, wrong-business, menu/graphic, and low-quality images are excluded.

### Restaurant information

Google supplies on-demand detail enrichment first. Missing website, phone, weekly hours, or menu data falls back to the verified official restaurant website/venue data. Unknown values remain unknown.

### Google protection

Independent hard stops: Photos 900; Text Search Pro 4500; Nearby Search Pro 4500; Text Search Enterprise 900; Place Details Enterprise 900; Place Details Essentials 9000. Billing month follows America/Los_Angeles. Unknown durable budget tracking fails closed. A central GOOGLE_MASTER_ENABLED switch can disable all Google requests without disabling the non-Google restaurant fallbacks.

### Performance

The initial Restaurant draw waits only for the current and immediate next verified photos; additional lookahead is warmed separately. Google media is not persisted in the Dinliminate restaurant-photo cache.

### Verification completed

- Node syntax checks: PASS
- npm dependency install/audit: PASS
- Google budget/timezone tests: PASS
- official-site hours extraction test: PASS
- no-generic-photo policy assertions: PASS
- CP1045→CP1055 diff isolated to restaurant intelligence/release governance
- local browser smoke test: PASS

Physical iPhone testing and production deployment are the remaining release actions.

## Recovery

CP1045 remains the protected recovery anchor. No production deployment was made during CP1046–CP1054.
