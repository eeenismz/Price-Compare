# Todo

## Done

### Phase 1 — MVP (manual entry only, no scraping)
- Set up project file structure (index.php, css/style.css, js/app.js, dist/)
- Build manual item entry form (name, price, currency, quantity), shared with Edit mode
- Build e-commerce link paste input — MVP scope: plain text field for the user's own reference only, no fetch/parsing wired up
- Build promotion selector UI (5 promo types + "no promotion"), with reveal-only-relevant-fields behavior
- Implement promotion math in js/app.js (BOGO free, 2nd item 50% off, buy 3 pay 2, fixed bundle price, 2nd item fixed price)
- Build merged item list + comparison view (grouped by currency, sorted cheapest-first, inline edit/remove)
- Implement "Best Value" highlight per currency group (including tie handling)
- Implement mismatched-currency warning/grouping (no conversion)
- Responsive styling (css/style.css), mobile-first with desktop two-column layout
- Sync dist/ as a self-contained deploy-ready copy (no dev-only files)
- QA pass: fixed mobile overflow bug with long unit labels/product names, added empty-product-name inline validation

## In Progress

## Pending

### Phase 2 — Later / Fast-Follow (auto-fetch enhancement)
Goal: once manual-entry MVP ships, layer in best-effort auto-fetch for Shopee/Lazada
links so users can skip manual entry when it happens to work. Deliberately deferred:
scraping is expected to fail or return partial data often (anti-bot, JS-rendered
prices), so it's an enhancement on top of a working product, not a blocker to one.

- Build api/fetch-product.php: cURL fetch with realistic User-Agent + timeout handling
- Build domain-to-currency mapping (Shopee/Lazada TH/MY/SG/PH/VN/ID)
- Build OG tag / JSON-LD parser for product name + price from fetched HTML
- Build currency symbol fallback parser (฿, RM, S$, ₱, ₫, Rp)
- Build manual fallback UI for when auto-fetch fails or returns partial data
- Wire fetch trigger (from Phase 1's plain reference field) to the cURL backend + parsers above, so it actually attempts auto-fetch instead of staying a plain text field
- Manual QA pass: test with real Shopee/Lazada links (TH, MY, SG) to confirm scraping vs. fallback behavior
