//! Billing routes — balance, transactions, pricing, top-up, and YooKassa webhook.

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
use crate::services::payment;

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn billing_routes() -> Router<AppState> {
    Router::new()
        .route("/balance", get(get_balance))
        .route("/transactions", get(get_transactions))
        .route("/pricing", get(get_pricing))
        .route("/topup", post(create_topup))
        .route("/webhook", post(webhook))
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
    // Validate amount
    if body.amount_rubles < 1.0 {
        return Err(AppError::BadRequest(
            "Minimum top-up amount is 1.00 RUB".to_string(),
        ));
    }
    if body.amount_rubles > 100_000.0 {
        return Err(AppError::BadRequest(
            "Maximum top-up amount is 100,000.00 RUB".to_string(),
        ));
    }

    let amount_kopecks = (body.amount_rubles * 100.0).round() as i64;

    // User needs an email for fiscal receipts (54-FZ)
    let user_email = user.email.as_deref().unwrap_or_default();
    if user_email.is_empty() {
        return Err(AppError::BadRequest(
            "Email is required for payment receipts. Please add an email to your account."
                .to_string(),
        ));
    }

    let description = format!("Пополнение баланса Mira AI — {} RUB", body.amount_rubles);

    let payment_result = payment::create_payment(
        &state.config,
        user.id,
        amount_kopecks,
        &description,
        &body.return_url,
        user_email,
    )
    .await?;

    Ok(Json(TopupResponse {
        payment_url: payment_result.payment_url,
        payment_id: payment_result.payment_id,
        amount_kopecks,
    }))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /webhook (YooKassa — no auth, verified by IP)
// ═══════════════════════════════════════════════════════════════════════════

async fn webhook(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    body: String,
) -> Result<Json<serde_json::Value>, AppError> {
    // Extract client IP for verification
    let client_ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.rsplit(',').next())
        .map(|s| s.trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.trim().to_string())
        })
        .unwrap_or_else(|| "unknown".to_string());

    // In production, verify the source IP
    if !state.config.debug && !payment::verify_webhook_ip(&client_ip) {
        tracing::warn!(
            client_ip = %client_ip,
            "YooKassa webhook rejected: untrusted IP"
        );
        return Err(AppError::Forbidden(
            "Webhook source not authorized".to_string(),
        ));
    }

    payment::handle_webhook(&state.db, &state.config, &body).await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
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
