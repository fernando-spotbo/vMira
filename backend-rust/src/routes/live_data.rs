//! Live data endpoints — lightweight proxies for stock quotes and weather.
//!
//! GET /api/v1/live/stock/:symbol — fetch real-time stock quote
//! GET /api/v1/live/weather/:city  — fetch current weather + forecast
//!
//! No authentication required. Uses IP-based rate limiting via Redis
//! (30 requests per 60 seconds per IP) to prevent abuse.

use axum::{
    extract::{ConnectInfo, Path, Query, State},
    routing::get,
    Json, Router,
};
use std::collections::HashMap;
use std::net::SocketAddr;

use crate::db::AppState;
use crate::error::AppError;
use crate::services::rate_limit::check_rate_limit;

// ── Routes ──────────────────────────────────────────────────────────────

pub fn live_data_routes() -> Router<AppState> {
    Router::new()
        .route("/stock/{symbol}", get(get_stock))
        .route("/weather/{city}", get(get_weather_data))
}

// ── Stock ───────────────────────────────────────────────────────────────

async fn get_stock(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(symbol): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AppError> {
    rate_limit_live(&state, &addr).await?;

    let range = params.get("range").map(|s| s.as_str());
    let quote = crate::services::stock::get_stock_quote(&symbol, range)
        .await
        .map_err(|e| AppError::BadRequest(e))?;

    Ok(Json(serde_json::json!({
        "symbol": quote.symbol,
        "name": quote.name,
        "price": quote.price,
        "open": quote.open,
        "previous_close": quote.previous_close,
        "change": quote.change,
        "change_percent": quote.change_percent,
        "high": quote.high,
        "low": quote.low,
        "currency": quote.currency,
        "source": quote.source,
        "updated": quote.updated,
        "chart": quote.chart.iter().map(|c| serde_json::json!({
            "time": c.time,
            "price": c.price,
            "is_regular": c.is_regular,
        })).collect::<Vec<_>>(),
    })))
}

// ── Weather ─────────────────────────────────────────────────────────────

async fn get_weather_data(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(city): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    rate_limit_live(&state, &addr).await?;

    let w = crate::services::weather::get_weather(&city)
        .await
        .map_err(|e| AppError::BadRequest(e))?;

    Ok(Json(serde_json::json!({
        "city": w.city,
        "summary": format!("{}°C, {}", w.temperature, w.description),
        "temperature": w.temperature,
        "feels_like": w.feels_like,
        "description": w.description,
        "icon": w.icon,
        "wind": format!("{} m/s", w.wind_speed),
        "wind_gusts": w.wind_gusts.map(|v| format!("{} m/s", v)),
        "humidity": w.humidity.map(|v| format!("{}%", v)),
        "uv_index": w.uv_index,
        "precip_prob": w.precipitation_probability.map(|v| format!("{}%", v)),
        "sunrise": w.sunrise,
        "sunset": w.sunset,
        "hourly": w.hourly.iter().map(|h| serde_json::json!({
            "time": h.time,
            "temp": h.temp,
            "icon": h.icon,
            "precip": h.precip_prob,
        })).collect::<Vec<_>>(),
        "forecast": w.forecast.iter().map(|f| serde_json::json!({
            "day": f.day,
            "temp": format!("{}°/{}", f.temp_max, f.temp_min),
            "temp_max": f.temp_max,
            "temp_min": f.temp_min,
            "icon": f.icon,
            "precip_prob": f.precip_prob,
        })).collect::<Vec<_>>(),
    })))
}

// ── Rate limiting helper ────────────────────────────────────────────────

/// IP-based rate limit for live data endpoints: 30 requests per 60 seconds.
async fn rate_limit_live(state: &AppState, addr: &SocketAddr) -> Result<(), AppError> {
    let ip = addr.ip().to_string();
    let key = format!("rl:live:{ip}");

    let (allowed, _remaining) = check_rate_limit(&state.redis, &key, 30, 60)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "live data rate limit check failed");
            AppError::Internal("Rate limit service unavailable".to_string())
        })?;

    if !allowed {
        return Err(AppError::RateLimited { retry_after: 60 });
    }

    Ok(())
}
