# Operations runbook

## Targets (single small VPS, nightly backup)
| | Target | Basis |
|---|---|---|
| **RPO** (max data loss) | 24 h | nightly `backup-db.sh`; run it more often to shrink this |
| **RTO** (time to restore) | < 1 h | measure with the drill below; the SQL restore of a small DB takes seconds, the rest is human time |

## Backups
```bash
export BACKUP_PASSPHRASE=...            # keep in a password manager, not on the server next to the backups
RCLONE_REMOTE="gdrive:nearby-backups" ./deploy/scripts/backup-db.sh
# cron (nightly 02:30):  30 2 * * *  cd /opt/nearby && BACKUP_PASSPHRASE=... ./deploy/scripts/backup-db.sh
```
Backups are `pg_dump | gzip | AES-256` files in `backups/` (14-day retention) and optionally copied offsite with rclone.

## Restore drill (do this monthly and before launch)
```bash
BACKUP_PASSPHRASE=... ./deploy/scripts/restore-drill.sh      # newest backup, throw-away container
```
It restores into a temporary Postgres, runs `deploy/scripts/verify-restore.sql` (tables, FORCE RLS, policies,
hashed API keys, no orphaned rows) and prints the elapsed seconds. Record the date and time in your drill log.
The same verification SQL runs in CI against a fresh dump.

## Restoring production
1. `docker compose -f deploy/docker-compose.prod.yml stop api-gateway user-service place-service itinerary-service interaction-service notification-service recommendation-engine`
2. Decrypt and load into a fresh database (see `restore-drill.sh` for the exact commands), switch the services to it.
3. Run `verify-restore.sql`, start the services, check `/ready`.

## Alerts worth having (UptimeRobot / Better Stack free tier)
- `https://<domain>/healthz` (nginx) and the gateway `/ready` (database + Redis).
- context-service `/health` field `weather_source_counts`: a rising `mock` or `unavailable` count means weather is broken.

## Rotating things
- API key for a tenant: `POST /tenant/api-key/rotate` with the current key.
- `JWT_SECRET`: change it, redeploy; all users must log in again.
- Database role passwords: `ALTER ROLE app_role PASSWORD '...'` and update `.env.production`, redeploy.
