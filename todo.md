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

### Phase 3 — Dark redesign + single-currency simplification (requested mid-build)
- Product-designer produced a design plan + standalone preview (scanner/price-tag
  terminal concept, dark palette, Big Shoulders/IBM Plex Sans/IBM Plex Mono) — reviewed
  and confirmed before any production files were touched
- Removed per-item currency entirely: one global "Comparing in [THB ▾]" setting in
  the header instead, session-only in memory; comparison view is now a single flat
  sorted list (no currency grouping, no mismatch banner)
- Currency-mismatch handling on fetched items: still auto-fills name/price (never
  blocks), but flags a mismatch in the fetch-status message and tags the added item
  with a small persistent inline note (e.g. "Priced in MYR when added")
- Ported the full dark visual system into production (index.php/css/style.css):
  die-cut price-tag "Best Value" badge, bracketed mono promo chips, barcode-strip and
  tear-line dividers, scan-red/tag-gold accents, colored focus glows instead of grey
  shadows
- Live-tested in browser: card rendering, Best Value/shipping math, the header
  currency switcher re-rendering without reinterpreting existing items
- Fixed a real bug found post-redesign: `.toast` and `.field-row` both set an explicit
  `display`, which silently overrode the browser's default `[hidden]` behavior —
  the Undo toast never actually hid, and the bundle-promo fields showed regardless of
  promotion selected. Fixed with one defensive `[hidden] { display: none !important; }`
  rule rather than patching each element
- Fixed a real bug found via live user testing: the domain allowlist had a
  non-existent `shope.ee` instead of Shopee's actual native share-link domain
  `shp.ee` (e.g. `th.shp.ee`), so real Shopee shortlinks were wrongly rejected as
  "unsupported domain" instead of correctly short-circuiting with the expected
  "Shopee pages can't be read automatically" message

### Phase 3.5 — Post-redesign fixes and small UX requests
- Confirmed no regression: re-tested the exact Shopee link the user hit issues with
  directly against the endpoint and live in browser — correctly returns the expected
  "blocked" response with currency set from the domain; the earlier report was the
  Shopee-is-unfetchable behavior working as designed, not a new bug
- Live-verified Lazada auto-fetch still works end-to-end with a real product link
  pulled fresh from Lazada TH's sitemap (name + price filled in correctly)
- Product name now pre-fills with the last-added name on the next "Add Item" (instead
  of staying blank) — comparing multiple offers of the same product no longer means
  retyping the name each time; still fully editable for a different product
- Added a "Clear all" button (results toolbar, only shown when items exist) using the
  same non-blocking 5-second undo-toast pattern as single-item remove, per this
  project's established no-confirm-dialogs decision (see memory.md)
- Live-tested in browser: name pre-fill across two sequential adds, Clear all removing
  everything, and Undo restoring the full list

### Phase 3.6 — Favicon
- Generated favicon-32x32.png, favicon-16x16.png, and a properly-sized 180x180
  apple-touch-icon.png from the user-supplied source image (sips, no new deps)
- Added the corresponding `<link>` tags to index.php's `<head>`
- Synced dist/ with the updated index.php and all three favicon files

### Phase 3.7 — Real quantity math (bug found via user testing)
- User caught the app recommending a worse deal (43.00/pack bundle) over a better
  one (79 for 2 cups = 39.50/cup) because the old "Quantity / unit label" field was
  purely a cosmetic text suffix — typing "2" there never divided the price
- Split it into two fields: a real numeric Quantity (defaults to 1, divides Price
  when Promotion = "No promotion") and a separate cosmetic Unit label; Quantity
  auto-disables when any Promotion is selected, since the promotion already defines
  its own unit count (avoids double-counting)
- Fixed a bug caught during live testing: `units()` was updated to read the new
  quantity but `compute()` (the function that actually produces the effective
  price) wasn't, so the price silently never got divided until traced in-browser
- Card display now reads "79.00 for 2" instead of "79.00 · 2" so the quantity's
  effect on price is visible, not just a trailing label
- Live-tested in browser: reproduced the user's exact noodles example end-to-end
  (79 for 2 vs. 129 for 3), confirmed 39.50 now correctly wins Best Value; also
  confirmed Quantity visibly disables/greys out when a promotion is selected

### Phase 3.8 — Tooltip helper text + promo chip detail (requested from user testing)
- Converted the long Price and Quantity helper paragraphs (which were pushing the
  form out of shape) into a small "i" info button next to each label; click to
  toggle a tooltip bubble, click elsewhere or Escape to close, only one open at a
  time. Promotion's helper text stayed as a static one-liner (user's choice — it's
  short and useful to see live while filling bundle fields)
- Promo chips on result cards now spell out the actual deal instead of the generic
  promo name: "[3 for 129.00]" instead of "[Fixed bundle price]", "[2nd item at
  X.XX]" instead of "[Second item at a fixed price]" (bogo/second50/buy3pay2 chips
  unchanged — their labels already fully describe the deal, no hidden params)
- Quantity-based cards (no promotion, Quantity > 1) now get a matching "[Qty N]"
  chip for the same visual treatment as promo-based cards
- Live-tested in browser: tooltip toggle/close-on-outside-click behavior, both new
  chip formats, and re-confirmed the Phase 3.7 39.50-vs-43.00 comparison still
  computes correctly

### Phase 3.9 — Shipping fee field reorder (requested mid-build)
- Moved the "Shipping fee" field in index.php from directly under Price to
  directly under the Promotion fields (after any promo-specific conditional
  fields, before the Add Item button) — markup-order-only change, no JS/CSS
  logic touched
- Synced dist/index.php
- Live-tested in browser: field order with no promotion selected, and with
  "Fixed bundle price" selected (shipping correctly appears after the bundle
  N/X fields, not sandwiched between Promotion and its conditional fields)

### Phase 4a — Unit-price data model rewrite (spec received 2026-09-13)
- Replaced "Quantity" + free-text "Unit label" with structured Unit size
  (number) + Unit of measure (dropdown: ml/l/g/kg/piece/sheet) + Pack count
  (number, default 1) — enables real cross-pack-size comparison (e.g. 850ml×3
  vs 2200ml×1), which the old free-text field couldn't do
- "Price" now always means the pre-promotion price for one listing (Pack count
  units) — clarified in the field's own tooltip, never a total-after-promo or
  already-divided figure
- New `pricePerBaseUnit`, normalized per-100ml/100g (volume/mass families) or
  per-piece/per-sheet, replaces raw effective price for sorting and Best Value
- Items in incompatible unit families (e.g. ml vs piece) are grouped separately
  with a warning banner instead of a forced/misleading Best Value
- Promo chips render as plain language with the resolved price baked in (e.g.
  "Buy 3, pay for 2 → THB155.33/100ml") instead of the old `[Buy 3 Pay for 2]`
  debug-style string
- Pack count disables only for the Fixed bundle promo (its own N/X replace
  Price and Pack count entirely) — all other promo types (BOGO, 2nd item 50%
  off, buy3pay2, 2nd item fixed price) keep Pack count enabled and compose
  with it as an independent multiplier (see memory.md decision)
- Live-tested in browser: the 850ml×3-vs-2200ml×1 core scenario, ml/l and g/kg
  conversion, the classic 79-for-2-vs-129-for-3 noodles regression (still
  correctly picks 39.50 over the bundle's 43.00), BOGO+Pack-count composition
  (180 for a 6-pack BOGO → 15.00/piece), incompatible-unit warning + per-family
  grouping, and the info-tooltip toggles (no `[hidden]`/`display` regression)
- Fixed a real bug found via live testing: the "Unit of measure" `<select>` had
  no `selected` option, so it silently showed "ml" on first page load despite
  the JS intending "piece" as the default (see memory.md)
- Fixed a real bug found via live testing: the results card's "original price"
  line always showed `item.price` even for Fixed bundle items, where `price`
  is completely unused by the actual math — misleadingly implying it was the
  charged price when it wasn't (see memory.md)
- Updated `tests/mobile-overflow-test.html` (it referenced the now-removed
  `item-unit` field) to stress-test a long product name + Fixed bundle promo
  instead of a long free-text unit label — still passes at 375px, 0px overflow

### Phase 4b — Client-side persistence
- Items and the app-wide currency now persist via `localStorage` (key
  `priceCompareState`), saved immediately on every mutation — add, edit,
  remove (storage clears right away; the 5-second Undo toast is a pure
  in-memory splice-back on top), Clear all, and both undo paths
- Per-item validation on load (`isValidItem()`) skips any individual stored
  record that doesn't match the current shape (correct types, known
  `unitOfMeasure`/promo `type`, positive `unitSize`/`packCount`) rather than
  failing the whole load — no old data format exists to migrate since the app
  was session-only before this, this is purely a corruption guard
- Reads and writes both wrapped in try/catch so a `localStorage` throw (quota,
  private-mode restrictions) degrades to in-memory-only for that session
  instead of crashing
- No cross-tab live sync (each tab reads storage on its own load only) — not
  in scope
- Live-tested in browser: item + currency survive a hard refresh, an item
  removal is gone from storage immediately (independent of the Undo toast
  timing), corrupted JSON in storage falls back cleanly to the empty state,
  and a malformed individual record (old field shape) is skipped while a
  valid record alongside it still loads correctly
- Updated the stale top-of-file comment and the header tagline ("this session
  only"), both of which were no longer accurate once persistence landed

## In Progress

## Pending

### Phase 4c — Photo-assisted entry + Azure AI Vision OCR proxy (parked 2026-09-13)
Two capture modes (shopping-app screenshot vs in-store photo), a server-side
PHP proxy to Azure AI Vision's Read API (key never in client JS), client-side
regex/heuristic extraction (not a second LLM call, to avoid an unnamed second
paid dependency), and a review-UI that reuses the Phase 4a Add-Item form
directly rather than a parallel code path. Parked indefinitely at the user's
call — Phase 4a (unit-price rewrite) and 4b (persistence) covered the pain
points that mattered most; needs an Azure account/API key to pick back up.
Full design notes are in the session that produced this plan (2026-09-13),
not yet re-summarized here.

## Pending (not yet scheduled — out of scope for this pass per spec)
- User accounts / login
- Cross-store price history over time
- Barcode scanning
