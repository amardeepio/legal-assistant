// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/theme-provider";
import { WorkspaceProvider } from "@/components/studio/workspace";
import { ToolPage } from "@/components/studio/tool-page";
import { ChatPanel } from "@/components/studio/chat-panel";
import { StudioShell } from "@/components/studio/studio-shell";
import Home from "@/app/page";

vi.mock("next/navigation", () => ({
  usePathname: (): string => "/simplify",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function sseResponse(markdown: string, extra: Record<string, unknown> = {}): Response {
  const done = {
    action: "simplify",
    markdown,
    model: "groq/compound",
    grounded: true,
    ...extra,
  };
  const body = [
    { event: "progress", data: { phase: "reading", label: "Reading your document…" } },
    { event: "token", data: { token: markdown } },
    { event: "done", data: done },
  ]
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join("");
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

function stubFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("extract-pdf")) {
        return jsonResponse({
          text: "PDF TEXT HERE",
          pages: 2,
          fileName: "a.pdf",
          truncated: false,
        });
      }
      if (url.includes("analyze/stream")) {
        return sseResponse("## TL;DR\nHello world");
      }
      return jsonResponse({
        action: "simplify",
        markdown: "## TL;DR\nHello world",
        model: "groq/compound",
        grounded: true,
      });
    }),
  );
}

function renderLanding(): void {
  render(
    <ThemeProvider>
      <Home />
    </ThemeProvider>,
  );
}

function renderTool(tool: "simplify" | "risks" | "compare" | "playbook" | "action" | "handoff" | "stamp"): void {
  render(
    <ThemeProvider>
      <WorkspaceProvider>
        <ToolPage tool={tool} />
      </WorkspaceProvider>
    </ThemeProvider>,
  );
}

function renderAsk(): void {
  render(
    <ThemeProvider>
      <WorkspaceProvider>
        <ChatPanel />
      </WorkspaceProvider>
    </ThemeProvider>,
  );
}

function renderShellWithTool(): void {
  render(
    <ThemeProvider>
      <WorkspaceProvider>
        <StudioShell>
          <ToolPage tool="simplify" />
        </StudioShell>
      </WorkspaceProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  stubFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Landing", () => {
  it("renders hero and links to all eight tools", () => {
    renderLanding();
    expect(screen.getByText(/finally readable/i)).toBeInTheDocument();
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    for (const href of [
      "/simplify",
      "/risks",
      "/playbook",
      "/compare",
      "/ask",
      "/action",
      "/handoff",
      "/stamp",
    ]) {
      expect(hrefs).toContain(href);
    }
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
    expect(screen.getByRole("button", { name: /switch to light theme/i })).toBeInTheDocument();
  });
});

describe("Studio shell", () => {
  it("shows sidebar nav with eight tool links and highlights the active page", () => {
    renderShellWithTool();
    const nav = screen.getByRole("navigation", { name: "Tools" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(8);
    expect(within(nav).getByRole("link", { name: /plain-language summary/i })).toHaveAttribute(
      "href",
      "/simplify",
    );
    expect(within(nav).getByRole("link", { name: /plain-language summary/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("asks for disclaimer consent once, then starts the product tour", async () => {
    renderShellWithTool();
    fireEvent.click(screen.getByRole("button", { name: "I understand" }));
    expect(screen.queryByText("Before you start")).not.toBeInTheDocument();
    const tour = await screen.findByRole("dialog", { name: "Pick a tool" });
    fireEvent.click(within(tour).getByRole("button", { name: "Skip tour" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    cleanup();
    renderShellWithTool();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Simplify tool page", () => {
  it("blocks empty runs with a validation error", async () => {
    const user = userEvent.setup();
    renderTool("simplify");
    await user.click(screen.getByRole("button", { name: /run simplify/i }));
    expect(await screen.findByText(/at least a few sentences/i)).toBeInTheDocument();
  });

  it("loads a sample document and runs a successful analysis", async () => {
    const user = userEvent.setup();
    renderTool("simplify");
    await user.click(screen.getByRole("button", { name: "Contract" }));
    const box = screen.getByPlaceholderText(/paste your contract/i) as HTMLTextAreaElement;
    expect(box.value).toContain("FREELANCE");
    await user.click(screen.getByRole("button", { name: /run simplify/i }));
    expect(await screen.findByRole("heading", { name: "TL;DR" })).toBeInTheDocument();
    expect(screen.getByText("Web-verified")).toBeInTheDocument();
  });

  it("copies the result markdown to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderTool("simplify");
    fireEvent.click(screen.getByRole("button", { name: "Contract" }));
    fireEvent.click(screen.getByRole("button", { name: /run simplify/i }));
    await screen.findByRole("heading", { name: "TL;DR" });
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy text/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Hello world"));
    });
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("shows a plain error with Retry, and Retry re-runs the analysis", async () => {
    renderTool("simplify");
    fireEvent.click(screen.getByRole("button", { name: "Contract" }));
    // Both the stream and its buffered fallback must fail to surface an error.
    vi.mocked(window.fetch).mockRejectedValueOnce(new Error("down"));
    vi.mocked(window.fetch).mockRejectedValueOnce(new Error("down"));
    fireEvent.click(screen.getByRole("button", { name: /run simplify/i }));
    expect(await screen.findByText(/couldn't reach the server/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "TL;DR" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders risk severity, section jumps and cited sources", async () => {
    const markdown = [
      "## Risk score: 62/100",
      "## 🔴 High-risk clauses",
      "| Clause | Risk |",
      "|---|---|",
      "| Non-compete | High |",
      "## Missing protections",
      "See [Contract Act s.27](https://indiacode.nic.in/s27)",
    ].join("\n");
    vi.mocked(window.fetch).mockResolvedValueOnce(
      sseResponse(markdown, { action: "risks" }),
    );
    renderTool("risks");
    fireEvent.click(screen.getByRole("button", { name: "Contract" }));
    fireEvent.click(screen.getByRole("button", { name: /run risk x-ray/i }));
    const jump = await screen.findByRole("navigation", { name: /jump to section/i });
    expect(within(jump).getAllByRole("link")).toHaveLength(3);
    expect(screen.getByText("High", { selector: ".sev-pill" })).toBeInTheDocument();
    expect(screen.getByText("Sources (1)")).toBeInTheDocument();
  });
});

describe("Ask page", () => {
  it("sends a question and renders the threaded reply", async () => {
    const user = userEvent.setup();
    renderAsk();
    const box = screen.getByPlaceholderText(/ask about indian law or your document/i);
    await user.type(box, "Is an 11-month agreement valid?");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(await screen.findByText("Is an 11-month agreement valid?")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "TL;DR" })).toBeInTheDocument();
    });
    expect(vi.mocked(window.fetch)).toHaveBeenCalledWith(
      "/api/analyze/stream",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rolls back the optimistic message when the request fails", async () => {
    const user = userEvent.setup();
    renderAsk();
    vi.mocked(window.fetch).mockRejectedValueOnce(new Error("down"));
    vi.mocked(window.fetch).mockRejectedValueOnce(new Error("down"));
    await user.type(screen.getByPlaceholderText(/ask about indian law/i), "Will this fail?");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(await screen.findByText(/couldn't reach the server/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Will this fail?")).not.toBeInTheDocument();
    });
  });

  it("shows suggestion cards when the thread is empty", async () => {
    const user = userEvent.setup();
    renderAsk();
    expect(await screen.findByText(/what's your legal question/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /non-compete after resignation/i }));
    const box = screen.getByPlaceholderText(/ask about indian law/i) as HTMLInputElement;
    expect(box.value).toContain("non-compete");
  });
});

describe("File uploads", () => {
  it("reads .txt files directly into the document box", async () => {
    renderTool("simplify");
    const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (input === null) throw new Error("file input missing");
    const file = new File(["plain text document body here"], "note.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      const box = screen.getByPlaceholderText(/paste your contract/i) as HTMLTextAreaElement;
      expect(box.value).toBe("plain text document body here");
    });
  });

  it("extracts PDFs server-side with a confirmation notice", async () => {
    renderTool("simplify");
    const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (input === null) throw new Error("file input missing");
    const file = new File(["%PDF-1.4"], "deed.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText("a.pdf")).toBeInTheDocument();
    expect(screen.getByText(/2 pages/i)).toBeInTheDocument();
    const box = screen.getByPlaceholderText(/paste your contract/i) as HTMLTextAreaElement;
    expect(box.value).toBe("PDF TEXT HERE");
  });
});

describe("Roadmap features", () => {
  function lastBody(): Record<string, unknown> {
    const calls = vi.mocked(window.fetch).mock.calls.filter((c) => {
      const url = String(c[0]);
      return url === "/api/analyze" || url === "/api/analyze/stream";
    });
    const init = calls[calls.length - 1]?.[1] as RequestInit | undefined;
    return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
  }

  it("shows an instant word-level redline in Compare without calling the AI", async () => {
    renderTool("compare");
    fireEvent.change(screen.getByRole("textbox", { name: "Document A" }), {
      target: { value: "Client shall pay Rs. 85,000 within 30 days of invoice." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Document B" }), {
      target: { value: "Client shall pay Rs. 90,000 within 30 days of invoice." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Redline" }));
    const article = await screen.findByRole("article", { name: "Redline" });
    expect(article.querySelector("del")?.textContent).toContain("85,000");
    expect(article.querySelector("ins")?.textContent).toContain("90,000");
    expect(screen.getByText(/\+1 word added/)).toBeInTheDocument();
    expect(vi.mocked(window.fetch)).not.toHaveBeenCalled();
  });

  it("sends only enabled playbook positions and persists edits", async () => {
    renderTool("playbook");
    fireEvent.click(screen.getByRole("button", { name: "Contract" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Check position 1" }));
    fireEvent.change(screen.getByRole("textbox", { name: "New playbook position" }), {
      target: { value: "Deposit refunded within 15 days" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: /run playbook/i }));
    await screen.findByRole("heading", { name: "TL;DR" });
    const body = lastBody();
    expect(body["action"]).toBe("playbook");
    const rules = body["rules"] as string[];
    expect(rules.some((r) => /liability must be mutual/i.test(r))).toBe(false);
    expect(rules).toContain("Deposit refunded within 15 days");
    expect(window.localStorage.getItem("lexclarity-playbook")).toContain("Deposit refunded");
  });

  it("estimates Maharashtra leave & licence duty offline and verifies it live", async () => {
    renderTool("stamp");
    expect(screen.getByText("₹1,600")).toBeInTheDocument();
    expect(screen.getByText(/s\.55 Maharashtra Rent Control Act/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /verify with live sources/i }));
    await screen.findByRole("heading", { name: "TL;DR" });
    const body = lastBody();
    expect(body).toMatchObject({ action: "stamp", state: "Maharashtra", instrument: "rent" });
    expect(String(body["details"])).toContain("₹1,600");
  });

  it("builds an advocate brief and lists where to find an advocate", async () => {
    renderTool("handoff");
    expect(screen.getByRole("link", { name: /free legal aid/i })).toHaveAttribute(
      "href",
      "https://nalsa.gov.in/",
    );
    fireEvent.click(screen.getByRole("button", { name: "Contract" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your situation" }), {
      target: { value: "Client has not paid two invoices" },
    });
    fireEvent.click(screen.getByRole("button", { name: /build advocate brief/i }));
    expect(await screen.findByRole("button", { name: /brief pdf/i })).toBeInTheDocument();
    expect(lastBody()).toMatchObject({
      action: "handoff",
      situation: "Client has not paid two invoices",
    });
  });

  it("copies a read-only share link for the full report", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", { value: { writeText }, configurable: true });
    renderTool("simplify");
    fireEvent.click(screen.getByRole("button", { name: "Contract" }));
    fireEvent.click(screen.getByRole("button", { name: /run simplify/i }));
    await screen.findByRole("heading", { name: "TL;DR" });
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy read-only link/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/share#r=[zj]\./));
    });
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
  });

  it("saves analyses to the Library and reopens them from the shell", async () => {
    render(
      <ThemeProvider>
        <WorkspaceProvider>
          <StudioShell>
            <ToolPage tool="simplify" />
          </StudioShell>
        </WorkspaceProvider>
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Contract" }));
    fireEvent.click(screen.getByRole("button", { name: /run simplify/i }));
    await screen.findByRole("heading", { name: "TL;DR" });
    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    const list = screen.getByRole("list", { name: "Saved analyses" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    fireEvent.click(within(items[0] as HTMLElement).getByTitle("Open in the studio"));
    expect(await screen.findByRole("heading", { name: "TL;DR" })).toBeInTheDocument();
  });
});
