import { z } from "zod";

/** Supported analysis modes — discriminated union drives both API and UI. */
export const ActionKind = z.enum([
  "simplify",
  "risks",
  "compare",
  "ask",
  "action",
  "playbook",
  "handoff",
  "stamp",
]);
export type ActionKind = z.infer<typeof ActionKind>;

export const READING_LEVELS = ["plain", "standard", "detailed"] as const;
export type ReadingLevel = (typeof READING_LEVELS)[number];

/** Shared request fields. */
const baseFields = {
  readingLevel: z.enum(READING_LEVELS).optional(),
  jurisdiction: z.string().max(120).optional(),
  apiKey: z.string().min(1).max(300).optional(),
} as const;

export const SimplifySchema = z.object({
  action: z.literal("simplify"),
  document: z.string().trim().min(20).max(60_000),
  ...baseFields,
});
export type SimplifyRequest = z.infer<typeof SimplifySchema>;

export const RisksSchema = z.object({
  action: z.literal("risks"),
  document: z.string().trim().min(20).max(60_000),
  ...baseFields,
});
export type RisksRequest = z.infer<typeof RisksSchema>;

export const CompareSchema = z.object({
  action: z.literal("compare"),
  documentA: z.string().trim().min(20).max(40_000),
  documentB: z.string().trim().min(20).max(40_000),
  labelA: z.string().max(60).optional(),
  labelB: z.string().max(60).optional(),
  ...baseFields,
});
export type CompareRequest = z.infer<typeof CompareSchema>;

export const AskSchema = z.object({
  action: z.literal("ask"),
  document: z.string().trim().max(60_000).optional(),
  question: z.string().trim().min(3).max(4_000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8_000),
      }),
    )
    .max(20)
    .optional(),
  ...baseFields,
});
export type AskRequest = z.infer<typeof AskSchema>;

export const ActionPlanSchema = z.object({
  action: z.literal("action"),
  document: z.string().trim().min(20).max(60_000),
  goal: z.string().trim().max(500).optional(),
  ...baseFields,
});
export type ActionPlanRequest = z.infer<typeof ActionPlanSchema>;

export const PlaybookSchema = z.object({
  action: z.literal("playbook"),
  document: z.string().trim().min(20).max(60_000),
  rules: z.array(z.string().trim().min(3).max(300)).min(1).max(20),
  ...baseFields,
});
export type PlaybookRequest = z.infer<typeof PlaybookSchema>;

export const HandoffSchema = z.object({
  action: z.literal("handoff"),
  document: z.string().trim().min(20).max(60_000),
  situation: z.string().trim().max(2_000).optional(),
  specialty: z.string().trim().max(60).optional(),
  ...baseFields,
});
export type HandoffRequest = z.infer<typeof HandoffSchema>;

export const StampSchema = z.object({
  action: z.literal("stamp"),
  state: z.string().trim().min(2).max(60),
  instrument: z.enum(["rent", "sale"]),
  /** The user's inputs and the offline estimate, as plain text. */
  details: z.string().trim().min(10).max(2_000),
  ...baseFields,
});
export type StampRequest = z.infer<typeof StampSchema>;

export const AnalyzeRequestSchema = z.discriminatedUnion("action", [
  SimplifySchema,
  RisksSchema,
  CompareSchema,
  AskSchema,
  ActionPlanSchema,
  PlaybookSchema,
  HandoffSchema,
  StampSchema,
]);
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const AnalyzeResponseSchema = z.object({
  action: ActionKind,
  markdown: z.string(),
  model: z.string(),
  grounded: z.boolean(),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

/** Human names for each action, shared by the studio, reports and share view. */
export const ACTION_LABELS: Readonly<Record<ActionKind, string>> = {
  simplify: "Simplify",
  risks: "Risk X-Ray",
  compare: "Compare",
  ask: "Ask",
  action: "Action Plan",
  playbook: "Playbook Check",
  handoff: "Advocate Brief",
  stamp: "Stamp Duty",
};

export interface ChatTurn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export const MAX_DOC_CHARS = 60_000;

/** PDF upload guardrails (mirrored server-side). */
export const MAX_PDF_BYTES = 12 * 1024 * 1024;
export const MAX_PDF_PAGES = 40;

/** .docx upload guardrail (mirrored server-side). */
export const MAX_DOCX_BYTES = 12 * 1024 * 1024;

export interface ExtractPdfResponse {
  readonly text: string;
  /** Page count for PDFs; .docx has no pages, so null. */
  readonly pages: number | null;
  readonly fileName: string;
  readonly truncated: boolean;
}

export function truncate(text: string, max = MAX_DOC_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[TRUNCATED — pasted document exceeded ${max} characters]`;
}

/** Demo documents so judges can try the app in one click. */
export interface SampleDoc {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly body: string;
}

export const SAMPLE_DOCS: readonly SampleDoc[] = [
  {
    id: "freelance",
    title: "Freelance Services Agreement (India)",
    kind: "Contract",
    body: `FREELANCE SERVICES AGREEMENT

1. SERVICES. Contractor shall provide UI design services as described in Annexure A.
2. PAYMENT. Client shall pay Rs. 85,000 within 30 days of invoice, subject to TDS deduction under the Income-tax Act, 1961 as applicable. Late payments incur interest of 1.5% per month.
3. GST. Contractor shall raise a GST-compliant invoice; GST at applicable rates shall be charged extra where registration applies.
4. TERM & TERMINATION. Either party may terminate with 14 days written notice. Upon termination, Client pays for work completed on a pro-rata basis.
5. INTELLECTUAL PROPERTY. All work product assigns to Client upon full payment. Contractor retains no rights after payment.
6. CONFIDENTIALITY. Contractor agrees not to disclose Client confidential information for 2 years.
7. NON-COMPETE. Contractor shall not provide similar services to any competitor of Client for 12 months after termination, anywhere in India.
8. LIABILITY. Contractor's total liability is capped at fees paid. Contractor is not liable for indirect damages.
9. INDEMNIFICATION. Contractor shall indemnify Client against all claims arising from Contractor's work, without limitation.
10. GOVERNING LAW. This agreement is governed by the laws of India. Courts at Bengaluru, Karnataka shall have jurisdiction.
11. ARBITRATION. All disputes shall be resolved by a sole arbitrator under the Arbitration and Conciliation Act, 1996, seated in Bengaluru, with proceedings in English.`,
  },
  {
    id: "rental",
    title: "Leave & Licence / Rent Agreement — Excerpt",
    kind: "Rent Agreement",
    body: `LEAVE AND LICENCE AGREEMENT (EXCERPT) — PUNE, MAHARASHTRA

LICENCE FEE: Rs. 18,500/month due on the 5th of each month via bank transfer. Late payment attracts Rs. 200/day.
SECURITY DEPOSIT: Rs. 55,500 (3 months) refundable within 30 days of handover, less documented damages beyond normal wear.
TERM: 11 months from 1 October 2026. Renewal only by fresh written agreement.
STAMP DUTY & REGISTRATION: To be shared equally; agreement to be registered under the Maharashtra Stamp Act and the Registration Act, 1908.
POLICE VERIFICATION: Licensee shall cooperate with tenant police verification as required by local authorities.
TDS ON RENT: Licensor/Licensee to comply with TDS provisions under Section 194-I of the Income-tax Act where applicable (rent exceeding Rs. 50,000/month: Section 194-IB compliance by tenant).
MAINTENANCE: Licensee bears repairs up to Rs. 2,000 per incident; structural repairs by Licensor. Society maintenance paid by Licensor.
LOCK-IN & EARLY EXIT: 6-month lock-in. Early exit during lock-in requires 2 months' licence fee as compensation plus notice of 30 days.
SUB-LETTING: Not permitted without prior written consent.
JURISDICTION: Courts at Pune, Maharashtra.`,
  },
  {
    id: "saas",
    title: "SaaS Terms of Service — Excerpt (India)",
    kind: "ToS",
    body: `SAAS TERMS OF SERVICE (EXCERPT)

1. LICENCE. Provider grants a non-exclusive, non-transferable subscription to use the platform within India.
2. AUTO-RENEWAL. Subscriptions auto-renew for successive 12-month terms unless cancelled 60 days before renewal. No refunds for unused periods.
3. PRICE & TAXES. Fees are exclusive of GST; 18% GST (or applicable rate) is charged extra with GST invoices. Provider may revise fees with 30 days' email notice.
4. DATA & PRIVACY. Provider processes personal data per its Privacy Notice and the Digital Personal Data Protection Act, 2023. Customer data is stored in India-region servers; aggregated, de-identified data may be used for analytics.
5. UPTIME. Target 99% monthly uptime; service credits apply only if downtime exceeds 24 consecutive hours and is claimed within 15 days.
6. GRIEVANCE REDRESSAL. Grievance Officer details published per applicable IT Rules; complaints acknowledged within 48 hours.
7. LIMITATION OF LIABILITY. To the maximum extent permitted under Indian law, Provider disclaims implied warranties and limits liability to 3 months of fees paid.
8. TERMINATION. Provider may suspend or terminate for breach with 15 days' cure notice; for convenience with 30 days' notice.
9. GOVERNING LAW & VENUE. Governed by the laws of India; exclusive jurisdiction of courts at Bengaluru, Karnataka. Disputes may alternatively be referred to arbitration under the Arbitration and Conciliation Act, 1996 at Provider's option.`,
  },
] as const;
