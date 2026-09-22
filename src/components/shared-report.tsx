"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { Report } from "@/lib/report";
import {
  buildReportMarkdown,
  decodeReport,
  orderSections,
  reportFileName,
  tokenFromHash,
} from "@/lib/report";
import { ACTION_LABELS } from "@/lib/legal";
import { renderMarkdown } from "./markdown";
import { LogoMark } from "./logo-mark";
import { ThemeToggle } from "./theme-toggle";
import { CheckIcon, DownloadIcon, FileIcon, LockIcon, SpinnerIcon } from "./icons";

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

type View =
  | { readonly state: "loading"; readonly token: string }
  | { readonly state: "ready"; readonly token: string; readonly report: Report }
  | { readonly state: "invalid"; readonly token: string };

/** Read-only viewer for a report carried in the URL fragment. */
export function SharedReport(): ReactNode {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const token = tokenFromHash(hash) ?? "";
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    if (token === "") return;
    let live = true;
    void decodeReport(token).then((report) => {
      if (!live) return;
      setView(report === null ? { state: "invalid", token } : { state: "ready", token, report });
    });
    return () => {
      live = false;
    };
  }, [token]);

  // A view decoded for an older hash counts as still loading.
  const current: View =
    token === ""
      ? { state: "invalid", token }
      : view !== null && view.token === token
        ? view
        : { state: "loading", token };

  const download = (report: Report): void => {
    const blob = new Blob([buildReportMarkdown(report)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = reportFileName(report.title);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <header className="nav no-print sticky top-0 z-20 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-black">
              <LogoMark className="h-5 w-5" />
            </span>
            <span className="text-sm font-extrabold tracking-widest">LEXCLARITY</span>
          </Link>
          <span className="chip flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
            <LockIcon className="h-3.5 w-3.5" /> Read-only
          </span>
          <div className="ml-auto flex items-center gap-2">
            {current.state === "ready" && (
              <>
                <button
                  type="button"
                  onClick={() => download(current.report)}
                  className="chip flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold"
                >
                  <DownloadIcon className="h-3.5 w-3.5" /> .md
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="chip flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold"
                >
                  <FileIcon className="h-3.5 w-3.5" /> Save as PDF
                </button>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-orange-500 via-amber-200 to-green-500" />
      </header>

      <main className="mx-auto grid max-w-4xl gap-4 px-4 py-8 sm:px-6">
        {current.state === "loading" && (
          <p role="status" className="t2 flex items-center gap-2 text-sm">
            <SpinnerIcon className="h-4 w-4" /> Opening shared report…
          </p>
        )}

        {current.state === "invalid" && (
          <div className="panel rounded-3xl p-6 text-center">
            <p className="t1 text-lg font-bold">This link doesn&apos;t contain a readable report</p>
            <p className="t2 mx-auto mt-1 max-w-md text-sm">
              It may have been cut off when it was copied. Ask the sender to copy the
              link again from their LexClarity library.
            </p>
            <Link href="/" className="btn-gold mt-4 inline-block rounded-xl px-4 py-2 text-xs">
              Open LexClarity
            </Link>
          </div>
        )}

        {current.state === "ready" && (
          <>
            <section>
              <p className="accent text-[11px] font-bold uppercase tracking-[0.2em]">Shared report</p>
              <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">{current.report.title}</h1>
              <p className="t3 mt-1 text-xs">
                {new Date(current.report.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {current.report.jurisdiction ? ` · ${current.report.jurisdiction}` : ""} ·{" "}
                {current.report.sections.map((s) => ACTION_LABELS[s.action]).join(", ")}
              </p>
            </section>
            {orderSections(current.report.sections).map((s, n) => (
              <section key={`${s.action}-${n}`} className="panel rounded-3xl p-5">
                <div className="flex items-center gap-2">
                  <h2 className="accent text-xs font-bold uppercase tracking-widest">
                    {ACTION_LABELS[s.action]}
                  </h2>
                  {s.grounded && (
                    <span className="badge-live flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                      <CheckIcon className="h-3 w-3" /> Web-verified
                    </span>
                  )}
                </div>
                <article className="prose-legal mt-2 text-sm">
                  {renderMarkdown(s.markdown, `share${n}`)}
                </article>
              </section>
            ))}
          </>
        )}

        <footer className="disclaimer rounded-2xl px-4 py-3 text-[11px] leading-relaxed">
          <strong>Information only, not legal advice.</strong> This report was generated
          by AI and shared by a LexClarity user. Consult an advocate before acting. Free
          legal aid: NALSA / DLSA helpline 15100.
        </footer>
      </main>
    </div>
  );
}
