//! Centralized plan configuration — single source of truth for all plan limits.
//!
//! IMPORTANT: This is the ONLY place plan limits should be defined.
//! All routes, services, and endpoints must use these functions.

use serde::Serialize;

/// All limits and pricing for a given plan.
#[derive(Debug, Clone, Serialize)]
pub struct PlanConfig {
    pub name: &'static str,
    pub display_name: &'static str,
    pub rank: i32,

    // ── Daily message limits ──
    pub chat_daily_messages: i64,
    pub code_daily_messages: i64,

    // ── Conversation limits ──
    pub max_conversations: i64,

    // ── Monthly token budget (-1 = unlimited) ──
    pub monthly_token_limit: i64,

    // ── Rate windows (for /quota) ──
    pub five_hour_limit: i64,
    pub seven_day_limit: i64,
    pub seven_day_thinking_limit: i64,
    pub seven_day_standard_limit: i64,

    // ── AI features ──
    pub search_results: usize,
    pub max_response_tokens: u32,
    pub context_window: i64,

    // ── Subscription pricing (kopecks/month) ──
    pub chat_price_kopecks: i64,
    pub code_price_kopecks: i64,

    // ── Display pricing ──
    pub chat_price_display: &'static str,
    pub code_price_display: &'static str,
    pub chat_messages_display: &'static str,
    pub code_messages_display: &'static str,

    // ── API token pricing (microcents per 1K tokens) ──
    pub api_input_price_per_1k: i64,
    pub api_output_price_per_1k: i64,
    pub api_thinking_surcharge_pct: i32,

    // ── Features ──
    pub has_voice: bool,
    pub has_search: bool,
    pub has_reminders: bool,
    pub has_calendar: bool,
    pub has_projects: bool,
    pub has_remote_control: bool,
    pub has_organizations: bool,
    pub max_file_upload_mb: i32,
    pub max_org_members: i32,
}

/// Get plan configuration by name.
pub fn get_plan(plan: &str) -> &'static PlanConfig {
    match plan {
        "pro" => &PRO,
        "max" => &MAX,
        "enterprise" => &ENTERPRISE,
        _ => &FREE,
    }
}

/// Get plan rank for comparison (free < pro < max < enterprise).
pub fn plan_rank(plan: &str) -> i32 {
    get_plan(plan).rank
}

// ═══════════════════════════════════════════════════════════════
//  Plan definitions
// ═══════════════════════════════════════════════════════════════

static FREE: PlanConfig = PlanConfig {
    name: "free",
    display_name: "Free",
    rank: 0,

    chat_daily_messages: 1000,
    code_daily_messages: 20,
    max_conversations: 100,
    monthly_token_limit: 500_000,

    five_hour_limit: 20,
    seven_day_limit: 100,
    seven_day_thinking_limit: 20,
    seven_day_standard_limit: 100,

    search_results: 4,
    max_response_tokens: 2048,
    context_window: 262_144,

    chat_price_kopecks: 0,
    code_price_kopecks: 0,
    chat_price_display: "Free",
    code_price_display: "Free",
    chat_messages_display: "1,000/day",
    code_messages_display: "20/day",

    api_input_price_per_1k: 0,
    api_output_price_per_1k: 0,
    api_thinking_surcharge_pct: 0,

    has_voice: false,
    has_search: true,
    has_reminders: true,
    has_calendar: false,
    has_projects: true,
    has_remote_control: false,
    has_organizations: false,
    max_file_upload_mb: 10,
    max_org_members: 1,
};

static PRO: PlanConfig = PlanConfig {
    name: "pro",
    display_name: "Pro",
    rank: 1,

    chat_daily_messages: 5000,
    code_daily_messages: 500,
    max_conversations: 1000,
    monthly_token_limit: 10_000_000,

    five_hour_limit: 100,
    seven_day_limit: 2000,
    seven_day_thinking_limit: 500,
    seven_day_standard_limit: 2000,

    search_results: 10,
    max_response_tokens: 4096,
    context_window: 262_144,

    chat_price_kopecks: 19900,
    code_price_kopecks: 49900,
    chat_price_display: "199 ₽/mo",
    code_price_display: "499 ₽/mo",
    chat_messages_display: "5,000/day",
    code_messages_display: "500/day",

    api_input_price_per_1k: 50,   // 0.05 RUB per 1K input
    api_output_price_per_1k: 150,  // 0.15 RUB per 1K output
    api_thinking_surcharge_pct: 50,

    has_voice: true,
    has_search: true,
    has_reminders: true,
    has_calendar: true,
    has_projects: true,
    has_remote_control: true,
    has_organizations: true,
    max_file_upload_mb: 25,
    max_org_members: 10,
};

static MAX: PlanConfig = PlanConfig {
    name: "max",
    display_name: "Max",
    rank: 2,

    chat_daily_messages: -1,
    code_daily_messages: -1,
    max_conversations: 10000,
    monthly_token_limit: 100_000_000,

    five_hour_limit: 300,
    seven_day_limit: 10000,
    seven_day_thinking_limit: 3000,
    seven_day_standard_limit: 10000,

    search_results: 20,
    max_response_tokens: 16384,
    context_window: 262_144,

    chat_price_kopecks: 99000,
    code_price_kopecks: 99000,
    chat_price_display: "990 ₽/mo",
    code_price_display: "990 ₽/mo",
    chat_messages_display: "Unlimited",
    code_messages_display: "Unlimited",

    api_input_price_per_1k: 30,
    api_output_price_per_1k: 100,
    api_thinking_surcharge_pct: 30,

    has_voice: true,
    has_search: true,
    has_reminders: true,
    has_calendar: true,
    has_projects: true,
    has_remote_control: true,
    has_organizations: true,
    max_file_upload_mb: 50,
    max_org_members: 50,
};

static ENTERPRISE: PlanConfig = PlanConfig {
    name: "enterprise",
    display_name: "Enterprise",
    rank: 3,

    chat_daily_messages: -1,
    code_daily_messages: -1,
    max_conversations: -1,
    monthly_token_limit: -1,

    five_hour_limit: -1,
    seven_day_limit: -1,
    seven_day_thinking_limit: -1,
    seven_day_standard_limit: -1,

    search_results: 20,
    max_response_tokens: 16384,
    context_window: 262_144,

    chat_price_kopecks: 0,
    code_price_kopecks: 0,
    chat_price_display: "Custom",
    code_price_display: "Custom",
    chat_messages_display: "Unlimited",
    code_messages_display: "Unlimited",

    api_input_price_per_1k: 20,
    api_output_price_per_1k: 60,
    api_thinking_surcharge_pct: 0,

    has_voice: true,
    has_search: true,
    has_reminders: true,
    has_calendar: true,
    has_projects: true,
    has_remote_control: true,
    has_organizations: true,
    max_file_upload_mb: 100,
    max_org_members: -1,
};

/// Endpoint to expose plan configs to frontend (for pricing pages).
pub fn all_plans() -> Vec<&'static PlanConfig> {
    vec![&FREE, &PRO, &MAX, &ENTERPRISE]
}
