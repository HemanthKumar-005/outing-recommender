# Production Deployment

## Prerequisites
- A Linux server with Docker and Docker Compose installed
- A domain name with an A record pointing to your server's IP
- Ports 80 and 443 open in your firewall

## Steps

1. Copy and fill in secrets:
   cp deploy/.env.production.example deploy/.env.production
   # Edit deploy/.env.production with real values

2. Replace YOUR_DOMAIN in nginx/nginx.conf with your actual domain,
   or use envsubst:
   envsubst '${DOMAIN}' < nginx/nginx.conf > nginx/nginx.conf.rendered

3. Obtain your first TLS certificate (HTTP must be reachable on port 80):
   docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot \
     certbot certonly --webroot -w /var/www/certbot -d your.domain.com \
     --email you@example.com --agree-tos --no-eff-email

4. Start the full stack:
   docker compose -f docker-compose.yml -f docker-compose.prod.yml \
     --env-file deploy/.env.production up -d

5. Verify HTTPS is working:
   curl -I https://your.domain.com

## Certificate renewal
Certbot renews automatically every 12 hours (checks expiry, only renews when < 30 days remain).
To force a manual renewal: docker compose exec certbot certbot renew
