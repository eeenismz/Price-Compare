<?php
// Plain procedural helpers for pulling a product name/price out of a Lazada
// (or, hypothetically, Shopee) product page's HTML. No external libraries.

// ---------- JSON-LD ----------

// Find every <script type="application/ld+json">...</script> block, decode
// it, and flatten to a list of candidate objects (handling @graph and bare
// arrays of objects) so callers can just look for @type == "Product".
function parser_jsonld_objects($html) {
    $objects = [];

    if (!preg_match_all('/<script[^>]+type=["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/is', $html, $matches)) {
        return $objects;
    }

    foreach ($matches[1] as $raw) {
        $decoded = json_decode(trim($raw), true);
        if ($decoded === null) {
            continue;
        }
        parser_jsonld_flatten($decoded, $objects);
    }

    return $objects;
}

// Recursively flatten a decoded JSON-LD value into $objects (by reference),
// unwrapping @graph containers and plain lists.
function parser_jsonld_flatten($decoded, &$objects) {
    if (!is_array($decoded)) {
        return;
    }

    // A single JSON-LD node (associative array with string keys).
    if (parser_is_assoc($decoded)) {
        if (isset($decoded['@graph']) && is_array($decoded['@graph'])) {
            parser_jsonld_flatten($decoded['@graph'], $objects);
        }
        $objects[] = $decoded;
        return;
    }

    // A list of nodes.
    foreach ($decoded as $item) {
        parser_jsonld_flatten($item, $objects);
    }
}

function parser_is_assoc($arr) {
    if ($arr === []) {
        return false;
    }
    return array_keys($arr) !== range(0, count($arr) - 1);
}

function parser_jsonld_products($html) {
    $products = [];
    foreach (parser_jsonld_objects($html) as $obj) {
        $type = $obj['@type'] ?? null;
        if (is_array($type)) {
            if (in_array('Product', $type, true)) {
                $products[] = $obj;
            }
        } elseif ($type === 'Product') {
            $products[] = $obj;
        }
    }
    return $products;
}

// ---------- Name extraction ----------

function parser_clean_name($name) {
    if (!is_string($name) || $name === '') {
        return null;
    }
    $name = html_entity_decode($name, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $name = preg_replace('/\s+/u', ' ', $name);
    $name = trim($name);
    $len = mb_strlen($name, 'UTF-8');
    if ($len < 1 || $len > 300) {
        return null;
    }
    return $name;
}

// Strip a trailing "| Lazada ..." / "| Shopee ..." style suffix often
// appended to <title>/og:title values.
function parser_strip_site_suffix($text) {
    if (!is_string($text)) {
        return $text;
    }
    return preg_replace('/\s*\|\s*(Lazada|Shopee)\b.*$/i', '', $text);
}

function parser_extract_name($html) {
    // 1. JSON-LD Product.name
    foreach (parser_jsonld_products($html) as $product) {
        if (!empty($product['name'])) {
            $clean = parser_clean_name($product['name']);
            if ($clean !== null) {
                return $clean;
            }
        }
    }

    // 2. "pdt_name":"..." tracking-blob field
    if (preg_match('/"pdt_name"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/', $html, $m)) {
        $raw = stripcslashes($m[1]);
        $clean = parser_clean_name($raw);
        if ($clean !== null) {
            return $clean;
        }
    }

    // 3. og:title meta tag
    if (preg_match('/<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']*)["\']/i', $html, $m)) {
        $clean = parser_clean_name(parser_strip_site_suffix($m[1]));
        if ($clean !== null) {
            return $clean;
        }
    }

    // 4. <title> tag
    if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $m)) {
        $clean = parser_clean_name(parser_strip_site_suffix($m[1]));
        if ($clean !== null) {
            return $clean;
        }
    }

    return null;
}

// ---------- Price extraction ----------

// Currency symbols/prefixes recognised per currency, used only once the
// currency is already known from the domain allowlist.
function parser_currency_symbols($currency) {
    $map = [
        'THB' => ['฿'],
        'MYR' => ['RM'],
        'SGD' => ['S$', '$'],
        'PHP' => ['₱'],
        'VND' => ['₫', 'đ'],
        'IDR' => ['Rp'],
    ];
    return $map[$currency] ?? [];
}

// Normalize a raw matched number string for the given currency and return a
// float, or null if it doesn't parse to a finite value in (0, 1e9).
function parser_normalize_price($raw, $currency) {
    if ($raw === null) {
        return null;
    }

    // Strip whitespace (incl. NBSP) and any currency symbols/letters.
    $num = str_replace(["\xC2\xA0", ' '], '', $raw);
    $num = preg_replace('/[^\d.,]/', '', $num);
    if ($num === '') {
        return null;
    }

    if ($currency === 'VND' || $currency === 'IDR') {
        // Thousands separator only, no decimals: strip all separators.
        $num = str_replace(['.', ','], '', $num);
        if (!is_numeric($num)) {
            return null;
        }
        $value = (float) $num;
    } else {
        // Comma thousands + dot decimals: strip commas only.
        $num = str_replace(',', '', $num);
        if (!is_numeric($num)) {
            return null;
        }
        $value = (float) $num;
    }

    if (!is_finite($value) || $value <= 0 || $value >= 1e9) {
        return null;
    }

    return $value;
}

function parser_extract_price($html, $currency) {
    // 1. JSON-LD offers.price / offers.lowPrice / offers[0].price
    foreach (parser_jsonld_products($html) as $product) {
        $offers = $product['offers'] ?? null;
        if ($offers === null) {
            continue;
        }
        if (parser_is_assoc($offers)) {
            $offers = [$offers];
        }
        foreach ((array) $offers as $offer) {
            if (!is_array($offer)) {
                continue;
            }
            foreach (['price', 'lowPrice'] as $key) {
                if (isset($offer[$key]) && $offer[$key] !== '') {
                    $value = parser_normalize_price((string) $offer[$key], $currency);
                    if ($value !== null) {
                        return $value;
                    }
                }
            }
        }
    }

    // 2. product:price:amount / og:price:amount meta tags
    if (preg_match('/<meta[^>]+property=["\'](?:product|og):price:amount["\'][^>]+content=["\']([^"\']*)["\']/i', $html, $m)) {
        $value = parser_normalize_price($m[1], $currency);
        if ($value !== null) {
            return $value;
        }
    }

    // 3. "pdt_price":"..." tracking-blob field
    if (preg_match('/"pdt_price"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/', $html, $m)) {
        $raw = stripcslashes($m[1]);
        $value = parser_normalize_price($raw, $currency);
        if ($value !== null) {
            return $value;
        }
    }

    // 4. Currency-symbol-anchored regex over the raw HTML.
    foreach (parser_currency_symbols($currency) as $symbol) {
        $quoted = preg_quote($symbol, '/');
        // Symbol-before-number (e.g. ฿1,550.00, RM68.00, S$12.50, ₱199.00, Rp199.000)
        if (preg_match('/' . $quoted . '\s?([\d][\d.,]*)/u', $html, $m)) {
            $value = parser_normalize_price($m[1], $currency);
            if ($value !== null) {
                return $value;
            }
        }
        // Symbol-after-number (e.g. 199.000₫, 199.000đ)
        if (preg_match('/([\d][\d.,]*)\s?' . $quoted . '/u', $html, $m)) {
            $value = parser_normalize_price($m[1], $currency);
            if ($value !== null) {
                return $value;
            }
        }
    }

    return null;
}

// ---------- Page classification ----------

function parser_is_blocked($html) {
    if (strpos($html, 'x5secdata') !== false || strpos($html, '_____tmd_____') !== false) {
        return true;
    }
    // This branch is currently unreachable in practice: api/fetch-product.php
    // short-circuits Shopee hosts before any fetch happens when
    // SHOPEE_ATTEMPT_FETCH is false (the default). It only becomes reachable
    // if that constant is ever flipped to true.
    if (preg_match('/<meta[^>]+name=["\']shopee:git-sha["\']/i', $html)
        && stripos($html, 'application/ld+json') === false) {
        return true;
    }
    return false;
}

function parser_page_title($html) {
    if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $m)) {
        $title = html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return trim(preg_replace('/\s+/u', ' ', $title));
    }
    return null;
}

function parser_is_not_found($html, $httpStatus) {
    if ($httpStatus === 404) {
        return true;
    }
    $title = parser_page_title($html);
    if ($title === null) {
        return false;
    }
    if (stripos($title, 'no longer available') !== false) {
        return true;
    }
    if (strcasecmp($title, 'Page Not Found') === 0) {
        return true;
    }
    return false;
}
