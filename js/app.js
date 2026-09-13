// Price Compare — Phase 2: Unit-price system
// Everything lives in memory for the page's lifetime. No database, no localStorage.

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

  // ---------- State ----------
  var items = [];              // in-memory list of all items for this session
  var editingId = null;        // id of item currently being edited, or null when adding
  var lastProductName = '';    // remembers the last-added product name, for the next add
  var appCurrency = 'THB';     // the single app-wide currency everything is compared in, this session only
  var lastChangedId = null;    // id of the item to flash after the next render
  var removedUndoTimeout = null;

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
  var unitMeasureInput = document.getElementById('item-unit-measure');
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
    renderResults(); // existing items aren't retroactively reinterpreted, just re-sorted/re-rendered
  });

  // ---------- Form reset / edit mode ----------
  function resetForm() {
    editingId = null;
    form.reset();
    nameInput.value = lastProductName; // pre-fill with the last name — comparing offers of the same product shouldn't mean retyping it each time
    unitSizeInput.value = '';
    unitMeasureInput.value = 'piece';
    packCountInput.value = '1';
    promoSelect.value = 'none';
    updatePromoUI();
    submitBtn.textContent = 'Add Item';
    cancelBtn.hidden = true;
    formSummary.textContent = 'Add Item';
    nameError.hidden = true;
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

    editingId = id;
    nameInput.value = item.name;
    priceInput.value = item.price;
    unitSizeInput.value = item.unitSize;
    unitMeasureInput.value = item.unitOfMeasure;
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
    formSummary.textContent = 'Edit item';

    formDetails.open = true; // always reveal the form when entering edit mode
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
    var unitOfMeasure = unitMeasureInput.value;
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
      lastChangedId = newItem.id;
    }

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
      hideToast();
      renderResults();
    };

    removedUndoTimeout = setTimeout(hideToast, 5000);
  }

  clearAllBtn.addEventListener('click', function () {
    if (items.length === 0) return;

    var removedItems = items;
    items = [];
    lastProductName = ''; // don't carry the old name into a fully-cleared list
    resetForm(); // always return to a blank form, not just when mid-edit

    renderResults();
    showBulkUndoToast(removedItems);
  });

  // ---------- Rendering ----------
  function buildItemCard(item, pricing, isBest) {
    var li = document.createElement('li');
    li.className = 'item-card' + (isBest ? ' best-value' : '');
    li.dataset.id = item.id;

    if (isBest) {
      var badge = document.createElement('span');
      badge.className = 'badge-best';
      badge.textContent = 'Best Value';
      li.appendChild(badge);
    }

    var main = document.createElement('div');
    main.className = 'item-card-main';

    var info = document.createElement('div');
    info.className = 'item-card-info';

    var nameEl = document.createElement('h3');
    nameEl.className = 'item-name';
    nameEl.textContent = item.name;
    info.appendChild(nameEl);

    var chipText = getPromoChipText(item);
    if (chipText) {
      var chip = document.createElement('span');
      chip.className = 'promo-chip';
      chip.textContent = chipText;
      info.appendChild(document.createElement('br'));
      info.appendChild(chip);
    }

    main.appendChild(info);

    var priceBox = document.createElement('div');
    priceBox.className = 'item-card-price';

    var originalLine = document.createElement('p');
    originalLine.className = 'item-original';

    // Format: "199.00 for 3 × 850ml" or "199.00 for 850ml" or just "199.00" if packCount is 1
    var displayText;

    if (item.promo.type === 'fixedBundle') {
      // Fixed bundle ignores item.price entirely — show the bundle's own total (X)
      // and pack count (N) instead, since leading with the unused Price field
      // is exactly the "Price silently means something else" confusion this
      // rewrite exists to eliminate.
      displayText = item.promo.x.toFixed(2) + ' for ' + item.promo.n + ' × ' + item.unitSize + item.unitOfMeasure + ' (bundle)';
    } else if (item.packCount > 1) {
      displayText = item.price.toFixed(2);
      displayText += ' for ' + item.packCount + ' × ' + item.unitSize + item.unitOfMeasure;
    } else {
      displayText = item.price.toFixed(2) + ' for ' + item.unitSize + item.unitOfMeasure;
    }

    originalLine.textContent = displayText;
    priceBox.appendChild(originalLine);

    if (item.shippingFee > 0) {
      var shippingLine = document.createElement('p');
      shippingLine.className = 'item-shipping';
      shippingLine.textContent = '+ ' + item.shippingFee.toFixed(2) + ' shipping';
      priceBox.appendChild(shippingLine);
    }

    var effLine = document.createElement('p');
    effLine.className = 'effective-line';

    var effPriceSpan = document.createElement('span');
    effPriceSpan.className = 'effective-price';
    effPriceSpan.textContent = pricing.pricePerBaseUnit.toFixed(2);
    effLine.appendChild(effPriceSpan);

    var unitLabelSpan = document.createElement('span');
    unitLabelSpan.className = 'effective-unit';
    unitLabelSpan.textContent = ' / ' + pricing.unitLabel;
    effLine.appendChild(unitLabelSpan);

    priceBox.appendChild(effLine);
    main.appendChild(priceBox);

    li.appendChild(main);

    var actions = document.createElement('div');
    actions.className = 'item-card-actions';

    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-edit';
    editBtn.textContent = 'Edit';
    editBtn.dataset.id = item.id;
    actions.appendChild(editBtn);

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = '✕ Remove';
    removeBtn.dataset.id = item.id;
    actions.appendChild(removeBtn);

    li.appendChild(actions);

    return li;
  }

  function renderResults() {
    resultsGroups.innerHTML = '';

    if (items.length === 0) {
      emptyState.hidden = false;
      resultsToolbar.hidden = true;
      return;
    }
    emptyState.hidden = true;
    resultsToolbar.hidden = false;

    // Group items by family (volume, mass, piece, sheet)
    var familyGroups = {
      volume: [],
      mass: [],
      piece: [],
      sheet: []
    };

    items.forEach(function (item) {
      var pricing = computeItemPrice(item);
      familyGroups[pricing.family].push({ item: item, pricing: pricing });
    });

    var familiesPresent = [];
    if (familyGroups.volume.length > 0) familiesPresent.push('volume');
    if (familyGroups.mass.length > 0) familiesPresent.push('mass');
    if (familyGroups.piece.length > 0) familiesPresent.push('piece');
    if (familyGroups.sheet.length > 0) familiesPresent.push('sheet');

    // If multiple families present, show a note
    if (familiesPresent.length > 1) {
      var note = document.createElement('div');
      note.className = 'family-note';
      note.textContent = 'Comparing across incompatible units — grouped separately, no direct Best Value between groups.';
      resultsGroups.appendChild(note);
    }

    // Render each family group
    familiesPresent.forEach(function (family) {
      var familyItems = familyGroups[family];
      if (familyItems.length === 0) return;

      // Sort by price per base unit ascending
      familyItems.sort(function (a, b) {
        return a.pricing.pricePerBaseUnit - b.pricing.pricePerBaseUnit;
      });

      var minPrice = familyItems[0].pricing.pricePerBaseUnit;

      var list = document.createElement('ul');
      list.className = 'item-list';

      familyItems.forEach(function (entry) {
        // Mark as Best Value if within epsilon tolerance and there's more than 1 item in the family
        var isBest = familyItems.length > 1 && Math.abs(entry.pricing.pricePerBaseUnit - minPrice) < 0.005;
        list.appendChild(buildItemCard(entry.item, entry.pricing, isBest));
      });

      resultsGroups.appendChild(list);
    });

    // Flash the row that was just added/edited/restored, as a visible confirmation.
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
    var editBtn = e.target.closest('.btn-edit');
    if (editBtn) {
      startEdit(editBtn.dataset.id);
      return;
    }
    var removeBtn = e.target.closest('.btn-remove');
    if (removeBtn) {
      removeItem(removeBtn.dataset.id);
    }
  });

  // ---------- Init ----------
  appCurrencySelect.value = appCurrency;
  updatePromoUI();
  renderResults();
})();
