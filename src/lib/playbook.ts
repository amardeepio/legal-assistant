/** Clause playbook: the user's standard positions, kept in this browser. */

export interface PlaybookRule {
  readonly id: string;
  readonly text: string;
  readonly enabled: boolean;
}

export const PLAYBOOK_KEY = "lexclarity-playbook";
export const MAX_RULES = 20;
export const MAX_RULE_CHARS = 300;

export const DEFAULT_RULES: readonly PlaybookRule[] = [
  { id: "liability", text: "Liability must be mutual and capped (e.g. at fees paid in the last 12 months).", enabled: true },
  { id: "indemnity", text: "Indemnities must be mutual and limited to third-party claims caused by the indemnifying party.", enabled: true },
  { id: "payment", text: "Payment within 30 days of invoice, with interest on late payment.", enabled: true },
  { id: "noncompete", text: "No post-termination non-compete (void under s.27, Indian Contract Act).", enabled: true },
  { id: "termination", text: "Either party can terminate for convenience on no more than 30 days' notice.", enabled: true },
  { id: "disputes", text: "Disputes go to arbitration or courts in my city, not the other party's.", enabled: true },
  { id: "ip", text: "IP transfers only after full payment; I keep pre-existing IP and portfolio rights.", enabled: false },
  { id: "data", text: "Personal data is handled in line with the DPDP Act, 2023, with breach notification.", enabled: false },
];

function isRule(v: unknown): v is PlaybookRule {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r["id"] === "string" &&
    typeof r["text"] === "string" &&
    typeof r["enabled"] === "boolean"
  );
}

/** Parses stored JSON; anything missing or corrupt falls back to the defaults. */
export function parsePlaybook(raw: string | null): readonly PlaybookRule[] {
  if (raw === null) return DEFAULT_RULES;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRule).slice(0, MAX_RULES) : DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}

/** Raw stored string — a stable snapshot for useSyncExternalStore. */
export function readPlaybookRaw(): string | null {
  try {
    return window.localStorage.getItem(PLAYBOOK_KEY);
  } catch {
    return null;
  }
}

export function loadPlaybook(): readonly PlaybookRule[] {
  return parsePlaybook(readPlaybookRaw());
}

export function savePlaybook(rules: readonly PlaybookRule[]): void {
  try {
    window.localStorage.setItem(PLAYBOOK_KEY, JSON.stringify(rules.slice(0, MAX_RULES)));
  } catch {
    // Blocked storage: the edited playbook still works for this session.
  }
}

/** Rules worth sending: enabled, non-empty, trimmed. */
export function activeRules(rules: readonly PlaybookRule[]): readonly string[] {
  return rules
    .filter((r) => r.enabled && r.text.trim() !== "")
    .map((r) => r.text.trim().slice(0, MAX_RULE_CHARS));
}
