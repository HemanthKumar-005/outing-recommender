# Pre-Launch Engineering & Security Roadmap (TODO)

This document tracks all remediation tasks, architectural fixes, security hardening, and product gates identified in the **Pre-Launch Audit Report** required to take the **Outing Recommender Platform** from current prototype to private beta and public launch.

<<<<<<< HEAD
> **Status legend (updated 2026-10-22):** `[x]` done and covered by a passing automated test or a build;
> `[~]` written but not run end-to-end here (e.g. Docker, nginx, live email) or only partly done; `[ ]` not done.
> Notes on the `[~]`/`[ ]` items are in `docs/STATUS.md`.

=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
---

## 🚦 Launch Gate Checklist

All boxes must be checked before public release:

<<<<<<< HEAD
- [~] **Secrets Cleared**: No API key or production credential in repo or git history; live keys rotated.
- [x] **Real Authentication**: Real user identity, secure password hashing, JWT/cookie sessions (no fake login or client `demo-key`).
- [~] **Intra-Tenant Protection**: Users cannot access or modify another user's data (IDOR resolved and verified).
- [~] **Inter-Tenant Isolation**: Tenant A cannot read Tenant B's data on any table (automated RLS regression test in CI).
- [~] **Infrastructure & TLS**: HTTPS enforced with HSTS and CSP headers; internal service ports closed to public interfaces.
- [~] **Production Credentials**: No default passwords (`app_role_pw`, `postgres_admin_pw`) and no seeded `demo-key` in production.
- [ ] **Data Truthfulness**: Every venue in the launch catalog is verified to exist; hours and pricing source/estimation explicitly badged.
- [~] **Legal & Compliance**: Privacy Policy, Terms of Service, consent capture, and account deletion workflow live.
- [x] **Attribution & Licensing**: OpenStreetMap (ODbL) and Google Maps platform terms satisfied.
- [~] **Documentation Alignment**: README, API docs, and model card accurately describe actual endpoints and training methodology.
- [~] **Automated CI & Testing**: End-to-end test (signup → onboarding → recommendation → plan) passes in CI.
- [~] **Observability & Backups**: Structured logging, error tracking (Sentry), health/readiness probes, and verified DB backup restore drill.
=======
- [ ] **Secrets Cleared**: No API key or production credential in repo or git history; live keys rotated.
- [ ] **Real Authentication**: Real user identity, secure password hashing, JWT/cookie sessions (no fake login or client `demo-key`).
- [ ] **Intra-Tenant Protection**: Users cannot access or modify another user's data (IDOR resolved and verified).
- [ ] **Inter-Tenant Isolation**: Tenant A cannot read Tenant B's data on any table (automated RLS regression test in CI).
- [ ] **Infrastructure & TLS**: HTTPS enforced with HSTS and CSP headers; internal service ports closed to public interfaces.
- [ ] **Production Credentials**: No default passwords (`app_role_pw`, `postgres_admin_pw`) and no seeded `demo-key` in production.
- [ ] **Data Truthfulness**: Every venue in the launch catalog is verified to exist; hours and pricing source/estimation explicitly badged.
- [ ] **Legal & Compliance**: Privacy Policy, Terms of Service, consent capture, and account deletion workflow live.
- [ ] **Attribution & Licensing**: OpenStreetMap (ODbL) and Google Maps platform terms satisfied.
- [ ] **Documentation Alignment**: README, API docs, and model card accurately describe actual endpoints and training methodology.
- [ ] **Automated CI & Testing**: End-to-end test (signup → onboarding → recommendation → plan) passes in CI.
- [ ] **Observability & Backups**: Structured logging, error tracking (Sentry), health/readiness probes, and verified DB backup restore drill.
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

---

## 🔴 Phase 0: Stop the Bleeding (Immediate Blockers)

*Goal: Eliminate critical security exposures, disable fake authentication paths, and fix multi-tenant RLS plumbing.*

### 1. Secrets & Credentials Remediation
- [ ] **Rotate Keys**: Immediately rotate Google Maps API key, LocationIQ token, and OpenWeatherMap key.
- [ ] **Clean Config Files**:
<<<<<<< HEAD
  - [x] Remove hardcoded Google Maps demo key from `.env`, `.env.example`, and `docker-compose.yml`.
  - [x] Remove hardcoded LocationIQ default key from `scripts/harvest_pan_india_places.py`.
  - [~] Add `.env` check to prevent accidental check-ins; add `gitleaks` or `trufflehog` pre-commit hook / CI check.
- [ ] **Dynamic Database Credentials**:
  - [x] Template `postgres/init.sql` (or use an entrypoint script) to inject passwords via environment variables rather than hardcoding `CREATE ROLE ... PASSWORD 'app_role_pw'`.
  - [~] Update `docker-compose.prod.yml` and `deploy/.env.production.example` to require explicit passwords on startup and fail fast if unset.
  - [x] Remove the superuser fallback (`postgres:postgres_admin_pw`) from `services/model-training-worker/train.py`; use a read-only worker role.

### 2. Multi-Tenant RLS & Session Plumbing
- [x] **Transaction-Local Scoping**: Change `shared/pgdb.py` to use `SELECT set_config('app.tenant_id', %s, true)` (`is_local=true`) inside a transaction block, or guarantee `RESET app.tenant_id` upon connection release.
- [x] **RLS Policy Casting Fix**: Update `postgres/init.sql` RLS policy to `NULLIF(current_setting('app.tenant_id', true), '')::uuid` to prevent crash on empty strings.
- [~] **Automated RLS Regression Test**: Implement a dedicated integration test in `tests/test_rls_isolation.py` that provisions two tenants, inserts records, and asserts 0 cross-tenant leaks on every table.
- [x] **Remove Shared Demo Tenant from Production**: Condition the demo tenant insertion in `init.sql` so it only runs in local dev environments.

### 3. Decommission Fake Auth & Client Demo Fallbacks
- [x] **Delete Fake Login**: Remove the non-checking submit handler in `frontend/app/login/page.tsx` that binds sessions directly to `NEXT_PUBLIC_API_KEY`.
- [x] **Delete Fake Key Generation in Signup**: Remove `local-xxxx` random key fallback in `frontend/app/signup/page.tsx`; surface actual API failures honestly to the user.
- [x] **Secure Session Handling**: Replace `localStorage.nearby_authenticated === "true"` with verified session checks via secure, HttpOnly cookies.

### 4. Data Truthfulness Quarantine
- [x] **Quarantine Synthetic Reviews**: Remove `data/reviews.csv` from runtime service paths; restrict its usage to offline testing fixtures only.
- [~] **Audit Venue Hours & Friday Closures**: Fix known closures in catalog (e.g. Taj Mahal Friday closure) and ensure any category default is explicitly displayed with an "Estimated hours — verify ahead" badge in UI.
=======
  - [ ] Remove hardcoded Google Maps demo key from `.env`, `.env.example`, and `docker-compose.yml`.
  - [ ] Remove hardcoded LocationIQ default key from `scripts/harvest_pan_india_places.py`.
  - [ ] Add `.env` check to prevent accidental check-ins; add `gitleaks` or `trufflehog` pre-commit hook / CI check.
- [ ] **Dynamic Database Credentials**:
  - [ ] Template `postgres/init.sql` (or use an entrypoint script) to inject passwords via environment variables rather than hardcoding `CREATE ROLE ... PASSWORD 'app_role_pw'`.
  - [ ] Update `docker-compose.prod.yml` and `deploy/.env.production.example` to require explicit passwords on startup and fail fast if unset.
  - [ ] Remove the superuser fallback (`postgres:postgres_admin_pw`) from `services/model-training-worker/train.py`; use a read-only worker role.

### 2. Multi-Tenant RLS & Session Plumbing
- [ ] **Transaction-Local Scoping**: Change `shared/pgdb.py` to use `SELECT set_config('app.tenant_id', %s, true)` (`is_local=true`) inside a transaction block, or guarantee `RESET app.tenant_id` upon connection release.
- [ ] **RLS Policy Casting Fix**: Update `postgres/init.sql` RLS policy to `NULLIF(current_setting('app.tenant_id', true), '')::uuid` to prevent crash on empty strings.
- [ ] **Automated RLS Regression Test**: Implement a dedicated integration test in `tests/test_rls_isolation.py` that provisions two tenants, inserts records, and asserts 0 cross-tenant leaks on every table.
- [ ] **Remove Shared Demo Tenant from Production**: Condition the demo tenant insertion in `init.sql` so it only runs in local dev environments.

### 3. Decommission Fake Auth & Client Demo Fallbacks
- [ ] **Delete Fake Login**: Remove the non-checking submit handler in `frontend/app/login/page.tsx` that binds sessions directly to `NEXT_PUBLIC_API_KEY`.
- [ ] **Delete Fake Key Generation in Signup**: Remove `local-xxxx` random key fallback in `frontend/app/signup/page.tsx`; surface actual API failures honestly to the user.
- [ ] **Secure Session Handling**: Replace `localStorage.nearby_authenticated === "true"` with verified session checks via secure, HttpOnly cookies.

### 4. Data Truthfulness Quarantine
- [ ] **Quarantine Synthetic Reviews**: Remove `data/reviews.csv` from runtime service paths; restrict its usage to offline testing fixtures only.
- [ ] **Audit Venue Hours & Friday Closures**: Fix known closures in catalog (e.g. Taj Mahal Friday closure) and ensure any category default is explicitly displayed with an "Estimated hours — verify ahead" badge in UI.
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

---

## 🟠 Phase 1: Beta Readiness (Weeks 2–4)

*Goal: Implement real user identity, intra-tenant authorization, truthful documentation, and deployment security.*

### 1. Real User Authentication & Authorization (IDOR Resolution)
<<<<<<< HEAD
- [x] **Authentication Layer**: Implement real user authentication (Argon2id password hashing + JWT/session tokens, or integrate a managed auth provider like Supabase Auth / Auth0).
- [x] **Token Identity Binding**: Include both `user_id` and `tenant_id` in signed token; gateway extracts and validates both.
- [~] **Intra-Tenant Protection**:
  - [x] Restrict `GET /users/{id}`, `PUT /users/{id}/preferences`, and interaction endpoints in `user-service` so callers can only query/mutate their own profile unless granted admin role.
  - [x] Add foreign key constraints (`ON DELETE CASCADE`) between `users.users` and dependent tables (`interactions`, `itinerary_items`).

### 2. Gateway Hardening & Rate Limiting
- [x] **API Key Hashing**: Store SHA-256 hashes of API keys in `platform.tenants` with a short readable prefix; display full key only once at creation.
- [x] **Key Rotation & Revocation**: Add endpoint to revoke/rotate keys and immediately invalidate Redis key cache.
- [x] **Secure `POST /tenants`**: Add rate limiting, email verification, or captcha to tenant registration endpoint to prevent tenant exhaustion.
- [x] **Upstream Error Handling**: Wrap `httpx` gateway requests in try/except blocks to return clean 502/504 JSON responses instead of unhandled 500 crashes.
- [x] **Fail Closed on Auth**: Ensure rate limiter fails closed for authentication endpoints if Redis is unreachable.

### 3. README & API Alignment
- [x] **Align Engine Documentation**: Either implement the advertised `POST /recommendations/{session_id}/feedback` live re-ranking in `recommendation-engine` with Redis caching, or remove the claim from `README.md`.
- [x] **Fix Itinerary Curl Examples**: Correct README from `POST /api/itinerary/itinerary` (404) to `POST /api/itinerary/generate-plan`.
- [~] **Repository Hygiene**: Move personal worklogs (`2026-10-13.md`, etc.) and root `scratch/` files to archival folders; add proper `.gitignore` patterns.

### 4. Legal, Privacy & Compliance
- [x] **Privacy Policy & Terms Pages**: Create `/privacy` and `/terms` routes in the frontend and link from signup and footer.
- [~] **Location Consent**: Add explicit consent prompt for geolocation processing under DPDP Act 2023 / GDPR.
- [~] **Account & Data Deletion**: Implement full cascade deletion endpoint (`DELETE /users/me`) clearing user records, cached interactions, and itineraries.
- [x] **Map & Data Attribution**: Add required OpenStreetMap (ODbL) and Google Maps platform attribution in map components and footer.

### 5. Production Infrastructure & HTTPS
- [~] **Enable TLS / HTTPS**: Configure Nginx reverse proxy with SSL certificate termination (Let's Encrypt / Certbot) and enforce HTTP → HTTPS redirection.
- [~] **Security Headers**: Add `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, and `Permissions-Policy`.
- [x] **Internal Network Isolation**: Bind internal service ports (8001–8007, 5432, 6379, 5672) to localhost (`127.0.0.1`) only; never expose them on public host interfaces.
=======
- [ ] **Authentication Layer**: Implement real user authentication (Argon2id password hashing + JWT/session tokens, or integrate a managed auth provider like Supabase Auth / Auth0).
- [ ] **Token Identity Binding**: Include both `user_id` and `tenant_id` in signed token; gateway extracts and validates both.
- [ ] **Intra-Tenant Protection**:
  - [ ] Restrict `GET /users/{id}`, `PUT /users/{id}/preferences`, and interaction endpoints in `user-service` so callers can only query/mutate their own profile unless granted admin role.
  - [ ] Add foreign key constraints (`ON DELETE CASCADE`) between `users.users` and dependent tables (`interactions`, `itinerary_items`).

### 2. Gateway Hardening & Rate Limiting
- [ ] **API Key Hashing**: Store SHA-256 hashes of API keys in `platform.tenants` with a short readable prefix; display full key only once at creation.
- [ ] **Key Rotation & Revocation**: Add endpoint to revoke/rotate keys and immediately invalidate Redis key cache.
- [ ] **Secure `POST /tenants`**: Add rate limiting, email verification, or captcha to tenant registration endpoint to prevent tenant exhaustion.
- [ ] **Upstream Error Handling**: Wrap `httpx` gateway requests in try/except blocks to return clean 502/504 JSON responses instead of unhandled 500 crashes.
- [ ] **Fail Closed on Auth**: Ensure rate limiter fails closed for authentication endpoints if Redis is unreachable.

### 3. README & API Alignment
- [ ] **Align Engine Documentation**: Either implement the advertised `POST /recommendations/{session_id}/feedback` live re-ranking in `recommendation-engine` with Redis caching, or remove the claim from `README.md`.
- [ ] **Fix Itinerary Curl Examples**: Correct README from `POST /api/itinerary/itinerary` (404) to `POST /api/itinerary/generate-plan`.
- [ ] **Repository Hygiene**: Move personal worklogs (`2026-10-13.md`, etc.) and root `scratch/` files to archival folders; add proper `.gitignore` patterns.

### 4. Legal, Privacy & Compliance
- [ ] **Privacy Policy & Terms Pages**: Create `/privacy` and `/terms` routes in the frontend and link from signup and footer.
- [ ] **Location Consent**: Add explicit consent prompt for geolocation processing under DPDP Act 2023 / GDPR.
- [ ] **Account & Data Deletion**: Implement full cascade deletion endpoint (`DELETE /users/me`) clearing user records, cached interactions, and itineraries.
- [ ] **Map & Data Attribution**: Add required OpenStreetMap (ODbL) and Google Maps platform attribution in map components and footer.

### 5. Production Infrastructure & HTTPS
- [ ] **Enable TLS / HTTPS**: Configure Nginx reverse proxy with SSL certificate termination (Let's Encrypt / Certbot) and enforce HTTP → HTTPS redirection.
- [ ] **Security Headers**: Add `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, and `Permissions-Policy`.
- [ ] **Internal Network Isolation**: Bind internal service ports (8001–8007, 5432, 6379, 5672) to localhost (`127.0.0.1`) only; never expose them on public host interfaces.
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

---

## 🟡 Phase 2: Launch Credibility & Product Polish (Weeks 5–8)

*Goal: High-quality verified catalog, end-to-end testing, frontend polish, and observability.*

### 1. Verified Core Catalog
- [ ] **Pilot City Verification**: Curate a high-confidence, verified catalog of 300–500 venues in primary launch city (e.g. Bangalore), validating real operating hours, prices, and Google Place / OSM IDs.
<<<<<<< HEAD
- [x] **"Report an Issue" Feedback Loop**: Add a venue issue reporting button on place cards wired to a moderation queue.
- [x] **Deterministic Primary Ranker**: Default to rule-based + content-based scoring with verified data; keep XGBoost behind an experimental feature flag until sufficient real user interactions are logged.

### 2. Testing & Quality Assurance
- [~] **Playwright E2E Suite**: Create end-to-end browser tests covering:
=======
- [ ] **"Report an Issue" Feedback Loop**: Add a venue issue reporting button on place cards wired to a moderation queue.
- [ ] **Deterministic Primary Ranker**: Default to rule-based + content-based scoring with verified data; keep XGBoost behind an experimental feature flag until sufficient real user interactions are logged.

### 2. Testing & Quality Assurance
- [ ] **Playwright E2E Suite**: Create end-to-end browser tests covering:
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
  - User signup and email confirmation
  - Onboarding preference selection
  - Recommendation generation and filter toggling
  - Itinerary plan generation and swap/reorder actions
<<<<<<< HEAD
- [~] **CI Pipeline Hardening**:
=======
- [ ] **CI Pipeline Hardening**:
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
  - Run linting (`ruff`, `flake8`, ESLint) and type checks (`pyright`, TypeScript).
  - Enforce `npm ci` with committed `package-lock.json` in `frontend/Dockerfile`.
  - Add dependency security audits (`pip-audit`, `npm audit`).

### 3. Frontend & UX Refactoring
<<<<<<< HEAD
- [x] **Client Key Exposure**: Proxy Google Places photo/map requests through a backend endpoint rather than embedding client API keys in query parameters.
- [ ] **Component & CSS Modularization**: Split massive `globals.css` (3,200+ lines) into CSS Modules or design tokens; clean up redundant components (e.g. duplicate `PlanDisplay.tsx`).
- [x] **App Router Boundaries**: Add `loading.tsx`, `error.tsx`, and `not-found.tsx` to Next.js dashboard routes.
- [x] **Social Sharing**: Implement read-only public itinerary sharing via tokenized links (`/itinerary/share/[share_token]`).

### 4. Observability & Operational Resilience
- [~] **Structured Logging & Tracing**: Adopt structured JSON logging with request IDs (`X-Request-ID`) propagated across all services.
- [~] **Error Tracking**: Integrate Sentry for both Next.js frontend and FastAPI backends.
- [~] **Database Backup Drills**: Validate `deploy/backup-db.sh` with automated restore verification and define RPO/RTO objectives.
=======
- [ ] **Client Key Exposure**: Proxy Google Places photo/map requests through a backend endpoint rather than embedding client API keys in query parameters.
- [ ] **Component & CSS Modularization**: Split massive `globals.css` (3,200+ lines) into CSS Modules or design tokens; clean up redundant components (e.g. duplicate `PlanDisplay.tsx`).
- [ ] **App Router Boundaries**: Add `loading.tsx`, `error.tsx`, and `not-found.tsx` to Next.js dashboard routes.
- [ ] **Social Sharing**: Implement read-only public itinerary sharing via tokenized links (`/itinerary/share/[share_token]`).

### 4. Observability & Operational Resilience
- [ ] **Structured Logging & Tracing**: Adopt structured JSON logging with request IDs (`X-Request-ID`) propagated across all services.
- [ ] **Error Tracking**: Integrate Sentry for both Next.js frontend and FastAPI backends.
- [ ] **Database Backup Drills**: Validate `deploy/backup-db.sh` with automated restore verification and define RPO/RTO objectives.
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

---

## 🟢 Phase 3: Post-Launch & Scale (Roadmap)

*Goal: Growth, monetization, cross-platform clients, and personalized ML.*

- [ ] **Billing & Monetization**: Stripe or Razorpay integration for B2B API tiers or consumer concierge subscriptions.
- [ ] **PWA / Native Mobile App**: Progressive Web App manifest + offline caching; optional cross-platform React Native client.
- [ ] **Real Interaction Model Retraining**: Online matrix factorization and XGBoost retraining based on real user clicks, bookmarks, and completions.
- [ ] **Multilingual Support**: Hindi and regional language localization for Indian market discovery.
<<<<<<< HEAD
- [~] **Calendar & Booking Integrations**: One-click Google Calendar / `.ics` export and reservation deep links.
=======
- [ ] **Calendar & Booking Integrations**: One-click Google Calendar / `.ics` export and reservation deep links.
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
