# price-compare

A browser-based tool for comparing product prices — physical items or e-commerce
products — factoring in common promotion types (BOGO, bundle deals, etc.) and
shipping fees, to find the actual cheapest option per unit.

## What it does

- Add offers manually: product name, price, an optional shipping fee, a unit
  size + unit of measure (Milliliters/Liters/Grams/Kilograms/Piece/Sheet),
  and a pack count — enables real cross-pack-size comparison (e.g. 850ml×3
  vs 2200ml×1), not just same-size items.
- Price is the listed price for one purchase, not your total spend — pick a
  promotion (Buy 1 Get 1 Free, 2nd item 50% off, Buy 3 Pay for 2, a fixed bundle
  price, or a fixed price for the 2nd item) and the app works out the real cost
  per unit for you.
- Everything is compared in a single currency, set once via "Comparing in" in
  the header (THB/MYR/SGD/USD/PHP/VND/IDR) — no conversion, so make sure
  whatever you're comparing is actually priced in the same currency.
- Offers of the same product are grouped and ranked together (cheapest
  first), with a relative-cost bar per offer and a plain-language line
  telling you how much more the priciest option costs per litre/kilo/piece.
  A product with only one offer entered shows a simple note instead of a
  false comparison.
- Unusually large unit-size values (e.g. accidentally typing Liters instead
  of Milliliters) get flagged with a warning — non-blocking, just a nudge to
  double-check.
- A live "Preview" in the form shows the computed price-per-unit as you fill
  it in, before you even submit.
- Photo entry: snap a shelf price tag, upload a screenshot of a shopping app,
  or paste one, and the app fills in whatever it can read (product name,
  price, size, pack count). It never overwrites anything you've typed, marks
  each filled field "from photo", and leaves a field blank when it isn't
  sure. Text is read in your own browser with Tesseract.js: no account, no
  per-scan cost, and the photo never leaves your device. Screenshots read
  best. On in-store tags it often can't read very large price digits, so
  expect to type the price yourself.
- Price and Unit size fields have an (i) info button — click to see what each
  field means without permanently taking up form space.
- Product name and Unit of measure both remember your last entry, so
  comparing several offers of the same product doesn't mean retyping either.
- "Clear all" removes every item at once; removing a single item works the
  same way — both give you a 5-second undo instead of a confirmation dialog.
- Items and your chosen currency are saved automatically (via your browser's
  local storage) and reload with you on your next visit.

## Setup

Requires a PHP server (7.4 or newer; production runs 7.4). The only PHP is
`index.php`, with no database or server-side config.

1. Copy the project folder into your MAMP `htdocs/` directory (or copy just
   `dist/` for a deploy-ready, self-contained version).
2. Start MAMP and visit the project in your browser, e.g.
   `http://localhost:8888/workplaces/price-compare/` (adjust the port to your
   MAMP config).
3. No build step, no dependencies to install — it's plain HTML/CSS/JS/PHP.

### Deploying

- Upload `dist/`. After changing any CSS or JS, bump the `?v=` stamp on its
  link in `index.php` (currently `?v=4c2`), or Cloudflare and browsers keep
  serving the old file for hours.
- Photo entry loads files from two outside sites, and only on a visitor's
  first photo: the Tesseract.js script and engine from `cdn.jsdelivr.net`,
  and the Thai/English language data from `tessdata.projectnaptha.com`. No
  image data is sent anywhere. If you ever add a Content-Security-Policy,
  allow both.

## Project structure

- `index.php`, `css/style.css`, `js/app.js` — the app itself
- `js/ocr-extract.js` — turns text read from a photo into form fields (pure
  rules, no network)
- `dist/` — self-contained, deploy-ready copy of the app (upload this via FTP;
  excludes dev-only files)
- `tests/` — dev-only, not included in `dist/`: `mobile-overflow-test.html`,
  `ocr-extract-test.html` (31 extractor cases; open it and look for
  "ALL PASS"), and sample images in `ocr-fixtures/`
- `design-plan-phase4c.md`, `design-preview-phase4c.html` — design reference
  for photo entry (not deployed)
- `todo.md` — task tracker (current phase, roadmap)
- `memory.md` — project decisions/gotchas log
