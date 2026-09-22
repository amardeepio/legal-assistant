import { describe, expect, it } from "vitest";
import {
  extractSections,
  extractSources,
  inline,
  playbookStatusOf,
  severityOf,
} from "@/components/markdown";

describe("inline", () => {
  it("escapes raw HTML from model output", () => {
    const out = inline('<img src=x onerror="alert(1)"> **bold**');
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    expect(out).toContain("<strong>bold</strong>");
  });

  it("links only http(s) URLs and opens them safely", () => {
    const out = inline("See [Act](https://indiacode.nic.in/x) and [bad](javascript:alert(1))");
    expect(out).toContain(
      '<a href="https://indiacode.nic.in/x" target="_blank" rel="noopener noreferrer">Act</a>',
    );
    expect(out).not.toContain('href="javascript');
  });

  it("links bare URLs without trailing punctuation", () => {
    expect(inline("Source: https://example.gov.in/rule.")).toContain(
      'href="https://example.gov.in/rule"',
    );
  });

  it("turns severity emoji into styled dots", () => {
    expect(inline("🔴 High-risk clauses")).toContain('class="sev-dot sev-high"');
  });
});

describe("severityOf", () => {
  it.each([
    ["High", "high"],
    ["🟡 Medium", "medium"],
    ["**Low risk**", "low"],
  ])("reads %s as %s", (cell, level) => {
    expect(severityOf(cell)).toBe(level);
  });

  it("ignores ordinary cells", () => {
    expect(severityOf("High Court of Patna")).toBeUndefined();
  });
});

describe("extractSections", () => {
  it("lists ## headings with clean labels and stable ids", () => {
    const md = "## TL;DR (3 bullets)\ntext\n### sub\n## 🔴 High-risk clauses\n## **Next steps**";
    expect(extractSections(md, "sec")).toEqual([
      { id: "sec-0", label: "TL;DR" },
      { id: "sec-1", label: "High-risk clauses" },
      { id: "sec-2", label: "Next steps" },
    ]);
  });
});

describe("extractSources", () => {
  it("dedupes markdown and bare links, labelling bare ones by host", () => {
    const md =
      "Per [Contract Act s.27](https://indiacode.nic.in/a) and https://www.nalsa.gov.in/aid. Again https://indiacode.nic.in/a";
    expect(extractSources(md)).toEqual([
      { url: "https://indiacode.nic.in/a", label: "Contract Act s.27" },
      { url: "https://www.nalsa.gov.in/aid", label: "nalsa.gov.in" },
    ]);
  });
});

describe("playbookStatusOf", () => {
  it("maps playbook verdicts to pill colours", () => {
    expect(playbookStatusOf("✅ Meets")).toEqual({ label: "Meets", sev: "low" });
    expect(playbookStatusOf("**Fails**")).toEqual({ label: "Fails", sev: "high" });
    expect(playbookStatusOf("Not addressed")?.sev).toBe("medium");
    expect(playbookStatusOf("Meets the standard")).toBeUndefined();
  });
});
