import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { ensurePdfJsDomPolyfills } from "@/lib/pdf-dom-polyfill";
import {
  EXTRACT_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";
import {
  MAX_DOC_CHARS,
  MAX_DOCX_BYTES,
  MAX_PDF_BYTES,
  MAX_PDF_PAGES,
} from "@/lib/legal";
import type { ExtractPdfResponse } from "@/lib/legal";
import { normalizeExtractedText } from "@/lib/optimize";

export const runtime = "nodejs";
export const maxDuration = 60;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ExtractableKind = "pdf" | "docx";

function fileKind(file: File): ExtractableKind | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type === DOCX_MIME || name.endsWith(".docx")) return "docx";
  return null;
}

/** Extract raw text from a PDF buffer (up to MAX_PDF_PAGES). */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  // pdf.js needs `DOMMatrix` before it is evaluated; the native canvas module
  // that normally provides it isn't in the standalone/Cloud Run bundle.
  ensurePdfJsDomPolyfills();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText({ first: MAX_PDF_PAGES });
    return { text: result.text, pages: result.total };
  } finally {
    await parser.destroy();
  }
}

/** Extract raw text from a .docx buffer (.docx has no page count). */
async function extractDocxText(buffer: Buffer): Promise<{ text: string; pages: null }> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value, pages: null };
}

export async function POST(request: Request): Promise<NextResponse> {
  const decision = checkRateLimit(
    `extract:${getClientIp(request)}`,
    EXTRACT_LIMITS,
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Request must be multipart form data." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file uploaded. Send a PDF or .docx as the 'file' field." },
      { status: 400 },
    );
  }
  const kind = fileKind(file);
  if (kind === null) {
    return NextResponse.json(
      { error: "Only PDF and .docx files are accepted here." },
      { status: 415 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { error: "The uploaded file is empty." },
      { status: 400 },
    );
  }
  const byteLimit = kind === "pdf" ? MAX_PDF_BYTES : MAX_DOCX_BYTES;
  if (file.size > byteLimit) {
    return NextResponse.json(
      { error: "File exceeds the 12 MB limit. Try a smaller file." },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let extracted: { text: string; pages: number | null };
  try {
    extracted =
      kind === "pdf" ? await extractPdfText(buffer) : await extractDocxText(buffer);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not parse this file.";
    return NextResponse.json(
      { error: `File parsing failed: ${message}` },
      { status: 422 },
    );
  }
  // Normalise before measuring: drops page markers / repeated headers so
  // the user never pays LLM tokens for extraction noise.
  const raw = normalizeExtractedText(extracted.text);
  if (raw.length === 0) {
    return NextResponse.json(
      {
        error:
          kind === "pdf"
            ? "No extractable text found — this looks like a scanned/image PDF. Please paste the text instead, or use a text-based PDF."
            : "No extractable text found in this .docx file. Please paste the text instead.",
      },
      { status: 422 },
    );
  }
  const truncated = raw.length > MAX_DOC_CHARS;
  const payload: ExtractPdfResponse = {
    text: truncated ? raw.slice(0, MAX_DOC_CHARS) : raw,
    pages: extracted.pages,
    fileName: file.name,
    truncated,
  };
  return NextResponse.json(payload, { status: 200 });
}
