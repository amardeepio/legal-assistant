"use client";

import type { FormEvent, ReactNode } from "react";
import type { ActionKind } from "@/lib/legal";
import { SPECIALTIES } from "@/lib/advocate";
import { useWorkspace } from "@/components/studio/workspace";
import { toolMeta } from "@/components/studio/tools";
import { DocInput, CompareInput, ErrorBox, ResultPanel } from "@/components/studio/panels";
import { PlaybookEditor } from "@/components/playbook-editor";
import { AdvocateFinder } from "@/components/advocate-finder";
import { StampDutyPanel } from "@/components/stamp-duty-panel";
import { SpinnerIcon } from "@/components/icons";
import { describeAnalyzeLimits } from "@/lib/rate-limit";

export function ToolPage({ tool }: { tool: Exclude<ActionKind, "ask"> }): ReactNode {
  const ws = useWorkspace();
  const meta = toolMeta(tool);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    void ws.runTool(tool);
  };

  const runLabel =
    tool === "handoff" ? "Build advocate brief →" : tool === "stamp" ? "Verify with live sources →" : `Run ${meta.label} →`;

  return (
    <main className="grid gap-4">
      <div>
        <p className="accent text-[11px] font-bold uppercase tracking-[0.2em]">{meta.blurb}</p>
        <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">{meta.headline}</h1>
        <p className="t2 mt-1 text-sm leading-relaxed">{meta.sub}</p>
      </div>

      <form
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void ws.runTool(tool);
          }
        }}
        data-tour="input"
        className="panel rise flex flex-col gap-3 rounded-3xl p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="accent text-xs font-bold uppercase tracking-widest">
            {tool === "stamp" ? "01 · Your deal" : tool === "compare" ? "01 · Your documents" : "01 · Your document"}
          </span>
        </div>

        {tool === "stamp" ? (
          <StampDutyPanel
            location={ws.jurisdiction}
            busy={ws.loading}
            onVerify={(req) => {
              ws.setLastStampReq(req);
              void ws.runTool("stamp", req);
            }}
          />
        ) : tool === "compare" ? (
          <CompareInput />
        ) : (
          <DocInput />
        )}

        {tool === "playbook" && <PlaybookEditor rules={ws.rules} onChange={ws.updateRules} />}

        {tool === "handoff" && (
          <div className="grid gap-2">
            <textarea
              value={ws.situation}
              onChange={(e) => ws.setSituation(e.target.value.slice(0, 2000))}
              rows={3}
              placeholder="What happened, and what do you want from the advocate? e.g. Client stopped paying after 2 invoices; I want to recover ₹1.7 lakh without going to court."
              aria-label="Your situation"
              className="field rounded-2xl px-4 py-3 text-sm leading-relaxed"
            />
            <label className="t2 flex items-center gap-2 text-xs font-semibold">
              Practice area
              <select
                value={ws.specialty}
                onChange={(e) => ws.setSpecialty(e.target.value)}
                className="field flex-1 rounded-lg px-2 py-1.5 text-xs font-normal"
              >
                {SPECIALTIES.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {tool === "action" && (
          <input
            value={ws.goal}
            onChange={(e) => ws.setGoal(e.target.value)}
            placeholder="Your goal (optional): e.g. decide whether to sign this freelancing contract"
            aria-label="Your goal"
            className="field rounded-2xl px-4 py-3 text-sm"
          />
        )}

        {ws.notice !== "" && (
          <p role="status" className="alert-ok rounded-xl px-3 py-2 text-xs">
            {ws.notice}
          </p>
        )}

        <ErrorBox onRetry={() => void ws.runTool(tool)} />

        {tool !== "stamp" && (
          <>
            <button
              type="submit"
              data-tour="run"
              disabled={ws.loading || ws.extracting}
              className="btn-gold flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm transition disabled:cursor-wait disabled:opacity-60"
            >
              {ws.loading ? (
                <>
                  <SpinnerIcon className="h-4 w-4" /> Analysing your document…
                </>
              ) : (
                runLabel
              )}
            </button>
            <p className="t3 -mt-1 text-center text-[11px]">
              or press <kbd className="chip rounded px-1 py-px font-sans">Ctrl</kbd> /{" "}
              <kbd className="chip rounded px-1 py-px font-sans">⌘</kbd> +{" "}
              <kbd className="chip rounded px-1 py-px font-sans">Enter</kbd>
              {" · "}Fair use: {describeAnalyzeLimits()} per visitor
            </p>
          </>
        )}
      </form>

      <ResultPanel
        tool={tool}
        heading={tool === "handoff" ? "Advocate brief" : undefined}
        briefPdf={tool === "handoff"}
        emptyHint={
          tool === "stamp"
            ? "Your offline estimate is above. Verify it with live sources to check current rates, concessions and e-registration steps."
            : tool === "compare"
              ? "Add both documents above, then run Compare for an AI verdict — or switch to Redline for instant word-level changes."
              : `Paste or upload a document, then run ${meta.label}. Not sure where to start? Load the sample contract and try Risk X-Ray.`
        }
      />

      {tool === "handoff" && !ws.loading && (
        <AdvocateFinder specialty={ws.specialty} onSpecialty={ws.setSpecialty} location={ws.jurisdiction} />
      )}
    </main>
  );
}
