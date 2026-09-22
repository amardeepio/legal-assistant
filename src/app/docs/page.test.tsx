// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import DocsPage from "@/app/docs/page";

afterEach(() => {
  cleanup();
});

describe("Docs page", () => {
  it("renders every section with a working in-page link", () => {
    render(
      <ThemeProvider>
        <DocsPage />
      </ThemeProvider>,
    );
    const toc = screen.getByRole("navigation", { name: "On this page" });
    const links = within(toc).getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(10);
    for (const link of links) {
      const id = link.getAttribute("href")?.slice(1) ?? "";
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("documents the real limits and the legal-aid helpline", () => {
    render(
      <ThemeProvider>
        <DocsPage />
      </ThemeProvider>,
    );
    expect(screen.getByText(/60k characters per document/)).toBeInTheDocument();
    expect(screen.getByText(/12 MB and the first 40 pages/)).toBeInTheDocument();
    expect(screen.getAllByText(/15100/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /back to app/i })).toHaveAttribute("href", "/");
  });
});
