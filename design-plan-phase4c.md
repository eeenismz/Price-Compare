# Design plan — Phase 4c: Photo-assisted entry

Design-only deliverable. Not committed, not wired to code. Preview: `design-preview-phase4c.html`
(open directly in a browser — it loads the real `css/style.css` plus one scoped `<style>` block for the
new pieces only; production files are untouched).

## 1. Where this lives

Reuses the exact placement pattern this project already established for the old Shopee/Lazada
auto-fetch (Phase 2.5, per memory.md): **an action first, a divider, manual fields below** — not a
mode switch/toggle. Concretely: inside the existing `#item-form-details` panel, above the `<form>`,
add a capture bar with two buttons. The manual form underneath is always present, always usable,
never hidden behind the photo flow. That satisfies "manual entry stays default/primary" literally —
there's nothing to opt out of.

```
┌ ADD AN OFFER ──────────────────────────┐
│ [📷 Snap a price tag] [⧉ Upload a screenshot] │
│ or paste a screenshot — ⌘V / Ctrl+V     │
│ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ (tear divider) ╌╌╌╌╌╌╌╌ │
│ Product [_______________]               │
│ Price [__] + Shipping [__]              │
│ Size [__] Pack [__]                     │
│ Unit  ( ml )( l )( g )( kg )(•piece)( sheet ) │
│ Promotion [...]                         │
│ Preview: — / piece                      │
│ [ ADD OFFER ]                           │
└──────────────────────────────────────────┘
```

## 2. Two capture inputs, deliberately different

- **Snap a price tag** → hidden `<input type="file" accept="image/*" capture="environment">`,
  triggered by a real `<button>` (JS `.click()`), same pattern as every other control in `app.js`.
  On mobile this opens the camera directly. On desktop, `capture` is ignored by spec and it just
  falls back to a file picker — accepted, not treated as a bug.
- **Upload a screenshot** → plain hidden `<input type="file" accept="image/*">`, no `capture`
  attribute, so it opens the photo library/file picker normally.
- A third path, paste: a `paste` listener on the form panel accepts a clipboard image the same way
  Phase 2.5's clipboard-fetch did, reusing that precedent rather than inventing a new one.

Both buttons are `<button>` elements (not `<label>` wrappers) to stay consistent with how every
other control in this codebase is built (`info-btn`, `unit-pill`, etc.) — keyboard and focus-visible
behavior falls out of the existing global rule for free.

## 3. States (all five rendered in the preview file, stacked and labeled)

1. **Idle** — two capture buttons + helper text + tear divider + empty/persisted manual form. Default
   state, what most sessions will actually see.
2. **Processing** — the two buttons are replaced (same visual slot, not stacked alongside) by a status
   card: a small thumbnail of the photo just taken, a scan-line sweeping down it, and
   "Reading photo… this can take a few seconds" with a "Cancel" link. `aria-live="polite"` on the
   status card so screen readers get this without hunting for it.
3. **Success — full extraction** — status card flips to a quiet confirmation ("Pre-filled from photo —
   check before adding"), thumbnail collapses to a small chip with "Retake"/"Remove", and every field
   the OCR text actually populated gets a small `from photo` flag next to its label plus a scan-red
   left-edge accent on the input. Fields the photo never had opinions on (Shipping, Promotion) look
   exactly like blank-state — nothing implies they were touched.
4. **Success — partial extraction** — same mechanism, fewer fields flagged (e.g. Product + Size read
   fine, Price didn't — glare on a physical tag is the realistic failure mode here). Proves the
   pre-fill marking is per-field, not all-or-nothing.
5. **Failure / nothing usable** — status card goes neutral (not red/alarming — this is an expected,
   common outcome, not an error state), "Couldn't read that photo — no worries, fill it in below,"
   with "Retake"/"Remove". The manual form underneath is already the plain empty form, already
   focusable, already the exact same thing a user gets from the idle state. Nothing to dismiss, no
   dead end.

## 4. The non-destructive-fill rule (reused, not reinvented)

Same rule Phase 2's auto-fetch already shipped, per memory.md: **never overwrite a field the user has
already typed into.** If someone starts typing a product name, then attaches a photo, OCR only fills
fields that are still blank. This also means re-running capture (Retake) after editing a pre-filled
field won't clobber the user's correction.

## 5. Visual grammar — no new colors

Everything reuses the existing two-accent system and its established meaning, nothing new introduced:

- **scan-red** (`--scan-red`) — already defined in `style.css` as "capture/action states: fetch,
  focus, live state." Used for: the capture button icons, the scan-line sweep, the pre-filled field
  accent/flag. This is exactly the token's intended job — a photo capture is a live/action state.
- **tag-gold** stays reserved for confirm/reward (Add Offer button, Best Value) — deliberately *not*
  used anywhere in the capture flow, since a pre-filled-but-unverified field isn't a confirmed value
  yet.
- Dashed borders on the two capture buttons borrow the app's existing tear/perforation motif (already
  used for the barcode-rule and product-group dividers) to read as "attach here" without reaching for
  a generic drag-and-drop cliché.
- The "screenshot" icon is a set of four corner brackets around two short lines — a deliberate echo of
  this app's existing `[ bracketed ]` mono-chip language (promo chips, `[ Undo ]`), not a generic
  photo/mountain icon.

## 6. Signature element

The **scan-line sweep** across the photo thumbnail while OCR is in flight. It's the one place this
screen earns the "scanner" identity the rest of the app already has (barcode rule, price-tag badge)
by actually *doing* something scanner-like, live, instead of a generic spinner — this is the one
moment of boldness on an otherwise restrained screen. Respects `prefers-reduced-motion`: falls back to
a static mid-position line at reduced opacity, no motion, same information conveyed by the text next
to it either way.

## 7. Failure handling, explicitly

Per this project's own history (memory.md — Shopee auto-fetch's "try then fail" flow was frustrating
enough that the user had it removed entirely for that feature), the failure state here is deliberately
low-stakes:
- Never a modal, never a thrown error, never a blocked submit button.
- Plain, un-alarming language, no red/error styling — this is a *possible outcome*, not a mistake the
  user made.
- No retry pressure — "Retake" is offered, but the manual form is just as ready to use as if photo
  capture were never attempted.
- Timeout: if the OCR call runs long (~12s+), the status subtext updates in place to note it may take
  a bit longer, Cancel stays available throughout; past ~20s it's treated the same as a failure.

## 8. Assumptions (flagging, not guessing silently)

- The OCR proxy is assumed to return a loose, partially-nullable shape —
  `{name?, price?, unitSize?, unitOfMeasure?, packCount?, shippingFee?}` — and this design treats every
  field as independently optional. The backend/regex-heuristic parsing itself is explicitly out of
  scope for this design (owned by the parked Phase 4c backend work, not touched here).
- `unitOfMeasure` only gets a `from photo` flag if OCR actually mapped to one of the six known values
  (ml/l/g/kg/piece/sheet) with enough confidence; otherwise the pill group is left exactly as its
  normal default (currently "Piece" per existing HTML) with no flag — a wrong silent guess here would
  be worse than no guess, consistent with this project's existing plausibility-warning stance (flag,
  don't force).
- Todo.md currently lists Phase 4c as parked pending an Azure account/API key. This design is ready to
  hand to fast-worker whenever that unblocks — nothing here assumes the key exists yet.
