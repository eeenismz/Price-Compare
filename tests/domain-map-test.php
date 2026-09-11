<?php
// Regression tests for api/lib/domain-map.php — the SSRF allowlist.
// Specifically guards the suffix-vs-substring distinction: a lookalike host
// that merely *contains* an allowlisted domain (as a prefix or suffix string)
// must NOT match unless it's the domain itself or a genuine subdomain.
// Run with: php tests/domain-map-test.php
// Plain PHP, no PHPUnit/composer — exits 0 on all-pass, 1 on any failure.

require __DIR__ . '/../api/lib/domain-map.php';

$failures = 0;
$total = 0;

function check_accept($label, $host, $expectedSource, $expectedCurrency) {
    global $failures, $total;
    $total++;
    $result = domain_map_resolve($host);
    $pass = $result !== null
        && $result['source'] === $expectedSource
        && $result['currency'] === $expectedCurrency;
    if (!$pass) {
        $failures++;
        echo "FAIL — $label (host=\"$host\")\n";
        echo "    expected: source=$expectedSource currency=" . var_export($expectedCurrency, true) . "\n";
        echo "    actual:   " . var_export($result, true) . "\n";
    } else {
        echo "PASS — $label (host=\"$host\")\n";
    }
}

function check_reject($label, $host) {
    global $failures, $total;
    $total++;
    $result = domain_map_resolve($host);
    $pass = $result === null;
    if (!$pass) {
        $failures++;
        echo "FAIL — $label (host=\"$host\") — expected null (rejected), got: " . var_export($result, true) . "\n";
    } else {
        echo "PASS — $label (host=\"$host\")\n";
    }
}

// ---------- Legitimate exact + subdomain matches (must ACCEPT) ----------
check_accept('exact apex domain', 'shopee.co.th', 'shopee', 'THB');
check_accept('www subdomain', 'www.shopee.co.th', 'shopee', 'THB');
check_accept('redirect-shortlink subdomain', 's.lazada.co.th', 'lazada', 'THB');
check_accept('shope.ee shortlink apex', 'shope.ee', 'shopee', null);
check_accept('shope.ee shortlink subdomain', 'go.shope.ee', 'shopee', null);
check_accept('lazada Malaysia apex', 'lazada.com.my', 'lazada', 'MYR');
check_accept('lazada Singapore subdomain', 's.lazada.sg', 'lazada', 'SGD');
check_accept('case-insensitive host', 'WWW.SHOPEE.CO.TH', 'shopee', 'THB');
check_accept('trailing dot on FQDN stripped', 'shopee.co.th.', 'shopee', 'THB');

// ---------- Lookalike hosts that must be REJECTED (suffix, not substring) ----------
// Prefix-lookalike: "evil-shopee.co.th" contains "shopee.co.th" as a substring
// but is not the domain itself nor a genuine ".shopee.co.th" subdomain.
check_reject('prefix-lookalike (substring, not real subdomain)', 'evil-shopee.co.th');
// Suffix-lookalike: "shopee.co.th.evil.com" has the allowlisted domain as a
// leading substring, but the *actual* registrable domain is evil.com.
check_reject('suffix-lookalike (allowlisted domain as prefix of attacker domain)', 'shopee.co.th.evil.com');
check_reject('suffix-lookalike variant', 'shopee.co.th.attacker.example');
check_reject('lazada suffix-lookalike', 'lazada.co.th.attacker.example');
check_reject('lazada prefix-lookalike', 'notlazada.co.th');
check_reject('unrelated domain entirely', 'example.com');
check_reject('empty host', '');
check_reject('host that only shares a TLD', 'co.th');

// ---------- Summary ----------
echo "\n$total checks run, " . ($total - $failures) . " passed, $failures failed.\n";
exit($failures > 0 ? 1 : 0);
