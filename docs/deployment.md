# Deployment

**Status: nothing has been deployed, and no paid or free external resources have been created.** The steps below target free tiers: Vercel Hobby for the app and Neon Free for PostgreSQL. Run them only with the project owner's authorization and accounts. Check current free-tier limits on the providers' pricing pages before relying on them.

## Architecture

The app is one Next.js deployment on the Node runtime, connected to a managed PostgreSQL 17 database. The Neon pooled connection string is used for the app, and the direct connection string for migrations. Diagram: `docs/architecture.md` §9.

## Environment variables

| Variable | Production value |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string with `sslmode=require` |
| `APP_ORIGIN` | `https://<your-domain>`. Must be https; config validation rejects http in production. |
| `SHELTER_TIMEZONE` | `America/Chicago` |
| `SESSION_SECRET` | 32 or more random characters (`openssl rand -base64 48`). Stored only in Vercel env settings. |
| `MEAL_START_TIMES` | `07:00,11:30,17:00`, confirmed with staff |

`SEED_*` variables must not be set in production. Development and production credentials must differ.

## Procedure

1. **Neon.** Create a project (PostgreSQL 17) and a database role for the app. Copy the pooled and direct connection strings.
2. **Migrate.** From a trusted machine, with the direct URL:
   ```bash
   DATABASE_URL="<direct-url>" npx prisma migrate deploy
   ```
   Only committed, reviewed migrations are applied. Never run `prisma migrate dev`, `db:seed` or `demo:reset` against production; the seed guard refuses `NODE_ENV=production` and non-local hosts.
3. **Create real accounts.** Run a one-off script with real usernames and strong passwords, hashed with the same Argon2id parameters. Do not use the demo seed.
4. **Vercel.** Import the GitHub repository and set the environment variables above for Production. The build command is `npm run build`; `postinstall` runs `prisma generate`.
5. **Deploy.** Deploy, then attach a domain. HTTPS is automatic on Vercel.
6. **Smoke tests:**
   ```bash
   curl -s https://<domain>/api/health            # {"status":"ok","db":"ok"}
   ```
   Then confirm in a browser:
   - Admin login works and `/admin` loads.
   - A volunteer login reaches `/context`.
   - A volunteer request to `/api/v1/admin/pantry` returns 403.
   - The calendar shows published meals.
   - A test commitment updates the status. Cancel it afterwards.
7. **Monitoring.** Add an uptime check on `/api/health` and review JSON logs in Vercel (`docs/operations.md`).

## Rollback

- **Application:** use Vercel's instant rollback to the previous production deployment.
- **Database:** use expand/contract migrations only. Add columns or tables first, deploy code that uses them, and remove old structures in a later release. A rollback then never needs a destructive down-migration. If data is damaged, restore with Neon point-in-time restore into a branch, verify it, then promote it (`docs/operations.md`).
- **Destructive migrations** need explicit sign-off and a fresh backup taken first.

## CI

`.github/workflows/ci.yml` runs on pull requests: install, lint, typecheck, unit tests, integration tests against a `postgres:17` service, and build.
