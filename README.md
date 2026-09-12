# price-compare

A browser-based tool for comparing product prices — physical items or e-commerce
products — factoring in common promotion types (BOGO, bundle deals, etc.) and
shipping fees, to find the actual cheapest option per unit.

## What it does

- Add items manually: name, price, an optional shipping fee, a quantity
  (defaults to 1 — divides the price when no promotion is picked, e.g. price
  79 with quantity 2 becomes 39.50 each), and an optional unit label purely
  for display (e.g. "per bottle").
- Price is the listed price for one purchase, not your total spend — pick a
  promotion (Buy 1 Get 1 Free, 2nd item 50% off, Buy 3 Pay for 2, a fixed bundle
  price, or a fixed price for the 2nd item) and the app works out the real cost
  per unit for you. Quantity is disabled while a promotion is selected, since
  the promotion already defines its own unit count.
- Everything is compared in a single currency, set once via "Comparing in" in
  the header (THB/MYR/SGD/USD/PHP/VND/IDR) — no conversion, so make sure
  whatever you're comparing is actually priced in the same currency.
- Items show as one flat list, sorted cheapest-effective-price-first, with the
  best deal highlighted; each card's promotion or quantity tag spells out the
  actual deal (e.g. "3 for 129.00", "Qty 2") instead of a generic label.
- Price and Quantity fields have an (i) info button — click to see what each
  field means without permanently taking up form space.
- The product name field remembers what you last typed, so comparing several
  offers of the same product doesn't mean retyping the name each time.
- "Clear all" removes every item at once; removing a single item works the
  same way — both give you a 5-second undo instead of a confirmation dialog.
- Everything lives in memory for the current page load only — nothing is saved
  between visits.

## Setup

Requires a local PHP server (built and tested against MAMP's PHP 8.2).

1. Copy the project folder into your MAMP `htdocs/` directory (or copy just
   `dist/` for a deploy-ready, self-contained version).
2. Start MAMP and visit the project in your browser, e.g.
   `http://localhost:8888/workplaces/price-compare/` (adjust the port to your
   MAMP config).
3. No build step, no dependencies to install — it's plain HTML/CSS/JS/PHP.

## Project structure

- `index.php`, `css/style.css`, `js/app.js` — the app itself
- `dist/` — self-contained, deploy-ready copy of the app (upload this via FTP;
  excludes dev-only files)
- `tests/` — a dev-only regression test (`mobile-overflow-test.html`), not
  included in `dist/`
- `todo.md` — task tracker (current phase, roadmap)
- `memory.md` — project decisions/gotchas log
