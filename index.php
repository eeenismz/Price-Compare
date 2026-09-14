<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Price Compare</title>
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css">
</head>
<body>

<header class="site-header">
  <div class="site-header-top">
    <h1>Price Compare</h1>
    <div class="currency-control">
      <span class="currency-control-label">Comparing in</span>
      <span class="currency-select-wrap">
        <select id="app-currency" aria-label="Currency to compare items in">
          <option value="THB">THB</option>
          <option value="MYR">MYR</option>
          <option value="SGD">SGD</option>
          <option value="USD">USD</option>
          <option value="PHP">PHP</option>
          <option value="VND">VND</option>
          <option value="IDR">IDR</option>
        </select>
      </span>
    </div>
  </div>
  <p class="tagline">Add every offer you&rsquo;re weighing. It sorts by what you actually pay per unit.</p>
  <div class="barcode-rule" aria-hidden="true"></div>
</header>

<div class="layout">

  <section class="form-column">
    <details id="item-form-details" open>
      <summary id="item-form-summary">Add an Offer</summary>
      <div class="form-panel-body">
        <form id="item-form" novalidate>

          <div class="field">
            <label for="item-name">Product</label>
            <input type="text" id="item-name" name="item-name" required>
            <p class="field-error" id="name-error" hidden>Please enter a product name</p>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="item-price">Price
                <button type="button" class="info-btn" id="price-info-btn" aria-expanded="false" aria-label="What is Price?">i</button>
              </label>
              <input type="number" id="item-price" name="item-price" inputmode="decimal" step="0.01" min="0" required>
              <p class="tooltip-bubble" id="price-tooltip" role="tooltip" hidden>The pre-promotion price for this one listing. Always the cost for the Pack count units at your chosen Unit size &mdash; never a per-unit price, never post-promotion. If you have a promotion, pick it below and the app will work out the real cost per unit for you.</p>
            </div>
            <div class="field">
              <label for="item-shipping">+ Shipping <span class="optional">(optional)</span></label>
              <input type="number" id="item-shipping" name="item-shipping" inputmode="decimal" step="0.01" min="0" placeholder="0">
            </div>
          </div>
          <p class="helper-text">Sticker price for one purchase — not your total spend.</p>

          <div class="field-row-3">
            <div class="field">
              <label for="item-unit-size">Size
                <button type="button" class="info-btn" id="unit-size-info-btn" aria-expanded="false" aria-label="What is Unit size?">i</button>
              </label>
              <input type="number" id="item-unit-size" name="item-unit-size" inputmode="decimal" step="any" min="0" required>
              <p class="tooltip-bubble" id="unit-size-tooltip" role="tooltip" hidden>The physical size of one unit. For example: 850 (for 850ml), 2.2 (for 2.2kg), or 1 (for 1 piece).</p>
              <p class="field-error" id="unit-size-warning" hidden></p>
            </div>
            <div class="field">
              <label for="item-pack-count">Pack
                <button type="button" class="info-btn" id="pack-count-info-btn" aria-expanded="false" aria-label="What is Pack count?">i</button>
              </label>
              <input type="number" id="item-pack-count" name="item-pack-count" inputmode="numeric" min="1" step="1" value="1" required>
              <p class="tooltip-bubble" id="pack-count-tooltip" role="tooltip" hidden>How many unit-size units this one price covers. For example: 3 for three 850ml pouches, or 1 for a single 2200ml bottle.</p>
            </div>
          </div>

          <div class="unit-compact-wrap">
            <label id="unit-measure-label">Unit</label>
            <div class="unit-pill-group" id="item-unit-measure" role="radiogroup" aria-labelledby="unit-measure-label">
              <button type="button" class="unit-pill" role="radio" aria-checked="false" tabindex="-1" data-value="ml">Milliliters</button>
              <button type="button" class="unit-pill" role="radio" aria-checked="false" tabindex="-1" data-value="l">Liters</button>
              <button type="button" class="unit-pill" role="radio" aria-checked="false" tabindex="-1" data-value="g">Grams</button>
              <button type="button" class="unit-pill" role="radio" aria-checked="false" tabindex="-1" data-value="kg">Kilograms</button>
              <button type="button" class="unit-pill" role="radio" aria-checked="true" tabindex="0" data-value="piece">Piece</button>
              <button type="button" class="unit-pill" role="radio" aria-checked="false" tabindex="-1" data-value="sheet">Sheet</button>
            </div>
          </div>

          <div class="field">
            <label for="item-promo">Promotion</label>
            <select id="item-promo" name="item-promo">
              <option value="none">No promotion</option>
              <option value="bogo">Buy 1 Get 1 Free</option>
              <option value="second50">Second item 50% off</option>
              <option value="buy3pay2">Buy 3 Pay for 2</option>
              <option value="fixedBundle">Fixed bundle price</option>
              <option value="secondFixed">Second item at a fixed price</option>
            </select>
            <p class="helper-text" id="promo-helper"></p>
          </div>

          <div class="field-row promo-extra" id="fixed-bundle-fields" hidden>
            <div class="field">
              <label for="bundle-n">Bundle pack count (N)</label>
              <input type="number" id="bundle-n" name="bundle-n" inputmode="numeric" min="1" step="1">
            </div>
            <div class="field">
              <label for="bundle-x">Total bundle price (X)</label>
              <input type="number" id="bundle-x" name="bundle-x" inputmode="decimal" min="0" step="0.01">
            </div>
          </div>

          <div class="field promo-extra" id="second-fixed-field" hidden>
            <label for="second-fixed-y">Second item&rsquo;s price (Y)</label>
            <input type="number" id="second-fixed-y" name="second-fixed-y" inputmode="decimal" min="0" step="0.01">
          </div>

          <div class="preview-readout">
            <span class="preview-readout-label">Preview</span>
            <span class="preview-readout-value" id="preview-readout-value"><span class="dash">—</span> <span class="unit-part" id="preview-readout-unit">/ piece</span></span>
          </div>

          <div class="field-actions">
            <button type="submit" id="submit-btn" class="btn-primary">Add Offer</button>
            <button type="button" id="cancel-edit-btn" class="btn-cancel" hidden>Cancel</button>
          </div>

        </form>
      </div>
    </details>
  </section>

  <section class="results-column" id="results-column">
    <div id="empty-state" class="empty-state" hidden>
      <p>No items yet &mdash; add your first product above to start comparing.</p>
    </div>
    <div class="results-toolbar" id="results-toolbar" hidden>
      <button type="button" id="clear-all-btn" class="btn-secondary btn-clear-all">Clear all</button>
    </div>
    <div id="results-groups"></div>
  </section>

</div>

<div id="toast" class="toast" hidden>
  <span id="toast-message"></span>
  <button type="button" id="toast-undo" class="toast-undo">Undo</button>
</div>

<script src="js/app.js"></script>
</body>
</html>
