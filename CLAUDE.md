# CLAUDE.md: working on this repository

## Resume here

1. Read `docs/MILESTONES.md` for the current status and next work.
2. Run `export PATH="$HOME/.local/bin:$PATH"` so the OpenSpec CLI (2.0.0) is on your path, then `openspec list` and `openspec list --specs`.
3. Read `docs/assumptions-and-decisions.md`. Decisions D-01..D-34 are binding; cite their IDs instead of deciding the same question again.
4. Start PostgreSQL with `npm run db:start` (user-space install under `~/.local/pgsql17`, no sudo needed).

## OpenSpec workflow (mandatory for behavior changes)

The OpenSpec specs in `openspec/specs/<capability>/spec.md` are the authoritative record of behavior. Make every behavior change through a change:

1. Explore the requirement with `/openspec-explore`.
2. Create the proposal, delta specs, design and tasks with `/openspec-propose`.
3. Run `openspec validate <change> --strict`.
4. Implement with `/openspec-apply-change`.
5. Check the implementation against the artifacts with `/openspec-verify-change`.
6. Archive with `/openspec-archive-change` or `openspec archive <change> -y`.

The 2.0 skills replace the old `/opsx:*` commands. Delta specs use `## ADDED|MODIFIED|REMOVED Requirements`, `### Requirement:`, `#### Scenario:` with `- **WHEN**` / `- **THEN**`, and SHALL/MUST. Requirement text cites FR/NFR IDs from `docs/requirements.md`.

## Layering rules

- `src/server/domain`: pure functions (availability engine, units, dates). No I/O. Unit-tested.
- `src/server/services`: the only layer that opens transactions. It locks the plan row (`lockPlan`), loads aggregates, runs the engine, writes, audits, and returns the fresh detail.
- `src/app/api/v1`: thin handlers. They wrap work in `api()` (Origin check), read `idempotencyKey()`, parse with a Zod schema from `src/lib/schemas.ts`, call one service, and return JSON.
- Client components never import `@/server/*`, and never compute statuses; they render what the server returns.
- Lock order is plan rows ascending, then pantry items ascending (D-28). Pantry reservations go only through `tryReserve` (a conditional UPDATE) and other helpers in `services/stock.ts`, each of which writes a ledger row.
- Quantities are integer base units (g, ml, each). Dates are `YYYY-MM-DD` strings in `SHELTER_TIMEZONE`.
- Never delete commitment, allocation or ledger history; move rows to a terminal status instead.

## Tests

```bash
npm run typecheck && npm run lint
npm run test:unit          # pure domain
npm run test:int           # needs PostgreSQL; uses firehouse_test from .env.test and reseeds per test
npm run test:e2e           # Playwright
```

Never claim a test passed unless you ran it. Record executed commands and results in `docs/testing.md`.

## Safety

- Never commit `.env*` files (only `.env.example`) or real passwords.
- `npm run demo:reset` and the seed refuse non-local databases unless `ALLOW_DEMO_RESET=true` is set, and always refuse when `NODE_ENV=production`.
- Do not deploy, create paid resources, or run destructive migrations against production without explicit authorization.
