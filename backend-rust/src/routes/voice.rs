//! Voice endpoints — STT (whisper) and TTS (piper).

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
use crate::services::{tts, whisper};

/// POST /api/v1/voice/transcribe
///
/// Accepts multipart form with `audio` file + optional `language` hint.
/// Returns `{ text, language, duration }`.
async fn transcribe(
    State(state): State<AppState>,
    _user: AuthUser,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut audio_bytes: Option<Vec<u8>> = None;
    let mut filename = "audio.webm".to_string();
    let mut content_type = "audio/webm".to_string();
    let mut language_hint: Option<String> = None;

    // Parse multipart fields
    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "audio" | "file" => {
                if let Some(ct) = field.content_type() {
                    content_type = ct.to_string();
                }
                if let Some(fname) = field.file_name() {
                    filename = fname.to_string();
                }
                match field.bytes().await {
                    Ok(data) => {
                        // 25MB limit
                        if data.len() > 25 * 1024 * 1024 {
                            return (
                                StatusCode::PAYLOAD_TOO_LARGE,
                                Json(json!({"detail": "Audio too large"})),
                            );
                        }
                        audio_bytes = Some(data.to_vec());
                    }
                    Err(_) => {
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(json!({"detail": "Failed to read audio data"})),
                        );
                    }
                }
            }
            "language" => {
                if let Ok(text) = field.text().await {
                    if !text.is_empty() {
                        language_hint = Some(text);
                    }
                }
            }
            _ => {} // ignore unknown fields
        }
    }

    let audio = match audio_bytes {
        Some(data) if !data.is_empty() => data,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"detail": "No audio data"})),
            );
        }
    };

    match whisper::transcribe(&state.config, audio, filename, content_type, language_hint).await {
        Ok(result) => (
            StatusCode::OK,
            Json(json!({
                "text": result.text,
                "language": result.language,
                "duration": result.duration,
            })),
        ),
        Err(e) => {
            tracing::error!("Whisper transcription failed: {e}");
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({"detail": "Transcription service unavailable"})),
            )
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
