# Spec Delta: ingredient-planning

## Purpose

Grocery pledges and pantry allocation for the kitchen-cooked portion of a meal, with quantity-based shortages.

## ADDED Requirements

### Requirement: Ingredient shortage view
For each live recipe line the system SHALL report required quantity for the kitchen portion, on-hand stock, quantity allocated to other meals, reserved here, pledged, pantry-coverable quantity and remaining shortage in display units (FR-29).

#### Scenario: Seven ingredients
- **WHEN** the seeded chili requires seven ingredients and the pantry holds enough of three
- **THEN** three lines show zero shortage (pantry can cover) and Kidney beans, Onions, Bell peppers and Cornbread mix show their full quantities as shortages

### Requirement: Grocery pledges
A volunteer SHALL pledge quantities for one or more lines, each capped at the line's remaining shortage recomputed under lock; committing SHALL first reserve unreserved pantry stock that can cover the meal (FR-30, D-04, D-06).

#### Scenario: Partial pledge
- **WHEN** a volunteer pledges the full kidney bean and onion shortages
- **THEN** beef, tomatoes and chili powder are reserved from the pantry, the ingredient lane is PARTIAL (yellow) and peppers and cornbread remain short

#### Scenario: Full coverage
- **WHEN** another volunteer pledges the remaining peppers and cornbread
- **THEN** the ingredient lane is FULL (gray)

#### Scenario: Over-pledge
- **WHEN** 3 kg of peppers are short and a volunteer pledges 3.5 kg
- **THEN** the request is rejected with CAPACITY_EXCEEDED

### Requirement: Use pantry all-or-nothing
"Use pantry" SHALL reserve the remaining ingredient demand only when unreserved stock covers every line; otherwise it MUST return 409 PANTRY_INSUFFICIENT with the shortages (FR-31, D-05).

#### Scenario: Insufficient pantry
- **WHEN** a volunteer chooses Use pantry for the chili
- **THEN** the request fails with PANTRY_INSUFFICIENT and nothing is reserved

#### Scenario: Sufficient pantry
- **WHEN** a volunteer chooses Use pantry for Wednesday spaghetti
- **THEN** all lines are reserved and the ingredient lane is FULL

### Requirement: No double allocation
The same pantry quantity MUST never be reserved for two meals; reservations use conditional updates guarded by a database check (FR-32, D-17).

#### Scenario: Competing meals
- **WHEN** 20 L of marinara exist, one meal reserves 12 L and another needs 12 L
- **THEN** the second meal sees only 8 L coverable and Use pantry fails for it

#### Scenario: Simultaneous allocation
- **WHEN** two meals each needing 15 L of the 20 L submit Use pantry concurrently
- **THEN** exactly one succeeds and reserved never exceeds on-hand

### Requirement: Cancellation reopens coverage
Cancelling a grocery commitment SHALL mark its lines CANCELLED and reopen shortages; cancelling a pantry commitment SHALL release its reservations (FR-33).

#### Scenario: Cancel pledge
- **WHEN** a volunteer cancels a 4 kg onion pledge
- **THEN** the onion shortage returns to 4 kg

