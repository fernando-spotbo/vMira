//! Content moderation — Russian legal compliance (149-FZ) and prompt-injection
//! detection.  Uses pre-compiled regex patterns for performance.

use std::collections::HashMap;
use std::sync::LazyLock;

use regex::{Regex, RegexSet};
use unicode_normalization::UnicodeNormalization;

// ── Result type ─────────────────────────────────────────────────────────────

/// Outcome of a moderation check.
#[derive(Debug, Clone)]
pub struct ModerationResult {
    /// Whether the content was blocked.
    pub blocked: bool,
    /// Category that triggered the block (e.g. "drugs", "extremism").
    pub category: Option<String>,
    /// Human-readable reason.
    pub reason: Option<String>,
    /// Confidence / severity score in `[0.0, 1.0]`.
    pub score: f64,
}

impl ModerationResult {
    fn pass() -> Self {
        Self {
            blocked: false,
            category: None,
            reason: None,
            score: 0.0,
        }
    }

    fn block(category: &str, reason: &str, score: f64) -> Self {
        Self {
            blocked: true,
            category: Some(category.to_string()),
            reason: Some(reason.to_string()),
            score,
        }
    }
}

// ── Block messages ──────────────────────────────────────────────────────────

static BLOCK_MESSAGES: LazyLock<HashMap<&'static str, &'static str>> = LazyLock::new(|| {
    let mut m = HashMap::new();
    m.insert(
        "ru",
        "Извините, я не могу помочь с этим запросом. Он содержит контент, запрещённый законодательством Российской Федерации.",
    );
    m.insert(
        "en",
        "Sorry, I cannot help with this request. It contains content prohibited under Russian Federation law.",
    );
    m
});

/// Retrieve the block message for a given language code (`"ru"` or `"en"`).
pub fn block_message(lang: &str) -> &'static str {
    BLOCK_MESSAGES.get(lang).unwrap_or(BLOCK_MESSAGES.get("en").unwrap())
}

// ── Text normalisation ──────────────────────────────────────────────────────

/// Normalise text to defeat evasion techniques (mixed scripts, leetspeak,
/// zero-width insertions, repeated characters, etc.).
pub fn normalize_text(text: &str) -> String {
    // 1. Unicode NFKC
    let mut s: String = text.nfkc().collect();

    // 2. Remove zero-width characters
    s = s.replace('\u{200B}', "");
    s = s.replace('\u{200C}', "");
    s = s.replace('\u{200D}', "");
    s = s.replace('\u{FEFF}', "");

    // 3. Latin-to-Cyrillic lookalike substitution (lowercase only; we lowercase
    //    at the end, so apply to both cases).
    let latin_to_cyrillic: &[(char, char)] = &[
        ('a', '\u{0430}'), // а
        ('A', '\u{0410}'),
        ('e', '\u{0435}'), // е
        ('E', '\u{0415}'),
        ('o', '\u{043E}'), // о
        ('O', '\u{041E}'),
        ('p', '\u{0440}'), // р
        ('P', '\u{0420}'),
        ('c', '\u{0441}'), // с
        ('C', '\u{0421}'),
        ('x', '\u{0445}'), // х
        ('X', '\u{0425}'),
        ('y', '\u{0443}'), // у
        ('Y', '\u{0423}'),
        ('k', '\u{043A}'), // к
        ('K', '\u{041A}'),
        ('H', '\u{041D}'), // Н
        ('B', '\u{0412}'), // В
        ('M', '\u{041C}'), // М
        ('T', '\u{0422}'), // Т
    ];
    for &(lat, cyr) in latin_to_cyrillic {
        s = s.replace(lat, &cyr.to_string());
    }

    // 4. Remove punctuation inserted between Cyrillic letters (evasion: "н.а.р.к.о")
    static RE_PUNCT_BETWEEN: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"(?P<a>[\p{Cyrillic}])[.\-_*!@#$%^&()]+(?P<b>[\p{Cyrillic}])").unwrap()
    });
    // Apply repeatedly because the regex consumes one pair at a time.
    loop {
        let next = RE_PUNCT_BETWEEN.replace_all(&s, "${a}${b}").to_string();
        if next == s {
            break;
        }
        s = next;
    }

    // 5. Collapse repeated characters (3+ → 2)
    // Rust regex doesn't support backreferences, so we do it manually
    {
        let mut collapsed = String::with_capacity(s.len());
        let mut chars = s.chars().peekable();
        while let Some(c) = chars.next() {
            collapsed.push(c);
            let mut count = 1;
            while chars.peek() == Some(&c) {
                chars.next();
                count += 1;
                if count <= 2 {
                    collapsed.push(c);
                }
            }
        }
        s = collapsed;
    }

    // 6. Leetspeak to Cyrillic
    let leet: &[(char, char)] = &[
        ('0', '\u{043E}'), // о
        ('3', '\u{0437}'), // з
        ('4', '\u{0447}'), // ч
        ('6', '\u{0431}'), // б
        ('9', '\u{0434}'), // д (visual similarity in some fonts)
    ];
    for &(digit, cyr) in leet {
        s = s.replace(digit, &cyr.to_string());
    }

    // 7. Lowercase
    s.to_lowercase()
}

// ── Legal-category patterns (149-FZ) ────────────────────────────────────────

/// Category names, indexed the same as `LEGAL_REGEX_SET`.
static LEGAL_CATEGORIES: &[&str] = &[
    "drugs",
    "suicide",
    "extremism",
    "child_abuse",
    "unsanctioned_actions",
];

/// Individual compiled patterns (one per category), used to extract the matching
/// category after the `RegexSet` signals a hit.
static LEGAL_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    LEGAL_PATTERN_STRINGS
        .iter()
        .map(|p| Regex::new(&format!("(?i){p}")).unwrap())
        .collect()
});

/// Raw pattern strings shared between the `RegexSet` and the individual `Regex`.
static LEGAL_PATTERN_STRINGS: &[&str] = &[
    // drugs
    r"(как\s+(приготовить|сделать|варить|купить|достать|синтезировать)\s+(наркотик|мефедрон|амфетамин|героин|кокаин|марихуан|гашиш|спайс|соль|метамфетамин|лсд|экстази)|закладк[аиу]|барыг[аиу]|синтез\s+наркотик|рецепт\s+наркотик|как\s+сварить\s+мет|как\s+вырастить\s+коноп)",
    // suicide
    r"(как\s+(покончить|повеситься|убить\s+себя|отравиться|перерезать\s+вены|утопиться|выброситься)|суицид\s+метод|способ\s+(суицида|самоубийства)|эвтанази\w+\s+дом|безболезненн\w+\s+(смерть|уйти|умереть)|летальн\w+\s+доз)",
    // extremism
    r"(как\s+(сделать|собрать|изготовить)\s+(бомбу|взрывчатк|взрывно)|призыв\w*\s+к\s+(терроризм|экстремизм|свержени|насильственн)|джихад|слава\s+игил|хайль|зиг\s+хайль|белая\s+раса\s+превосход)",
    // child_abuse
    r"(детск\w*\s+порн|цп\b|малолетк\w*\s+секс|совращени\w*\s+несовершеннолетн|секс\w*\s+с\s+(ребенк|ребёнк|детьм|подростк|малолетн)|педофил\w*\s+(контент|материал|фото|видео))",
    // unsanctioned_actions
    r"(призыв\w*\s+к\s+(митинг|протест|бунт|восстани|беспорядк)|выходи\w*\s+на\s+(улиц|площад)|координац\w*\s+(акци|протест)\s+без\s+разрешени)",
];

/// Fast pre-filter: if no pattern matches, we skip the per-category loop.
static LEGAL_REGEX_SET: LazyLock<RegexSet> = LazyLock::new(|| {
    let pats: Vec<String> = LEGAL_PATTERN_STRINGS
        .iter()
        .map(|p| format!("(?i){p}"))
        .collect();
    RegexSet::new(pats).unwrap()
});

// ── Prompt-injection patterns ───────────────────────────────────────────────

static INJECTION_PATTERN_STRINGS: &[&str] = &[
    // English injection patterns
    r"(?i)(ignore\s+(all\s+)?previous\s+instructions)",
    r"(?i)(you\s+are\s+now\s+(in\s+)?(\w+\s+)?mode)",
    r"(?i)(system\s*:\s*you\s+are)",
    r"(?i)(forget\s+(all\s+)?(your\s+)?(previous\s+)?instructions)",
    r"(?i)(override\s+(your\s+)?(system\s+)?(prompt|instructions))",
    r"(?i)(do\s+not\s+follow\s+(your\s+)?(original\s+)?instructions)",
    r"(?i)(disregard\s+(all\s+)?(prior|previous)\s+)",
    r"(?i)(jailbreak|DAN\s*mode|developer\s+mode\s+enabled)",
    // Russian injection patterns
    r"(?i)(игнорируй\s+(все\s+)?предыдущие\s+инструкции)",
    r"(?i)(забудь\s+(все\s+)?(предыдущие\s+)?инструкции)",
    r"(?i)(ты\s+теперь\s+в\s+режиме)",
    r"(?i)(отмени\s+(все\s+)?(системные\s+)?ограничения)",
    r"(?i)(переопредели\s+(свои\s+)?(системные\s+)?инструкции)",
];

static INJECTION_REGEX_SET: LazyLock<RegexSet> = LazyLock::new(|| {
    RegexSet::new(INJECTION_PATTERN_STRINGS).unwrap()
});

// ── Public API ──────────────────────────────────────────────────────────────

/// Moderate user input: check legal categories and prompt-injection attempts.
pub fn moderate_input(text: &str) -> ModerationResult {
    let normalised = normalize_text(text);

    // 1. Legal category check
    if let Some(result) = check_legal_categories(&normalised) {
        return result;
    }

    // 2. Prompt injection check (against original text to catch English patterns)
    if INJECTION_REGEX_SET.is_match(text) || INJECTION_REGEX_SET.is_match(&normalised) {
        return ModerationResult::block(
            "prompt_injection",
            "Обнаружена попытка манипуляции системными инструкциями.",
            1.0,
        );
    }

    ModerationResult::pass()
}

/// Moderate AI output: check legal categories only (injection is input-side).
pub fn moderate_output(text: &str) -> ModerationResult {
    let normalised = normalize_text(text);

    if let Some(result) = check_legal_categories(&normalised) {
        return result;
    }

    ModerationResult::pass()
}

/// Check the normalised text against all 149-FZ legal categories.
fn check_legal_categories(normalised: &str) -> Option<ModerationResult> {
    let matches: Vec<usize> = LEGAL_REGEX_SET.matches(normalised).into_iter().collect();
    if matches.is_empty() {
        return None;
    }

    // Return the first matching category.
    for &idx in &matches {
        if LEGAL_PATTERNS[idx].is_match(normalised) {
            let category = LEGAL_CATEGORIES[idx];
            let reason = format!(
                "Контент заблокирован: категория «{}» (149-ФЗ)",
                category
            );
            return Some(ModerationResult::block(category, &reason, 1.0));
        }
    }

    None
}
