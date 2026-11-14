# Requirements: Firehouse Ministries Meal Coordination

Status: baseline v1, 2026-11-14. The OpenSpec specs under `openspec/specs/` are the authoritative behavioral record. This document is the analysis that feeds them. Decision IDs (`D-xx`) point to `docs/assumptions-and-decisions.md`.

## 1. Problem

Firehouse Ministries in Birmingham, AL serves three meals a day, seven days a week, to people experiencing homelessness. It averaged about 125 meals a day in recent years ([firehouseshelter.com](https://firehouseshelter.com/meals-program/)). Volunteers and partner organizations bring prepared food, donate groceries, rely on pantry stock, and serve meals, but there is no shared view of what is planned, what is already covered and what is still missing. The results are duplicate purchases, surplus donations, double-booked serving slots and pantry stock nobody uses.

## 2. Actors and permissions

| Actor | Authenticated as | Can | Cannot |
|---|---|---|---|
| Visitor | none | See the landing page and log in | See any meal, inventory or commitment data |
| Volunteer (role `USER`) | own account | Choose a participation context, browse the calendar, create, modify or cancel their own commitments | Edit plans, recipes or stock; act for an org they don't belong to; touch others' commitments; gain admin |
| Administrator (role `ADMIN`) | admin account | Create, edit, publish or cancel meal plans; manage pantry items and stock; record grocery receipts; reconcile served meals; view shortages and coverage | Create volunteer commitments (D-24); create accounts from the UI (MVP) |
| Organization (data only) | n/a | Is represented by member volunteers | Log in |

## 3. Functional requirements

Each line gives the ID, the requirement, and its source: **B** (explicit business requirement from the brief) or **T** (technical requirement derived from it).

### Authentication and access (capability `auth`)
- **FR-01** Users log in with a unique username and password. (B)
- **FR-02** Passwords are stored only as Argon2id hashes (D-26). (B)
- **FR-03** Sessions are server-managed, expire after 12 h of inactivity, and logout revokes them. (B)
- **FR-04** Every failed login returns the same generic message, and repeated failures are throttled per username and per IP (D-27). (B)
- **FR-05** The server enforces role-based access on every page and API. Role comes only from the database user record. (B)
- **FR-06** The landing page offers "Enter as User" and "Enter as Administrator". Both lead to a login form and neither skips authentication. (B)
- **FR-07** There is an endpoint that returns the current user and their authorized organizations. (B)

### Participation context (capability `participation-context`)
- **FR-08** After login, a volunteer chooses Solo or one of their organizations (D-22). (B)
- **FR-09** The server rejects any organization the user is not a member of, both at selection time and at commitment time. (B)
- **FR-10** Each commitment stores the acting user, the context type, the organization (if any), the meal slot, the type and the amount. (B)

### Meal planning (capability `meal-planning`)
- **FR-11** An admin creates or edits the plan for a date and period. A plan has a dish, a serving target, a recipe yield, a serving capacity and ingredient lines with quantity and unit. (B)
- **FR-12** A plan follows the lifecycle draft → published → completed, or → cancelled. Only published plans are visible and bookable (D-16). (B)
- **FR-13** When an admin edits a plan in a way that conflicts with existing coverage, the server returns the conflicts. Saving then requires an explicit override, and override never deletes commitments (D-14, D-15). (B)
- **FR-14** The plan editor shows computed ingredient demand, pantry availability, reservations, pledges and shortages before and after saving. (B)

### Pantry inventory (capability `pantry-inventory`)
- **FR-15** An admin manages pantry items (name, unit kind, display unit) and records receipts, corrections and adjustments. Each change writes an inventory transaction (D-17, D-20). (B)
- **FR-16** Inventory screens show on-hand, reserved, available, pledged and shortage per item. (B)
- **FR-17** Units are g, kg, oz, lb, ml, l and each. Conversion only happens within a unit kind, and incompatible units are rejected (D-21). (B)
- **FR-18** Pledged groceries never count as on-hand stock. Receiving a pledge adds stock and reserves it for the meal (D-18). (B)
- **FR-19** Marking a meal served turns its reservations into consumption, so nothing is subtracted twice (D-19). (B)

### Availability engine (capability `availability-engine`)
- **FR-20** For each slot the server computes N, P, K, `D_i(K)`, `r_i`, `g_i`, `a_i`, `S_i`, Kmin, prepared capacity, serving bookings, lane statuses and overall status (D-01..D-10). (B)
- **FR-21** Lane statuses are AVAILABLE (white), PARTIAL (yellow), FULL (gray), NOT_NEEDED and CONFLICTED. Overall status adds UNSCHEDULED, CANCELLED and CLOSED (D-08, D-09). (B)
- **FR-22** The frontend never computes status. It renders what the server returns. (B)

### Calendar and visibility (capability `meal-calendar`)
- **FR-23** The calendar navigates by month, selects dates, shows a day view and shows three meal slots per day, on desktop and mobile. (B)
- **FR-24** Each slot shows its status with color, icon and text label. A FULL slot still opens its details. (B)
- **FR-25** Solo viewers see aggregates and their own commitments. Organization viewers also see their organization's commitments. Nobody sees another organization's details (D-23). (B)
- **FR-26** Meal details show date, period, dish, servings and per-lane coverage, plus the actions currently available. (B)

### Prepared food (capability `prepared-food-commitments`)
- **FR-27** A volunteer commits 1..remaining prepared servings, can modify the amount and can cancel (D-02, D-11, D-13). (B)
- **FR-28** The server rejects zero, negative, non-integer, non-numeric, over-capacity and duplicate submissions. (B)

### Ingredient planning (capability `ingredient-planning`)
- **FR-29** "Bring groceries" lists every ingredient line with required, on-hand, reserved-for-this-meal, allocated-elsewhere, pledged and remaining shortage, all in display units. (B)
- **FR-30** A volunteer pledges a quantity for one or more shortage lines, capped per line (D-06). Committing also reserves any pantry stock that can cover the meal (D-04). (B)
- **FR-31** "Use pantry" reserves the full remaining demand only if every line can be covered. Otherwise it shows the shortages and links to groceries (D-05). (B)
- **FR-32** The same pantry quantity can never be reserved twice (D-17, D-28). (B)
- **FR-33** Cancelling a grocery pledge reopens its shortage, and cancelling a pantry commitment releases its stock. (B)

### Serving (capability `serving-assignments`)
- **FR-34** A volunteer books the serving assignment, up to the meal's serving capacity, at most once per meal (D-10, D-11). (B)
- **FR-35** Serving status is independent of food status (D-07). (B)

### My commitments (capability `my-commitments`)
- **FR-36** A volunteer lists their upcoming and past commitments and can modify or cancel eligible ones (D-13). (B)

### Admin dashboard (capability `admin-operations`)
- **FR-37** The dashboard shows upcoming plans with lane statuses, inventory shortages, incoming pledges and conflicts needing attention. (B)
- **FR-38** Admins record grocery receipts per pledge line (D-18) and mark meals served (D-19). (T)

### Platform (capability `platform-foundation`)
- **FR-39** Every mutation accepts an `Idempotency-Key`, and replaying a key returns the original outcome (D-12). (T)
- **FR-40** Every mutation of plans, stock, allocations or commitments writes an audit log entry. (B)
- **FR-41** A health endpoint reports the app and database status. (T)
- **FR-42** A seed script and a reset script recreate the demonstration dataset (§7). (B)

## 4. Non-functional requirements

- **NFR-01 Integrity:** No overbooking, under any concurrency, with every mutation running in a transaction with locks (D-28).
- **NFR-02 Security:** OWASP Top 10 mitigations, secrets kept out of git, generic auth errors, CSRF protection via Origin checks plus SameSite cookies, security headers.
- **NFR-03 Privacy:** No data is collected about shelter guests. Volunteer data is limited to username, display name and organization memberships.
- **NFR-04 Accessibility:** WCAG 2.2 AA is the target, with keyboard navigation, labelled inputs, and color never used alone.
- **NFR-05 Responsiveness:** Usable at 360 px wide and up. The month grid becomes a day agenda on small screens.
- **NFR-06 Performance:** The calendar month query stays under 300 ms p95 on a laptop for 93 slots. Aggregates are computed in a batched SQL query, not N+1.
- **NFR-07 Maintainability:** TypeScript strict, a pure domain layer with unit tests, a service layer that owns transactions, and API routes kept thin.
- **NFR-08 Time correctness:** Meal dates never shift because of UTC or DST conversion (D-32).
- **NFR-09 Operability:** Structured JSON logs, a health check, documented backup and restore, and a rollback procedure.
- **NFR-10 Cost:** Only free and open-source tooling and free-tier hosting.

## 5. User stories (abridged)

- **US-01** As a volunteer, I log in and choose whether I'm helping solo or for my church, so my contribution is attributed correctly. (FR-01, FR-08)
- **US-02** As a volunteer, I open Tuesday lunch and see that 60 of 120 chili servings are still needed, so I bring the right amount. (FR-20, FR-26, FR-27)
- **US-03** As a grocery donor, I see that only beans, onions, peppers and spice mix are short, with exact quantities, so I don't buy what the pantry has. (FR-29, FR-30)
- **US-04** As a volunteer, I confirm we'll cook with pantry stock, and that stock is locked for this meal. (FR-31, FR-32)
- **US-05** As a group leader, I book serving for dinner, and nobody else can book the same slot. (FR-34)
- **US-06** As an admin, I publish a week of meals with recipes and see which ingredients are short. (FR-11, FR-14)
- **US-07** As an admin, I correct a stock count after spoilage, see which meals are affected, and decide whether to proceed. (FR-15, D-20)
- **US-08** As an admin, I record that a donor's groceries arrived, and stock goes up and is reserved for that meal. (FR-18, FR-38)

## 6. Failure scenarios that must be handled

The system must handle each of these:

- Two volunteers submit the last 60 servings at the same time: one succeeds, and the other gets `409 CAPACITY_EXCEEDED` with fresh numbers.
- Two meals try to reserve the same pantry stock: the second reserves only what is still available, or fails, depending on the flow (D-04, D-05).
- A double-clicked submit or a network retry hits the idempotency replay, so no duplicate is created.
- A user's membership is revoked between context selection and booking: `403 ORG_NOT_AUTHORIZED`.
- The meal start time passes while the form is open: `409 SLOT_CLOSED`.
- An admin lowers servings below what is committed: `409 PLAN_CONFLICT`, then an explicit override (D-14).
- An admin correction drops stock below reservations: `409 RESERVATION_CONFLICT`, then override (D-20).
- Incompatible units: `422 UNIT_INCOMPATIBLE`.
- A session expires mid-flow: `401`, a redirect to login, and the context must be chosen again.
- The database is unavailable: health check reports 503, and the UI shows an error state with no partial writes.

## 7. Demonstration dataset (seed)

The seed contains:

- One admin and four volunteers.
- Two organizations, St. Paul's Church and UAB Hospital Volunteers. Volunteer `maria` belongs to both, `james` to the church, `aisha` to the hospital, and `sam` has no organization.
- Pantry items and meal plans for every slot over 14 days, starting from the current week.
- Distinct seeded slots for each scenario, so that one demo action never blocks another.

The scenario slots are:

| Scenario | Slot | State at seed |
|---|---|---|
| Main chili | Tuesday lunch, current week | 120 servings, 7 ingredients, 3 coverable by pantry, 4 short, nothing committed |
| Fresh grocery | Tuesday dinner, chili | Same as main chili, kept for grocery steps |
| Pantry-sufficient | Wednesday lunch, pasta | Every ingredient coverable from pantry |
| Partial | Thursday lunch | 60/120 prepared committed by an organization |
| Full | Thursday dinner | Fully covered and serving booked |
| Serving | Friday breakfast | Food covered, serving open |
| Unscheduled | Saturday dinner | No plan |
| Draft | Sunday lunch | Draft plan, invisible to volunteers |

## 8. Unresolved stakeholder questions

See `docs/assumptions-and-decisions.md` § Open stakeholder questions.

## 9. Requirements traceability matrix

Columns: requirement → OpenSpec capability spec → OpenSpec change / task group → automated tests. Test IDs are filled in as tests land; `—` means not yet implemented. The E2E-xx IDs correspond to Tests 1–17 in the brief.

| Req | Spec | Change (tasks) | Tests |
|---|---|---|---|
| FR-01..07 | auth | authentication-and-roles | unit `auth/*.test.ts`, int `auth.int.test.ts`, E2E-01, E2E-13 |
| FR-08..10 | participation-context | participation-context | int `context.int.test.ts`, E2E-02, E2E-03 |
| FR-11..14 | meal-planning | meal-planning | unit `plan-validation.test.ts`, int `meal-plans.int.test.ts`, E2E-12 |
| FR-15..19 | pantry-inventory | pantry-inventory, admin-operations | unit `units.test.ts`, int `inventory.int.test.ts` |
| FR-20..22 | availability-engine | availability-engine | unit `availability.test.ts` |
| FR-23..26 | meal-calendar | meal-calendar | int `calendar.int.test.ts`, E2E-02, E2E-03, E2E-17 |
| FR-27..28 | prepared-food-commitments | prepared-food-commitments | int `prepared.int.test.ts`, E2E-04..06, E2E-14 |
| FR-29..33 | ingredient-planning | ingredient-planning | int `ingredients.int.test.ts`, E2E-07..10 |
| FR-34..35 | serving-assignments | serving-assignments | int `serving.int.test.ts`, E2E-11 |
| FR-36 | my-commitments | my-commitments | int `commitments.int.test.ts`, E2E-15 |
| FR-37..38 | admin-operations | admin-operations | int `admin-ops.int.test.ts`, E2E-12 |
| FR-39..42 | platform-foundation | project-foundation + each change | int `idempotency.int.test.ts`, E2E-16 |
| NFR-01 | availability-engine | all booking changes | int `concurrency.int.test.ts`, E2E-14 |
| NFR-08 | meal-calendar | meal-calendar | unit `dates.test.ts`, E2E-17 |

`docs/testing.md` records which of these tests exist and their last executed result.
