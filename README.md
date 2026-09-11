# price-compare

A browser-based tool for comparing product prices — physical items or e-commerce
products — factoring in common promotion types (BOGO, bundle deals, etc.) to find
the actual cheapest option per unit.

## What it does

- Add items manually: name, price, currency, and an optional unit label (e.g. "per bottle").
- Optionally paste a Shopee/Lazada link for your own reference (stored as plain
  text only — no auto-fetching yet, see Roadmap).
- Pick an optional promotion for each item: Buy 1 Get 1 Free, 2nd item 50% off,
  Buy 3 Pay for 2, a fixed bundle price, or a fixed price for the 2nd item.
- Items are grouped by currency (no conversion between currencies) and sorted
  cheapest-effective-price-first, with the best deal in each group highlighted.
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

## Roadmap

Phase 2 (not yet built): auto-fetching product name/price/currency from a pasted
Shopee/Lazada link. See `todo.md` for the full backlog.
