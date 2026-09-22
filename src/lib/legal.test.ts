import { describe, expect, it } from "vitest";
import {
  ActionPlanSchema,
  AnalyzeRequestSchema,
  AskSchema,
  CompareSchema,
  HandoffSchema,
  PlaybookSchema,
  RisksSchema,
  StampSchema,
  SAMPLE_DOCS,
  SimplifySchema,
  truncate,
} from "@/lib/legal";

const DOC = "This is a sufficiently long legal document excerpt. ".repeat(4);

describe("SimplifySchema", () => {
  it("accepts a valid simplify request", () => {
    const r = SimplifySchema.safeParse({
      action: "simplify",
      document: DOC,
      readingLevel: "plain",
      jurisdiction: "Pune, Maharashtra",
    });
    expect(r.success).toBe(true);
  });

  it("rejects documents that are too short", () => {
    const r = SimplifySchema.safeParse({ action: "simplify", document: "hi" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown reading levels", () => {
    const r = SimplifySchema.safeParse({
      action: "simplify",
      document: DOC,
      readingLevel: "genius",
    });
    expect(r.success).toBe(false);
  });
});

describe("RisksSchema", () => {
  it("accepts a valid risks request without optional fields", () => {
    expect(
      RisksSchema.safeParse({ action: "risks", document: DOC }).success,
    ).toBe(true);
  });
});

describe("CompareSchema", () => {
  it("accepts two documents with labels", () => {
    const r = CompareSchema.safeParse({
      action: "compare",
      documentA: DOC,
      documentB: DOC,
      labelA: "A",
      labelB: "B",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a missing second document", () => {
    const r = CompareSchema.safeParse({
      action: "compare",
      documentA: DOC,
      documentB: "tiny",
    });
    expect(r.success).toBe(false);
  });
});

describe("AskSchema", () => {
  it("accepts a question with no document", () => {
    expect(
      AskSchema.safeParse({ action: "ask", question: "What is stamp duty?" })
        .success,
    ).toBe(true);
  });

  it("accepts history within limits", () => {
    const r = AskSchema.safeParse({
      action: "ask",
      question: "And the procedure?",
      history: [{ role: "user", content: "First question" }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty questions and oversized history", () => {
    expect(
      AskSchema.safeParse({ action: "ask", question: "  " }).success,
    ).toBe(false);
    const big = Array.from({ length: 21 }, (_, i) => ({
      role: "user" as const,
      content: `q${i}`,
    }));
    expect(
      AskSchema.safeParse({ action: "ask", question: "Hello?", history: big })
        .success,
    ).toBe(false);
  });
});

describe("ActionPlanSchema", () => {
  it("accepts an optional goal", () => {
    expect(
      ActionPlanSchema.safeParse({
        action: "action",
        document: DOC,
        goal: "Decide whether to sign",
      }).success,
    ).toBe(true);
  });
});

describe("PlaybookSchema", () => {
  it("needs at least one position and caps the list at 20", () => {
    expect(
      PlaybookSchema.safeParse({ action: "playbook", document: DOC, rules: ["Liability must be mutual"] }).success,
    ).toBe(true);
    expect(PlaybookSchema.safeParse({ action: "playbook", document: DOC, rules: [] }).success).toBe(false);
    const many = Array.from({ length: 21 }, (_, n) => `Rule number ${n}`);
    expect(PlaybookSchema.safeParse({ action: "playbook", document: DOC, rules: many }).success).toBe(false);
  });
});

describe("HandoffSchema", () => {
  it("accepts an optional situation note and specialty", () => {
    expect(
      HandoffSchema.safeParse({
        action: "handoff",
        document: DOC,
        situation: "Client withheld the last invoice",
        specialty: "Contracts & commercial",
      }).success,
    ).toBe(true);
    expect(
      HandoffSchema.safeParse({ action: "handoff", document: DOC, situation: "x".repeat(2001) }).success,
    ).toBe(false);
  });
});

describe("StampSchema", () => {
  it("requires a state, a known instrument and the estimate details", () => {
    const ok = { action: "stamp", state: "Maharashtra", instrument: "rent", details: "Rent 18,500 × 11 months" };
    expect(StampSchema.safeParse(ok).success).toBe(true);
    expect(StampSchema.safeParse({ ...ok, instrument: "gift" }).success).toBe(false);
    expect(StampSchema.safeParse({ ...ok, details: "" }).success).toBe(false);
  });
});

describe("AnalyzeRequestSchema (discriminated union)", () => {
  it("routes each action to its schema", () => {
    for (const action of [
      "simplify",
      "risks",
      "compare",
      "ask",
      "action",
      "playbook",
      "handoff",
      "stamp",
    ] as const) {
      const base =
        action === "compare"
          ? { documentA: DOC, documentB: DOC }
          : action === "ask"
            ? { question: "Is this valid?" }
            : action === "playbook"
              ? { document: DOC, rules: ["Liability is capped"] }
              : action === "stamp"
                ? { state: "Delhi", instrument: "sale", details: "Value 50 lakh, joint" }
                : { document: DOC };
      expect(
        AnalyzeRequestSchema.safeParse({ action, ...base }).success,
      ).toBe(true);
    }
  });

  it("rejects unknown actions", () => {
    expect(
      AnalyzeRequestSchema.safeParse({ action: "litigate", document: DOC })
        .success,
    ).toBe(false);
  });
});

describe("truncate", () => {
  it("returns short text untouched", () => {
    expect(truncate("hello")).toBe("hello");
  });

  it("caps long text and marks truncation", () => {
    const out = truncate("x".repeat(100), 10);
    expect(out.startsWith("x".repeat(10))).toBe(true);
    expect(out).toContain("[TRUNCATED");
  });
});

describe("SAMPLE_DOCS", () => {
  it("ships usable demo documents with unique ids", () => {
    expect(SAMPLE_DOCS.length).toBeGreaterThanOrEqual(3);
    const ids = SAMPLE_DOCS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SAMPLE_DOCS) {
      expect(s.body.length).toBeGreaterThan(100);
    }
  });
});
