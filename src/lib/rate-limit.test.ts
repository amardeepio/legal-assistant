import { beforeEach, describe, expect, it } from "vitest";
import {
  ANALYZE_LIMITS,
  checkRateLimit,
  describeAnalyzeLimits,
  getClientIp,
  rateLimitMessage,
  resetRateLimits,
} from "@/lib/rate-limit";

beforeEach(() => {
  resetRateLimits();
});

describe("checkRateLimit", () => {
  it("allows hits under the limit", () => {
    const rule = [{ windowMs: 60_000, limit: 3 }];
    expect(checkRateLimit("a", rule, 0).allowed).toBe(true);
    expect(checkRateLimit("a", rule, 1_000).allowed).toBe(true);
    const third = checkRateLimit("a", rule, 2_000);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("denies the hit past the limit with a retry delay", () => {
    const rule = [{ windowMs: 60_000, limit: 2 }];
    checkRateLimit("a", rule, 0);
    checkRateLimit("a", rule, 1_000);
    const denied = checkRateLimit("a", rule, 2_000);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("slides: old hits expire and allow again", () => {
    const rule = [{ windowMs: 60_000, limit: 1 }];
    expect(checkRateLimit("a", rule, 0).allowed).toBe(true);
    expect(checkRateLimit("a", rule, 1_000).allowed).toBe(false);
    expect(checkRateLimit("a", rule, 61_000).allowed).toBe(true);
  });

  it("enforces the tightest of several rules", () => {
    const rules = [
      { windowMs: 60_000, limit: 100 },
      { windowMs: 3_600_000, limit: 2 },
    ];
    checkRateLimit("a", rules, 0);
    checkRateLimit("a", rules, 1_000);
    const third = checkRateLimit("a", rules, 2_000);
    expect(third.allowed).toBe(false);
    // Hourly window: wait is ~1h, rounded up to minutes-scale seconds.
    expect(third.retryAfterSec).toBeGreaterThan(3_000);
  });

  it("tracks keys independently", () => {
    const rule = [{ windowMs: 60_000, limit: 1 }];
    expect(checkRateLimit("a", rule, 0).allowed).toBe(true);
    expect(checkRateLimit("b", rule, 0).allowed).toBe(true);
    expect(checkRateLimit("a", rule, 1_000).allowed).toBe(false);
  });

  it("resets cleanly", () => {
    const rule = [{ windowMs: 60_000, limit: 1 }];
    checkRateLimit("a", rule, 0);
    resetRateLimits();
    expect(checkRateLimit("a", rule, 1_000).allowed).toBe(true);
  });

  it("ships sane default budgets", () => {
    expect(ANALYZE_LIMITS.length).toBeGreaterThan(0);
    for (const r of ANALYZE_LIMITS) {
      expect(r.limit).toBeGreaterThan(0);
      expect(r.windowMs).toBeGreaterThan(0);
    }
  });
});

describe("getClientIp", () => {
  const req = (headers: Record<string, string>): Request =>
    new Request("http://localhost/api/analyze", { headers });

  it("prefers the first x-forwarded-for entry", () => {
    expect(
      getClientIp(req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" })),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then unknown", () => {
    expect(getClientIp(req({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
    expect(getClientIp(req({}))).toBe("unknown");
  });
});

describe("rateLimitMessage", () => {
  it("phrases seconds and minutes", () => {
    expect(rateLimitMessage(20)).toContain("20 seconds");
    expect(rateLimitMessage(1)).toContain("1 second");
    expect(rateLimitMessage(120)).toContain("2 minutes");
  });

  it("describes the live analyze budgets", () => {
    expect(describeAnalyzeLimits()).toBe("5/minute · 30/hour");
  });
});
