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

/// POST /api/v1/voice/transcribe — DEPRECATED
///
/// STT is now handled client-side via browser SpeechRecognition.
/// This endpoint returns 410 Gone.
async fn transcribe(
    _state: State<AppState>,
    _user: AuthUser,
    _multipart: Multipart,
) -> impl IntoResponse {
    (
        StatusCode::GONE,
        Json(json!({"detail": "Server-side transcription removed. Use browser speech recognition."})),
    )
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
