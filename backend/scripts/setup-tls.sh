#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Mira Backend — TLS Setup with Let's Encrypt
# Usage: ./scripts/setup-tls.sh <server-ip> <domain> [email]
# ============================================

SERVER_IP="${1:?Usage: ./scripts/setup-tls.sh <server-ip> <domain> [email]}"
DOMAIN="${2:?Usage: ./scripts/setup-tls.sh <server-ip> <domain> [email]}"
EMAIL="${3:-admin@$DOMAIN}"
SSH_USER="root"

echo "=== TLS Setup for $DOMAIN ==="

ssh "$SSH_USER@$SERVER_IP" bash <<REMOTE
cd /opt/mira

# Obtain certificate
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d $DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --non-interactive

# Update nginx config: enable HTTPS, redirect HTTP
sed -i 's|# server_name YOUR_DOMAIN|server_name $DOMAIN|g' nginx/conf.d/default.conf
sed -i 's|YOUR_DOMAIN|$DOMAIN|g' nginx/conf.d/default.conf
sed -i 's|# return 301|return 301|' nginx/conf.d/default.conf

# Uncomment the HTTPS server block
sed -i 's|^# \(.*\)|\1|' nginx/conf.d/default.conf

# Reload nginx
docker compose exec nginx nginx -s reload

echo "TLS configured for $DOMAIN"
REMOTE

echo ""
echo "=== TLS Setup Complete ==="
echo "HTTPS: https://$DOMAIN"
echo "Cert auto-renewal is handled by the certbot container"
