# Proposal: project-foundation

## Why

The repository is empty. Every later feature needs the same base: a running Next.js app connected to a real PostgreSQL database through versioned migrations, plus shared conventions for errors, idempotency, auditing, configuration and tests. Building that base once means booking and inventory changes inherit consistent integrity guarantees instead of reinventing them.

## What Changes

The change sets up the application and its tooling:

- Scaffold a Next.js App Router app with strict TypeScript, Tailwind CSS v4, shadcn/ui, ESLint and Prettier.
- Add Prisma 7 with the `@prisma/adapter-pg` driver adapter, an initial migration (users, audit log, idempotency records), and a transaction helper.
- Add local PostgreSQL scripts for the user-space PostgreSQL 17 install (D-30), plus `docker-compose.yml` for machines that have Docker.
- Validate configuration at startup with Zod, failing fast on missing or unsafe values, and document every variable in `.env.example`.

It adds the shared server conventions:

- A typed `DomainError` with a single HTTP error mapper that returns the envelope from `docs/api-contracts.md`.
- Idempotency-key handling for mutations (FR-39) and an audit log writer (FR-40).
- `GET /api/health`, which checks database reachability (FR-41).
- A seed script entry point, and a demo reset script that refuses non-local or production databases (FR-42).

It adds the test and delivery infrastructure:

- Vitest unit and integration projects (integration runs against `firehouse_test`), Playwright configuration, and a GitHub Actions CI workflow with a PostgreSQL service.
- Project `README.md` and `CLAUDE.md`.

## Capabilities

### New Capabilities
- `platform-foundation`: Cross-cutting platform behavior: health reporting, configuration validation, the structured error contract, idempotent mutation handling, audit logging and the demo-reset safety guard.

### Modified Capabilities
None. No specs exist yet.

## Impact

- New code: `src/server/{db,domain/errors,services/{audit,idempotency}}`, `src/app/api/health`, `src/lib/http`, `prisma/`, `scripts/`, `tests/`, `.github/workflows/ci.yml`.
- New dependencies: next, react, prisma, @prisma/client, @prisma/adapter-pg, pg, zod, vitest, @playwright/test, eslint, prettier, tailwindcss, shadcn/ui primitives.
- No external services or paid resources.
