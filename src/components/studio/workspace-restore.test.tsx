// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { WorkspaceProvider, useWorkspace } from "@/components/studio/workspace";
import { clearSession, loadSession, saveSession } from "@/lib/session-store";

function Probe(): React.JSX.Element {
  const ws = useWorkspace();
  return (
    <div>
      <p data-testid="doc">{ws.doc}</p>
      <p data-testid="restored">{ws.sessionRestored ? "yes" : "no"}</p>
      <p data-testid="history">{ws.history.length}</p>
      <button type="button" onClick={ws.startFresh}>
        fresh
      </button>
    </div>
  );
}

function renderProbe(): void {
  render(
    <ThemeProvider>
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>
    </ThemeProvider>,
  );
}

beforeEach(async () => {
  window.localStorage.clear();
  await clearSession();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("session restore", () => {
  it("starts fresh when nothing was saved", async () => {
    renderProbe();
    await waitFor(() => {
      expect(screen.getByTestId("restored")).toHaveTextContent("no");
    });
    expect(screen.getByTestId("doc")).toHaveTextContent("");
  });

  it("restores document, results-driven state and chat from IndexedDB", async () => {
    await saveSession({
      v: 1,
      savedAt: Date.now(),
      doc: "FREELANCE AGREEMENT saved body text here",
      docA: "",
      docB: "",
      labelA: "Contract A",
      labelB: "Contract B",
      goal: "",
      situation: "",
      specialty: "contract",
      jurisdiction: "Pune, Maharashtra",
      readingLevel: "plain",
      language: "en",
      results: {
        simplify: {
          action: "simplify",
          markdown: "## TL;DR\nRestored",
          model: "groq/compound",
          grounded: false,
        },
      },
      history: [{ role: "user", content: "saved question" }],
    });
    renderProbe();
    await waitFor(() => {
      expect(screen.getByTestId("restored")).toHaveTextContent("yes");
    });
    expect(screen.getByTestId("doc")).toHaveTextContent("saved body");
    expect(screen.getByTestId("history")).toHaveTextContent("1");
  });

  it("startFresh clears state and the stored snapshot", async () => {
    await saveSession({
      v: 1,
      savedAt: Date.now(),
      doc: "FREELANCE AGREEMENT saved body text here",
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
    });
    renderProbe();
    await waitFor(() => {
      expect(screen.getByTestId("restored")).toHaveTextContent("yes");
    });
    fireEvent.click(screen.getByRole("button", { name: "fresh" }));
    await waitFor(() => {
      expect(screen.getByTestId("doc")).toHaveTextContent("");
    });
    expect(screen.getByTestId("restored")).toHaveTextContent("no");
    expect(await loadSession()).toBeNull();
  });
});
