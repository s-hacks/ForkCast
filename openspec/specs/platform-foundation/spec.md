# platform-foundation Specification

## Purpose
Platform behavior that every feature relies on: health reporting, configuration validation, a uniform error contract, idempotent mutations, audit logging and a safe demo reset.

## Requirements

### Requirement: Health endpoint
The system SHALL expose `GET /api/health`, which returns HTTP 200 with `{"status":"ok","db":"ok"}` when the database answers a trivial query, and HTTP 503 with `{"status":"degraded","db":"unreachable"}` otherwise, without revealing connection details (FR-41).

#### Scenario: Database reachable
- **WHEN** a client requests `GET /api/health` and PostgreSQL is reachable
- **THEN** the response status is 200 and the body reports `db` as `ok`

#### Scenario: Database unreachable
- **WHEN** a client requests `GET /api/health` and the database query fails
- **THEN** the response status is 503 and the body contains no hostnames, credentials or stack traces

### Requirement: Configuration validation at startup
The system MUST validate required environment variables (`DATABASE_URL`, `APP_ORIGIN`, `SHELTER_TIMEZONE`, `SESSION_SECRET` length ≥ 32) when the server starts and MUST refuse to start with a message naming each missing or invalid variable. A production build MUST reject an `APP_ORIGIN` that does not use `https` (NFR-02).

#### Scenario: Missing variable
- **WHEN** the server starts without `DATABASE_URL`
- **THEN** startup fails with an error that names `DATABASE_URL` and does not print other variable values

#### Scenario: Insecure production origin
- **WHEN** `NODE_ENV` is `production` and `APP_ORIGIN` is `http://example.org`
- **THEN** configuration validation fails

### Requirement: Structured error contract
Every API error response SHALL use the envelope `{"error":{"code","message","fieldErrors?","availability?"}}` with the HTTP status mapped from a fixed code table. Unexpected exceptions SHALL return 500 with code `INTERNAL` and a generic message, and the detail SHALL go only to server logs (NFR-02).

#### Scenario: Validation failure
- **WHEN** a request body fails schema validation
- **THEN** the response is 422 with code `VALIDATION_ERROR` and a `fieldErrors` map keyed by field path

#### Scenario: Unexpected exception
- **WHEN** a handler throws an error that is not a `DomainError`
- **THEN** the response is 500 with code `INTERNAL` and the body contains no stack trace or SQL

### Requirement: Idempotent mutations
Every mutating API request SHALL carry an `Idempotency-Key` header containing a UUID. The system SHALL record the key per user inside the mutation's transaction, together with the response status and body. A repeated request with the same user and key SHALL return the recorded response without performing the mutation again. Reusing a key on a different route SHALL be rejected (FR-39, D-12).

#### Scenario: Missing key
- **WHEN** an authenticated user sends a mutating request without an `Idempotency-Key`
- **THEN** the response is 400 with code `IDEMPOTENCY_KEY_REQUIRED` and nothing is written

#### Scenario: Replay returns the original result
- **WHEN** a user repeats a successful mutating request with the same key
- **THEN** the response status and body equal the first response and no additional rows are created

#### Scenario: Concurrent duplicates
- **WHEN** two identical requests with the same user and key arrive at the same time
- **THEN** exactly one mutation is performed and both responses carry the same result

#### Scenario: Key reused on another route
- **WHEN** a user sends a key already recorded for a different route
- **THEN** the response is 409 with code `IDEMPOTENCY_KEY_REUSED`

### Requirement: Audit logging
The system SHALL write an append-only audit entry for every mutation of meal plans, pantry stock, allocations, commitments, sessions and context selection. Each entry SHALL record the actor id, action, entity type, entity id, a JSON payload of relevant before/after values and a timestamp, and SHALL be written in the same transaction as the mutation (FR-40).

#### Scenario: Audit written atomically
- **WHEN** a mutation transaction commits
- **THEN** exactly one corresponding audit entry exists with the acting user's id

#### Scenario: Rolled-back mutation leaves no audit entry
- **WHEN** a mutation transaction fails and rolls back
- **THEN** no audit entry exists for it

### Requirement: Safe demo reset
The demo reset command SHALL truncate application tables and reseed the demonstration dataset only when the database host is `localhost` or `127.0.0.1`, or when `ALLOW_DEMO_RESET=true` is set. It MUST always refuse when `NODE_ENV` is `production` (FR-42).

#### Scenario: Refuses remote database
- **WHEN** the reset command runs with a `DATABASE_URL` whose host is not local and `ALLOW_DEMO_RESET` is unset
- **THEN** it exits non-zero without modifying any data

#### Scenario: Local reset succeeds
- **WHEN** the reset command runs against a local database
- **THEN** all application tables are emptied and the seed data is recreated
