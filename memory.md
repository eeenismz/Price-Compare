# Memory

## Decisions
- 2026-09-11: Merged the "item list" and "comparison view" into one currency-grouped list (sorted cheapest-first per group) with inline Edit/Remove, instead of two separate lists — avoids re-reading the same numbers twice on a small screen while shopping.
- 2026-09-11: All prices and currency codes render in monospace (IBM Plex Mono), right-aligned, as the app's visual signature — supports fast numeric scanning in-store rather than generic form styling.
- 2026-09-11: One form component serves both Add and Edit (pre-filled, button label/heading swap) instead of a separate edit UI, to avoid maintaining duplicate markup.
- 2026-09-11: MVP (Phase 1) ships with manual entry only — no Shopee/Lazada scraping. Reason: those sites block most server-side fetches, so a working comparison tool must not depend on auto-fetch succeeding. Scraping is Phase 2 per todo.md.

## Rejected Approaches
- 2026-09-11: Confirm dialog on item removal — rejected in favor of a 5-second undo toast, since this is a single-session low-stakes tool and a blocking dialog slows down repeated add/remove while comparing items in a shop.

## Gotchas
- 2026-09-11: A flex-layout bug (`.item-card-price` had `flex-shrink:0`, `.item-original` had `white-space:nowrap`) only surfaced with long unit labels/product names at mobile width. The builder's own automated pass missed it because it tested with typical short values; independent QA caught it by deliberately trying a long unit label. Worth testing long/edge-length text specifically for any future layout work here.
- 2026-09-11: Project has a GitHub repo connected (github.com/eeenismz/Price-Compare) set up outside Claude Code, with a GitHub-default README already committed before this session's rewrite — not something Claude Code initialized. No .gitignore existed yet; one was added per the Rule 9 baseline before the first commit through this workflow.
