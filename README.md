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
- Price and Unit size fields have an (i) info button — click to see what each
  field means without permanently taking up form space.
- Product name and Unit of measure both remember your last entry, so
  comparing several offers of the same product doesn't mean retyping either.
- "Clear all" removes every item at once; removing a single item works the
  same way — both give you a 5-second undo instead of a confirmation dialog.
- Items and your chosen currency are saved automatically (via your browser's
  local storage) and reload with you on your next visit.

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
