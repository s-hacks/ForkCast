# availability-engine Specification

## Purpose
Server-authoritative computation of per-lane fulfillment and overall meal status from persisted commitments, reservations and stock.

## Requirements

### Requirement: Dynamic fulfillment split
For plan servings N and prepared commitments P, the kitchen portion SHALL be K = N - P and ingredient demand SHALL be ceil(q_i*K/Y); prepared capacity SHALL be N - Kmin where Kmin is the smallest K that keeps every grocery pledge needed (FR-20, D-01, D-02).

#### Scenario: Half prepared
- **WHEN** 60 of 120 chili servings are committed as prepared food
- **THEN** ingredient demand is computed for 60 servings (e.g. 5 kg of a 10 kg line)

#### Scenario: Pledges cap prepared food
- **WHEN** the full kidney bean demand for 120 servings has been pledged
- **THEN** prepared-food capacity is 0

### Requirement: Lane and overall statuses
Each lane (prepared, ingredients, serving) SHALL be AVAILABLE, PARTIAL, FULL, NOT_NEEDED (ingredients only) or CONFLICTED; overall status SHALL additionally distinguish UNSCHEDULED, CANCELLED and CLOSED, and SHALL be FULL only when food is covered and serving is full (FR-21, D-08, D-09).

#### Scenario: Unpublished vs full
- **WHEN** a slot has only a draft plan
- **THEN** its status is UNSCHEDULED, not FULL

#### Scenario: Past meal
- **WHEN** the meal start time has passed
- **THEN** status is CLOSED and the meal is not bookable

### Requirement: Server is the source of truth
Statuses SHALL be computed only on the server after the transaction commits, and every mutation response SHALL include the recomputed meal availability (FR-22).

#### Scenario: Fresh state returned
- **WHEN** a commitment succeeds
- **THEN** the response contains the recomputed availability used by the UI

### Requirement: Concurrency safety
Every booking mutation MUST lock the meal plan row and revalidate capacity inside a transaction; pantry reservations MUST use conditional updates so simultaneous requests cannot overbook (NFR-01, D-28).

#### Scenario: Two users claim the last 60
- **WHEN** 60 servings remain and two users submit 60 simultaneously
- **THEN** exactly one succeeds and the other receives CAPACITY_EXCEEDED
