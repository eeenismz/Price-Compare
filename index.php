<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Price Compare</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css">
</head>
<body>

<header class="site-header">
  <h1>Price Compare</h1>
  <p class="tagline">Add items manually and find the best deal &mdash; this session only.</p>
</header>

<div class="layout">

  <section class="form-column">
    <details id="item-form-details" open>
      <summary id="item-form-summary">Add Item</summary>
      <div class="form-panel-body">
        <form id="item-form" novalidate>

          <p class="form-hint">Copy a Shopee or Lazada product link, then tap below to auto-fill the fields &mdash; or enter the details manually.</p>

          <button type="button" id="fetch-clipboard-btn" class="btn-secondary">Fetch from clipboard</button>
          <p class="helper-text" id="fetch-status" aria-live="polite"></p>

          <div id="link-fallback" hidden>
            <div class="field">
              <label for="item-link">Reference link <span class="optional">(optional)</span></label>
              <input type="text" id="item-link" name="item-link" placeholder="Paste Shopee/Lazada link (optional)">
              <button type="button" id="fetch-details-btn" class="btn-secondary">Fetch details</button>
            </div>
          </div>

          <div class="form-divider"><span>or enter manually</span></div>

          <div class="field">
            <label for="item-name">Product name</label>
            <input type="text" id="item-name" name="item-name" required>
            <p class="field-error" id="name-error" hidden>Please enter a product name</p>
          </div>

          <div class="field-row">
            <div class="field field-price">
              <label for="item-price">Price</label>
              <input type="number" id="item-price" name="item-price" inputmode="decimal" step="0.01" min="0" required>
            </div>
            <div class="field field-currency">
              <label for="item-currency">Currency</label>
              <select id="item-currency" name="item-currency">
                <option value="THB">THB</option>
                <option value="MYR">MYR</option>
                <option value="SGD">SGD</option>
                <option value="USD">USD</option>
                <option value="PHP">PHP</option>
                <option value="VND">VND</option>
                <option value="IDR">IDR</option>
              </select>
            </div>
          </div>

          <div class="field">
            <label for="item-shipping">Shipping fee <span class="optional">(optional)</span></label>
            <input type="number" id="item-shipping" name="item-shipping" inputmode="decimal" step="0.01" min="0">
          </div>

          <div class="field">
            <label for="item-unit">Quantity / unit label <span class="optional">(optional)</span></label>
            <input type="text" id="item-unit" name="item-unit" placeholder="e.g. per bottle, per 100g">
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
              <label for="bundle-n">Number of units (N)</label>
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

          <div class="field-actions">
            <button type="submit" id="submit-btn" class="btn-primary">Add Item</button>
            <button type="button" id="cancel-edit-btn" class="btn-cancel" hidden>Cancel</button>
          </div>

        </form>
      </div>
    </details>
  </section>

  <section class="results-column" id="results-column">
    <div id="mismatch-banner" class="mismatch-banner" hidden></div>
    <div id="empty-state" class="empty-state" hidden>
      <p>No items yet &mdash; add your first product above to start comparing.</p>
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
