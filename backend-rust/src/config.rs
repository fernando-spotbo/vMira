use std::env;

/// Application configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Config {
    // ── General ──────────────────────────────────────────────
    pub app_name: String,
    pub debug: bool,
    pub api_prefix: String,

    // ── Database ─────────────────────────────────────────────
    pub database_url: String,
    pub db_pool_size: u32,
    pub db_max_overflow: u32,

    // ── Redis ────────────────────────────────────────────────
    pub redis_url: String,

    // ── JWT / Security ───────────────────────────────────────
    pub secret_key: String,
    pub access_token_expire_minutes: i64,
    pub refresh_token_expire_days: i64,
    pub algorithm: String,

    // ── Rate limiting ────────────────────────────────────────
    pub rate_limit_requests: u32,
    pub rate_limit_login_attempts: u32,
    pub rate_limit_window_seconds: u64,
    pub max_concurrent_streams_per_user: u32,

    // ── Upstream AI model ────────────────────────────────────
    pub ai_model_url: String,
    pub ai_model_api_key: String,
    pub ai_model_allowed_hosts: Vec<String>,

    // ── CORS ─────────────────────────────────────────────────
    pub allowed_origins: Vec<String>,

    // ── OAuth providers ──────────────────────────────────────
    pub vk_client_id: String,
    pub vk_client_secret: String,
    pub yandex_client_id: String,
    pub yandex_client_secret: String,
    pub google_client_id: String,

    // ── GPU queue ──────────────────────────────────────────────
    pub gpu_max_concurrent: i32,
    pub gpu_queue_max_size: i32,

    // ── HMAC gateway verification ────────────────────────────
    pub hmac_secret: String,

    // ── YooKassa payment ──────────────────────────────────────
    pub yookassa_shop_id: String,
    pub yookassa_secret_key: String,

    // ── File uploads ─────────────────────────────────────────
    pub upload_dir: String,
    pub max_upload_size: usize, // bytes

    // ── Web search (SearXNG) ────────────────────────────────
    pub searxng_url: String,

    // ── Voice STT (local whisper) ─────────────────────────
    pub whisper_url: String,

    // ── Voice TTS (local piper) ───────────────────────────
    pub piper_url: String,

    // ── Telegram bot ────────────────────────────────────
    pub telegram_bot_token: String,
    pub telegram_webhook_secret: String,
}

impl Config {
    /// Build a `Config` from the process environment.
    ///
    /// Panics in production (`debug = false`) when security-sensitive values
    /// still contain the development placeholder strings.
    pub fn from_env() -> Self {
        let debug = env_or("DEBUG", "false")
            .to_ascii_lowercase()
            .parse::<bool>()
            .unwrap_or(false);

        let secret_key = env_or("SECRET_KEY", "CHANGE-ME-IN-PRODUCTION");
        let hmac_secret = env_or("HMAC_SECRET", "CHANGE-ME-IN-PRODUCTION");
        let database_url = env_or("DATABASE_URL", "postgresql://mira:mira@localhost:5432/mira");

        // ── Production guard-rails ───────────────────────────
        if !debug {
            if secret_key == "CHANGE-ME-IN-PRODUCTION" {
                panic!("SECRET_KEY must be changed from the default value in production");
            }
            if hmac_secret == "CHANGE-ME-IN-PRODUCTION" {
                panic!("HMAC_SECRET must be changed from the default value in production");
            }
            if database_url.contains("mira:mira@") {
                panic!("DATABASE_URL must not use default credentials (mira:mira@) in production");
            }
        }

        let ai_model_allowed_hosts = env_or("AI_MODEL_ALLOWED_HOSTS", "")
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let allowed_origins = env_or("ALLOWED_ORIGINS", "http://localhost:3000")
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Config {
            app_name: env_or("APP_NAME", "Mira API"),
            debug,
            api_prefix: env_or("API_PREFIX", "/api/v1"),

            database_url,
            db_pool_size: env_or("DB_POOL_SIZE", "10").parse().unwrap_or(10),
            db_max_overflow: env_or("DB_MAX_OVERFLOW", "5").parse().unwrap_or(5),

            redis_url: env_or("REDIS_URL", "redis://127.0.0.1:6379"),

            secret_key,
            access_token_expire_minutes: env_or("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
                .parse()
                .unwrap_or(15),
            refresh_token_expire_days: env_or("REFRESH_TOKEN_EXPIRE_DAYS", "30")
                .parse()
                .unwrap_or(30),
            algorithm: env_or("ALGORITHM", "HS256"),

            rate_limit_requests: env_or("RATE_LIMIT_REQUESTS", "60")
                .parse()
                .unwrap_or(60),
            rate_limit_login_attempts: env_or("RATE_LIMIT_LOGIN_ATTEMPTS", "5")
                .parse()
                .unwrap_or(5),
            rate_limit_window_seconds: env_or("RATE_LIMIT_WINDOW_SECONDS", "60")
                .parse()
                .unwrap_or(60),
            max_concurrent_streams_per_user: env_or("MAX_CONCURRENT_STREAMS_PER_USER", "3")
                .parse()
                .unwrap_or(3),

            ai_model_url: env_or("AI_MODEL_URL", ""),
            ai_model_api_key: env_or("AI_MODEL_API_KEY", ""),
            ai_model_allowed_hosts,

            allowed_origins,

            vk_client_id: env_or("VK_CLIENT_ID", ""),
            vk_client_secret: env_or("VK_CLIENT_SECRET", ""),
            yandex_client_id: env_or("YANDEX_CLIENT_ID", ""),
            yandex_client_secret: env_or("YANDEX_CLIENT_SECRET", ""),
            google_client_id: env_or("GOOGLE_CLIENT_ID", ""),

            gpu_max_concurrent: env_or("GPU_MAX_CONCURRENT", "4")
                .parse()
                .unwrap_or(4),
            gpu_queue_max_size: env_or("GPU_QUEUE_MAX_SIZE", "50")
                .parse()
                .unwrap_or(50),

            hmac_secret,

            yookassa_shop_id: env_or("YOOKASSA_SHOP_ID", ""),
            yookassa_secret_key: env_or("YOOKASSA_SECRET_KEY", ""),

            upload_dir: env_or("UPLOAD_DIR", "/opt/mira/uploads"),
            max_upload_size: env_or("MAX_UPLOAD_SIZE", "10485760")
                .parse()
                .unwrap_or(10 * 1024 * 1024), // 10MB

            searxng_url: env_or("SEARXNG_URL", "http://127.0.0.1:8888"),

            whisper_url: env_or("WHISPER_URL", "http://127.0.0.1:8787"),

            piper_url: env_or("PIPER_URL", "http://127.0.0.1:5100"),

            telegram_bot_token: env_or("TELEGRAM_BOT_TOKEN", ""),
            telegram_webhook_secret: env_or("TELEGRAM_WEBHOOK_SECRET", ""),
        }
    }
}

/// Read an environment variable, falling back to `default` if unset or empty.
fn env_or(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}
