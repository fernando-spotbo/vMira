//! Voice endpoints — TTS, STT, and WebSocket proxy to Pipecat voice pipeline.

use axum::{
    extract::{ws::{Message, WebSocket}, Multipart, Query, State, WebSocketUpgrade},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::db::AppState;
use crate::middleware::auth::AuthUser;
use crate::services::tts;
use crate::services::whisper;

// ── REST endpoints (kept for non-voice-call use) ────────────────────────────

/// POST /api/v1/voice/transcribe — multipart audio → Whisper STT
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

#[derive(Deserialize)]
struct SynthesizeRequest {
    text: String,
    language: Option<String>,
}

/// POST /api/v1/voice/synthesize — JSON { text, language? } → audio bytes
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

// ── WebSocket proxy to Pipecat voice pipeline ───────────────────────────────

#[derive(Deserialize)]
struct VoiceWsQuery {
    /// Conversation ID (optional — pipeline can create one)
    conv_id: Option<String>,
    /// Language hint for TTS voice selection
    lang: Option<String>,
}

/// GET /api/v1/voice/ws — WebSocket upgrade, proxied to Pipecat pipeline
///
/// Authenticates the user, then establishes a bidirectional WebSocket proxy
/// between the browser and the Pipecat voice pipeline on the GPU server.
async fn voice_ws_handler(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<VoiceWsQuery>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let pipeline_url = format!(
        "ws://{}",
        std::env::var("VOICE_PIPELINE_URL").unwrap_or_else(|_| "127.0.0.1:8095".to_string())
    );

    // Pass user context to the pipeline as query params
    let lang = query.lang.unwrap_or_else(|| "en".to_string());
    let conv_id = query.conv_id.unwrap_or_default();
    let upstream_url = format!(
        "{}?user_id={}&lang={}&conv_id={}",
        pipeline_url, user.id, lang, conv_id
    );

    tracing::info!(user_id = %user.id, "Voice WebSocket upgrade, proxying to pipeline");

    ws.on_upgrade(move |client_ws| proxy_websocket(client_ws, upstream_url))
}

/// Bidirectional WebSocket proxy: browser ↔ Pipecat pipeline
async fn proxy_websocket(client_ws: WebSocket, upstream_url: String) {
    // Connect to the Pipecat pipeline
    let upstream = match tokio_tungstenite::connect_async(&upstream_url).await {
        Ok((ws, _)) => ws,
        Err(e) => {
            tracing::error!(error = %e, "Failed to connect to voice pipeline");
            return;
        }
    };

    let (mut client_tx, mut client_rx) = client_ws.split();
    let (mut upstream_tx, mut upstream_rx) = upstream.split();

    // Client (axum) → Pipeline (tungstenite)
    let client_to_upstream = async {
        while let Some(Ok(msg)) = client_rx.next().await {
            let upstream_msg = match msg {
                Message::Text(t) => {
                    let s: String = t.to_string();
                    Some(tokio_tungstenite::tungstenite::Message::text(s))
                }
                Message::Binary(b) => {
                    let v: Vec<u8> = b.to_vec();
                    Some(tokio_tungstenite::tungstenite::Message::binary(v))
                }
                Message::Ping(p) => Some(tokio_tungstenite::tungstenite::Message::Ping(p.to_vec().into())),
                Message::Close(_) => None,
                _ => continue,
            };
            if let Some(m) = upstream_msg {
                if upstream_tx.send(m).await.is_err() { break; }
            } else {
                break;
            }
        }
    };

    // Pipeline (tungstenite) → Client (axum)
    let upstream_to_client = async {
        while let Some(Ok(msg)) = upstream_rx.next().await {
            let client_msg = match msg {
                tokio_tungstenite::tungstenite::Message::Text(t) => {
                    Some(Message::Text(t.as_str().to_owned().into()))
                }
                tokio_tungstenite::tungstenite::Message::Binary(b) => {
                    Some(Message::Binary(Vec::from(b).into()))
                }
                tokio_tungstenite::tungstenite::Message::Ping(p) => Some(Message::Ping(Vec::from(p).into())),
                tokio_tungstenite::tungstenite::Message::Close(_) => None,
                _ => continue,
            };
            if let Some(m) = client_msg {
                if client_tx.send(m).await.is_err() { break; }
            } else {
                break;
            }
        }
    };

    // Run both directions concurrently — when either ends, both stop
    tokio::select! {
        _ = client_to_upstream => {}
        _ = upstream_to_client => {}
    }

    tracing::info!("Voice WebSocket session ended");
}

// ── Router ──────────────────────────────────────────────────────────────────

pub fn voice_routes() -> Router<AppState> {
    Router::new()
        .route("/transcribe", post(transcribe))
        .route("/synthesize", post(synthesize))
        .route("/ws", get(voice_ws_handler))
}
