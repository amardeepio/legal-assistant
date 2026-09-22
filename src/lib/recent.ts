import type { ActionKind } from "@/lib/legal";

/** Browser-only persistence: saved library, disclaimer consent, tour progress. */

/** A finished analysis, kept in the library so a refresh doesn't lose work. */
export interface RecentItem {
  readonly id: string;
  readonly action: Exclude<ActionKind, "ask">;
  readonly title: string;
  readonly createdAt: number;
  readonly markdown: string;
  readonly model: string;
  readonly grounded: boolean;
  /** Pinned items are never evicted when the library is full. */
  readonly pinned?: boolean;
  readonly jurisdiction?: string;
}

export const RECENT_KEY = "lexclarity-recent";
export const RECENT_LIMIT = 50;
export const DISCLAIMER_KEY = "lexclarity-disclaimer-ok";
export const TOUR_KEY = "lexclarity-tour-done";

const ACTIONS: readonly string[] = [
  "simplify",
  "risks",
  "compare",
  "action",
  "playbook",
  "handoff",
  "stamp",
];

function isRecentItem(v: unknown): v is RecentItem {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r["id"] === "string" &&
    typeof r["action"] === "string" &&
    ACTIONS.includes(r["action"]) &&
    typeof r["title"] === "string" &&
    typeof r["createdAt"] === "number" &&
    typeof r["markdown"] === "string" &&
    typeof r["model"] === "string" &&
    typeof r["grounded"] === "boolean" &&
    (r["pinned"] === undefined || typeof r["pinned"] === "boolean") &&
    (r["jurisdiction"] === undefined || typeof r["jurisdiction"] === "string")
  );
}

export function loadRecent(): readonly RecentItem[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentItem) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: readonly RecentItem[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked — the in-memory result still works.
  }
}

/** Keeps every pinned item, then the newest unpinned ones up to the limit. */
function cap(list: readonly RecentItem[]): readonly RecentItem[] {
  let room = Math.max(0, RECENT_LIMIT - list.filter((r) => r.pinned === true).length);
  return list.filter((r) => {
    if (r.pinned === true) return true;
    room -= 1;
    return room >= 0;
  });
}

/** Prepends `item`, dedupes identical results, caps the list; returns the new list. */
export function saveRecent(item: RecentItem): readonly RecentItem[] {
  const next = cap([
    item,
    ...loadRecent().filter(
      (r) => !(r.action === item.action && r.markdown === item.markdown),
    ),
  ]);
  writeRecent(next);
  return next;
}

export function removeRecent(id: string): readonly RecentItem[] {
  const next = loadRecent().filter((r) => r.id !== id);
  writeRecent(next);
  return next;
}

export function togglePinRecent(id: string): readonly RecentItem[] {
  const next = loadRecent().map((r) =>
    r.id === id ? { ...r, pinned: r.pinned !== true } : r,
  );
  writeRecent(next);
  return next;
}

export function renameRecent(id: string, title: string): readonly RecentItem[] {
  const clean = title.trim().slice(0, 120);
  if (clean === "") return loadRecent();
  const next = loadRecent().map((r) => (r.id === id ? { ...r, title: clean } : r));
  writeRecent(next);
  return next;
}

/** Pinned first, then newest; optional case-insensitive title/content filter. */
export function filterLibrary(
  list: readonly RecentItem[],
  query: string,
): readonly RecentItem[] {
  const q = query.trim().toLowerCase();
  return [...list]
    .filter(
      (r) =>
        q === "" ||
        r.title.toLowerCase().includes(q) ||
        r.markdown.toLowerCase().includes(q),
    )
    .sort(
      (a, b) =>
        Number(b.pinned === true) - Number(a.pinned === true) ||
        b.createdAt - a.createdAt,
    );
}

/** A short human title from the document's first meaningful line. */
export function titleFrom(text: string, fallback: string): string {
  const line = text
    .split("\n")
    .map((l) => l.replaceAll(/[=\-_*#|]+/g, " ").trim())
    .find((l) => l.length >= 4);
  if (line === undefined) return fallback;
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
}

export function disclaimerAccepted(): boolean {
  try {
    return window.localStorage.getItem(DISCLAIMER_KEY) === "1";
  } catch {
    return true;
  }
}

export function acceptDisclaimer(): void {
  try {
    window.localStorage.setItem(DISCLAIMER_KEY, "1");
  } catch {
    // Blocked storage: the notice simply shows again next visit.
  }
}

export function tourCompleted(): boolean {
  try {
    return window.localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true;
  }
}

export function completeTour(): void {
  try {
    window.localStorage.setItem(TOUR_KEY, "1");
  } catch {
    // Blocked storage: the tour may offer itself again next visit.
  }
}
