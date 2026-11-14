# Design: project-foundation

## Context

The repository starts empty. The machine has Node 24 but no Docker, Homebrew or sudo. PostgreSQL 17.11 is installed in user space (D-30). The system architecture is described in `docs/architecture.md`; this design covers only the base layer.

## Goals / Non-Goals

**Goals:**

- One command each to install, migrate, seed, run, test and build.
- Shared conventions (errors, idempotency, audit, transactions) that later changes use without modification.
- A real PostgreSQL database for both development and tests.

**Non-Goals:**

- Feature tables beyond `User`, `AuditLog` and `IdempotencyRecord`. Later changes add their own migrations.
- Deployment to a provider, which belongs to the change `production-hardening-and-deployment`.

## Decisions

1. **Scaffold with `create-next-app` and pin its versions.** The generated config is the best-supported baseline for Next 16 (App Router, Turbopack, Tailwind v4, ESLint flat config). A hand-rolled config was rejected because it drifts from upstream defaults.

2. **Prisma 7 with the `prisma-client` generator and `@prisma/adapter-pg`.** Prisma 7 requires a driver adapter and an explicit generator output path ([Prisma 7 upgrade guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)). The client is generated to `src/generated/prisma`, which is gitignored. `prisma.config.ts` reads `DATABASE_URL`.

3. **`withTx(fn)` helper.** It wraps `prisma.$transaction(fn, {isolationLevel: 'ReadCommitted', timeout: 10_000})`. Read Committed plus explicit row locks (D-28) is predictable and avoids the retry storms that Serializable produces under contention. Serializable is not used.

4. **Idempotency is recorded inside the business transaction.** `runIdempotent({userId, key, route}, fn)` runs in this order:
   - It executes `INSERT … ON CONFLICT DO NOTHING RETURNING` on `IdempotencyRecord(userId, key)` with a placeholder status.
   - If the insert returned nothing, the key is already recorded. A concurrent in-flight insert blocks on the unique index until the first transaction commits. The helper then reads the stored row and returns it, or returns `IDEMPOTENCY_KEY_REUSED` when the route differs.
   - Otherwise it runs `fn` in the same transaction and updates the record with the response.

   If `fn` throws a `DomainError`, the transaction rolls back, the key is not consumed, and the client may retry with the same key after fixing input. Only successful responses are replayed. Storing failure responses was rejected because it would block a legitimate retry after a capacity change.

5. **Error mapping.** `DomainError(code, message, extras)` uses a closed set of `ErrorCode` values. `toHttpResponse(err)` maps codes to statuses from a single table, and Zod errors are converted to `VALIDATION_ERROR` with `fieldErrors`. Route handlers are wrapped by `apiHandler(opts, fn)`, which centralizes auth hooks (added in the next change), the Origin check, idempotency, and error mapping with request-id logging.

6. **Config.** `src/server/config.ts` validates `process.env` with Zod lazily on first access, which keeps `next build` working without a database. `instrumentation.ts` calls it at server start, so the server still fails fast.

7. **Logging.** A minimal JSON logger (`src/server/log.ts`) writes to stdout and stderr with a level, message, requestId and context. Hosted platforms ingest stdout, so a logging dependency is unnecessary.

8. **Test databases.** Integration tests use `firehouse_test`. A Vitest global setup runs `prisma migrate reset --force --skip-seed` once per run, and each test file truncates the tables it touches through a `resetDb()` helper. E2E tests use the separate `firehouse_e2e` database, seeded before Playwright starts the production server.

9. **Local PostgreSQL scripts.** `scripts/db/pg-local.sh {start|stop|status|psql}` wraps `pg_ctl` with `PGHOME` and `PGDATA`, which default to the user-space install. `docker-compose.yml` defines `postgres:17` with the same credentials for people who have Docker.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Next 16 or Prisma 7 APIs differ from older docs | Follow the docs bundled in the installed packages and pin exact versions |
| The user-space PostgreSQL is not a service and stops on reboot | `npm run db:start` is documented; the health endpoint shows 503 |
| Replay of successful responses only means a retry after a failure re-executes | This is the intended behavior: failures have no side effects |

## Migration Plan

The initial migration is `0001_init`. Hand-written SQL is appended only where later tables need it.
