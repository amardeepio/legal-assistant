"use client";

import { useEffect, useRef } from "react";
import type { FormEvent, ReactNode } from "react";
import { SAMPLE_DOCS } from "@/lib/legal";
import { cacheKey } from "@/lib/translate";
import { useWorkspace, formatK } from "@/components/studio/workspace";
import { renderMarkdown } from "@/components/markdown";
import { LogoMark } from "@/components/logo-mark";
import { describeAnalyzeLimits } from "@/lib/rate-limit";
import {
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  PaperclipIcon,
  SpinnerIcon,
} from "@/components/icons";

const SUGGESTIONS = [
  {
    title: "Rent agreement registration",
    hint: "Validity & stamp duty in Maharashtra",
    prompt: "Is an 11-month rent agreement valid in Maharashtra without registration?",
  },
  {
    title: "Unpaid client invoice",
    hint: "Options beyond a legal notice",
    prompt: "My client hasn't paid my invoice for 60 days — what are my options under Indian law?",
  },
  {
    title: "Non-compete after resignation",
    hint: "Section 27, Contract Act",
    prompt: "Can my employer enforce a 12-month non-compete after I resign?",
  },
  {
    title: "Consumer complaint",
    hint: "e-Daakhil step by step",
    prompt: "How do I file a consumer complaint online via e-Daakhil?",
  },
] as const;

function shownChatText(
  content: string,
  translated: Readonly<Record<string, string>>,
  language: string,
  showOriginal: boolean,
): string {
  if (language === "en" || showOriginal) return content;
  return translated[cacheKey(content, language as never)] ?? content;
}

export function ChatPanel(): ReactNode {
  const ws = useWorkspace();
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = threadRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [ws.history, ws.loading]);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    void ws.runAsk();
  };

  return (
    <section className="panel rise rounded-3xl">
      <div className="border-b bl flex items-center gap-2 rounded-t-3xl px-5 py-3">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-amber-300 to-amber-600 text-black">
          <LogoMark className="h-4 w-4" />
        </div>
        <p className="text-sm font-bold">Legal chat</p>
        <p className="t3 hidden text-[11px] sm:block">
          {ws.doc.trim()
            ? `Grounded in your document (${formatK(ws.doc.length)} characters)`
            : "Grounded in Indian law"}
        </p>
        {ws.translating && (
          <span className="t3 flex items-center gap-1 text-[11px]">
            <SpinnerIcon className="h-3 w-3" /> Translating…
          </span>
        )}
        {ws.language !== "en" && (
          <button
            type="button"
            onClick={() => ws.setShowOriginal((v) => !v)}
            className="chip rounded-full px-2 py-0.5 text-[11px] font-bold"
          >
            {ws.showOriginal ? ws.langLabel.split("·")[0]?.trim() ?? ws.langLabel : "EN"}
          </button>
        )}
        {ws.history.length > 0 && (
          <button
            type="button"
            onClick={ws.clearChat}
            className="chip danger-hover ml-auto rounded-lg px-2.5 py-1 text-[11px] font-bold"
          >
            Clear
          </button>
        )}
      </div>

      <details className="border-b bl px-5 py-2.5">
        <summary className="t1 flex cursor-pointer items-center gap-1.5 text-xs font-bold hover:opacity-80">
          <PaperclipIcon className="h-3.5 w-3.5" />
          Context document
          <span className="t3 font-normal">
            {ws.doc.trim() ? `· ${ws.fileInfo?.name ?? `${formatK(ws.doc.length)} characters`} attached` : "· optional — attach for grounded answers"}
          </span>
        </summary>
        <div className="grid gap-2 py-2">
          <div className="flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              disabled={ws.extracting}
              onClick={() => ws.onPickFile("single")}
              className="chip chip-dash rounded-full px-3 py-1 text-[11px] font-semibold disabled:opacity-50"
            >
              Upload PDF, .docx or .txt
            </button>
          </div>
          <textarea
            value={ws.doc}
            onChange={(e) => ws.setDoc(e.target.value)}
            rows={4}
            placeholder="Paste a contract, rent agreement, or policy here…"
            className="field rounded-2xl p-3 text-sm leading-relaxed"
          />
        </div>
      </details>

      <div
        ref={threadRef}
        aria-live="polite"
        className="thread thread-scroll flex max-h-[62vh] min-h-[54vh] flex-col gap-6 overflow-y-auto px-5 py-6 sm:px-8"
      >
        {ws.history.length === 0 && !ws.loading && (
          <div className="m-auto w-full max-w-2xl py-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 text-black">
              <LogoMark className="h-7 w-7" />
            </div>
            <p className="t1 mt-3 text-lg font-bold">Namaste! What&apos;s your legal question?</p>
            <p className="t3 mt-1 text-xs">Answers cite Indian statutes &amp; procedure, checked against live sources.</p>
            <div className="mt-5 grid gap-2 text-left sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button key={s.title} type="button" onClick={() => ws.setQuestion(s.prompt)} className="suggest rounded-2xl p-3.5 text-left">
                  <span className="t1 block text-sm font-bold">{s.title} →</span>
                  <span className="t3 mt-0.5 block text-[11px]">{s.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {ws.history.map((m, n) =>
          m.role === "user" ? (
            <div key={n} className="flex justify-end">
              <div className="bubble-user max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-medium leading-relaxed">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={n} className="flex gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-300 to-amber-600 text-black">
                <LogoMark className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <article className="prose-legal text-sm">
                  {renderMarkdown(shownChatText(m.content, ws.chatTranslated, ws.language, ws.showOriginal), `msg${n}`)}
                </article>
                <button
                  type="button"
                  onClick={() => void ws.copyMessage(shownChatText(m.content, ws.chatTranslated, ws.language, ws.showOriginal), n)}
                  className="chip mt-2 flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold"
                >
                  {ws.copiedMsg === n ? (
                    <>
                      <CheckIcon className="h-3 w-3" /> Copied
                    </>
                  ) : (
                    <>
                      <CopyIcon className="h-3 w-3" /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          ),
        )}

        {ws.loading && (
          <div className="flex gap-3" role="status">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-300 to-amber-600 text-black">
              <LogoMark className="h-[18px] w-[18px]" />
            </div>
            <div className="t2 flex items-center gap-2 text-sm">
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: "0.15s" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: "0.3s" }} />
              </span>
              {ws.progress !== "" ? ws.progress : "Researching Indian law…"}
            </div>
          </div>
        )}

        {ws.error !== "" && (
          <div role="alert" className="alert-err flex items-start gap-3 rounded-xl px-3 py-2 text-xs">
            <span className="flex-1 leading-relaxed">{ws.error}</span>
            {ws.canRetry && (
              <button
                type="button"
                onClick={() => void ws.runAsk()}
                disabled={ws.loading}
                className="shrink-0 rounded-md border border-current px-2 py-0.5 font-bold disabled:opacity-50"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      <div className="composer sticky bottom-0 rounded-b-3xl px-5 py-3 backdrop-blur-md">
        {ws.notice !== "" && (
          <p role="status" className="alert-ok mb-2 rounded-xl px-3 py-2 text-xs">
            {ws.notice}
          </p>
        )}
        {ws.translateNote !== "" && <p className="t3 mb-2 text-[11px]">{ws.translateNote}</p>}
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={ws.question}
            onChange={(e) => ws.setQuestion(e.target.value)}
            placeholder="Ask about Indian law or your document…"
            aria-label="Ask a legal question"
            className="field flex-1 rounded-2xl px-5 py-3.5 text-[15px]"
          />
          <button
            type="submit"
            disabled={ws.loading || ws.extracting || ws.question.trim().length < 3}
            aria-label="Send question"
            className="btn-gold grid w-13 shrink-0 place-items-center rounded-2xl transition disabled:cursor-wait disabled:opacity-50"
          >
            <ArrowUpIcon className="h-5 w-5" />
          </button>
        </form>
        <p className="t3 mt-1.5 text-center text-[10px]">Information only — not legal advice · Press Enter to send · Fair use: {describeAnalyzeLimits()}</p>
      </div>
    </section>
  );
}
