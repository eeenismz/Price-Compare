<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content">
<title>Price Compare</title>
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css?v=6a2">
</head>
<body>

<div class="app">

  <header class="top">
    <h1 class="brand">Price<span>.</span>Compare</h1>
    <div class="top-actions">
      <label class="cur" for="app-currency"><span class="cur-l">in</span>
        <select id="app-currency" aria-label="Currency to compare items in">
          <option value="THB">THB</option>
          <option value="MYR">MYR</option>
          <option value="SGD">SGD</option>
          <option value="USD">USD</option>
          <option value="PHP">PHP</option>
          <option value="VND">VND</option>
          <option value="IDR">IDR</option>
        </select>
      </label>
      <button type="button" class="icon-btn" id="menu-btn" aria-haspopup="true" aria-expanded="false" aria-controls="menu" aria-label="More actions" hidden>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
      </button>
      <div class="menu" id="menu" hidden>
        <button type="button" id="clear-all-btn">Clear all offers</button>
      </div>
    </div>
  </header>

  <p class="lede" id="lede" hidden>Cheapest per unit comes first. Tap an offer for edit and remove.</p>

  <!-- Results: the home screen -->
  <section class="results-column" id="results-column">
    <div id="empty-state" class="empty" hidden>
      <h2>Nothing to compare yet</h2>
      <p>Tap <b>Add offer</b>, or scan a price tag. Add two offers of the same product to see which is cheaper per unit.</p>
    </div>
    <div id="results-groups"></div>
  </section>

  <!-- Add / edit sheet: bottom sheet on phones, side column at 900px and up -->
  <section class="sheet" id="item-sheet" role="dialog" aria-labelledby="sheet-title" aria-modal="false">
    <div class="sheet-head">
      <h2 id="sheet-title">Add an offer</h2>
      <button type="button" class="icon-btn sheet-close" id="sheet-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <div class="sheet-body">

      <!-- Photo-assisted entry: chips sit above the form, the status card replaces them while a photo is attached -->
      <div id="capture-idle">
        <div class="capture-bar">
          <button type="button" class="chip-btn" id="snap-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
              <circle cx="12" cy="13" r="3.2"/>
            </svg>
            Scan price tag
          </button>
          <button type="button" class="chip-btn" id="upload-btn">Use a screenshot</button>
          <button type="button" class="chip-btn" id="barcode-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <path d="M4 6v12M7.5 6v12M11 6v12M13.5 6v12M17 6v12M20 6v12"/>
            </svg>
            Scan barcode
          </button>
        </div>
        <p class="capture-helper">Or paste a screenshot (&#8984;V / Ctrl+V). We fill what we can read; you check it.</p>
      </div>

      <!-- Barcode number entry: replaces the chips while open. A barcode fills name and size, never the price. -->
      <div class="field barcode-entry" id="barcode-entry" hidden>
        <label for="barcode-input">Barcode number</label>
        <div class="barcode-entry-row">
          <input type="text" id="barcode-input" inputmode="numeric" autocomplete="off" maxlength="24" placeholder="Barcode digits" enterkeyhint="go" aria-describedby="barcode-error">
          <button type="button" class="btn-status-sm" id="barcode-go">Look up</button>
          <button type="button" class="btn-status-sm" id="barcode-cancel">Cancel</button>
        </div>
        <p class="field-error" id="barcode-error" hidden>That isn&rsquo;t a product barcode. Check the digits under the bars.</p>
        <p class="hint" id="barcode-entry-note" hidden>Camera scanning isn&rsquo;t available here, so type the digits under the bars.</p>
      </div>

      <!-- Barcode camera: live view, read by the browser's own barcode reader where it has one -->
      <div class="barcode-cam" id="barcode-cam" hidden>
        <div class="barcode-cam-view">
          <video id="barcode-video" playsinline muted aria-label="Camera view"></video>
          <div class="barcode-cam-line" aria-hidden="true"></div>
        </div>
        <p class="capture-helper" id="barcode-cam-help" aria-live="polite">Hold the barcode inside the frame.</p>
        <div class="capture-status-actions">
          <button type="button" class="btn-status-sm" id="barcode-cam-type">Type the number</button>
          <button type="button" class="btn-status-sm" id="barcode-cam-cancel">Cancel</button>
        </div>
      </div>

      <!-- Hidden file pickers: the chips and the dock camera call .click() on these -->
      <input type="file" id="snap-input" accept="image/*" capture="environment" hidden>
      <input type="file" id="upload-input" accept="image/*" hidden>

      <!-- Status card: replaces the chips while a photo is attached -->
      <div class="capture-status-card" id="capture-status" aria-live="polite" hidden>
        <div class="capture-thumb" id="capture-thumb">
          <img id="capture-thumb-img" alt="">
          <div class="scan-sweep" id="capture-scan-sweep" hidden></div>
        </div>
        <div class="capture-status-text">
          <div class="capture-status-title"><span class="status-dot" id="capture-status-dot"></span><span id="capture-status-text"></span></div>
          <div class="capture-status-sub" id="capture-status-sub"></div>
          <div class="capture-status-actions">
            <button type="button" class="btn-status-sm" id="capture-cancel-btn" hidden>Cancel</button>
            <button type="button" class="btn-status-sm" id="capture-retake-btn" hidden>Retake</button>
            <button type="button" class="btn-status-sm" id="capture-remove-btn" hidden>Remove</button>
          </div>
        </div>
      </div>

      <form id="item-form" novalidate>

        <div class="field">
          <label for="item-name">Product</label>
          <input type="text" id="item-name" name="item-name" required autocomplete="off" enterkeyhint="next">
          <p class="field-error" id="name-error" hidden>Please enter a product name</p>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="item-price">Price</label>
            <input type="number" id="item-price" class="big-input" name="item-price" inputmode="decimal" step="0.01" min="0" placeholder="0.00" required enterkeyhint="next">
            <p class="field-error" id="price-error" hidden>Enter a price above 0 (up to 1,000,000,000)</p>
          </div>
          <div class="field">
            <label for="item-unit-size">Size</label>
            <input type="number" id="item-unit-size" class="big-input" name="item-unit-size" inputmode="decimal" step="any" min="0" placeholder="850" required enterkeyhint="done">
            <p class="field-error" id="unit-size-error" hidden>Enter a size above 0 (up to 1,000,000,000)</p>
          </div>
        </div>

        <div class="unit-compact-wrap">
          <label id="unit-measure-label">Unit</label>
          <div class="unit-pill-group" id="item-unit-measure" role="radiogroup" aria-labelledby="unit-measure-label">
            <button type="button" class="unit-pill" role="radio" aria-checked="false" tabindex="-1" data-value="ml" title="Milliliters">ml</button>
            <button type="button" class="unit-pill" role="radio" aria-checked="false" tabindex="-1" data-value="l" title="Liters">L</button>
            <button type="button" class="unit-pill" role="radio" aria-checked="false" tabindex="-1" data-value="g" title="Grams">g</button>
            <button type="button" class="unit-pill" role="radio" aria-checked="false" tabindex="-1" data-value="kg" title="Kilograms">kg</button>
            <button type="button" class="unit-pill" role="radio" aria-checked="true" tabindex="0" data-value="piece" title="Piece">pc</button>
            <button type="button" class="unit-pill" role="radio" aria-checked="false" tabindex="-1" data-value="sheet" title="Sheet">sheet</button>
          </div>
          <p class="unit-name" id="unit-name">Piece</p>
          <p class="warn" id="unit-size-warning" hidden></p>
        </div>

        <!-- Pack, shipping and promotion stay behind one disclosure. The summary line shows any value that is set. -->
        <div class="more-wrap">
          <button type="button" class="more-toggle" id="more-toggle" aria-expanded="false" aria-controls="more-panel">
            <span>Pack, shipping, promotion <small id="more-summary">none set</small></span>
            <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          </button>

          <div class="more-panel" id="more-panel" hidden>
            <div class="field">
              <label for="item-pack-count" id="pack-label">Pack count</label>
              <div class="stepper" role="group" aria-labelledby="pack-label">
                <button type="button" class="step-btn" id="pack-minus" aria-label="Fewer">&minus;</button>
                <input type="number" id="item-pack-count" name="item-pack-count" inputmode="numeric" min="1" step="1" value="1" required>
                <button type="button" class="step-btn" id="pack-plus" aria-label="More">+</button>
              </div>
              <p class="hint">How many of that size this price covers. 3 for three 850ml pouches.</p>
            </div>

            <div class="field">
              <label for="item-shipping">+ Shipping <span class="optional">(optional)</span></label>
              <input type="number" id="item-shipping" name="item-shipping" inputmode="decimal" step="0.01" min="0" placeholder="0">
              <p class="field-error" id="shipping-error" hidden>Enter a shipping fee of 0 or more (up to 1,000,000,000)</p>
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
              <p class="hint">Price above is the sticker price for one purchase. We work out the real cost per unit.</p>
              <p class="hint" id="promo-helper"></p>
            </div>

            <div class="field-row promo-extra" id="fixed-bundle-fields" hidden>
              <div class="field">
                <label for="bundle-n">Bundle pack count (N)</label>
                <input type="number" id="bundle-n" name="bundle-n" inputmode="numeric" min="1" step="1">
                <p class="field-error" id="bundle-n-error" hidden>Enter a whole number of 1 or more</p>
              </div>
              <div class="field">
                <label for="bundle-x">Total bundle price (X)</label>
                <input type="number" id="bundle-x" name="bundle-x" inputmode="decimal" min="0" step="0.01">
                <p class="field-error" id="bundle-x-error" hidden>Enter a bundle price of 0 or more (up to 1,000,000,000)</p>
              </div>
            </div>

            <div class="field promo-extra" id="second-fixed-field" hidden>
              <label for="second-fixed-y">Second item&rsquo;s price (Y)</label>
              <input type="number" id="second-fixed-y" name="second-fixed-y" inputmode="decimal" min="0" step="0.01">
              <p class="field-error" id="second-fixed-y-error" hidden>Enter a price of 0 or more (up to 1,000,000,000)</p>
            </div>
          </div>
        </div>

      </form>
    </div>

    <div class="sheet-foot">
      <div class="sheet-actions">
        <div class="preview-readout">
          <span class="preview-readout-label">Preview</span>
          <span class="preview-readout-value" id="preview-readout-value" aria-live="polite"><span class="dash">—</span> <span class="unit-part" id="preview-readout-unit">/ piece</span></span>
        </div>
        <button type="button" id="cancel-edit-btn" class="btn-cancel" hidden>Cancel</button>
        <button type="submit" form="item-form" id="submit-btn" class="btn-primary">Add offer</button>
      </div>
    </div>
  </section>

</div>

<!-- Bottom dock (phones only): camera + add. Hidden while the sheet is open. -->
<div class="scrim" id="sheet-scrim" hidden></div>
<div class="dock" id="dock">
  <div class="dock-in">
    <button type="button" class="cam" id="dock-cam" aria-label="Scan a price tag">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/></svg>
    </button>
    <button type="button" class="add" id="dock-add"><span class="plus" aria-hidden="true">+</span> Add offer</button>
  </div>
</div>

<div id="toast" class="toast" hidden>
  <span id="toast-message"></span>
  <button type="button" id="toast-undo" class="toast-undo">Undo</button>
</div>

<script src="js/ocr-extract.js?v=6a2"></script>
<script src="js/barcode.js?v=6a2"></script>
<script src="js/app.js?v=6a2"></script>
</body>
</html>
