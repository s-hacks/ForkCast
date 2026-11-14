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
| 1 | Foundation | `project-foundation` | platform-foundation | in progress | |
| 2 | Auth & roles | `authentication-and-roles` | auth | todo | |
| 3 | Participation context | `participation-context` | participation-context | todo | |
| 4 | Pantry inventory | `pantry-inventory` | pantry-inventory | todo | |
| 5 | Meal planning | `meal-planning` | meal-planning | todo | |
| 6 | Availability engine | `availability-engine` | availability-engine | todo | |
| 7 | Meal calendar | `meal-calendar` | meal-calendar | todo | |
| 8 | Prepared food | `prepared-food-commitments` | prepared-food-commitments | todo | |
| 9 | Groceries + pantry allocation | `ingredient-planning` | ingredient-planning | todo | |
| 10 | Serving | `serving-assignments` | serving-assignments | todo | |
| 11 | My commitments | `my-commitments` | my-commitments | todo | |
| 12 | Admin dashboard & ops | `admin-operations` | admin-operations | todo | |
| 13 | Acceptance (E2E 1–17) | `integration-and-acceptance-testing` | (modifies several) | todo | |
| 14 | Hardening & deployment | `production-hardening-and-deployment` | platform-foundation | todo | |

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
