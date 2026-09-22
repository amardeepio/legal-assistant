import { describe, expect, it } from "vitest";
import { collapseEqual, diffWords, editScript, tokenize } from "@/lib/diff";

function apply(ops: ReturnType<typeof diffWords>["ops"], side: "before" | "after"): string {
  return ops
    .filter((o) => o.kind === "equal" || o.kind === (side === "after" ? "insert" : "delete"))
    .map((o) => o.text)
    .join("");
}

describe("editScript", () => {
  it("finds the shortest script and respects the edit cap", () => {
    const s = editScript(["a", "b", "c", "d"], ["a", "x", "c", "d", "e"], 10);
    expect(s?.filter((c) => c !== "e")).toHaveLength(3);
    expect(editScript(["a", "b", "c"], ["x", "y", "z"], 2)).toBeNull();
    expect(editScript([], ["a"], 0)).toEqual(["i"]);
  });
});

describe("tokenize", () => {
  it("keeps amounts and decimals whole and splits punctuation", () => {
    const keys = tokenize("Pay Rs. 85,000 at 1.5% monthly.").map((t) => t.key);
    expect(keys).toEqual(["Pay", "Rs", ".", "85,000", "at", "1.5", "%", "monthly", "."]);
  });
});

describe("diffWords", () => {
  it("marks changed words inline and counts them", () => {
    const r = diffWords(
      "Client shall pay Rs. 85,000 within 30 days of invoice.",
      "Client shall pay Rs. 90,000 within 45 days of invoice.",
    );
    expect(r.identical).toBe(false);
    expect(r.ops.filter((o) => o.kind === "delete").map((o) => o.text.trim())).toEqual([
      "85,000",
      "30",
    ]);
    expect(r.ops.filter((o) => o.kind === "insert").map((o) => o.text.trim())).toEqual([
      "90,000",
      "45",
    ]);
    expect(r.stats).toMatchObject({ insertedWords: 2, deletedWords: 2 });
  });

  it("reconstructs both versions from the op list", () => {
    const before = "1. TERM. Eleven months.\n2. DEPOSIT. Rs. 50,000 refundable.\n3. Courts at Pune.\n";
    const after = "1. TERM. Eleven months.\n2. DEPOSIT. Rs. 75,000, refundable within 30 days.\n3. Courts at Pune.\n4. Lock-in: 6 months.\n";
    const r = diffWords(before, after);
    expect(apply(r.ops, "after")).toBe(after);
    // Unchanged text takes the new version's spacing, so compare words only.
    expect(apply(r.ops, "before").replaceAll(/\s+/g, "")).toBe(before.replaceAll(/\s+/g, ""));
  });

  it("re-wrapped lines with one inserted word show only that word", () => {
    const r = diffWords(
      "The Contractor shall not disclose\nconfidential information.",
      "The Contractor shall not disclose any confidential\ninformation.",
    );
    expect(r.ops.filter((o) => o.kind !== "equal").map((o) => o.text.trim())).toEqual(["any"]);
  });

  it("reports identical documents", () => {
    const r = diffWords("Same text here.", "Same  text here.\r\n");
    expect(r.identical).toBe(true);
    expect(r.stats.insertedWords).toBe(0);
  });

  it("stays fast on long documents", () => {
    const base = Array.from({ length: 600 }, (_, n) => `Clause ${n}. The parties agree to term ${n}.`).join("\n");
    const edited = base.replace("term 300", "revised term 300").replace("Clause 10.", "Clause ten.");
    const t0 = performance.now();
    const r = diffWords(base, edited);
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(r.stats.insertedWords).toBe(2);
    expect(r.stats.deletedWords).toBe(1);
  });
});

describe("collapseEqual", () => {
  it("shortens long unchanged runs but keeps changes", () => {
    const ops = collapseEqual(
      [
        { kind: "equal", text: "x".repeat(1000) },
        { kind: "insert", text: "new" },
        { kind: "equal", text: "y".repeat(1000) },
      ],
      50,
    );
    expect(ops[0]?.text.length).toBeLessThan(60);
    expect(ops[1]?.text).toBe("new");
    expect(ops[2]?.text.startsWith("y".repeat(50))).toBe(true);
  });
});
