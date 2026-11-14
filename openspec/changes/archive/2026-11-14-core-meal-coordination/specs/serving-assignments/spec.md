# Spec Delta: serving-assignments

## Purpose

Volunteer booking of the per-meal serving assignment, independent of food coverage.

## ADDED Requirements

### Requirement: Book serving assignment
A volunteer SHALL book the serving assignment while bookings are below the meal's serving capacity (default 1); further bookings MUST be rejected with CAPACITY_EXCEEDED and a user SHALL hold at most one active serving booking per meal (FR-34, D-10).

#### Scenario: Claimed assignment
- **WHEN** a volunteer books serving for Tuesday lunch
- **THEN** the serving lane becomes FULL and a second volunteer's booking is rejected

### Requirement: Serving independent of food
Serving status MUST NOT change prepared-food or ingredient lane statuses, and the overall meal SHALL NOT be FULL while food is uncovered (FR-35, D-07).

#### Scenario: Serving without food
- **WHEN** serving is booked but no food is committed
- **THEN** prepared and ingredient lanes remain AVAILABLE and the meal status is PARTIAL

