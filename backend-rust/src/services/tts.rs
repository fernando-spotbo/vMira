//! TTS client — supports GPU Silero (primary) and edge-tts (fallback).

use std::time::Duration;

use serde_json::json;

use crate::config::Config;

/// Synthesize text to audio.
/// Tries GPU voice server (Silero, returns WAV) first, falls back to edge-tts (MP3).
pub async fn synthesize(
    config: &Config,
    text: &str,
    language: &str,
) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();

    // Primary: GPU voice server (Silero TTS) — fast, natural Russian voice
    let gpu_url = format!("{}/synthesize", config.piper_url);
    let gpu_res = client
        .post(&gpu_url)
        .json(&json!({
            "text": text,
            "language": language,
        }))
        .timeout(Duration::from_secs(30))
        .send()
        .await;

    if let Ok(res) = gpu_res {
        if res.status().is_success() {
            return res.bytes().await.map(|b| b.to_vec())
                .map_err(|e| format!("TTS read error: {e}"));
        }
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        tracing::warn!(status = %status, body = %body, "GPU TTS failed, trying edge-tts fallback");
    }

    // Fallback: edge-tts on Aeza VPS (slower but reliable)
    let fallback_url = "http://127.0.0.1:5100/v1/audio/speech";
    let res = client
        .post(fallback_url)
        .header("Authorization", format!("Bearer {}", config.piper_api_key))
        .json(&json!({
            "model": "tts-1",
            "voice": "en-US-EmmaMultilingualNeural",
            "input": text,
            "response_format": "mp3"
        }))
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("TTS fallback unavailable: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("TTS returned {status}: {body}"));
    }

    res.bytes().await.map(|b| b.to_vec())
        .map_err(|e| format!("TTS read error: {e}"))
}
