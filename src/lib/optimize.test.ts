import { describe, expect, it } from "vitest";
import {
  estimateTokens,
  normalizeExtractedText,
  retrieveRelevant,
} from "@/lib/optimize";

describe("estimateTokens", () => {
  it("approximates chars/4 with a floor of 1", () => {
    expect(estimateTokens("x".repeat(400))).toBe(100);
    expect(estimateTokens("")).toBe(1);
  });
});

describe("normalizeExtractedText", () => {
  it("strips pdf-parse page joiners", () => {
    const out = normalizeExtractedText("Hello\n\n-- 1 of 2 --\n\nWorld");
    expect(out).toBe("Hello\n\nWorld");
  });

  it("collapses redundant whitespace and blank lines", () => {
    const out = normalizeExtractedText("Too   many    spaces\n\n\n\nNext");
    expect(out).toBe("Too many spaces\n\nNext");
  });

  it("drops repeated running headers but keeps first occurrences", () => {
    const header = "IN THE HIGH COURT OF JUDICATURE AT PATNA";
    const doc = [header, "Body one", header, "Body two", header, "Body three"].join(
      "\n",
    );
    const out = normalizeExtractedText(doc);
    const count = out.split("\n").filter((l) => l === header).length;
    expect(count).toBe(2);
    expect(out).toContain("Body three");
  });

  it("trims the result", () => {
    expect(normalizeExtractedText("  \n hello \n ")).toBe("hello");
  });
});

describe("retrieveRelevant", () => {
  const doc = [
    "Payment of Rs. 18,500 is due on the fifth of every month by bank transfer.",
    "The licensee shall maintain the premises in good condition at all times.",
    "ARBITRATION. Disputes about delayed payments go to arbitration in Pune with a sole arbitrator.",
    "The society maintenance charges shall be borne by the licensor.",
  ].join("\n\n");

  it("returns the whole document when it fits the budget", () => {
    const r = retrieveRelevant(doc, "anything", 100_000);
    expect(r.trimmed).toBe(false);
    expect(r.coverage).toBe(1);
    expect(r.text).toBe(doc);
  });

  it("selects the matching paragraph for a keyword query", () => {
    const r = retrieveRelevant(doc, "arbitration delayed payments Pune", 200);
    expect(r.trimmed).toBe(true);
    expect(r.text).toContain("ARBITRATION");
    expect(r.text).not.toContain("society maintenance");
  });

  it("preserves document order in excerpts", () => {
    const r = retrieveRelevant(doc, "payment licensor maintenance", 1000);
    const payIdx = r.text.indexOf("Rs. 18,500");
    const maintIdx = r.text.indexOf("society maintenance");
    expect(payIdx).toBeGreaterThanOrEqual(0);
    expect(maintIdx).toBeGreaterThan(payIdx);
  });

  it("head-truncates when nothing matches", () => {
    const r = retrieveRelevant(doc, "zzzqqq xxx", 50);
    expect(r.trimmed).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(50);
  });

  it("handles empty documents", () => {
    const r = retrieveRelevant("", "rent", 100);
    expect(r.text).toBe("");
    expect(r.trimmed).toBe(false);
  });
});
