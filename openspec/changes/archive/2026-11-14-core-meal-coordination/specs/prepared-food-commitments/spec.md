# Spec Delta: prepared-food-commitments

## Purpose

Volunteer commitments to bring prepared servings, with partial/full coverage, modification and cancellation.

## ADDED Requirements

### Requirement: Commit prepared servings
A volunteer SHALL commit an integer number of servings from 1 to the remaining prepared capacity; the server MUST reject zero, negative, non-integer, non-numeric and over-capacity values (FR-27, FR-28).

#### Scenario: Full contribution
- **WHEN** 120 servings are needed and a volunteer commits 120
- **THEN** prepared-food coverage becomes 120/120, the lane is FULL (gray) and further prepared commitments are rejected with CAPACITY_EXCEEDED

#### Scenario: Partial then completion
- **WHEN** a volunteer commits 60 of 120 and another commits the remaining 60
- **THEN** after the first the lane is PARTIAL (yellow) with 60 remaining; after the second it is FULL

#### Scenario: Overcommit
- **WHEN** 60 remain and a volunteer submits 61
- **THEN** the request is rejected with CAPACITY_EXCEEDED and fresh availability

### Requirement: No duplicate commitments
A user MUST hold at most one active commitment of each type per meal (database partial unique index), and repeated submissions with the same Idempotency-Key SHALL return the original result without a new row (FR-28, FR-39, D-11, D-12).

#### Scenario: Double click
- **WHEN** the same request is submitted twice with the same key
- **THEN** one commitment exists and the second response is the replayed original

### Requirement: Prepared food trims pantry reservations
When a prepared commitment reduces kitchen demand, reservations exceeding the new demand minus pledges SHALL be released in the same transaction (D-03).

#### Scenario: Pasta half prepared
- **WHEN** pantry stock was reserved for 100 pasta servings and a volunteer commits 50 prepared servings
- **THEN** the marinara reservation drops from 12 L to 6 L

