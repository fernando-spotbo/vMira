//! Billing routes — balance, transactions, pricing, top-up, and CryptoCloud webhook.

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::schema::{
    BalanceResponse, ModelPricingResponse, PricingResponse, TopupRequest, TopupResponse,
    TransactionResponse,
};
use crate::services::billing;
use crate::services::payment_crypto;

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn billing_routes() -> Router<AppState> {
    Router::new()
        .route("/balance", get(get_balance))
        .route("/transactions", get(get_transactions))
        .route("/pricing", get(get_pricing))
        .route("/topup", post(create_topup))
        .route("/webhook/crypto", post(webhook_crypto))
        .route("/invoice/{id}", get(get_invoice))
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

/// Format kopecks as a ruble string: 12345 -> "123.45"
fn kopecks_to_rubles(kopecks: i64) -> String {
    let rubles = kopecks as f64 / 100.0;
    format!("{rubles:.2}")
}

fn transaction_response(tx: &crate::models::billing::Transaction) -> TransactionResponse {
    TransactionResponse {
        id: tx.id.to_string(),
        type_: tx.r#type.clone(),
        amount_kopecks: tx.amount_kopecks,
        amount_rubles: kopecks_to_rubles(tx.amount_kopecks.unsigned_abs() as i64),
        balance_after_kopecks: tx.balance_after_kopecks,
        description: tx.description.clone(),
        model: tx.model.clone(),
        input_tokens: tx.input_tokens,
        output_tokens: tx.output_tokens,
        payment_method: tx.payment_method.clone(),
        created_at: tx.created_at.to_rfc3339(),
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /balance
// ═══════════════════════════════════════════════════════════════════════════

async fn get_balance(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<BalanceResponse>, AppError> {
    let balance = billing::get_user_balance(&state.db, user.id).await?;
    let spending = billing::get_spending_summary(&state.db, user.id).await?;

    Ok(Json(BalanceResponse {
        balance_kopecks: balance,
        balance_rubles: kopecks_to_rubles(balance),
        spending,
    }))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /transactions
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct TransactionQuery {
    #[serde(default = "default_limit")]
    limit: i64,
    #[serde(default)]
    offset: i64,
    #[serde(rename = "type")]
    tx_type: Option<String>,
}

fn default_limit() -> i64 {
    50
}

async fn get_transactions(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(params): Query<TransactionQuery>,
) -> Result<Json<Vec<TransactionResponse>>, AppError> {
    let limit = params.limit.min(200).max(1);
    let offset = params.offset.max(0);

    // Validate type filter if provided
    if let Some(ref tx_type) = params.tx_type {
        match tx_type.as_str() {
            "charge" | "topup" | "refund" | "bonus" | "adjustment" => {}
            _ => {
                return Err(AppError::BadRequest(
                    "Type must be one of: charge, topup, refund, bonus, adjustment".to_string(),
                ));
            }
        }
    }

    let transactions = billing::get_user_transactions_filtered(
        &state.db,
        user.id,
        params.tx_type.as_deref(),
        limit,
        offset,
    )
    .await?;

    let response: Vec<TransactionResponse> =
        transactions.iter().map(transaction_response).collect();

    Ok(Json(response))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /pricing
// ═══════════════════════════════════════════════════════════════════════════

async fn get_pricing(
    State(state): State<AppState>,
) -> Result<Json<PricingResponse>, AppError> {
    let pricing = billing::get_all_pricing(&state.db).await?;

    let models: Vec<ModelPricingResponse> = pricing
        .iter()
        .map(|p| ModelPricingResponse {
            model: p.model.clone(),
            display_name: p.display_name.clone(),
            input_price_per_1k_rubles: kopecks_to_rubles(
                p.input_price_per_1k_kopecks as i64,
            ),
            output_price_per_1k_rubles: kopecks_to_rubles(
                p.output_price_per_1k_kopecks as i64,
            ),
            thinking_surcharge_percent: p.thinking_surcharge_percent,
            min_plan: p.min_plan.clone(),
        })
        .collect();

    Ok(Json(PricingResponse { models }))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /topup
// ═══════════════════════════════════════════════════════════════════════════

async fn create_topup(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<TopupRequest>,
) -> Result<Json<TopupResponse>, AppError> {
    // Validate amount (check NaN/Infinity before numeric comparison)
    if !body.amount_rubles.is_finite() || body.amount_rubles < 1.0 {
        return Err(AppError::BadRequest(
            "Minimum top-up amount is 1.00 RUB".to_string(),
        ));
    }
    if body.amount_rubles > 100_000.0 {
        return Err(AppError::BadRequest(
            "Maximum top-up amount is 100,000.00 RUB".to_string(),
        ));
    }

    // Use string formatting to avoid f64 precision loss in monetary conversion
    let amount_kopecks = {
        let s = format!("{:.2}", body.amount_rubles);
        let parts: Vec<&str> = s.split('.').collect();
        let rubles: i64 = parts[0].parse().unwrap_or(0);
        let kopecks: i64 = parts.get(1).unwrap_or(&"00").parse().unwrap_or(0);
        rubles * 100 + kopecks
    };

    let result = payment_crypto::create_payment(
        &state.config,
        user.id,
        amount_kopecks,
        user.email.as_deref(),
    )
    .await?;

    Ok(Json(TopupResponse {
        payment_url: result.payment_url,
        payment_id: result.payment_id,
        amount_kopecks,
        provider: result.provider,
    }))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /webhook/crypto (CryptoCloud — verified by JWT token)
// ═══════════════════════════════════════════════════════════════════════════

async fn webhook_crypto(
    State(state): State<AppState>,
    Json(postback): Json<payment_crypto::CryptoCloudPostback>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = payment_crypto::handle_postback(&state.db, &state.config, &state.redis, &postback).await?;

    tracing::info!(result = ?result, "CryptoCloud webhook processed");

    Ok(Json(serde_json::json!({ "message": "Postback received" })))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /invoice/:id
// ═══════════════════════════════════════════════════════════════════════════

async fn get_invoice(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<TransactionResponse>, AppError> {
    let tx = billing::get_transaction(&state.db, id, user.id).await?;
    Ok(Json(transaction_response(&tx)))
}
