import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.hoisted(() => vi.fn());

vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));

import { buildMessages, resolveApiKey, runCompound, runCompoundStream } from "@/lib/groq";

function completion(
  text: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    ...extra,
  };
}

const DOC = "Payment terms. ".repeat(30);

describe("resolveApiKey", () => {
  const OLD = process.env["GROQ_API_KEY"];

  beforeEach(() => {
    if (OLD === undefined) delete process.env["GROQ_API_KEY"];
    else process.env["GROQ_API_KEY"] = OLD;
  });

  afterEach(() => {
    if (OLD === undefined) delete process.env["GROQ_API_KEY"];
    else process.env["GROQ_API_KEY"] = OLD;
  });

  it("prefers an explicit key over the environment", () => {
    process.env["GROQ_API_KEY"] = "env-key";
    expect(resolveApiKey("explicit-key")).toBe("explicit-key");
  });

  it("falls back to the environment variable", () => {
    process.env["GROQ_API_KEY"] = "env-key";
    expect(resolveApiKey(undefined)).toBe("env-key");
    expect(resolveApiKey("  ")).toBe("env-key");
  });

  it("returns undefined when no key exists", () => {
    delete process.env["GROQ_API_KEY"];
    expect(resolveApiKey(undefined)).toBeUndefined();
  });
});

describe("runCompound", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("returns markdown, model, and token usage", async () => {
    createMock.mockResolvedValueOnce(completion("## TL;DR\nHi"));
    const r = await runCompound(
      { action: "simplify", document: DOC },
      "test-key",
    );
    expect(r.markdown).toContain("TL;DR");
    expect(r.model).toBe("openai/gpt-oss-120b");
    expect(r.grounded).toBe(false);
    expect(r.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });

  it("caps ask output at 1800 tokens", async () => {
    createMock.mockResolvedValueOnce(completion("Answer"));
    await runCompound(
      { action: "ask", question: "Is this valid?" },
      "test-key",
    );
    const args = createMock.mock.calls[0]?.[0] as
      | { max_tokens?: number }
      | undefined;
    expect(args?.max_tokens).toBe(1800);
  });

  it("detects grounded tool use", async () => {
    createMock.mockResolvedValueOnce(
      completion("Grounded answer", { executed_tools: ["web_search"] }),
    );
    const r = await runCompound(
      { action: "ask", question: "Current stamp duty?" },
      "test-key",
    );
    expect(r.grounded).toBe(true);
  });

  it("falls back to the smaller model when the primary model fails", async () => {
    createMock
      .mockRejectedValueOnce(new Error("primary down"))
      .mockResolvedValueOnce(completion("Fallback ok"));
    const r = await runCompound(
      { action: "simplify", document: DOC },
      "test-key",
    );
    expect(r.model).toBe("openai/gpt-oss-20b");
    expect(r.markdown).toBe("Fallback ok");
  });

  it("throws when both models fail or return empty", async () => {
    createMock
      .mockResolvedValueOnce(completion("   "))
      .mockRejectedValueOnce(new Error("mini down"));
    await expect(
      runCompound({ action: "simplify", document: DOC }, "test-key"),
    ).rejects.toThrow();
  });
});

describe("runCompoundStream", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  function chunkStream(
    chunks: Record<string, unknown>[],
  ): AsyncGenerator<Record<string, unknown>> {
    return (async function* () {
      for (const c of chunks) yield c;
    })();
  }

  function textChunk(text: string): Record<string, unknown> {
    return { choices: [{ delta: { content: text } }] };
  }

  it("accumulates deltas and forwards each token", async () => {
    createMock.mockResolvedValueOnce(
      chunkStream([textChunk("Hello"), textChunk(" world")]),
    );
    const seen: string[] = [];
    const r = await runCompoundStream(
      { action: "simplify", document: DOC },
      "test-key",
      { onToken: (d) => seen.push(d) },
    );
    expect(r.markdown).toBe("Hello world");
    expect(seen).toEqual(["Hello", " world"]);
    expect(r.model).toBe("openai/gpt-oss-120b");
    expect(r.usage).toBeUndefined();
    const args = createMock.mock.calls[0]?.[0] as
      | { stream?: boolean }
      | undefined;
    expect(args?.stream).toBe(true);
  });

  it("flags grounded output and notifies", async () => {
    createMock.mockResolvedValueOnce(
      chunkStream([
        textChunk("Rates: "),
        { choices: [{ delta: { content: "₹600" } }], executed_tools: ["web_search"] },
      ]),
    );
    let groundedCalls = 0;
    const r = await runCompoundStream(
      { action: "ask", question: "Current stamp duty?" },
      "test-key",
      { onToken: () => {}, onGrounded: () => (groundedCalls += 1) },
    );
    expect(r.grounded).toBe(true);
    expect(groundedCalls).toBe(1);
    expect(r.markdown).toBe("Rates: ₹600");
  });

  it("falls back to the smaller model when the primary stream fails", async () => {
    createMock
      .mockRejectedValueOnce(new Error("primary down"))
      .mockResolvedValueOnce(chunkStream([textChunk("Fallback ok")]));
    const r = await runCompoundStream(
      { action: "simplify", document: DOC },
      "test-key",
      { onToken: () => {} },
    );
    expect(r.model).toBe("openai/gpt-oss-20b");
    expect(r.markdown).toBe("Fallback ok");
  });

  it("throws when both streams fail or return empty", async () => {
    createMock
      .mockResolvedValueOnce(chunkStream([textChunk("   ")]))
      .mockRejectedValueOnce(new Error("mini down"));
    await expect(
      runCompoundStream({ action: "simplify", document: DOC }, "test-key", {
        onToken: () => {},
      }),
    ).rejects.toThrow();
  });
});

describe("buildMessages", () => {
  it("embeds the India-first guardrail in the system prompt", () => {
    const [sys] = buildMessages({ action: "simplify", document: DOC });
    expect(sys?.role).toBe("system");
    expect(sys?.content).toContain("Bar Council of India");
    expect(sys?.content).toContain("web search");
  });

  it("uses retrieved excerpts for long ask documents", () => {
    const long = Array.from(
      { length: 200 },
      (_, i) => `Boilerplate paragraph number ${i} about general obligations.`,
    ).join("\n\n");
    const target =
      "TERMINATION. Unpaid licence fee for sixty days ends the agreement.";
    const doc = `${long}\n\n${target}`;
    const [, user] = buildMessages({
      action: "ask",
      document: doc,
      question: "What happens after sixty days of unpaid fee?",
    });
    expect(user?.content).toContain("MOST RELEVANT EXCERPTS");
    expect(user?.content).toContain("TERMINATION");
  });

  it("sends short ask documents in full", () => {
    const [, user] = buildMessages({
      action: "ask",
      document: "Short doc.",
      question: "Summarise?",
    });
    expect(user?.content).toContain("CONTEXT DOCUMENT");
  });

  it("formats compare prompts with both documents", () => {
    const [, user] = buildMessages({
      action: "compare",
      documentA: "AAA terms",
      documentB: "BBB terms",
      labelA: "First",
      labelB: "Second",
    });
    expect(user?.content).toContain("First");
    expect(user?.content).toContain("AAA terms");
    expect(user?.content).toContain("BBB terms");
  });

  it("lists every playbook position with the fixed status vocabulary", () => {
    const [, user] = buildMessages({
      action: "playbook",
      document: DOC,
      rules: ["Liability must be mutual", "No non-compete"],
    });
    expect(user?.content).toContain("1. Liability must be mutual");
    expect(user?.content).toContain("2. No non-compete");
    expect(user?.content).toContain("X of 2 positions met");
    expect(user?.content).toContain("Meets, Partial, Fails, Not addressed");
  });

  it("builds an advocate brief with the client's note and evidence checklist", () => {
    const [, user] = buildMessages({
      action: "handoff",
      document: DOC,
      situation: "Invoice unpaid for 90 days",
    });
    expect(user?.content).toContain("Invoice unpaid for 90 days");
    expect(user?.content).toContain("## Evidence checklist");
    expect(user?.content).toContain("## Sharp questions for the advocate");
  });

  it("asks stamp verification to check the offline estimate against live rates", async () => {
    createMock.mockReset();
    createMock.mockResolvedValueOnce(completion("## Verdict"));
    await runCompound(
      { action: "stamp", state: "Maharashtra", instrument: "rent", details: "Duty ₹600" },
      "test-key",
    );
    const args = createMock.mock.calls[0]?.[0] as
      | { max_tokens?: number; messages?: { content: string }[] }
      | undefined;
    expect(args?.max_tokens).toBe(1800);
    expect(args?.messages?.[1]?.content).toContain("leave & licence agreement in Maharashtra");
    expect(args?.messages?.[1]?.content).toContain("Duty ₹600");
  });
});
