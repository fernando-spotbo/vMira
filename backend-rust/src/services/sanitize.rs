//! Input / output sanitisation.
//!
//! - `sanitize_input`  — strips null bytes and control characters (preserving
//!   newlines, tabs, carriage returns) from user-provided text.
//! - `sanitize_output` — strips `<script>` tags and inline event handlers from
//!   AI-generated output before it reaches the client.
//! - `detect_injection` — heuristic check for known injection / jailbreak
//!   patterns.

use std::sync::LazyLock;

use regex::Regex;

// ── Injection detection ─────────────────────────────────────────────────────

/// Pre-compiled patterns that signal an injection attempt.
static INJECTION_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    let raw = [
        // English
        r"(?i)ignore\s+(all\s+)?previous\s+instructions",
        r"(?i)you\s+are\s+now\s+(in\s+)?(\w+\s+)?mode",
        r"(?i)system\s*:\s*you\s+are",
        r"(?i)forget\s+(all\s+)?(your\s+)?(previous\s+)?instructions",
        r"(?i)override\s+(your\s+)?(system\s+)?(prompt|instructions)",
        r"(?i)do\s+not\s+follow\s+(your\s+)?(original\s+)?instructions",
        r"(?i)disregard\s+(all\s+)?(prior|previous)\s+",
        r"(?i)(jailbreak|DAN\s*mode|developer\s+mode\s+enabled)",
        // Russian
        r"(?i)игнорируй\s+(все\s+)?предыдущие\s+инструкции",
        r"(?i)забудь\s+(все\s+)?(предыдущие\s+)?инструкции",
        r"(?i)ты\s+теперь\s+в\s+режиме",
        r"(?i)отмени\s+(все\s+)?(системные\s+)?ограничения",
        r"(?i)переопредели\s+(свои\s+)?(системные\s+)?инструкции",
        // Generic prompt separators / model internals
        r"(?i)<\|im_start\|>",
        r"(?i)###\s*(system|instruction|prompt)\s*:",
        r"<[＜]?[｜\|]DSML[｜\|]",
    ];
    raw.iter().map(|p| Regex::new(p).unwrap()).collect()
});

/// Returns `true` if the content matches any known injection pattern.
pub fn detect_injection(content: &str) -> bool {
    INJECTION_PATTERNS.iter().any(|re| re.is_match(content))
}

// ── Input sanitisation ──────────────────────────────────────────────────────

/// Strip null bytes and ASCII control characters (except `\n`, `\r`, `\t`)
/// from user input.
pub fn sanitize_input(content: &str) -> String {
    content
        .chars()
        .filter(|&c| {
            if c == '\n' || c == '\r' || c == '\t' {
                return true;
            }
            // Remove null bytes and C0 control characters (U+0000..U+001F)
            // plus DEL (U+007F).
            if c == '\0' {
                return false;
            }
            if c.is_control() {
                return false;
            }
            true
        })
        .collect()
}

// ── Output sanitisation ─────────────────────────────────────────────────────

static RE_SCRIPT_TAG: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?is)<script[^>]*>.*?</script>").unwrap());

static RE_DANGEROUS_TAGS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?is)<(?:iframe|object|embed|form|style|meta|link|base|svg)[^>]*>.*?</(?:iframe|object|embed|form|style|meta|link|base|svg)>|<(?:iframe|object|embed|form|style|meta|link|base|svg)[^>]*/?>").unwrap());

static RE_EVENT_HANDLER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"(?i)\s+on\w+\s*=\s*(["'][^"']*["']|[^\s>]+)"#).unwrap());

static RE_JAVASCRIPT_URI: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"(?i)href\s*=\s*["']?\s*javascript:"#).unwrap());

static RE_DATA_URI: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"(?i)(src|href)\s*=\s*["']?\s*data:"#).unwrap());

/// Strip DeepSeek DSML internal syntax that leaks into responses.
/// Matches both fullwidth `＜｜DSML｜...＞` and ASCII `<｜DSML｜...>` variants,
/// as well as bare `<｜DSML｜` tags and entire DSML blocks.
static RE_DSML_BLOCK: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?s)<[＜]?[｜\|]DSML[｜\|][>＞]?[^<]*(?:<[＜]?/[＜]?[｜\|]DSML[｜\|][>＞]?[^<]*)*(?:<[＜]?/[＜]?[｜\|]DSML[｜\|][>＞]?)?").unwrap());

static RE_DSML_TAG: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"<[＜]?[｜\|]DSML[｜\|][^>＞]*[>＞]?").unwrap());

/// Strip dangerous HTML and model-internal syntax from AI-generated output.
pub fn sanitize_output(content: &str) -> String {
    let s = RE_SCRIPT_TAG.replace_all(content, "");
    let s = RE_DANGEROUS_TAGS.replace_all(&s, "");
    let s = RE_EVENT_HANDLER.replace_all(&s, "");
    let s = RE_JAVASCRIPT_URI.replace_all(&s, "");
    let s = RE_DATA_URI.replace_all(&s, "");
    // Strip DeepSeek DSML internal syntax
    let s = RE_DSML_BLOCK.replace_all(&s, "");
    let s = RE_DSML_TAG.replace_all(&s, "");
    s.into_owned()
}
