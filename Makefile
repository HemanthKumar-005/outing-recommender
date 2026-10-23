.PHONY: dev-env up test lint e2e-local backup drill
dev-env:        ## create .env with random dev secrets
	@test -f .env && echo ".env exists" || (cp .env.example .env && \
	 sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$$(openssl rand -hex 32)/; s/^INTERNAL_SERVICE_TOKEN=.*/INTERNAL_SERVICE_TOKEN=$$(openssl rand -hex 16)/" .env && echo "created .env")
up: dev-env
	docker compose up --build -d
lint:
	ruff check --select E9,F63,F7,F82,F811,F401,F841 shared services scripts tests
test:
	for s in api-gateway itinerary-service sentiment-worker model-training-worker recommendation-engine; do (cd services/$$s && python -m pytest tests -q) || exit 1; done
	python -m pytest tests -q   # needs TEST_* env vars, see .github/workflows/ci.yml
backup:
	./deploy/scripts/backup-db.sh
drill:
	./deploy/scripts/restore-drill.sh
