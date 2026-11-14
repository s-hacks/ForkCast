# Operations

## Local PostgreSQL (user-space install, D-30)

The binaries are the EDB PostgreSQL 17.11 distribution in `~/.local/pgsql17`, with data in `~/.local/var/pgdata17` and the log at `~/.local/var/pg17.log`. Run `npm run db:start` / `npm run db:stop`. To open a shell, run `scripts/db/pg-local.sh psql`.

The server does not start on boot. After a reboot, run `npm run db:start` again; until you do, `/api/health` returns 503.

## Backups

| Environment | Method | Frequency |
|---|---|---|
| Production (Neon) | Built-in point-in-time restore within the plan's retention window, plus a nightly logical dump kept off-provider | Nightly dump; check the retention window on the Neon plan |
| Local / demo | `pg_dump` before risky work | As needed |

Logical backup and restore:

```bash
# Backup (custom format, compressed)
~/.local/pgsql17/bin/pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%Y%m%d).dump

# Restore into an EMPTY database (never over production without sign-off)
~/.local/pgsql17/bin/pg_restore --no-owner --clean --if-exists -d "$TARGET_DATABASE_URL" backup-YYYYMMDD.dump
```

Neon restore steps:

1. Create a branch from a point in time before the incident.
2. Point a preview deployment at it and verify the data.
3. Promote the branch, or copy the needed rows back.

After any restore, check the ledger invariant per item: `Σ InventoryTransaction.deltaOnHand = PantryItem.onHandQty`, and the same for reserved.

## Monitoring and diagnosis

- **Health:** `GET /api/health` returns 200 when the database answers and 503 otherwise. Point an uptime monitor at it.
- **Logs:** JSON lines on stdout and stderr (`src/server/log.ts`) with `ts`, `level`, `msg` and `requestId`. Unhandled errors are logged with a stack trace, while the client only receives `INTERNAL`.
- **Audit trail:** `AuditLog` holds every mutation with its actor. `InventoryTransaction` is the stock ledger. For a disputed booking, start with `AuditLog` filtered by `entityId`.
- **Common faults:**

| Symptom | Likely cause | Fix |
|---|---|---|
| 503 health | Database down or wrong `DATABASE_URL` | Check the database and connection string |
| Every mutation returns 400 `BAD_ORIGIN` | `APP_ORIGIN` doesn't match the browser origin | Set `APP_ORIGIN` to the browser origin |
| Logins fail for everyone | Throttle window active after an attack | Wait 15 minutes, or delete recent `LoginAttempt` rows after an investigation |

## Migrations

Developers create migrations with `npm run db:migrate`, review the SQL (hand-written constraints included), and commit it. Production applies them only with `prisma migrate deploy`. Use expand/contract for anything destructive (`docs/deployment.md`).

## Credential rotation

| Credential | Rotation |
|---|---|
| `SESSION_SECRET` | Set a new value in Vercel and redeploy. This only affects IP hashing for throttling; sessions remain valid. |
| Database password | Rotate the role password in Neon, update `DATABASE_URL`, redeploy. |
| All sessions (forced logout) | `DELETE FROM "Session";` |
| A user's password | Run a one-off script that writes a new Argon2id hash, then delete that user's sessions. |

## Dependency updates

Run `npm outdated` monthly and `npm audit` on each PR. Upgrade Next.js and Prisma in their own PRs, read the docs bundled in `node_modules/next/dist/docs` and the Prisma upgrade guide, and keep CI green before merging. New packages with install scripts must be approved explicitly (`npm approve-scripts`).

## Recovery from a failed deployment

1. Roll back in Vercel to the last good deployment.
2. If a migration was applied, leave it in place. Expand-only migrations are backward compatible. Fix forward with a new migration.
3. Use `/api/health` and a test login to confirm the rollback.
