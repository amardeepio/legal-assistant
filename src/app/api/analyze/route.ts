import { NextResponse } from "next/server";
import { AnalyzeRequestSchema } from "@/lib/legal";
import type { AnalyzeResponse } from "@/lib/legal";
import { resolveApiKey, runCompound } from "@/lib/groq";
import {
  ANALYZE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

/** 429 for callers spending the server's Groq quota. */
function rateLimited(request: Request): NextResponse | null {
  const decision = checkRateLimit(
    `analyze:${getClientIp(request)}`,
    ANALYZE_LIMITS,
  );
  if (decision.allowed) return null;
  return NextResponse.json(
    { error: rateLimitMessage(decision.retryAfterSec) },
    {
      status: 429,
      headers: { "Retry-After": String(decision.retryAfterSec) },
    },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  // Bring-your-own-key callers spend their own Groq quota, so only the
  // server-key path counts against the public rate limit.
  const byok =
    typeof body === "object" &&
    body !== null &&
    "apiKey" in body &&
    typeof (body as Record<string, unknown>)["apiKey"] === "string" &&
    ((body as Record<string, unknown>)["apiKey"] as string).trim() !== "";
  if (!byok) {
    const blocked = rateLimited(request);
    if (blocked !== null) return blocked;
  }

  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const req = parsed.data;
  const apiKey = resolveApiKey(req.apiKey);
  if (apiKey === undefined) {
    return NextResponse.json(
      {
        error:
          "Missing GROQ_API_KEY. Add it to .env.local or paste it in the app settings.",
      },
      { status: 401 },
    );
  }

  try {
    const result = await runCompound(req, apiKey);
    if (result.usage !== undefined) {
      console.info(
        `[analyze] action=${req.action} model=${result.model} ` +
          `prompt=${result.usage.promptTokens} ` +
          `completion=${result.usage.completionTokens} ` +
          `total=${result.usage.totalTokens}`,
      );
    }
    const payload: AnalyzeResponse = {
      action: req.action,
      markdown: result.markdown,
      model: result.model,
      grounded: result.grounded,
    };
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown Groq Compound error.";
    const status = /401|invalid api key/i.test(message) ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
