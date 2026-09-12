// Price Compare — Phase 1 MVP
// Everything lives in memory for the page's lifetime. No database, no localStorage.

(function () {
  'use strict';

  // ---------- Promotion definitions ----------
  // Each entry knows how to compute the "effective unit price" from the raw
  // item price plus any extra params (n/x for bundle, y for second-fixed).
  var PROMO_TYPES = {
    none: {
      label: 'No promotion',
      helper: '',
      compute: function (price, promo) { return price / (promo.quantity || 1); },
      units: function (promo) { return promo.quantity || 1; }
    },
    bogo: {
      label: 'Buy 1 Get 1 Free',
      helper: 'Effective price = price ÷ 2',
      compute: function (price) { return price / 2; },
      units: function (promo) { return 2; }
    },
    second50: {
      label: 'Second item 50% off',
      helper: 'Effective price = price × 0.75',
      compute: function (price) { return price * 0.75; },
      units: function (promo) { return 2; }
    },
    buy3pay2: {
      label: 'Buy 3 Pay for 2',
      helper: 'Effective price = price × 2 ÷ 3',
      compute: function (price) { return (price * 2) / 3; },
      units: function (promo) { return 3; }
    },
    fixedBundle: {
      label: 'Fixed bundle price',
      helper: 'Effective price = total bundle price (X) ÷ number of units (N)',
      compute: function (price, promo) { return promo.x / promo.n; },
      units: function (promo) { return promo.n; }
    },
    secondFixed: {
      label: 'Second item at a fixed price',
      helper: 'Effective price = (price + second item price) ÷ 2',
      compute: function (price, promo) { return (price + promo.y) / 2; },
      units: function (promo) { return 2; }
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
  var quantityInput = document.getElementById('item-quantity');
  var quantityInfoBtn = document.getElementById('quantity-info-btn');
  var quantityHelper = document.getElementById('quantity-helper');
  var unitInput = document.getElementById('item-unit');
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

  // Chip text for a promo — spells out the actual deal for types with
  // parameters (bundle N/X, second-item Y) instead of just naming the promo,
  // since e.g. "Fixed bundle price" alone doesn't say it's 3-for-129.
  function getPromoChipText(promo) {
    if (promo.type === 'fixedBundle') {
      return promo.n + ' for ' + promo.x.toFixed(2);
    }
    if (promo.type === 'secondFixed') {
      return '2nd item at ' + promo.y.toFixed(2);
    }
    return PROMO_TYPES[promo.type].label;
  }

  function computeEffectivePrice(item) {
    var def = PROMO_TYPES[item.promo.type] || PROMO_TYPES.none;
    var base = def.compute(item.price, item.promo);
    var units = def.units(item.promo);
    var shipping = item.shippingFee || 0;
    return base + (shipping / units);
  }

  // ---------- Promo select UI (show/hide extra fields + helper text) ----------
  function updatePromoUI() {
    var type = promoSelect.value;
    fixedBundleFields.hidden = type !== 'fixedBundle';
    secondFixedField.hidden = type !== 'secondFixed';
    promoHelper.textContent = (PROMO_TYPES[type] || PROMO_TYPES.none).helper;

    // Quantity only drives the math when there's no promotion — a promotion
    // already defines its own unit count (BOGO = 2, fixed bundle N, etc.),
    // so disable Quantity then to avoid double-counting.
    quantityInput.disabled = type !== 'none';
    quantityHelper.textContent = type === 'none' ?
      'How many units your Price above pays for — e.g. if you paid 79 for 2 cups, enter 2 here and the app works out 39.50 each. Leave at 1 if Price is already for a single unit.' :
      'Ignored while a promotion is selected — the promotion above determines the unit count.';
  }

  promoSelect.addEventListener('change', updatePromoUI);

  // ---------- Info-icon tooltips (tap/click to toggle, one open at a time) ----------
  var infoTooltips = [
    { btn: priceInfoBtn, bubble: priceTooltip },
    { btn: quantityInfoBtn, bubble: quantityHelper }
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
    quantityInput.value = '1';
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
    shippingInput.value = item.shippingFee || '';
    quantityInput.value = item.promo.type === 'none' ? (item.promo.quantity || 1) : 1;
    unitInput.value = item.unitLabel || '';
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
    var shippingFeeRaw = shippingInput.value.trim();
    var shippingFee = shippingFeeRaw === '' ? 0 : parseFloat(shippingFeeRaw);
    var quantity = parseInt(quantityInput.value, 10);
    if (!quantity || quantity < 1) quantity = 1;
    var unitLabel = unitInput.value.trim();
    var promoType = promoSelect.value;

    if (!name) {
      nameError.hidden = false;
      return;
    }
    nameError.hidden = true;

    if (isNaN(price) || price < 0) {
      return; // required attrs handle most of this, this is just a guard
    }

    if (shippingFeeRaw !== '' && (isNaN(shippingFee) || shippingFee < 0)) {
      return; // blank means 0 and is fine; a present-but-invalid value blocks submit
    }

    lastProductName = name; // remember for the next add

    var promo = { type: promoType };

    if (promoType === 'none') {
      promo.quantity = quantity;
    } else if (promoType === 'fixedBundle') {
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
        existing.shippingFee = shippingFee;
        existing.unitLabel = unitLabel;
        existing.promo = promo;
        lastChangedId = existing.id;
      }
    } else {
      var newItem = {
        id: makeId(),
        name: name,
        price: price,
        shippingFee: shippingFee,
        unitLabel: unitLabel,
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
  function buildItemCard(item, effective, isBest) {
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

    var quantity = item.promo.type === 'none' ? (item.promo.quantity || 1) : 1;
    var chipText = item.promo.type !== 'none' ? getPromoChipText(item.promo) :
      (quantity > 1 ? 'Qty ' + quantity : null);

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
    originalLine.textContent = item.price.toFixed(2) +
      (quantity > 1 ? ' for ' + quantity : '') +
      (item.unitLabel ? ' · ' + item.unitLabel : '');
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
    effPriceSpan.textContent = effective.toFixed(2);
    effLine.appendChild(effPriceSpan);

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

    // Single flat list, cheapest effective price first. Existing items are
    // never retroactively reinterpreted when appCurrency changes — only the
    // sort order and the "Best Value" pick are re-evaluated on re-render.
    var entries = items.map(function (item) {
      return { item: item, eff: computeEffectivePrice(item) };
    });

    entries.sort(function (a, b) { return a.eff - b.eff; });

    var minEff = entries.reduce(function (min, e) {
      return e.eff < min ? e.eff : min;
    }, entries[0].eff);

    var list = document.createElement('ul');
    list.className = 'item-list';

    entries.forEach(function (entry) {
      // Small epsilon tolerance so floating-point rounding doesn't break ties.
      var isBest = entries.length > 1 && Math.abs(entry.eff - minEff) < 0.005;
      list.appendChild(buildItemCard(entry.item, entry.eff, isBest));
    });

    resultsGroups.appendChild(list);

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
