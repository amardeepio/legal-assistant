import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.hoisted(() => vi.fn());

vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));

import { POST } from "@/app/api/analyze/route";
import { resetRateLimits } from "@/lib/rate-limit";

function req(body: unknown): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const DOC = "Payment terms and obligations. ".repeat(10);
const OLD_KEY = process.env["GROQ_API_KEY"];

function completion(text: string): Record<string, unknown> {
  return {
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

describe("POST /api/analyze", () => {
  beforeEach(() => {
    createMock.mockReset();
    resetRateLimits();
    process.env["GROQ_API_KEY"] = "test-key";
  });

  afterEach(() => {
    if (OLD_KEY === undefined) delete process.env["GROQ_API_KEY"];
    else process.env["GROQ_API_KEY"] = OLD_KEY;
  });

  it("rejects non-JSON bodies with 400", async () => {
    const res = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: "not json{{{",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects schema-invalid payloads with 400", async () => {
    const res = await POST(req({ action: "simplify", document: "tiny" }));
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects missing API keys with 401", async () => {
    delete process.env["GROQ_API_KEY"];
    const res = await POST(req({ action: "simplify", document: DOC }));
    expect(res.status).toBe(401);
  });

  it("returns analysis payload on success", async () => {
    createMock.mockResolvedValueOnce(completion("## TL;DR\nDone"));
    const res = await POST(
      req({
        action: "simplify",
        document: DOC,
        jurisdiction: "Pune, Maharashtra",
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["action"]).toBe("simplify");
    expect(body["model"]).toBe("openai/gpt-oss-120b");
    expect(typeof body["markdown"]).toBe("string");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when Compound fails", async () => {
    createMock.mockRejectedValue(new Error("upstream down"));
    const res = await POST(req({ action: "risks", document: DOC }));
    expect(res.status).toBe(502);
  });

  it("maps invalid-key errors to 401", async () => {
    createMock.mockRejectedValue(new Error("401 invalid api key"));
    const res = await POST(req({ action: "risks", document: DOC }));
    expect(res.status).toBe(401);
  });

  it("returns 429 with Retry-After after the per-minute budget is spent", async () => {
    createMock.mockResolvedValue(completion("## TL;DR\nDone"));
    const body = { action: "simplify", document: DOC };
    for (let i = 0; i < 5; i += 1) {
      expect((await POST(req(body))).status).toBe(200);
    }
    const blocked = await POST(req(body));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).not.toBeNull();
    const payload = (await blocked.json()) as Record<string, unknown>;
    expect(typeof payload["error"]).toBe("string");
    expect(createMock).toHaveBeenCalledTimes(5);
  });

  it("does not rate-limit callers using their own API key", async () => {
    createMock.mockResolvedValue(completion("## TL;DR\nDone"));
    const body = { action: "simplify", document: DOC, apiKey: "gsk-user-key" };
    for (let i = 0; i < 7; i += 1) {
      expect((await POST(req(body))).status).toBe(200);
    }
    expect(createMock).toHaveBeenCalledTimes(7);
  });
});
