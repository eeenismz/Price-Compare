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
  var sheetEl = document.getElementById('item-sheet');
  var sheetTitle = document.getElementById('sheet-title');
  var sheetCloseBtn = document.getElementById('sheet-close');
  var sheetScrim = document.getElementById('sheet-scrim');
  var dockEl = document.getElementById('dock');
  var dockCamBtn = document.getElementById('dock-cam');
  var dockAddBtn = document.getElementById('dock-add');

  var appCurrencySelect = document.getElementById('app-currency');

  var nameInput = document.getElementById('item-name');
  var nameError = document.getElementById('name-error');
  var priceInput = document.getElementById('item-price');
  var shippingInput = document.getElementById('item-shipping');

  var unitSizeInput = document.getElementById('item-unit-size');
  var unitSizeWarning = document.getElementById('unit-size-warning');
  var unitNameEl = document.getElementById('unit-name');
  var unitMeasureGroup = document.getElementById('item-unit-measure');
  var packCountInput = document.getElementById('item-pack-count');
  var packMinusBtn = document.getElementById('pack-minus');
  var packPlusBtn = document.getElementById('pack-plus');

  var moreToggle = document.getElementById('more-toggle');
  var morePanel = document.getElementById('more-panel');
  var moreSummary = document.getElementById('more-summary');

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

  var lede = document.getElementById('lede');
  var emptyState = document.getElementById('empty-state');
  var menuBtn = document.getElementById('menu-btn');
  var menuPanel = document.getElementById('menu');
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

  // Full unit name shown under the short pill labels (ml, L, g, kg, pc, sheet)
  var UNIT_FULL_NAME = { ml: 'Milliliters', l: 'Liters', g: 'Grams', kg: 'Kilograms', piece: 'Piece', sheet: 'Sheet' };

  function updateUnitName() {
    unitNameEl.textContent = UNIT_FULL_NAME[getUnitMeasureValue()] || '';
  }

  // Runs after every unit change (pill click, keyboard, photo fill, edit), so the name follows along too
  function updateUnitSizeWarning() {
    updateUnitName();
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
    updateMoreSummary(); // a promo is a hidden value too, so the disclosure summary has to show it
  }

  promoSelect.addEventListener('change', updatePromoUI);

  // ---------- Add/edit sheet, menu and dock ----------
  // Phones: the form is a bottom sheet over the results, opened from the dock.
  // 900px and up: the form is a permanent side column and the dock is hidden.
  var wideMQ = window.matchMedia('(min-width: 900px)');
  var sheetOpen = false;        // phone only: on wide screens the sheet is always visible
  var sheetReturnFocus = null;  // what had focus when the sheet opened; focused again on close (phones)
  var expandedId = null;        // id of the offer whose Edit / Remove buttons are showing

  function isWide() {
    return wideMQ.matches;
  }

  // Applies the sheet state to the DOM in one place
  function syncSheetUI() {
    var visible = sheetOpen || isWide();
    sheetEl.classList.toggle('on', sheetOpen);
    sheetEl.inert = !visible; // a closed sheet must not be reachable by Tab or screen readers
    sheetScrim.hidden = !sheetOpen || isWide();
    dockEl.hidden = sheetOpen;
  }

  function openSheet(focusEl) {
    if (!isWide()) sheetReturnFocus = document.activeElement;
    sheetOpen = true;
    syncSheetUI();
    if (focusEl) focusEl.focus();
  }

  function closeSheet() {
    var returnTo = sheetReturnFocus;
    var wasOpen = sheetOpen;
    sheetOpen = false;
    sheetReturnFocus = null;
    syncSheetUI();
    if (wasOpen && !isWide() && returnTo && document.body.contains(returnTo)) {
      returnTo.focus(); // back to the button that opened the sheet
    }
  }

  // "Add offer" from the dock, or the camera: a fresh form, then the sheet
  function openAddSheet(focusEl) {
    resetForm();
    openSheet(focusEl);
  }

  dockAddBtn.addEventListener('click', function () { openAddSheet(priceInput); });

  // The camera opens the sheet and goes straight to the camera (or file picker) without focusing a field
  dockCamBtn.addEventListener('click', function () {
    openAddSheet(null);
    snapInput.click();
  });

  sheetCloseBtn.addEventListener('click', closeSheet);
  sheetScrim.addEventListener('click', closeSheet);

  // Phones: when the on-screen keyboard covers the field being typed in, scroll that field into view
  sheetEl.addEventListener('focusin', function (e) {
    if (!isWide() && e.target.tagName === 'INPUT') {
      setTimeout(function () { e.target.scrollIntoView({ block: 'center' }); }, 300);
    }
  });

  // The sheet follows the screen size: bottom sheet <-> side column
  if (wideMQ.addEventListener) {
    wideMQ.addEventListener('change', syncSheetUI);
  } else {
    wideMQ.addListener(syncSheetUI); // older iOS Safari
  }

  // Header overflow menu (holds Clear all)
  function closeMenu() {
    menuPanel.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  menuBtn.addEventListener('click', function (e) {
    e.stopPropagation(); // keeps the click-outside check below from closing the menu straight away
    var opening = menuPanel.hidden;
    menuPanel.hidden = !opening;
    menuBtn.setAttribute('aria-expanded', String(opening));
  });

  document.addEventListener('click', function (e) {
    if (!menuPanel.hidden && !menuPanel.contains(e.target)) closeMenu();
  });

  // Escape closes the menu first, otherwise the phone sheet
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!menuPanel.hidden) {
      closeMenu();
    } else if (sheetOpen && !isWide()) {
      closeSheet();
    }
  });

  // ---------- Pack / shipping / promotion disclosure ----------
  function setMoreOpen(open) {
    morePanel.hidden = !open;
    moreToggle.setAttribute('aria-expanded', String(open));
  }

  moreToggle.addEventListener('click', function () {
    setMoreOpen(moreToggle.getAttribute('aria-expanded') !== 'true');
  });

  // Shows every non-default value hidden in the closed disclosure, so none of them can change the result silently
  function updateMoreSummary() {
    var parts = [];
    var pack = parseInt(packCountInput.value, 10);
    if (pack > 1) parts.push('pack ' + pack);
    if (parseFloat(shippingInput.value) > 0) parts.push('shipping');
    if (promoSelect.value !== 'none') parts.push('promo');
    moreSummary.textContent = parts.length ? parts.join(', ') : 'none set';
  }

  packCountInput.addEventListener('input', updateMoreSummary);
  shippingInput.addEventListener('input', updateMoreSummary);

  // The stepper buttons. A tap is a real edit, so it also clears the "from photo" flag on Pack.
  function stepPack(delta) {
    if (packCountInput.disabled) return;
    packCountInput.value = Math.max(1, (parseInt(packCountInput.value, 10) || 1) + delta);
    clearPhotoFlag(packCountInput.closest('.field'));
    packCountInput.dispatchEvent(new Event('input', { bubbles: true }));
    packCountInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  packMinusBtn.addEventListener('click', function () { stepPack(-1); });
  packPlusBtn.addEventListener('click', function () { stepPack(1); });

  // Enter (the phone's "Next" key) moves Product -> Price -> Size. Enter on Size falls through to the native submit.
  [nameInput, priceInput].forEach(function (input, i) {
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      (i === 0 ? priceInput : unitSizeInput).focus();
    });
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
    setMoreOpen(false);
    submitBtn.textContent = 'Add offer';
    cancelBtn.hidden = true;
    sheetTitle.textContent = 'Add an offer';
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

    expandedId = null; // the Edit / Remove reveal goes away once the sheet is open
    // Open the disclosure when this offer has a pack, shipping or promotion to show
    setMoreOpen(item.packCount > 1 || item.shippingFee > 0 || item.promo.type !== 'none');
    submitBtn.textContent = 'Save changes';
    cancelBtn.hidden = false;
    sheetTitle.textContent = 'Edit an offer';

    updatePreview();
    openSheet(priceInput);
  }

  cancelBtn.addEventListener('click', function () {
    resetForm();
    closeSheet();
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

    var wasEditing = !!editingId; // resetForm() below clears editingId, so read it first

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

    expandedId = null; // a saved or new offer comes back collapsed
    saveState();
    resetForm();
    renderResults();

    // Add or Save closes the sheet. The offer is already ranked in the results behind it.
    closeSheet();
    showInfoToast(wasEditing ? 'Changes saved' : 'Offer added');
    if (isWide()) priceInput.focus(); // wide screens keep the form open for the next offer
  });

  // ---------- Remove + undo toast ----------
  function hideToast() {
    toastEl.hidden = true;
  }

  // A plain confirmation with no Undo. It is skipped while an Undo is still pending, so that Undo stays available.
  function showInfoToast(message) {
    if (!toastEl.hidden && !toastUndoBtn.hidden) return;
    clearTimeout(removedUndoTimeout);
    toastMessage.textContent = message;
    toastUndoBtn.hidden = true;
    toastUndoBtn.onclick = null;
    toastEl.hidden = false;
    removedUndoTimeout = setTimeout(hideToast, 5000);
  }

  function showUndoToast(item, index) {
    clearTimeout(removedUndoTimeout);
    toastMessage.textContent = "Removed '" + item.name + "'.";
    toastUndoBtn.hidden = false;
    toastEl.hidden = false;

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
    toastUndoBtn.hidden = false;
    toastEl.hidden = false;

    toastUndoBtn.onclick = function () {
      clearTimeout(removedUndoTimeout);
      items = removedItems; // restore the whole list as it was
      // Clear all emptied productNameOrder, so rebuild it here too or the results stay blank (same as on page load)
      productNameOrder = [];
      items.forEach(function (item) {
        var name = item.name.trim();
        if (productNameOrder.indexOf(name) === -1) productNameOrder.push(name);
      });
      saveState();
      hideToast();
      renderResults();
    };

    removedUndoTimeout = setTimeout(hideToast, 5000);
  }

  clearAllBtn.addEventListener('click', function () {
    closeMenu();
    if (items.length === 0) return;

    var removedItems = items;
    items = [];
    productNameOrder = [];
    lastProductName = ''; // don't carry the old name into a fully-cleared list
    expandedId = null;
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
      lede.hidden = true;
      menuBtn.hidden = true;
      closeMenu();
      return;
    }
    emptyState.hidden = true;
    lede.hidden = false;
    menuBtn.hidden = false;

    // Drop the Edit / Remove reveal if that offer no longer exists
    if (expandedId && !items.some(function (i) { return i.id === expandedId; })) {
      expandedId = null;
    }

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

      // A winner, bars and "vs best" deltas only make sense for 2+ offers in one unit family
      var comparable = itemsWithPricing.length > 1 && !hasIncompatibleFamilies;

      // Product card
      var groupDiv = document.createElement('section');
      groupDiv.className = 'group';

      var headDiv = document.createElement('div');
      headDiv.className = 'g-head';

      var nameEl = document.createElement('h2');
      nameEl.className = 'g-name';
      nameEl.textContent = productName;
      headDiv.appendChild(nameEl);

      var countSpan = document.createElement('span');
      countSpan.className = 'g-count';
      countSpan.textContent = itemsWithPricing.length + ' offer' + (itemsWithPricing.length === 1 ? '' : 's');
      headDiv.appendChild(countSpan);

      groupDiv.appendChild(headDiv);

      // One line under the product: the incompatible-units note, the insight, or the single-offer note
      var insightP = document.createElement('p');
      if (hasIncompatibleFamilies) {
        insightP.className = 'note';
        insightP.textContent = 'Comparing across incompatible units — no direct Best Value.';
      } else if (itemsWithPricing.length > 1) {
        var bestEntry = itemsWithPricing[0];
        var priciest = itemsWithPricing[itemsWithPricing.length - 1];

        // Calculate the "more you'd pay" amount
        var priceDiff = priciest.pricing.pricePerBaseUnit - bestEntry.pricing.pricePerBaseUnit;
        var scaleMultiplier = (bestEntry.pricing.family === 'volume' || bestEntry.pricing.family === 'mass') ? 10 : 1;
        var scaledDiff = priceDiff * scaleMultiplier;
        var unitWord = bestEntry.pricing.family === 'volume' ? 'litre' :
                       bestEntry.pricing.family === 'mass' ? 'kilo' :
                       bestEntry.pricing.family;

        insightP.className = 'insight';
        insightP.appendChild(document.createTextNode('The priciest option costs '));
        var diffStrong = document.createElement('strong');
        diffStrong.textContent = appCurrency + scaledDiff.toFixed(2);
        insightP.appendChild(diffStrong);
        insightP.appendChild(document.createTextNode(' more per ' + unitWord + '.'));
      } else {
        insightP.className = 'insight';
        insightP.textContent = 'Only one offer entered — add another to see how it compares.';
      }
      groupDiv.appendChild(insightP);

      var offersDiv = document.createElement('div');
      offersDiv.className = 'offers';

      var maxPrice = itemsWithPricing[itemsWithPricing.length - 1].pricing.pricePerBaseUnit;
      var bestPrice = itemsWithPricing[0].pricing.pricePerBaseUnit;

      itemsWithPricing.forEach(function (entry, idx) {
        var item = entry.item;
        var pricing = entry.pricing;
        var isBest = comparable && idx === 0;

        var offerDiv = document.createElement('div');
        offerDiv.className = 'offer' + (isBest ? ' win' : '');
        offerDiv.dataset.id = item.id;

        // Tapping the offer's summary reveals Edit / Remove
        var mainBtn = document.createElement('button');
        mainBtn.type = 'button';
        mainBtn.className = 'offer-main';
        mainBtn.setAttribute('aria-expanded', String(expandedId === item.id));

        var labelSpan = document.createElement('span');
        labelSpan.className = 'o-label';

        if (isBest) {
          var badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = 'Best value';
          labelSpan.appendChild(badge);
        }

        var derivedLabel = getDerivedLabel(item);
        if (derivedLabel) {
          var tagSpan = document.createElement('span');
          tagSpan.className = 'o-tag';
          tagSpan.textContent = derivedLabel;
          labelSpan.appendChild(tagSpan);
        }

        var detailSpan = document.createElement('span');
        detailSpan.className = 'o-detail';
        var detail = buildListingDetail(item);
        if (item.shippingFee > 0) {
          detail = appendShippingNote(detail, item);
        }
        detailSpan.textContent = detail;
        labelSpan.appendChild(detailSpan);
        mainBtn.appendChild(labelSpan);

        var priceSpan = document.createElement('span');
        priceSpan.className = 'o-price';

        var bigSpan = document.createElement('span');
        bigSpan.className = 'big';
        bigSpan.textContent = pricing.pricePerBaseUnit.toFixed(2);
        priceSpan.appendChild(bigSpan);

        var perSpan = document.createElement('span');
        perSpan.className = 'per';
        perSpan.textContent = 'per ' + pricing.unitLabel;
        priceSpan.appendChild(perSpan);
        mainBtn.appendChild(priceSpan);

        if (comparable) {
          // Relative-cost bar: this price against the priciest offer in the group
          var barSpan = document.createElement('span');
          barSpan.className = 'bar';
          barSpan.setAttribute('aria-hidden', 'true');
          var barFill = document.createElement('i');
          barFill.style.width = ((pricing.pricePerBaseUnit / maxPrice) * 100) + '%';
          barSpan.appendChild(barFill);
          mainBtn.appendChild(barSpan);

          if (!isBest) {
            var deltaWrap = document.createElement('span');
            deltaWrap.className = 'o-extra';
            var deltaStrong = document.createElement('span');
            deltaStrong.className = 'delta';
            deltaStrong.textContent = '+' + appCurrency + (pricing.pricePerBaseUnit - bestPrice).toFixed(2);
            deltaWrap.appendChild(deltaStrong);
            deltaWrap.appendChild(document.createTextNode(' vs best'));
            mainBtn.appendChild(deltaWrap);
          }
        }

        offerDiv.appendChild(mainBtn);

        // Edit / Remove, only for the tapped offer
        if (expandedId === item.id) {
          var actsDiv = document.createElement('div');
          actsDiv.className = 'acts';

          var editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'btn-edit-sm';
          editBtn.textContent = 'Edit';
          editBtn.dataset.id = item.id;
          actsDiv.appendChild(editBtn);

          var removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'btn-remove-sm';
          removeBtn.textContent = 'Remove';
          removeBtn.dataset.id = item.id;
          actsDiv.appendChild(removeBtn);

          offerDiv.appendChild(actsDiv);
        }

        offersDiv.appendChild(offerDiv);
      });

      groupDiv.appendChild(offersDiv);
      resultsGroups.appendChild(groupDiv);
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

  // ---------- Delegated clicks: tap an offer to reveal Edit / Remove, and the two buttons ----------
  resultsGroups.addEventListener('click', function (e) {
    var mainBtn = e.target.closest('.offer-main');
    if (mainBtn) {
      var tappedId = mainBtn.closest('.offer').dataset.id;
      expandedId = expandedId === tappedId ? null : tappedId;
      renderResults();
      // The re-render replaces the button. Keyboard clicks (detail 0) get focus back on it; a tap does not
      // get a focus ring painted on it.
      var again = resultsGroups.querySelector('.offer[data-id="' + tappedId + '"] .offer-main');
      if (again && e.detail === 0) again.focus();
      return;
    }
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
  var OCR_FIRST_GIVE_UP_MS = 90000; // longer limit until one scan has worked: the first one also downloads the reader on mobile data
  var ocrReaderReady = false;   // true once a scan has finished, so the reader files are already downloaded

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
    }, ocrReaderReady ? OCR_GIVE_UP_MS : OCR_FIRST_GIVE_UP_MS);

    photoToCanvas(ocrObjectUrl)
      .then(function (canvas) {
        // Cancelled or replaced while downscaling: stop here so this stale scan
        // doesn't queue a useless recognize on the next scan's worker
        if (scanId !== ocrScanId) return null;
        return getOcrWorker().then(function (worker) {
          return worker.recognize(canvas);
        });
      })
      .then(function (result) {
        if (scanId !== ocrScanId || !result) return;
        ocrReaderReady = true;
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
  sheetEl.addEventListener('paste', function (e) {
    var clipboardItems = e.clipboardData ? e.clipboardData.items : null;
    if (!clipboardItems) return;
    // Copying from Excel/Word/some web pages puts text AND an image on the clipboard.
    // If there's any plain text, treat it as a normal text paste so it isn't lost.
    for (var t = 0; t < clipboardItems.length; t++) {
      if (clipboardItems[t].kind === 'string' && clipboardItems[t].type === 'text/plain') return;
    }
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
  updateUnitSizeWarning(); // also sets the full unit name under the pills
  syncSheetUI();
  renderResults();
})();
