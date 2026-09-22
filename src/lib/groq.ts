import Groq from "groq-sdk";
import type { ActionKind, AnalyzeRequest } from "@/lib/legal";
import { truncate } from "@/lib/legal";
import { normalizeExtractedText, retrieveRelevant } from "@/lib/optimize";

/**
 * Groq Compound integration.
 * Model `groq/compound` is an agentic system (GPT-OSS 120B + Llama 4 Scout
 * with built-in web search, visit-website, code execution) — ideal for
 * grounding legal explanations in current law.
 */

export const COMPOUND_MODEL = "groq/compound";
export const COMPOUND_FALLBACK_MODEL = "groq/compound-mini";

/**
 * Cost controls.
 * - Output tokens cost ~4x input tokens, so each action gets the smallest
 *   output budget that fits its format.
 * - Q&A sends retrieved excerpts (not the whole file) once the document is
 *   long — follow-up questions stay cheap.
 */
const MAX_OUTPUT_TOKENS: Readonly<Record<ActionKind, number>> = {
  simplify: 2500,
  risks: 3500,
  compare: 3500,
  ask: 1800,
  action: 3000,
  playbook: 3000,
  handoff: 3500,
  stamp: 1800,
} as const;

const ASK_FULL_DOC_CHARS = 8_000;
const ASK_RETRIEVAL_CHARS = 12_000;

/** Normalise (de-noise) then hard-cap document text before it reaches the LLM. */
function prepDoc(text: string, max = 60_000): string {
  return truncate(normalizeExtractedText(text), max);
}

const LEGAL_GUARDRAIL = `You are LexClarity, a legal-information assistant specialising in the laws of INDIA. You provide general legal INFORMATION ONLY — never legal advice, never an advocate-client relationship. Rules:
- Always reason from Indian law first: the Constitution of India, Indian Contract Act 1872, Consumer Protection Act 2019, Digital Personal Data Protection Act 2023 (DPDP Act), Information Technology Act 2000, Arbitration and Conciliation Act 1996, Negotiable Instruments Act 1881 (s.138), and the new criminal codes (Bharatiya Nyaya Sanhita / Nagarik Suraksha Sanhita / Sakshya Adhiniyam, 2023) where relevant. Cite statute + section numbers; never invent them — if unsure, say so.
- Flag STATE-LEVEL variation explicitly (stamp duty & registration under state Stamp Acts, e.g. Maharashtra Stamp Act; state rent-control / tenancy laws; police tenant verification norms).
- Use Compound tools (web search / visit website) to verify current Indian position — check india.gov.in, eCourts / district courts, MCA, RBI, SEBI, IRDAI, DPDP Board / MeitY, consumer e-Daakhil, and official state portals.
- Be structured, plain-spoken, and specific to the user's documents. Mention practical Indian remedies where relevant: legal notice, negotiation, consumer commission via e-Daakhil, MSME Facilitation Council, RERA authority, Lok Adalat, and free legal aid via NALSA/DLSA (toll-free 15100) for eligible persons.
- Flag risky, one-sided, or unusual clauses explicitly.
- COST DISCIPLINE: do NOT call web search / visit-website / code execution unless the answer genuinely needs current external facts (statute verification, state-specific procedure, recent amendments). Pure document summarisation must not trigger any tool call.
- Always end with: "This is general information about Indian law, not legal advice. Consider consulting an advocate enrolled with the Bar Council of India in your state."` as const;

type GroqMessage = {
  readonly role: "system" | "user";
  readonly content: string;
};

function readingHint(level: string | undefined): string {
  switch (level) {
    case "plain":
      return "Write at a 6th-grade reading level with short sentences.";
    case "detailed":
      return "Write a thorough professional-grade explanation with numbered sections.";
    default:
      return "Write clearly for a smart non-lawyer.";
  }
}

function jurisdictionHint(j: string | undefined): string {
  const v = j?.trim();
  return v
    ? `User location/context: ${v}. Ground statements in the current law of India as applicable there — including that state's Stamp Act, tenancy law, and forum (district consumer commission / RERA / labour office) — using web search where relevant.`
    : "No state given — apply the law of India generally and explicitly note state-level variations (stamp duty & registration, tenancy law, court fees) the user must confirm for their state.";
}

export function buildMessages(req: AnalyzeRequest): readonly GroqMessage[] {
  const system = `${LEGAL_GUARDRAIL}\n${readingHint(req.readingLevel)}\n${jurisdictionHint(req.jurisdiction)}`;

  switch (req.action) {
    case "simplify":
      return [
        { role: "system", content: system },
        {
          role: "user",
          content: `Simplify this legal document into plain language.

FORMAT (markdown):
## TL;DR (3 bullets)
## What this document says (numbered, plain words)
## Key numbers & dates (table: item | value)
## India-specific implications (stamp duty/registration, TDS/GST, consumer rights under CPA 2019, DPDP Act 2023 for data clauses — as applicable)
## What to watch out for (bullets)
## Jargon buster (term — meaning)

DOCUMENT:
${prepDoc(req.document)}`,
        },
      ];
    case "risks":
      return [
        { role: "system", content: system },
        {
          role: "user",
          content: `Perform a Risk X-Ray on this document. Score each clause High/Medium/Low risk and explain why in one line.

FORMAT (markdown):
## Risk score: X/100 + one-line verdict
## 🔴 High-risk clauses (quote → why it matters → what to ask for)
## 🟡 Medium risks
## 🟢 Favorable / balanced clauses
## Missing protections (what an Indian advocate would add: stamp duty & registration, TDS/GST treatment, DPDP Act compliance, interest on delayed payments under MSMED Act s.16 where relevant, stamp/venue sanity)
## Top 3 negotiation asks (exact wording to request)

DOCUMENT:
${prepDoc(req.document)}`,
        },
      ];
    case "compare":
      return [
        { role: "system", content: system },
        {
          role: "user",
          content: `Compare these two legal documents side-by-side.

FORMAT (markdown):
## Verdict (which is more favorable to the signer + why, 3 bullets)
## Side-by-side table (| Topic | ${req.labelA ?? "Document A"} | ${req.labelB ?? "Document B"} | Winner |)
Topics: payment (incl. TDS/GST), term/termination, IP, confidentiality, non-compete (note: post-employment restraints are generally unenforceable in India per Contract Act s.27 — call this out), liability, indemnity, governing law & seat/venue, dispute resolution (arbitration under the 1996 Act vs courts).
## Key differences (numbered)
## Hidden inconsistencies / contradictions
## Which would you sign? (direct answer + conditions)

DOCUMENT A (${req.labelA ?? "A"}):
${prepDoc(req.documentA, 40_000)}

DOCUMENT B (${req.labelB ?? "B"}):
${prepDoc(req.documentB, 40_000)}`,
        },
      ];
    case "ask": {
      const cleaned = normalizeExtractedText(req.document ?? "");
      const retrieval =
        cleaned.length > ASK_FULL_DOC_CHARS
          ? retrieveRelevant(cleaned, req.question, ASK_RETRIEVAL_CHARS)
          : null;
      const context =
        retrieval !== null
          ? `MOST RELEVANT EXCERPTS FROM THE DOCUMENT (selected automatically — other parts omitted to save cost):\n${retrieval.text}\n`
          : cleaned.length > 0
            ? `CONTEXT DOCUMENT:\n${truncate(cleaned)}\n`
            : "No document provided — answer generally, grounding in current law via web search when needed.";
      return [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            context,
            ...(req.history ?? []).map(
              (t) => `${t.role.toUpperCase()}: ${t.content}`,
            ),
            `USER QUESTION: ${req.question}`,
            "Answer directly, cite the document section if applicable, keep it concise, then give 2-3 follow-up questions the user should consider.",
          ].join("\n\n"),
        },
      ];
    }
    case "action":
      return [
        { role: "system", content: system },
        {
          role: "user",
          content: `Turn this document into an action plan. User goal: ${req.goal?.trim() ? req.goal : "understand obligations and next steps"}.

FORMAT (markdown):
## Your obligations checklist (- [ ] items with deadlines if stated)
## Other party's obligations checklist
## Deadlines & dates table
## Documents / evidence to gather (keep PAN/Aadhaar masked; preserve stamp paper, registered copies, GST invoices, payment UTRs)
## Questions to ask an advocate (8 sharp questions)
## India remedies roadmap (legal notice → negotiation → consumer commission via e-Daakhil / MSME council / RERA / Lok Adalat / NALSA free legal aid where eligible)
## Next steps (numbered, this week)

DOCUMENT:
${prepDoc(req.document)}`,
        },
      ];
    case "playbook":
      return [
        { role: "system", content: system },
        {
          role: "user",
          content: `Check this document against the user's clause playbook (their standard negotiating positions). Judge each position strictly on what the document actually says.

PLAYBOOK POSITIONS:
${req.rules.map((r, n) => `${n + 1}. ${r}`).join("\n")}

FORMAT (markdown):
## Playbook score: X of ${req.rules.length} positions met + one-line verdict
## Results (table: | # | Position | Status | What the document says | Fix |)
Status must be exactly one of: Meets, Partial, Fails, Not addressed. "What the document says" quotes or cites the clause number (or "—" if silent). "Fix" gives exact replacement or addition wording in one or two sentences.
## Deal-breakers (positions marked Fails that carry legal or financial risk under Indian law, with the statute where relevant)
## Redline requests (numbered, ready to paste into an email to the other side)

DOCUMENT:
${prepDoc(req.document)}`,
        },
      ];
    case "handoff":
      return [
        { role: "system", content: system },
        {
          role: "user",
          content: `Prepare a concise advocate handoff brief so an Indian advocate can grasp this matter in five minutes. Write it for the advocate, in neutral professional language, using facts from the document and the client's note only — mark anything assumed as "to confirm".

CLIENT'S NOTE: ${req.situation?.trim() ? req.situation : "none provided"}
${req.specialty ? `LIKELY PRACTICE AREA: ${req.specialty}\n` : ""}
FORMAT (markdown):
## Matter summary (5 lines max: document type, parties, date, value, what the client wants)
## Key facts & timeline (table: Date | Event | Source clause)
## Key terms (table: Term | What it says)
## Top risks (table: Risk | Severity | Why it matters) — Severity is exactly High, Medium or Low
## Legal issues to examine (Indian statutes/sections, forum, limitation period to check)
## Evidence checklist (- [ ] items the client should bring: registered copies, stamp papers, UTRs, GST invoices, emails/WhatsApp exports, notices)
## Sharp questions for the advocate (8 numbered questions)
## Client's desired outcome & constraints

DOCUMENT:
${prepDoc(req.document)}`,
        },
      ];
    case "stamp":
      return [
        { role: "system", content: system },
        {
          role: "user",
          content: `Verify stamp duty and registration charges for a ${req.instrument === "rent" ? "rent / leave & licence agreement" : "sale / conveyance deed"} in ${req.state}, India. An offline calculator produced the estimate below; check it against the CURRENT official rates (state IGR / registration portal, Stamp Act schedule article) using web search, and correct it if it's wrong or outdated.

USER INPUTS & OFFLINE ESTIMATE:
${req.details}

FORMAT (markdown):
## Verdict (Estimate confirmed / Needs correction — one line)
## Current charges (table: Item | Rate / basis | Amount)
## Stamp Act article & registration rule (cite the article, state amendment, and whether registration is compulsory)
## Concessions & surcharges (women buyers, metro cess, LBT, rural areas — as applicable)
## e-Registration steps (numbered, with the official portal link)
## Common mistakes to avoid`,
        },
      ];
  }
}

export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface CompoundResult {
  readonly markdown: string;
  readonly model: string;
  readonly grounded: boolean;
  readonly usage: TokenUsage | undefined;
}

function extractText(
  completion: Groq.Chat.ChatCompletion,
): string | undefined {
  const choice = completion.choices[0];
  const content = choice?.message?.content;
  if (typeof content === "string" && content.trim().length > 0) return content;
  return undefined;
}

function wasGrounded(completion: Groq.Chat.ChatCompletion): boolean {
  const raw = JSON.stringify(completion).toLowerCase();
  return (
    raw.includes("web_search") ||
    raw.includes("executed_tools") ||
    raw.includes("search_results") ||
    raw.includes("visit")
  );
}

/** Call Compound with automatic mini fallback. Throws on failure. */
export async function runCompound(
  req: AnalyzeRequest,
  apiKey: string,
): Promise<CompoundResult> {
  const messages = buildMessages(req).map((m) => ({ ...m }));
  const models: readonly string[] = [COMPOUND_MODEL, COMPOUND_FALLBACK_MODEL];
  let lastError: unknown = undefined;

  for (const model of models) {
    try {
      const client = new Groq({ apiKey });
      const completion = await client.chat.completions.create({
        model,
        messages,
        temperature: req.action === "ask" ? 0.3 : 0.4,
        max_tokens: MAX_OUTPUT_TOKENS[req.action],
      });
      const text = extractText(completion);
      if (text === undefined) {
        lastError = new Error(`Empty response from ${model}`);
        continue;
      }
      const u = completion.usage;
      return {
        markdown: text,
        model,
        grounded: wasGrounded(completion),
        usage:
          u === undefined
            ? undefined
            : {
                promptTokens: u.prompt_tokens,
                completionTokens: u.completion_tokens,
                totalTokens: u.total_tokens,
              },
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Groq Compound request failed");
}

export function resolveApiKey(explicit: string | undefined): string | undefined {
  const v = explicit?.trim() || process.env["GROQ_API_KEY"]?.trim();
  return v && v.length > 0 ? v : undefined;
}

export interface CompoundStreamCallbacks {
  readonly onToken: (delta: string) => void;
  readonly onGrounded?: () => void;
}

function chunkDelta(chunk: unknown): string | undefined {
  if (typeof chunk !== "object" || chunk === null) return undefined;
  const choices = (chunk as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const delta = (choices[0] as { delta?: unknown }).delta;
  if (typeof delta === "string") return delta;
  if (typeof delta === "object" && delta !== null) {
    const content = (delta as { content?: unknown }).content;
    if (typeof content === "string" && content.length > 0) return content;
  }
  return undefined;
}

function chunkLooksGrounded(chunk: unknown): boolean {
  try {
    const raw = JSON.stringify(chunk).toLowerCase();
    return (
      raw.includes("web_search") ||
      raw.includes("executed_tools") ||
      raw.includes("search_results") ||
      raw.includes("tool_calls")
    );
  } catch {
    return false;
  }
}

/**
 * Streaming variant of `runCompound` with the same model fallback.
 * Invokes `onToken` per content delta so callers can forward SSE events
 * as tokens arrive; usage is unavailable on streamed Groq responses.
 */
export async function runCompoundStream(
  req: AnalyzeRequest,
  apiKey: string,
  callbacks: CompoundStreamCallbacks,
): Promise<CompoundResult> {
  const messages = buildMessages(req).map((m) => ({ ...m }));
  const models: readonly string[] = [COMPOUND_MODEL, COMPOUND_FALLBACK_MODEL];
  let lastError: unknown = undefined;

  for (const model of models) {
    try {
      const client = new Groq({ apiKey });
      const stream = await client.chat.completions.create({
        model,
        messages,
        temperature: req.action === "ask" ? 0.3 : 0.4,
        max_tokens: MAX_OUTPUT_TOKENS[req.action],
        stream: true,
      });
      let text = "";
      let grounded = false;
      for await (const chunk of stream) {
        const delta = chunkDelta(chunk);
        if (delta !== undefined) {
          text += delta;
          callbacks.onToken(delta);
        }
        if (!grounded && chunkLooksGrounded(chunk)) {
          grounded = true;
          callbacks.onGrounded?.();
        }
      }
      if (text.trim().length === 0) {
        lastError = new Error(`Empty response from ${model}`);
        continue;
      }
      return { markdown: text, model, grounded, usage: undefined };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Groq Compound request failed");
}
