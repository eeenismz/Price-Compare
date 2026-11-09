# Design plan - Phase 5: Visual + UX redesign (Milestone 1, design only)

Preview: `design-preview-phase5.html` (http://localhost:8888/workplaces/price-compare/design-preview-phase5.html).
Open "Preview controls" at the top to switch direction (A/B/C), sheet state (closed / default / expanded / photo scan)
and data (sample / empty / long-text stress test). No production file was touched.

## 1. UX audit of the current in-store flow

Typical offer: "Breeze detergent, 2200 ml, 169 baht" as a second offer of a product already on the list.

Today, step by step (phone, 375px):
1. Scroll to the top. The form is the first thing on the page and the results sit below it.
2. Form shows 2 capture buttons + helper line + a "Manual entry" divider + Product, Price, Shipping, Size, Pack,
   6 unit pills, Promotion, Preview, Add = 8 inputs + 6 pills + 2 photo buttons visible at once, roughly 1.5 to 2 screens tall.
3. Product is remembered, unit is remembered. Tap Price, type. Tap Size, type. (Tap unit only if it differs.) Tap Add Offer.
   That is 3 taps + 2 typed fields for the best case, 5 taps + 3 typed fields for a new product.
4. The form stays open. Results are below the fold, so to see the verdict you scroll down, then scroll back up for the next offer.
5. Adding shipping or a promo: scroll past Size/Pack/Unit, change Shipping and Promotion (2 to 3 more taps).

Pain points:
- No thumb zone: the primary action (Add Offer) is at the bottom of a 2-screen form; the verdict is below that.
- Form and answer are never on screen together. The product's whole point (who wins) needs a scroll.
- Eight fields compete equally, but 4 matter for almost every offer (product, price, size, unit). Shipping, pack and promo
  are the exception, yet they look as important as Price.
- Four layers of helper text per field: (i) tooltips, a helper under Price, a helper under Promotion, a "Manual entry" divider,
  a tagline, a barcode rule. The cluttered feel comes from these, not from the features.
- Photo entry is two big buttons at the top of the form, taking about 110px even for people who type.
- Visual: dark terminal look; low contrast for small grey text in bright store light.

Count today: new product = 5 taps / 4 entries; additional offer = 3 taps / 2 entries + 2 scrolls; promo+shipping = +3 taps.

## 2. Visual directions

Common point of view: "the unit price is the hero". Every direction treats the winner's price per unit as the biggest
thing on screen; everything else is supporting text. All are light, all are plain CSS variables so they switch with one attribute.

| | A. Aisle (recommended) | B. Fresh Market | C. Swiss Receipt |
|---|---|---|---|
| Mood | Clean supermarket signage: cool grey canvas, white cards, one confident blue action | Friendly grocery: mint tint, big rounded cards, tomato action | Print-like, stark, screenshot-friendly: white, black rules, one orange |
| canvas / surface | #EEF1F6 / #FFFFFF | #EAF3EC / #FFFFFF | #FFFFFF / #FFFFFF |
| ink / muted / line | #0F1B2D / #5B6678 / #DCE1EA | #12301F / #546B5C / #CFE0D3 | #111111 / #6A6A6A / #E2E2E2 |
| accent (actions) | #2447F5 | #E2452B | #FF5A1F |
| win (Best Value) | #0B8A55 on #DFF4E9 | #17803F on #D8F1DF | #111111 on #FFE9DF |
| warn | #9A5200 on #FFF0DA | #8F4B00 on #FFEFD6 | #8A4300 on #FFF0DA |
| Type | Bricolage Grotesque 800 (numerals, headings) + Figtree (UI) | Outfit + Nunito Sans | Archivo 800/500, uppercase buttons |
| Radius | 16px | 22px | 4px |
| Why | Reads as a trustworthy tool, green/blue contrast makes the winner obvious at arm's length | Warmest and most approachable, but red action next to green win can read as "error" | Most "professional/shareable", but least friendly one-handed and plainest |

Recommendation: A. Blue for "do something", green only for "this is the answer", amber only for "check this".
Colour is never the only signal: Best Value also has a badge and the winner is first. Contrast: ink on white about 16:1,
muted #5B6678 on white about 5.8:1, white on #2447F5 about 6.5:1 (all pass AA).
Avoided on purpose: dark mode, cream + serif, terracotta, acid-on-black.

Signature of A: the winning offer is a green "shelf tag" with a punched hole on its left edge and the price at 34px;
the other offers get smaller grey bars scaled against the priciest, with "+฿15.25 vs best" under each.

## 3. Proposed flow

Layout (phone): results are the home screen. A fixed bottom dock holds [camera] [+ Add offer], in the thumb zone.
Add offer opens a bottom sheet. On screens >= 900px the sheet becomes a permanent right column (no dock).

```
 HOME (results first)            SHEET default             SHEET expanded
+--------------------+        +--------------------+    +--------------------+
| Price.Compare in THB ⋯|      | Add an offer     x |    | ...Unit row...     |
| Breeze Detergent  3|        | [Scan tag][Screenshot]|  | [Pack, shipping, promo ^]|
| [BEST VALUE  ฿58.86]|       | Product [remembered] |    | Pack  [-] 1 [+]    |
|  Qty 3      ฿74.12 |        | Price [__]  Size [__]|    | Shipping [__]      |
|  2200ml     ฿76.82 |        | Unit ml L g kg pc sheet| | Promotion [select] |
| Jasmine rice     2 |        | [Pack, shipping, promo v]| -------------------|
|                    |        |--------------------|    | Preview ฿58.86 / L |
| [cam] [+ Add offer]|        | Preview  ฿-- / L   |    | [   Add offer   ]  |
+--------------------+        | [   Add offer   ]  |    +--------------------+
```

Visible by default in the sheet: Product (pre-filled with last), Price, Size, Unit, live Preview, Add. That is 4 inputs
instead of 8 plus 6 pills. Behind one disclosure ("Pack, shipping, promotion", with a summary line such as "pack 3, promo"
so a set value is never hidden): Pack stepper, Shipping, Promotion (+ N/X or Y fields as today).

Enter/Next on the phone keypad moves Product -> Price -> Size (enterkeyhint). Price field autofocuses on open.
Photo entry: camera button in the dock (one tap from home: opens the sheet and starts the camera), plus "Scan price tag" /
"Use a screenshot" / paste inside the sheet. After a scan the two buttons are replaced by the existing status card, fields get a
"from photo" tag, price stays blank when unread (existing behaviour). No separate flow, no mode switch.
Results: tap an offer to reveal Edit / Remove (disclosure replaces permanent buttons on every row). Add or Save closes the sheet and
the new offer appears already ranked, with a toast "Offer added".

Count after: new product = 1 (Add offer) + name + price + size + unit if different + Add = 5 taps / 4 entries
(same as today, but no scrolling and the verdict is visible the moment the sheet closes).
Additional offer, same product: Add offer, price, size, Add = 4 taps / 2 entries, 0 scrolls (today 3 taps + 2 scrolls). With keypad
Next the hands do not leave the keypad between price and size. Promo+shipping: +1 tap to open the disclosure, then same fields
(today: scroll + same fields). Honest summary: taps are roughly equal, the savings are 0 scrolls, 4 visible inputs instead of 8,
the answer always on screen, and the primary actions in thumb reach.
Optional idea (not in preview, needs approval): ghost-fill Size and Unit from the last offer of the same product as grey placeholder
text, since stores often sell the same product in similar sizes. Would cut one more entry in some cases.

## 4. Change list

Kept (unchanged behaviour): all price math (compute, units, computeItemPrice), all 5 promo types and their extra fields, shipping,
pack count, 6 units + remembered unit and name, plausibility warning, live Preview, grouped per-product ranking, relative-cost bars,
insight sentence, single-offer note, incompatible-units note, derived offer labels, undo toast for remove and clear all, photo entry
(Snap, Upload, Paste, status card, "from photo" tags, never overwrite), localStorage, currency setting.

Moved: form from page top to a bottom sheet (side column on wide screens); results become the home view; Photo buttons from the top of
the form to a camera button in the dock plus compact buttons in the sheet; Clear all from the results toolbar to a header overflow menu;
Currency from a labelled control to a compact "in THB" chip; Edit/Remove from every row to reveal-on-tap; Preview line moved next to the Add button.

Merged: Price + Size in one row, Pack/Shipping/Promotion into one disclosure; the (i) tooltips for Price/Size/Pack into short hint lines
that sit inside the disclosure or as placeholders (same wording, shorter); capture helper + paste note into one line.

Hidden (progressive disclosure): Pack, Shipping, Promotion and its N/X/Y fields; Edit/Remove until an offer is tapped.

Visual changes needing the user's eye (not removals): unit pills show short labels (ml, L, g, kg, pc, sheet) in one row with the full word
shown below and in aria-label; the six full words no longer fit one row at 375px. Light theme replaces dark.

Proposed for removal (NEED USER APPROVAL, nothing is removed until then):
1. Header tagline ("Add every offer you're weighing...") - replaced by a one-line lede shown only when there are results.
2. Barcode-rule decorative divider.
3. "Manual entry" divider label (no longer needed once photo buttons are compact).
4. The three (i) info buttons and tooltip bubbles (replaced by hint lines; same content).
5. Permanent "Sticker price for one purchase - not your total spend" helper under Price (moved into the Promotion hint).
6. Big separate "Upload a screenshot" and "Snap" large buttons as first thing in the form (replaced by the dock camera + sheet chips).
New feature suggestion, NOT included, needs approval: a "Share" action (copy a text summary or image of the comparison). It supports the
"shareable" goal, but is new scope. The design is screenshot-friendly already.

## 5. Light-only vs light+dark

Recommend light only for now. Reasons: the user asked to move away from dark; shop lighting is bright and light reads better outdoors;
one theme halves the QA surface. If wanted later, add a `prefers-color-scheme: dark` token set (tokens are already variables) as a separate
phase, and remember the STACK rule: set `select option` colours explicitly on dark themes.

## 6. Implementation notes for the builder (fast-worker)

Affected in `index.php`: header (tagline, barcode-rule removed, currency chip, overflow menu); `<section class="form-column"><details id="item-form-details">`
becomes the sheet (role dialog) with the dock + scrim added; the capture block (`#capture-idle`, `#capture-status`, hidden file inputs) moves
into the sheet unchanged in IDs; `.field-row`/`.field-row-3` replaced by a Price/Size row and a `#more` disclosure holding Pack, Shipping, Promotion
and the promo-extra fields; `.results-toolbar` Clear all moves to the menu. Keep every existing element ID that app.js reads.

Affected in `js/app.js` (UI only; do not touch compute/units/computeItemPrice or `ocr-extract.js`):
`resetForm()` (also closes/prepares sheet, keeps lastProductName/lastUnit), `startEdit()` (open sheet instead of expanding the details),
the submit handler (close sheet + toast after add), `renderResults()` (offer row markup: Edit/Remove reveal on tap, winner "shelf tag" class,
delta line), `updatePreview()` (target moved), `updatePromoUI()` (also update the disclosure summary), tooltip/info-button code (removed if
item 4 is approved), `showCaptureStatus()/showIdle()` (same states, new container), Clear all wiring (menu), plus new small code: open/close sheet with focus
management and Esc, a `>=900px` matchMedia to keep the sheet always open, enterkeyhint/Enter-advance.

Risks:
- Memory gotcha `[hidden]`: the sheet, scrim, dock, menu, toast, `.more`, `.scan`, `.err` all set `display` somewhere. The preview
  carries `[hidden]{display:none!important}`; keep it.
- Memory gotcha long text: the preview was checked with a long product name and 12345.5 kg / bundle values at 375px (no overflow). Keep
  `min-width:0` on grid children and `overflow-wrap:anywhere` on names, labels and details. Re-run `tests/mobile-overflow-test.html`.
- Photo flags clear only on `isTrusted` input events (kept in the preview). A hidden form (collapsed disclosure) must still be readable by the
  extractor: fill values into the DOM inputs even when `#more` is hidden.
- `inert`/focus: the closed sheet must not be tabbable; on iOS Safari `position:fixed` bottom elements and the on-screen keyboard can shift: use
  `dvh`, keep the sheet footer inside the sheet, and test on a real phone.
- Selected promo or non-default pack must show in the disclosure summary, otherwise a hidden value silently changes the result (error-prevention).
- Bump `?v=` on css/js links (Cloudflare 4h cache) and rebuild `dist/`.
- Unit pills: roles/arrow-key behaviour kept; only labels change.
- The preview's `calc()` is a stand-in for the real compute(); numbers in the preview are illustrative.
- Google Fonts: swap to Bricolage Grotesque + Figtree; drop Big Shoulders/IBM Plex families to avoid extra requests. `color-mix()` in focus
  ring needs a fallback colour for older browsers.
