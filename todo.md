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

### Phase 2 — Shopee/Lazada auto-fetch (fast-follow to Phase 1)
Goal: best-effort auto-fetch of product name/price/currency from a pasted Shopee/Lazada
link, layered on top of the working manual-entry MVP — never a blocker to manual entry.

- Built api/fetch-product.php: cURL fetch with realistic User-Agent, manual redirect
  loop (5-hop cap, SSRF allowlist re-checked on every hop), timeout + size caps
- Built domain-to-currency allowlist/map (Shopee/Lazada TH/MY/SG/PH/VN/ID)
- Built JSON-LD / OG tag / currency-symbol-regex parser for product name + price,
  with correct VND/IDR thousands-separator normalization
- Built manual fallback UI for when auto-fetch fails or returns partial data
- Wired the fetch trigger to the backend + parsers, non-destructive fill (never
  overwrites user-typed values, never blocks manual submission)
- Live manual QA pass against real Shopee/Lazada links (TH, MY, SG, VN, ID): Lazada
  auto-fetch works end-to-end (name via JSON-LD, price via a tracking-blob regex);
  Shopee is confirmed unfetchable (empty SPA shell) and is short-circuited rather
  than attempted
- Security review (SSRF allowlist correctness, redirect/timeout/size-cap handling,
  data-leakage, deployment readiness) — verdict: ship
- Fixed a real bug: a `shope.ee` shortlink redirecting to Shopee's own generic error
  page could bypass the short-circuit and return placeholder text as a product name

### Phase 2.5 — UX additions (requested mid-build, not in original scope)
- Added an optional shipping-fee field, factored into the per-unit effective price
  (divided by the unit count each promo type implies, so bundle math stays correct)
- Reframed the form as two entry paths: an auto-fetch action first, manual fields
  below a divider
- Replaced the plain paste-link entry point with a "Fetch from clipboard" button
  (Clipboard API), falling back to the manual paste field + button on denied
  permission, an unsupported browser, invalid/empty clipboard content, or a timeout
- Live-tested in browser (not just linted): clipboard timeout/fallback, the
  paste+fetch fallback path against the real backend, and the shipping-fee math/display

## In Progress

## Pending

Nothing currently pending — Phase 1 and Phase 2 (plus the mid-build UX additions) are
both complete and verified.
