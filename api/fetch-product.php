<?php
// Price Compare — Phase 2
// Fetches a Shopee/Lazada product page (Lazada only — Shopee is short-circuited,
// see SHOPEE_ATTEMPT_FETCH below) and tries to pull out a product name + price.
// Always responds with exactly 6 JSON fields; never leaks the fetched HTML.

declare(strict_types=1);

require __DIR__ . '/lib/domain-map.php';
require __DIR__ . '/lib/parser.php';

// Shopee returns an identical unfetchable SPA shell for every product URL
// (confirmed via curl testing) — don't waste a request on it.
const SHOPEE_ATTEMPT_FETCH = false;

const MAX_BODY_BYTES = 512 * 1024; // 512KB
const MAX_HOPS = 5;
const OVERALL_BUDGET_SECONDS = 12;

header('Content-Type: application/json; charset=utf-8');

// ---------- Response helper ----------
function respond($status, $reason, $name, $price, $currency, $source) {
    echo json_encode([
        'status'   => $status,
        'reason'   => $reason,
        'name'     => $name,
        'price'    => $price,
        'currency' => $currency,
        'source'   => $source,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ---------- URL helpers ----------
function unparse_url(array $parts) {
    $scheme = isset($parts['scheme']) ? $parts['scheme'] . '://' : '';
    $host = $parts['host'] ?? '';
    $port = isset($parts['port']) ? ':' . $parts['port'] : '';
    $user = $parts['user'] ?? '';
    $pass = isset($parts['pass']) ? ':' . $parts['pass'] : '';
    $userInfo = ($user !== '' || $pass !== '') ? $user . $pass . '@' : '';
    $path = $parts['path'] ?? '';
    $query = isset($parts['query']) ? '?' . $parts['query'] : '';
    $fragment = isset($parts['fragment']) ? '#' . $parts['fragment'] : '';
    return $scheme . $userInfo . $host . $port . $path . $query . $fragment;
}

function force_https($url) {
    if ($url === null) {
        return null;
    }
    $parts = parse_url($url);
    if ($parts === false || empty($parts['host'])) {
        return null;
    }
    $parts['scheme'] = 'https';
    return unparse_url($parts);
}

// Resolve a redirect Location header (absolute, protocol-relative, root-relative
// or path-relative) against the URL it came from.
function resolve_url($base, $location) {
    $location = trim($location);
    if ($location === '') {
        return null;
    }
    if (preg_match('#^[a-zA-Z][a-zA-Z0-9+.-]*://#', $location)) {
        return $location;
    }
    $baseParts = parse_url($base);
    if ($baseParts === false || empty($baseParts['scheme']) || empty($baseParts['host'])) {
        return null;
    }
    $port = isset($baseParts['port']) ? ':' . $baseParts['port'] : '';
    $origin = $baseParts['scheme'] . '://' . $baseParts['host'] . $port;
    if (strpos($location, '//') === 0) {
        return $baseParts['scheme'] . ':' . $location;
    }
    if (strpos($location, '/') === 0) {
        return $origin . $location;
    }
    $basePath = $baseParts['path'] ?? '/';
    $slashPos = strrpos($basePath, '/');
    $dir = $slashPos !== false ? substr($basePath, 0, $slashPos + 1) : '/';
    return $origin . $dir . $location;
}

// ---------- Single-hop fetch ----------
// Returns ['status'=>int|null, 'location'=>string|null, 'body'=>string,
//          'truncated'=>bool, 'fatal'=>'timeout'|'connection'|null]
function fetch_one($url) {
    $ch = curl_init();
    $headerLines = [];
    $body = '';
    $truncated = false;

    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_ENCODING => '',
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.9',
        ],
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        CURLOPT_HEADERFUNCTION => function ($curlHandle, $line) use (&$headerLines) {
            $headerLines[] = $line;
            return strlen($line);
        },
        CURLOPT_WRITEFUNCTION => function ($curlHandle, $chunk) use (&$body, &$truncated) {
            if (strlen($body) > MAX_BODY_BYTES) {
                $truncated = true;
                return 0; // non-matching return value aborts the transfer
            }
            $body .= $chunk;
            return strlen($chunk);
        },
    ]);

    curl_exec($ch);
    $errno = curl_errno($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    $location = null;
    foreach ($headerLines as $line) {
        if (preg_match('/^Location:\s*(.+?)\s*$/i', $line, $m)) {
            $location = $m[1];
        }
    }

    $fatal = null;
    if ($errno !== 0 && !$truncated) {
        $fatal = ($errno === CURLE_OPERATION_TIMEDOUT) ? 'timeout' : 'connection';
    }

    return [
        'status' => $status ?: null,
        'location' => $location,
        'body' => $body,
        'truncated' => $truncated,
        'fatal' => $fatal,
    ];
}

// ---------- Input validation ----------
$rawUrl = $_GET['url'] ?? null;
if (!is_string($rawUrl) || $rawUrl === '' || strlen($rawUrl) > 2048) {
    respond('error', 'invalid_url', null, null, null, null);
}
if (!filter_var($rawUrl, FILTER_VALIDATE_URL)) {
    respond('error', 'invalid_url', null, null, null, null);
}
$inputParts = parse_url($rawUrl);
if ($inputParts === false || empty($inputParts['host'])) {
    respond('error', 'invalid_url', null, null, null, null);
}
$scheme = strtolower($inputParts['scheme'] ?? '');
if ($scheme !== 'http' && $scheme !== 'https') {
    respond('error', 'invalid_url', null, null, null, null);
}
$inputParts['scheme'] = 'https';
$currentUrl = unparse_url($inputParts);

// ---------- Fetch loop (SSRF-checked on every hop) ----------
$start = microtime(true);
$currency = null;
$source = null;
$finalStatus = null;
$finalBody = '';
$finalTruncated = false;

for ($attempt = 1; $attempt <= MAX_HOPS; $attempt++) {
    $host = parse_url($currentUrl, PHP_URL_HOST);
    if (!$host) {
        respond('error', 'invalid_url', null, null, null, null);
    }

    $entry = domain_map_resolve($host);
    if ($entry === null) {
        respond('error', 'unsupported_domain', null, null, null, null);
    }
    $currency = $entry['currency'];
    $source = $entry['source'];

    // shope.ee has currency null (no country in its own domain) so this check
    // doesn't fire for it — it deliberately gets one real request to follow its
    // redirect. Once that redirect lands on a country domain, currency becomes
    // known and this check blocks the next hop before it's fetched. If instead
    // shope.ee (or any still-shopee host) returns a direct 2xx body, the
    // post-fetch guard below (after fetch_one) blocks it before parsing.
    if ($source === 'shopee' && $currency !== null && !SHOPEE_ATTEMPT_FETCH) {
        respond('error', 'blocked', null, null, $currency, $source);
    }

    if ((microtime(true) - $start) >= OVERALL_BUDGET_SECONDS) {
        respond('error', 'timeout', null, null, $currency, $source);
    }

    $result = fetch_one($currentUrl);

    if ($result['fatal'] === 'timeout') {
        respond('error', 'timeout', null, null, $currency, $source);
    }
    if ($result['fatal'] === 'connection') {
        respond('error', 'http_error', null, null, $currency, $source);
    }

    if ($result['status'] !== null && $result['status'] >= 300 && $result['status'] < 400 && $result['location']) {
        if ($attempt === MAX_HOPS) {
            respond('error', 'too_many_redirects', null, null, $currency, $source);
        }
        $newUrl = force_https(resolve_url($currentUrl, $result['location']));
        if ($newUrl === null) {
            respond('error', 'http_error', null, null, $currency, $source);
        }
        $currentUrl = $newUrl;
        continue;
    }

    // Non-redirect (2xx or otherwise) response from a Shopee-sourced host: never
    // parse it, even if $currency is still null (e.g. an unresolved shope.ee
    // shortlink) — only Shopee's redirects are ever followed, never its bodies.
    // See the comment at the pre-fetch short-circuit above for how the two guards interact.
    if ($source === 'shopee' && !SHOPEE_ATTEMPT_FETCH) {
        respond('error', 'blocked', null, null, $currency, $source);
    }

    // Final (non-redirect) response for this chain.
    $finalStatus = $result['status'];
    $finalBody = $result['body'];
    $finalTruncated = $result['truncated'];
    break;
}

// ---------- Page classification ----------
if (parser_is_blocked($finalBody)) {
    respond('error', 'blocked', null, null, $currency, $source);
}
if (parser_is_not_found($finalBody, $finalStatus)) {
    respond('error', 'not_found', null, null, $currency, $source);
}
if ($finalStatus === null || $finalStatus < 200 || $finalStatus >= 300) {
    respond('error', 'http_error', null, null, $currency, $source);
}

// ---------- Extraction ----------
$name = parser_extract_name($finalBody);
$price = parser_extract_price($finalBody, $currency);

if ($name === null && $price === null) {
    if ($finalTruncated) {
        respond('error', 'too_large', null, null, $currency, $source);
    }
    respond('error', 'parse_failed', null, null, $currency, $source);
}

$status = ($name !== null && $price !== null) ? 'ok' : 'partial';
respond($status, null, $name, $price, $currency, $source);
