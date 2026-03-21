# Rust API Gateway Security Research (2025-2026)

Research compiled: 2026-03-18

Production security patterns for a Rust (Axum) API gateway serving AI/LLM models,
with Nginx reverse proxy and Redis-backed distributed rate limiting.

---

## 1. Axum Security Middleware Stack

### Recommended Middleware Architecture

Use `tower::ServiceBuilder` to compose middleware layers in a single stack rather than
calling `.layer()` repeatedly. Axum integrates directly with Tower, so the entire
tower/tower-http middleware ecosystem is available.

```rust
use axum::{Router, routing::post};
use tower::ServiceBuilder;
use tower_http::{
    cors::CorsLayer,
    timeout::TimeoutLayer,
    compression::CompressionLayer,
    trace::TraceLayer,
    limit::RequestBodyLimitLayer,
};
use tower_governor::GovernorLayer;
use std::time::Duration;

let app = Router::new()
    .route("/v1/chat/completions", post(chat_handler))
    .layer(
        ServiceBuilder::new()
            .layer(TraceLayer::new_for_http())          // Outermost: tracing
            .layer(TimeoutLayer::new(Duration::from_secs(120))) // Request timeout
            .layer(CompressionLayer::new())              // Response compression
            .layer(cors_layer())                         // CORS
            .layer(RequestBodyLimitLayer::new(1024 * 1024)) // 1MB body limit
            .layer(GovernorLayer { config: governor_config }) // Rate limiting
    );
```

### CORS Configuration (Restrictive)

Never use `CorsLayer::permissive()` in production. Explicitly whitelist origins:

```rust
use tower_http::cors::{CorsLayer, AllowOrigin, AllowMethods, AllowHeaders};
use http::{Method, header};

fn cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "https://mira.app".parse().unwrap(),
            "https://api.mira.app".parse().unwrap(),
        ]))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::ACCEPT,
        ])
        .max_age(Duration::from_secs(3600))
        .allow_credentials(true)
}
```

### Rate Limiting with tower-governor

`tower-governor` wraps the `governor` crate (GCRA algorithm -- a sophisticated leaky bucket):

```rust
use tower_governor::{GovernorConfigBuilder, GovernorLayer};

let governor_config = GovernorConfigBuilder::default()
    .per_second(2)      // Replenish 1 token every 500ms
    .burst_size(10)     // Allow bursts of up to 10 requests
    .finish()
    .unwrap();

// IMPORTANT: must use into_make_service_with_connect_info for IP extraction
let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
axum::serve(listener, app.into_make_service_with_connect_info::<std::net::SocketAddr>())
    .await
    .unwrap();
```

**Key crates:**
- `tower-governor` (0.4+): Tower/Axum rate limiting via governor, supports per-IP, global, or custom keys
- `governor` (0.6+): Underlying GCRA rate limiter
- `axum-governor` (alternative): Independent implementation using lazy-limit

### Request Body Size Limits

Two mechanisms exist in Axum:

| Mechanism | Scope | Default |
|-----------|-------|---------|
| `DefaultBodyLimit` | Local -- only affects extractors that opt in (`Json`, `Form`, `Bytes`) | 2 MB |
| `RequestBodyLimitLayer` | Global -- applies to ALL requests regardless of how body is consumed | None |

For an LLM gateway, set `RequestBodyLimitLayer` globally to prevent abuse:

```rust
// Global: reject any request body > 1MB
.layer(RequestBodyLimitLayer::new(1024 * 1024))

// Per-route override: allow larger uploads on specific endpoints
.route("/v1/files", post(upload_handler))
    .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // 50MB for file uploads
```

### Timeout Middleware

Use `tower_http::timeout::TimeoutLayer` for simple cases, or `tower::timeout::TimeoutLayer`
with `HandleErrorLayer` for custom error responses:

```rust
use tower_http::timeout::TimeoutLayer;
use std::time::Duration;

// Simple: returns 408 after 120 seconds
.layer(TimeoutLayer::new(Duration::from_secs(120)))
```

For streaming endpoints (SSE), you may need to exempt them from the global timeout
or use a longer timeout since token generation can take minutes.

### TLS Termination

Two approaches:

**Option A: Nginx terminates TLS (recommended for production)**
- Nginx handles TLS with Let's Encrypt certs
- Axum listens on plain HTTP on localhost
- Simpler certificate management, well-tested

**Option B: Axum terminates TLS directly via axum-server + rustls**

```rust
use axum_server::tls_rustls::RustlsConfig;

let tls_config = RustlsConfig::from_pem_file(
    "certs/fullchain.pem",
    "certs/privkey.pem",
).await.unwrap();

axum_server::bind_rustls("0.0.0.0:443".parse().unwrap(), tls_config)
    .serve(app.into_make_service())
    .await
    .unwrap();
```

Recommendation: Use Nginx for TLS termination in production. Reserve axum-server + rustls
for cases where you cannot run Nginx (e.g., single-binary deployment).

---

## 2. API Key Validation in Rust

### Key Format and Structure

Following the kerkour.com approach for cryptographically-secure API keys:

```
mira_live_a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5_k7x9
       ^                                      ^
       |                                      |
       random bytes (32 bytes, hex)      checksum (BLAKE3, 4 chars)
```

**Structure:**
1. **Prefix**: `mira_live_` or `mira_test_` (identifies environment)
2. **Random payload**: 32 cryptographically random bytes, hex-encoded
3. **Checksum suffix**: BLAKE3 hash of the payload, truncated to 4 characters

The checksum enables fast rejection of malformed keys (~20us) without touching the database.

### Hashing and Storage

Store only the hash, never the raw key:

```rust
use argon2::{Argon2, PasswordHasher, PasswordVerifier};
use blake3;
use subtle::ConstantTimeEq;

// At key creation time: show raw key to user, store hash
fn create_api_key() -> (String, String) {
    let raw_key = generate_random_key_with_checksum();
    let hash = argon2_hash(&raw_key); // Argon2id for storage
    (raw_key, hash)   // raw_key shown once, hash stored in DB
}

// At validation time
fn validate_api_key(provided: &str, stored_hash: &str) -> bool {
    // Step 1: Fast checksum validation (BLAKE3, ~20us)
    if !validate_checksum(provided) {
        return false; // Reject malformed keys instantly
    }

    // Step 2: Argon2id verification (timing-safe)
    argon2_verify(provided, stored_hash)
}
```

**Key crates:**
- `argon2` (from RustCrypto/password-hashes): Argon2id hashing -- gold standard for 2025+
- `blake3`: Fast checksum for pre-validation
- `subtle`: Constant-time comparison (`ConstantTimeEq`) to prevent timing attacks
- `api-keys-simplified`: All-in-one crate with BLAKE3 checksums + Argon2id + constant-time comparison

### Caching Validated Keys (Two-Tier with Moka + Redis)

Avoid hitting Argon2 on every request. Use a two-tier cache:

```rust
use moka::future::Cache;
use std::time::Duration;

// L1: In-memory cache (Moka) -- fast, per-instance
let key_cache: Cache<String, CachedKeyInfo> = Cache::builder()
    .time_to_live(Duration::from_secs(300))    // 5 min TTL
    .time_to_idle(Duration::from_secs(60))     // Evict if unused for 1 min
    .max_capacity(10_000)
    .build();

// L2: Redis -- shared across instances
// Local TTL slightly shorter than Redis TTL to keep Redis as source of truth

struct CachedKeyInfo {
    user_id: Uuid,
    tier: PricingTier,
    rate_limit: u32,
    validated_at: Instant,
}
```

**Multi-tier crate:** `multi-tier-cache` provides L1 (Moka) + L2 (Redis) with stampede protection
and Redis Streams support out of the box.

### Key Rotation

- Store a `key_version` column alongside the hash
- Support 2 active versions simultaneously during rotation window
- Expire old version after grace period (e.g., 7 days)
- Emit deprecation warnings in response headers when old key is used

---

## 3. Input Sanitization for LLM Gateways

### Defense-in-Depth Strategy

OWASP and the security community consensus (2025-2026): **you cannot filter your way out
of prompt injection**. Regex is a useful pre-filter but must be combined with:

1. Input validation and sanitization (this section)
2. Privilege separation (system prompt vs user content)
3. Output filtering (section 4)
4. Least-privilege tool access
5. Content delimiters separating instructions from user data

### Regex Patterns That Work as Pre-Filters

Based on the Sibyllinesoft "Clean" library (Rust-native, 7 categories, 13 languages):

```rust
use regex::RegexSet;

let injection_patterns = RegexSet::new(&[
    // Category 1: Instruction Override
    r"(?i)ignore\s+(all\s+)?previous\s+instructions?",
    r"(?i)disregard\s+(all\s+)?(previous|above|prior)\s+",
    r"(?i)forget\s+(all\s+)?(previous|above|prior)\s+",
    r"(?i)override\s+(system|previous|all)\s+",
    r"(?i)new\s+instructions?\s*[:=]",

    // Category 2: Role Injection
    r"(?i)you\s+are\s+now\s+(in\s+)?(developer|admin|debug|dan)\s+mode",
    r"(?i)act\s+as\s+(a\s+)?(system|root|admin)",
    r"(?i)pretend\s+(you('re|\s+are)\s+)?(a\s+different|another|no longer)",
    r"(?i)switch\s+to\s+(unrestricted|unfiltered|jailbreak)",

    // Category 3: System Manipulation
    r"(?i)system\s*prompt\s*[:=]",
    r"(?i)\[system\]",
    r"(?i)<\s*system\s*>",
    r"(?i)<<\s*SYS\s*>>",

    // Category 4: Prompt Leaking
    r"(?i)reveal\s+(your\s+)?(system\s+)?prompt",
    r"(?i)show\s+(me\s+)?(your\s+)?(initial|system|original)\s+prompt",
    r"(?i)print\s+(your\s+)?(system\s+)?(prompt|instructions)",
    r"(?i)what\s+(are|were)\s+your\s+(initial|original|system)\s+instructions",

    // Category 5: Jailbreak Keywords
    r"(?i)do\s+anything\s+now",
    r"(?i)jailbreak",
    r"(?i)developer\s+mode\s+(enabled|activated|on)",

    // Category 6: Encoding Markers (Base64/Hex payloads)
    r"(?i)base64\s*[:=]\s*[A-Za-z0-9+/]{20,}",
    r"(?i)hex\s*[:=]\s*[0-9a-fA-F]{20,}",
    r"(?i)decode\s+(this|the\s+following)\s+(base64|hex)",

    // Category 7: Suspicious Delimiters
    r"```system",
    r"---\s*BEGIN\s+(SYSTEM|ADMIN|OVERRIDE)",
    r"<\|im_start\|>system",
]).unwrap();

fn check_injection(input: &str) -> Option<Vec<usize>> {
    let matches: Vec<usize> = injection_patterns.matches(input).iter().collect();
    if matches.is_empty() { None } else { Some(matches) }
}
```

**Limitations**: Attackers bypass regex with misspellings ("ignroe prevoius"), Unicode
homoglyphs, and encoded payloads. This is why regex is a *pre-filter*, not a solution.

### Max Input Length Enforcement

```rust
const MAX_PROMPT_LENGTH: usize = 32_768; // ~8K tokens for most models
const MAX_SYSTEM_PROMPT_LENGTH: usize = 16_384;

fn validate_input_length(input: &str) -> Result<(), ValidationError> {
    if input.len() > MAX_PROMPT_LENGTH {
        return Err(ValidationError::InputTooLong {
            max: MAX_PROMPT_LENGTH,
            actual: input.len(),
        });
    }
    Ok(())
}
```

### Unicode Normalization

Use the `unicode-normalization` crate to normalize to NFC form, preventing
homoglyph and confusable-character attacks:

```rust
use unicode_normalization::UnicodeNormalization;

fn normalize_input(input: &str) -> String {
    input.nfc().collect::<String>()
}
```

### Control Character Stripping

```rust
fn strip_control_chars(input: &str) -> String {
    input.chars()
        .filter(|c| {
            // Keep normal printable chars, newlines, tabs
            !c.is_control() || *c == '\n' || *c == '\r' || *c == '\t'
        })
        .collect()
}
```

### Combined Sanitization Pipeline

```rust
fn sanitize_user_input(raw: &str) -> Result<String, ValidationError> {
    // 1. Length check (before any processing)
    validate_input_length(raw)?;

    // 2. Unicode normalization (NFC)
    let normalized = normalize_input(raw);

    // 3. Strip control characters
    let cleaned = strip_control_chars(&normalized);

    // 4. Regex pre-filter for injection patterns
    if let Some(matched_categories) = check_injection(&cleaned) {
        log::warn!("Potential injection detected, categories: {:?}", matched_categories);
        // Option A: Block the request
        // return Err(ValidationError::SuspiciousInput);
        // Option B: Flag for review but allow (depends on policy)
    }

    Ok(cleaned)
}
```

---

## 4. Output Filtering

### Response Scanning for System Prompt Leakage

Scan model outputs before returning them to the client:

```rust
use regex::RegexSet;

let leakage_patterns = RegexSet::new(&[
    // Detect if the model is echoing back system prompt markers
    r"(?i)system\s*prompt\s*:",
    r"(?i)my\s+instructions\s+(are|say|tell)",
    r"(?i)I\s+was\s+(told|instructed|programmed)\s+to",
    r"(?i)my\s+initial\s+prompt",
    r"(?i)here\s+(is|are)\s+my\s+(system\s+)?instructions?",
    // Detect if model outputs the actual system prompt delimiters
    r"<\|im_start\|>system",
    r"<<\s*SYS\s*>>",
    r"\[INST\].*\[/INST\]",
]).unwrap();

fn scan_output(response: &str) -> OutputScanResult {
    let matches: Vec<usize> = leakage_patterns.matches(response).iter().collect();
    if matches.is_empty() {
        OutputScanResult::Clean
    } else {
        OutputScanResult::PotentialLeakage { pattern_ids: matches }
    }
}
```

### PII Detection in Outputs

Based on patterns from LLM Guard (Protect AI) and Presidio:

```rust
let pii_patterns = RegexSet::new(&[
    // Email
    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    // Phone (international)
    r"\+?1?\s*[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",
    // SSN
    r"\b\d{3}-\d{2}-\d{4}\b",
    // Credit card (basic Luhn-eligible patterns)
    r"\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b",
    // IPv4
    r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
    // Russian passport
    r"\b\d{2}\s?\d{2}\s?\d{6}\b",
    // Russian phone
    r"\+?7\s*[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{2}[-.\s]?\d{2}",
]).unwrap();

fn scan_for_pii(text: &str) -> Vec<PiiMatch> {
    // Returns matched PII types and their positions for redaction
}
```

**LLM Guard** (by Protect AI) is the most mature open-source output scanner:
- Regex-based output scanner with configurable "bad" (block) and "good" (allow) patterns
- Sensitive data scanner using Presidio Analyzer Engine
- Can redact matching content or flag for review
- Permissively licensed (MIT)

### Output Filtering Pipeline

```rust
async fn filter_response(raw_output: &str) -> FilteredResponse {
    // 1. Check for system prompt leakage
    let leakage = scan_output(raw_output);

    // 2. Check for PII
    let pii_matches = scan_for_pii(raw_output);

    // 3. Apply policy
    match (leakage, pii_matches.is_empty()) {
        (OutputScanResult::PotentialLeakage { .. }, _) => {
            // Block or redact the response
            FilteredResponse::Blocked { reason: "potential_system_prompt_leakage" }
        }
        (_, false) => {
            // Redact PII and return
            let redacted = redact_pii(raw_output, &pii_matches);
            FilteredResponse::Redacted { content: redacted, pii_count: pii_matches.len() }
        }
        _ => FilteredResponse::Clean { content: raw_output.to_string() }
    }
}
```

---

## 5. Redis-Backed Distributed Rate Limiting

### Crate Selection

| Crate | Use Case | Notes |
|-------|----------|-------|
| `redis` | Core Redis client | Built-in `ConnectionManager` uses multiplexed connection -- often sufficient without pooling |
| `deadpool-redis` | Connection pool manager | Best for high-concurrency with many simultaneous Redis operations |
| `bb8-redis` | Alternative pool | More flexible, less opinionated than deadpool |

**Recommendation**: Start with `redis` + `ConnectionManager` (multiplexed). Switch to
`deadpool-redis` only if benchmarks show contention under your load profile. A multiplexed
connection is often faster than a pool for typical rate-limiting workloads.

### Sliding Window Algorithm (Lua Script)

The sliding window uses a Redis sorted set per client, with timestamps as scores:

```lua
-- sliding_window.lua
-- KEYS[1] = rate limit key (e.g., "rl:api_key:abc123")
-- ARGV[1] = window size in milliseconds
-- ARGV[2] = max requests per window
-- ARGV[3] = current timestamp in milliseconds

local key = KEYS[1]
local window = tonumber(ARGV[1])
local max_requests = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local window_start = now - window

-- Atomic: prune + count + conditionally add
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
local count = redis.call('ZCARD', key)

if count < max_requests then
    redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
    redis.call('PEXPIRE', key, window)
    return {1, max_requests - count - 1, 0}  -- allowed, remaining, retry_after
else
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retry_after = 0
    if #oldest > 0 then
        retry_after = tonumber(oldest[2]) + window - now
    end
    return {0, 0, retry_after}  -- denied, remaining, retry_after_ms
end
```

**Why Lua**: The prune-count-add must be atomic. Without atomicity, two concurrent
requests could both read the same ZCARD count, both pass, and both ZADD -- exceeding the limit.

### Rust Integration

```rust
use redis::AsyncCommands;
use deadpool_redis::{Config, Runtime, Pool};

struct RedisRateLimiter {
    pool: Pool,
    script: redis::Script,
    window_ms: u64,
    max_requests: u64,
}

impl RedisRateLimiter {
    fn new(pool: Pool, window_ms: u64, max_requests: u64) -> Self {
        let script = redis::Script::new(include_str!("sliding_window.lua"));
        Self { pool, script, window_ms, max_requests }
    }

    async fn check(&self, key: &str) -> Result<RateLimitResult, RedisError> {
        let mut conn = self.pool.get().await?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_millis() as u64;

        let result: (i64, i64, i64) = self.script
            .key(format!("rl:{}", key))
            .arg(self.window_ms)
            .arg(self.max_requests)
            .arg(now)
            .invoke_async(&mut *conn)
            .await?;

        Ok(RateLimitResult {
            allowed: result.0 == 1,
            remaining: result.1 as u32,
            retry_after_ms: result.2 as u64,
        })
    }
}
```

### Token Bucket in Redis (Alternative)

Simpler, allows controlled bursts:

```lua
-- token_bucket.lua
local key = KEYS[1]
local max_tokens = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])  -- tokens per second
local now = tonumber(ARGV[3])          -- current timestamp ms

local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(data[1]) or max_tokens
local last_refill = tonumber(data[2]) or now

-- Refill tokens based on elapsed time
local elapsed = (now - last_refill) / 1000.0
local new_tokens = math.min(max_tokens, tokens + elapsed * refill_rate)

if new_tokens >= 1 then
    new_tokens = new_tokens - 1
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    redis.call('PEXPIRE', key, 60000)  -- cleanup after 60s idle
    return {1, math.floor(new_tokens), 0}
else
    local retry_after = math.ceil((1 - new_tokens) / refill_rate * 1000)
    return {0, 0, retry_after}
end
```

### Algorithm Comparison for LLM Gateway

| Algorithm | Burst Handling | Consistency | Best For |
|-----------|---------------|-------------|----------|
| Sliding Window | No bursts | Strict, even flow | Per-user API limits |
| Token Bucket | Controlled bursts | Allows spikes | Chat completion endpoints |

**Recommendation**: Use **token bucket** for chat completion endpoints (users expect
fast burst responses), and **sliding window** for administrative/abuse-prevention limits.

---

## 6. Nginx Reverse Proxy for llama-server

### Production Configuration

```nginx
# /etc/nginx/conf.d/llm-gateway.conf

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api_completion:10m rate=2r/s;
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

# Upstream: Rust API gateway (not llama-server directly)
upstream rust_gateway {
    server 127.0.0.1:3000;
    keepalive 32;
}

# Upstream: llama-server (internal only, gateway proxies to this)
upstream llama_backend {
    server 127.0.0.1:8080;
    keepalive 16;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.mira.app;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.mira.app;

    # --- TLS Configuration (Let's Encrypt) ---
    ssl_certificate /etc/letsencrypt/live/api.mira.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.mira.app/privkey.pem;

    # Modern TLS only
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/api.mira.app/chain.pem;

    # HSTS (1 year, include subdomains)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # --- Global Limits ---
    client_max_body_size 1m;
    client_body_timeout 30s;
    client_header_timeout 30s;
    limit_conn conn_limit 10;  # Max 10 concurrent connections per IP

    # --- API Routes (proxied to Rust gateway) ---
    location /v1/ {
        limit_req zone=api_general burst=20 nodelay;
        limit_req_status 429;

        proxy_pass http://rust_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 300s;  # Long timeout for LLM generation
    }

    # --- SSE/Streaming Endpoint ---
    location /v1/chat/completions {
        limit_req zone=api_completion burst=5 nodelay;
        limit_req_status 429;

        proxy_pass http://rust_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        # CRITICAL for SSE streaming
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;

        # Long timeout for streaming responses
        proxy_read_timeout 600s;  # 10 minutes for long generations
        proxy_send_timeout 600s;

        # Disable gzip for SSE (breaks streaming)
        proxy_set_header Accept-Encoding "";
    }

    # --- Block dangerous llama-server management endpoints ---
    location ~ ^/(slots|props|health|metrics) {
        deny all;
        return 403;
    }

    # --- Static assets / frontend ---
    location / {
        proxy_pass http://127.0.0.1:3001;  # Next.js frontend
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Key SSE/Streaming Configuration Notes

The critical settings that prevent Nginx from breaking LLM token streaming:

| Setting | Value | Why |
|---------|-------|-----|
| `proxy_buffering` | `off` | Nginx default buffers responses, delaying SSE tokens |
| `proxy_cache` | `off` | Prevents caching streamed responses |
| `proxy_http_version` | `1.1` | Required for chunked transfer encoding |
| `proxy_read_timeout` | `600s` | Default 60s kills long completions mid-generation |
| `Accept-Encoding` header | `""` | Prevents gzip on SSE (breaks streaming) |
| `chunked_transfer_encoding` | `on` | Required for NDJSON and SSE streaming |

### Let's Encrypt Automation

```bash
# Initial certificate
certbot certonly --nginx -d api.mira.app

# Auto-renewal (crontab)
0 0,12 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

### Connection Limits Explained

```nginx
# Per-IP concurrent connection limit
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
limit_conn conn_limit 10;

# Per-IP request rate limit (general API)
limit_req_zone $binary_remote_addr zone=api_general:10m rate=10r/s;
limit_req zone=api_general burst=20 nodelay;
# burst=20: buffer for traffic spikes
# nodelay: process burst requests immediately (important for APIs)

# Per-IP request rate limit (completions -- more restrictive)
limit_req_zone $binary_remote_addr zone=api_completion:10m rate=2r/s;
limit_req zone=api_completion burst=5 nodelay;
```

---

## Recommended Crate Summary

| Purpose | Crate | Version (2025+) |
|---------|-------|-----------------|
| Web framework | `axum` | 0.8+ |
| CORS, compression, tracing | `tower-http` | 0.6+ |
| Rate limiting (in-process) | `tower-governor` | 0.4+ |
| Rate limiting (distributed) | `redis` + Lua scripts | 0.27+ |
| Redis connection pool | `deadpool-redis` | 0.18+ |
| In-memory cache | `moka` | 0.12+ |
| Multi-tier cache | `multi-tier-cache` | latest |
| API key hashing | `argon2` (RustCrypto) | 0.5+ |
| Fast checksum | `blake3` | 1.5+ |
| Constant-time compare | `subtle` | 2.5+ |
| Unicode normalization | `unicode-normalization` | 0.1+ |
| Regex (pattern matching) | `regex` | 1.10+ |
| TLS (if not using Nginx) | `axum-server` + `rustls` | 0.7+ |
| Prompt injection detection | `clean` (sibyllinesoft) | latest |

---

## Architecture Diagram

```
                    Internet
                       |
                  [Nginx] (TLS termination, rate limiting, connection limits)
                       |
              [Rust Axum Gateway]
              /        |        \
    [Input           [Auth]     [Output
     Sanitize]     /      \     Filter]
                  /        \
          [Moka Cache]  [Redis]
          (L1, TTL)    (L2, sliding window rate limits)
                          |
                   [llama-server]
                   (llama.cpp on GPU)
```

Flow:
1. Client -> Nginx (TLS, IP rate limit, connection limit)
2. Nginx -> Axum (CORS, body limit, tower-governor rate limit)
3. Axum middleware: validate API key (Moka L1 -> Redis L2 -> DB)
4. Axum middleware: sanitize input (normalize, strip, regex scan)
5. Axum middleware: Redis distributed rate limit (per-key, per-tier)
6. Axum handler: proxy to llama-server
7. Axum middleware: scan output (leakage, PII)
8. Response -> Client (with rate limit headers)
