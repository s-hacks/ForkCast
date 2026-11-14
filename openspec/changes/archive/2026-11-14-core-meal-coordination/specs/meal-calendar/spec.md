# Spec Delta: meal-calendar

## Purpose

Month calendar with three meal slots per day, context-scoped visibility and meal detail views.

## ADDED Requirements

### Requirement: Monthly calendar of meal slots
The calendar SHALL show every date in the selected month with breakfast, lunch and dinner slots from PostgreSQL, month navigation and a selected-day view; slots without a published plan SHALL appear as not scheduled (FR-23, D-09).

#### Scenario: Missing plan
- **WHEN** a date has no dinner plan
- **THEN** the dinner slot is listed with status UNSCHEDULED

### Requirement: Accessible status display
Each slot SHALL display its status with color, icon and text label; FULL slots SHALL remain viewable with booking disabled (FR-24, NFR-04).

#### Scenario: Gray but viewable
- **WHEN** a volunteer opens a fully booked meal
- **THEN** the meal details are shown and booking actions are disabled with an explanation

### Requirement: Context-scoped visibility
Solo viewers SHALL see aggregate numbers and their own commitments only; organization viewers SHALL additionally see their organization's commitments with member names; no viewer SHALL receive another organization's commitment rows or member names (FR-25, D-23).

#### Scenario: Other organization's booking
- **WHEN** St. Paul's Church committed 60 of 120 servings and maria views the meal representing UAB Hospital Volunteers
- **THEN** she sees 60 servings remaining, an empty organization commitment list, and no church member names

### Requirement: Meal details
Meal details SHALL show date, period, dish, servings, per-lane coverage numbers and the available actions (FR-26).

#### Scenario: Detail content
- **WHEN** a volunteer opens Tuesday lunch
- **THEN** the page shows Chili, 120 servings, prepared committed and remaining, ingredient lines and serving availability

### Requirement: Date correctness
Meal dates SHALL be stored as DATE in the shelter timezone and date arithmetic SHALL operate on calendar dates so DST and UTC conversion never shift a meal (NFR-08, D-32).

#### Scenario: DST end
- **WHEN** the shelter timezone leaves daylight saving time on 2026-11-01
- **THEN** lunch on that date still starts at 11:30 local time and the date is unchanged

