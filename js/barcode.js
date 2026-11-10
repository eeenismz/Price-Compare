// Price Compare — barcode helpers (Phase 6)
// A barcode identifies a product, never a price. This file holds the parts with no DOM:
// checking a typed or scanned number, remembering what the user saved for a barcode
// (in this browser only), and asking the free Open Food Facts database about a new one.

(function () {
  'use strict';

  var MEMORY_KEY = 'priceCompareBarcodes';
  var MEMORY_MAX = 500;          // oldest entries are dropped past this, so storage can't grow without limit
  var LOOKUP_TIMEOUT_MS = 8000;  // a slow shop connection must not leave the form waiting
  var NAME_MAX = 80;
  var LOOKUP_URL = 'https://world.openfoodfacts.org/api/v2/product/';
  var LOOKUP_FIELDS = 'product_name,quantity,product_quantity,product_quantity_unit';

  // Units a database entry may use, mapped to the app's unit codes and a multiplier
  var UNIT_MAP = {
    ml: { unit: 'ml', times: 1 },
    cl: { unit: 'ml', times: 10 },
    l:  { unit: 'l',  times: 1 },
    g:  { unit: 'g',  times: 1 },
    kg: { unit: 'kg', times: 1 }
  };
  var APP_UNITS = ['ml', 'l', 'g', 'kg', 'piece', 'sheet'];

  // Keeps the digits of a typed or scanned code (spaces and dashes are dropped).
  // Returns null when anything else is in there, or the length is not a retail barcode length.
  function clean(text) {
    var t = String(text === null || text === undefined ? '' : text).replace(/[\s-]/g, '');
    if (!/^\d+$/.test(t)) return null;
    if ([8, 12, 13, 14].indexOf(t.length) === -1) return null;
    return t;
  }

  // GTIN check digit (EAN-8, UPC-A, EAN-13, GTIN-14): from the right, digits are weighted 3,1,3,1...
  // (the check digit itself is not weighted), and the total must end in 0.
  function isValid(code) {
    var c = clean(code);
    if (!c) return false;
    if (/^0+$/.test(c)) return false; // all zeros passes the maths but is not a product
    var sum = 0;
    for (var i = 0; i < c.length; i++) {
      var digit = c.charCodeAt(c.length - 1 - i) - 48;
      sum += (i % 2 === 1) ? digit * 3 : digit;
    }
    return sum % 10 === 0;
  }

  // One key per product: a 12-digit UPC and the same code written as a 13-digit EAN
  // (with a leading 0) are the same product, so every code is padded to 14 digits.
  function key(code) {
    var c = clean(code);
    if (!c) return null;
    while (c.length < 14) c = '0' + c;
    return c;
  }

  function toNumber(v) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string' || v.trim() === '') return NaN;
    return Number(v.trim().replace(',', '.'));
  }

  // Size and unit from a database product, or null when it is not clear-cut.
  // A wrong size would silently change which offer wins, so anything unusual gives null.
  function parseQuantity(product) {
    if (!product || typeof product !== 'object') return null;

    // 1) The database's own parsed number + unit
    var unitText = String(product.product_quantity_unit || '').trim().toLowerCase();
    var amount = toNumber(product.product_quantity);
    if (UNIT_MAP.hasOwnProperty(unitText) && isFinite(amount) && amount > 0) {
      return { unitSize: amount * UNIT_MAP[unitText].times, unitOfMeasure: UNIT_MAP[unitText].unit };
    }

    // 2) The free-text quantity, only when it is one plain "400 g" style value
    //    (a trailing "e" is the EU estimated-weight mark). "6 x 330 ml" is left alone.
    var m = /^(\d+(?:[.,]\d+)?)\s*(ml|cl|l|g|kg)\s*e?$/i.exec(String(product.quantity || '').trim());
    if (m) {
      var n = toNumber(m[1]);
      var u = UNIT_MAP[m[2].toLowerCase()];
      if (isFinite(n) && n > 0) return { unitSize: n * u.times, unitOfMeasure: u.unit };
    }
    return null;
  }

  // Turns a lookup response into { name, unitSize, unitOfMeasure } (each null when unknown),
  // or null when the product is not in the database or nothing usable came back.
  function fromLookup(json) {
    if (!json || typeof json !== 'object' || json.status !== 1 || !json.product) return null;
    var name = typeof json.product.product_name === 'string'
      ? json.product.product_name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX)
      : '';
    var qty = parseQuantity(json.product);
    if (!name && !qty) return null;
    return {
      name: name || null,
      unitSize: qty ? qty.unitSize : null,
      unitOfMeasure: qty ? qty.unitOfMeasure : null
    };
  }

  // ---------- Memory: what the user saved for each barcode, in this browser ----------
  function isValidEntry(e) {
    return !!e && typeof e === 'object' &&
      typeof e.name === 'string' && e.name.trim() !== '' &&
      typeof e.unitSize === 'number' && isFinite(e.unitSize) && e.unitSize > 0 &&
      APP_UNITS.indexOf(e.unitOfMeasure) !== -1;
  }

  // Returns a plain map of key -> entry. Broken or missing storage gives an empty map.
  function loadMemory() {
    var map = Object.create(null);
    try {
      var stored = JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}');
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        Object.keys(stored).forEach(function (k) {
          if (/^\d{14}$/.test(k) && isValidEntry(stored[k])) map[k] = stored[k];
        });
      }
    } catch (e) {
      console.warn('Could not read saved barcodes:', e);
    }
    return map;
  }

  function recall(code) {
    var k = key(code);
    if (!k || !isValid(code)) return null;
    var entry = loadMemory()[k];
    return entry ? { name: entry.name, unitSize: entry.unitSize, unitOfMeasure: entry.unitOfMeasure } : null;
  }

  // Saves (or replaces) what a barcode means. Returns true when it was stored.
  function remember(code, entry) {
    var k = key(code);
    if (!k || !isValid(code) || !isValidEntry(entry)) return false;
    try {
      var map = loadMemory();
      delete map[k]; // re-adding moves it to the end, so the most recently used are kept longest
      map[k] = { name: entry.name.trim(), unitSize: entry.unitSize, unitOfMeasure: entry.unitOfMeasure };
      var keys = Object.keys(map);
      while (keys.length > MEMORY_MAX) delete map[keys.shift()];
      localStorage.setItem(MEMORY_KEY, JSON.stringify(map));
      return true;
    } catch (e) {
      console.warn('Could not save barcode:', e);
      return false;
    }
  }

  // ---------- Lookup: Open Food Facts (free, no account, only the barcode number is sent) ----------
  // Resolves with { name, unitSize, unitOfMeasure } or null. Never rejects: offline, slow,
  // unknown product and a broken response all just mean "nothing found".
  function lookup(code) {
    var c = clean(code);
    if (!c || !isValid(c) || typeof fetch !== 'function') return Promise.resolve(null);

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, LOOKUP_TIMEOUT_MS);
    var options = { credentials: 'omit', referrerPolicy: 'no-referrer' };
    if (controller) options.signal = controller.signal;

    return fetch(LOOKUP_URL + c + '.json?fields=' + LOOKUP_FIELDS, options)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (json) { clearTimeout(timer); return fromLookup(json); })
      .catch(function () { clearTimeout(timer); return null; });
  }

  window.Barcode = {
    clean: clean,
    isValid: isValid,
    key: key,
    parseQuantity: parseQuantity,
    fromLookup: fromLookup,
    recall: recall,
    remember: remember,
    lookup: lookup,
    MEMORY_KEY: MEMORY_KEY
  };
})();
