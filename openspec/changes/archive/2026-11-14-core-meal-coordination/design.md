# Design: core-meal-coordination

## Context

The full design lives in `docs/architecture.md` (layers, state machines, allocation sequence, threat model) and `docs/database-design.md` (ER diagram, constraints, ledger invariant). The business rules are decisions D-01 to D-33 in `docs/assumptions-and-decisions.md`. This file records only the choices specific to delivering the change.

## Goals / Non-Goals

**Goals:**

- Ship every primary volunteer and admin workflow end to end, on real PostgreSQL.
- Keep all integrity rules server-side.

**Non-Goals:**

- Organization self-service.
- A recipe library.
- Notifications.
- Production deployment.

## Decisions

1. **One change instead of eleven.** The roadmap planned milestones 2–12 as separate changes. They were merged into this one because the stakeholder set a 1.5-hour delivery window. The capability specs keep the intended boundaries, so later work can still modify each capability on its own.
2. **Single initial migration.** All tables went into `init`, because nothing had been deployed and splitting the migration would have added no safety.
3. **Domain engine is pure** (`src/server/domain/availability.ts`). Services lock, load aggregates, call the engine, write and return the recomputed detail (D-28, FR-22).
4. **Idempotency inside the business transaction** (`runIdempotent`). Only successful responses are replayed.
5. **Plan row lock plus conditional pantry updates.** Pantry items are locked in ascending id order. Admin stock paths lock affected plans first.

## Risks / Trade-offs

- A coarse change makes per-milestone review harder. The mitigation is that tasks are grouped by milestone, and each group names the tests that cover it.
- E2E coverage is a smoke suite. The brief's Tests 1–17 are covered mainly by integration tests against PostgreSQL (`docs/testing.md`).
