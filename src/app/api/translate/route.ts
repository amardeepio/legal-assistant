import { NextResponse } from "next/server";
import { z } from "zod";
import {
  TRANSLATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";
import {
  TRANSLATE_MAX_CHARS_PER_TEXT,
  TRANSLATE_MAX_TEXTS,
  TRANSLATE_MAX_TOTAL_CHARS,
  TranslationTarget,
  chunkText,
  decodeEntities,
} from "@/lib/translate";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  texts: z
    .array(z.string().min(1).max(TRANSLATE_MAX_CHARS_PER_TEXT))
    .min(1)
    .max(TRANSLATE_MAX_TEXTS),
  target: TranslationTarget,
});

const GoogleResponseSchema = z.object({
  data: z.object({
    translations: z.array(
      z.object({ translatedText: z.string() }),
    ),
  }),
});

interface ChunkRef {
  readonly textIndex: number;
  readonly chunk: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const decision = checkRateLimit(
    `translate:${getClientIp(request)}`,
    TRANSLATE_LIMITS,
  );
  if (!decision.allowed) {
    return NextResponse.json(
      { error: rateLimitMessage(decision.retryAfterSec) },
      {
        status: 429,
        headers: { "Retry-After": String(decision.retryAfterSec) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const apiKey = process.env["GOOGLE_TRANSLATE_API_KEY"]?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Translation is not configured on the server." },
      { status: 401 },
    );
  }

  const { texts, target } = parsed.data;
  const total = texts.reduce((n, t) => n + t.length, 0);
  if (total > TRANSLATE_MAX_TOTAL_CHARS) {
    return NextResponse.json(
      { error: "Translation batch exceeds the 30,000 character limit." },
      { status: 413 },
    );
  }

  // Chunk each text so every Google `q` stays well under the API limit,
  // then translate the whole batch in a single paid request.
  const refs: ChunkRef[] = [];
  for (let i = 0; i < texts.length; i += 1) {
    const text = texts[i] ?? "";
    for (const chunk of chunkText(text)) {
      refs.push({ textIndex: i, chunk });
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: refs.map((r) => r.chunk),
          target,
          source: "en",
          format: "text",
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error.";
    return NextResponse.json(
      { error: `Translation provider unreachable: ${message}` },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    let detail = `HTTP ${upstream.status}`;
    try {
      const errBody = (await upstream.json()) as {
        error?: { message?: string };
      };
      if (errBody.error?.message) detail = errBody.error.message;
    } catch {
      // Ignore — fall back to the status text.
    }
    return NextResponse.json(
      { error: `Translation failed: ${detail}` },
      { status: 502 },
    );
  }

  const payload: unknown = await upstream.json();
  const validated = GoogleResponseSchema.safeParse(payload);
  if (
    !validated.success ||
    validated.data.data.translations.length !== refs.length
  ) {
    return NextResponse.json(
      { error: "Unexpected response from the translation provider." },
      { status: 502 },
    );
  }

  const joined: string[][] = texts.map(() => []);
  validated.data.data.translations.forEach((t, i) => {
    const ref = refs[i];
    if (ref !== undefined) {
      const bucket = joined[ref.textIndex];
      bucket?.push(decodeEntities(t.translatedText));
    }
  });

  return NextResponse.json(
    { translations: joined.map((parts) => parts.join("\n\n")) },
    { status: 200 },
  );
}
