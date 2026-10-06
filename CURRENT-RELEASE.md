# CURRENT RELEASE — BUILD 1054 / CP1054

Date: 2026-10-06

## Restaurant Intelligence candidate

CP1045 is the protected starting point for the current restaurant-system work. CP1046–CP1054 now reorganize restaurant identity, Google usage controls, photo sourcing, restaurant details, source-aware persistence, and next-card readiness.

### Current restaurant photo policy

1. Existing verified Dinliminate photo that already meets the quality gate
2. Google Places photo for the exact verified restaurant
3. Official restaurant website/gallery/location page
4. Exact public venue page
5. Exact OpenStreetMap/POI image
6. No restaurant card when no acceptable image is available

Generic, stock, neutral, supplier, wrong-business, menu/graphic, and low-quality images are not accepted into the Restaurant swipe deck.

### Current information policy

Google is used first for on-demand restaurant detail enrichment where it provides the needed field. Official restaurant website data is the next fallback, followed by verified venue data. Missing information is left unknown rather than guessed.

### Google protection

Dinliminate uses independent hard stops for Google capabilities: Photos 900; Text Search Pro 4500; Nearby Search Pro 4500; Text Search Enterprise 900; Place Details Enterprise 900; Place Details Essentials 9000. The billing month is aligned to America/Los_Angeles. Unknown durable budget tracking fails closed.

### Performance

The Restaurant deck blocks on the current card and immediate next photo only. Additional lookahead is loaded in the background so the user does not wait for a five-photo batch.

### Recovery

The CP1045 commit remains the protected pre-change baseline. CP1055 is the final audit/release gate and has not been deployed yet.
