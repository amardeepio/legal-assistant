import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.hoisted(() => vi.fn());

vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));

import { POST } from "@/app/api/analyze/stream/route";
import { resetRateLimits } from "@/lib/rate-limit";

function req(body: unknown): Request {
  return new Request("http://localhost/api/analyze/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const DOC = "Payment terms and obligations. ".repeat(10);
const OLD_KEY = process.env["GROQ_API_KEY"];

function chunkStream(
  chunks: Record<string, unknown>[],
): AsyncGenerator<Record<string, unknown>> {
  return (async function* () {
    for (const c of chunks) yield c;
  })();
}

describe("POST /api/analyze/stream", () => {
  beforeEach(() => {
    createMock.mockReset();
    resetRateLimits();
    process.env["GROQ_API_KEY"] = "test-key";
  });

  afterEach(() => {
    if (OLD_KEY === undefined) delete process.env["GROQ_API_KEY"];
    else process.env["GROQ_API_KEY"] = OLD_KEY;
  });

  it("rejects schema-invalid payloads with 400 JSON", async () => {
    const res = await POST(req({ action: "simplify", document: "tiny" }));
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects missing API keys with 401", async () => {
    delete process.env["GROQ_API_KEY"];
    const res = await POST(req({ action: "simplify", document: DOC }));
    expect(res.status).toBe(401);
  });

  it("streams progress, token, and done events", async () => {
    createMock.mockResolvedValueOnce(
      chunkStream([
        { choices: [{ delta: { content: "## TL;DR" } }] },
        { choices: [{ delta: { content: "\nDone" } }] },
      ]),
    );
    const res = await POST(req({ action: "simplify", document: DOC }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: progress");
    expect(text).toContain("event: token");
    expect(text).toContain("event: done");
    expect(text).toContain("## TL;DR");
    const doneBlock = text.split("\n\n").find((b) => b.startsWith("event: done"));
    const payload = JSON.parse(
      (doneBlock?.split("\n")[1] ?? "").replace(/^data:\s*/, ""),
    ) as Record<string, unknown>;
    expect(payload["action"]).toBe("simplify");
    expect(payload["model"]).toBe("openai/gpt-oss-120b");
  });

  it("emits an error event when Compound fails", async () => {
    createMock.mockRejectedValue(new Error("upstream down"));
    const res = await POST(req({ action: "risks", document: DOC }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: error");
    expect(text).toContain("upstream down");
  });
});
