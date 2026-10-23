# What is and is not finished (2026-10-22)

## Verified by automated tests (real Postgres + Redis + gateway + user/place/itinerary services)
`tests/test_rls_isolation.py` (7) and `tests/test_auth_flow.py` (17) plus per-service unit tests all pass.
Covered: RLS isolation on users, pooled-connection tenant leakage, cascade deletion, role privileges, signup/login/me,
no account enumeration, ownership (users, itineraries, place writes), spoofed identity headers, CSRF origin check, forged JWT,
email-token single use, API-key hashing/rotation/revocation, estimated-hours behaviour, issue reports hiding venues,
`/places/nearby`, itinerary sharing and `.ics` export. The frontend passes `tsc` and `next build`.

## Written but NOT run end-to-end here
- `docker compose` (dev and prod), nginx TLS config, `init-letsencrypt.sh`, `backup-db.sh`/`restore-drill.sh` inside Docker
  (the dump -> encrypt -> decrypt -> restore -> verify chain was proven with local Postgres)
- Playwright journey (`e2e/`) and the GitHub workflows (never executed on GitHub)
- Real SMTP delivery, live Cloudflare Turnstile verification, Sentry/GlitchTip delivery
- The browser UI (only built, never clicked through)

## Not done
- **Verified catalog (launch gate).** 308 curated venues, all `unverified`; hours are category defaults except the Taj Mahal correction.
  Nobody has checked these against live sources. `VERIFIED_ONLY=true` (prod default) hides everything until venues are verified via
  `PATCH /admin/places/{id}/verification` - so a production deploy shows an EMPTY catalog until you do that work.
- Rotating the leaked Google/LocationIQ keys and purging them from git history (needs you).
- Location consent: the app never reads device GPS (it uses the city picker), so the Settings switch only records consent for a
  future feature. There is no consent prompt in the signup flow beyond the Terms/Privacy checkbox.
- Account deletion removes database rows via FK cascade; recommendation-engine caches are not actively purged.
- Modular-monolith collapse for free hosting; frontend error tracking; CSS modularisation; full RLS test on every table;
  password reset; group planning with consent; Phase 3 items (billing, PWA, retraining, i18n).
