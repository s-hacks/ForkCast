# Testing

## Layers

| Layer | Location | Runs against | Command |
|---|---|---|---|
| Unit | `tests/unit/*.test.ts` | Pure domain code | `npm run test:unit` |
| Integration | `tests/integration/*.int.test.ts` | PostgreSQL `firehouse_test`, migrated once per run and reseeded before each test | `npm run test:int` |
| End-to-end | `tests/e2e/*.spec.ts` | `next build && next start` in a browser | `npm run test:e2e` |

The integration tests call the service layer directly, using session objects built for each test. They exercise real transactions, row locks, CHECK constraints and partial unique indexes, with no mocks. Concurrency is tested with `Promise.allSettled` over separate pooled connections.

## Coverage of the brief's Tests 1–17

| # | Scenario | Status | Where |
|---|---|---|---|
| 1 | Login | Integration | `admin-auth.int.test.ts` › logs in with correct credentials |
| 2 | Solo sees all slots and aggregates | Integration (service level) | `booking.int.test.ts` › organization context (solo view) |
| 3 | Organization selection without leaking another org's data | Integration | `booking.int.test.ts` › organization context sees its own commitments |
| 4 | Full 120-serving booking turns gray | Integration + unit | `booking.int.test.ts` › full 120/120; `availability.test.ts` |
| 5 | Partial 60 turns yellow, 60 remaining | Integration + unit | `booking.int.test.ts` › partial 60 |
| 6 | Second user completes the meal | Integration | `booking.int.test.ts` › partial 60 … completes it |
| 7 | 7 ingredients: 3 covered, 4 missing | Integration + unit | `booking.int.test.ts` › shows 7 ingredients |
| 8 | Partial grocery pledge | Integration | `booking.int.test.ts` › partial grocery pledge |
| 9 | Full grocery coverage turns gray | Integration | `booking.int.test.ts` › … full coverage turns gray |
| 10 | Pantry allocation without double allocation | Integration | `booking.int.test.ts` › use pantry is all-or-nothing; concurrent pantry reservations |
| 11 | Serving booking stays independent of food | Integration + unit | `booking.int.test.ts` › booking serving fills only the serving lane |
| 12 | Admin changes appear for users | Integration | `admin-auth.int.test.ts` › increasing servings reopens capacity |
| 13 | Unauthorized admin access denied | Integration | `admin-auth.int.test.ts` › server guards deny |
| 14 | Concurrency | Integration | `booking.int.test.ts` › concurrent last 60 servings; concurrent pantry reservations |
| 15 | Cancellation restores capacity, keeps history | Integration | `booking.int.test.ts` › modify and cancel; cancelling a grocery commitment; cancelling a pantry commitment |
| 16 | Persistence across restart | Integration (new DB connection) | `admin-auth.int.test.ts` › commitments persist across a new database connection |
| 17 | Dates across timezone and DST | Unit | `units-dates.test.ts` › dates (D-32, Test 17) |

Two gaps remain against the brief:

- Browser-level E2E for Tests 1–17 is limited to a smoke suite. Integration tests cover the same server behavior.
- Test 16 was not run as a full application process restart; it uses a fresh database connection instead.

## Additional integrity checks

These are covered beyond the brief's list:

- **Ledger invariant:** `assertLedger()` checks `Σ deltaOnHand = onHand`, `Σ deltaReserved = reserved` and `Σ ACTIVE allocations = reserved`.
- **Idempotency:** replay of a used key, a key reused on another route, and no record left behind by a failed mutation.
- **Plan edit conflicts:** warn then override, and stale-version rejection.
- **Stock correction conflicts:** a correction below reservations, and grocery receipt plus served reconciliation.
- **Login:** throttling and identical generic error messages.

## Executed results

Executed 2026-11-14 on macOS arm64, Node 24.18, PostgreSQL 17.11 (local user-space install):

| Command | Result |
|---|---|
| `npm run typecheck` | pass |
| `npx eslint .` | pass, 0 problems |
| `npm run test:unit` | 23 passed / 23 |
| `npm run test:int` (firehouse_test, real PostgreSQL, includes concurrency tests) | 29 passed / 29 |
| `npm run build` | pass (Next.js 16.4.6 production build) |
| `npx playwright test` (production build on :3200, firehouse_e2e) | 6 passed / 6 |
| `openspec validate --all --strict` | 12 passed, 0 failed |
| `npx prisma migrate status` | schema up to date |

CI (`.github/workflows/ci.yml`) is configured but has not run yet, because no remote repository is configured.
