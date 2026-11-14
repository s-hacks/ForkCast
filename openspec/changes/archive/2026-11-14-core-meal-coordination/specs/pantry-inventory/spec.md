# Spec Delta: pantry-inventory

## Purpose

Pantry items with separately tracked physical stock and reservations, unit handling and an append-only inventory ledger.

## ADDED Requirements

### Requirement: Physical stock and reservations
Each pantry item SHALL track onHandQty and reservedQty in base units with a database check `0 <= reservedQty <= onHandQty`; available = onHand - reserved (FR-15, FR-16, D-17).

#### Scenario: Constraint backstop
- **WHEN** any update would make reservedQty exceed onHandQty
- **THEN** the database rejects it

### Requirement: Audited stock changes
Receipts, adjustments and corrections (entering a counted total) SHALL be recorded as InventoryTransaction rows so that the sum of deltas equals onHandQty and reservedQty for every item (FR-15).

#### Scenario: Receipt then correction
- **WHEN** an admin records a 5 kg onion receipt and then corrects the count to 4.5 kg
- **THEN** onHand is 4500 g and two ledger rows reconcile exactly with the item

### Requirement: Corrections below reservations
A correction leaving onHand below reserved MUST return 409 RESERVATION_CONFLICT naming affected meals; with acknowledgement the system SHALL trim reservations from the latest meals first and reopen their ingredient shortages (D-20).

#### Scenario: Spoiled sauce
- **WHEN** 12 L of marinara is reserved and an admin corrects the count to 10 L
- **THEN** the first attempt returns RESERVATION_CONFLICT; the acknowledged attempt sets onHand and reserved to 10 L and the pasta meal's ingredient lane becomes PARTIAL

### Requirement: Pledges are not stock
Pledged groceries MUST NOT change onHandQty or reservedQty (FR-18).

#### Scenario: Promise only
- **WHEN** a volunteer pledges 6 kg of kidney beans
- **THEN** the Kidney beans on-hand quantity stays 0

