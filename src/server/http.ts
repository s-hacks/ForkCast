/** Thin route-handler wrapper: Origin check (D-29), idempotency key, Zod + DomainError mapping. */
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { DomainError } from "./domain/errors";
import { config } from "./config";
import { log } from "./log";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function errorResponse(e: unknown, requestId: string) {
  if (e instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const i of e.issues) (fieldErrors[i.path.join(".") || "_"] ??= []).push(i.message);
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Please correct the highlighted fields.", fieldErrors } }, { status: 422 });
  }
  if (e instanceof DomainError) {
    const headers: Record<string, string> = {};
    if (e.code === "TOO_MANY_ATTEMPTS" && e.extras.retryAfter) headers["Retry-After"] = String(e.extras.retryAfter);
    const { retryAfter: _r, ...extras } = e.extras;
    void _r;
    return NextResponse.json({ error: { code: e.code, message: e.message, ...extras } }, { status: e.status, headers });
  }
  log.error("unhandled", { requestId, err: e instanceof Error ? e.stack : String(e) });
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
}

export function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = config().APP_ORIGIN;
  if (!origin || origin !== allowed) throw new DomainError("BAD_ORIGIN", "Request origin not allowed.");
}

export function idempotencyKey(req: NextRequest): string {
  const k = req.headers.get("idempotency-key");
  if (!k || !UUID_RE.test(k)) throw new DomainError("IDEMPOTENCY_KEY_REQUIRED", "An Idempotency-Key header (UUID) is required.");
  return k;
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  return schema.parse(raw);
}

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export function api(fn: Handler, opts: { mutation?: boolean } = {}): Handler {
  return async (req, ctx) => {
    const requestId = crypto.randomUUID();
    try {
      if (opts.mutation ?? req.method !== "GET") checkOrigin(req);
      return await fn(req, ctx);
    } catch (e) {
      return errorResponse(e, requestId);
    }
  };
}

export function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}
