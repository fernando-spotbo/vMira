//! Payment provider abstraction layer.
//!
//! Current provider: CryptoCloud (cryptocurrency payments)
//!
//! To switch providers:
//! 1. Create `payment_<name>.rs` implementing create_payment + handle_postback
//! 2. Update config vars in `config.rs`
//! 3. Update the billing route's topup handler and webhook route
//! 4. Add webhook HMAC exemption in `hmac_verify.rs`

use crate::config::Config;

/// Common result from creating a payment.
#[derive(Debug)]
pub struct PaymentResult {
    pub payment_url: String,
    pub payment_id: String,
    pub provider: String,
}

/// Outcome of processing a webhook notification.
#[derive(Debug)]
pub enum WebhookResult {
    /// Payment processed and balance credited.
    Processed,
    /// Duplicate notification (already processed).
    Duplicate,
    /// Non-actionable status (e.g., pending, canceled).
    Ignored,
}

/// Trait that all payment providers implement.
pub trait PaymentProvider {
    /// Short identifier (e.g., "cryptocloud").
    fn name(&self) -> &'static str;

    /// Whether this provider has all required config values set.
    fn is_configured(&self, config: &Config) -> bool;
}
