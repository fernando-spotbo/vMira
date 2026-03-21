# ═══════════════════════════════════════════════════════════════
#  Multi-stage Rust build for the Mira API
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Build ────────────────────────────────────────────
FROM rust:1.85-slim AS builder

WORKDIR /app

# Install system dependencies for linking (OpenSSL is handled by rustls)
RUN apt-get update && apt-get install -y pkg-config && rm -rf /var/lib/apt/lists/*

# Cache dependencies: copy only manifests, create a dummy main, and build
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src

# Copy actual source and rebuild (only the application code is recompiled)
COPY src/ src/
RUN cargo build --release

# ── Stage 2: Runtime ──────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/mira-api /usr/local/bin/

EXPOSE 8000

CMD ["mira-api"]
