# ForkCast: Meal Coordination

ForkCast is a web app for Firehouse Ministries, a Birmingham, AL shelter that serves breakfast, lunch and dinner every day. Administrators publish meal plans and maintain pantry stock. Signed-in volunteers, either solo or on behalf of an organization, can see what each meal still needs and:

- bring prepared food
- pledge groceries
- allocate pantry stock
- sign up to serve

All availability math, white/yellow/gray statuses and capacity checks run on the server against PostgreSQL.

**Stack:**

| Layer | Tools |
|---|---|
| Web app | Next.js 16 (App Router), React 19, strict TypeScript, Tailwind CSS v4 |
| Data | PostgreSQL 17 via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Argon2id password hashing, DB-backed sessions |
| Validation | Zod |
| Tests | Vitest, Playwright |

## Quick start

Install Node 22.12+ (developed on Node 24), then:

```bash
# 1. Start PostgreSQL. Pick one:
npm run db:start            # user-space PostgreSQL 17 install (see docs/operations.md)
docker compose up -d        # if Docker is available

# 2. Configure the app.
cp .env.example .env        # set DATABASE_URL, SESSION_SECRET (32+ chars), SEED_* passwords

# 3. Install, migrate and seed.
npm install                 # also runs prisma generate
npx prisma migrate deploy
npm run db:seed             # demo data; truncates local DB only

# 4. Run.
npm run dev                 # http://localhost:3000
```

The seed creates these demo accounts. Passwords come from `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD` in your `.env`; none are committed.

| Username | Role | Organizations |
|---|---|---|
| `admin` | Administrator | none |
| `maria` | Volunteer | St. Paul's Church, UAB Hospital Volunteers |
| `james` | Volunteer | St. Paul's Church |
| `aisha` | Volunteer | UAB Hospital Volunteers |
| `sam` | Volunteer | none (solo only) |

`npm run demo:reset` restores the demo dataset. It refuses to run against a non-local database or when `NODE_ENV=production`. The scenario walkthrough is in [docs/user-workflows.md](docs/user-workflows.md).

## Scripts

| Script | Purpose |
|---|---|
| `dev` / `build` / `start` | Next.js development server, production build, production server |
| `typecheck` | `next typegen && tsc --noEmit` |
| `lint` / `format` / `format:check` | ESLint, Prettier |
| `db:start` / `db:stop` | Start or stop the user-space PostgreSQL install |
| `db:migrate` | `prisma migrate dev` (creates a new migration) |
| `db:deploy` | `prisma migrate deploy` (applies committed migrations) |
| `db:seed` / `demo:reset` | Truncate and reseed the local demo dataset |
| `test:unit` | Domain engine, units and dates (no database) |
| `test:int` | Services against the `firehouse_test` PostgreSQL database |
| `test:e2e` | Playwright browser tests |

## Project structure

```
src/
  app/                 pages (volunteer, admin) and /api/v1 route handlers
  components/          UI components (StatusBadge, calendar, panels)
  lib/                 shared Zod schemas, browser API client
  server/
    auth/              sessions, Argon2id, throttling, guards
    domain/            pure availability engine, units, dates, errors
    services/          transactions: meals, commitments, admin, stock, context
    db/                Prisma client and transaction helper
prisma/                schema, migrations, seed
openspec/              specs (authoritative behavior) and archived changes
tests/                 unit/, integration/, e2e/
docs/                  requirements, architecture, decisions, guides
```

## Documentation

| Topic | File |
|---|---|
| Requirements and traceability | [docs/requirements.md](docs/requirements.md) |
| Business rules and decisions (D-01..D-34) | [docs/assumptions-and-decisions.md](docs/assumptions-and-decisions.md) |
| Architecture | [docs/architecture.md](docs/architecture.md) |
| Database design | [docs/database-design.md](docs/database-design.md) |
| API contracts | [docs/api-contracts.md](docs/api-contracts.md) |
| User and admin guide, demo walkthrough | [docs/user-workflows.md](docs/user-workflows.md) |
| Testing | [docs/testing.md](docs/testing.md) |
| Deployment | [docs/deployment.md](docs/deployment.md) |
| Operations | [docs/operations.md](docs/operations.md) |
| Milestones | [docs/MILESTONES.md](docs/MILESTONES.md) |

The app's design is unofficial. It does not use or imitate an official Firehouse Ministries logo.
