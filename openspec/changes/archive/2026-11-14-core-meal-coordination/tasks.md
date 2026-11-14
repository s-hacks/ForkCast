# Tasks: core-meal-coordination

## 1. Authentication and roles (M2)
- [x] 1.1 Argon2id password hashing and DB-backed sessions with hashed tokens and secure cookies
- [x] 1.2 Login throttling per username and per IP, generic errors, timing-equalized unknown users
- [x] 1.3 Guards `assertUser`, `assertAdmin` and `assertVolunteer`, plus page guards
- [x] 1.4 Tests: tests/integration/admin-auth.int.test.ts (authentication and authorization)

## 2. Participation context (M3)
- [x] 2.1 `PUT /api/v1/me/context` with membership check and audit
- [x] 2.2 Membership re-check at commitment time and context copied onto commitments
- [x] 2.3 Tests: tests/integration/booking.int.test.ts (ORG_NOT_AUTHORIZED, visibility)

## 3. Pantry inventory (M4)
- [x] 3.1 PantryItem on-hand and reserved columns with CHECK constraint, InventoryTransaction ledger
- [x] 3.2 Receipts, adjustments and corrections with reservation-conflict override
- [x] 3.3 Unit conversion with incompatible-kind rejection
- [x] 3.4 Tests: tests/unit/units-dates.test.ts, tests/integration/admin-auth.int.test.ts (inventory)

## 4. Meal planning (M5)
- [x] 4.1 Create, update, publish and cancel plans; soft-removed recipe lines
- [x] 4.2 Warn-then-override conflicts, version check, release of reservations above new demand
- [x] 4.3 Tests: tests/integration/admin-auth.int.test.ts (meal plan edits)

## 5. Availability engine (M6)
- [x] 5.1 Pure `computeAvailability` implementing D-01..D-10
- [x] 5.2 Batched aggregate loader and plan row lock
- [x] 5.3 Tests: tests/unit/availability.test.ts

## 6. Meal calendar (M7)
- [x] 6.1 `listSlots` returning every date × period with UNSCHEDULED fill, and context-scoped `mealDetail`
- [x] 6.2 Calendar, meal detail pages and accessible status badges
- [x] 6.3 Tests: tests/integration/booking.int.test.ts (visibility, drafts), tests/unit/units-dates.test.ts (DST)

## 7. Prepared food (M8)
- [x] 7.1 Commit, modify and cancel, with capacity checks under lock and D-03 trimming
- [x] 7.2 Tests: tests/integration/booking.int.test.ts (prepared food, concurrency)

## 8. Ingredient planning (M9)
- [x] 8.1 Grocery pledges with automatic pantry reservation (D-04) and per-line caps (D-06)
- [x] 8.2 All-or-nothing Use pantry (D-05) with conditional reservations
- [x] 8.3 Tests: tests/integration/booking.int.test.ts (groceries and pantry)

## 9. Serving (M10)
- [x] 9.1 Serving booking with capacity and the one-per-user rule
- [x] 9.2 Tests: tests/integration/booking.int.test.ts (serving)

## 10. My commitments (M11)
- [x] 10.1 Upcoming and past lists, modify and cancel UI
- [x] 10.2 Tests: tests/integration/booking.int.test.ts (modify and cancel)

## 11. Admin operations (M12)
- [x] 11.1 Dashboard, pantry, incoming groceries and meal editor pages
- [x] 11.2 Grocery receipt (D-18) and served reconciliation (D-19)
- [x] 11.3 Tests: tests/integration/admin-auth.int.test.ts (inventory: receipt and served)
