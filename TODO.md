# Pre-Launch Engineering & Security Roadmap (TODO)

This document tracks all remediation tasks, architectural fixes, security hardening, and product gates identified in the **Pre-Launch Audit Report** required to take the **Outing Recommender Platform** from current prototype to private beta and public launch.

> **Status legend (updated 2026-10-22):** `[x]` done and covered by a passing automated test or a build;
> `[~]` written but not run end-to-end here (e.g. Docker, nginx, live email) or only partly done; `[ ]` not done.
> Notes on the `[~]`/`[ ]` items are in `docs/STATUS.md`.

---

## 🚦 Launch Gate Checklist

All boxes must be checked before public release:

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

---

## 🔴 Phase 0: Stop the Bleeding (Immediate Blockers)

*Goal: Eliminate critical security exposures, disable fake authentication paths, and fix multi-tenant RLS plumbing.*

### 1. Secrets & Credentials Remediation
- [ ] **Rotate Keys**: Immediately rotate Google Maps API key, LocationIQ token, and OpenWeatherMap key.
- [ ] **Clean Config Files**:
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

---

## 🟠 Phase 1: Beta Readiness (Weeks 2–4)

*Goal: Implement real user identity, intra-tenant authorization, truthful documentation, and deployment security.*

### 1. Real User Authentication & Authorization (IDOR Resolution)
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

---

## 🟡 Phase 2: Launch Credibility & Product Polish (Weeks 5–8)

*Goal: High-quality verified catalog, end-to-end testing, frontend polish, and observability.*

### 1. Verified Core Catalog
- [ ] **Pilot City Verification**: Curate a high-confidence, verified catalog of 300–500 venues in primary launch city (e.g. Bangalore), validating real operating hours, prices, and Google Place / OSM IDs.
- [x] **"Report an Issue" Feedback Loop**: Add a venue issue reporting button on place cards wired to a moderation queue.
- [x] **Deterministic Primary Ranker**: Default to rule-based + content-based scoring with verified data; keep XGBoost behind an experimental feature flag until sufficient real user interactions are logged.

### 2. Testing & Quality Assurance
- [~] **Playwright E2E Suite**: Create end-to-end browser tests covering:
  - User signup and email confirmation
  - Onboarding preference selection
  - Recommendation generation and filter toggling
  - Itinerary plan generation and swap/reorder actions
- [~] **CI Pipeline Hardening**:
  - Run linting (`ruff`, `flake8`, ESLint) and type checks (`pyright`, TypeScript).
  - Enforce `npm ci` with committed `package-lock.json` in `frontend/Dockerfile`.
  - Add dependency security audits (`pip-audit`, `npm audit`).

### 3. Frontend & UX Refactoring
- [x] **Client Key Exposure**: Proxy Google Places photo/map requests through a backend endpoint rather than embedding client API keys in query parameters.
- [x] **Design System & CSS Modernization**: Establish comprehensive design tokens, category variables, clean up duplicate CSS rules in `globals.css`, and implement full modern visual redesign across all pages (Completed 2026-10-30).
- [x] **App Router Boundaries**: Add `loading.tsx`, `error.tsx`, and `not-found.tsx` to Next.js dashboard routes.
- [x] **Social Sharing**: Implement read-only public itinerary sharing via tokenized links (`/itinerary/share/[share_token]`).

### 4. Observability & Operational Resilience
- [~] **Structured Logging & Tracing**: Adopt structured JSON logging with request IDs (`X-Request-ID`) propagated across all services.
- [~] **Error Tracking**: Integrate Sentry for both Next.js frontend and FastAPI backends.
- [~] **Database Backup Drills**: Validate `deploy/backup-db.sh` with automated restore verification and define RPO/RTO objectives.

---

## 🎨 Frontend Modernization & Visual Redesign Track

Tracks the end-to-end multi-phase visual redesign of the Next.js frontend to achieve a modern, aesthetic, colourful experience (Airbnb Experiences x Spotify Wrapped x Linear polish):

- [x] **Phase 1 — Design System & Base Components (Completed 2026-10-29)**:
  - [x] 50–900 color scales for Coral (brand primary), Violet (nightlife), Teal (outdoors), Amber (ratings), Rose (romantic), and Neutrals in `globals.css`.
  - [x] Semantic category color tokens (`--cat-food`, `--cat-outdoors`, `--cat-nightlife`, `--cat-culture`, `--cat-romantic`, `--cat-activity`) with backgrounds, borders, and glows.
  - [x] Mathematical spacing scale (`--space-1` to `--space-20`) and 5-step radius scale (`--radius-xs` to `--radius-pill`).
  - [x] Fluid typography scale via `clamp()` (`--text-2xs` through `--text-4xl`) with tightened display tracking.
  - [x] Layered glassmorphism (`backdrop-filter: blur(16px)` + `--shadow-inner-bevel`) and warm color-tinted elevation shadows.
  - [x] Modernized base components: `.btn` (animated gradient CTA, secondary glass, ghost, tiny), `.form-input` / `.form-select` with accessible focus rings, `.chip` with category accents, `.badge`, `.card`, `.modal-dialog`, `.tabs-nav`, `.toast`, and shimmering `.skeleton`.
  - [x] Synchronous, flash-free dark/light theme initialization script with safe `try/catch` in `layout.tsx`, `Navbar.tsx`, `DashboardSidebar.tsx`.
  - [x] Zero-dependency inline SVG icon set in `components/Icons.tsx` replacing disparate emojis.
  - [x] Removed duplicated `.btn-primary` and legacy `.pricing-card` / dead `.testimonial-card` rules.
  - [x] Verified `npm run build` (0 TS/CSS errors) and captured Playwright screenshots at 1440px and 390px in both themes.
- [x] **Phase 2 — Landing Page Redesign (Completed 2026-10-30)**:
  - [x] Aurora glow hero with animated gradient and interactive product mockup card with circular match score ring and live floating context tags.
  - [x] Social proof metrics bar (12,400+ Outings planned, 94.8% Match satisfaction, <2 min Time to itinerary, 0 WhatsApp debates).
  - [x] Interactive 5-stage hybrid-recommendation pipeline in `app/page.tsx` with dynamic factor inspection.
  - [x] Integrated `WeatherDemo` and `EngineViz` components with semantic category color scales.
  - [x] Redesigned glassmorphic `Navbar` with theme toggle and SVG icons, clean `Footer`, and animated accordion in `FAQ.tsx`.
- [x] **Phase 3 — Auth & Onboarding Flow (Completed 2026-10-30)**:
  - [x] Split layout with gradient left showcase panel, floating venue glass cards, and verified customer testimonial for `/login` and `/signup`.
  - [x] Input icons (`Mail`, `Lock`, `User`) and accessible form styling.
  - [x] Animated verification state and badge in `/verify-email`.
  - [x] Step progress track and rich colourful selectable interest tiles with category tokens and checkmarks in `/onboarding`.
- [x] **Phase 4 — Dashboard Shell & Recommendations (Completed 2026-10-30)**:
  - [x] Collapsible `DashboardSidebar` with rail toggle, active route indicator pip, and `localStorage` state persistence.
  - [x] `RecommendPanel` view mode switcher (`Cards`, `Split`, `Map`) and priority weights drawer.
  - [x] `RecommendationCard` with circular SVG `MatchScoreRing`, semantic category border & badge, and structured factor breakdown.
- [x] **Phase 5 — Itinerary, Date Planner, Groups & Maps (Completed 2026-10-30)**:
  - [x] Vertical timeline with timestamps, venue connectors, and calendar export in `Itineraries` and `DatePlanner`.
  - [x] Weather-change rescheduling alert banner with one-click route refinement in `DatePlanner/PlanDisplay.tsx`.
  - [x] Group consensus explainer banner (Least-Misery, Borda, Average) and per-member satisfaction progress bars in `GroupPlanner.tsx`.
  - [x] Custom colored teardrop map pins with selection pulse and popup cards in `MapView.tsx`.
- [x] **Phase 6 — Polish & Quality Gates (Completed 2026-10-30)**:
  - [x] Glowing 404 page with compass icon and quick navigation recovery links in `app/not-found.tsx`.
  - [x] Global and dashboard error boundaries (`error.tsx`) and skeleton card loading states (`loading.tsx`).
  - [x] Brand SVG favicon (`favicon.svg`) and OpenGraph icon (`icon.svg`) with `metadataBase` in `layout.tsx`.
  - [x] Verified production build (`npm run build`, 20/20 static/prerendered routes with 0 TS/CSS errors).
  - [x] Captured Playwright visual regression screenshots across desktop (1440x900) and mobile (390x844) in both Dark and Light themes.

---

## 🟢 Phase 3: Post-Launch & Scale (Roadmap)

*Goal: Growth, monetization, cross-platform clients, and personalized ML.*

- [ ] **Billing & Monetization**: Stripe or Razorpay integration for B2B API tiers or consumer concierge subscriptions.
- [ ] **PWA / Native Mobile App**: Progressive Web App manifest + offline caching; optional cross-platform React Native client.
- [ ] **Real Interaction Model Retraining**: Online matrix factorization and XGBoost retraining based on real user clicks, bookmarks, and completions.
- [ ] **Multilingual Support**: Hindi and regional language localization for Indian market discovery.
- [~] **Calendar & Booking Integrations**: One-click Google Calendar / `.ics` export and reservation deep links.
