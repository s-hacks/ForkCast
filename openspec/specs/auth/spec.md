# auth Specification

## Purpose
Username/password authentication, server-managed sessions, login throttling and role-based authorization for volunteers and administrators.

## Requirements

### Requirement: Username and password login
The system SHALL authenticate users by a unique case-insensitive username and a password verified against an Argon2id hash, and SHALL create a server-side session whose token is stored only as a SHA-256 hash and delivered in an HttpOnly, SameSite=Lax cookie (Secure in production) (FR-01, FR-02, FR-03).

#### Scenario: Correct credentials
- **WHEN** a regular user submits the correct username and password through the user portal
- **THEN** a session row is created, a session cookie is set and the user reaches participation selection

#### Scenario: Password storage
- **WHEN** a user account is stored
- **THEN** its password hash starts with `$argon2id$` and no plaintext password is persisted

### Requirement: Generic authentication failures
Every failed login (unknown user, wrong password, inactive account, or role not matching the chosen portal) MUST return HTTP 401 with the identical message "Invalid username or password.", and unknown usernames MUST still perform an Argon2 verification to equalize timing (FR-04).

#### Scenario: Wrong portal
- **WHEN** a USER account logs in through the administrator portal with a correct password
- **THEN** the response is 401 with the generic message and no session is created

#### Scenario: Unknown username
- **WHEN** a login names a username that does not exist
- **THEN** the response message is identical to the wrong-password response

### Requirement: Login throttling
The system SHALL count failed attempts per normalized username and per HMAC-hashed client IP within a 15-minute window and MUST reject further attempts with HTTP 429 after 5 username failures or 30 IP failures, still using the generic message (FR-04, D-27).

#### Scenario: Username lockout
- **WHEN** five failed logins for `james` occur within 15 minutes
- **THEN** a sixth attempt, even with the correct password, is rejected with code TOO_MANY_ATTEMPTS

### Requirement: Logout and expiry
Sessions SHALL expire after 12 hours of inactivity with sliding renewal, and logout SHALL delete the session row and clear the cookie (FR-03).

#### Scenario: Logout
- **WHEN** an authenticated user posts to `/api/v1/auth/logout`
- **THEN** the session row is deleted and subsequent requests with the old cookie are unauthenticated

### Requirement: Server-side role enforcement
Role SHALL be read from the database user row on every request. Admin endpoints MUST reject non-admin sessions with 403 FORBIDDEN, volunteer booking endpoints MUST reject administrator sessions with 403 FORBIDDEN, and unauthenticated requests MUST receive 401 (FR-05, D-24).

#### Scenario: User calls an admin API
- **WHEN** a regular user calls any `/api/v1/admin/*` operation
- **THEN** the server responds 403 FORBIDDEN and no data changes

#### Scenario: Admin tries to book
- **WHEN** an administrator calls a commitment endpoint
- **THEN** the server responds 403 FORBIDDEN

### Requirement: Demo entry points
The landing page SHALL offer "Enter as Volunteer" and "Enter as Administrator", each leading to a login form; neither SHALL bypass authentication (FR-06).

#### Scenario: Admin entry
- **WHEN** a visitor chooses Enter as Administrator
- **THEN** the administrator login form is shown and no session exists until valid admin credentials are submitted
