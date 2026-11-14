# Spec Delta: my-commitments

## Purpose

A volunteer's list of their own upcoming and past commitments with eligible modification and cancellation.

## ADDED Requirements

### Requirement: List own commitments
A volunteer SHALL see only their own commitments split into upcoming and past, each with date, period, dish, type, amount or lines, context and status (FR-36).

#### Scenario: Own rows only
- **WHEN** sam opens My commitments
- **THEN** only commitments with sam's user id are returned

### Requirement: Modify and cancel before meal start
Owners SHALL modify prepared servings within capacity and cancel active commitments until the meal start time; cancellation sets status CANCELLED without deleting the row; other users MUST receive NOT_OWNER (FR-36, D-13).

#### Scenario: Cancel restores capacity
- **WHEN** a volunteer cancels a 100-serving prepared commitment
- **THEN** the commitment is CANCELLED and prepared remaining returns to 120

#### Scenario: Not owner
- **WHEN** james tries to cancel sam's commitment
- **THEN** the request is rejected with NOT_OWNER

#### Scenario: After start
- **WHEN** the meal has started
- **THEN** modification and cancellation are rejected with SLOT_CLOSED

