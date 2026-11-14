"use client";
/** Browser API client. Every mutation carries an Idempotency-Key generated per form submission intent. */
export type ApiError = { code: string; message: string; fieldErrors?: Record<string, string[]>; [k: string]: unknown };
export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: ApiError };

export function newKey(): string {
  return crypto.randomUUID();
}

export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown; key?: string } = {}): Promise<ApiResult<T>> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["Idempotency-Key"] = init.key ?? newKey();
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined, credentials: "same-origin" });
  } catch {
    return { ok: false, status: 0, error: { code: "NETWORK", message: "Network error. Check your connection and try again." } };
  }
  if (res.status === 204) return { ok: true, status: 204, data: undefined as T };
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: (json as { error?: ApiError }).error ?? { code: "INTERNAL", message: "Unexpected error." } };
  return { ok: true, status: res.status, data: json as T };
}
