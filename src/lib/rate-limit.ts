/**
 * Per-IP sliding-window rate limiting for the paid / heavy API routes.
 *
 * In-memory store: correct for a single server instance. If the app is ever
 * deployed with multiple instances (or serverless concurrency), replace the
 * `hits` map with a shared store (Redis / Upstash) — the `checkRateLimit`
 * signature is already shaped for that swap.
 */

/** One sliding-window rule: at most `limit` hits per `windowMs`. */
export interface RateLimitRule {
  readonly windowMs: number;
  readonly limit: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Hits remaining in the tightest breached window (0 when denied). */
  readonly remaining: number;
  /** ms until the oldest hit in the tightest window expires. */
  readonly resetMs: number;
  /** Whole seconds the client should wait before retrying (0 when allowed). */
  readonly retryAfterSec: number;
}

const hits = new Map<string, number[]>();

/** Test / dev helper: empties the in-memory hit store. */
export function resetRateLimits(): void {
  hits.clear();
}

function prune(key: string, now: number, longestWindowMs: number): number[] {
  const list = hits.get(key) ?? [];
  const fresh = list.filter((t) => now - t < longestWindowMs);
  if (fresh.length === 0) hits.delete(key);
  else hits.set(key, fresh);
  return fresh;
}

/**
 * Records one hit for `key` and checks it against every rule.
 * All rules share the same hit log; the tightest rule decides.
 */
export function checkRateLimit(
  key: string,
  rules: readonly RateLimitRule[],
  now: number = Date.now(),
): RateLimitDecision {
  const longest = Math.max(...rules.map((r) => r.windowMs));
  const fresh = prune(key, now, longest);
  fresh.push(now);
  hits.set(key, fresh);

  let remaining = Number.POSITIVE_INFINITY;
  let resetMs = 0;
  let deniedAfterSec = 0;
  for (const rule of rules) {
    const inWindow = fresh.filter((t) => now - t < rule.windowMs);
    if (inWindow.length > rule.limit) {
      const oldest = Math.min(...inWindow);
      const waitMs = rule.windowMs - (now - oldest);
      if (waitMs > resetMs) resetMs = waitMs;
      deniedAfterSec = Math.max(deniedAfterSec, Math.ceil(waitMs / 1000));
      remaining = 0;
    } else {
      remaining = Math.min(remaining, rule.limit - inWindow.length);
    }
  }
  if (remaining === Number.POSITIVE_INFINITY) remaining = 0;
  const allowed = deniedAfterSec === 0;
  return {
    allowed,
    remaining,
    resetMs: allowed ? 0 : resetMs,
    retryAfterSec: allowed ? 0 : Math.max(deniedAfterSec, 1),
  };
}

/**
 * Best-effort client IP for rate-limit keys. Reads the standard proxy
 * headers (`x-forwarded-for` first entry, then `x-real-ip`); falls back to
 * a single shared bucket so an unidentifiable client is still limited.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded !== null) {
    const first = forwarded.split(",")[0]?.trim();
    if (first !== undefined && first !== "") return first;
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real !== undefined && real !== "") return real;
  return "unknown";
}

/** Route budgets. Tune here when the public traffic pattern is known. */
export const ANALYZE_LIMITS: readonly RateLimitRule[] = [
  { windowMs: 60_000, limit: 5 }, // burst: 5 analyses / minute / IP
  { windowMs: 3_600_000, limit: 30 }, // sustained: 30 analyses / hour / IP
];

export const TRANSLATE_LIMITS: readonly RateLimitRule[] = [
  { windowMs: 60_000, limit: 30 },
  { windowMs: 3_600_000, limit: 300 },
];

export const EXTRACT_LIMITS: readonly RateLimitRule[] = [
  { windowMs: 60_000, limit: 20 },
  { windowMs: 3_600_000, limit: 200 },
];

function describeRule(rule: RateLimitRule): string {
  const per = rule.windowMs >= 3_600_000 ? "hour" : "minute";
  return `${rule.limit}/${per}`;
}

/** Short fair-use label for the UI, derived from the live budgets. */
export function describeAnalyzeLimits(): string {
  return ANALYZE_LIMITS.map(describeRule).join(" · ");
}

/** Plain-language 429 body, matching the app's error style. */
export function rateLimitMessage(retryAfterSec: number): string {
  const wait =
    retryAfterSec >= 60
      ? `about ${Math.ceil(retryAfterSec / 60)} minute${Math.ceil(retryAfterSec / 60) === 1 ? "" : "s"}`
      : `${retryAfterSec} second${retryAfterSec === 1 ? "" : "s"}`;
  return `You've made a lot of requests in a short time. Please wait ${wait} and try again.`;
}
