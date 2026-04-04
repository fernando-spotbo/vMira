//! Voice endpoints — TTS only. STT is handled client-side via browser
//! SpeechRecognition API. The /transcribe endpoint is kept as a stub
//! that returns 410 Gone for any remaining callers.

use axum::{
    extract::{Multipart, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::db::AppState;
use crate::middleware::auth::AuthUser;
use crate::services::tts;
use crate::services::whisper;

/// POST /api/v1/voice/transcribe
///
/// Accepts multipart audio, forwards to local Whisper service.
/// Required for browsers without SpeechRecognition (iOS Safari).
async fn transcribe(
    State(state): State<AppState>,
    _user: AuthUser,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut audio_bytes: Option<Vec<u8>> = None;
    let mut filename = "audio.webm".to_string();
    let mut content_type = "audio/webm".to_string();
    let mut language_hint: Option<String> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "audio" => {
                if let Some(ct) = field.content_type() {
                    content_type = ct.to_string();
                }
                if let Some(fname) = field.file_name() {
                    filename = fname.to_string();
                }
                match field.bytes().await {
                    Ok(bytes) => audio_bytes = Some(bytes.to_vec()),
                    Err(e) => {
                        return (StatusCode::BAD_REQUEST, Json(json!({"detail": format!("Failed to read audio: {e}")}))).into_response();
                    }
                }
            }
            "language" => {
                if let Ok(text) = field.text().await {
                    language_hint = Some(text);
                }
            }
            _ => {}
        }
    }

    let audio = match audio_bytes {
        Some(b) if b.len() > 500 => b,
        _ => {
            return (StatusCode::BAD_REQUEST, Json(json!({"detail": "No audio data provided"}))).into_response();
        }
    };

    match whisper::transcribe(&state.config, audio, filename, content_type, language_hint).await {
        Ok(result) => {
            Json(json!({
                "text": result.text,
                "language": result.language,
                "duration": result.duration,
            })).into_response()
        }
        Err(e) => {
            tracing::error!("Whisper transcription failed: {e}");
            (StatusCode::BAD_GATEWAY, Json(json!({"detail": "Transcription service unavailable"}))).into_response()
        }
    }
}

// ── TTS ──────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct SynthesizeRequest {
    text: String,
    language: Option<String>,
}

/// POST /api/v1/voice/synthesize
///
/// Accepts JSON `{ text, language? }`, returns audio/mpeg binary.
async fn synthesize(
    State(state): State<AppState>,
    _user: AuthUser,
    Json(req): Json<SynthesizeRequest>,
) -> impl IntoResponse {
    let text = req.text.trim();
    if text.is_empty() || text.len() > 2000 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"detail": "Text empty or too long"})),
        )
            .into_response();
    }

    let lang = req.language.as_deref().unwrap_or("en");

    match tts::synthesize(&state.config, text, lang).await {
        Ok(audio) => {
            // Detect format: WAV starts with "RIFF", otherwise assume MP3
            let mime = if audio.len() > 4 && &audio[..4] == b"RIFF" { "audio/wav" } else { "audio/mpeg" };
            (StatusCode::OK, [(header::CONTENT_TYPE, mime)], audio).into_response()
        }
        Err(e) => {
            tracing::error!("TTS synthesis failed: {e}");
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({"detail": "TTS service unavailable"})),
            )
                .into_response()
        }
    }
}

pub fn voice_routes() -> Router<AppState> {
    Router::new()
        .route("/transcribe", post(transcribe))
        .route("/synthesize", post(synthesize))
}
