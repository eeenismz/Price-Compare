// Price Compare — Phase 2: Unit-price system + localStorage persistence

(function () {
  'use strict';

  // ---------- Unit system definitions ----------
  var UNIT_INFO = {
    ml:    { family: 'volume', toBase: 1 },
    l:     { family: 'volume', toBase: 1000 },
    g:     { family: 'mass',   toBase: 1 },
    kg:    { family: 'mass',   toBase: 1000 },
    piece: { family: 'piece',  toBase: 1 },
    sheet: { family: 'sheet',  toBase: 1 }
  };

  // Promotion definitions — helper text only, actual compute is in computeItemPrice below
  var PROMO_TYPES = {
    none: {
      label: 'No promotion',
      helper: ''
    },
    bogo: {
      label: 'Buy 1 Get 1 Free',
      helper: 'Effective price = price ÷ 2'
    },
    second50: {
      label: 'Second item 50% off',
      helper: 'Effective price = price × 0.75'
    },
    buy3pay2: {
      label: 'Buy 3 Pay for 2',
      helper: 'Effective price = price × 2 ÷ 3'
    },
    fixedBundle: {
      label: 'Fixed bundle price',
      helper: 'Effective price = total bundle price (X) ÷ bundle pack count (N)'
    },
    secondFixed: {
      label: 'Second item at a fixed price',
      helper: 'Effective price = (price + second item price) ÷ 2'
    }
  };

  // ---------- localStorage persistence helpers ----------
  // Validates a stored item before adding it to the in-memory list.
  function isValidItem(item) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.id !== 'string' || !item.id) return false;
    if (typeof item.name !== 'string' || !item.name) return false;
    if (typeof item.price !== 'number' || isNaN(item.price) || item.price < 0) return false;
    if (typeof item.unitSize !== 'number' || isNaN(item.unitSize) || item.unitSize <= 0) return false;
    if (typeof item.unitOfMeasure !== 'string' || !UNIT_INFO[item.unitOfMeasure]) return false;
    if (typeof item.packCount !== 'number' || !Number.isInteger(item.packCount) || item.packCount < 1) return false;

    // shippingFee is optional but must be valid if present
    if (item.shippingFee !== undefined && item.shippingFee !== null && (typeof item.shippingFee !== 'number' || isNaN(item.shippingFee) || item.shippingFee < 0)) return false;

    // Check promo object
    if (!item.promo || typeof item.promo !== 'object') return false;
    if (typeof item.promo.type !== 'string' || !PROMO_TYPES[item.promo.type]) return false;

    if (item.promo.type === 'fixedBundle') {
      if (typeof item.promo.n !== 'number' || !Number.isInteger(item.promo.n) || item.promo.n < 1) return false;
      if (typeof item.promo.x !== 'number' || isNaN(item.promo.x) || item.promo.x < 0) return false;
    } else if (item.promo.type === 'secondFixed') {
      if (typeof item.promo.y !== 'number' || isNaN(item.promo.y) || item.promo.y < 0) return false;
    }

    return true;
  }

  // Save current state (items + appCurrency) to localStorage.
  function saveState() {
    try {
      var state = {
        items: items,
        appCurrency: appCurrency
      };
      localStorage.setItem('priceCompareState', JSON.stringify(state));
    } catch (e) {
      // localStorage unavailable, full, or access denied; degrade gracefully
      console.warn('Could not save to localStorage:', e);
    }
  }

  // Load state from localStorage. Returns { items, appCurrency } or safe defaults if missing/invalid.
  function loadState() {
    try {
      var stored = localStorage.getItem('priceCompareState');
      if (!stored) {
        return { items: [], appCurrency: 'THB' };
      }

      var state = JSON.parse(stored);

      if (!state || typeof state !== 'object') {
        return { items: [], appCurrency: 'THB' };
      }

      // Validate items array, skipping individual invalid items
      var validItems = [];
      if (Array.isArray(state.items)) {
        state.items.forEach(function (item) {
          if (isValidItem(item)) {
            validItems.push(item);
          }
        });
      }

      // Validate appCurrency
      var currency = state.appCurrency || 'THB';
      if (typeof currency !== 'string') {
        currency = 'THB';
      }

      return { items: validItems, appCurrency: currency };
    } catch (e) {
      // JSON parse error or localStorage access error; degrade gracefully
      console.warn('Could not load from localStorage:', e);
      return { items: [], appCurrency: 'THB' };
    }
  }

  // ---------- State ----------
  var items = [];              // in-memory list of all items for this session
  var editingId = null;        // id of item currently being edited, or null when adding
  var lastProductName = '';    // remembers the last-added product name, for the next add
  var lastUnitOfMeasure = 'piece';  // remembers the last-used unit of measure, for the next add
  var appCurrency = 'THB';     // the single app-wide currency everything is compared in, this session only
  var lastChangedId = null;    // id of the item to flash after the next render
  var removedUndoTimeout = null;
  var productNameOrder = [];   // tracks the order product names are first added, for consistent ordering in results

  // ---------- DOM refs ----------
  var form = document.getElementById('item-form');
  var formDetails = document.getElementById('item-form-details');
  var formSummary = document.getElementById('item-form-summary');

  var appCurrencySelect = document.getElementById('app-currency');

  var nameInput = document.getElementById('item-name');
  var nameError = document.getElementById('name-error');
  var priceInput = document.getElementById('item-price');
  var priceInfoBtn = document.getElementById('price-info-btn');
  var priceTooltip = document.getElementById('price-tooltip');
  var shippingInput = document.getElementById('item-shipping');

  var unitSizeInput = document.getElementById('item-unit-size');
  var unitSizeInfoBtn = document.getElementById('unit-size-info-btn');
  var unitSizeTooltip = document.getElementById('unit-size-tooltip');
  var unitSizeWarning = document.getElementById('unit-size-warning');
  var unitMeasureGroup = document.getElementById('item-unit-measure');
  var packCountInput = document.getElementById('item-pack-count');
  var packCountInfoBtn = document.getElementById('pack-count-info-btn');
  var packCountTooltip = document.getElementById('pack-count-tooltip');

  var promoSelect = document.getElementById('item-promo');
  var promoHelper = document.getElementById('promo-helper');

  var fixedBundleFields = document.getElementById('fixed-bundle-fields');
  var bundleNInput = document.getElementById('bundle-n');
  var bundleXInput = document.getElementById('bundle-x');

  var secondFixedField = document.getElementById('second-fixed-field');
  var secondFixedYInput = document.getElementById('second-fixed-y');

  var previewReadoutValue = document.getElementById('preview-readout-value');
  var previewReadoutUnit = document.getElementById('preview-readout-unit');

  var submitBtn = document.getElementById('submit-btn');
  var cancelBtn = document.getElementById('cancel-edit-btn');

  var emptyState = document.getElementById('empty-state');
  var resultsToolbar = document.getElementById('results-toolbar');
  var clearAllBtn = document.getElementById('clear-all-btn');
  var resultsGroups = document.getElementById('results-groups');

  var toastEl = document.getElementById('toast');
  var toastMessage = document.getElementById('toast-message');
  var toastUndoBtn = document.getElementById('toast-undo');

  // ---------- Helpers ----------
  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function isMobile() {
    return window.matchMedia('(max-width: 767px)').matches;
  }

  // Get the currently selected pill's value from the radiogroup
  function getUnitMeasureValue() {
    var selected = unitMeasureGroup.querySelector('[aria-checked="true"]');
    return selected ? selected.dataset.value : 'piece';
  }

  // Set a pill as selected by its data-value
  function setUnitMeasureValue(value) {
    var pills = Array.prototype.slice.call(unitMeasureGroup.querySelectorAll('.unit-pill'));
    pills.forEach(function (pill) {
      var isMatch = pill.dataset.value === value;
      pill.setAttribute('aria-checked', isMatch ? 'true' : 'false');
      pill.tabIndex = isMatch ? 0 : -1;
      if (isMatch) {
        pill.focus();
      }
    });
    updateUnitSizeWarning();
  }

  // Unit sizes above these thresholds are implausible for a single consumer
  // package and are almost always a magnitude typo (e.g. ml value typed into
  // the Liters field) — flagged as a non-blocking warning, never prevents Add.
  var UNIT_SIZE_WARN_THRESHOLDS = {
    l:  { max: 30,    label: 'Liters',      suggestLabel: 'Milliliters' },
    ml: { max: 5000,  label: 'Milliliters', suggestLabel: 'Liters' },
    kg: { max: 50,    label: 'Kilograms',   suggestLabel: 'Grams' },
    g:  { max: 10000, label: 'Grams',       suggestLabel: 'Kilograms' }
  };

  function updateUnitSizeWarning() {
    var size = parseFloat(unitSizeInput.value);
    var rule = UNIT_SIZE_WARN_THRESHOLDS[getUnitMeasureValue()];
    if (rule && !isNaN(size) && size > rule.max) {
      unitSizeWarning.textContent = 'Unusually large for ' + rule.label + ' — did you mean ' + rule.suggestLabel + '?';
      unitSizeWarning.hidden = false;
    } else {
      unitSizeWarning.hidden = true;
    }
  }

  unitSizeInput.addEventListener('input', updateUnitSizeWarning);

  // Live preview of the computed price per base unit
  function updatePreview() {
    var price = parseFloat(priceInput.value);
    var shipping = parseFloat(shippingInput.value) || 0;
    var size = parseFloat(unitSizeInput.value);
    var pack = parseFloat(packCountInput.value) || 1;
    var unit = getUnitMeasureValue();
    var promoType = promoSelect.value;

    var unitLabel;
    var family = UNIT_INFO[unit].family;
    if (family === 'volume') {
      unitLabel = '100ml';
    } else if (family === 'mass') {
      unitLabel = '100g';
    } else {
      unitLabel = family === 'piece' ? 'piece' : 'sheet';
    }

    // Update the unit label in the preview
    previewReadoutUnit.textContent = '/ ' + unitLabel;

    // Build a throwaway item from current form state
    var promo = { type: promoType };
    if (promoType === 'fixedBundle') {
      var n = parseInt(bundleNInput.value, 10);
      var x = parseFloat(bundleXInput.value);
      if (!n || n < 1 || isNaN(x) || x < 0) {
        // Incomplete promo
        previewReadoutValue.innerHTML = '<span class="dash">—</span>';
        return;
      }
      promo.n = n;
      promo.x = x;
    } else if (promoType === 'secondFixed') {
      var y = parseFloat(secondFixedYInput.value);
      if (isNaN(y) || y < 0) {
        previewReadoutValue.innerHTML = '<span class="dash">—</span>';
        return;
      }
      promo.y = y;
    }

    // Check for incomplete required fields
    if (isNaN(price) || isNaN(size) || size <= 0) {
      previewReadoutValue.innerHTML = '<span class="dash">—</span>';
      return;
    }

    var tmpItem = {
      price: price,
      unitSize: size,
      unitOfMeasure: unit,
      packCount: pack,
      shippingFee: shipping,
      promo: promo
    };

    var pricing = computeItemPrice(tmpItem);
    var val = pricing.pricePerBaseUnit.toFixed(2);
    previewReadoutValue.innerHTML = val + ' <span class="unit-part">/ ' + unitLabel + '</span>';
  }

  // Wire up preview updates to all relevant inputs
  [priceInput, shippingInput, unitSizeInput, packCountInput, promoSelect, bundleNInput, bundleXInput, secondFixedYInput].forEach(function (el) {
    el.addEventListener('input', updatePreview);
    el.addEventListener('change', updatePreview);
  });

  // Also update when unit pills change
  unitMeasureGroup.addEventListener('click', updatePreview);

  // Wire up pill group keyboard and click handlers
  function initUnitPillGroup() {
    var pills = Array.prototype.slice.call(unitMeasureGroup.querySelectorAll('.unit-pill'));

    function selectPill(pill) {
      pills.forEach(function (p) {
        var isSelected = p === pill;
        p.setAttribute('aria-checked', isSelected ? 'true' : 'false');
        p.tabIndex = isSelected ? 0 : -1;
      });
      pill.focus();
      updateUnitSizeWarning();
    }

    pills.forEach(function (pill, index) {
      pill.addEventListener('click', function () { selectPill(pill); });

      pill.addEventListener('keydown', function (e) {
        var targetIndex = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          targetIndex = (index + 1) % pills.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          targetIndex = (index - 1 + pills.length) % pills.length;
        } else if (e.key === 'Home') {
          targetIndex = 0;
        } else if (e.key === 'End') {
          targetIndex = pills.length - 1;
        }
        if (targetIndex !== null) {
          e.preventDefault();
          selectPill(pills[targetIndex]);
        }
      });
    });
  }

  // Compute both total cost and total base units for an item.
  // Returns { totalCost, totalBaseUnits, family, unitLabel }
  // unitLabel is the normalized display label ('100ml', '100g', 'piece', 'sheet')
  function computeItemPrice(item) {
    var unitInfo = UNIT_INFO[item.unitOfMeasure];
    var unitSizeBase = item.unitSize * unitInfo.toBase;
    var family = unitInfo.family;

    var totalCost, totalBaseUnits;

    if (item.promo.type === 'none') {
      totalCost = item.price;
      totalBaseUnits = unitSizeBase * item.packCount;
    } else if (item.promo.type === 'bogo') {
      totalCost = item.price;
      totalBaseUnits = unitSizeBase * item.packCount * 2;
    } else if (item.promo.type === 'second50') {
      totalCost = item.price * 1.5;
      totalBaseUnits = unitSizeBase * item.packCount * 2;
    } else if (item.promo.type === 'buy3pay2') {
      totalCost = item.price * 2;
      totalBaseUnits = unitSizeBase * item.packCount * 3;
    } else if (item.promo.type === 'secondFixed') {
      totalCost = item.price + item.promo.y;
      totalBaseUnits = unitSizeBase * item.packCount * 2;
    } else if (item.promo.type === 'fixedBundle') {
      totalCost = item.promo.x;
      totalBaseUnits = unitSizeBase * item.promo.n;
    }

    totalCost += item.shippingFee || 0;

    // Normalize per 100 base units for volume/mass, per 1 for piece/sheet
    var costPerBaseUnit = totalCost / totalBaseUnits;
    var pricePerBaseUnit, unitLabel;

    if (family === 'volume' || family === 'mass') {
      pricePerBaseUnit = costPerBaseUnit * 100;
      unitLabel = family === 'volume' ? '100ml' : '100g';
    } else {
      pricePerBaseUnit = costPerBaseUnit;
      unitLabel = family === 'piece' ? 'piece' : 'sheet';
    }

    return {
      totalCost: totalCost,
      totalBaseUnits: totalBaseUnits,
      pricePerBaseUnit: pricePerBaseUnit,
      family: family,
      unitLabel: unitLabel
    };
  }

  // Chip text for a promo — includes resolved price per normalized unit
  function getPromoChipText(item) {
    var pricing = computeItemPrice(item);
    var pricePerUnit = pricing.pricePerBaseUnit.toFixed(2);
    var label = pricing.unitLabel;
    var result = '';

    if (item.promo.type === 'fixedBundle') {
      result = item.promo.n + ' for ' + appCurrency + item.promo.x.toFixed(2);
    } else if (item.promo.type === 'secondFixed') {
      result = '2nd item at ' + appCurrency + item.promo.y.toFixed(2);
    } else if (item.promo.type === 'bogo') {
      result = 'Buy 1 Get 1 Free';
    } else if (item.promo.type === 'second50') {
      result = '2nd item 50% off';
    } else if (item.promo.type === 'buy3pay2') {
      result = 'Buy 3, pay for 2';
    } else {
      // 'none' with packCount > 1: show Qty chip
      if (item.packCount > 1) {
        result = 'Qty ' + item.packCount;
      } else {
        return null; // no chip needed
      }
      return result;
    }

    // Append resolved price for promos (not for plain 'none' Qty chip)
    if (item.promo.type !== 'none') {
      result += ' → ' + appCurrency + pricePerUnit + '/' + label;
    }
    return result;
  }

  // Auto-derived offer label: promo description (without price), or shipping, or qty, or empty
  function getDerivedLabel(item) {
    if (item.promo.type === 'fixedBundle') {
      return item.promo.n + ' for ' + appCurrency + item.promo.x.toFixed(2);
    } else if (item.promo.type === 'secondFixed') {
      return '2nd item at ' + appCurrency + item.promo.y.toFixed(2);
    } else if (item.promo.type === 'bogo') {
      return 'Buy 1 Get 1 Free';
    } else if (item.promo.type === 'second50') {
      return '2nd item 50% off';
    } else if (item.promo.type === 'buy3pay2') {
      return 'Buy 3, pay for 2';
    } else if (item.promo.type === 'none' && item.shippingFee > 0) {
      return '+ shipping';
    } else if (item.promo.type === 'none' && item.packCount > 1) {
      return 'Qty ' + item.packCount;
    }
    return ''; // no label
  }

  // Build the raw listing detail line: "X.XX for N × SIZE UNIT" or similar
  function buildListingDetail(item) {
    if (item.promo.type === 'fixedBundle') {
      return item.promo.x.toFixed(2) + ' for ' + item.promo.n + ' × ' + item.unitSize + ' ' + item.unitOfMeasure + ' (bundle)';
    } else if (item.packCount > 1) {
      return item.price.toFixed(2) + ' for ' + item.packCount + ' × ' + item.unitSize + ' ' + item.unitOfMeasure;
    } else {
      return item.price.toFixed(2) + ' for ' + item.unitSize + ' ' + item.unitOfMeasure;
    }
  }

  // Append shipping fee to listing detail if present
  function appendShippingNote(detail, item) {
    if (item.shippingFee > 0) {
      return detail + ' (incl. ' + item.shippingFee.toFixed(0) + ' shipping)';
    }
    return detail;
  }

  // ---------- Promo select UI (show/hide extra fields + helper text) ----------
  function updatePromoUI() {
    var type = promoSelect.value;
    fixedBundleFields.hidden = type !== 'fixedBundle';
    secondFixedField.hidden = type !== 'secondFixed';
    promoHelper.textContent = (PROMO_TYPES[type] || PROMO_TYPES.none).helper;

    // Disable Pack count only when fixedBundle is selected (its N is independent)
    packCountInput.disabled = type === 'fixedBundle';
    if (type === 'fixedBundle') {
      packCountInput.value = '1'; // force display to 1 when disabled
    }
  }

  promoSelect.addEventListener('change', updatePromoUI);

  // ---------- Info-icon tooltips (tap/click to toggle, one open at a time) ----------
  var infoTooltips = [
    { btn: priceInfoBtn, bubble: priceTooltip },
    { btn: unitSizeInfoBtn, bubble: unitSizeTooltip },
    { btn: packCountInfoBtn, bubble: packCountTooltip }
  ];

  function closeAllTooltips() {
    infoTooltips.forEach(function (t) {
      t.bubble.hidden = true;
      t.btn.setAttribute('aria-expanded', 'false');
    });
  }

  infoTooltips.forEach(function (t) {
    t.btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var wasOpen = !t.bubble.hidden;
      closeAllTooltips();
      if (!wasOpen) {
        t.bubble.hidden = false;
        t.btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', closeAllTooltips);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllTooltips();
  });

  // ---------- App-wide currency control ----------
  appCurrencySelect.addEventListener('change', function () {
    appCurrency = appCurrencySelect.value;
    saveState();
    renderResults(); // existing items aren't retroactively reinterpreted, just re-sorted/re-rendered
  });

  // ---------- Form reset / edit mode ----------
  function resetForm() {
    editingId = null;
    form.reset();
    nameInput.value = lastProductName; // pre-fill with the last name — comparing offers of the same product shouldn't mean retyping it each time
    unitSizeInput.value = '';
    setUnitMeasureValue(lastUnitOfMeasure); // use the last-selected unit, defaulting to 'piece'
    packCountInput.value = '1';
    promoSelect.value = 'none';
    updatePromoUI();
    submitBtn.textContent = 'Add Offer';
    cancelBtn.hidden = true;
    formSummary.textContent = 'Add an Offer';
    nameError.hidden = true;
    resetCaptureBar(); // Add, Cancel edit, Clear all and form reset all end any photo card and its "from photo" flags
    updatePreview();
  }

  // Clear the "enter a product name" message as soon as the user types a valid name.
  nameInput.addEventListener('input', function () {
    if (nameInput.value.trim()) {
      nameError.hidden = true;
    }
  });

  function startEdit(id) {
    var item = items.filter(function (i) { return i.id === id; })[0];
    if (!item) return;

    resetCaptureBar(); // the form is about to show this item's values, so any photo marks no longer apply
    editingId = id;
    nameInput.value = item.name;
    priceInput.value = item.price;
    unitSizeInput.value = item.unitSize;
    setUnitMeasureValue(item.unitOfMeasure);
    packCountInput.value = item.packCount;
    shippingInput.value = item.shippingFee || '';
    promoSelect.value = item.promo.type;
    updatePromoUI();

    if (item.promo.type === 'fixedBundle') {
      bundleNInput.value = item.promo.n;
      bundleXInput.value = item.promo.x;
    } else if (item.promo.type === 'secondFixed') {
      secondFixedYInput.value = item.promo.y;
    }

    submitBtn.textContent = 'Save changes';
    cancelBtn.hidden = false;
    formSummary.textContent = 'Edit an Offer';

    formDetails.open = true; // always reveal the form when entering edit mode
    updatePreview();
    nameInput.focus();
  }

  cancelBtn.addEventListener('click', function () {
    resetForm();
    if (items.length > 0 && isMobile()) {
      formDetails.open = false;
    }
  });

  // ---------- Form submit (add or save edit) ----------
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var name = nameInput.value.trim();
    var price = parseFloat(priceInput.value);
    var unitSize = parseFloat(unitSizeInput.value);
    var unitOfMeasure = getUnitMeasureValue();
    var packCount = parseInt(packCountInput.value, 10);
    var shippingFeeRaw = shippingInput.value.trim();
    var shippingFee = shippingFeeRaw === '' ? 0 : parseFloat(shippingFeeRaw);
    var promoType = promoSelect.value;

    if (!name) {
      nameError.hidden = false;
      return;
    }
    nameError.hidden = true;

    if (isNaN(price) || price < 0) {
      return; // required attrs handle most of this, this is just a guard
    }

    if (isNaN(unitSize) || unitSize <= 0) {
      return; // Unit size must be positive
    }

    if (!packCount || packCount < 1) {
      packCount = 1;
    }

    if (shippingFeeRaw !== '' && (isNaN(shippingFee) || shippingFee < 0)) {
      return; // blank means 0 and is fine; a present-but-invalid value blocks submit
    }

    lastProductName = name; // remember for the next add
    lastUnitOfMeasure = unitOfMeasure; // remember for the next add

    var promo = { type: promoType };

    if (promoType === 'fixedBundle') {
      var n = parseInt(bundleNInput.value, 10);
      var x = parseFloat(bundleXInput.value);
      if (!n || n < 1 || isNaN(x) || x < 0) return;
      promo.n = n;
      promo.x = x;
    } else if (promoType === 'secondFixed') {
      var y = parseFloat(secondFixedYInput.value);
      if (isNaN(y) || y < 0) return;
      promo.y = y;
    }

    if (editingId) {
      var existing = items.filter(function (i) { return i.id === editingId; })[0];
      if (existing) {
        existing.name = name;
        existing.price = price;
        existing.unitSize = unitSize;
        existing.unitOfMeasure = unitOfMeasure;
        existing.packCount = packCount;
        existing.shippingFee = shippingFee;
        existing.promo = promo;
        lastChangedId = existing.id;
      }
    } else {
      var newItem = {
        id: makeId(),
        name: name,
        price: price,
        unitSize: unitSize,
        unitOfMeasure: unitOfMeasure,
        packCount: packCount,
        shippingFee: shippingFee,
        promo: promo
      };
      items.push(newItem);
      // Track product name order: only add if this is the first time we've seen this product name
      if (productNameOrder.indexOf(name) === -1) {
        productNameOrder.push(name);
      }
      lastChangedId = newItem.id;
    }

    saveState();
    resetForm();
    renderResults();

    // Collapse the mobile form panel once there's at least one item.
    if (items.length > 0 && isMobile()) {
      formDetails.open = false;
    }
  });

  // ---------- Remove + undo toast ----------
  function hideToast() {
    toastEl.hidden = true;
    toastEl.classList.remove('show');
  }

  function showUndoToast(item, index) {
    clearTimeout(removedUndoTimeout);
    toastMessage.textContent = "Removed '" + item.name + "'.";
    toastEl.hidden = false;
    toastEl.classList.add('show');

    toastUndoBtn.onclick = function () {
      clearTimeout(removedUndoTimeout);
      items.splice(index, 0, item); // restore at its original position
      lastChangedId = item.id;
      saveState();
      hideToast();
      renderResults();
    };

    removedUndoTimeout = setTimeout(hideToast, 5000);
  }

  function removeItem(id) {
    var index = -1;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) { index = i; break; }
    }
    if (index === -1) return;

    var removed = items.splice(index, 1)[0];

    if (editingId === id) {
      resetForm(); // don't leave the form editing an item that no longer exists
    }

    saveState();
    renderResults();
    showUndoToast(removed, index);
  }

  function showBulkUndoToast(removedItems) {
    clearTimeout(removedUndoTimeout);
    var count = removedItems.length;
    toastMessage.textContent = 'Cleared ' + count + (count === 1 ? ' item.' : ' items.');
    toastEl.hidden = false;
    toastEl.classList.add('show');

    toastUndoBtn.onclick = function () {
      clearTimeout(removedUndoTimeout);
      items = removedItems; // restore the whole list as it was
      saveState();
      hideToast();
      renderResults();
    };

    removedUndoTimeout = setTimeout(hideToast, 5000);
  }

  clearAllBtn.addEventListener('click', function () {
    if (items.length === 0) return;

    var removedItems = items;
    items = [];
    productNameOrder = [];
    lastProductName = ''; // don't carry the old name into a fully-cleared list
    resetForm(); // always return to a blank form, not just when mid-edit

    saveState();
    renderResults();
    showBulkUndoToast(removedItems);
  });

  // ---------- Rendering ----------
  function renderResults() {
    resultsGroups.innerHTML = '';

    if (items.length === 0) {
      emptyState.hidden = false;
      resultsToolbar.hidden = true;
      return;
    }
    emptyState.hidden = true;
    resultsToolbar.hidden = false;

    // Group items by product name, in the order names were first added
    var productGroups = {};
    items.forEach(function (item) {
      var name = item.name.trim();
      if (!productGroups[name]) {
        productGroups[name] = [];
      }
      productGroups[name].push(item);
    });

    // Render each product group in order
    productNameOrder.forEach(function (productName) {
      if (!productGroups[productName]) return;

      var groupItems = productGroups[productName];

      // Compute pricing for all items in this group
      var itemsWithPricing = groupItems.map(function (item) {
        return { item: item, pricing: computeItemPrice(item) };
      });

      // Sort by price per base unit (ascending)
      itemsWithPricing.sort(function (a, b) {
        return a.pricing.pricePerBaseUnit - b.pricing.pricePerBaseUnit;
      });

      // Check for incompatible unit families within this product group
      var families = {};
      itemsWithPricing.forEach(function (entry) {
        families[entry.pricing.family] = true;
      });
      var familiesList = Object.keys(families).sort();
      var hasIncompatibleFamilies = familiesList.length > 1;

      // Create product group container
      var groupDiv = document.createElement('div');
      groupDiv.className = 'product-group';

      // Product group header
      var headerDiv = document.createElement('div');
      headerDiv.className = 'product-group-header';

      var nameSpan = document.createElement('span');
      nameSpan.className = 'product-name';
      nameSpan.textContent = productName;
      headerDiv.appendChild(nameSpan);

      var countSpan = document.createElement('span');
      countSpan.className = 'product-offer-count';
      countSpan.textContent = itemsWithPricing.length + ' offer' + (itemsWithPricing.length === 1 ? '' : 's');
      headerDiv.appendChild(countSpan);

      groupDiv.appendChild(headerDiv);

      // If incompatible families, show warning
      if (hasIncompatibleFamilies) {
        var familyWarning = document.createElement('div');
        familyWarning.className = 'family-note';
        familyWarning.textContent = 'Comparing across incompatible units — no direct Best Value.';
        groupDiv.appendChild(familyWarning);
      }

      // For multi-offer groups, show insight banner
      if (itemsWithPricing.length > 1) {
        var bestEntry = itemsWithPricing[0];
        var priciest = itemsWithPricing[itemsWithPricing.length - 1];

        // Calculate the "more you'd pay" amount
        var priceDiff = priciest.pricing.pricePerBaseUnit - bestEntry.pricing.pricePerBaseUnit;
        var scaleMultiplier = (bestEntry.pricing.family === 'volume' || bestEntry.pricing.family === 'mass') ? 10 : 1;
        var scaledDiff = priceDiff * scaleMultiplier;
        var unitWord = bestEntry.pricing.family === 'volume' ? 'litre' :
                       bestEntry.pricing.family === 'mass' ? 'kilo' :
                       bestEntry.pricing.family;

        var derivedLabel = getDerivedLabel(bestEntry.item);
        var listingDetail = buildListingDetail(bestEntry.item);
        if (bestEntry.item.shippingFee > 0) {
          listingDetail = appendShippingNote(listingDetail, bestEntry.item);
        }

        var bannerDiv = document.createElement('div');
        bannerDiv.className = 'insight-banner';

        var iconSpan = document.createElement('span');
        iconSpan.className = 'insight-icon';
        iconSpan.setAttribute('aria-hidden', 'true');
        bannerDiv.appendChild(iconSpan);

        var textDiv = document.createElement('div');
        textDiv.className = 'insight-text';

        var headlineP = document.createElement('p');
        headlineP.className = 'insight-headline';
        headlineP.appendChild(document.createTextNode(productName + ' · ' +
          (derivedLabel ? derivedLabel + ' ' : '') +
          'wins at '));
        var headlinePriceSpan = document.createElement('span');
        headlinePriceSpan.className = 'mono';
        headlinePriceSpan.textContent = appCurrency + bestEntry.pricing.pricePerBaseUnit.toFixed(2);
        headlineP.appendChild(headlinePriceSpan);
        headlineP.appendChild(document.createTextNode('/' + bestEntry.pricing.unitLabel));
        textDiv.appendChild(headlineP);

        var subP = document.createElement('p');
        subP.className = 'insight-sub';
        var subDetailSpan = document.createElement('span');
        subDetailSpan.className = 'mono';
        subDetailSpan.textContent = listingDetail;
        subP.appendChild(subDetailSpan);
        subP.appendChild(document.createTextNode(
          (derivedLabel ? ' · ' + derivedLabel : '') + ' · you’d pay '
        ));
        var subDiffSpan = document.createElement('span');
        subDiffSpan.className = 'mono';
        subDiffSpan.textContent = appCurrency + scaledDiff.toFixed(2);
        subP.appendChild(subDiffSpan);
        subP.appendChild(document.createTextNode(' more per ' + unitWord + ' with the priciest option here.'));
        textDiv.appendChild(subP);

        bannerDiv.appendChild(textDiv);
        groupDiv.appendChild(bannerDiv);
      } else {
        // Single offer: show note
        var noteP = document.createElement('p');
        noteP.className = 'single-offer-note';
        noteP.textContent = 'Only one offer entered — add another to see how it compares.';
        groupDiv.appendChild(noteP);
      }

      // Build ranked table
      var table = document.createElement('div');
      table.className = 'ranked-table';
      table.setAttribute('role', 'table');
      table.setAttribute('aria-label', productName + ' offers ranked by price per ' + itemsWithPricing[0].pricing.unitLabel.toLowerCase());

      // Table header (hidden on mobile)
      if (itemsWithPricing.length > 1) {
        var headerRow = document.createElement('div');
        headerRow.className = 'ranked-row ranked-head';
        headerRow.setAttribute('role', 'row');

        var rankColHeader = document.createElement('span');
        rankColHeader.setAttribute('role', 'columnheader');
        rankColHeader.setAttribute('style', 'grid-area:rank;');
        rankColHeader.textContent = '#';
        headerRow.appendChild(rankColHeader);

        var offerColHeader = document.createElement('span');
        offerColHeader.setAttribute('role', 'columnheader');
        offerColHeader.setAttribute('style', 'grid-area:offer;');
        offerColHeader.textContent = 'Offer';
        headerRow.appendChild(offerColHeader);

        var costColHeader = document.createElement('span');
        costColHeader.setAttribute('role', 'columnheader');
        costColHeader.setAttribute('style', 'grid-area:cost;');
        costColHeader.textContent = 'Relative cost';
        headerRow.appendChild(costColHeader);

        var priceColHeader = document.createElement('span');
        priceColHeader.setAttribute('role', 'columnheader');
        priceColHeader.setAttribute('style', 'grid-area:price;');
        priceColHeader.textContent = 'Per ' + itemsWithPricing[0].pricing.unitLabel.toLowerCase();
        headerRow.appendChild(priceColHeader);

        var actionsColHeader = document.createElement('span');
        actionsColHeader.setAttribute('role', 'columnheader');
        actionsColHeader.setAttribute('style', 'grid-area:actions;');
        headerRow.appendChild(actionsColHeader);

        table.appendChild(headerRow);
      }

      // Table rows
      var maxPrice = itemsWithPricing[itemsWithPricing.length - 1].pricing.pricePerBaseUnit;

      itemsWithPricing.forEach(function (entry, idx) {
        var item = entry.item;
        var pricing = entry.pricing;
        var rank = idx + 1;
        var isBest = rank === 1;

        var row = document.createElement('div');
        row.className = 'ranked-row' + (isBest ? ' best-row' : '');
        if (itemsWithPricing.length === 1) {
          row.className += ' single-offer';
        }
        row.setAttribute('role', 'row');
        row.dataset.id = item.id;

        // Rank cell
        var rankCell = document.createElement('span');
        rankCell.className = 'rank-num';
        rankCell.setAttribute('role', 'cell');
        rankCell.textContent = (rank < 10 ? '0' : '') + rank;
        row.appendChild(rankCell);

        // Offer cell
        var offerCell = document.createElement('div');
        offerCell.className = 'offer-cell';
        offerCell.setAttribute('role', 'cell');

        var labelLine = document.createElement('div');
        labelLine.className = 'offer-label-line';

        var labelSpan = document.createElement('span');
        labelSpan.className = 'offer-label';
        labelSpan.textContent = getDerivedLabel(item) || productName;
        labelLine.appendChild(labelSpan);

        if (isBest && itemsWithPricing.length > 1) {
          var bestTag = document.createElement('span');
          bestTag.className = 'tag-best-inline';
          bestTag.textContent = 'Best Value';
          labelLine.appendChild(bestTag);
        }

        offerCell.appendChild(labelLine);

        var subDetail = document.createElement('p');
        subDetail.className = 'offer-sub';
        var detail = buildListingDetail(item);
        if (item.shippingFee > 0) {
          detail = appendShippingNote(detail, item);
        }
        subDetail.textContent = detail;
        offerCell.appendChild(subDetail);

        row.appendChild(offerCell);

        // Cost cell (only for multi-offer groups)
        if (itemsWithPricing.length > 1) {
          var costCell = document.createElement('div');
          costCell.className = 'cost-cell';
          costCell.setAttribute('role', 'cell');

          var barTrack = document.createElement('div');
          barTrack.className = 'cost-bar-track';

          var barFill = document.createElement('div');
          barFill.className = 'cost-bar-fill' + (isBest ? ' best' : '');
          var barWidth = (pricing.pricePerBaseUnit / maxPrice) * 100;
          barFill.style.width = barWidth + '%';
          barTrack.appendChild(barFill);
          costCell.appendChild(barTrack);

          var barLabel = document.createElement('span');
          barLabel.className = 'cost-bar-label' + (isBest ? ' best-label' : '');
          if (isBest) {
            barLabel.textContent = 'cheapest per ' + pricing.unitLabel.toLowerCase();
          } else {
            var priceDiffPercent = ((pricing.pricePerBaseUnit - itemsWithPricing[0].pricing.pricePerBaseUnit) / itemsWithPricing[0].pricing.pricePerBaseUnit) * 100;
            barLabel.textContent = '+' + priceDiffPercent.toFixed(2) + '% vs best';
          }
          costCell.appendChild(barLabel);

          row.appendChild(costCell);
        }

        // Price cell
        var priceCell = document.createElement('div');
        priceCell.className = 'price-cell';
        priceCell.setAttribute('role', 'cell');

        var bigPrice = document.createElement('span');
        bigPrice.className = 'big';
        bigPrice.textContent = pricing.pricePerBaseUnit.toFixed(2);
        priceCell.appendChild(bigPrice);

        var unitLabel = document.createElement('span');
        unitLabel.className = 'unit-sub';
        unitLabel.textContent = '/' + pricing.unitLabel;
        priceCell.appendChild(unitLabel);

        row.appendChild(priceCell);

        // Actions cell
        var actionsCell = document.createElement('div');
        actionsCell.className = 'row-actions';
        actionsCell.setAttribute('role', 'cell');

        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn-edit-sm';
        editBtn.textContent = 'Edit';
        editBtn.dataset.id = item.id;
        actionsCell.appendChild(editBtn);

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-remove-sm';
        removeBtn.setAttribute('aria-label', 'Remove offer');
        removeBtn.textContent = '×';
        removeBtn.dataset.id = item.id;
        actionsCell.appendChild(removeBtn);

        row.appendChild(actionsCell);

        table.appendChild(row);
      });

      groupDiv.appendChild(table);
      resultsGroups.appendChild(groupDiv);

      // Add divider between product groups (except after the last one)
      if (productName !== productNameOrder[productNameOrder.length - 1]) {
        var divider = document.createElement('div');
        divider.className = 'product-group-divider';
        divider.setAttribute('aria-hidden', 'true');
        resultsGroups.appendChild(divider);
      }
    });

    // Flash the row that was just added/edited/restored
    if (lastChangedId) {
      var row = resultsGroups.querySelector('[data-id="' + lastChangedId + '"]');
      if (row) {
        row.classList.add('flash');
        setTimeout(function () { row.classList.remove('flash'); }, 900);
      }
      lastChangedId = null;
    }
  }

  // ---------- Delegated clicks for Edit / Remove ----------
  resultsGroups.addEventListener('click', function (e) {
    var editBtn = e.target.closest('.btn-edit-sm');
    if (editBtn) {
      startEdit(editBtn.dataset.id);
      return;
    }
    var removeBtn = e.target.closest('.btn-remove-sm');
    if (removeBtn) {
      removeItem(removeBtn.dataset.id);
    }
  });

  // ---------- Photo-assisted entry (Phase 4c) ----------
  // OCR runs in the browser with Tesseract.js. The library is only downloaded on the first capture.
  var OCR_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var OCR_SCRIPT_SRI = 'sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F';
  var OCR_MAX_SIDE = 1600;      // long side of the photo is shrunk to this before OCR (keeps phones fast)
  var OCR_SLOW_MS = 12000;      // after this, the status line says the first scan is still downloading the reader
  var OCR_GIVE_UP_MS = 45000;   // after this, the scan counts as a failure and the worker is stopped

  var captureIdleEl = document.getElementById('capture-idle');
  var snapBtn = document.getElementById('snap-btn');
  var uploadBtn = document.getElementById('upload-btn');
  var snapInput = document.getElementById('snap-input');
  var uploadInput = document.getElementById('upload-input');
  var captureStatusEl = document.getElementById('capture-status');
  var captureThumbEl = document.getElementById('capture-thumb');
  var captureThumbImg = document.getElementById('capture-thumb-img');
  var captureScanSweep = document.getElementById('capture-scan-sweep');
  var captureStatusDot = document.getElementById('capture-status-dot');
  var captureStatusText = document.getElementById('capture-status-text');
  var captureStatusSub = document.getElementById('capture-status-sub');
  var captureCancelBtn = document.getElementById('capture-cancel-btn');
  var captureRetakeBtn = document.getElementById('capture-retake-btn');
  var captureRemoveBtn = document.getElementById('capture-remove-btn');

  var ocrScanId = 0;            // bumps on every new scan, cancel and timeout; results from older ids are ignored
  var ocrScanState = 'idle';    // 'idle' | 'processing' | 'success' | 'failure'
  var ocrLastMode = 'photo';    // which picker Retake reopens: 'photo' (camera) or 'screenshot' (library/paste)
  var ocrObjectUrl = null;      // blob URL used for the thumbnail; revoked when the card goes away
  var ocrSlowTimer = null;
  var ocrGiveUpTimer = null;
  var ocrScriptPromise = null;  // cached script load, so the library downloads once
  var ocrWorkerPromise = null;  // one worker, reused across scans until a cancel or timeout stops it
  var photoPrevUnit = null;     // unit pill the user had before a photo changed it; "Remove" puts it back

  // Inject the pinned Tesseract.js script once (with SRI). A failed load is retried on the next capture.
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!ocrScriptPromise) {
      ocrScriptPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = OCR_SCRIPT_SRC;
        script.integrity = OCR_SCRIPT_SRI;
        script.crossOrigin = 'anonymous';
        script.onload = function () {
          if (window.Tesseract) {
            resolve(window.Tesseract);
          } else {
            reject(new Error('Tesseract did not register'));
          }
        };
        script.onerror = function () {
          script.parentNode.removeChild(script); // remove the failed tag so a retry can add a fresh one
          reject(new Error('Tesseract script failed to load'));
        };
        document.head.appendChild(script);
      });
      ocrScriptPromise.catch(function () { ocrScriptPromise = null; });
    }
    return ocrScriptPromise;
  }

  // Create the worker on first use (Thai + English), then reuse it for later scans
  function getOcrWorker() {
    if (!ocrWorkerPromise) {
      var workerPromise = loadTesseract().then(function (Tesseract) {
        return Tesseract.createWorker(['tha', 'eng']);
      });
      ocrWorkerPromise = workerPromise;
      workerPromise.catch(function () {
        if (ocrWorkerPromise === workerPromise) ocrWorkerPromise = null;
      });
    }
    return ocrWorkerPromise;
  }

  // Terminate the worker. The next scan will create a new one.
  function stopOcrWorker() {
    var workerPromise = ocrWorkerPromise;
    ocrWorkerPromise = null;
    if (workerPromise) {
      workerPromise.then(function (worker) { return worker.terminate(); }).catch(function () {});
    }
  }

  function clearOcrTimers() {
    clearTimeout(ocrSlowTimer);
    clearTimeout(ocrGiveUpTimer);
  }

  // Ends the scan in flight, if any, so its late results are ignored. The worker is only stopped
  // while a scan is running. A finished scan keeps its worker for the next photo.
  function endOcrScan() {
    ocrScanId++;
    clearOcrTimers();
    if (ocrScanState === 'processing') stopOcrWorker();
  }

  // Shows the status card in the capture bar's slot. Processing gets Cancel;
  // success and failure get Retake / Remove.
  function showCaptureStatus(state, title, sub) {
    var processing = state === 'processing';
    ocrScanState = state;
    captureIdleEl.hidden = true;
    captureStatusEl.hidden = false;
    captureStatusEl.className = 'capture-status-card' +
      (state === 'success' ? ' status-success' : '') +
      (state === 'failure' ? ' status-fail' : '');
    captureThumbEl.className = 'capture-thumb' + (processing ? ' is-processing' : '');
    captureScanSweep.hidden = !processing;
    captureStatusDot.className = 'status-dot ' +
      (processing ? 'dot-processing' : state === 'success' ? 'dot-success' : 'dot-fail');
    captureStatusText.textContent = title;
    captureStatusSub.textContent = sub;
    captureCancelBtn.hidden = !processing;
    captureRetakeBtn.hidden = processing;
    captureRemoveBtn.hidden = processing;
  }

  function showFailure() {
    // Neutral on purpose: an ordinary outcome for a blurry photo, not an error. Never blocks Add.
    showCaptureStatus('failure', 'Couldn’t read that photo', 'No worries — fill in the details below.');
  }

  // Back to Idle. Drops the thumbnail and every "from photo" flag. Typed values stay where they are.
  function showIdle() {
    clearPhotoFlags();
    photoPrevUnit = null;
    if (ocrObjectUrl) {
      URL.revokeObjectURL(ocrObjectUrl);
      ocrObjectUrl = null;
    }
    captureThumbImg.removeAttribute('src');
    captureIdleEl.hidden = false;
    captureStatusEl.hidden = true;
    ocrScanState = 'idle';
  }

  // Full reset of the capture bar: stops a scan in flight, then goes back to Idle
  function resetCaptureBar() {
    endOcrScan();
    showIdle();
  }

  // Decode the photo and draw it onto a canvas whose long side is at most OCR_MAX_SIDE.
  // Small photos are never enlarged.
  function photoToCanvas(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (!w || !h) {
          reject(new Error('Photo has no pixels'));
          return;
        }
        var scale = Math.min(1, OCR_MAX_SIDE / Math.max(w, h));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      img.onerror = function () { reject(new Error('Could not decode photo')); };
      img.src = url;
    });
  }

  // "Set" means the extractor returned something usable. null, undefined, blank and NaN all count as nothing.
  function isSet(v) {
    if (v === null || v === undefined) return false;
    return String(v).trim() !== '';
  }

  function hasNumber(v) {
    return isSet(v) && !isNaN(Number(v));
  }

  // The form wrapper that holds each photo-fillable field (the unit pills use their own wrapper)
  function photoWrappers() {
    return [nameInput, priceInput, shippingInput, unitSizeInput, packCountInput]
      .map(function (el) { return el.closest('.field'); })
      .concat([unitMeasureGroup.closest('.unit-compact-wrap')]);
  }

  function markFromPhoto(wrapper) {
    if (wrapper.classList.contains('prefilled')) return;
    wrapper.classList.add('prefilled');
    var flag = document.createElement('span');
    flag.className = 'prefilled-flag';
    flag.textContent = 'from photo';
    wrapper.querySelector('label').appendChild(flag);
  }

  function clearPhotoFlag(wrapper) {
    wrapper.classList.remove('prefilled');
    var flag;
    while ((flag = wrapper.querySelector('.prefilled-flag'))) {
      flag.parentNode.removeChild(flag);
    }
  }

  function clearPhotoFlags() {
    photoWrappers().forEach(function (wrapper) { clearPhotoFlag(wrapper); });
  }

  // Writes one value into an input the photo filled, flags it, and fires the same
  // events a user typing would (so Preview and the unit-size warning update).
  // Returns false if the input did not accept the value, or already held it (nothing changed, so no flag).
  function fillFromPhoto(input, value) {
    var before = input.value;
    input.value = value;
    if (input.value === '' || input.value === before) return false;
    markFromPhoto(input.closest('.field'));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // Selects a unit pill without moving focus or flagging it
  function selectUnitPillQuietly(value) {
    Array.prototype.slice.call(unitMeasureGroup.querySelectorAll('.unit-pill')).forEach(function (pill) {
      var isMatch = pill.dataset.value === value;
      pill.setAttribute('aria-checked', isMatch ? 'true' : 'false');
      pill.tabIndex = isMatch ? 0 : -1;
    });
  }

  // Selects a unit pill for a photo fill. Runs in the background after a scan, so focus does not move.
  // Only a real change gets the "from photo" flag, and the pill the user had is remembered for "Remove".
  function setUnitFromPhoto(value) {
    var unitWrap = unitMeasureGroup.closest('.unit-compact-wrap');
    var before = getUnitMeasureValue();
    if (before === value) return; // already the photo's unit: nothing changed, no flag
    if (!unitWrap.classList.contains('prefilled')) photoPrevUnit = before;
    selectUnitPillQuietly(value);
    markFromPhoto(unitWrap);
  }

  // "Remove" on the capture card: empties every field the photo filled and the user has not edited yet.
  // Edited fields lost their flag already, so their values stay. Pack goes back to 1, and a unit pill
  // the photo changed goes back to the one the user had.
  function removePhotoFills() {
    [
      { input: nameInput, value: '' },
      { input: priceInput, value: '' },
      { input: unitSizeInput, value: '' },
      { input: packCountInput, value: '1' }
    ].forEach(function (fill) {
      if (!fill.input.closest('.field').classList.contains('prefilled')) return;
      fill.input.value = fill.value;
      // same events a user typing would fire, so Preview and the unit-size warning update
      fill.input.dispatchEvent(new Event('input', { bubbles: true }));
      fill.input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    var unitWrap = unitMeasureGroup.closest('.unit-compact-wrap');
    if (unitWrap.classList.contains('prefilled') && photoPrevUnit) {
      selectUnitPillQuietly(photoPrevUnit);
    }
    updateUnitSizeWarning();
    updatePreview();
  }

  // Fill rules: only blank fields get filled, so typed values and the remembered product name are never overwritten
  function applyExtraction(ex) {
    var filledCount = 0;
    var missing = []; // essential fields the photo could not read, used for the partial-success wording

    if (isSet(ex.name)) {
      if (nameInput.value.trim() === '' && fillFromPhoto(nameInput, String(ex.name).trim())) filledCount++;
    } else {
      missing.push('the product name');
    }

    if (hasNumber(ex.price)) {
      if (priceInput.value === '' && fillFromPhoto(priceInput, Number(ex.price))) filledCount++;
    } else {
      missing.push('the price');
    }

    // Shipping is never filled from a photo (the design keeps it hand-entered)

    // Size and unit go together. A size with no known unit would be a guess, so neither is filled alone.
    var hasUnit = isSet(ex.unitOfMeasure) && UNIT_INFO.hasOwnProperty(ex.unitOfMeasure);
    if (hasNumber(ex.unitSize) && hasUnit) {
      if (unitSizeInput.value === '' && fillFromPhoto(unitSizeInput, Number(ex.unitSize))) {
        setUnitFromPhoto(ex.unitOfMeasure);
        filledCount += 2;
      }
    } else {
      missing.push('the size');
    }

    // Pack count only fills while it is still the default 1 and is not disabled (fixed bundle)
    var pack = Math.round(Number(ex.packCount));
    if (hasNumber(ex.packCount) && pack >= 1 && packCountInput.value === '1' && !packCountInput.disabled &&
        fillFromPhoto(packCountInput, pack)) {
      filledCount++;
    }

    updateUnitSizeWarning();
    updatePreview();

    if (filledCount === 0) {
      showFailure();
      return;
    }
    if (missing.length === 0) {
      showCaptureStatus('success', 'Pre-filled from photo', 'Check the flagged fields below before adding.');
      return;
    }
    var list = missing.length === 1
      ? missing[0]
      : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1];
    showCaptureStatus('success', 'Filled in what we could read', 'Couldn’t make out ' + list + ' — check the rest below.');
  }

  // Runs one scan: thumbnail, downscale, OCR, extract, fill. Results from a stale scan id are dropped.
  function startOcrScan(file, mode) {
    endOcrScan(); // a new photo replaces any scan still running
    var scanId = ocrScanId;
    ocrLastMode = mode;

    if (ocrObjectUrl) URL.revokeObjectURL(ocrObjectUrl);
    ocrObjectUrl = URL.createObjectURL(file);
    captureThumbImg.src = ocrObjectUrl;
    showCaptureStatus('processing', 'Reading photo…', 'This can take a few seconds.');

    ocrSlowTimer = setTimeout(function () {
      if (scanId === ocrScanId) {
        captureStatusSub.textContent = 'First scan downloads the text reader — this can take a bit longer';
      }
    }, OCR_SLOW_MS);

    ocrGiveUpTimer = setTimeout(function () {
      if (scanId !== ocrScanId) return;
      endOcrScan(); // also stops the worker, so the next scan starts clean
      showFailure();
    }, OCR_GIVE_UP_MS);

    photoToCanvas(ocrObjectUrl)
      .then(function (canvas) {
        return getOcrWorker().then(function (worker) {
          return worker.recognize(canvas);
        });
      })
      .then(function (result) {
        if (scanId !== ocrScanId) return;
        // Tesseract returns words and lines nested inside blocks; the extractor needs only each line's text and height
        var lines = (result.data.lines || []).map(function (l) {
          return { text: l.text, h: l.bbox ? l.bbox.y1 - l.bbox.y0 : 0 };
        });
        if (!window.OcrExtract) throw new Error('OcrExtract is not loaded');
        // Promise.resolve covers both a plain return value and a promise from the extractor
        return Promise.resolve(window.OcrExtract.extract(lines, { mode: mode, currency: appCurrency }))
          .then(function (extracted) {
            if (scanId !== ocrScanId) return;
            clearOcrTimers();
            applyExtraction(extracted || {});
          });
      })
      .catch(function (err) {
        if (scanId !== ocrScanId) return;
        console.warn('Photo read failed:', err);
        clearOcrTimers();
        showFailure();
      });
  }

  function handlePickedFile(input, mode) {
    var file = input.files && input.files[0];
    input.value = ''; // lets the same photo be picked again later
    if (file) startOcrScan(file, mode);
  }

  snapBtn.addEventListener('click', function () { snapInput.click(); });
  uploadBtn.addEventListener('click', function () { uploadInput.click(); });
  snapInput.addEventListener('change', function () { handlePickedFile(snapInput, 'photo'); });
  uploadInput.addEventListener('change', function () { handlePickedFile(uploadInput, 'screenshot'); });

  // Paste a screenshot anywhere in the form panel. Text pastes are left alone.
  formDetails.addEventListener('paste', function (e) {
    var clipboardItems = e.clipboardData ? e.clipboardData.items : null;
    if (!clipboardItems) return;
    for (var i = 0; i < clipboardItems.length; i++) {
      if (clipboardItems[i].kind === 'file' && clipboardItems[i].type.indexOf('image/') === 0) {
        var pasted = clipboardItems[i].getAsFile();
        if (pasted) {
          e.preventDefault();
          startOcrScan(pasted, 'screenshot');
        }
        return;
      }
    }
  });

  captureCancelBtn.addEventListener('click', resetCaptureBar);
  captureRemoveBtn.addEventListener('click', function () {
    removePhotoFills(); // empty the unedited photo fills first, while their "from photo" flags are still there
    resetCaptureBar();
  });
  captureRetakeBtn.addEventListener('click', function () {
    (ocrLastMode === 'photo' ? snapInput : uploadInput).click();
  });

  // A "from photo" flag clears as soon as the user edits that field. Our own fills dispatch
  // untrusted events (isTrusted is false), so they never clear the flags they just set.
  [nameInput, priceInput, shippingInput, unitSizeInput, packCountInput].forEach(function (input) {
    input.addEventListener('input', function (e) {
      if (e.isTrusted) clearPhotoFlag(input.closest('.field'));
    });
  });
  promoSelect.addEventListener('change', function (e) {
    if (e.isTrusted) clearPhotoFlag(packCountInput.closest('.field'));
  });
  unitMeasureGroup.addEventListener('click', function (e) {
    if (e.isTrusted) clearPhotoFlag(unitMeasureGroup.closest('.unit-compact-wrap'));
  });
  unitMeasureGroup.addEventListener('keydown', function (e) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(e.key) !== -1) {
      clearPhotoFlag(unitMeasureGroup.closest('.unit-compact-wrap'));
    }
  });

  // ---------- Init ----------
  // Hydrate from localStorage if available
  var storedState = loadState();
  items = storedState.items;
  appCurrency = storedState.appCurrency;

  // Rebuild product name order from loaded items — productNameOrder is only
  // appended to on add (see submit handler), so a fresh page load needs it
  // seeded from whatever was restored, in the order those items appear.
  items.forEach(function (item) {
    var name = item.name.trim();
    if (productNameOrder.indexOf(name) === -1) {
      productNameOrder.push(name);
    }
  });

  appCurrencySelect.value = appCurrency;
  updatePromoUI();
  initUnitPillGroup();
  renderResults();
})();
