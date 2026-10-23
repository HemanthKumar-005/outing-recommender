#!/usr/bin/env bash
# =============================================================================
# Outing Recommender Platform - One-Click Production Deployment Script
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DEPLOY_DIR")"

echo "================================================================="
echo "   Outing Recommender - Production Deployment"
echo "================================================================="

# 1. Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Error: docker is not installed. Aborting." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Error: docker compose plugin is not installed. Aborting." >&2; exit 1; }

cd "$PROJECT_ROOT"

# 2. Check environment file
ENV_FILE="$DEPLOY_DIR/.env.production"
if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$PROJECT_ROOT/.env" ]; then
        echo "Found root .env file, copying to $ENV_FILE..."
        cp "$PROJECT_ROOT/.env" "$ENV_FILE"
    else
        echo "Creating $ENV_FILE from template..."
        cp "$DEPLOY_DIR/.env.production.example" "$ENV_FILE"
        echo "Please edit $ENV_FILE with your production passwords and domain settings, then re-run this script."
        exit 1
    fi
fi

# 3. Pull / Build containers
echo "Building and starting production containers with Docker Compose..."
docker compose -f "$DEPLOY_DIR/docker-compose.prod.yml" --env-file "$ENV_FILE" up -d --build --remove-orphans

# 4. Wait for database health
echo "Waiting for PostgreSQL to pass health checks..."
RETRIES=30
until docker compose -f "$DEPLOY_DIR/docker-compose.prod.yml" exec -T postgres pg_isready -U postgres >/dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo "Waiting for postgres... ($RETRIES attempts remaining)"
    sleep 2
    RETRIES=$((RETRIES-1))
done

if [ $RETRIES -eq 0 ]; then
    echo "Error: PostgreSQL did not become ready in time." >&2
    exit 1
fi
echo "PostgreSQL is healthy and accepting connections."

# 5. Train initial recommendation model if needed
echo "Checking recommendation ML model..."
docker compose -f "$DEPLOY_DIR/docker-compose.prod.yml" run --rm model-training-worker

# 6. Check Nginx reverse proxy
echo "Verifying reverse proxy health..."
sleep 3
if curl -sf http://localhost/healthz >/dev/null 2>&1; then
    echo "Nginx reverse proxy is healthy at http://localhost/healthz"
else
    echo "Note: Nginx started. If domain/SSL is configured, verify via your public URL."
fi

echo ""
echo "================================================================="
echo "   Deployment Complete!"
echo "================================================================="
echo "Frontend:  http://localhost/ (or http://your_server_ip/)"
echo "API Docs:  http://localhost/api/docs"
echo ""
echo "To seed initial places and demo data:"
echo "   python3 scripts/seed_data.py"
echo ""
echo "To view container logs:"
echo "   docker compose -f deploy/docker-compose.prod.yml logs -f"
echo "================================================================="
