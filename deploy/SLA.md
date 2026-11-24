# Recovery Objectives

## RPO (Recovery Point Objective)
Maximum acceptable data loss: **1 hour**
- Nightly full backup via backup-db.sh (cron: 0 2 * * *)
- Recommendation to add hourly WAL archiving (pg_basebackup + WAL-G) before scaling beyond 10k users

## RTO (Recovery Time Objective)  
Maximum acceptable downtime: **4 hours**
- Restore procedure: deploy/restore-verify.sh validates backup integrity before promoting
- Full stack redeploy from Docker Compose: ~15 minutes on a provisioned server
- Database restore from latest backup: ~30 minutes for current data volume

## Backup Retention
- Keep daily backups for 30 days
- Keep weekly backups for 90 days
- Store backups in a separate location from the application server (S3, GCS, or offsite)

## Tested
- [ ] Restore drill passing in CI (see backup-restore-drill job in .github/workflows/ci.yml)
- [ ] Manual restore drill performed: [date TBD]
- [ ] RPO/RTO reviewed: [date TBD]
