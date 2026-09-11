<?php
// Regression tests for api/lib/parser.php — fixture-based, no network needed.
// Run with: php tests/parser-test.php  (or MAMP's bundled PHP, see README)
// Plain PHP, no PHPUnit/composer — exits 0 on all-pass, 1 on any failure.

require __DIR__ . '/../api/lib/parser.php';

$failures = 0;
$total = 0;

function check($label, $actual, $expected) {
    global $failures, $total;
    $total++;
    $pass = ($actual === $expected);
    if (!$pass) {
        $failures++;
        echo "FAIL — $label\n";
        echo "    expected: " . var_export($expected, true) . "\n";
        echo "    actual:   " . var_export($actual, true) . "\n";
    } else {
        echo "PASS — $label\n";
    }
}

// ---------- 1. JSON-LD Product.name extraction ----------
$html = <<<HTML
<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org/","@type":"Product","name":"Wireless Mouse M185","offers":{"@type":"Offer","price":"25.90"}}
</script>
</head><body></body></html>
HTML;
check('JSON-LD Product.name extraction', parser_extract_name($html), 'Wireless Mouse M185');
check('JSON-LD offers.price extraction', parser_extract_price($html, 'MYR'), 25.90);

// JSON-LD wrapped in @graph
$htmlGraph = <<<HTML
<script type="application/ld+json">
{"@context":"https://schema.org/","@graph":[{"@type":"BreadcrumbList"},{"@type":"Product","name":"Graph Product","offers":{"@type":"Offer","price":"9.99"}}]}
</script>
HTML;
check('JSON-LD @graph Product.name extraction', parser_extract_name($htmlGraph), 'Graph Product');

// ---------- 2. pdt_name / pdt_price regex extraction ----------
$html = 'var trackingData = {"pdt_name":"Cotton T-Shirt (Blue, L)","pdt_price":"RM68.00","other":"x"};';
check('pdt_name regex extraction', parser_extract_name($html), 'Cotton T-Shirt (Blue, L)');
check('pdt_price regex extraction (RM68.00 -> 68.0)', parser_extract_price($html, 'MYR'), 68.0);

// pdt_price with escaped quotes/backslashes shouldn't break the regex
$htmlEscaped = '{"pdt_name":"Item with \\"quotes\\" inside","pdt_price":"12.50"}';
check('pdt_name with escaped quotes', parser_extract_name($htmlEscaped), 'Item with "quotes" inside');

// ---------- 3. og:title with "| Lazada X" suffix stripping ----------
$html = '<meta property="og:title" content="Nice Blender 500W | Lazada Malaysia">';
check('og:title with "| Lazada" suffix stripped', parser_extract_name($html), 'Nice Blender 500W');

$html = '<meta property="og:title" content="Rice Cooker 1.8L | Shopee Thailand">';
check('og:title with "| Shopee" suffix stripped', parser_extract_name($html), 'Rice Cooker 1.8L');

// ---------- 4. <title> tag fallback ----------
$html = '<html><head><title>Bluetooth Speaker XL | Lazada.co.th</title></head><body></body></html>';
check('title-tag fallback with suffix stripped', parser_extract_name($html), 'Bluetooth Speaker XL');

$html = '<html><head><title>   Plain Title With No Suffix   </title></head></html>';
check('title-tag fallback with no suffix, whitespace trimmed', parser_extract_name($html), 'Plain Title With No Suffix');

// ---------- 5. VND thousands-separator normalization ----------
check(
    'VND thousands-separator ("199.000₫" -> 199000.0)',
    parser_normalize_price('199.000₫', 'VND'),
    199000.0
);
check(
    'VND symbol-before-number extraction from HTML ("đ199.000")',
    parser_extract_price('<span>đ199.000</span>', 'VND'),
    199000.0
);
check(
    'VND symbol-after-number extraction from HTML ("199.000₫")',
    parser_extract_price('<span>Price: 199.000₫ only</span>', 'VND'),
    199000.0
);

// IDR uses the same dot-thousands, no-decimal rule.
check(
    'IDR thousands-separator ("Rp1.250.000" -> 1250000.0)',
    parser_extract_price('<div>Rp1.250.000</div>', 'IDR'),
    1250000.0
);

// ---------- 6. THB comma+decimal normalization ----------
check(
    'THB comma-thousands + dot-decimal ("฿1,550.00" -> 1550.0)',
    parser_normalize_price('฿1,550.00', 'THB'),
    1550.0
);
check(
    'THB symbol extraction from HTML ("฿1,550.00")',
    parser_extract_price('<p>฿1,550.00</p>', 'THB'),
    1550.0
);

// SGD dual-symbol support (S$ and bare $)
check('SGD "S$" symbol extraction', parser_extract_price('<p>S$12.50</p>', 'SGD'), 12.5);
check('SGD bare "$" symbol extraction', parser_extract_price('<p>$12.50 only</p>', 'SGD'), 12.5);

// ---------- 7. Page with no extractable data -> null, no throw ----------
$html = '<html><head></head><body><p>Nothing useful here.</p></body></html>';
check('No extractable name yields null (no throw)', parser_extract_name($html), null);
check('No extractable price yields null (no throw)', parser_extract_price($html, 'THB'), null);

// Completely empty string input
check('Empty HTML string -> null name (no throw)', parser_extract_name(''), null);
check('Empty HTML string -> null price (no throw)', parser_extract_price('', 'MYR'), null);

// Malformed JSON-LD (invalid JSON) must not throw, just be skipped.
$htmlBadJson = '<script type="application/ld+json">{not valid json,,,</script><title>Fallback Title</title>';
check('Malformed JSON-LD is skipped, falls through to title', parser_extract_name($htmlBadJson), 'Fallback Title');

// ---------- 8. Blocked-page detection ----------
check('parser_is_blocked: x5secdata marker detected', parser_is_blocked('<html>x5secdata_junk</html>'), true);
check('parser_is_blocked: _____tmd_____ marker detected', parser_is_blocked('<html>_____tmd_____</html>'), true);
check(
    'parser_is_blocked: shopee:git-sha meta with no JSON-LD detected',
    parser_is_blocked('<meta name="shopee:git-sha" content="abc123">'),
    true
);
check(
    'parser_is_blocked: shopee:git-sha meta WITH JSON-LD present is NOT flagged',
    parser_is_blocked('<meta name="shopee:git-sha" content="abc123"><script type="application/ld+json">{}</script>'),
    false
);
check('parser_is_blocked: normal page is not blocked', parser_is_blocked('<html><body>Normal product page</body></html>'), false);

// ---------- 9. Not-found detection ----------
check('parser_is_not_found: HTTP 404 status alone', parser_is_not_found('<html></html>', 404), true);
check(
    'parser_is_not_found: title contains "no longer available"',
    parser_is_not_found('<title>This product is no longer available</title>', 200),
    true
);
check(
    'parser_is_not_found: title exactly "Page Not Found" (case-insensitive)',
    parser_is_not_found('<title>page not found</title>', 200),
    true
);
check(
    'parser_is_not_found: normal title + 200 status is NOT flagged',
    parser_is_not_found('<title>Great Product For Sale</title>', 200),
    false
);
check('parser_is_not_found: no title, no throw', parser_is_not_found('<html><body>no title tag</body></html>', 200), false);

// ---------- Summary ----------
echo "\n$total checks run, " . ($total - $failures) . " passed, $failures failed.\n";
exit($failures > 0 ? 1 : 0);
