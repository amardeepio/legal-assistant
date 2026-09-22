import { describe, expect, it } from "vitest";
import type { Report } from "@/lib/report";
import {
  buildReportMarkdown,
  decodeReport,
  encodeReport,
  orderSections,
  reportFileName,
  shareUrl,
  tokenFromHash,
} from "@/lib/report";

const report: Report = {
  v: 1,
  title: "Freelance Services Agreement",
  createdAt: Date.UTC(2026, 8, 15),
  jurisdiction: "Pune, Maharashtra",
  sections: [
    { action: "risks", markdown: "## Risk score: 62/100\n- Non-compete ₹ हिंदी", grounded: true },
    { action: "handoff", markdown: "## Matter summary\nClient is a designer.", grounded: false },
  ],
};

describe("buildReportMarkdown", () => {
  it("puts the advocate brief first and nests each tool's headings", () => {
    const md = buildReportMarkdown(report);
    expect(md.startsWith("# Freelance Services Agreement")).toBe(true);
    expect(md.indexOf("## Advocate Brief")).toBeLessThan(md.indexOf("## Risk X-Ray"));
    expect(md).toContain("### Risk score: 62/100");
    expect(md).toContain("Pune, Maharashtra");
    expect(md).toMatch(/not legal advice/i);
  });

  it("orders sections without mutating the input", () => {
    expect(orderSections(report.sections).map((s) => s.action)).toEqual(["handoff", "risks"]);
    expect(report.sections[0]?.action).toBe("risks");
  });
});

describe("share links", () => {
  it("round-trips a report, including Indic text, through the URL fragment", async () => {
    const token = await encodeReport(report);
    expect(token).toMatch(/^[zj]\.[A-Za-z0-9_-]+$/);
    const url = shareUrl("https://lexclarity.example", token);
    const hash = new URL(url).hash;
    expect(new URL(url).pathname).toBe("/share");
    const back = await decodeReport(tokenFromHash(hash) ?? "");
    expect(back).toEqual(report);
  });

  it("rejects tampered or foreign tokens", async () => {
    expect(await decodeReport("z.not-really-deflate")).toBeNull();
    expect(await decodeReport("x.abc")).toBeNull();
    const bad = `j.${btoa(JSON.stringify({ v: 2 }))}`;
    expect(await decodeReport(bad)).toBeNull();
    expect(tokenFromHash("#other=1")).toBeUndefined();
  });

  it("makes safe download names", () => {
    expect(reportFileName("Rent: Pune / 2026!")).toBe("lexclarity-report-rent-pune-2026.md");
    expect(reportFileName("")).toBe("lexclarity-report.md");
  });
});
