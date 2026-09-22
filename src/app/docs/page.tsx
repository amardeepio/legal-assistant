import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  ChatIcon,
  ChecklistIcon,
  ClipboardCheckIcon,
  ColumnsIcon,
  ShieldIcon,
  SparkIcon,
  StampIcon,
} from "@/components/icons";
import { MAX_DOC_CHARS, MAX_PDF_BYTES, MAX_PDF_PAGES } from "@/lib/legal";
import { RECENT_LIMIT } from "@/lib/recent";
import { LANGUAGES } from "@/lib/translate";

export const metadata: Metadata = {
  title: "Docs — LexClarity",
  description:
    "How to use LexClarity: the eight tools, uploading documents, reading results, translation, exports, privacy and limits.",
};

const SECTIONS = [
  { id: "getting-started", label: "Getting started" },
  { id: "tools", label: "The eight tools" },
  { id: "documents", label: "Adding documents" },
  { id: "settings", label: "Location, reading level & language" },
  { id: "results", label: "Reading your results" },
  { id: "export", label: "Export, Library & sharing" },
  { id: "shortcuts", label: "Keyboard shortcuts" },
  { id: "privacy", label: "Privacy & data" },
  { id: "limits", label: "Limits" },
  { id: "faq", label: "FAQ" },
  { id: "legal", label: "Legal disclaimer & free legal aid" },
] as const;

const TOOLS = [
  {
    Icon: SparkIcon,
    name: "Simplify",
    use: "You received a contract, notice or policy and want to know what it says.",
    get: "A TL;DR, a plain-language walkthrough, a table of key numbers and dates, India-specific implications (stamp duty, TDS/GST, consumer and data-protection law) and a jargon buster.",
  },
  {
    Icon: ShieldIcon,
    name: "Risk X-Ray",
    use: "You're about to sign and want to know what could hurt you.",
    get: "A 0–100 risk score, clauses grouped as High / Medium / Low with reasons, protections that are missing, and the exact wording to ask for in negotiation.",
  },
  {
    Icon: ColumnsIcon,
    name: "Compare",
    use: "You have two versions or two competing offers.",
    get: "A verdict on which is better for you, a side-by-side table (payment, termination, IP, non-compete, liability, disputes), key differences and contradictions. Switch to Redline for an instant word-by-word track-changes view of two versions — no AI call, nothing leaves your browser.",
  },
  {
    Icon: ClipboardCheckIcon,
    name: "Playbook",
    use: "You have standard positions (\"liability must be mutual and capped\") and want every contract checked against them.",
    get: "A score, a table marking each position Meets / Partial / Fails / Not addressed with the clause it relies on, deal-breakers, and ready-to-send redline requests. Your playbook is saved in this browser.",
  },
  {
    Icon: ChatIcon,
    name: "Ask",
    use: "You have a specific question, with or without a document.",
    get: "A direct answer that cites the relevant section of your document or Indian law, plus follow-up questions worth asking. Earlier messages in the chat are taken into account.",
  },
  {
    Icon: ChecklistIcon,
    name: "Action Plan",
    use: "You've signed (or are in a dispute) and need to know what to do next.",
    get: "Checklists of your and the other party's obligations, a deadlines table, evidence to gather, questions for an advocate, and a step-by-step remedies roadmap.",
  },
  {
    Icon: BriefcaseIcon,
    name: "Advocate Brief",
    use: "You're about to hand the matter to a lawyer and want them up to speed in five minutes.",
    get: "A one-click PDF brief — matter summary, timeline, key terms, top risks, legal issues, evidence checklist and sharp questions — plus links to find an advocate by practice area and city, NALSA/DLSA free legal aid, Tele-Law and Bar Council verification.",
  },
  {
    Icon: StampIcon,
    name: "Stamp Duty",
    use: "You're registering a rent agreement or buying property and need to budget government charges.",
    get: "An instant offline estimate of stamp duty and registration fees (e.g. Maharashtra Article 36A leave & licence), whether registration is compulsory, e-registration steps with the official portal, and a live check of current rates.",
  },
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section id={id} className="panel scroll-mt-24 rounded-3xl p-5 sm:p-7">
      <h2 className="t1 text-lg font-bold">{title}</h2>
      <div className="docs-body t2 mt-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Kbd({ children }: { children: ReactNode }): ReactNode {
  return (
    <kbd className="chip rounded-md px-1.5 py-0.5 font-sans text-[11px] font-semibold">
      {children}
    </kbd>
  );
}

export default function DocsPage(): ReactNode {
  const languages = LANGUAGES.filter((l) => l.code !== "en")
    .map((l) => l.label.split("·")[1]?.trim() ?? l.label)
    .join(", ");

  return (
    <div className="min-h-screen">
      <header className="nav sticky top-0 z-20 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-black">
              <LogoMark className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-widest">LEXCLARITY</span>
              <span className="t3 block text-[11px]">Docs</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="chip flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              Back to app
            </Link>
            <ThemeToggle />
          </div>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-orange-500 via-amber-200 to-green-500" />
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="max-w-2xl pt-8">
          <p className="accent text-[11px] font-bold uppercase tracking-[0.2em]">
            Documentation
          </p>
          <h1 className="mt-1 text-3xl font-black leading-tight">How to use LexClarity</h1>
          <p className="t2 mt-2 text-sm leading-relaxed">
            Everything you need to understand a legal document, spot its risks and
            prepare for a conversation with an advocate.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
          <nav
            aria-label="On this page"
            className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] lg:sticky lg:top-24 lg:flex-col lg:overflow-visible"
          >
            <p className="t3 hidden px-3 pb-1 text-[11px] font-bold uppercase tracking-wider lg:block">
              On this page
            </p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="chip shrink-0 rounded-full px-3 py-1 text-xs font-medium lg:rounded-lg lg:border-transparent lg:bg-transparent lg:py-1.5"
              >
                {s.label}
              </a>
            ))}
          </nav>

          <main className="grid min-w-0 gap-4">
            <Section id="getting-started" title="Getting started">
              <ol>
                <li>
                  <strong>Pick a tool</strong> from the home page or the sidebar: Simplify, Risk X-Ray,
                  Compare, Ask or Action Plan.
                </li>
                <li>
                  <strong>Set your location.</strong> Stamp duty, registration and
                  tenancy rules differ by state, so answers are more accurate when
                  LexClarity knows where you are.
                </li>
                <li>
                  <strong>Add your document.</strong> Paste the text, upload or drop a
                  PDF, or load a sample to try things out.
                </li>
                <li>
                  <strong>Run it</strong> and read the result. Answers that need live
                  legal research take a little longer. Fair-use limits apply per
                  visitor — if you&apos;re asked to wait, use Retry after a moment.
                </li>
                <li>
                  <strong>Export</strong> the result or come back to it later from{" "}
                  your <em>Library</em>. Accidentally refreshed? Your session is
                  restored automatically.
                </li>
              </ol>
              <p>
                First time here? Use the <strong>?</strong> button in the top bar of the
                app to replay the product tour at any time.
              </p>
            </Section>

            <Section id="tools" title="The eight tools">
              <div className="grid gap-3 sm:grid-cols-2">
                {TOOLS.map((t) => (
                  <div key={t.name} className="thread rounded-2xl p-4">
                    <p className="t1 flex items-center gap-2 text-sm font-bold">
                      <t.Icon className="accent h-4 w-4" />
                      {t.name}
                    </p>
                    <p className="t3 mt-2 text-[11px] font-bold uppercase tracking-wider">
                      Use it when
                    </p>
                    <p className="t2 text-xs leading-relaxed">{t.use}</p>
                    <p className="t3 mt-2 text-[11px] font-bold uppercase tracking-wider">
                      You get
                    </p>
                    <p className="t2 text-xs leading-relaxed">{t.get}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="documents" title="Adding documents">
              <ul>
                <li>
                  <strong>Paste</strong> text straight into the document box.
                </li>
                <li>
                  <strong>Upload or drag and drop</strong> a <code>.pdf</code>,{" "}
                  <code>.txt</code> or <code>.md</code> file. PDFs are converted to text,
                  and page numbers and repeated headers are removed. A card shows the
                  file name and page count.
                </li>
                <li>
                  <strong>Review the extracted text</strong> before running. PDF
                  extraction can mangle tables or columns, and you can edit the text
                  freely.
                </li>
                <li>
                  <strong>Scanned PDFs</strong> (photos of paper) contain no text to
                  extract. Use your phone&apos;s &quot;copy text from image&quot; feature
                  or an OCR app, then paste the text.
                </li>
                <li>
                  In <strong>Compare</strong>, each document has its own box, upload
                  button and editable name, and the names appear in the comparison
                  table.
                </li>
                <li>
                  In <strong>Ask</strong>, attaching a document is optional. Open{" "}
                  <em>Context document</em> above the chat to add one.
                </li>
              </ul>
            </Section>

            <Section id="settings" title="Location, reading level & language">
              <ul>
                <li>
                  <strong>Location</strong>: start typing a state, UT or city. With no
                  location, answers cover India generally and point out where state
                  rules may differ.
                </li>
                <li>
                  <strong>Reading level</strong>: <em>Plain</em> uses short, simple
                  sentences; <em>Standard</em> is written for a smart non-lawyer;{" "}
                  <em>Detailed</em> is thorough and closer to professional notes.
                </li>
                <li>
                  <strong>Output language</strong>: results and chat replies can be
                  translated into {languages}. Use <em>Show English</em> to compare
                  against the original, which is always the authoritative version.
                </li>
              </ul>
              <p>On phones, these settings sit behind the <em>Settings</em> button.</p>
            </Section>

            <Section id="results" title="Reading your results">
              <ul>
                <li>
                  <strong>Web-verified</strong> means live sources were checked while
                  writing the answer. Its absence doesn&apos;t make an answer wrong. It
                  just came from the model&apos;s own knowledge and your document.
                </li>
                <li>
                  <strong>Jump to</strong> chips at the top of long results take you
                  straight to a section.
                </li>
                <li>
                  <strong>Severity labels</strong> in Risk X-Ray:{" "}
                  <span className="sev-pill sev-high">High</span> could cost you money
                  or rights and needs attention before signing;{" "}
                  <span className="sev-pill sev-medium">Medium</span> is worth
                  negotiating; <span className="sev-pill sev-low">Low</span> is
                  balanced or in your favour.
                </li>
                <li>
                  <strong>Sources</strong> lists every link cited in the answer. Open
                  them to confirm the law yourself, especially for recent amendments.
                </li>
                <li>
                  If something fails, the message explains what happened. When trying
                  again could help, a <strong>Retry</strong> button appears.
                </li>
              </ul>
            </Section>

            <Section id="export" title="Export, Library & sharing">
              <ul>
                <li>
                  <strong>Export → Copy text</strong> copies the result as markdown,
                  ready for email or notes.
                </li>
                <li>
                  <strong>Export → Download .md</strong> saves a markdown file in the
                  language you&apos;re viewing.
                </li>
                <li>
                  <strong>Export → Save as PDF</strong> opens your browser&apos;s print
                  dialog; choose <em>Save as PDF</em>. Indian scripts print correctly.
                </li>
                <li>
                  <strong>Export → Full report (.md)</strong> combines every tool you ran
                  on this document into one report, advocate brief first.
                </li>
                <li>
                  <strong>Export → Copy read-only link</strong> creates a link to the
                  full report for a co-founder or family member. The report is packed
                  into the part of the link after <code>#</code>, which browsers never
                  send to a server, so nothing is stored by LexClarity — but anyone with
                  the link can read it, so share it carefully.
                </li>
                <li>
                  <strong>Library</strong> (top bar) keeps your last {RECENT_LIMIT}{" "}
                  analyses in this browser, plus anything you pin. Search, rename,
                  download, share or delete them. Chat threads aren&apos;t kept in
                  the Library, but your current session — document, results and
                  chat — is restored if you refresh.
                </li>
              </ul>
            </Section>

            <Section id="shortcuts" title="Keyboard shortcuts">
              <div className="overflow-x-auto">
                <table className="docs-table w-full text-left text-sm">
                  <tbody>
                    {(
                      [
                        [<><Kbd>Ctrl</Kbd> / <Kbd>⌘</Kbd> + <Kbd>Enter</Kbd></>, "Run the current tool"],
                        [<Kbd key="e">Enter</Kbd>, "Send a chat question"],
                        [<Kbd key="esc">Esc</Kbd>, "Close menus or the product tour"],
                        [<><Kbd>←</Kbd> <Kbd>→</Kbd></>, "Previous / next step during the tour"],
                      ] as const
                    ).map(([keys, action]) => (
                      <tr key={action}>
                        <td className="whitespace-nowrap py-2 pr-4">{keys}</td>
                        <td className="t2 py-2">{action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="privacy" title="Privacy & data">
              <ul>
                <li>
                  LexClarity <strong>does not store your documents</strong> on its
                  servers. There is no account and no database.
                </li>
                <li>
                  To produce an answer, your text is sent to{" "}
                  <strong>Groq</strong> (the AI model provider). When you choose a
                  language other than English, the result is also sent to{" "}
                  <strong>Google Cloud Translation</strong>. Their own data policies
                  apply.
                </li>
                <li>
                  Your <strong>Library</strong>, playbook, theme and disclaimer/tour choices
                  are saved only in your browser&apos;s local storage. Your live
                  session (document, results, chat) is saved in your browser&apos;s
                  IndexedDB so a refresh restores it — use <em>Start fresh</em> in
                  the restore notice to wipe it. Clearing site data
                  removes everything.
                </li>
                <li>
                  <strong>Mask sensitive numbers</strong> (Aadhaar, PAN, bank accounts)
                  before pasting. The analysis doesn&apos;t need them.
                </li>
              </ul>
            </Section>

            <Section id="limits" title="Limits">
              <div className="overflow-x-auto">
                <table className="docs-table w-full text-left text-sm">
                  <tbody>
                    {(
                      [
                        ["Document length", `${(MAX_DOC_CHARS / 1000).toFixed(0)}k characters per document (roughly 25–30 pages of text)`],
                        ["PDF size", `${MAX_PDF_BYTES / (1024 * 1024)} MB and the first ${MAX_PDF_PAGES} pages`],
                        ["File types", ".pdf (text-based), .txt, .md"],
                        ["Long documents in Ask", "Only the passages most relevant to your question are used, which keeps answers focused and fast"],
                        ["Library", `Last ${RECENT_LIMIT} analyses plus pinned items, in this browser only`],
                        ["Fair use", "To keep the service free for everyone, analyses are limited per visitor (a few per minute, dozens per hour). If you hit the limit, wait a moment and use Retry."],
                      ] as const
                    ).map(([k, v]) => (
                      <tr key={k}>
                        <td className="t1 whitespace-nowrap py-2 pr-4 font-semibold">{k}</td>
                        <td className="t2 py-2">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="faq" title="FAQ">
              <div className="grid gap-2">
                {(
                  [
                    [
                      "Can I rely on this instead of a lawyer?",
                      "No. LexClarity helps you understand a document and prepare better questions, but it can make mistakes and can't see the full facts of your situation. For anything that matters, speak to an advocate.",
                    ],
                    [
                      "Why does my PDF show no text?",
                      "It's probably a scan: an image of text, not real text. Copy the text using an OCR app and paste it in.",
                    ],
                    [
                      "The answer mentions a section of an Act. Is it correct?",
                      "Usually, but always check. Open the cited link under Sources, or search the Act on India Code (indiacode.nic.in).",
                    ],
                    [
                      "Why is the translation slightly different from the English?",
                      "Machine translation can shift the meaning of legal terms. The English version is authoritative; use Show English to check important points.",
                    ],
                    [
                      "Where did my old results go?",
                      "The Library is stored per browser. A different device, a private window or clearing site data will show an empty list.",
                    ],
                  ] as const
                ).map(([q, a]) => (
                  <details key={q} className="thread group rounded-2xl px-4 py-3">
                    <summary className="t1 cursor-pointer text-sm font-semibold">{q}</summary>
                    <p className="t2 mt-2 text-sm leading-relaxed">{a}</p>
                  </details>
                ))}
              </div>
            </Section>

            <Section id="legal" title="Legal disclaimer & free legal aid">
              <p>
                LexClarity provides <strong>general legal information, not legal
                advice</strong>. Using it does not create an advocate–client
                relationship. Laws change and vary by state, so verify anything
                important and consult an advocate enrolled with the Bar Council of
                India before acting.
              </p>
              <p>
                If you can&apos;t afford a lawyer, you may be eligible for{" "}
                <strong>free legal aid</strong> through the National Legal Services
                Authority (NALSA) and your District Legal Services Authority (DLSA).
                Call the toll-free helpline <strong>15100</strong>.
              </p>
            </Section>

            <div className="flex justify-center pt-2">
              <Link href="/" className="btn-gold rounded-2xl px-5 py-3 text-sm">
                Open LexClarity →
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
