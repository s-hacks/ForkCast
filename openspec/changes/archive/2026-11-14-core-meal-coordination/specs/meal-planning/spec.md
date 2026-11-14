# Spec Delta: meal-planning

## Purpose

Administrator creation, editing, publishing and cancellation of meal plans with recipe ingredient requirements and conflict handling.

## ADDED Requirements

### Requirement: Create meal plans
An administrator SHALL create a plan for a date and meal period with dish name, serving target, recipe yield, serving capacity and ingredient lines (pantry item, quantity, unit), saved as DRAFT or PUBLISHED; a slot MUST have at most one non-cancelled plan (FR-11, D-16).

#### Scenario: Tuesday chili
- **WHEN** an admin creates Tuesday lunch Chili for 120 servings with seven ingredient lines and publishes it
- **THEN** the plan is stored and volunteers see it on the calendar

#### Scenario: Duplicate slot
- **WHEN** an admin creates a second plan for a slot that already has a live plan
- **THEN** the request is rejected with VERSION_CONFLICT

### Requirement: Drafts are not bookable
Volunteers MUST NOT see or book DRAFT plans; requesting one returns 404 and the calendar shows the slot as not scheduled (FR-12).

#### Scenario: Draft hidden
- **WHEN** a volunteer opens the seeded Sunday lunch draft
- **THEN** the server responds NOT_FOUND

### Requirement: Validated units
Ingredient quantities SHALL be converted to integer base units (g, ml, each) and a unit of a different kind than the pantry item MUST be rejected with 422 UNIT_INCOMPATIBLE (FR-17, D-21).

#### Scenario: Liters for a mass item
- **WHEN** an admin enters `3 l` for Kidney beans (mass)
- **THEN** the request is rejected with UNIT_INCOMPATIBLE

### Requirement: Conflicting edits warn then override
An edit that lowers servings below prepared commitments, lowers a recipe line below pledged groceries, removes a pledged line, or lowers serving capacity below bookings MUST be rejected with 409 PLAN_CONFLICT listing the conflicts. Resubmitting with acknowledgeConflicts SHALL save the change, release pantry reservations above new demand, keep every volunteer commitment ACTIVE, and the affected lane SHALL report CONFLICTED (FR-13, D-14, D-15).

#### Scenario: 120 to 80 with 100 committed
- **WHEN** 100 prepared servings are committed and an admin changes servings from 120 to 80
- **THEN** the server returns PLAN_CONFLICT; after acknowledgement the plan saves, the 100-serving commitment remains ACTIVE and the meal status is CONFLICTED

#### Scenario: Stale edit
- **WHEN** an admin submits an edit with an outdated version number
- **THEN** the request is rejected with VERSION_CONFLICT

### Requirement: Cancel plan
Cancelling a plan with active commitments MUST require acknowledgement; on cancel, commitments become CANCELLED (not deleted) and all reservations are released (FR-13).

#### Scenario: Cancel with commitments
- **WHEN** an admin cancels a meal that has a pantry commitment and acknowledges the warning
- **THEN** the commitment is CANCELLED and the pantry item's reserved quantity returns to its prior value

