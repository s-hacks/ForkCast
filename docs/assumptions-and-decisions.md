# Assumptions and Decisions

This file records every business rule and technical choice that the brief left open. Each one gets an ID, and specs, code comments and tests cite that ID. A **[Stakeholder]** tag means the project owner chose it on 2026-11-14. **[Default]** means engineering picked a documented default that Firehouse Ministries staff should confirm before production.

## Business rules

### Fulfillment model

**D-01 Dynamic split between prepared food and kitchen cooking. [Stakeholder]**
A published meal plan has a serving target `N`. Prepared-food commitments add up to `P` servings. The kitchen portion is `K = N − P`, and only `K` servings need ingredients. Ingredient demand for each recipe line is `D_i(K) = ceil(q_i × K / Y)`, where `q_i` is the line quantity in base units and `Y` is the recipe yield in servings. If 60 of 120 chili servings arrive prepared, the grocery and pantry screens ask for 60 servings' worth of ingredients, not 120.

**D-02 Prepared food never strands grocery pledges.**
A grocery pledge is a promise someone is already acting on, so prepared food cannot shrink demand below what volunteers have pledged. For each line `i` with pledged quantity `g_i > 0`, the smallest kitchen portion that still needs all of `g_i` is `Kmin_i = floor((g_i − 1) × Y / q_i) + 1`. `Kmin = max_i Kmin_i`, or 0 when nothing is pledged. Remaining prepared-food capacity is `N − P − Kmin`, never below 0.

**D-03 Pantry reservations shrink when demand drops.**
Pantry reservations cost no volunteer anything, so when a prepared-food commitment lowers `K`, the same transaction trims reservations that now exceed `D_i(K) − g_i`, newest first. Trimmed quantity goes back to the pantry's available stock, and an audit row is written. The reverse does not happen automatically: if demand rises (for example, prepared food is cancelled), the reopened shortage waits for the next ingredient action.

**D-04 Committing an ingredient plan reserves pantry stock. [Stakeholder]**
Both "Bring groceries" and "Use pantry" first reserve, in the same transaction, whatever unreserved pantry stock can cover the meal's remaining ingredient demand. Donors can only pledge the shortage that is left after that. Pantry stock that is not reserved never counts as coverage, so one kilogram can never cover two meals.

**D-05 "Use pantry" is all-or-nothing.**
"Use pantry" succeeds only when unreserved stock covers every remaining ingredient line in full. When it cannot, the screen lists the shortages and links to "Bring groceries". That flow still reserves the partial pantry stock under D-04, so nothing is lost.

**D-06 Grocery pledge cap.**
For each line, the most anyone can pledge is `S_i = max(0, D_i − r_i − g_i − a_i)`. Here `r_i` is stock reserved for this meal, `g_i` is the quantity already pledged, and `a_i` is unreserved pantry stock that the same transaction will reserve. The server recomputes this under lock. If the submitted quantity exceeds the fresh cap, the request is rejected with `409 CAPACITY_EXCEEDED` and the current numbers.

**D-07 Three independently tracked lanes.**
Each published meal has three lanes, and each lane gets its own status:

| Lane | Coverage | Capacity |
|---|---|---|
| Prepared food | `P` servings | `N − Kmin` |
| Ingredients | `min_i (r_i + g_i) / D_i` per line | `D_i(K)` per line |
| Serving | active serving bookings | `serviceCapacity` (default 1) |

A full serving lane never closes a food lane, and a full ingredient lane never marks serving as filled.

**D-08 Lane status semantics.**
Each lane is in exactly one of these states:

- `AVAILABLE` (white): no coverage yet, capacity remains.
- `PARTIAL` (yellow): some coverage, capacity remains.
- `FULL` (gray): no capacity remains.
- `NOT_NEEDED`: shown only on the ingredient lane, when `K = 0` because prepared food covers every serving.
- `CONFLICTED`: an admin override left coverage above capacity (D-14).

A meal whose recipe has no ingredient lines is prepared-food-only. Its ingredient lane is `NOT_NEEDED` and prepared capacity is `N`.

**D-09 Overall slot status.**
The calendar shows one slot status, computed in this order:

1. `UNSCHEDULED` when the slot has no published plan.
2. `CANCELLED` when the plan is cancelled.
3. `CLOSED` once the meal start time has passed.
4. `CONFLICTED` when any lane is conflicted.
5. `FULL` when food is covered (`P + K_covered ≥ N`) and serving is full.
6. `AVAILABLE` when every applicable lane is `AVAILABLE`.
7. `PARTIAL` otherwise.

`K_covered = min_i floor((r_i + g_i) × Y / q_i)`, capped at `K`. Every color is paired with an icon and a text label.

**D-10 Serving lane.**
The default capacity is one serving booking per meal, which can represent one person or a group. Admins may raise it per meal. A user can hold at most one active serving booking per meal.

### Commitments

**D-11 One active commitment per user, meal and type.**
A user holds at most one active commitment of each type (prepared, grocery, pantry, serving) per meal, regardless of participation context. To change an amount they modify that commitment rather than adding a second. A partial unique index enforces this.

**D-12 Idempotency.**
Every mutating request carries an `Idempotency-Key` (a UUID generated when the form renders). A key the same user has already used returns the original result with no new write, enforced by a unique key on (user, key).

**D-13 Cancellation and modification window.**
Volunteers can create, modify or cancel their own commitments until the meal's start time in the shelter timezone. Defaults are breakfast 07:00, lunch 11:30 and dinner 17:00, set through `MEAL_START_TIMES`. Lunch at 11:30 matches the shelter's published schedule ([firehouseshelter.com](https://firehouseshelter.com/meals-program/)), though another of its pages says noon. Breakfast and dinner times are unverified placeholders. Cancelling sets status to `CANCELLED` and records `cancelledAt`. Rows are never deleted. Cancelling a grocery commitment reopens its shortage, and cancelling a pantry commitment releases its reservations. [Default: no earlier cut-off; staff may want 24 h.]

### Admin edits

**D-14 Conflicting admin edits: warn, then explicit override. [Stakeholder]**
A meal-plan edit can conflict with existing coverage: fewer servings than committed, a smaller recipe line than pledged, a removed line that has pledges, or a cancelled plan that has commitments. The server returns `409 PLAN_CONFLICT` and lists the affected commitments without saving. The admin can resubmit with `acknowledgeConflicts: true`. On override:

1. Pantry reservations above the new demand are released (D-03).
2. Volunteer commitments are never deleted or silently cut. Remaining over-coverage puts the affected lane into `CONFLICTED`, and those commitments show "Needs attention" until the volunteer reduces or cancels them.
3. An audit row records the override and the conflict snapshot.

Conflict is computed from data, never stored as a flag, so it clears as soon as coverage fits capacity again.

**D-15 Removing a recipe line is a soft delete.**
The line gets `removedAt`, its demand becomes 0, and any remaining coverage on it makes the lane conflicted until resolved.

**D-16 Plan lifecycle.**
A plan moves `DRAFT → PUBLISHED → COMPLETED`, or to `CANCELLED` from either `DRAFT` or `PUBLISHED`. Drafts stay invisible to volunteers. Publishing requires a dish name, servings > 0, recipe yield > 0, serving capacity ≥ 1, and valid ingredient lines (zero lines means prepared-food only). A plan cannot move to another slot; the admin cancels it and creates a new one.

### Inventory

**D-17 Physical stock and reservations are separate columns.**
Each `PantryItem` has `onHandQty` and `reservedQty` with the database check `0 ≤ reservedQty ≤ onHandQty`. Available stock is `onHandQty − reservedQty`. A reservation is a conditional `UPDATE … WHERE onHandQty − reservedQty ≥ q`. Zero rows updated means insufficient stock, and the check constraint backs this up.

**D-18 Pledged groceries are not stock.**
A pledge raises neither `onHandQty` nor `reservedQty`. When an admin records it as received (all or part), one transaction does three things: it adds the received quantity to `onHandQty` through an `INVENTORY_RECEIPT` transaction, reserves the same quantity for the pledged meal, and marks the pledge line `RECEIVED` with the received quantity. Any shortfall reopens as a shortage.

**D-19 Reconciliation without double subtraction.**
After a meal, the admin marks it **Served**. Each active reservation becomes `CONSUMED`, and `onHandQty` and `reservedQty` both drop by that quantity through a `CONSUMPTION` transaction. Admins must not also enter a manual adjustment for consumed food; the admin guide says this. Manual adjustments are for receipts, spoilage and count corrections only.

**D-20 Admin stock corrections that undercut reservations.**
If a correction would set `onHandQty` below `reservedQty`, the server returns `409 RESERVATION_CONFLICT` and lists the affected meals. On override, reservations are trimmed (soonest meal keeps priority, latest meal trimmed first) until the check holds, and the affected ingredient lanes reopen. Every adjustment, trim included, writes an `InventoryTransaction`.

**D-21 Units.**
There are three unit kinds:

| Kind | Base unit | Accepted input units |
|---|---|---|
| Mass | gram | g, kg, oz, lb |
| Volume | millilitre | ml, l |
| Count | each | each |

Input is converted to integer base units by rounding half up, so 1 lb becomes 454 g. Display uses the item's preferred unit. A recipe line must use the same kind as its pantry item, and mismatched kinds are rejected with `UNIT_INCOMPATIBLE` rather than converted.

### Participation and visibility

**D-22 Participation context lives on the session.**
The participation context is solo or one organization. It is stored on the server-side session row, checked against `OrganizationMembership` when selected and again on every commitment, and copied onto each commitment. The user's role never changes.

**D-23 Visibility.**
Every viewer sees aggregate numbers per lane and their own commitments. In an organization context, a member also sees that organization's commitments with member display names. No viewer ever sees another organization's name, its members, or per-commitment rows. Solo viewers never see other volunteers' identities.

**D-24 Admins manage; they do not volunteer.**
Admin accounts cannot select a participation context or create commitments. An admin sees aggregate coverage and, for operational follow-up, commitment details on admin pages. [Default]

**D-25 Organizations are seeded.**
Organizations and memberships come from seed data or the admin seed script. Organization-management screens are out of MVP scope.

## Technical decisions

**D-26 Custom database-backed sessions instead of Auth.js.**
Auth.js raises `UnsupportedStrategy` when the Credentials provider is combined with database sessions, so credential logins are effectively limited to JWT sessions ([Auth.js session strategies](https://authjs.dev/concepts/session-strategies), [Auth.js credentials docs](https://authjs.dev/getting-started/authentication/credentials)), and the brief requires server-managed sessions. The app instead follows the session pattern recommended after Lucia's deprecation ([lucia-auth.com/sessions](https://lucia-auth.com/sessions/basic)). Each session is a random 160-bit token. Only its SHA-256 hash is stored. The cookie is HttpOnly, SameSite=Lax, and `__Host-`/Secure in production. Expiry is 12 h, renewed on activity. Passwords are hashed with Argon2id (`@node-rs/argon2`) at OWASP's minimum parameters: m = 19 MiB, t = 2, p = 1 ([OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)).

**D-27 Login throttling lives in the database.**
Failed attempts are stored per normalized username and per client IP. Five username failures within 15 min lock that username for 15 min, and 30 IP failures within 15 min block that IP. Every failure returns "Invalid username or password." Unknown usernames still run an Argon2 verify against a dummy hash so response timing does not reveal which usernames exist.

**D-28 Locks for concurrency.**
Every mutation that touches a meal runs in a transaction that starts with `SELECT … FOR UPDATE` on the meal-plan row, then locks pantry items in ascending id order through conditional updates. Admin inventory paths that touch reservations lock the affected plans first, ordered by id, then the item. This single lock order prevents deadlocks.

**D-29 REST route handlers for mutations.**
Mutations go through REST route handlers under `/api/v1`, which gives the API documented HTTP semantics and lets integration tests call it directly. Server components read through the service layer. Route handlers check the `Origin` header on every non-GET request for CSRF protection, alongside the SameSite cookie.

**D-30 Local PostgreSQL without root. [Stakeholder: free/open-source only]**
Local development uses PostgreSQL 17.11 from the official EDB binary distribution, installed under `~/.local/pgsql17` and run by the user (`scripts/db/pg-local.sh`). `docker-compose.yml` is provided for machines with Docker. The production target is free tiers only (Vercel Hobby + Neon Free), and nothing is provisioned without authorization.

**D-31 Calendar is a custom component.**
The month grid has three meal slots per day, which off-the-shelf day pickers cannot render, so the calendar is built in-house. It follows the WAI-ARIA grid pattern on desktop and switches to a day-agenda list on mobile.

**D-32 Timezone.**
`SHELTER_TIMEZONE` defaults to `America/Chicago` (Firehouse Ministries is at 626 2nd Ave. N., Birmingham, AL; [firehouseshelter.com](https://firehouseshelter.com/meals-program/), [Alabama NewsCenter](https://alabamanewscenter.com/?p=222192)). Meal dates are stored as PostgreSQL `DATE` and passed around as `YYYY-MM-DD` strings. Date arithmetic works on calendar dates, never by adding 24 h of milliseconds. "Today" and meal start instants are computed in the shelter timezone with `@date-fns/tz`.

## Open stakeholder questions

1. Should cancellations close earlier than meal start, for example 24 h before? (D-13)
2. Should admins also be able to volunteer from a separate account context? (D-24)
3. Are the default meal start times (07:00, 11:30, 17:00) correct?
4. How many serving volunteers or groups does a typical meal need? (D-10 default is 1)
5. Should grocery receipt recording be split by line or by whole commitment? MVP records by line.

## Future enhancements (out of MVP)

These stay out of the MVP:

- Payments and fundraising
- SMS or email reminders
- AI meal suggestions and forecasting
- Barcode scanning
- Native apps
- Staff management
- Multi-shelter tenancy
- Delivery routing
- Organization self-service management
- A reusable recipe library
