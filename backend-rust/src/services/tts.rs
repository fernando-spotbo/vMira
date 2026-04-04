//! TTS client — ElevenLabs (primary), GPU Silero (fallback), edge-tts (last resort).

use std::time::Duration;

use serde_json::json;

use crate::config::Config;

/// Select the best ElevenLabs voice for a given language.
/// Uses voices that sound native in each language with the multilingual model.
/// The eleven_flash_v2_5 model auto-detects language from text, so all voices
/// are multilingual — these are just optimized for natural accent.
fn elevenlabs_voice(lang: &str) -> &'static str {
    match lang {
        // Russian — "Anna" (native Russian female, warm and natural)
        "ru" => "EbJMMQmRrzJzVFliGIjm",
        // Spanish — "Laura" (native Spanish female, expressive)
        "es" => "FGY2WhTYpPnrIDTdsKH5",
        // English (default) — "Rachel" (American English female, calm and clear)
        "en" => "21m00Tcm4TlvDq8ikWAM",
        // Arabic
        "ar" => "21m00Tcm4TlvDq8ikWAM",
        // For all other languages, use Rachel with multilingual model
        // The model auto-detects language from text and adapts pronunciation
        _ => "21m00Tcm4TlvDq8ikWAM",
    }
}

/// Synthesize text to audio.
/// Tries ElevenLabs first (best quality), then GPU Silero, then edge-tts.
pub async fn synthesize(
    config: &Config,
    text: &str,
    language: &str,
) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();

    // ── Primary: ElevenLabs (cloud, high quality, multilingual) ──
    if !config.elevenlabs_api_key.is_empty() {
        let voice_id = elevenlabs_voice(language);
        let url = format!(
            "https://api.elevenlabs.io/v1/text-to-speech/{}/stream",
            voice_id
        );

        let res = client
            .post(&url)
            .header("xi-api-key", &config.elevenlabs_api_key)
            .header("Accept", "audio/mpeg")
            .json(&json!({
                "text": text,
                "model_id": "eleven_flash_v2_5",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "style": 0.0,
                    "use_speaker_boost": true
                }
            }))
            .timeout(Duration::from_secs(15))
            .send()
            .await;

        match res {
            Ok(r) if r.status().is_success() => {
                return r.bytes().await.map(|b| b.to_vec())
                    .map_err(|e| format!("ElevenLabs read error: {e}"));
            }
            Ok(r) => {
                let status = r.status();
                let body = r.text().await.unwrap_or_default();
                tracing::warn!(status = %status, body = %body, "ElevenLabs TTS failed, trying fallback");
            }
            Err(e) => {
                tracing::warn!(error = %e, "ElevenLabs TTS request failed, trying fallback");
            }
        }
    }

    // ── Fallback 1: GPU voice server (Silero TTS) ──
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

    // ── Fallback 2: edge-tts (local) ──
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
