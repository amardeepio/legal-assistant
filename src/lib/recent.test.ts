// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { RecentItem } from "@/lib/recent";
import {
  RECENT_KEY,
  RECENT_LIMIT,
  acceptDisclaimer,
  completeTour,
  disclaimerAccepted,
  filterLibrary,
  loadRecent,
  removeRecent,
  renameRecent,
  saveRecent,
  togglePinRecent,
  titleFrom,
  tourCompleted,
} from "@/lib/recent";

function item(n: number, overrides: Partial<RecentItem> = {}): RecentItem {
  return {
    id: String(n),
    action: "simplify",
    title: `Doc ${n}`,
    createdAt: n,
    markdown: `## Result ${n}`,
    model: "m",
    grounded: false,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("recent analyses", () => {
  it("saves newest first and caps the list", () => {
    for (let n = 0; n < RECENT_LIMIT + 3; n += 1) saveRecent(item(n));
    const list = loadRecent();
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0]?.id).toBe(String(RECENT_LIMIT + 2));
  });

  it("replaces an identical result instead of duplicating it", () => {
    saveRecent(item(1));
    saveRecent(item(2, { markdown: "## Result 1" }));
    expect(loadRecent().map((r) => r.id)).toEqual(["2"]);
  });

  it("ignores corrupt or foreign storage", () => {
    window.localStorage.setItem(RECENT_KEY, "{not json");
    expect(loadRecent()).toEqual([]);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify([{ id: 1 }, item(3)]));
    expect(loadRecent().map((r) => r.id)).toEqual(["3"]);
  });
});

describe("titleFrom", () => {
  it("uses the first meaningful line, shortened", () => {
    expect(titleFrom("====\n\nRENT AGREEMENT\nbody", "Simplify")).toBe("RENT AGREEMENT");
    expect(titleFrom("x".repeat(80), "Simplify")).toHaveLength(58);
    expect(titleFrom("  \n", "Simplify")).toBe("Simplify");
  });
});

describe("disclaimer", () => {
  it("is remembered once accepted", () => {
    expect(disclaimerAccepted()).toBe(false);
    acceptDisclaimer();
    expect(disclaimerAccepted()).toBe(true);
  });
});

describe("product tour", () => {
  it("is remembered once finished or skipped", () => {
    expect(tourCompleted()).toBe(false);
    completeTour();
    expect(tourCompleted()).toBe(true);
  });
});

describe("saved library", () => {
  it("never evicts pinned items when the library is full", () => {
    saveRecent(item(0));
    togglePinRecent("0");
    for (let n = 1; n <= RECENT_LIMIT + 5; n += 1) saveRecent(item(n));
    const list = loadRecent();
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list.some((r) => r.id === "0" && r.pinned === true)).toBe(true);
  });

  it("removes, renames and filters items, pinned first", () => {
    saveRecent(item(1, { title: "Rent agreement" }));
    saveRecent(item(2, { title: "SaaS terms" }));
    saveRecent(item(3, { title: "NDA", markdown: "## mentions rent deposit" }));
    togglePinRecent("1");
    renameRecent("2", "  SaaS terms v2  ");
    expect(renameRecent("2", "   ").find((r) => r.id === "2")?.title).toBe("SaaS terms v2");
    expect(filterLibrary(loadRecent(), "").map((r) => r.id)).toEqual(["1", "3", "2"]);
    expect(filterLibrary(loadRecent(), "RENT").map((r) => r.id)).toEqual(["1", "3"]);
    expect(removeRecent("3").map((r) => r.id)).toEqual(["2", "1"]);
  });

  it("keeps new tool results such as playbook checks", () => {
    saveRecent(item(9, { action: "playbook", jurisdiction: "Pune" }));
    expect(loadRecent()[0]?.action).toBe("playbook");
  });
});
