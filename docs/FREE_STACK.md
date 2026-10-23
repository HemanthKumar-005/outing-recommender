# Free stack: what is used, and what it costs you later

Nothing here needs a payment card to sign up. "Free" is fine for a private beta; check each term before charging users.

| Need | Used | Limit / catch |
|---|---|---|
| Maps | Leaflet + OpenStreetMap tiles | Public tile server is for light use; set `NEXT_PUBLIC_TILE_URL` to another provider for real traffic. Keep the OSM attribution. |
| Routing | Public OSRM demo, optional LocationIQ free key, else straight-line estimate (labelled) | Demo server is fair-use only |
| Weather | Open-Meteo (no key) or OpenWeatherMap free key | Open-Meteo free is **non-commercial** |
| Place photos | none (category illustrations) | Google Places photos need billing; removed |
| Auth | own Argon2id + JWT cookie | you own password resets/2FA |
| Captcha | Cloudflare Turnstile | free |
| Email | any SMTP: Brevo, Resend, Gmail app password; Mailpit in dev | daily caps; needs a verified sender |
| TLS | Let's Encrypt via certbot | needs a domain you control |
| Errors | Sentry free (`SENTRY_DSN`) or self-hosted GlitchTip | ~5k events/month; backend only so far |
| CI | GitHub Actions, gitleaks, ruff, pip-audit, npm audit, Trivy, Playwright | free minutes |
| Backups | pg_dump + openssl, rclone to Google Drive | you manage the passphrase |

## Hosting: the unsolved part
This repo runs ~10 containers (+ nginx, certbot). No free **no-card** host runs that. Realistic options:
1. A cheap VPS (needs a card), 2. your own machine + Cloudflare Tunnel for demos, or
3. collapse the backend into one FastAPI "modular monolith" (not done here) and use a free container host.

## Data licences
- Map data © OpenStreetMap contributors (ODbL). Footer and map attribution are in place.
- The curated catalog (`data/places_catalog.yaml`) is hand-written and **unverified**. `data/quarantine/` holds
  generated placeholder venues; they are not real places and are never loaded.
