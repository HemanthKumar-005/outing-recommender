# Security

**Report a vulnerability:** email the operator at the address in the site footer (or the value of
`NEXT_PUBLIC_SUPPORT_EMAIL`). Please do not open a public issue. Expect an acknowledgement within 3 days.
This is a student-run beta with no bug bounty.

## How the system protects data
- **Passwords:** Argon2id; never logged or returned. Login and signup responses do not reveal whether an email exists.
- **Sessions:** signed JWT (`user_id` + `tenant_id` + role) in an `HttpOnly`, `SameSite=Lax`, `Secure` (prod) cookie.
  State-changing cookie requests must carry an allowed `Origin` (CSRF defence).
- **Authorisation:** the gateway strips any client-supplied `X-Tenant-Id`/`X-User-Id`/`X-User-Role` and sets them from
  the verified token. Services answer 404 (not 403) for other people's records.
- **Tenant isolation:** Postgres row-level security (`FORCE`) with a transaction-local `app.tenant_id`; tested in
  `tests/test_rls_isolation.py`. Services connect as least-privilege roles; the trainer role is read-only.
- **API keys:** stored as SHA-256 hashes, shown once, rotatable and revocable (`/tenant/api-key/rotate|revoke`).
- **Network:** only nginx publishes ports; every other container is on the internal Docker network (dev ports bind to 127.0.0.1).
- **Transport:** HTTPS, HSTS, CSP, `nosniff`, `Permissions-Policy` (see `deploy/nginx/templates`).

## Known limitations (be honest with yourself before launch)
- CSP allows `'unsafe-inline'` scripts because of Next.js bootstrap code; move to nonces later.
- Internal services trust identity headers from the gateway; the private Docker network is the boundary. Do not publish their ports.
- JWTs are stateless: logging out clears the cookie but a stolen token stays valid until it expires (7 days by default).
  Shorten `SESSION_TTL_SECONDS` or add a server-side denylist if that matters to you.
- No password reset flow yet. No 2FA.
- Event publishing is best-effort; a missed `user.deleted` event means a cache may keep stale data until it expires.

## If a secret leaks
1. Rotate it at the provider (Google/LocationIQ/SMTP/Turnstile/etc.) or regenerate it (`openssl rand`).
2. Redeploy. Rotating `JWT_SECRET` signs everyone out (that is the point).
3. Removing a secret from the code does **not** remove it from git history. Treat any key that was ever committed as public.
