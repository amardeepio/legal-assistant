// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSession,
  isSessionSnapshot,
  isSnapshotEmpty,
  loadSession,
  saveSession,
} from "@/lib/session-store";
import type { SessionSnapshot } from "@/lib/session-store";

function snap(over: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    v: 1,
    savedAt: Date.now(),
    doc: "",
    docA: "",
    docB: "",
    labelA: "Contract A",
    labelB: "Contract B",
    goal: "",
    situation: "",
    specialty: "contract",
    jurisdiction: "Maharashtra, India",
    readingLevel: "standard",
    language: "en",
    results: {},
    history: [],
    ...over,
  };
}

beforeEach(async () => {
  await clearSession();
});

describe("session-store", () => {
  it("round-trips a snapshot", async () => {
    await saveSession(
      snap({
        doc: "FREELANCE AGREEMENT body",
        history: [{ role: "user", content: "Is this valid?" }],
        results: {
          simplify: {
            action: "simplify",
            markdown: "## TL;DR\nYes",
            model: "groq/compound",
            grounded: true,
          },
        },
      }),
    );
    const loaded = await loadSession();
    expect(loaded?.doc).toBe("FREELANCE AGREEMENT body");
    expect(loaded?.history).toHaveLength(1);
    expect(loaded?.results["simplify"]?.markdown).toContain("TL;DR");
  });

  it("returns null when nothing was saved", async () => {
    expect(await loadSession()).toBeNull();
  });

  it("clears the saved snapshot", async () => {
    await saveSession(snap({ doc: "hello world this is long enough" }));
    await clearSession();
    expect(await loadSession()).toBeNull();
  });

  it("rejects malformed snapshots", () => {
    expect(isSessionSnapshot(null)).toBe(false);
    expect(isSessionSnapshot({ v: 2 })).toBe(false);
    expect(isSessionSnapshot(snap())).toBe(true);
    expect(
      isSessionSnapshot({ ...snap(), results: { x: { nope: 1 } } }),
    ).toBe(false);
    expect(
      isSessionSnapshot({ ...snap(), history: [{ role: "bot", content: "hi" }] }),
    ).toBe(false);
  });

  it("detects empty snapshots", () => {
    expect(isSnapshotEmpty(snap())).toBe(true);
    expect(isSnapshotEmpty(snap({ doc: "  " }))).toBe(true);
    expect(isSnapshotEmpty(snap({ doc: "some text here" }))).toBe(false);
    expect(
      isSnapshotEmpty(snap({ history: [{ role: "user", content: "hi" }] })),
    ).toBe(false);
  });
});
