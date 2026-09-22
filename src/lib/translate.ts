import { z } from "zod";

/**
 * Output-language support (Google Cloud Translation, server-side only).
 * Analysis is always generated in English, then translated — this keeps
 * legal structure/markdown intact and makes translation opt-in per request.
 */

export const LANGUAGE_CODES = [
  "en",
  "hi",
  "mr",
  "ta",
  "te",
  "bn",
  "gu",
  "kn",
  "ml",
  "pa",
] as const;

export const LanguageCode = z.enum(LANGUAGE_CODES);
export type LanguageCode = z.infer<typeof LanguageCode>;

export const TRANSLATION_TARGETS = [
  "hi",
  "mr",
  "ta",
  "te",
  "bn",
  "gu",
  "kn",
  "ml",
  "pa",
] as const;

export const TranslationTarget = z.enum(TRANSLATION_TARGETS);
export type TranslationTarget = z.infer<typeof TranslationTarget>;

export interface LanguageOption {
  readonly code: LanguageCode;
  readonly label: string;
}

export const LANGUAGES: readonly LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी · Hindi" },
  { code: "mr", label: "मराठी · Marathi" },
  { code: "ta", label: "தமிழ் · Tamil" },
  { code: "te", label: "తెలుగు · Telugu" },
  { code: "bn", label: "বাংলা · Bengali" },
  { code: "gu", label: "ગુજરાતી · Gujarati" },
  { code: "kn", label: "ಕನ್ನಡ · Kannada" },
  { code: "ml", label: "മലയാളം · Malayalam" },
  { code: "pa", label: "ਪੰਜਾਬੀ · Punjabi" },
] as const;

/** Cost guardrails for the paid Translate API. */
export const TRANSLATE_MAX_TEXTS = 10;
export const TRANSLATE_MAX_CHARS_PER_TEXT = 15_000;
export const TRANSLATE_MAX_TOTAL_CHARS = 30_000;
/** Google v2 handles ~5k chars per `q`; stay safely under with margin. */
export const TRANSLATE_CHUNK_CHARS = 4_000;

/** Tiny deterministic hash for client-side translation caching. */
export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

export function cacheKey(text: string, target: string): string {
  return `${target}:${hashText(text)}`;
}

/** Split on paragraph boundaries so chunks translate coherently. */
export function chunkText(text: string, max = TRANSLATE_CHUNK_CHARS): string[] {
  if (text.length <= max) return [text];
  const paras = text.split(/\n{2,}/g);
  const chunks: string[] = [];
  let cur = "";
  const push = (): void => {
    if (cur.length > 0) chunks.push(cur);
    cur = "";
  };
  for (const para of paras) {
    if (para.length > max) {
      push();
      for (let i = 0; i < para.length; i += max) {
        chunks.push(para.slice(i, i + max));
      }
      continue;
    }
    if ((cur + "\n\n" + para).length > max && cur.length > 0) push();
    cur = cur.length === 0 ? para : `${cur}\n\n${para}`;
  }
  push();
  return chunks.length > 0 ? chunks : [text];
}

/** Google escapes entities in translatedText — decode the common ones. */
const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
  "&#96;": "`",
  "&#x2F;": "/",
};

export function decodeEntities(text: string): string {
  return text.replace(
    /&(amp|lt|gt|quot|apos|#39|#x27|#96|#x2F);/g,
    (m) => ENTITIES[m] ?? m,
  );
}

const TranslationsSchema = z.object({
  translations: z.array(z.string()),
});

function isTranslations(value: unknown): value is { translations: string[] } {
  return TranslationsSchema.safeParse(value).success;
}

/** Client helper: translate one batch via our own API route. */
export async function translateTexts(
  texts: readonly string[],
  target: TranslationTarget,
): Promise<readonly string[]> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, target }),
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const msg =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as Record<string, unknown>)["error"])
        : `Translation failed (${res.status}).`;
    throw new Error(msg);
  }
  if (!isTranslations(data) || data.translations.length !== texts.length) {
    throw new Error("Unexpected response from the translator.");
  }
  return data.translations;
}
