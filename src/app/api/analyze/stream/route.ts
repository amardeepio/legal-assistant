import { AnalyzeRequestSchema } from "@/lib/legal";
import { resolveApiKey, runCompoundStream } from "@/lib/groq";
import {
  ANALYZE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

function sseEncode(event: string, payload: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
  );
}

/**
 * POST /api/analyze/stream — Server-Sent Events variant of /api/analyze.
 * Emits `progress` (agent status), `token` (markdown deltas), then `done`
 * with the full result, or `error`. Pre-stream failures use plain JSON
 * so the client can fall back to the buffered endpoint.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const byok =
    typeof body === "object" &&
    body !== null &&
    "apiKey" in body &&
    typeof (body as Record<string, unknown>)["apiKey"] === "string" &&
    ((body as Record<string, unknown>)["apiKey"] as string).trim() !== "";
  if (!byok) {
    const decision = checkRateLimit(
      `analyze:${getClientIp(request)}`,
      ANALYZE_LIMITS,
    );
    if (!decision.allowed) {
      return Response.json(
        { error: rateLimitMessage(decision.retryAfterSec) },
        {
          status: 429,
          headers: { "Retry-After": String(decision.retryAfterSec) },
        },
      );
    }
  }

  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const req = parsed.data;
  const apiKey = resolveApiKey(req.apiKey);
  if (apiKey === undefined) {
    return Response.json(
      {
        error:
          "Missing GROQ_API_KEY. Add it to .env.local or paste it in the app settings.",
      },
      { status: 401 },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: unknown): void => {
        if (request.signal.aborted) return;
        controller.enqueue(sseEncode(event, payload));
      };
      send("progress", {
        phase: "reading",
        label: "Reading your document…",
      });
      let draftingSent = false;
      try {
        const result = await runCompoundStream(req, apiKey, {
          onToken: (delta) => {
            if (!draftingSent) {
              draftingSent = true;
              send("progress", {
                phase: "drafting",
                label: "Drafting your answer…",
              });
            }
            send("token", { token: delta });
          },
          onGrounded: () => {
            send("progress", {
              phase: "verifying",
              label: "Verifying against live Indian sources…",
            });
          },
        });
        console.info(
          `[analyze:stream] action=${req.action} model=${result.model} ` +
            `chars=${result.markdown.length} grounded=${result.grounded}`,
        );
        send("done", {
          action: req.action,
          markdown: result.markdown,
          model: result.model,
          grounded: result.grounded,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown Groq Compound error.";
        const status = /401|invalid api key/i.test(message) ? 401 : 502;
        send("error", { error: message, status });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
