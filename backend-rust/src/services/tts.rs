//! Client for the local edge-tts service (OpenAI-compatible API on localhost:5100).

use std::time::Duration;

use serde_json::json;

use crate::config::Config;

/// Microsoft multilingual neural voice — speaks all languages naturally
/// from a single voice, auto-detecting language from the text.
const MULTILINGUAL_VOICE: &str = "en-US-EmmaMultilingualNeural";

/// Synthesize text to audio via the local edge-tts service.
/// Returns MP3 bytes.
pub async fn synthesize(
    config: &Config,
    text: &str,
    _language: &str,
) -> Result<Vec<u8>, String> {
    let voice = MULTILINGUAL_VOICE;
    let url = format!("{}/v1/audio/speech", config.piper_url);

    let client = reqwest::Client::new();
    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", config.piper_api_key))
        .json(&json!({
            "model": "tts-1",
            "voice": voice,
            "input": text,
            "response_format": "mp3"
        }))
        .timeout(Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| format!("TTS service unavailable: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("TTS returned {status}: {body}"));
    }

    res.bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("TTS read error: {e}"))
}
