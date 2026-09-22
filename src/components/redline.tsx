"use client";

import { useMemo, useState } from "react";
import type { ReactNode, Ref } from "react";
import type { DiffResult } from "@/lib/diff";
import { collapseEqual } from "@/lib/diff";

interface RedlineProps {
  readonly result: DiffResult;
  readonly labelA: string;
  readonly labelB: string;
  /** Receives the printable redline element (used by Save as PDF). */
  readonly articleRef?: Ref<HTMLElement>;
}

/** Inline track-changes view: deletions struck through, insertions underlined. */
export function Redline({ result, labelA, labelB, articleRef }: RedlineProps): ReactNode {
  const [changesOnly, setChangesOnly] = useState(false);
  const ops = useMemo(
    () => (changesOnly ? collapseEqual(result.ops) : result.ops),
    [changesOnly, result.ops],
  );
  const { insertedWords, deletedWords } = result.stats;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="redline-ins rounded px-1.5 py-0.5 font-semibold">
          +{insertedWords} word{insertedWords === 1 ? "" : "s"} added
        </span>
        <span className="redline-del rounded px-1.5 py-0.5 font-semibold">
          −{deletedWords} removed
        </span>
        <span className="t3">
          {labelA} → {labelB}
        </span>
        <label className="t2 ml-auto flex cursor-pointer items-center gap-1.5 font-semibold">
          <input
            type="checkbox"
            checked={changesOnly}
            onChange={(e) => setChangesOnly(e.target.checked)}
            className="accent-amber-500"
          />
          Changes only
        </label>
      </div>
      {result.coarse && (
        <p className="t3 text-[11px]">
          Some sections differ too much to match word by word, so they are shown as
          fully replaced.
        </p>
      )}
      {result.identical ? (
        <p className="alert-ok rounded-xl px-3 py-2 text-xs" role="status">
          No wording differences — the two versions match (ignoring spacing).
        </p>
      ) : (
        <article
          ref={articleRef}
          aria-label="Redline"
          className="redline thread rounded-2xl p-4 text-sm leading-relaxed"
        >
          {ops.map((op, n) =>
            op.kind === "insert" ? (
              <ins key={n} className="redline-ins">
                <span className="sr-only">[added: </span>
                {op.text}
                <span className="sr-only">]</span>
              </ins>
            ) : op.kind === "delete" ? (
              <del key={n} className="redline-del">
                <span className="sr-only">[removed: </span>
                {op.text}
                <span className="sr-only">]</span>
              </del>
            ) : (
              <span key={n}>{op.text}</span>
            ),
          )}
        </article>
      )}
    </div>
  );
}
