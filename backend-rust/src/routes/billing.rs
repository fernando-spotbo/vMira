//! Billing routes — subscriptions, balance top-up, transactions, and CryptoCloud webhook.

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::Duration;
use serde::Deserialize;
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::schema::{
    BalanceResponse, ModelPricingResponse, PricingResponse, SubscribeRequest, SubscribeResponse,
    TopupRequest, TopupResponse, TransactionResponse,
};
use crate::services::billing;
use crate::services::payment_crypto;
use crate::services::refund;
use crate::services::subscription;

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn billing_routes() -> Router<AppState> {
    Router::new()
        .route("/balance", get(get_balance))
        .route("/transactions", get(get_transactions))
        .route("/pricing", get(get_pricing))
        .route("/subscribe", post(create_subscription))
        .route("/refund", post(request_refund))
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
//  POST /subscribe — Create a subscription (chat or code)
// ═══════════════════════════════════════════════════════════════════════════

async fn create_subscription(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<SubscribeRequest>,
) -> Result<Json<SubscribeResponse>, AppError> {
    // Validate product
    match body.product.as_str() {
        "chat" | "code" => {}
        _ => return Err(AppError::BadRequest("Product must be 'chat' or 'code'".to_string())),
    }

    // Validate plan
    match body.plan.as_str() {
        "pro" | "max" => {}
        _ => return Err(AppError::BadRequest("Plan must be 'pro' or 'max'".to_string())),
    }

    // Anti-abuse: check refund cooldown (30 days after refund before re-subscribing)
    if !refund::can_subscribe(&state.db, user.id, &body.product).await? {
        return Err(AppError::BadRequest(
            "Subscription unavailable: 30-day cooldown after refund. Contact support for assistance.".to_string()
        ));
    }

    // Get price
    let amount_kopecks = subscription::subscription_price(&body.product, &body.plan)?;
    let amount_rubles = amount_kopecks as f64 / 100.0;

    // Encode subscription info in the order_id for webhook processing
    let order_id = format!("sub-{}-{}-{}-{}", body.product, body.plan, user.id, Uuid::new_v4());

    // Create CryptoCloud invoice
    if state.config.cryptocloud_api_key.is_empty() || state.config.cryptocloud_shop_id.is_empty() {
        return Err(AppError::Internal("Payment system not configured".to_string()));
    }

    let invoice_body = serde_json::json!({
        "shop_id": state.config.cryptocloud_shop_id,
        "amount": amount_rubles,
        "currency": "RUB",
        "order_id": order_id,
        "email": user.email,
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.cryptocloud.plus/v2/invoice/create")
        .header("Authorization", format!("Token {}", state.config.cryptocloud_api_key))
        .header("Content-Type", "application/json")
        .json(&invoice_body)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "CryptoCloud API request failed");
            AppError::Internal("Payment service unavailable".to_string())
        })?;

    if !response.status().is_success() {
        let error_body = response.text().await.unwrap_or_default();
        tracing::error!(body = %error_body, "CryptoCloud API error");
        return Err(AppError::Internal("Payment creation failed".to_string()));
    }

    let cc_response: serde_json::Value = response.json().await.map_err(|e| {
        tracing::error!(error = %e, "Failed to parse CryptoCloud response");
        AppError::Internal("Payment service error".to_string())
    })?;

    let payment_url = cc_response["result"]["link"]
        .as_str()
        .ok_or_else(|| AppError::Internal("No payment URL in response".to_string()))?
        .to_string();

    let payment_id = cc_response["result"]["uuid"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();

    let expires_at = (chrono::Utc::now() + Duration::days(30)).to_rfc3339();

    tracing::info!(
        user_id = %user.id,
        product = %body.product,
        plan = %body.plan,
        amount_kopecks = %amount_kopecks,
        "Subscription invoice created"
    );

    Ok(Json(SubscribeResponse {
        payment_url,
        payment_id,
        product: body.product,
        plan: body.plan,
        amount_kopecks,
        expires_at,
    }))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /refund — Request subscription refund (sends crypto to user wallet)
// ═══════════════════════════════════════════════════════════════════════════

async fn request_refund(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<crate::schema::RefundRequest>,
) -> Result<Json<crate::schema::RefundResponse>, AppError> {
    let result = refund::process_refund(
        &state.db,
        &state.config,
        user.id,
        body.subscription_id,
        &body.wallet_address,
        body.currency.as_deref(),
    )
    .await?;

    Ok(Json(crate::schema::RefundResponse {
        refund_kopecks: result.refund_kopecks,
        refund_rubles: kopecks_to_rubles(result.refund_kopecks),
        usdt_amount: result.usdt_amount,
        currency: result.currency,
        wallet_address: result.wallet_address,
        withdrawal_id: result.withdrawal_id,
        days_used: result.days_used,
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
