#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Mira Backend — Production Deploy Script
# Usage: ./scripts/deploy.sh <server-ip> [domain]
# ============================================

SERVER_IP="${1:?Usage: ./scripts/deploy.sh <server-ip> [domain]}"
DOMAIN="${2:-}"
SSH_USER="root"
REMOTE_DIR="/opt/mira"

echo "=== Mira Backend Deploy ==="
echo "Server: $SERVER_IP"
echo "Remote dir: $REMOTE_DIR"
echo ""

# --- Step 1: Install Docker on remote ---
echo "[1/6] Installing Docker..."
ssh -o StrictHostKeyChecking=no "$SSH_USER@$SERVER_IP" bash <<'INSTALL_DOCKER'
if command -v docker &>/dev/null; then
    echo "Docker already installed: $(docker --version)"
else
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    echo "Docker installed: $(docker --version)"
fi
INSTALL_DOCKER

# --- Step 2: Create directory structure ---
echo "[2/6] Creating remote directory..."
ssh "$SSH_USER@$SERVER_IP" "mkdir -p $REMOTE_DIR/nginx/conf.d $REMOTE_DIR/scripts $REMOTE_DIR/alembic/versions $REMOTE_DIR/app"

# --- Step 3: Upload files ---
echo "[3/6] Uploading project files..."
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Core files
scp "$BACKEND_DIR/docker-compose.prod.yml" "$SSH_USER@$SERVER_IP:$REMOTE_DIR/docker-compose.yml"
scp "$BACKEND_DIR/Dockerfile.prod" "$SSH_USER@$SERVER_IP:$REMOTE_DIR/Dockerfile.prod"
scp "$BACKEND_DIR/requirements.txt" "$SSH_USER@$SERVER_IP:$REMOTE_DIR/requirements.txt"
scp "$BACKEND_DIR/alembic.ini" "$SSH_USER@$SERVER_IP:$REMOTE_DIR/alembic.ini"

# Nginx
scp "$BACKEND_DIR/nginx/nginx.conf" "$SSH_USER@$SERVER_IP:$REMOTE_DIR/nginx/nginx.conf"
scp "$BACKEND_DIR/nginx/conf.d/default.conf" "$SSH_USER@$SERVER_IP:$REMOTE_DIR/nginx/conf.d/default.conf"

# App source (recursive)
scp -r "$BACKEND_DIR/app/" "$SSH_USER@$SERVER_IP:$REMOTE_DIR/app/"
scp -r "$BACKEND_DIR/alembic/" "$SSH_USER@$SERVER_IP:$REMOTE_DIR/alembic/"

# --- Step 4: Generate .env.prod if not exists ---
echo "[4/6] Setting up environment..."
ssh "$SSH_USER@$SERVER_IP" bash <<'GEN_ENV'
REMOTE_DIR="/opt/mira"
if [ ! -f "$REMOTE_DIR/.env.prod" ]; then
    PG_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
    REDIS_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
    SECRET=$(openssl rand -hex 32)
    HMAC=$(openssl rand -hex 32)

    cat > "$REMOTE_DIR/.env.prod" <<EOF
DEBUG=false
API_PREFIX=/api/v1

POSTGRES_USER=mira
POSTGRES_PASSWORD=$PG_PASS
POSTGRES_DB=mira

REDIS_PASSWORD=$REDIS_PASS

SECRET_KEY=$SECRET
HMAC_SECRET=$HMAC

ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30

RATE_LIMIT_REQUESTS=60
RATE_LIMIT_LOGIN_ATTEMPTS=5
MAX_CONCURRENT_STREAMS_PER_USER=3

VK_CLIENT_ID=
VK_CLIENT_SECRET=
YANDEX_CLIENT_ID=
YANDEX_CLIENT_SECRET=
GOOGLE_CLIENT_ID=

AI_MODEL_URL=http://localhost:8080/v1
AI_MODEL_API_KEY=

ALLOWED_ORIGINS=["http://localhost:3000"]
EOF
    echo "Generated .env.prod with secure random secrets"
else
    echo ".env.prod already exists — keeping current values"
fi
GEN_ENV

# --- Step 5: Fix alembic.ini for Docker ---
echo "[5/6] Configuring Alembic..."
ssh "$SSH_USER@$SERVER_IP" bash <<'FIX_ALEMBIC'
REMOTE_DIR="/opt/mira"
# Read DB credentials from .env.prod
source <(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)=' "$REMOTE_DIR/.env.prod")
# Update alembic.ini with Docker-internal connection string
sed -i "s|^sqlalchemy.url = .*|sqlalchemy.url = postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}|" "$REMOTE_DIR/alembic.ini"
echo "Alembic configured for Docker network"
FIX_ALEMBIC

# --- Step 6: Build and start ---
echo "[6/6] Building and starting services..."
ssh "$SSH_USER@$SERVER_IP" bash <<'START'
cd /opt/mira
export $(grep -v '^#' .env.prod | xargs)

# Build and start
docker compose -f docker-compose.yml up -d --build

# Wait for DB to be ready
echo "Waiting for PostgreSQL..."
sleep 10

# Run migrations
docker compose exec -T api alembic upgrade head

echo ""
echo "=== Services Status ==="
docker compose ps
echo ""

# Test health endpoint
sleep 3
HEALTH=$(curl -sf http://localhost/health 2>/dev/null || echo '{"status":"waiting"}')
echo "Health check: $HEALTH"
START

echo ""
echo "=== Deploy complete! ==="
echo "Server: http://$SERVER_IP"
echo "Health: http://$SERVER_IP/health"
echo ""
echo "Next steps:"
echo "  1. Point your domain DNS A record to $SERVER_IP"
echo "  2. Run: ./scripts/setup-tls.sh $SERVER_IP your-domain.com"
echo "  3. Update ALLOWED_ORIGINS in .env.prod with your Vercel domain"
