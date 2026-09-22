import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  BriefcaseIcon,
  ChatIcon,
  ChecklistIcon,
  ClipboardCheckIcon,
  ColumnsIcon,
  ShieldIcon,
  SparkIcon,
  StampIcon,
  BookIcon,
  CheckIcon,
  GlobeIcon,
  LockIcon,
  ScaleIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "LexClarity — AI Legal Information Studio for India",
  description:
    "Simplify, compare, risk-scan and ask questions about legal documents under Indian law. Answers checked against live sources. Works on iPhone and Android. Information only — not legal advice.",
  keywords: [
    "legal documents India",
    "contract explainer",
    "rent agreement India",
    "stamp duty calculator",
    "Indian law",
  ],
  openGraph: {
    title: "LexClarity — Legal documents, finally readable",
    description:
      "Simplify contracts, spot risky clauses, compare versions and get answers grounded in Indian law. Mobile-friendly, private by design.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LexClarity — Legal documents, finally readable",
    description:
      "Simplify contracts, spot risky clauses, compare versions and get answers grounded in Indian law.",
  },
};

const TOOLS = [
  {
    href: "/simplify",
    Icon: SparkIcon,
    name: "Simplify",
    blurb: "Plain-language summary of any contract, notice or policy.",
    tag: "Most used",
  },
  {
    href: "/risks",
    Icon: ShieldIcon,
    name: "Risk X-Ray",
    blurb: "Risk score, red flags and the protections you're missing.",
    tag: "Before you sign",
  },
  {
    href: "/playbook",
    Icon: ClipboardCheckIcon,
    name: "Playbook",
    blurb: "Check every contract against your standard positions.",
    tag: "For business",
  },
  {
    href: "/compare",
    Icon: ColumnsIcon,
    name: "Compare",
    blurb: "AI verdict plus an instant word-level redline, offline.",
    tag: "A vs B",
  },
  {
    href: "/ask",
    Icon: ChatIcon,
    name: "Ask",
    blurb: "Questions answered from your document and Indian law.",
    tag: "Chat",
  },
  {
    href: "/action",
    Icon: ChecklistIcon,
    name: "Action Plan",
    blurb: "Obligations, deadlines, evidence and next steps.",
    tag: "After signing",
  },
  {
    href: "/handoff",
    Icon: BriefcaseIcon,
    name: "Advocate Brief",
    blurb: "A 5-minute handoff packet plus where to find an advocate.",
    tag: "PDF export",
  },
  {
    href: "/stamp",
    Icon: StampIcon,
    name: "Stamp Duty",
    blurb: "Duty & registration estimates, verified with live sources.",
    tag: "Maharashtra-ready",
  },
] as const;

const STATS = [
  { value: "8", label: "Focused tools, one per page" },
  { value: "28+", label: "States & UTs covered" },
  { value: "9", label: "Indian languages supported" },
  { value: "0", label: "Documents stored on servers" },
] as const;

const STEPS = [
  {
    n: "1",
    title: "Add your document once",
    body: "Paste text or drop a PDF on any tool page. It follows you as you move between tools — no re-uploading.",
  },
  {
    n: "2",
    title: "Run the right tool",
    body: "Two panes for Compare, a calculator for Stamp Duty, a playbook editor for standards — each page has room to breathe.",
  },
  {
    n: "3",
    title: "Export or revisit",
    body: "Copy, download, save as PDF for your advocate, or find every finished analysis in your on-device Library.",
  },
] as const;

const FAQS = [
  {
    q: "Is this legal advice?",
    a: "No. LexClarity gives general legal information to help you understand documents and ask better questions. For anything that matters, speak to an advocate enrolled with the Bar Council of India.",
  },
  {
    q: "Where do my documents go?",
    a: "Nowhere permanent. Documents are sent to the AI provider to generate an answer and are not stored on our servers. Your Library lives only in your browser — clear site data and it's gone.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes — every tool page is designed mobile-first. Paste, upload or photograph-to-text on iPhone or Android, run the analysis, and export or share the result from your phone.",
  },
] as const;

function ToolCard({ t }: { t: (typeof TOOLS)[number] }): ReactNode {
  return (
    <Link
      href={t.href}
      className="suggest group flex min-h-[88px] touch-manipulation flex-col rounded-3xl p-4 transition active:scale-[0.99] sm:p-5"
    >
      <span className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 text-black">
          <t.Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="t1 block truncate text-[15px] font-bold leading-tight">
            {t.name} <span aria-hidden="true">→</span>
          </span>
          <span className="accent block text-[11px] font-semibold">{t.tag}</span>
        </span>
      </span>
      <span className="t2 mt-2 block text-[13px] leading-relaxed">{t.blurb}</span>
    </Link>
  );
}

export default function LandingPage(): ReactNode {
  return (
    <div className="landing min-h-screen overflow-x-clip">
      {/* ── Header ─────────────────────────────── */}
      <header className="nav safe-top sticky top-0 z-20 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-black">
              <LogoMark className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-widest">LEXCLARITY</span>
              <span className="t3 block text-[11px]">Legal information for India</span>
            </span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/docs"
              className="chip flex min-h-[40px] touch-manipulation items-center gap-1.5 rounded-full px-4 text-[12px] font-semibold"
            >
              <BookIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Docs</span>
              <span className="sm:hidden">Docs</span>
            </Link>
            <ThemeToggle />
            <Link
              href="/simplify"
              className="btn-gold hidden min-h-[40px] touch-manipulation items-center rounded-full px-4 text-[12px] sm:flex"
            >
              Open app →
            </Link>
          </div>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-orange-500 via-amber-200 to-green-500" />
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-10 sm:gap-12 sm:px-6 sm:pb-14">
        {/* ── Hero ─────────────────────────────── */}
        <section className="pt-6 sm:pt-10">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border bl px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="accent">Built for Indian law</span>
            </p>
            <h1 className="mt-3 text-balance text-[2rem] font-black leading-[1.08] tracking-tight sm:text-5xl sm:leading-[1.05] lg:text-6xl">
              Legal documents,{" "}
              <span className="bg-gradient-to-r from-amber-500 to-teal-600 bg-clip-text text-transparent">
                finally readable.
              </span>
            </h1>
            <p className="t2 mt-3 max-w-xl text-pretty text-[15px] leading-relaxed sm:text-lg">
              Simplify contracts, spot risky clauses, compare versions and get answers grounded in
              Indian law — from your phone or desktop. Your document follows you across tools.
            </p>
            <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
              <Link
                href="/simplify"
                className="btn-gold flex min-h-[52px] touch-manipulation items-center justify-center rounded-2xl px-6 text-[15px] sm:w-auto"
              >
                Start with Simplify →
              </Link>
              <Link
                href="/ask"
                className="chip flex min-h-[52px] touch-manipulation items-center justify-center rounded-2xl px-6 text-[15px] font-semibold"
              >
                Ask a question
              </Link>
            </div>
            <p className="t3 mt-2 text-[12px]">Free to try · No account · Works on iPhone & Android</p>
          </div>

          <ul className="t2 mt-5 grid gap-2 text-[13px] sm:mt-6 sm:flex sm:flex-wrap sm:gap-x-6">
            <li className="flex items-center gap-2">
              <LockIcon className="accent h-4 w-4 shrink-0" />
              Documents aren&apos;t stored on our servers
            </li>
            <li className="flex items-center gap-2">
              <ScaleIcon className="accent h-4 w-4 shrink-0" />
              Covers central &amp; state law
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon className="accent h-4 w-4 shrink-0" />
              Answers checked against live sources
            </li>
          </ul>

          {/* Stats */}
          <dl className="panel mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-3xl sm:mt-6 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="thread-plain flex flex-col px-4 py-4 text-center sm:py-5">
                <dd className="t1 order-1 text-2xl font-black tabular-nums sm:text-3xl">{s.value}</dd>
                <dt className="t2 order-2 mt-1 block text-[11px] leading-snug">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Tools ────────────────────────────── */}
        <section aria-label="Tools" className="scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="accent text-[11px] font-bold uppercase tracking-[0.2em]">The studio</p>
              <h2 className="t1 mt-1 text-balance text-xl font-extrabold sm:text-2xl">
                Choose a tool — each has its own page
              </h2>
              <p className="t3 mt-1 max-w-lg text-[13px] leading-relaxed">
                No more cramped tabs. Big touch targets, focused inputs, readable results.
              </p>
            </div>
            <Link href="/docs" className="chip rounded-full px-3 py-2 text-[12px] font-semibold touch-manipulation">
              How to use →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
            {TOOLS.map((t) => (
              <ToolCard key={t.href} t={t} />
            ))}
          </div>
        </section>

        {/* ── How it works ─────────────────────── */}
        <section className="panel rounded-3xl p-5 sm:p-7" aria-label="How it works">
          <p className="accent text-[11px] font-bold uppercase tracking-[0.2em]">How it works</p>
          <h2 className="t1 mt-1 text-balance text-xl font-extrabold sm:text-2xl">
            Three steps, on phone or desktop
          </h2>
          <ol className="mt-4 grid gap-3 lg:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="thread rounded-2xl p-4 sm:p-5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-sm font-black text-black">
                  {s.n}
                </span>
                <p className="t1 mt-3 text-[15px] font-bold">{s.title}</p>
                <p className="t2 mt-1 text-[13px] leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <div className="thread flex items-start gap-3 rounded-2xl p-4">
              <LockIcon className="accent mt-0.5 h-5 w-5 shrink-0" />
              <p className="t2 text-[13px] leading-relaxed">
                <strong className="t1">Private by design.</strong> No account, no database. Mask
                Aadhaar / PAN / bank numbers before pasting.
              </p>
            </div>
            <div className="thread flex items-start gap-3 rounded-2xl p-4">
              <GlobeIcon className="accent mt-0.5 h-5 w-5 shrink-0" />
              <p className="t2 text-[13px] leading-relaxed">
                <strong className="t1">Read in your language.</strong> Results translate into Hindi,
                Marathi, Tamil, Telugu, Bengali and more — English stays authoritative.
              </p>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────── */}
        <section aria-label="Frequently asked questions">
          <h2 className="t1 text-balance text-xl font-extrabold sm:text-2xl">Questions, answered</h2>
          <div className="mt-3 grid gap-2">
            {FAQS.map((f) => (
              <details key={f.q} className="thread group rounded-2xl px-4 py-3.5">
                <summary className="t1 min-h-[44px] cursor-pointer touch-manipulation text-[15px] font-semibold">
                  {f.q}
                </summary>
                <p className="t2 mt-1 pb-1 text-[13px] leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Final CTA ────────────────────────── */}
        <section className="safe-bottom overflow-hidden rounded-3xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 p-6 text-black sm:p-10">
          <h2 className="max-w-lg text-balance text-2xl font-black leading-tight sm:text-3xl">
            Understand it before you sign it.
          </h2>
          <p className="mt-2 max-w-md text-pretty text-[14px] font-medium leading-relaxed text-black/75 sm:text-[15px]">
            Load a sample contract in one tap, run Risk X-Ray, and see what you&apos;ve been signing.
          </p>
          <div className="mt-5 grid gap-2 sm:flex">
            <Link
              href="/risks"
              className="flex min-h-[52px] touch-manipulation items-center justify-center rounded-2xl bg-black px-6 text-[15px] font-bold text-white"
            >
              Try Risk X-Ray →
            </Link>
            <Link
              href="/simplify"
              className="flex min-h-[52px] touch-manipulation items-center justify-center rounded-2xl border-2 border-black/20 px-6 text-[15px] font-bold"
            >
              Simplify a document
            </Link>
          </div>
        </section>

        {/* ── Footer ───────────────────────────── */}
        <footer className="safe-bottom">
          <div className="disclaimer rounded-2xl px-4 py-3.5 text-[12px] leading-relaxed">
            <strong>Information only, not legal advice.</strong> Consult an advocate before acting.
            Free legal aid: NALSA / DLSA helpline{" "}
            <a href="tel:15100" className="font-bold underline underline-offset-2">
              15100
            </a>
            . ·{" "}
            <Link href="/docs" className="underline underline-offset-2">
              Read the docs
            </Link>
          </div>
          <div className="t3 mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 pb-6 text-[12px]">
            <span className="flex items-center gap-1.5">
              <LogoMark className="h-3.5 w-3.5" /> LexClarity
            </span>
            <Link href="/simplify" className="underline-offset-2 hover:underline">
              Simplify
            </Link>
            <Link href="/ask" className="underline-offset-2 hover:underline">
              Ask
            </Link>
            <Link href="/stamp" className="underline-offset-2 hover:underline">
              Stamp Duty
            </Link>
            <Link href="/docs" className="underline-offset-2 hover:underline">
              Docs
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
