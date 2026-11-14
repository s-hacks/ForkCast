# Proposal: core-meal-coordination

## Why

Volunteers and partner organizations need one place to see what each meal needs, what is already covered and what the pantry holds. Without that view they buy duplicate groceries, double-book serving and leave pantry stock unused. The platform foundation exists, so this change delivers the complete coordination workflow on top of it.

## What Changes

Volunteers get:

- Username and password authentication with database sessions, Argon2id hashing, throttling and server-side role checks.
- A choice of participation context: solo, or one organization they belong to.
- A month calendar and meal detail views that apply context-scoped visibility rules.
- Prepared-food commitments, grocery pledges, all-or-nothing pantry allocation and serving bookings.
- A My Commitments page with modify and cancel actions.

Administrators get:

- Meal plans with recipe lines, a draft/publish/cancel lifecycle, and warn-then-override conflict handling.
- A pantry inventory with physical stock separated from reservations, an append-only ledger and unit conversion.
- A dashboard, grocery receipt recording and served-meal reconciliation.

Under both sits a server-authoritative availability engine. It implements the dynamic prepared/kitchen split, three independent lanes and the overall slot status.

## Capabilities

### New Capabilities
- `auth`: login, sessions, throttling, role enforcement.
- `participation-context`: solo or organization selection and attribution.
- `meal-planning`: admin plan lifecycle, recipe lines, conflict handling.
- `pantry-inventory`: stock, reservations, ledger, units.
- `availability-engine`: lane and slot status computation and concurrency rules.
- `meal-calendar`: calendar, visibility and meal details.
- `prepared-food-commitments`: prepared servings.
- `ingredient-planning`: grocery pledges and pantry allocation.
- `serving-assignments`: serving bookings.
- `my-commitments`: the volunteer's own commitment list and changes.
- `admin-operations`: dashboard, grocery receipt, served reconciliation.

### Modified Capabilities
None.

## Impact

- New code in `src/server/{auth,domain,services}`, `src/app/api/v1/**`, the volunteer and admin pages, `prisma/seed.ts`, and tests in `tests/unit` and `tests/integration`.
- Single migration `init`, covering every table plus the hand-written constraints.
