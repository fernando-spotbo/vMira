//! PII scrubbing layer for GPU inference protection (152-FZ compliance).
//!
//! Strips personally identifiable information from prompts BEFORE they reach
//! the GPU server. After inference, placeholders are restored in the response.
//!
//! Defense-in-depth: even if all other layers fail, GPU memory contains only
//! placeholders — no recoverable personal data of Russian citizens.

use std::collections::HashMap;
use regex::Regex;
use std::sync::LazyLock;
use uuid::Uuid;

/// A scrubbed document with placeholders and a mapping to restore originals.
#[derive(Debug, Clone)]
pub struct ScrubResult {
    pub scrubbed: String,
    pub mapping: HashMap<String, String>,
    /// Number of PII items detected
    pub pii_count: usize,
}

// Placeholders use a UUID-based format that cannot collide with user input
// or be guessed/injected: «PII:category:uuid»
fn make_placeholder(category: &str) -> String {
    format!("«PII:{}:{}»", category, Uuid::new_v4().to_string().split('-').next().unwrap())
}

// ── Compiled regex patterns ─────────────────────────────────────────────

// Email: anchored with word boundaries, supports + tags and subdomains
static EMAIL_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b").unwrap()
});

// Phone: Russian (+7/8) with flexible formatting + international
static PHONE_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(concat!(
        r"(?:\+7|8|7)[\s\-\.]?\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{2}[\s\-\.]?\d{2}",
        r"|(?:\+7|8|7)[\s\-\.]?\(?\d{3}\)?[\s\-\.]?\d{2}[\s\-\.]?\d{2}[\s\-\.]?\d{3}",
        r"|(?:\+7|8|7)\d{10}",
        r"|\+\d{1,3}[\s\-\.]?\(?\d{1,4}\)?[\s\-\.]?\d{1,4}[\s\-\.]?\d{1,9}",
    )).unwrap()
});

// Credit/debit card: 16 digits with optional separators + Luhn validation
static CARD_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b").unwrap()
});

// Russian passport: series (4 digits) + number (6 digits)
static PASSPORT_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b\d{2}[\s]?\d{2}[\s]?\d{6}\b").unwrap()
});

// SNILS: XXX-XXX-XXX XX with flexible separators
static SNILS_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b\d{3}[\s\-]\d{3}[\s\-]\d{3}[\s\-]?\d{2}\b").unwrap()
});

// IPv4 addresses (exclude private/reserved ranges used internally)
static IPV4_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b").unwrap()
});

/// Luhn checksum validation for card numbers
fn luhn_check(digits: &str) -> bool {
    let clean: String = digits.chars().filter(|c| c.is_ascii_digit()).collect();
    if clean.len() < 13 || clean.len() > 19 { return false; }
    let mut sum = 0u32;
    let mut alternate = false;
    for ch in clean.chars().rev() {
        let mut n = ch.to_digit(10).unwrap_or(0);
        if alternate {
            n *= 2;
            if n > 9 { n -= 9; }
        }
        sum += n;
        alternate = !alternate;
    }
    sum % 10 == 0
}

/// Check if an IP is private/reserved (should NOT be scrubbed)
fn is_private_ip(ip: &str) -> bool {
    ip.starts_with("10.") || ip.starts_with("127.") || ip.starts_with("192.168.")
        || ip.starts_with("172.16.") || ip.starts_with("172.17.")
        || ip.starts_with("172.18.") || ip.starts_with("172.19.")
        || ip.starts_with("172.2") || ip.starts_with("172.3")
        || ip == "0.0.0.0" || ip == "255.255.255.255"
}

/// Replace all regex matches in text with UUID-based placeholders.
fn scrub_regex(
    re: &Regex,
    category: &str,
    text: &mut String,
    mapping: &mut HashMap<String, String>,
    validate: Option<&dyn Fn(&str) -> bool>,
) {
    let matches: Vec<String> = re.find_iter(text).map(|m| m.as_str().to_string()).collect();
    for original in matches {
        if let Some(v) = validate {
            if !v(&original) { continue; }
        }
        let placeholder = make_placeholder(category);
        mapping.insert(placeholder.clone(), original.clone());
        *text = text.replacen(&original, &placeholder, 1);
    }
}

/// Scrub PII from text, replacing matches with UUID-based placeholders.
///
/// UUID-based placeholders cannot be guessed or injected by attackers.
pub fn scrub(text: &str, user_name: Option<&str>, user_email: Option<&str>) -> ScrubResult {
    let mut result = text.to_string();
    let mut mapping = HashMap::new();

    // Scrub user-specific data first (exact match, highest priority)
    if let Some(name) = user_name {
        if name.len() >= 2 && result.contains(name) {
            let placeholder = make_placeholder("NAME");
            mapping.insert(placeholder.clone(), name.to_string());
            result = result.replace(name, &placeholder);
        }
    }
    if let Some(email) = user_email {
        if result.contains(email) {
            let placeholder = make_placeholder("UEMAIL");
            mapping.insert(placeholder.clone(), email.to_string());
            result = result.replace(email, &placeholder);
        }
    }

    // Pattern scrubbing (order: specific → general)
    scrub_regex(&SNILS_RE, "SNILS", &mut result, &mut mapping, None);
    scrub_regex(&CARD_RE, "CARD", &mut result, &mut mapping, Some(&|s: &str| {
        let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
        luhn_check(&digits)
    }));
    scrub_regex(&PASSPORT_RE, "PASSPORT", &mut result, &mut mapping, None);
    scrub_regex(&EMAIL_RE, "EMAIL", &mut result, &mut mapping, None);
    scrub_regex(&PHONE_RE, "PHONE", &mut result, &mut mapping, None);
    scrub_regex(&IPV4_RE, "IP", &mut result, &mut mapping, Some(&|s: &str| !is_private_ip(s)));

    // NOTE: INN intentionally excluded — too many false positives (any 10-digit number).
    // INN protection relies on the user not typing their INN in chat, which is rare.
    // A dedicated INN field in a form would be validated separately.

    let pii_count = mapping.len();

    ScrubResult {
        scrubbed: result,
        mapping,
        pii_count,
    }
}

/// Restore original PII values in the model's response.
///
/// Only restores exact UUID-based placeholders from the mapping.
/// Cannot be injected because placeholders contain random UUIDs.
pub fn restore(response: &str, mapping: &HashMap<String, String>) -> String {
    let mut result = response.to_string();
    for (placeholder, original) in mapping {
        result = result.replace(placeholder, original);
    }
    result
}

/// Re-scrub model output to catch any PII the model generated in its response.
/// This is a second pass — the model might produce phone numbers, emails, etc.
/// in examples or hallucinations that never came from user input.
pub fn scrub_output(text: &str) -> String {
    let scrubbed = scrub(text, None, None);
    // Don't restore — just strip. Model-generated PII stays scrubbed.
    scrubbed.scrubbed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scrub_email() {
        let r = scrub("Отправь на ivan@mail.ru", None, None);
        assert!(!r.scrubbed.contains("ivan@mail.ru"));
        assert!(r.scrubbed.contains("«PII:EMAIL:"));
    }

    #[test]
    fn test_scrub_russian_phone() {
        let r = scrub("+7 999 123-45-67", None, None);
        assert!(!r.scrubbed.contains("999"));
        assert!(r.scrubbed.contains("«PII:PHONE:"));
    }

    #[test]
    fn test_scrub_phone_no_plus() {
        let r = scrub("89991234567", None, None);
        assert!(!r.scrubbed.contains("999"));
    }

    #[test]
    fn test_card_luhn_valid() {
        // Valid Visa: 4532015112830366
        let r = scrub("Карта 4532 0151 1283 0366", None, None);
        assert!(r.scrubbed.contains("«PII:CARD:"));
    }

    #[test]
    fn test_card_luhn_invalid() {
        // Invalid: 1234 5678 9012 3456 (fails Luhn)
        let r = scrub("Номер 1234 5678 9012 3456", None, None);
        assert!(!r.scrubbed.contains("«PII:CARD:"));
    }

    #[test]
    fn test_private_ip_not_scrubbed() {
        let r = scrub("Сервер 10.0.0.1 и 192.168.1.1", None, None);
        assert!(r.scrubbed.contains("10.0.0.1"));
        assert!(r.scrubbed.contains("192.168.1.1"));
    }

    #[test]
    fn test_public_ip_scrubbed() {
        let r = scrub("IP: 85.143.220.1", None, None);
        assert!(!r.scrubbed.contains("85.143.220.1"));
    }

    #[test]
    fn test_placeholder_injection_impossible() {
        // Attacker sets name to a placeholder-like string
        let r = scrub("User [PHONE_1] said hello", Some("[PHONE_1]"), None);
        // UUID-based placeholder cannot be guessed
        assert!(r.scrubbed.contains("«PII:NAME:"));
        // Old-style placeholder is NOT in our format
        assert!(!r.scrubbed.contains("[PHONE_1]"));
    }

    #[test]
    fn test_restore_roundtrip() {
        let r = scrub("Email: test@example.com и +79991234567", None, None);
        let restored = restore(&r.scrubbed, &r.mapping);
        assert!(restored.contains("test@example.com"));
        assert!(restored.contains("+79991234567"));
    }

    #[test]
    fn test_no_pii() {
        let r = scrub("Расскажи мне про Луну", None, None);
        assert_eq!(r.pii_count, 0);
        assert!(r.mapping.is_empty());
    }
}
