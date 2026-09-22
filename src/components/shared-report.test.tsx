// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { SharedReport } from "@/components/shared-report";
import { encodeReport } from "@/lib/report";

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

function renderShare(): void {
  render(
    <ThemeProvider>
      <SharedReport />
    </ThemeProvider>,
  );
}

describe("Shared report page", () => {
  it("renders a report from the URL fragment, read-only", async () => {
    const token = await encodeReport({
      v: 1,
      title: "Rent agreement — Pune",
      createdAt: Date.UTC(2026, 8, 1),
      sections: [{ action: "risks", markdown: "## Risk score: 40/100\nMostly fine.", grounded: true }],
    });
    window.location.hash = `#r=${token}`;
    renderShare();
    expect(await screen.findByRole("heading", { name: "Rent agreement — Pune" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Risk score: 40/100" })).toBeInTheDocument();
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("explains a broken or truncated link", async () => {
    window.location.hash = "#r=z.broken";
    renderShare();
    expect(await screen.findByText(/doesn't contain a readable report/i)).toBeInTheDocument();
  });
});
