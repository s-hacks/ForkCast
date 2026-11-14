# Tasks: project-foundation

## 1. Scaffold and tooling
- [x] 1.1 Scaffold Next.js (App Router, TS strict, Tailwind, ESLint, src dir, `@/*` alias) and pin dependency versions
- [x] 1.2 Add Prettier config, `format` and `format:check` scripts, and `.editorconfig`
- [x] 1.3 UI primitives: plain Tailwind components used instead of shadcn/ui (time constraint, see D-34)
- [x] 1.4 Add ESLint `no-restricted-imports` so client code cannot import `@/server/*`

## 2. Database
- [x] 2.1 Add `scripts/db/pg-local.sh` and `docker-compose.yml`; create `.env.example`, `.env` and `.env.test` (the last two gitignored)
- [x] 2.2 Add Prisma 7 (`prisma.config.ts`, `schema.prisma` with User, AuditLog, IdempotencyRecord) and the `src/server/db/client.ts` singleton with the pg adapter
- [x] 2.3 Create migration `0001_init`, then run `db:migrate` against dev and test
- [x] 2.4 Add `withTx` helper and typed `Tx` alias

## 3. Platform conventions
- [x] 3.1 Add `src/server/config.ts` with Zod env validation and instrumentation hook
- [x] 3.2 Add `src/server/log.ts` JSON logger
- [x] 3.3 Add `DomainError`, error codes, status table and `toHttpResponse`
- [x] 3.4 Add `apiHandler` wrapper (Origin check for mutations, request id, error mapping, idempotency hook)
- [x] 3.5 Add `runIdempotent` service
- [x] 3.6 Add `writeAudit(tx, entry)` service
- [x] 3.7 Add `GET /api/health`
- [x] 3.8 Add `prisma/seed.ts` skeleton and `scripts/demo-reset.ts` with host guard

## 4. Tests and CI
- [x] 4.1 Add Vitest workspace: `unit` (node) and `integration` (node, global setup migrates `firehouse_test`, serial files)
- [x] 4.2 Add unit tests for config validation, error mapping and the reset host guard
- [x] 4.3 Add integration tests for idempotency (missing key, replay, concurrent duplicates, reused key), audit atomicity and health
- [x] 4.4 Add Playwright config (webServer = `next start` on the e2e database) and a smoke test that the landing page renders
- [x] 4.5 Add GitHub Actions `ci.yml`: install, prisma generate, lint, typecheck, unit, integration (postgres:17 service), build, e2e

## 5. Docs and gate
- [x] 5.1 Write `README.md` (setup, scripts) and `CLAUDE.md` (conventions, workflow, how to resume)
- [x] 5.2 Quality gate: `npm run typecheck && npm run lint && npm run test:unit && npm run test:int && npm run build`
- [x] 5.3 Record executed commands and results in `docs/testing.md`
