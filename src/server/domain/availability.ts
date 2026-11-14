/**
 * Server-authoritative availability engine (D-01..D-10). Pure: no I/O.
 *
 *   N  servingsTarget            P  prepared servings committed
 *   K  = N - P kitchen portion   Y  recipe yield
 *   D_i = ceil(q_i * K / Y)      demand per ingredient line
 *   r_i reserved for this meal   g_i pledged groceries   a_i unreserved pantry stock
 *   Kmin = max_i floor((g_i-1)*Y/q_i)+1  (grocery pledges never stranded, D-02)
 */

export type LaneStatus = "AVAILABLE" | "PARTIAL" | "FULL" | "NOT_NEEDED" | "CONFLICTED";
export type SlotStatus = LaneStatus | "UNSCHEDULED" | "CANCELLED" | "CLOSED";

export interface LineInput {
  ingredientId: string;
  q: number; // base units per recipe yield
  reserved: number; // r_i
  pledged: number; // g_i
  pantryAvailable: number; // a_i (global unreserved stock of the pantry item)
  removed?: boolean; // soft-removed line (D-15): demand 0, any coverage is a conflict
}

export interface AvailabilityInput {
  servingsTarget: number;
  recipeYield: number;
  serviceCapacity: number;
  preparedCommitted: number;
  servingBooked: number;
  lines: LineInput[];
  status: "DRAFT" | "PUBLISHED" | "COMPLETED" | "CANCELLED";
  closed: boolean; // meal start has passed
}

export interface LineResult {
  ingredientId: string;
  required: number;
  reserved: number;
  pledged: number;
  covered: number;
  pantryCanCover: number;
  shortage: number; // S_i: what donors may still pledge
  overCovered: number;
  status: LaneStatus;
}

export interface AvailabilityResult {
  status: SlotStatus;
  bookable: boolean;
  kitchenServings: number;
  coveredServings: number;
  prepared: { status: LaneStatus; committed: number; capacity: number; remaining: number };
  ingredients: { status: LaneStatus; lines: LineResult[] };
  serving: { status: LaneStatus; booked: number; capacity: number; remaining: number };
}

export function demand(q: number, k: number, y: number): number {
  if (k <= 0) return 0;
  return Math.ceil((q * k) / y);
}

/** Smallest kitchen portion K for which ceil(q*K/Y) >= g (exact integer form). */
export function kMinForPledge(g: number, q: number, y: number): number {
  if (g <= 0) return 0;
  return Math.floor(((g - 1) * y) / q) + 1;
}

function laneStatus(covered: number, capacity: number, overflow: boolean): LaneStatus {
  if (overflow) return "CONFLICTED";
  if (covered >= capacity) return "FULL";
  if (covered <= 0) return "AVAILABLE";
  return "PARTIAL";
}

export function computeAvailability(input: AvailabilityInput): AvailabilityResult {
  const N = input.servingsTarget;
  const Y = input.recipeYield;
  const P = input.preparedCommitted;
  const K = Math.max(0, N - P);

  const live = input.lines.filter((l) => !l.removed);
  const kMin = live.reduce((m, l) => Math.max(m, kMinForPledge(l.pledged, l.q, Y)), 0);

  // Ingredient lines
  const lines: LineResult[] = input.lines.map((l) => {
    const required = l.removed ? 0 : demand(l.q, K, Y);
    const covered = l.reserved + l.pledged;
    const open = Math.max(0, required - covered);
    const pantryCanCover = Math.min(Math.max(0, l.pantryAvailable), open);
    const shortage = open - pantryCanCover;
    const overCovered = Math.max(0, covered - required);
    return {
      ingredientId: l.ingredientId,
      required,
      reserved: l.reserved,
      pledged: l.pledged,
      covered,
      pantryCanCover,
      shortage,
      overCovered,
      status: required === 0 && covered === 0 ? "NOT_NEEDED" : laneStatus(covered, required, overCovered > 0),
    };
  });

  let ingredientStatus: LaneStatus;
  if (lines.some((l) => l.status === "CONFLICTED")) ingredientStatus = "CONFLICTED";
  else if (live.length === 0 || K === 0) ingredientStatus = "NOT_NEEDED";
  else if (lines.every((l) => l.covered >= l.required)) ingredientStatus = "FULL";
  // Nothing pledged or reserved yet, but the pantry can cover every open line: no donor is needed.
  else if (lines.every((l) => l.covered === 0 && l.shortage === 0)) ingredientStatus = "NOT_NEEDED";
  else if (lines.every((l) => l.covered === 0)) ingredientStatus = "AVAILABLE";
  else ingredientStatus = "PARTIAL";

  // Servings the ingredient coverage fully provisions (capped at K).
  let coveredByKitchen = 0;
  if (live.length > 0 && K > 0) {
    coveredByKitchen = Math.min(K, ...live.map((l) => Math.floor(((l.reserved + l.pledged) * Y) / l.q)));
  }

  // Prepared lane: recipe-less meals can only be covered by prepared food (D-08).
  const preparedCapacity = live.length === 0 ? N : Math.max(0, N - kMin);
  const preparedRemaining = Math.max(0, preparedCapacity - P);
  const preparedStatus = laneStatus(P, preparedCapacity, P > N);

  const servingStatus = laneStatus(input.servingBooked, input.serviceCapacity, input.servingBooked > input.serviceCapacity);
  const serving = {
    status: servingStatus,
    booked: input.servingBooked,
    capacity: input.serviceCapacity,
    remaining: Math.max(0, input.serviceCapacity - input.servingBooked),
  };

  const coveredServings = Math.min(N, P + coveredByKitchen);
  const foodCovered = coveredServings >= N;

  let status: SlotStatus;
  if (input.status === "CANCELLED") status = "CANCELLED";
  else if (input.status !== "PUBLISHED" && input.status !== "COMPLETED") status = "UNSCHEDULED";
  else if (input.closed || input.status === "COMPLETED") status = "CLOSED";
  else if ([preparedStatus, ingredientStatus, servingStatus].includes("CONFLICTED")) status = "CONFLICTED";
  else if (foodCovered && servingStatus === "FULL") status = "FULL";
  else if (P === 0 && lines.every((l) => l.covered === 0) && input.servingBooked === 0) status = "AVAILABLE";
  else status = "PARTIAL";

  return {
    status,
    bookable: input.status === "PUBLISHED" && !input.closed,
    kitchenServings: K,
    coveredServings,
    prepared: { status: preparedStatus, committed: P, capacity: preparedCapacity, remaining: preparedRemaining },
    ingredients: { status: ingredientStatus, lines },
    serving,
  };
}
