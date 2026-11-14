# Milestone Checklist and Roadmap

Keep this file current. A new session resumes from here: read this file, `CLAUDE.md`, and `openspec list`.

Each milestone maps to one OpenSpec change. A milestone is done only when all of these hold:

- typecheck, lint and the relevant tests pass
- migrations apply cleanly
- `openspec validate <change> --strict` passes
- the change is archived
- the work is committed

| # | Milestone | OpenSpec change | Capabilities (specs) | Status | Commit |
|---|---|---|---|---|---|
| 0 | Requirements & architecture | — (docs/) | — | done | |
| 1 | Foundation | `project-foundation` (archived) | platform-foundation | done | |
| 2 | Auth & roles | `core-meal-coordination` (archived) | auth | done | |
| 3 | Participation context | `core-meal-coordination` (archived) | participation-context | done | |
| 4 | Pantry inventory | `core-meal-coordination` (archived) | pantry-inventory | done | |
| 5 | Meal planning | `core-meal-coordination` (archived) | meal-planning | done | |
| 6 | Availability engine | `core-meal-coordination` (archived) | availability-engine | done | |
| 7 | Meal calendar | `core-meal-coordination` (archived) | meal-calendar | done | |
| 8 | Prepared food | `core-meal-coordination` (archived) | prepared-food-commitments | done | |
| 9 | Groceries + pantry allocation | `core-meal-coordination` (archived) | ingredient-planning | done | |
| 10 | Serving | `core-meal-coordination` (archived) | serving-assignments | done | |
| 11 | My commitments | `core-meal-coordination` (archived) | my-commitments | done | |
| 12 | Admin dashboard & ops | `core-meal-coordination` (archived) | admin-operations | done | |
| 13 | Acceptance (E2E 1–17) | — | — | partial: Tests 1–17 covered by integration/unit tests (docs/testing.md); browser E2E is a smoke suite | |
| 14 | Hardening & deployment | — | — | partial: docs + CI + security headers done; deployment not executed (no authorization/accounts) | |

## Delivery note (2026-11-14)

The stakeholder set a 1.5-hour delivery window, so milestones 2–12 were delivered as one OpenSpec change, `core-meal-coordination`, with 11 capability specs. The specs keep the planned boundaries, so future changes can target each capability on its own.

## Next work

The remaining work, in priority order:

1. Browser E2E for Tests 1–17.
2. A grocery-pledge modify endpoint.
3. Adopt shadcn/ui (D-34).
4. Deploy, after authorization.

## Changes to the brief's suggested boundaries

The brief suggested a set of change boundaries. This plan alters several of them:

- **Pantry inventory before meal planning.** Plan ingredient lines reference `PantryItem`, so the inventory catalog has to exist first. This removes a circular dependency.
- **One `ingredient-planning` change.** Grocery donation and pantry allocation are merged, because D-04 makes them share one transaction path. Splitting them would duplicate the locking and shortage logic.
- **`availability-engine` as its own change.** The engine is pure and central. Specifying it once keeps the booking changes small and stops each booking change from re-deriving the status rules.
- **Status logic folded into the engine.** The suggested `booking-availability-and-status` change is absorbed into `availability-engine` and the booking changes.
- **Organizations folded into participation context.** The suggested `organizations-and-user-context` change becomes `participation-context`. Organization CRUD is out of scope (D-25).

## Environment notes (this machine)

- Node 24.18, npm 11.16. OpenSpec 2.0.0 is installed to `~/.local/bin`, so add it to `PATH`.
- PostgreSQL 17.11 runs under `~/.local/pgsql17` with data in `~/.local/var/pgdata17`. Start it with `scripts/db/pg-local.sh start`.
- Docker and Homebrew are not installed, because there is no non-interactive sudo. `docker-compose.yml` is provided for other machines.
