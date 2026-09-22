/**
 * Same-browser session persistence via IndexedDB.
 *
 * The finished-analysis Library already lives in localStorage, but the *live*
 * session (document text, on-screen results, chat thread, settings) used to
 * vanish on refresh. This store snapshots that session so a reload restores
 * exactly where the user left off. Everything stays on the user's device —
 * the server still stores nothing.
 *
 * All functions are safe to call anywhere: on the server, in browsers without
 * IndexedDB, or in private mode they resolve to a no-op (null / void) instead
 * of throwing.
 */

export interface SessionResult {
  readonly action: string;
  readonly markdown: string;
  readonly model: string;
  readonly grounded: boolean;
}

export interface SessionChatTurn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface SessionSnapshot {
  readonly v: 1;
  readonly savedAt: number;
  readonly doc: string;
  readonly docA: string;
  readonly docB: string;
  readonly labelA: string;
  readonly labelB: string;
  readonly goal: string;
  readonly situation: string;
  readonly specialty: string;
  readonly jurisdiction: string;
  readonly readingLevel: string;
  readonly language: string;
  readonly results: Readonly<Record<string, SessionResult>>;
  readonly history: readonly SessionChatTurn[];
}

const DB_NAME = "lexclarity";
const STORE_NAME = "kv";
const RECORD_KEY = "workspace-v1";

function idb(): IDBFactory | null {
  return typeof indexedDB === "undefined" ? null : indexedDB;
}

function openDb(): Promise<IDBDatabase | null> {
  const factory = idb();
  if (factory === null) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = factory.open(DB_NAME, 1);
      req.onupgradeneeded = (): void => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = (): void => resolve(req.result);
      req.onerror = (): void => resolve(null);
      req.onblocked = (): void => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (db === null) {
          resolve(null);
          return;
        }
        try {
          const request = run(
            db.transaction(STORE_NAME, mode).objectStore(STORE_NAME),
          );
          request.onsuccess = (): void => {
            db.close();
            resolve(request.result ?? null);
          };
          request.onerror = (): void => {
            db.close();
            resolve(null);
          };
        } catch {
          try {
            db.close();
          } catch {
            // Ignore close failures — persistence is best-effort.
          }
          resolve(null);
        }
      }),
  );
}

export function saveSession(snapshot: SessionSnapshot): Promise<void> {
  return tx("readwrite", (store) => store.put(snapshot, RECORD_KEY)).then(() => undefined);
}

export async function loadSession(): Promise<SessionSnapshot | null> {
  const raw = await tx("readonly", (store) => store.get(RECORD_KEY));
  return isSessionSnapshot(raw) ? raw : null;
}

export function clearSession(): Promise<void> {
  return tx("readwrite", (store) => store.delete(RECORD_KEY)).then(() => undefined);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isSessionResult(v: unknown): v is SessionResult {
  if (!isRecord(v)) return false;
  return (
    typeof v["action"] === "string" &&
    typeof v["markdown"] === "string" &&
    typeof v["model"] === "string" &&
    typeof v["grounded"] === "boolean"
  );
}

function isChatTurn(v: unknown): v is SessionChatTurn {
  if (!isRecord(v)) return false;
  return (
    (v["role"] === "user" || v["role"] === "assistant") &&
    typeof v["content"] === "string"
  );
}

/** Strict on shape, lenient on content: unknown enum values fall back at apply time. */
export function isSessionSnapshot(v: unknown): v is SessionSnapshot {
  if (!isRecord(v)) return false;
  const str = (k: string): boolean => typeof v[k] === "string";
  if (v["v"] !== 1 || typeof v["savedAt"] !== "number") return false;
  for (const k of [
    "doc",
    "docA",
    "docB",
    "labelA",
    "labelB",
    "goal",
    "situation",
    "specialty",
    "jurisdiction",
    "readingLevel",
    "language",
  ]) {
    if (!str(k)) return false;
  }
  if (!isRecord(v["results"])) return false;
  for (const r of Object.values(v["results"])) {
    if (!isSessionResult(r)) return false;
  }
  if (!Array.isArray(v["history"])) return false;
  for (const m of v["history"]) {
    if (!isChatTurn(m)) return false;
  }
  return true;
}

/** True when there is nothing worth restoring (fresh/emptied session). */
export function isSnapshotEmpty(s: SessionSnapshot): boolean {
  return (
    s.doc.trim() === "" &&
    s.docA.trim() === "" &&
    s.docB.trim() === "" &&
    s.history.length === 0 &&
    Object.keys(s.results).length === 0
  );
}
