# Runbook: Database Restore

> Restoring Postgres from RDS snapshot. Use for data corruption, accidental delete, or DR.

## Prerequisites

- AWS CLI configured with credentials that can `rds:RestoreDBInstance*`
- Know the target timestamp (point-in-time) or snapshot ID
- Maintenance window declared (app must be offline briefly)

## Decision tree

| Scenario                         | Approach                                                            |
| -------------------------------- | ------------------------------------------------------------------- |
| Accidental row delete <5 min ago | Quickly query `pg_xact_commit_timestamp` to see if WAL still has it |
| Need yesterday's state           | RDS point-in-time-restore (PITR)                                    |
| Need state from >7 days ago      | Restore from cross-region monthly snapshot                          |
| Total cluster loss               | Restore latest snapshot to new instance, then DNS swap              |

## Point-in-time restore (most common)

```bash
# 1. Find the target time (UTC)
TARGET_TIME='2026-05-22T14:30:00Z'

# 2. Restore to a new instance (don't overwrite prod)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier resumaker-prod \
  --target-db-instance-identifier resumaker-restored-$(date +%s) \
  --restore-time "$TARGET_TIME" \
  --db-instance-class db.t3.small \
  --multi-az \
  --no-publicly-accessible \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name resumaker-prod-db-subnet

# 3. Wait for instance to be available
aws rds wait db-instance-available --db-instance-identifier resumaker-restored-XXX

# 4. Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier resumaker-restored-XXX \
  --query 'DBInstances[0].Endpoint.Address' --output text
```

## Switching app to restored DB

Two strategies:

### Strategy A: Quick swap (downtime ~2 min)

```bash
# 1. Scale app to 0
kubectl scale deployment web --replicas=0 -n resumaker

# 2. Update DATABASE_URL secret
kubectl create secret generic resumaker-db --from-literal=DATABASE_URL='postgres://...' \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Scale back up
kubectl scale deployment web --replicas=3 -n resumaker

# 4. Smoke test
curl https://resumaker.co.il/api/health/ready
```

### Strategy B: Promote restored to primary (no downtime, takes longer)

1. Stop writes to original DB (read-only mode if app supports)
2. Wait for replication to catch up
3. Rename: `resumaker-prod` → `resumaker-prod-old`, `resumaker-restored` → `resumaker-prod`
4. App auto-reconnects on next pool refresh

## Partial restore (just specific rows)

For "I deleted a user's resumes" type errors:

```bash
# 1. Restore to a sandbox instance
# (steps above)

# 2. Dump just what you need
pg_dump "postgres://sandbox-restored:5432/resumaker" \
  -t resumes \
  --data-only \
  --where="user_id='<the-user>'" \
  > restore.sql

# 3. Apply to prod (carefully, with INSERT ... ON CONFLICT DO NOTHING)
sed -i 's/INSERT INTO/INSERT INTO/; s/);/) ON CONFLICT (id) DO NOTHING;/' restore.sql
psql $DATABASE_URL < restore.sql
```

## Validation after restore

```sql
SELECT count(*) FROM users;
SELECT count(*) FROM resumes;
SELECT count(*) FROM generations;
SELECT max(created_at) FROM audit_log;
```

Compare to expected counts. If counts look right, smoke-test the app:

- Sign in works
- Dashboard loads
- Generate a resume
- Download PDF

## Aftermath

- Document in `docs/incidents/<date>-db-restore.md`
- File a follow-up: why did the data need restoring?
- Verify backups are still scheduled (`aws rds describe-db-snapshots`)

---

**Author**: Rotem · **Last updated**: 2026-05-23
