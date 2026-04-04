use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Algorithm, Argon2, Params, Version,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use uuid::Uuid;
use zeroize::Zeroize;

use crate::config::Config;

// ── Claims ──────────────────────────────────────────────────────────────────

/// JWT claims payload.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    /// Subject — the user ID.
    pub sub: String,
    /// Token type: "access" or "refresh".
    #[serde(rename = "type")]
    pub type_: String,
    /// Expiry (seconds since epoch).
    pub exp: usize,
    /// Issued-at (seconds since epoch).
    pub iat: usize,
    /// Unique token identifier.
    pub jti: String,
}

// ── Password hashing ────────────────────────────────────────────────────────

/// Hash a password with Argon2id (memory_cost=65536 KiB, time_cost=3, parallelism=4).
pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    let params = Params::new(65536, 3, 4, None)?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut password_bytes = password.as_bytes().to_vec();
    let hash = argon2.hash_password(&password_bytes, &salt)?;
    let result = hash.to_string();
    password_bytes.zeroize();
    Ok(result)
}

/// Verify a password against an Argon2id hash.
pub fn verify_password(
    password: &str,
    hash: &str,
) -> Result<bool, argon2::password_hash::Error> {
    let parsed = PasswordHash::new(hash)?;
    let params = Params::new(65536, 3, 4, None)?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut password_bytes = password.as_bytes().to_vec();
    let result = argon2.verify_password(&password_bytes, &parsed).is_ok();
    password_bytes.zeroize();
    Ok(result)
}

// ── Token hashing ───────────────────────────────────────────────────────────

/// HMAC-SHA256 keyed hash of a token string, returned as hex.
pub fn hash_token(token: &str, secret_key: &str) -> String {
    type HmacSha256 = Hmac<Sha256>;
    let mut mac =
        HmacSha256::new_from_slice(secret_key.as_bytes()).expect("HMAC accepts any key length");
    mac.update(token.as_bytes());
    let result = mac.finalize();
    hex::encode(result.into_bytes())
}

// ── Random token generation ─────────────────────────────────────────────────

/// Generate a cryptographically random token (48 bytes, base64url-encoded).
pub fn generate_token() -> String {
    let mut buf = [0u8; 48];
    OsRng.fill_bytes(&mut buf);
    URL_SAFE_NO_PAD.encode(buf)
}

// API key generation consolidated in crate::models::api_key::generate_api_key()

// ── JWT access tokens ───────────────────────────────────────────────────────

/// Create a signed JWT access token for the given user.
pub fn create_access_token(user_id: &Uuid, config: &Config) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = now + Duration::minutes(config.access_token_expire_minutes);

    let claims = Claims {
        sub: user_id.to_string(),
        type_: "access".to_string(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
        jti: Uuid::new_v4().to_string(),
    };

    let header = Header::new(jsonwebtoken::Algorithm::HS256);
    encode(&header, &claims, &EncodingKey::from_secret(config.secret_key.as_bytes()))
}

/// Create a refresh token triple: (raw_token, hmac_hash, expires_at).
pub fn create_refresh_token(
    user_id: &Uuid,
    config: &Config,
) -> (String, String, chrono::DateTime<Utc>) {
    let _ = user_id; // user_id available for future per-user keying
    let raw = generate_token();
    let hashed = hash_token(&raw, &config.secret_key);
    let expires_at = Utc::now() + Duration::days(config.refresh_token_expire_days);
    (raw, hashed, expires_at)
}

/// Decode and validate an access token. Returns `None` if invalid or not of type "access".
pub fn decode_access_token(token: &str, config: &Config) -> Option<Claims> {
    let mut validation = Validation::new(jsonwebtoken::Algorithm::HS256);
    validation.set_required_spec_claims(&["exp", "iat", "sub"]);

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.secret_key.as_bytes()),
        &validation,
    )
    .ok()?;

    if token_data.claims.type_ != "access" {
        return None;
    }

    Some(token_data.claims)
}

// ── Hex helper (no extra crate needed) ──────────────────────────────────────

mod hex {
    /// Encode bytes as lowercase hexadecimal.
    pub fn encode(bytes: impl AsRef<[u8]>) -> String {
        bytes
            .as_ref()
            .iter()
            .fold(String::new(), |mut s, b| {
                use std::fmt::Write;
                write!(s, "{b:02x}").unwrap();
                s
            })
    }
}
