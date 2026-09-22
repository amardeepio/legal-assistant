"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoMark } from "@/components/logo-mark";
import { LibraryPanel } from "@/components/library-panel";
import { ProductTour } from "@/components/product-tour";
import type { TourStep } from "@/components/product-tour";
import { useDismiss } from "@/components/use-dismiss";
import { useWorkspace } from "@/components/studio/workspace";
import { TOOLS } from "@/components/studio/tools";
import type { LanguageCode } from "@/lib/translate";
import { LANGUAGES } from "@/lib/translate";
import type { ReadingLevel } from "@/lib/legal";
import type { RecentItem } from "@/lib/recent";
import { reportFileName, buildReportMarkdown } from "@/lib/report";
import {
  ArchiveIcon,
  BookIcon,
  BriefcaseIcon,
  ChatIcon,
  ChecklistIcon,
  ClipboardCheckIcon,
  ColumnsIcon,
  GlobeIcon,
  HelpIcon,
  PinIcon,
  ScaleIcon,
  ShieldIcon,
  SlidersIcon,
  SparkIcon,
  StampIcon,
  ChevronDownIcon,
} from "@/components/icons";

const TOOL_ICONS = {
  simplify: SparkIcon,
  risks: ShieldIcon,
  playbook: ClipboardCheckIcon,
  compare: ColumnsIcon,
  ask: ChatIcon,
  action: ChecklistIcon,
  handoff: BriefcaseIcon,
  stamp: StampIcon,
} as const;

const TOUR_STEPS: readonly TourStep[] = [
  {
    targets: ["nav-tools"],
    title: "Pick a tool",
    body: "Each tool is its own page now: Simplify, Risk X-Ray, Playbook, Compare, Ask, Action Plan, Advocate Brief and Stamp Duty. Your document follows you between pages.",
  },
  {
    targets: ["settings", "settings-toggle"],
    title: "Set your location and language",
    body: "Your state changes things like stamp duty and tenancy rules. Choose a reading level, and pick an Indian language to read results in.",
  },
  {
    targets: ["input"],
    title: "Add your document",
    body: "Paste text, upload or drop a PDF, or try a sample. Check the extracted text before you run anything.",
  },
  {
    targets: ["run"],
    title: "Run the analysis",
    body: "Click Run or press Ctrl/⌘ + Enter. Answers that need live legal research take a little longer.",
  },
  {
    targets: ["result"],
    title: "Read and export the result",
    body: "Jump between sections, check the cited sources, and use Export to copy it, download it, or save it as a PDF for your advocate.",
  },
  {
    targets: ["recent"],
    title: "Come back to past work",
    body: "Every analysis is saved to your Library in this browser. Pin, rename, search, download, or copy a read-only link to share.",
  },
  {
    targets: ["help"],
    title: "Need more help?",
    body: "Open the docs for guides, limits, and privacy details, or restart this tour at any time.",
  },
];

const INDIAN_LOCATIONS: readonly string[] = [
  "Andhra Pradesh, India",
  "Bihar, India",
  "Delhi (NCT), India",
  "Goa, India",
  "Gujarat, India",
  "Haryana, India",
  "Karnataka, India",
  "Kerala, India",
  "Madhya Pradesh, India",
  "Maharashtra, India",
  "Punjab, India",
  "Rajasthan, India",
  "Tamil Nadu, India",
  "Telangana, India",
  "Uttar Pradesh, India",
  "Uttarakhand, India",
  "West Bengal, India",
  "Mumbai, Maharashtra",
  "Pune, Maharashtra",
  "Bengaluru, Karnataka",
  "Chennai, Tamil Nadu",
  "Hyderabad, Telangana",
  "Kolkata, West Bengal",
  "Ahmedabad, Gujarat",
  "Jaipur, Rajasthan",
  "Lucknow, Uttar Pradesh",
  "Kochi, Kerala",
  "Indore, Madhya Pradesh",
  "Patna, Bihar",
];

export function StudioShell({ children }: { children: ReactNode }): ReactNode {
  const ws = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const recentRef = useRef<HTMLDivElement>(null);
  const closeRecent = (): void => ws.setRecentOpen(false);
  useDismiss(ws.recentOpen, recentRef, closeRecent);

  const reportFromItem = (item: RecentItem) => ({
    v: 1 as const,
    title: item.title.slice(0, 200),
    createdAt: item.createdAt,
    ...(item.jurisdiction !== undefined ? { jurisdiction: item.jurisdiction.slice(0, 120) } : {}),
    sections: [{ action: item.action, markdown: item.markdown, grounded: item.grounded }],
  });

  const openItemAndGo = (item: RecentItem): void => {
    ws.restoreRecent(item);
    const href = TOOLS.find((t) => t.id === item.action)?.href ?? "/simplify";
    router.push(href);
  };

  return (
    <div className="min-h-screen">
      <header className="nav sticky top-0 z-20 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="LexClarity home">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-black">
              <LogoMark className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-widest">LEXCLARITY</span>
              <span className="t3 block text-[11px]">Legal information for India</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="chip hidden max-w-44 items-center gap-1.5 truncate rounded-full px-3 py-1 text-[11px] sm:flex"
              title={ws.jurisdiction || "All India"}
            >
              <PinIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{ws.jurisdiction || "All India"}</span>
            </span>
            <div ref={recentRef} data-tour="recent" className="relative">
              <button
                type="button"
                onClick={ws.openRecent}
                aria-label="Library"
                aria-expanded={ws.recentOpen}
                className="chip flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold"
              >
                <ArchiveIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Library</span>
              </button>
              {ws.recentOpen && (
                <LibraryPanel
                  items={ws.recent}
                  onItems={ws.setRecent}
                  onOpen={openItemAndGo}
                  onShare={(item) => ws.copyShareLink(reportFromItem(item))}
                  onDownload={ws.downloadItem}
                />
              )}
            </div>
            <div data-tour="help" className="flex items-center gap-2">
              <Link
                href="/docs"
                aria-label="Docs"
                className="chip flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold hover:border-amber-400/50"
              >
                <BookIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Docs</span>
              </Link>
              <button
                type="button"
                onClick={ws.startTour}
                aria-label="Take the product tour"
                title="Take the product tour"
                className="chip grid h-8 w-8 place-items-center rounded-full"
              >
                <HelpIcon className="h-4 w-4" />
              </button>
            </div>
            <ThemeToggle />
          </div>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-orange-500 via-amber-200 to-green-500" />
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-14 sm:px-6">
        <button
          type="button"
          data-tour="settings-toggle"
          onClick={() => setSettingsOpen((v) => !v)}
          aria-expanded={settingsOpen}
          aria-controls="settings"
          className="chip mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold sm:hidden"
        >
          <SlidersIcon className="h-4 w-4" />
          Settings
          <span className="t3 truncate font-normal">
            · {ws.jurisdiction || "All India"} · {ws.langLabel}
          </span>
          <ChevronDownIcon className={`ml-auto h-4 w-4 transition ${settingsOpen ? "rotate-180" : ""}`} />
        </button>
        <section
          id="settings"
          data-tour="settings"
          className={`panel mt-4 flex-col gap-2 rounded-2xl p-3 sm:flex sm:flex-row sm:items-center ${
            settingsOpen ? "flex" : "hidden"
          }`}
        >
          <label className="t2 flex flex-1 items-center gap-2 text-xs">
            <span className="flex shrink-0 items-center gap-1.5 font-bold uppercase tracking-wider">
              <PinIcon className="h-3.5 w-3.5" /> Location
            </span>
            <input
              value={ws.jurisdiction}
              onChange={(e) => ws.setJurisdiction(e.target.value)}
              placeholder="Start typing — e.g. Pune, Maharashtra"
              list="indian-locations"
              autoComplete="off"
              className="field w-full rounded-xl px-3 py-2 text-sm font-normal"
            />
            <datalist id="indian-locations">
              {INDIAN_LOCATIONS.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </label>
          <label className="t2 flex items-center gap-2 text-xs">
            <span className="shrink-0 font-bold uppercase tracking-wider">Reading</span>
            <select
              value={ws.readingLevel}
              onChange={(e) => ws.setReadingLevel(e.target.value as ReadingLevel)}
              className="field rounded-xl px-3 py-2 text-sm font-normal"
            >
              <option value="plain">Plain · grade 6</option>
              <option value="standard">Standard</option>
              <option value="detailed">Detailed · pro</option>
            </select>
          </label>
          <label className="t2 flex items-center gap-2 text-xs">
            <span className="flex shrink-0 items-center gap-1.5 font-bold uppercase tracking-wider">
              <GlobeIcon className="h-3.5 w-3.5" /> Output
            </span>
            <select
              value={ws.language}
              onChange={(e) => ws.switchLanguage(e.target.value as LanguageCode, "simplify")}
              className="field rounded-xl px-3 py-2 text-sm font-normal"
              title="Translate results into an Indian language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-[240px_1fr]">
          <nav
            data-tour="nav-tools"
            aria-label="Tools"
            className="panel flex gap-1 overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none] lg:sticky lg:top-24 lg:flex-col lg:overflow-visible"
          >
            {TOOLS.map((t) => {
              const Icon = TOOL_ICONS[t.id];
              const active = pathname === t.href;
              return (
                <Link
                  key={t.id}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm transition lg:whitespace-normal ${
                    active
                      ? "bg-gradient-to-r from-amber-300 to-amber-500 font-bold text-black shadow-[0_0_24px_rgba(245,196,81,0.3)]"
                      : "t2 hover-soft"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span>{t.label}</span>
                    <span className={`truncate text-[11px] font-normal lg:block ${active ? "text-black/70" : "t3"}`}>
                      {t.blurb}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="min-w-0">
            {ws.sessionRestored && (
              <div
                role="status"
                className="alert-ok mb-4 flex flex-wrap items-center gap-2 rounded-2xl px-4 py-2.5 text-xs"
              >
                <span className="flex-1">
                  Restored your last session from this browser — document, results
                  and chat included.
                </span>
                <button
                  type="button"
                  onClick={ws.startFresh}
                  className="rounded-lg border border-current px-2.5 py-1 font-bold"
                >
                  Start fresh
                </button>
                <button
                  type="button"
                  onClick={ws.dismissRestore}
                  aria-label="Dismiss restore notice"
                  className="rounded-lg px-2 py-1 font-bold opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            )}
            {children}
          </div>
        </div>

        <footer className="disclaimer rounded-2xl px-4 py-3 text-[11px] leading-relaxed">
          <strong>Information only, not legal advice.</strong> Consult an advocate before acting.
          Free legal aid: NALSA / DLSA helpline 15100. ·{" "}
          <Link href="/docs" className="underline underline-offset-2">
            Read the docs
          </Link>
        </footer>
      </div>

      {ws.showDisclaimer && (
        <div
          role="dialog"
          aria-labelledby="disclaimer-title"
          className="popover rise fixed inset-x-4 bottom-4 z-40 mx-auto max-w-lg rounded-2xl p-4"
        >
          <p id="disclaimer-title" className="t1 flex items-center gap-2 text-sm font-bold">
            <ScaleIcon className="accent h-4 w-4" /> Before you start
          </p>
          <p className="t2 mt-1.5 text-xs leading-relaxed">
            LexClarity explains legal documents in plain language. It gives general information, not
            legal advice, and it can be wrong or out of date. Confirm anything important with an
            advocate enrolled with the Bar Council of India.
          </p>
          <button type="button" onClick={ws.dismissDisclaimer} className="btn-gold mt-3 rounded-xl px-4 py-2 text-xs">
            I understand
          </button>
        </div>
      )}
      {ws.showTour && <ProductTour steps={TOUR_STEPS} onClose={() => ws.endTour(true)} />}
    </div>
  );
}

export function downloadReportForItem(item: RecentItem, download: (n: string, t: string) => void): void {
  const report = {
    v: 1 as const,
    title: item.title.slice(0, 200),
    createdAt: item.createdAt,
    sections: [{ action: item.action, markdown: item.markdown, grounded: item.grounded }],
  };
  download(reportFileName(report.title), buildReportMarkdown(report));
}
