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
      compute: function (price) { return price; }
    },
    bogo: {
      label: 'Buy 1 Get 1 Free',
      helper: 'Effective price = price ÷ 2',
      compute: function (price) { return price / 2; }
    },
    second50: {
      label: 'Second item 50% off',
      helper: 'Effective price = price × 0.75',
      compute: function (price) { return price * 0.75; }
    },
    buy3pay2: {
      label: 'Buy 3 Pay for 2',
      helper: 'Effective price = price × 2 ÷ 3',
      compute: function (price) { return (price * 2) / 3; }
    },
    fixedBundle: {
      label: 'Fixed bundle price',
      helper: 'Effective price = total bundle price (X) ÷ number of units (N)',
      compute: function (price, promo) { return promo.x / promo.n; }
    },
    secondFixed: {
      label: 'Second item at a fixed price',
      helper: 'Effective price = (price + second item price) ÷ 2',
      compute: function (price, promo) { return (price + promo.y) / 2; }
    }
  };

  // ---------- State ----------
  var items = [];              // in-memory list of all items for this session
  var editingId = null;        // id of item currently being edited, or null when adding
  var lastCurrency = 'THB';    // remembers the last currency picked, for the next add
  var lastChangedId = null;    // id of the item to flash after the next render
  var removedUndoTimeout = null;

  // ---------- DOM refs ----------
  var form = document.getElementById('item-form');
  var formDetails = document.getElementById('item-form-details');
  var formSummary = document.getElementById('item-form-summary');

  var nameInput = document.getElementById('item-name');
  var nameError = document.getElementById('name-error');
  var priceInput = document.getElementById('item-price');
  var currencySelect = document.getElementById('item-currency');
  var unitInput = document.getElementById('item-unit');
  var promoSelect = document.getElementById('item-promo');
  var promoHelper = document.getElementById('promo-helper');
  var linkInput = document.getElementById('item-link');

  var fixedBundleFields = document.getElementById('fixed-bundle-fields');
  var bundleNInput = document.getElementById('bundle-n');
  var bundleXInput = document.getElementById('bundle-x');

  var secondFixedField = document.getElementById('second-fixed-field');
  var secondFixedYInput = document.getElementById('second-fixed-y');

  var submitBtn = document.getElementById('submit-btn');
  var cancelBtn = document.getElementById('cancel-edit-btn');

  var mismatchBanner = document.getElementById('mismatch-banner');
  var emptyState = document.getElementById('empty-state');
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

  function computeEffectivePrice(item) {
    var def = PROMO_TYPES[item.promo.type] || PROMO_TYPES.none;
    return def.compute(item.price, item.promo);
  }

  // ---------- Promo select UI (show/hide extra fields + helper text) ----------
  function updatePromoUI() {
    var type = promoSelect.value;
    fixedBundleFields.hidden = type !== 'fixedBundle';
    secondFixedField.hidden = type !== 'secondFixed';
    promoHelper.textContent = (PROMO_TYPES[type] || PROMO_TYPES.none).helper;
  }

  promoSelect.addEventListener('change', updatePromoUI);

  // ---------- Form reset / edit mode ----------
  function resetForm() {
    editingId = null;
    form.reset();
    currencySelect.value = lastCurrency; // keep the last-used currency instead of the HTML default
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
    currencySelect.value = item.currency;
    unitInput.value = item.unitLabel || '';
    promoSelect.value = item.promo.type;
    updatePromoUI();

    if (item.promo.type === 'fixedBundle') {
      bundleNInput.value = item.promo.n;
      bundleXInput.value = item.promo.x;
    } else if (item.promo.type === 'secondFixed') {
      secondFixedYInput.value = item.promo.y;
    }

    linkInput.value = item.referenceLink || '';

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
    var currency = currencySelect.value;
    var unitLabel = unitInput.value.trim();
    var promoType = promoSelect.value;
    var referenceLink = linkInput.value.trim();

    if (!name) {
      nameError.hidden = false;
      return;
    }
    nameError.hidden = true;

    if (isNaN(price) || price < 0) {
      return; // required attrs handle most of this, this is just a guard
    }

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

    lastCurrency = currency; // remember for the next add

    if (editingId) {
      var existing = items.filter(function (i) { return i.id === editingId; })[0];
      if (existing) {
        existing.name = name;
        existing.price = price;
        existing.currency = currency;
        existing.unitLabel = unitLabel;
        existing.promo = promo;
        existing.referenceLink = referenceLink;
        lastChangedId = existing.id;
      }
    } else {
      var newItem = {
        id: makeId(),
        name: name,
        price: price,
        currency: currency,
        unitLabel: unitLabel,
        promo: promo,
        referenceLink: referenceLink
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

    if (item.promo.type !== 'none') {
      var chip = document.createElement('span');
      chip.className = 'promo-chip';
      chip.textContent = PROMO_TYPES[item.promo.type].label;
      info.appendChild(document.createElement('br'));
      info.appendChild(chip);
    }

    main.appendChild(info);

    var priceBox = document.createElement('div');
    priceBox.className = 'item-card-price';

    var originalLine = document.createElement('p');
    originalLine.className = 'item-original';
    originalLine.textContent = item.price.toFixed(2) + ' ' + item.currency +
      (item.unitLabel ? ' · ' + item.unitLabel : '');
    priceBox.appendChild(originalLine);

    var effLine = document.createElement('p');
    effLine.className = 'effective-line';

    var effPriceSpan = document.createElement('span');
    effPriceSpan.className = 'effective-price';
    effPriceSpan.textContent = effective.toFixed(2);
    effLine.appendChild(effPriceSpan);

    var effCurrencySpan = document.createElement('span');
    effCurrencySpan.className = 'effective-currency';
    effCurrencySpan.textContent = item.currency;
    effLine.appendChild(effCurrencySpan);

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
      mismatchBanner.hidden = true;
      return;
    }
    emptyState.hidden = true;

    // Group items by currency, computing effective price once per item.
    var groups = {};
    items.forEach(function (item) {
      var eff = computeEffectivePrice(item);
      if (!groups[item.currency]) groups[item.currency] = [];
      groups[item.currency].push({ item: item, eff: eff });
    });

    var currencyKeys = Object.keys(groups).sort();

    if (currencyKeys.length > 1) {
      mismatchBanner.hidden = false;
      mismatchBanner.textContent = 'Showing ' + currencyKeys.length +
        " currency groups. Prices aren't converted — only compare items within the same currency.";
    } else {
      mismatchBanner.hidden = true;
    }

    currencyKeys.forEach(function (currency) {
      var groupItems = groups[currency].slice().sort(function (a, b) {
        return a.eff - b.eff;
      });

      var minEff = groupItems.reduce(function (min, g) {
        return g.eff < min ? g.eff : min;
      }, groupItems[0].eff);

      var groupEl = document.createElement('div');
      groupEl.className = 'currency-group';

      var title = document.createElement('h2');
      title.className = 'currency-group-title';
      title.textContent = currency;
      groupEl.appendChild(title);

      if (groupItems.length === 1) {
        var note = document.createElement('p');
        note.className = 'single-item-note';
        note.textContent = 'Only item in ' + currency + ' — add another to compare.';
        groupEl.appendChild(note);
      }

      var list = document.createElement('ul');
      list.className = 'item-list';

      groupItems.forEach(function (entry) {
        // Small epsilon tolerance so floating-point rounding doesn't break ties.
        var isBest = groupItems.length > 1 && Math.abs(entry.eff - minEff) < 0.005;
        list.appendChild(buildItemCard(entry.item, entry.eff, isBest));
      });

      groupEl.appendChild(list);
      resultsGroups.appendChild(groupEl);
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
  currencySelect.value = lastCurrency;
  updatePromoUI();
  renderResults();
})();
