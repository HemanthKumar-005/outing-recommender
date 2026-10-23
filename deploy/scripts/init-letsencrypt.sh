#!/usr/bin/env bash
# One-time bootstrap for free Let's Encrypt certificates (no payment details needed).
# Usage: DOMAIN_NAME=nearby.example.com LETSENCRYPT_EMAIL=you@example.com ./deploy/scripts/init-letsencrypt.sh
# Requires: DNS for $DOMAIN_NAME already points at this server and ports 80/443 are open.
set -euo pipefail
: "${DOMAIN_NAME:?set DOMAIN_NAME}"
: "${LETSENCRYPT_EMAIL:?set LETSENCRYPT_EMAIL}"
cd "$(dirname "$0")/.."
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"

# 1. nginx cannot start with a missing certificate, so create a throw-away self-signed one.
$COMPOSE run --rm --entrypoint sh certbot -c "
  mkdir -p /etc/letsencrypt/live/$DOMAIN_NAME &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem -subj '/CN=localhost'"

# 2. Start nginx (serves the ACME challenge on port 80).
$COMPOSE up -d nginx

# 3. Replace the dummy certificate with a real one.
$COMPOSE run --rm --entrypoint sh certbot -c "rm -rf /etc/letsencrypt/live/$DOMAIN_NAME /etc/letsencrypt/archive/$DOMAIN_NAME /etc/letsencrypt/renewal/$DOMAIN_NAME.conf"
$COMPOSE run --rm --entrypoint certbot certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN_NAME" --email "$LETSENCRYPT_EMAIL" --agree-tos --no-eff-email --non-interactive

# 4. Reload nginx with the real certificate. The certbot service renews every 12 hours.
$COMPOSE exec nginx nginx -s reload
echo "HTTPS is live for https://$DOMAIN_NAME"
