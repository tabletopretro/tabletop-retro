import "server-only";

/**
 * In-process sliding-window limiter for the unauthenticated entry points
 * (joining, taking a seat). Per process, like the table bus: more than one
 * server needs a shared store. Keys are pruned so the map can't grow without bound.
 */
const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  if (hits.size >= MAX_KEYS && !hits.has(key)) hits.clear();
  hits.set(key, recent);
  return true;
}

/** The first address in X-Forwarded-For (the proxy sets it), else one shared bucket. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0].trim();
  return forwarded || headers.get("x-real-ip") || "direct";
}
