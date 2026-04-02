//! Client for the local whisper STT service (localhost:8787).

use reqwest::multipart;
use serde::Deserialize;

use crate::config::Config;

#[derive(Debug, Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub language: Option<String>,
    pub duration: Option<f64>,
}

/// Send audio to the local whisper service and return transcription.
pub async fn transcribe(
    config: &Config,
    audio_bytes: Vec<u8>,
    filename: String,
    content_type: String,
    language_hint: Option<String>,
) -> Result<TranscriptionResult, String> {
    let part = multipart::Part::bytes(audio_bytes)
        .file_name(filename)
        .mime_str(&content_type)
        .map_err(|e| format!("Failed to build multipart: {e}"))?;

    let mut form = multipart::Form::new().part("audio", part);

    if let Some(lang) = language_hint {
        form = form.text("language", lang);
    }

    // Use GPU voice server if available, fall back to local Whisper
    let base_url = if config.whisper_url.is_empty() { "http://127.0.0.1:8787" } else { &config.whisper_url };
    let url = format!("{}/transcribe", base_url);

    let client = reqwest::Client::new();
    let res = client
        .post(&url)
        .multipart(form)
        .timeout(std::time::Duration::from_secs(90))
        .send()
        .await
        .map_err(|e| format!("Whisper service unavailable: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Whisper returned {status}: {body}"));
    }

    res.json::<TranscriptionResult>()
        .await
        .map_err(|e| format!("Invalid whisper response: {e}"))
}
