import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/translate/route";
import { resetRateLimits } from "@/lib/rate-limit";

const OLD_KEY = process.env["GOOGLE_TRANSLATE_API_KEY"];

function req(body: unknown): Request {
  return new Request("http://localhost/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function googleOk(texts: string[]): Response {
  return new Response(
    JSON.stringify({
      data: { translations: texts.map((t) => ({ translatedText: t })) },
    }),
    { status: 200 },
  );
}

describe("POST /api/translate", () => {
  beforeEach(() => {
    resetRateLimits();
    process.env["GOOGLE_TRANSLATE_API_KEY"] = "test-key";
  });

  afterEach(() => {
    if (OLD_KEY === undefined) delete process.env["GOOGLE_TRANSLATE_API_KEY"];
    else process.env["GOOGLE_TRANSLATE_API_KEY"] = OLD_KEY;
    vi.unstubAllGlobals();
  });

  it("rejects non-JSON bodies with 400", async () => {
    const res = await POST(
      new Request("http://localhost/api/translate", {
        method: "POST",
        body: "nope{{{",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects bad payloads (empty texts, English target, bad code)", async () => {
    for (const body of [
      { texts: [], target: "hi" },
      { texts: ["hello"], target: "en" },
      { texts: ["hello"], target: "xx" },
      { texts: [""], target: "hi" },
    ]) {
      const res = await POST(req(body));
      expect(res.status).toBe(400);
    }
  });

  it("rejects missing API keys with 401", async () => {
    delete process.env["GOOGLE_TRANSLATE_API_KEY"];
    const res = await POST(req({ texts: ["hello"], target: "hi" }));
    expect(res.status).toBe(401);
  });

  it("rejects oversized batches with 413", async () => {
    const big = "x".repeat(12_000);
    const res = await POST(req({ texts: [big, big, big], target: "hi" }));
    expect(res.status).toBe(413);
  });

  it("translates, decodes entities, and calls Google correctly", async () => {
    const fetchMock = vi.fn(
      async (): Promise<Response> =>
        googleOk(["नमस्ते &#39;दुनिया&#39;"]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ texts: ["Hello 'world'"], target: "hi" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { translations: string[] };
    expect(body.translations).toEqual(["नमस्ते 'दुनिया'"]);
    const first = fetchMock.mock.calls[0] as unknown as
      | [string, RequestInit]
      | undefined;
    expect(first).toBeDefined();
    const sent = JSON.parse(String(first?.[1]?.body)) as Record<string, unknown>;
    expect(sent["target"]).toBe("hi");
    expect(sent["source"]).toBe("en");
    expect(String(first?.[0])).toContain("translation.googleapis.com");
  });

  it("chunks long texts into one batched request", async () => {
    const paras = Array.from({ length: 30 }, (_, i) => `Para ${i} ` + "y".repeat(200));
    const fetchMock = vi.fn(
      async (_url: string, init: RequestInit): Promise<Response> => {
        const sent = JSON.parse(String(init.body)) as { q: string[] };
        return googleOk(sent.q.map((_, i) => `T${i}`));
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ texts: [paras.join("\n\n")], target: "mr" }));
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    const sent = JSON.parse(String(init.body)) as { q: string[] };
    expect(sent.q.length).toBeGreaterThan(1);
    for (const q of sent.q) expect(q.length).toBeLessThanOrEqual(4000);
    const body = (await res.json()) as { translations: string[] };
    expect(body.translations).toHaveLength(1);
    expect(body.translations[0]).toContain("T0");
  });

  it("maps upstream HTTP errors to 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("denied", { status: 403 })),
    );
    const res = await POST(req({ texts: ["hello"], target: "ta" }));
    expect(res.status).toBe(502);
  });

  it("maps malformed upstream payloads to 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ nope: 1 }), { status: 200 })),
    );
    const res = await POST(req({ texts: ["hello"], target: "ta" }));
    expect(res.status).toBe(502);
  });

  it("maps provider network failures to 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("dns down");
      }),
    );
    const res = await POST(req({ texts: ["hello"], target: "ta" }));
    expect(res.status).toBe(502);
  });

  it("returns 429 with Retry-After past the per-minute budget", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => googleOk(["x"])));
    const body = { texts: ["hello"], target: "hi" };
    for (let i = 0; i < 30; i += 1) {
      expect((await POST(req(body))).status).toBe(200);
    }
    const blocked = await POST(req(body));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).not.toBeNull();
  });
});
