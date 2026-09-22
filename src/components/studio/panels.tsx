"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { ActionKind } from "@/lib/legal";
import { MAX_DOC_CHARS, SAMPLE_DOCS } from "@/lib/legal";
import { useWorkspace, formatK } from "@/components/studio/workspace";
import { ExportMenu } from "@/components/export-menu";
import { Redline } from "@/components/redline";
import { redlineText } from "@/lib/diff";
import { extractSections, extractSources, renderMarkdown } from "@/components/markdown";
import {
  CheckIcon,
  ColumnsIcon,
  FileIcon,
  SpinnerIcon,
  UploadIcon,
  XIcon,
} from "@/components/icons";

export const LOADING_STEPS: Readonly<Record<Exclude<ActionKind, "ask">, readonly string[]>> = {
  simplify: ["Reading your document", "Checking Indian law", "Writing a plain-language summary"],
  risks: ["Reading your document", "Scanning clauses for risk", "Checking Indian law", "Writing the risk report"],
  compare: ["Reading both documents", "Lining up matching clauses", "Writing the comparison"],
  action: ["Reading your document", "Finding obligations & deadlines", "Building your action plan"],
  playbook: ["Reading your document", "Matching clauses to your playbook", "Drafting fixes"],
  handoff: ["Reading your document", "Pulling out facts & risks", "Writing the advocate brief"],
  stamp: ["Checking official rate schedules", "Verifying registration rules", "Writing e-registration steps"],
};

export function ErrorBox({ onRetry }: { onRetry?: () => void }): ReactNode {
  const ws = useWorkspace();
  if (ws.error === "") return null;
  return (
    <div role="alert" className="alert-err flex items-start gap-3 rounded-xl px-3 py-2 text-xs">
      <span className="flex-1 leading-relaxed">{ws.error}</span>
      {ws.canRetry && onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          disabled={ws.loading}
          className="shrink-0 rounded-md border border-current px-2 py-0.5 font-bold disabled:opacity-50"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function LoadingSteps({ steps }: { steps: readonly string[] }): ReactNode {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 4500);
    return () => clearInterval(id);
  }, [steps.length]);
  return (
    <div role="status" aria-live="polite" className="grid gap-5 py-6">
      <ol className="grid gap-2.5">
        {steps.map((label, n) => (
          <li key={label} className={`flex items-center gap-2.5 text-sm ${n < step ? "t2" : n === step ? "t1 font-semibold" : "t3"}`}>
            <span className="grid h-5 w-5 place-items-center">
              {n < step ? (
                <CheckIcon className="accent h-4 w-4" />
              ) : n === step ? (
                <SpinnerIcon className="accent h-4 w-4" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
              )}
            </span>
            {label}
            {n === step ? "…" : ""}
          </li>
        ))}
      </ol>
      <div className="grid gap-2.5" aria-hidden="true">
        {["w-2/5", "w-full", "w-11/12", "w-4/5", "w-full", "w-3/5"].map((w, n) => (
          <div key={n} className={`skeleton h-3 rounded-full ${w}`} />
        ))}
      </div>
    </div>
  );
}

function UploadButton({ target }: { target: "single" | "a" | "b" }): ReactNode {
  const ws = useWorkspace();
  return (
    <button
      type="button"
      disabled={ws.extracting}
      onClick={() => ws.onPickFile(target)}
      className="chip chip-dash flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold disabled:opacity-50"
    >
      {ws.extracting ? (
        <>
          <SpinnerIcon className="h-3.5 w-3.5" /> Reading file…
        </>
      ) : (
        <>
          <UploadIcon className="h-3.5 w-3.5" /> Upload PDF, .docx or .txt
        </>
      )}
    </button>
  );
}

export function DocInput(): ReactNode {
  const ws = useWorkspace();
  const empty = ws.doc.trim() === "";
  return (
    <div className="grid gap-3">
      {empty && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="t3 text-[11px]">Try a sample:</span>
          {SAMPLE_DOCS.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.title}
              onClick={() => ws.loadSample(s.id, "single")}
              className="chip rounded-full px-3 py-1 text-[11px] font-semibold"
            >
              {s.kind}
            </button>
          ))}
          <UploadButton target="single" />
        </div>
      )}
      {!empty && (
        <div className="flex flex-wrap items-center gap-2">
          <UploadButton target="single" />
          <button
            type="button"
            onClick={() => ws.clearInput("simplify")}
            className="chip danger-hover ml-auto rounded-lg px-2.5 py-1 text-[11px] font-bold"
          >
            Clear
          </button>
        </div>
      )}
      {ws.fileInfo !== null && (
        <div className="thread flex items-center gap-3 rounded-2xl px-3 py-2.5">
          <div className="accent grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400/10">
            <FileIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="t1 truncate text-sm font-semibold">{ws.fileInfo.name}</p>
            <p className="t3 text-[11px]">
              {ws.fileInfo.pages !== null ? `${ws.fileInfo.pages} page${ws.fileInfo.pages === 1 ? "" : "s"} · ` : ""}
              text extracted
              {ws.fileInfo.truncated ? " · trimmed to fit" : ""} — review it below
            </p>
          </div>
          <button
            type="button"
            onClick={() => ws.clearInput("simplify")}
            aria-label={`Remove ${ws.fileInfo.name}`}
            className="chip danger-hover grid h-7 w-7 place-items-center rounded-lg"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="relative grid">
        <textarea
          {...ws.dropProps("single")}
          value={ws.doc}
          onChange={(e) => {
            ws.setDoc(e.target.value);
            if (e.target.value === "") ws.clearInput("simplify");
          }}
          rows={13}
          aria-label="Document text"
          placeholder="Paste your contract, rent agreement, ToS, or policy here — or drop a PDF."
          className={`field min-h-48 rounded-2xl p-4 text-sm leading-relaxed ${
            ws.dragTarget === "single" ? "dropzone-active" : ""
          }`}
        />
        {ws.dragTarget === "single" && (
          <div className="popover pointer-events-none absolute inset-3 grid place-items-center rounded-xl text-sm font-semibold">
            <span className="flex items-center gap-2">
              <UploadIcon className="accent h-5 w-5" /> Drop to upload
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2" aria-hidden={ws.doc.length === 0}>
        <div className="meter h-1 flex-1 overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full ${ws.doc.length >= MAX_DOC_CHARS ? "bg-red-500" : "bg-amber-400"}`}
            style={{ width: `${Math.min(100, (ws.doc.length / MAX_DOC_CHARS) * 100)}%` }}
          />
        </div>
        <span className="t3 text-[11px] tabular-nums">
          {formatK(ws.doc.length)} / {formatK(MAX_DOC_CHARS)} characters
        </span>
      </div>
    </div>
  );
}

export function CompareInput(): ReactNode {
  const ws = useWorkspace();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(
        [
          ["a", ws.labelA, ws.setLabelA, ws.docA, ws.setDocA, "Document A"],
          ["b", ws.labelB, ws.setLabelB, ws.docB, ws.setDocB, "Document B"],
        ] as const
      ).map(([key, label, setLabel, value, setValue, tag]) => (
        <div key={key} className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="t1 text-xs font-bold">{tag}</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              aria-label={`${tag} name`}
              className="field w-36 rounded-lg px-2 py-1 text-xs"
            />
            <span className="t3 text-[11px]">{formatK(value.length)} characters</span>
            <span className="ml-auto">
              <UploadButton target={key} />
            </span>
          </div>
          <textarea
            {...ws.dropProps(key)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={10}
            aria-label={tag}
            placeholder={`Paste ${tag.toLowerCase()} here, or drop a PDF…`}
            className={`field min-h-40 rounded-2xl p-3 text-sm leading-relaxed ${
              ws.dragTarget === key ? "dropzone-active" : ""
            }`}
          />
        </div>
      ))}
    </div>
  );
}

interface ResultPanelProps {
  readonly tool: Exclude<ActionKind, "ask">;
  readonly emptyHint: string;
  readonly heading?: string | undefined;
  readonly briefPdf?: boolean | undefined;
}

export function ResultPanel({ tool, emptyHint, heading, briefPdf }: ResultPanelProps): ReactNode {
  const ws = useWorkspace();
  const resultRef = useRef<HTMLElement>(null);
  const redlineRef = useRef<HTMLElement>(null);
  const active = ws.results[tool];
  const shown = ws.shownMarkdownFor(tool);
  const isCompare = tool === "compare";
  const showRedline = isCompare && ws.compareView === "redline";

  const sections = useMemo(
    () => (shown === undefined || showRedline ? [] : extractSections(shown, "sec")),
    [shown, showRedline],
  );
  const sources = useMemo(
    () => (active === undefined || showRedline ? [] : extractSources(active.markdown)),
    [active, showRedline],
  );

  const translatedActive = ws.translatedDoc[tool];

  return (
    <section
      data-tour="result"
      aria-busy={ws.loading}
      aria-label="Result"
      className="panel rise flex min-h-96 scroll-mt-20 flex-col gap-3 rounded-3xl p-5"
    >
      <div className="toolbar sticky top-[63px] z-10 -mx-5 -mt-5 grid gap-2 rounded-t-3xl px-5 pb-3 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="accent text-xs font-bold uppercase tracking-widest">Result</span>
          {isCompare && (
            <div role="group" aria-label="Comparison view" className="seg flex rounded-lg p-0.5 text-[11px] font-bold">
              {( [["ai", "AI verdict"], ["redline", "Redline"]] as const ).map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={ws.compareView === id}
                  onClick={() => ws.setCompareView(id)}
                  className={`rounded-md px-2 py-0.5 ${ws.compareView === id ? "btn-gold" : "t2"}`}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
          {!showRedline && active?.grounded === true && !ws.loading && (
            <span className="badge-live flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
              <CheckIcon className="h-3 w-3" /> Web-verified
            </span>
          )}
          {ws.translating && (
            <span className="t3 flex items-center gap-1 text-[11px]">
              <SpinnerIcon className="h-3 w-3" /> Translating to {ws.langLabel}…
            </span>
          )}
          {ws.language !== "en" && translatedActive !== undefined && !showRedline && (
            <button
              type="button"
              onClick={() => ws.setShowOriginal((v) => !v)}
              className="chip rounded-full px-2 py-0.5 text-[11px] font-bold"
            >
              {ws.showOriginal ? `Show ${ws.langLabel}` : "Show English"}
            </button>
          )}
          {briefPdf === true && active !== undefined && !ws.loading && (
            <button
              type="button"
              onClick={() => ws.downloadPdf(resultRef.current?.innerHTML, "brief", "Advocate brief")}
              className="btn-gold ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px]"
            >
              <FileIcon className="h-3.5 w-3.5" /> Brief PDF
            </button>
          )}
          <span className={briefPdf === true && active !== undefined && !ws.loading ? "" : "ml-auto"}>
            <ExportMenu
              disabled={showRedline ? ws.redlineOps === undefined : active === undefined || ws.loading}
              onCopy={() =>
                ws.writeClipboard(
                  showRedline
                    ? ws.redlineOps === undefined
                      ? ""
                      : redlineText(ws.redlineOps.ops)
                    : (shown ?? ""),
                )
              }
              onMarkdown={() => {
                if (showRedline && ws.redlineOps !== undefined) {
                  ws.downloadText("lexclarity-redline.md", `# Redline: ${ws.labelA} → ${ws.labelB}\n\nLegend: [-removed-] {+added+}\n\n${redlineText(ws.redlineOps.ops)}`);
                } else ws.downloadResult(tool);
              }}
              onPdf={() =>
                ws.downloadPdf(
                  (showRedline ? redlineRef : resultRef).current?.innerHTML,
                  showRedline ? "redline" : tool,
                  showRedline ? `Redline: ${ws.labelA} → ${ws.labelB}` : heading,
                )
              }
              {...(showRedline
                ? {}
                : {
                    onFullReport: ws.downloadFullReport,
                    onShareLink: () => ws.copyShareLink(ws.currentReport()),
                  })}
            />
          </span>
        </div>
        {!ws.loading && !showRedline && sections.length >= 3 && (
          <nav aria-label="Jump to section" className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
            <span className="t3 shrink-0 text-[11px]">Jump to</span>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="chip shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              >
                {s.label}
              </a>
            ))}
          </nav>
        )}
      </div>

      {showRedline &&
        (ws.redlineOps === undefined || ws.docA.trim() === "" || ws.docB.trim() === "" ? (
          <div className="grid flex-1 place-items-center py-14 text-center">
            <div>
              <div className="chip mx-auto grid h-12 w-12 place-items-center rounded-2xl">
                <ColumnsIcon className="t2 h-6 w-6" />
              </div>
              <p className="t1 mt-3 text-sm font-bold">Add both versions</p>
              <p className="t3 mx-auto mt-1 max-w-xs text-xs leading-relaxed">
                Paste the old version as Document A and the new one as Document B to see every added
                and removed word — instantly, without AI.
              </p>
            </div>
          </div>
        ) : (
          <Redline result={ws.redlineOps} labelA={ws.labelA} labelB={ws.labelB} articleRef={redlineRef} />
        ))}

      {!showRedline && ws.loading && (shown === undefined || shown === "") && (
        <>
          {ws.progress !== "" && (
            <p role="status" className="t2 flex items-center gap-2 text-xs font-semibold">
              <SpinnerIcon className="accent h-3.5 w-3.5" /> {ws.progress}
            </p>
          )}
          <LoadingSteps steps={LOADING_STEPS[tool]} />
        </>
      )}

      {!showRedline && ws.loading && shown !== undefined && shown !== "" && (
        <>
          {ws.progress !== "" && (
            <p role="status" className="t2 flex items-center gap-2 text-xs font-semibold">
              <SpinnerIcon className="accent h-3.5 w-3.5" /> {ws.progress}
            </p>
          )}
          <article ref={resultRef} aria-live="polite" className="prose-legal rise thread rounded-2xl p-5 text-sm">
            {renderMarkdown(shown, "sec")}
          </article>
        </>
      )}

      {!showRedline && !ws.loading && active === undefined && (
        <div className="grid flex-1 place-items-center py-14 text-center">
          <div>
            <div className="chip mx-auto grid h-12 w-12 place-items-center rounded-2xl">
              <FileIcon className="t2 h-6 w-6" />
            </div>
            <p className="t1 mt-3 text-sm font-bold">No analysis yet</p>
            <p className="t3 mx-auto mt-1 max-w-md text-xs leading-relaxed">{emptyHint}</p>
          </div>
        </div>
      )}

      {!showRedline && !ws.loading && shown !== undefined && (
        <article ref={resultRef} className="prose-legal rise thread rounded-2xl p-5 text-sm">
          {renderMarkdown(shown, "sec")}
        </article>
      )}

      {!showRedline && !ws.loading && sources.length > 0 && (
        <div className="thread rounded-2xl px-4 py-3">
          <p className="t1 text-xs font-bold">Sources ({sources.length})</p>
          <ol className="mt-1.5 grid gap-1">
            {sources.map((s, n) => (
              <li key={s.url} className="t2 flex gap-2 text-[12px]">
                <span className="t3 tabular-nums">{n + 1}.</span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="accent min-w-0 truncate underline-offset-2 hover:underline"
                  title={s.url}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      {ws.translateNote !== "" && <p className="t3 text-[11px]">{ws.translateNote}</p>}
    </section>
  );
}
