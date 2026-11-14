# Spec Delta: admin-operations

## Purpose

Administrator dashboard, grocery receipt recording and served-meal reconciliation.

## ADDED Requirements

### Requirement: Admin dashboard
The dashboard SHALL show upcoming meals with lane statuses and coverage, items whose open demand exceeds available stock, incoming pledges and conflicted meals (FR-37).

#### Scenario: Shortages visible
- **WHEN** chili ingredients are short
- **THEN** the dashboard lists those pantry items as insufficient

### Requirement: Record grocery receipt
Recording a received pledge line SHALL in one transaction increase on-hand stock via a GROCERY_RECEIPT ledger entry, reserve the received quantity for the pledged meal and mark the line RECEIVED (FR-18, FR-38, D-18).

#### Scenario: Onions arrive
- **WHEN** a 4 kg onion pledge is received
- **THEN** Onions on-hand and reserved both become 4 kg and the meal's onion line shows 4 kg reserved and 0 pledged

### Requirement: Mark meal served
Marking a published meal served SHALL convert its active reservations to CONSUMED and decrease on-hand and reserved by the same amounts in one CONSUMPTION entry per allocation, so stock is never subtracted twice; the plan becomes COMPLETED (FR-19, FR-38, D-19).

#### Scenario: Reconciliation
- **WHEN** a meal with 4 kg of reserved onions is marked served
- **THEN** Onions on-hand and reserved both return to 0 and the ledger reconciles

