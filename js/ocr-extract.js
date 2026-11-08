// OCR Extract — turns Tesseract.js lines into offer fields (name, price, size, pack count).
// Pure logic: no DOM, no network, no AI. Rule: when not confident, a field is null.
(function () {
  'use strict';

  // ---------- Currency markers ----------
  // Markers are listed longest first so "US$" wins over "$" and "S$" over "$".
  // groupSep = the thousands separator for that currency (comma = decimal point is "."; IDR/VND use dots).
  var CURRENCIES = {
    THB: { markers: ['฿', 'บาท', 'THB'], groupSep: ',', dotSuffix: true },
    MYR: { markers: ['RM'], groupSep: ',', dotSuffix: false },
    SGD: { markers: ['S$', '$'], groupSep: ',', dotSuffix: false },
    USD: { markers: ['US$', '$'], groupSep: ',', dotSuffix: false },
    PHP: { markers: ['₱', 'PHP'], groupSep: ',', dotSuffix: false },
    VND: { markers: ['₫', 'đ', 'VND'], groupSep: '[.,]', dotSuffix: false },
    IDR: { markers: ['Rp'], groupSep: '\\.', dotSuffix: false }
  };

  // ---------- Patterns (kept as strings so each call gets a fresh RegExp) ----------
  // size: number + unit, number must not be part of a word/URL ("shopee.co/500ml")
  var SIZE_SRC = '(^|[^A-Za-z0-9.\\/])(\\d+(?:[.,]\\d+)?)\\s?(ml|l|ltr|litre|liter|ลิตร|มล|kg|กิโลกรัม|กก|g|gm|gr|gram|grams|กรัม|pcs|pc|pieces|piece|ชิ้น|ซอง|ก้อน|sheets|sheet|แผ่น)(?![A-Za-z])';
  // "x6" / "× 6" (not after a letter, so "Lux 2" is not a pack). Not followed by a digit or "6.5".
  var PACK_A = '(^|[^A-Za-z])[x×]\\s?(\\d{1,3})(?!\\d|[.,]\\d)';
  // "6 x 330ml" -> 6 (the 330ml is the size, handled by SIZE_SRC)
  var PACK_B = '(^|[^\\dA-Za-z.,])(\\d{1,3})\\s?[x×]\\s?\\d+(?:[.,]\\d+)?\\s?(?:ml|มล|l|ลิตร|g|กรัม|kg|กก)(?![A-Za-z])';
  // "pack 6", "แพ็ค 6"
  var PACK_C1 = '(?:pack|แพ็ค|แพค)\\s?(\\d{1,3})(?!\\d)';
  // "6 pack", "6 ขวด", "(6 ชิ้น)"
  var PACK_C2 = '(^|[^\\d.,])(\\d{1,3})[\\s-]?(?:pack|แพ็ค|แพค|ขวด|ชิ้น|cans?|bottles?)(?![A-Za-z])';

  // Lines about shipping, sold counts, ratings or vouchers never carry the item price.
  var PRICE_EXCLUDE_RE = /\b(?:shipping|delivery|sold|ratings?|vouchers?|coupons?)\b|ค่าส่ง|ส่งฟรี|ขายแล้ว|รีวิว|โค้ด|คูปอง|ส่วนลด/i;
  // UI chrome and store names: never the product name.
  var NOT_NAME_RE = /\b(?:add to cart|buy now|free shipping|shipping|delivery|shopee|lazada|mall|sold|ratings?|reviews?|vouchers?|coupons?|follow|chat)\b|ซื้อเลย|ตะกร้า|ส่งฟรี|ค่าส่ง|ร้านค้า|ขายแล้ว|รีวิว|โค้ด|คูปอง|ส่วนลด|ติดตาม|แชท|%/i;
  // "-27%" or the Thai "ลด 27%" sale marker
  var SALE_RE = /[-−–]\s?\d{1,2}\s?%|ลด\s?\d{1,2}\s?%/;
  // Promo lines ("ซื้อ 2 ชิ้น ลดเพิ่ม 10%", "Buy 1 Get 1 Free") hold counts and percents that are not the item's size or pack
  var PROMO_RE = /%|ซื้อ|ลดเพิ่ม|แถม|\b(?:buy|get|free|off)\b/i;
  // A line that is only a unit word ("ml", "มล.", "g"). Tesseract sometimes puts the unit on its own line.
  var UNIT_ONLY_RE = /^(?:ml|l|ltr|litre|liter|ลิตร|มล|kg|กก|กิโลกรัม|g|gm|gr|gram|grams|กรัม)\.?$/i;
  // A line that ends with a bare number ("Pantene Shampoo ... Control 410")
  var ENDS_NUMBER_RE = /(^|[^A-Za-z0-9.,])\d+(?:[.,]\d+)?\s?$/;
  // Any letter-like char (Latin incl. Vietnamese diacritics, Thai incl. tone marks) or space.
  // × (D7) and ÷ (F7) are skipped on purpose; ฿ (E3F) and Thai digits (E50-E59) are not letters.
  var LETTERISH_RE = /[A-Za-zÀ-ÖØ-öø-ɏḀ-ỿก-ฺเ-๎]/g;
  // Base letters only (no tone/vowel marks): OCR junk like "ฺ ๆ" will not pass as a name.
  var BASE_LETTER_RE = /[A-Za-zÀ-ÖØ-öø-ɏḀ-ỿก-ฮะาำเ-ไ]/g;

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function count(text, re) {
    return (text.match(re) || []).length;
  }

  // All captured group numbers of one pattern in one line.
  function groups(text, src, g) {
    var re = new RegExp(src, 'gi'), out = [], m;
    while ((m = re.exec(text)) !== null) out.push(parseInt(m[g], 10));
    return out;
  }

  // ---------- Price ----------
  // Three regexes per currency: marker before the amount, marker after it, and THB ".-" suffix.
  function priceRegexes(cur) {
    var alt = cur.markers.map(escapeRe).join('|');
    var list = [
      // "฿59", "RM 12.90", "Rp 25.900". The lookahead stops "฿ 1 89" (OCR split) from reading as 1.
      new RegExp('(^|[^A-Za-z])(?:' + alt + ')\\s?([0-9OoIl][0-9OoIl.,]*)(?!\\s?\\d)', 'g'),
      // "125.000đ", "59 บาท"
      new RegExp('(^|[^A-Za-z0-9])([0-9OoIl][0-9OoIl.,]*)\\s?(?:' + alt + ')', 'g')
    ];
    if (cur.dotSuffix) {
      // Thai shelf tags: "59.-" (lazy token so the ".-" is not eaten). "B59.-" fails: the B blocks the boundary.
      list.push(new RegExp('(^|[^A-Za-z0-9])([0-9OoIl][0-9OoIl.,]*?)\\.-', 'g'));
    }
    return list;
  }

  // Turns one matched amount token into a number, or null when the separators look wrong.
  function parseAmount(raw, cur) {
    if (!/\d/.test(raw)) return null;                       // needs at least one real digit
    var s = raw.replace(/[Oo]/g, '0').replace(/[lI]/g, '1'); // OCR: O for zero, l/I for one
    s = s.replace(/[.,]+$/, '');                            // "59." left over from "59.-"
    var v;
    if (cur.groupSep === ',') {
      // comma thousands, dot decimal: "1,299.00", "1,299", "59.5"
      if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) v = parseFloat(s.replace(/,/g, ''));
      else if (/^\d+(\.\d{1,2})?$/.test(s)) v = parseFloat(s);
      else return null;
    } else {
      // dot/comma are thousands separators: "125.000", "25.900"
      if (new RegExp('^\\d{1,3}(' + cur.groupSep + '\\d{3})+$').test(s)) v = parseFloat(s.replace(/\D/g, ''));
      else if (/^\d+$/.test(s)) v = parseFloat(s);
      else return null;
    }
    return v > 0 ? v : null;
  }

  // Finds every amount with a currency marker in one line.
  function scanPrices(text, cur) {
    var values = [], range = false, m;
    priceRegexes(cur).forEach(function (re) {
      while ((m = re.exec(text)) !== null) {
        var after = text.slice(m.index + m[0].length);
        // "฿99 - ฿149" or "฿99-149" is a range, not a price. "-27%" right after a price is a sale tag.
        if (/^\s*(?:[-–~]|ถึง)\s*\S{0,3}\d/.test(after) && !/^\s*-\s?\d+\s?%/.test(after)) range = true;
        var v = parseAmount(m[2], cur);
        if (v !== null) values.push(v);
      }
    });
    return { values: values, range: range };
  }

  // A sale marker within 2 lines of a price line.
  function nearSale(lines, idx) {
    for (var j = Math.max(0, idx - 2); j <= Math.min(lines.length - 1, idx + 2); j++) {
      if (SALE_RE.test(lines[j].text)) return true;
    }
    return false;
  }

  function findPrice(lines, cur, mode) {
    var cands = [], range = false;
    lines.forEach(function (line, i) {
      if (PRICE_EXCLUDE_RE.test(line.text)) return;       // shipping, sold, vouchers...
      var sc = scanPrices(line.text, cur);
      if (sc.range) range = true;
      sc.values.forEach(function (v) { cands.push({ value: v, idx: i }); });
    });
    if (range || !cands.length) return null;              // a range is never a single price

    var distinct = [];
    cands.forEach(function (c) { if (distinct.indexOf(c.value) < 0) distinct.push(c.value); });
    if (distinct.length === 1) return distinct[0];        // only one price on the label: take it

    if (mode === 'photo') {
      // Group prices by line. The tallest price line must be clearly bigger (1.3x) than the next one.
      var byLine = {};
      cands.forEach(function (c) {
        var g = byLine[c.idx] || (byLine[c.idx] = { h: lines[c.idx].h, vals: [] });
        if (g.vals.indexOf(c.value) < 0) g.vals.push(c.value);
      });
      var lineGroups = Object.keys(byLine).map(function (k) { return byLine[k]; })
        .sort(function (a, b) { return b.h - a.h; });
      var top = lineGroups[0], next = lineGroups[1];
      if (top.vals.length > 1 || top.h <= 0) return null; // two prices on one line, or no height info
      if (next && top.h < 1.3 * next.h) return null;      // not clearly the big price
      return top.vals[0];
    }

    // Screenshot: exactly two prices plus a nearby sale marker -> the lower one is the sale price.
    if (distinct.length !== 2) return null;
    var sale = cands.some(function (c) { return nearSale(lines, c.idx); });
    return sale ? Math.min(distinct[0], distinct[1]) : null;
  }

  // ---------- Name ----------
  // Removes size, pack and price text so "330ml x 6" or "40 sheets" are not counted as a name.
  function stripNoise(t, cur) {
    var s = t.replace(new RegExp(SIZE_SRC, 'gi'), ' ');
    [PACK_A, PACK_B, PACK_C1, PACK_C2].forEach(function (src) {
      s = s.replace(new RegExp(src, 'gi'), ' ');
    });
    if (cur) priceRegexes(cur).forEach(function (re) { s = s.replace(re, ' '); });
    return s;
  }

  function isNameLine(t, cur) {
    if (t.length > 80 || NOT_NAME_RE.test(t)) return false;      // too long, or UI/store chrome
    var letters = count(t, LETTERISH_RE) + count(t, /\s/g);
    if (letters / t.length < 0.6) return false;                  // OCR junk: mostly symbols/digits
    return count(stripNoise(t, cur), BASE_LETTER_RE) >= 3;       // at least 3 real letters left
  }

  function findName(lines, mode, cur) {
    var ok = lines.filter(function (line) { return isNameLine(line.text, cur); });
    if (!ok.length) return null;
    if (mode === 'photo') {
      // Tallest name-like line, but only when it is clearly bigger (1.2x) than the next one.
      var sorted = ok.slice().sort(function (a, b) { return b.h - a.h; });
      if (sorted[0].h <= 0) return null;                          // no height info, cannot tell
      if (sorted[1] && sorted[0].h < 1.2 * sorted[1].h) return null;
      return sorted[0].text;
    }
    // Screenshot: first name-like line that is long enough to be a product title.
    for (var i = 0; i < ok.length; i++) {
      if (ok[i].text.length >= 12) return ok[i].text;
    }
    return null;
  }

  // ---------- Size and pack ----------
  // Decimal comma ("1,5 l" = 1.5) vs thousands comma ("1,500 ml" = 1500). Ambiguous dots return null.
  function parseSize(num) {
    if (num.indexOf('.') >= 0 && num.indexOf(',') >= 0) return null; // "1,500.5" is unclear
    if (/\.\d{3}$/.test(num)) return null;                           // "1.500" could be 1.5 or 1500
    var s = /,\d{3}$/.test(num) ? num.replace(/,/g, '') : num.replace(',', '.');
    var v = parseFloat(s);
    return v > 0 ? v : null;
  }

  // Maps every spelling to one canonical unit.
  function canonUnit(raw) {
    var u = raw.toLowerCase();
    if (u === 'ml' || u === 'มล') return 'ml';
    if (u === 'l' || u === 'ltr' || u === 'litre' || u === 'liter' || u === 'ลิตร') return 'l';
    if (u === 'kg' || u === 'กก' || u === 'กิโลกรัม') return 'kg';
    if (u === 'g' || u === 'gm' || u === 'gr' || u === 'gram' || u === 'grams' || u === 'กรัม') return 'g';
    if (u === 'sheet' || u === 'sheets' || u === 'แผ่น') return 'sheet';
    return 'piece'; // pc, pcs, piece(s), ชิ้น, ซอง, ก้อน
  }

  // Text used for size scanning. A unit-only line is read together with the number that ends the line above it,
  // so Tesseract's "410" + "ml" split still gives 410 ml.
  function sizeText(lines, i) {
    var t = lines[i].text;
    if (i > 0 && UNIT_ONLY_RE.test(t) && ENDS_NUMBER_RE.test(lines[i - 1].text)) return lines[i - 1].text + ' ' + t;
    return t;
  }

  function findSize(lines) {
    var found = [], bad = false;
    lines.forEach(function (line, i) {
      var text = sizeText(lines, i);
      if (PROMO_RE.test(text)) return; // promo lines never carry the item's size
      var re = new RegExp(SIZE_SRC, 'gi'), m;
      while ((m = re.exec(text)) !== null) {
        var v = parseSize(m[2]);
        if (v === null) bad = true;
        else found.push({ value: v, unit: canonUnit(m[3]) });
      }
    });
    if (bad || !found.length) return null;
    // Every size on the label must agree; two different sizes = we cannot tell which one is the item.
    for (var i = 1; i < found.length; i++) {
      if (found[i].value !== found[0].value || found[i].unit !== found[0].unit) return null;
    }
    return found[0];
  }

  // Pack count for ml/l/g/kg sizes. No count written = null (no pack signal; the form keeps its own default).
  function findPackCount(lines) {
    var ok = {}, bad = false;
    lines.forEach(function (line) {
      var t = line.text;
      if (PROMO_RE.test(t)) return; // "ซื้อ 2 ขวด ลดเพิ่ม 10%" is a promo, not a 2-bottle pack
      // Loose patterns ("x6", "6 x 330ml"): out-of-range numbers are just ignored ("x 330ml").
      groups(t, PACK_A, 2).concat(groups(t, PACK_B, 2)).forEach(function (n) {
        if (n >= 2 && n <= 100) ok[n] = true;
      });
      // Explicit keywords ("pack 6", "6 ขวด"): an out-of-range count means we cannot trust it.
      groups(t, PACK_C1, 1).concat(groups(t, PACK_C2, 2)).forEach(function (n) {
        if (n >= 2 && n <= 100) ok[n] = true;
        else bad = true;
      });
    });
    var keys = Object.keys(ok);
    if (bad || keys.length > 1) return null;   // conflicting counts
    return keys.length ? Number(keys[0]) : null;  // no count found = no pack signal
  }

  // ---------- Main ----------
  function extract(lines, opts) {
    var out = { name: null, price: null, unitSize: null, unitOfMeasure: null, packCount: null };
    opts = opts || {};
    var mode = opts.mode === 'screenshot' ? 'screenshot' : 'photo';
    var cur = Object.prototype.hasOwnProperty.call(CURRENCIES, opts.currency) ? CURRENCIES[opts.currency] : null;

    // Clean lines: collapse spaces, default missing height to 0.
    var L = (lines || []).map(function (l) {
      return { text: String((l && l.text) || '').replace(/\s+/g, ' ').trim(), h: Number(l && l.h) || 0 };
    });
    if (!L.length) return out;

    out.name = findName(L, mode, cur);
    out.price = cur ? findPrice(L, cur, mode) : null;

    var size = findSize(L);
    if (size) {
      if (size.unit === 'piece' || size.unit === 'sheet') {
        // For pieces/sheets the count IS the size. An "x N" next to it is too unclear, so drop the size.
        // No pack signal here, so packCount stays null.
        var hasX = L.some(function (l) { return !PROMO_RE.test(l.text) && new RegExp(PACK_A, 'i').test(l.text); });
        if (hasX) size = null;
      } else {
        out.packCount = findPackCount(L);
      }
    }
    if (size) {
      out.unitSize = size.value;
      out.unitOfMeasure = size.unit;
    }
    return out;
  }

  if (typeof window !== 'undefined') window.OcrExtract = { extract: extract };
  if (typeof module !== 'undefined' && module.exports) module.exports = { extract: extract };
})();
