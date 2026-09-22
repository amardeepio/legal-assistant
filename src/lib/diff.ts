/**
 * Word-level redline diff for two versions of the same agreement.
 *
 * Two passes keep it fast on 40k-character documents: a line diff finds the
 * changed regions, then each region is diffed word by word. Both passes use
 * Myers' O(ND) algorithm with a cap on edit distance, so wildly different
 * inputs degrade to "whole region replaced" instead of hanging the tab.
 */

export type DiffKind = "equal" | "insert" | "delete";

export interface DiffOp {
  readonly kind: DiffKind;
  readonly text: string;
}

export interface DiffStats {
  readonly insertedWords: number;
  readonly deletedWords: number;
  readonly unchangedWords: number;
}

export interface DiffResult {
  readonly ops: readonly DiffOp[];
  readonly stats: DiffStats;
  readonly identical: boolean;
  /** True when some region was too different to diff word by word. */
  readonly coarse: boolean;
}

type Code = "e" | "i" | "d";

const MAX_LINE_EDITS = 2_000;
const MAX_WORD_EDITS = 2_500;

/** Myers shortest edit script over `a` → `b`; null when edits exceed `maxD`. */
export function editScript(
  a: readonly string[],
  b: readonly string[],
  maxD: number,
): Code[] | null {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const A = a.slice(start, endA);
  const B = b.slice(start, endB);
  const head: Code[] = Array.from({ length: start }, () => "e");
  const tail: Code[] = Array.from({ length: a.length - endA }, () => "e");
  const n = A.length;
  const m = B.length;
  if (n === 0 || m === 0) {
    const mid: Code[] = [
      ...Array.from({ length: n }, (): Code => "d"),
      ...Array.from({ length: m }, (): Code => "i"),
    ];
    return [...head, ...mid, ...tail];
  }

  const max = n + m;
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  const limit = Math.min(max, maxD);

  for (let d = 0; d <= limit; d += 1) {
    // Snapshot of the furthest-reaching paths after d-1 edits, k ∈ [-d, d].
    trace.push(v.slice(offset - d, offset + d + 1));
    for (let k = -d; k <= d; k += 2) {
      const down =
        k === -d || (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0));
      let x = down ? (v[offset + k + 1] ?? 0) : (v[offset + k - 1] ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && A[x] === B[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        return [...head, ...backtrack(trace, n, m, d), ...tail];
      }
    }
  }
  return null;
}

function backtrack(trace: readonly Int32Array[], n: number, m: number, D: number): Code[] {
  const out: Code[] = [];
  let x = n;
  let y = m;
  for (let d = D; d > 0; d -= 1) {
    const vd = trace[d];
    if (vd === undefined) break;
    const at = (k: number): number => vd[k + d] ?? 0;
    const k = x - y;
    const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      out.push("e");
      x -= 1;
      y -= 1;
    }
    out.push(x === prevX ? "i" : "d");
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) {
    out.push("e");
    x -= 1;
    y -= 1;
  }
  return out.reverse();
}

interface Token {
  readonly key: string;
  readonly text: string;
}

const WORDISH = /[\p{L}\p{N}]/u;
const TOKEN =
  /[\p{L}\p{N}]+(?:[.,'’/-][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu;

/** Words, numbers ("85,000", "1.5") and single punctuation marks, each carrying its trailing whitespace. */
export function tokenize(text: string): readonly Token[] {
  const tokens: Token[] = [];
  const lead = /^\s+/.exec(text)?.[0];
  if (lead !== undefined) tokens.push({ key: "", text: lead });
  for (const m of text.matchAll(TOKEN)) {
    const end = (m.index ?? 0) + m[0].length;
    const ws = /^\s*/.exec(text.slice(end))?.[0] ?? "";
    tokens.push({ key: m[0], text: m[0] + ws });
  }
  return tokens;
}

function countWords(tokens: readonly Token[]): number {
  return tokens.filter((t) => WORDISH.test(t.key)).length;
}

class OpBuilder {
  readonly ops: DiffOp[] = [];
  inserted = 0;
  deleted = 0;
  unchanged = 0;

  push(kind: DiffKind, text: string, words: number): void {
    if (text === "") return;
    if (kind === "insert") this.inserted += words;
    else if (kind === "delete") this.deleted += words;
    else this.unchanged += words;
    const last = this.ops[this.ops.length - 1];
    if (last !== undefined && last.kind === kind) {
      this.ops[this.ops.length - 1] = { kind, text: last.text + text };
    } else {
      this.ops.push({ kind, text });
    }
  }
}

function lineKey(line: string): string {
  return line.trim().replaceAll(/\s+/g, " ");
}

function diffRegion(a: string, b: string, out: OpBuilder): boolean {
  const ta = tokenize(a);
  const tb = tokenize(b);
  const script = editScript(
    ta.map((t) => t.key),
    tb.map((t) => t.key),
    MAX_WORD_EDITS,
  );
  if (script === null) {
    out.push("delete", a, countWords(ta));
    out.push("insert", b, countWords(tb));
    return false;
  }
  let ia = 0;
  let ib = 0;
  for (const code of script) {
    if (code === "e") {
      const t = tb[ib];
      if (t !== undefined) out.push("equal", t.text, WORDISH.test(t.key) ? 1 : 0);
      ia += 1;
      ib += 1;
    } else if (code === "d") {
      const t = ta[ia];
      if (t !== undefined) out.push("delete", t.text, WORDISH.test(t.key) ? 1 : 0);
      ia += 1;
    } else {
      const t = tb[ib];
      if (t !== undefined) out.push("insert", t.text, WORDISH.test(t.key) ? 1 : 0);
      ib += 1;
    }
  }
  return true;
}

/** Redline `before` → `after`: equal text uses the new version's spacing. */
export function diffWords(before: string, after: string): DiffResult {
  const a = before.replaceAll("\r\n", "\n");
  const b = after.replaceAll("\r\n", "\n");
  const out = new OpBuilder();
  let coarse = false;

  const linesA = a.split(/(?<=\n)/);
  const linesB = b.split(/(?<=\n)/);
  const script = editScript(linesA.map(lineKey), linesB.map(lineKey), MAX_LINE_EDITS);

  if (script === null) {
    coarse = !diffRegion(a, b, out);
  } else {
    let ia = 0;
    let ib = 0;
    let regionA = "";
    let regionB = "";
    const flush = (): void => {
      if (regionA === "" && regionB === "") return;
      if (!diffRegion(regionA, regionB, out)) coarse = true;
      regionA = "";
      regionB = "";
    };
    for (const code of script) {
      if (code === "e") {
        flush();
        const line = linesB[ib] ?? "";
        out.push("equal", line, countWords(tokenize(line)));
        ia += 1;
        ib += 1;
      } else if (code === "d") {
        regionA += linesA[ia] ?? "";
        ia += 1;
      } else {
        regionB += linesB[ib] ?? "";
        ib += 1;
      }
    }
    flush();
  }

  const identical = out.ops.every((o) => o.kind === "equal");
  return {
    ops: out.ops,
    stats: {
      insertedWords: out.inserted,
      deletedWords: out.deleted,
      unchangedWords: out.unchanged,
    },
    identical,
    coarse,
  };
}

/** Shortens long unchanged runs to `context` characters either side of a change. */
export function collapseEqual(ops: readonly DiffOp[], context = 120): readonly DiffOp[] {
  return ops.map((op, n) => {
    if (op.kind !== "equal" || op.text.length <= context * 2 + 20) return op;
    const first = n === 0;
    const last = n === ops.length - 1;
    const headText = first ? "" : op.text.slice(0, context);
    const tailText = last ? "" : op.text.slice(-context);
    return { kind: "equal", text: `${headText} … ${tailText}` };
  });
}

/** Plain-text redline with wdiff-style markers: [-deleted-] {+inserted+}. */
export function redlineText(ops: readonly DiffOp[]): string {
  return ops
    .map((o) =>
      o.kind === "equal"
        ? o.text
        : o.kind === "delete"
          ? `[-${o.text.trimEnd()}-]${o.text.slice(o.text.trimEnd().length)}`
          : `{+${o.text.trimEnd()}+}${o.text.slice(o.text.trimEnd().length)}`,
    )
    .join("");
}
