/** Typed business errors mapped to HTTP statuses (docs/api-contracts.md). */
export const ERROR_STATUS = {
  IDEMPOTENCY_KEY_REQUIRED: 400,
  BAD_ORIGIN: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  ORG_NOT_AUTHORIZED: 403,
  CONTEXT_REQUIRED: 403,
  NOT_OWNER: 403,
  NOT_FOUND: 404,
  CAPACITY_EXCEEDED: 409,
  DUPLICATE_COMMITMENT: 409,
  SLOT_CLOSED: 409,
  PLAN_NOT_BOOKABLE: 409,
  PANTRY_INSUFFICIENT: 409,
  PLAN_CONFLICT: 409,
  RESERVATION_CONFLICT: 409,
  VERSION_CONFLICT: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  VALIDATION_ERROR: 422,
  UNIT_INCOMPATIBLE: 422,
  TOO_MANY_ATTEMPTS: 429,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly extras: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "DomainError";
  }
  get status(): number {
    return ERROR_STATUS[this.code];
  }
}
