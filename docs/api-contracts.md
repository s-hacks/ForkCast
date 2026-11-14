# API Contracts

The API is versioned under `/api/v1` and speaks JSON. Every mutation requires a session cookie, a matching `Origin` header, and an `Idempotency-Key: <uuid>` header (D-12). Replaying a key returns the original status and body. Zod schemas in `src/lib/schemas` are the source of truth for request bodies; this file mirrors them.

## Error envelope

Every error response has this shape:

```json
{ "error": { "code": "CAPACITY_EXCEEDED", "message": "Only 40 servings remain.", "fieldErrors": {}, "availability": { "...": "fresh MealAvailability when relevant" } } }
```

| HTTP | Codes |
|---|---|
| 400 | `IDEMPOTENCY_KEY_REQUIRED`, `BAD_ORIGIN` |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN`, `ORG_NOT_AUTHORIZED`, `CONTEXT_REQUIRED`, `NOT_OWNER` |
| 404 | `NOT_FOUND` (also returned for drafts requested by volunteers) |
| 409 | `CAPACITY_EXCEEDED`, `DUPLICATE_COMMITMENT`, `SLOT_CLOSED`, `PLAN_NOT_BOOKABLE`, `PANTRY_INSUFFICIENT`, `PLAN_CONFLICT`, `RESERVATION_CONFLICT`, `VERSION_CONFLICT`, `IDEMPOTENCY_KEY_REUSED` |
| 422 | `VALIDATION_ERROR`, `UNIT_INCOMPATIBLE` |
| 429 | `TOO_MANY_ATTEMPTS`. The body still says "Invalid username or password."; only the status and `Retry-After` differ. |
| 500 | `INTERNAL` (no details) |

## Shared types

```ts
type LaneStatus = 'AVAILABLE' | 'PARTIAL' | 'FULL' | 'NOT_NEEDED' | 'CONFLICTED';
type SlotStatus = LaneStatus | 'UNSCHEDULED' | 'CANCELLED' | 'CLOSED';
interface Qty { base: number; display: string; unit: string }   // display e.g. "4.5 lb"
interface IngredientLine { ingredientId; pantryItemId; name; unitKind;
  required: Qty; reservedHere: Qty; pledged: Qty; onHand: Qty; allocatedElsewhere: Qty;
  pantryCanCover: Qty; shortage: Qty; status: LaneStatus }
interface MealAvailability { slotId; planId; date: 'YYYY-MM-DD'; period; dishName; servingsTarget;
  status: SlotStatus; bookable: boolean; startsAt: ISO;
  prepared: { status; committed; capacity; remaining };
  ingredients: { status; kitchenServings; coveredServings; lines: IngredientLine[] };
  serving: { status; booked; capacity; remaining };
  mine: CommitmentView[]; organization?: { name; commitments: CommitmentView[] } }
```

## Endpoints

The **Tx** column says what the transaction locks: **P** = plan row lock (`FOR UPDATE`), **I** = conditional pantry updates in ascending id order, **—** = read-only.

### Auth and context

| Method | Path | Role | Body / Query | 2xx | Tx |
|---|---|---|---|---|---|
| POST | `/auth/login` | public | `{username, password, portal: 'user'\|'admin'}` | 200 `{user}` + cookie | — |
| POST | `/auth/logout` | any session | — | 204 | — |
| GET | `/me` | any session | — | `{user:{id,username,displayName,role}, context, organizations:[{id,name}]}` | — |
| PUT | `/me/context` | USER | `{type:'SOLO'} \| {type:'ORGANIZATION', organizationId}` | 200 `{context}` | — |

### Meals (volunteer)

| Method | Path | Role | Body / Query | 2xx | Tx |
|---|---|---|---|---|---|
| GET | `/meals?from=YYYY-MM-DD&to=YYYY-MM-DD` | USER+ctx, ADMIN | max 62 days | `{slots: SlotSummary[]}`. Missing slots appear as UNSCHEDULED. | — |
| GET | `/meals/{slotId}` | USER+ctx, ADMIN | — | `MealAvailability` | — |
| POST | `/meals/{slotId}/prepared` | USER+ctx | `{servings:int≥1}` | 201 `{commitment, availability}` | P |
| POST | `/meals/{slotId}/groceries` | USER+ctx | `{lines:[{ingredientId, quantity:number, unit}]}` | 201 | P, I |
| POST | `/meals/{slotId}/pantry` | USER+ctx | `{confirm:true}` | 201 or 409 `PANTRY_INSUFFICIENT` with shortages | P, I |
| POST | `/meals/{slotId}/serving` | USER+ctx | `{}` | 201 | P |

### Commitments

| Method | Path | Role | Body | 2xx | Tx |
|---|---|---|---|---|---|
| GET | `/commitments?scope=upcoming\|past` | USER | — | `{commitments: CommitmentView[]}` | — |
| PATCH | `/commitments/{id}` | owner | `{servings}` for prepared, or `{lines}` for grocery (replaces promised lines) | 200 | P, I |
| POST | `/commitments/{id}/cancel` | owner | `{reason?}` | 200 | P, I |

### Admin: meal plans

| Method | Path | Body | 2xx | Tx |
|---|---|---|---|---|
| GET | `/admin/meal-plans?from&to` | — | plans with availability | — |
| POST | `/admin/meal-plans` | `{date, period, dishName, servingsTarget, recipeYield, serviceCapacity, ingredients:[{pantryItemId, quantity, unit}], publish:boolean}` | 201 | P |
| PUT | `/admin/meal-plans/{id}` | the same fields plus `version` and `acknowledgeConflicts?` | 200, or 409 `PLAN_CONFLICT {conflicts[]}`, or 409 `VERSION_CONFLICT` | P, I |
| POST | `/admin/meal-plans/{id}/publish` | `{version}` | 200 | P |
| POST | `/admin/meal-plans/{id}/cancel` | `{acknowledgeConflicts?}` | 200 / 409 | P, I |
| POST | `/admin/meal-plans/{id}/served` | — | 200 (reservations consumed) | P, I |

### Admin: inventory

| Method | Path | Body | 2xx | Tx |
|---|---|---|---|---|
| GET | `/admin/pantry` | — | items with onHand, reserved, available, pledged and shortage | — |
| POST | `/admin/pantry` | `{name, unitKind, displayUnit, initialQuantity?, unit?}` | 201 | I |
| POST | `/admin/pantry/{id}/adjustments` | `{mode:'RECEIPT'\|'ADJUSTMENT', quantity(±), unit, reason}` or `{mode:'CORRECTION', countedQuantity, unit, reason}`, plus `acknowledgeConflicts?` | 201, or 409 `RESERVATION_CONFLICT {affected[]}` | P (affected plans, by id), I |
| GET | `/admin/pantry/{id}/transactions` | — | ledger | — |
| GET | `/admin/groceries?status=PROMISED` | — | incoming pledges | — |
| POST | `/admin/groceries/{lineId}/receive` | `{receivedQuantity, unit}` | 200 | P, I |

### Ops

| Method | Path | 2xx |
|---|---|---|
| GET | `/api/health` | 200 `{status:'ok', db:'ok', version}`, or 503 |

## Test mapping

Each endpoint has integration tests in `tests/integration/<area>.int.test.ts` covering:

- the success path
- every listed error code that applies
- role denial
- idempotent replay

`docs/testing.md` has the matrix.
