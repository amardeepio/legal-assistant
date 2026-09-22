"use client";

import type { ActionKind } from "@/lib/legal";

export interface ToolMeta {
  readonly id: ActionKind;
  readonly href: string;
  readonly label: string;
  readonly blurb: string;
  readonly headline: string;
  readonly sub: string;
}

export const TOOLS: readonly ToolMeta[] = [
  {
    id: "simplify",
    href: "/simplify",
    label: "Simplify",
    blurb: "Plain-language summary",
    headline: "Simplify",
    sub: "Plain-language summary of your document.",
  },
  {
    id: "risks",
    href: "/risks",
    label: "Risk X-Ray",
    blurb: "Clauses & red flags",
    headline: "Risk X-Ray",
    sub: "Clauses, risk score and missing protections.",
  },
  {
    id: "playbook",
    href: "/playbook",
    label: "Playbook",
    blurb: "Check your positions",
    headline: "Playbook",
    sub: "Check the document against your standard positions.",
  },
  {
    id: "compare",
    href: "/compare",
    label: "Compare",
    blurb: "A vs B side-by-side",
    headline: "Compare",
    sub: "AI verdict plus an instant word-level redline.",
  },
  {
    id: "ask",
    href: "/ask",
    label: "Ask",
    blurb: "Q&A grounded in docs",
    headline: "Ask",
    sub: "Questions answered from your document and Indian law.",
  },
  {
    id: "action",
    href: "/action",
    label: "Action Plan",
    blurb: "Checklists & next steps",
    headline: "Action Plan",
    sub: "Obligations, deadlines and next steps.",
  },
  {
    id: "handoff",
    href: "/handoff",
    label: "Advocate Brief",
    blurb: "Handoff packet & finder",
    headline: "Advocate Brief",
    sub: "Handoff packet for your advocate.",
  },
  {
    id: "stamp",
    href: "/stamp",
    label: "Stamp Duty",
    blurb: "Duty & registration fees",
    headline: "Stamp Duty",
    sub: "Offline estimate, verified with live sources.",
  },
];

export function toolMeta(id: ActionKind): ToolMeta {
  const found = TOOLS.find((t) => t.id === id);
  if (found === undefined) throw new Error(`Unknown tool: ${id}`);
  return found;
}
