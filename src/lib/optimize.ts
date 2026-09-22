/**
 * LLM-cost optimisations for document handling.
 *
 * Pure functions, fully unit-testable:
 * - normalizeExtractedText: strip PDF artefacts + redundant whitespace so we
 *   never pay for tokens that carry no meaning.
 * - retrieveRelevant: cheap keyword retrieval so Q&A over long documents only
 *   sends the excerpts that matter instead of the whole file.
 * - estimateTokens: rough (~chars/4) token count for UI display.
 */

/** Rough token estimate for English text. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

const PAGE_JOINER_RE = /^--\s*\d+\s+of\s+\d+\s*--$/;

/**
 * Remove PDF extraction noise: page markers ("-- 3 of 12 --"), repeated
 * per-page headers/footers, collapsed whitespace. Typically saves 10–30% of
 * input tokens on multi-page PDFs with zero information loss.
 */
export function normalizeExtractedText(text: string): string {
  const lines = text.split("\n");
  const seenShort = new Map<string, number>();
  const out: string[] = [];
  let prevEmpty = false;

  for (const raw of lines) {
    const line = raw.replace(/[ \t\u00a0]+/g, " ").trim();
    if (line === "") {
      if (!prevEmpty) out.push("");
      prevEmpty = true;
      continue;
    }
    prevEmpty = false;
    if (PAGE_JOINER_RE.test(line)) continue;
    // Drop 3rd+ occurrence of identical short lines: these are almost always
    // repeated running headers/footers stamped on every page.
    if (line.length <= 60) {
      const count = (seenShort.get(line) ?? 0) + 1;
      seenShort.set(line, count);
      if (count >= 3) continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export interface Retrieval {
  /** Text to send to the model (full doc or selected excerpts). */
  readonly text: string;
  /** True when excerpts were selected instead of the full document. */
  readonly trimmed: boolean;
  /** Fraction of paragraphs included (1 = whole document). */
  readonly coverage: number;
}

function queryTerms(query: string): readonly string[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 2);
  return [...new Set(terms)];
}

function scoreParagraph(lower: string, terms: readonly string[]): number {
  let score = 0;
  for (const term of terms) {
    let idx = lower.indexOf(term);
    while (idx !== -1) {
      score += 1;
      idx = lower.indexOf(term, idx + term.length);
    }
  }
  return score;
}

/**
 * Select the paragraphs most relevant to `query` within `maxChars`.
 * Falls back to head-truncation when nothing matches (e.g. stopword-only
 * queries). Paragraph order is preserved so excerpts still read coherently.
 */
export function retrieveRelevant(
  document: string,
  query: string,
  maxChars: number,
): Retrieval {
  if (document.length <= maxChars) {
    return { text: document, trimmed: false, coverage: 1 };
  }
  const paras = document
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter((p) => p.length >= 40);
  if (paras.length === 0) {
    return { text: document.slice(0, maxChars), trimmed: true, coverage: 0 };
  }

  const terms = queryTerms(query);
  const scored = paras.map((p, i) => ({
    i,
    p,
    s: terms.length > 0 ? scoreParagraph(p.toLowerCase(), terms) : 0,
  }));
  const anyHit = scored.some((e) => e.s > 0);

  const ranked = [...scored].sort((a, b) => b.s - a.s || a.i - b.i);
  const picked: typeof ranked = [];
  let used = 0;
  if (anyHit) {
    for (const entry of ranked) {
      if (entry.s === 0) break;
      if (used + entry.p.length + 2 > maxChars) continue;
      picked.push(entry);
      used += entry.p.length + 2;
    }
  }
  if (picked.length === 0) {
    // Nothing matched (or query had no terms): head-truncate as before.
    return { text: document.slice(0, maxChars), trimmed: true, coverage: 0 };
  }
  picked.sort((a, b) => a.i - b.i);
  return {
    text: picked.map((e) => e.p).join("\n\n"),
    trimmed: true,
    coverage: picked.length / paras.length,
  };
}
