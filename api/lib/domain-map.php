<?php
// Domain allowlist — the ONLY source of currency info (never parsed from page content).
// Suffix-matched against the lowercased, trailing-dot-stripped host.
function domain_map() {
    return [
        'shopee.co.th'   => ['currency' => 'THB',  'source' => 'shopee'],
        'shopee.com.my'  => ['currency' => 'MYR',  'source' => 'shopee'],
        'shopee.sg'      => ['currency' => 'SGD',  'source' => 'shopee'],
        'shopee.ph'      => ['currency' => 'PHP',  'source' => 'shopee'],
        'shopee.vn'      => ['currency' => 'VND',  'source' => 'shopee'],
        'shopee.co.id'   => ['currency' => 'IDR',  'source' => 'shopee'],
        'shope.ee'       => ['currency' => null,   'source' => 'shopee'],
        'lazada.co.th'   => ['currency' => 'THB',  'source' => 'lazada'],
        'lazada.com.my'  => ['currency' => 'MYR',  'source' => 'lazada'],
        'lazada.sg'      => ['currency' => 'SGD',  'source' => 'lazada'],
        'lazada.com.ph'  => ['currency' => 'PHP',  'source' => 'lazada'],
        'lazada.vn'      => ['currency' => 'VND',  'source' => 'lazada'],
        'lazada.co.id'   => ['currency' => 'IDR',  'source' => 'lazada'],
    ];
}

// Resolve a hostname against the allowlist via suffix match. Returns the
// matched entry (currency/source) or null if the host isn't allowlisted.
function domain_map_resolve($host) {
    $host = strtolower(rtrim($host, '.'));
    foreach (domain_map() as $entry => $info) {
        if ($host === $entry || str_ends_with($host, '.' . $entry)) {
            return $info;
        }
    }
    return null;
}
