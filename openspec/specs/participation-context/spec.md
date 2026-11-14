# participation-context Specification

## Purpose
Selection of solo or organization participation after login, validated against memberships and stored on the server session.

## Requirements

### Requirement: Select participation context
After login a volunteer SHALL choose Solo or one organization they are a member of; the choice SHALL be stored on the server-side session row and audited, and the user's role SHALL NOT change (FR-08, D-22).

#### Scenario: Solo
- **WHEN** a volunteer selects Solo
- **THEN** the session context becomes SOLO and the calendar is shown

#### Scenario: Organization member
- **WHEN** maria selects St. Paul's Church, of which she is a member
- **THEN** the session context becomes that organization

### Requirement: Reject unauthorized organizations
The server MUST reject selecting, or committing on behalf of, an organization the user is not a member of with 403 ORG_NOT_AUTHORIZED, re-checking membership at commitment time (FR-09).

#### Scenario: Spoofed organization
- **WHEN** james submits a commitment with a context naming UAB Hospital Volunteers
- **THEN** the request fails with ORG_NOT_AUTHORIZED and nothing is written

### Requirement: Context recorded on commitments
Every commitment SHALL store the acting user, context type, organization (when applicable), plan, type and amount, enforced by a database check that SOLO has no organization and ORGANIZATION has one (FR-10).

#### Scenario: Attribution
- **WHEN** maria commits 20 prepared servings while representing St. Paul's Church
- **THEN** the commitment row records maria's user id, contextType ORGANIZATION and the church's organization id

### Requirement: Context required before booking
Volunteer calendar and booking operations MUST return 403 CONTEXT_REQUIRED when no context is selected (FR-08).

#### Scenario: No context
- **WHEN** a logged-in volunteer without a context requests the meal list
- **THEN** the response is 403 CONTEXT_REQUIRED
