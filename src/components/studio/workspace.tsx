"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { DragEvent, ReactNode } from "react";
import type { ActionKind, ChatTurn, ReadingLevel } from "@/lib/legal";
import type { ExtractPdfResponse } from "@/lib/legal";
import { MAX_DOC_CHARS, MAX_PDF_BYTES, READING_LEVELS, SAMPLE_DOCS } from "@/lib/legal";
import type { PlaybookRule } from "@/lib/playbook";
import {
  activeRules,
  parsePlaybook,
  readPlaybookRaw,
  savePlaybook,
} from "@/lib/playbook";
import { diffWords } from "@/lib/diff";
import type { Report } from "@/lib/report";
import {
  buildReportMarkdown,
  encodeReport,
  reportFileName,
  shareUrl,
} from "@/lib/report";
import { findSpecialty, SPECIALTIES } from "@/lib/advocate";
import type { LanguageCode } from "@/lib/translate";
import {
  LANGUAGES,
  LanguageCode as LanguageCodeSchema,
  TranslationTarget as TranslationTargetEnum,
  cacheKey,
  translateTexts,
} from "@/lib/translate";
import type { RecentItem } from "@/lib/recent";
import {
  acceptDisclaimer,
  completeTour,
  disclaimerAccepted,
  loadRecent,
  saveRecent,
  titleFrom,
  tourCompleted,
} from "@/lib/recent";
import type { StampVerifyRequest } from "@/components/stamp-duty-panel";
import {
  clearSession,
  isSnapshotEmpty,
  loadSession,
  saveSession,
} from "@/lib/session-store";
import type { SessionSnapshot } from "@/lib/session-store";

export type CompareView = "ai" | "redline";
export type DropTarget = "single" | "a" | "b";

export interface AnalyzeOk {
  readonly action: Exclude<ActionKind, "ask">;
  readonly markdown: string;
  readonly model: string;
  readonly grounded: boolean;
}

export type Results = Partial<Record<Exclude<ActionKind, "ask">, AnalyzeOk>>;

export interface FileInfo {
  readonly name: string;
  readonly pages: number | null;
  readonly truncated: boolean;
}

function isAnalyzeOk(value: unknown): value is AnalyzeOk {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["markdown"] === "string" &&
    typeof v["model"] === "string" &&
    typeof v["grounded"] === "boolean"
  );
}

function isExtractPdfOk(value: unknown): value is ExtractPdfResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["text"] === "string" &&
    (typeof v["pages"] === "number" || v["pages"] === null) &&
    typeof v["fileName"] === "string" &&
    typeof v["truncated"] === "boolean"
  );
}

async function readTextFile(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = (): void => {
      reject(new Error("Could not read file."));
    };
    reader.readAsText(file);
  });
}

function describeFailure(
  status: number,
  serverMsg: string | undefined,
): { message: string; retry: boolean } {
  if (status === 401) {
    return {
      message:
        "The AI service isn't set up correctly (missing or invalid API key). Please contact the site owner.",
      retry: false,
    };
  }
  if (status === 413) {
    return { message: "That document is too large. Try a shorter section.", retry: false };
  }
  if (status === 429) {
    return {
      message:
        serverMsg !== undefined && serverMsg !== "Invalid request."
          ? serverMsg
          : "The service is busy right now. Please wait a moment and try again.",
      retry: true,
    };
  }
  if (status >= 400 && status < 500) {
    return {
      message:
        serverMsg !== undefined && serverMsg !== "Invalid request."
          ? serverMsg
          : "Some of your input couldn't be processed. Please check it and try again.",
      retry: false,
    };
  }
  return {
    message: "The AI service couldn't finish this request. Please try again.",
    retry: true,
  };
}

function serverError(data: unknown): string | undefined {
  return typeof data === "object" && data !== null && "error" in data
    ? String((data as Record<string, unknown>)["error"])
    : undefined;
}

interface StreamDone {
  readonly markdown: string;
  readonly model: string;
  readonly grounded: boolean;
}

/** Parse a single SSE block (`event:` + `data:` lines) from the stream buffer. */
function parseSseBlock(block: string): { event: string; data: unknown } | null {
  let event = "";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (event === "" || dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) as unknown };
  } catch {
    return null;
  }
}

function streamPayloadText(data: unknown, key: string): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const v = (data as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

/**
 * Consume `POST /api/analyze/stream`, forwarding token deltas and progress
 * labels. Resolves with the authoritative `done` payload. Throws on the
 * server's `error` event or on a malformed stream.
 */
async function consumeAnalyzeStream(
  res: Response,
  handlers: {
    readonly onToken: (delta: string) => void;
    readonly onProgress: (label: string) => void;
  },
): Promise<StreamDone> {
  const body = res.body;
  if (body === null) throw new Error("Empty stream response.");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: StreamDone | null = null;

  for (;;) {
    const { value, done: readerDone } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), {
      stream: !readerDone,
    });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      if (parsed === null) continue;
      if (parsed.event === "token") {
        const token = streamPayloadText(parsed.data, "token");
        if (token !== undefined) handlers.onToken(token);
      } else if (parsed.event === "progress") {
        const label = streamPayloadText(parsed.data, "label");
        if (label !== undefined) handlers.onProgress(label);
      } else if (parsed.event === "done") {
        const markdown = streamPayloadText(parsed.data, "markdown");
        if (markdown !== undefined) {
          const d = parsed.data as Record<string, unknown>;
          done = {
            markdown,
            model: typeof d["model"] === "string" ? d["model"] : "",
            grounded: d["grounded"] === true,
          };
        }
      } else if (parsed.event === "error") {
        const message = streamPayloadText(parsed.data, "error") ?? "Stream failed.";
        const status =
          typeof (parsed.data as Record<string, unknown>)["status"] === "number"
            ? ((parsed.data as Record<string, unknown>)["status"] as number)
            : 502;
        const err = new Error(message) as Error & { status?: number };
        err.status = status;
        throw err;
      }
    }
    if (done !== null) {
      await reader.cancel().catch(() => {});
      return done;
    }
    if (readerDone) break;
  }
  throw new Error("Stream ended before completion.");
}

const noopSubscribe = (): (() => void) => () => {};

const SESSION_TOOLS: readonly Exclude<ActionKind, "ask">[] = [
  "simplify",
  "risks",
  "playbook",
  "compare",
  "action",
  "handoff",
  "stamp",
];

export function formatK(n: number): string {
  if (n < 1000) return String(n);
  return n < 10_000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n / 1000)}k`;
}

interface WorkspaceValue {
  // documents
  readonly doc: string;
  readonly setDoc: (v: string) => void;
  readonly docA: string;
  readonly setDocA: (v: string) => void;
  readonly docB: string;
  readonly setDocB: (v: string) => void;
  readonly labelA: string;
  readonly setLabelA: (v: string) => void;
  readonly labelB: string;
  readonly setLabelB: (v: string) => void;
  readonly fileInfo: FileInfo | null;
  readonly question: string;
  readonly setQuestion: (v: string) => void;
  readonly goal: string;
  readonly setGoal: (v: string) => void;
  readonly situation: string;
  readonly setSituation: (v: string) => void;
  readonly specialty: string;
  readonly setSpecialty: (v: string) => void;
  readonly compareView: CompareView;
  readonly setCompareView: (v: CompareView) => void;
  readonly rules: readonly PlaybookRule[];
  readonly updateRules: (next: readonly PlaybookRule[]) => void;
  readonly history: readonly ChatTurn[];
  readonly setHistory: (h: readonly ChatTurn[]) => void;
  // settings
  readonly jurisdiction: string;
  readonly setJurisdiction: (v: string) => void;
  readonly readingLevel: ReadingLevel;
  readonly setReadingLevel: (v: ReadingLevel) => void;
  readonly language: LanguageCode;
  readonly setLanguageCode: (v: LanguageCode) => void;
  readonly langLabel: string;
  readonly showOriginal: boolean;
  readonly setShowOriginal: (v: boolean | ((p: boolean) => boolean)) => void;
  // async state
  readonly loading: boolean;
  readonly progress: string;
  readonly extracting: boolean;
  readonly error: string;
  readonly canRetry: boolean;
  readonly notice: string;
  readonly setNotice: (v: string) => void;
  readonly translating: boolean;
  readonly translateNote: string;
  readonly results: Results;
  readonly chatTranslated: Readonly<Record<string, string>>;
  readonly translatedDoc: Partial<Record<Exclude<ActionKind, "ask">, string>>;
  readonly recent: readonly RecentItem[];
  readonly setRecent: (r: readonly RecentItem[]) => void;
  readonly recentOpen: boolean;
  readonly setRecentOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  readonly copiedMsg: number | null;
  readonly dragTarget: DropTarget | null;
  readonly setDragTarget: (v: DropTarget | null) => void;
  readonly fileRef: React.RefObject<HTMLInputElement | null>;
  // global UI
  readonly showDisclaimer: boolean;
  readonly dismissDisclaimer: () => void;
  readonly showTour: boolean;
  readonly startTour: () => void;
  readonly endTour: (completed?: boolean) => void;
  readonly openRecent: () => void;
  // actions
  readonly showError: (message: string, retry?: boolean) => void;
  readonly clearError: () => void;
  readonly loadSample: (id: string, target: DropTarget) => void;
  readonly onPickFile: (target: DropTarget) => void;
  readonly handleFile: (file: File, target: DropTarget) => Promise<void>;
  readonly onFileChosen: () => Promise<void>;
  readonly dropProps: (target: DropTarget) => {
    onDragOver: (e: DragEvent<HTMLElement>) => void;
    onDragLeave: (e: DragEvent<HTMLElement>) => void;
    onDrop: (e: DragEvent<HTMLElement>) => void;
  };
  readonly clearInput: (tool: ActionKind) => void;
  readonly runTool: (tool: Exclude<ActionKind, "ask">, stampReq?: StampVerifyRequest | null) => Promise<void>;
  readonly runAsk: () => Promise<void>;
  readonly retry: (tool: ActionKind) => Promise<void>;
  readonly setLastStampReq: (req: StampVerifyRequest | null) => void;
  readonly writeClipboard: (text: string) => Promise<boolean>;
  readonly downloadText: (fileName: string, text: string) => void;
  readonly shownMarkdownFor: (tool: Exclude<ActionKind, "ask">) => string | undefined;
  readonly downloadResult: (tool: Exclude<ActionKind, "ask">) => void;
  readonly downloadPdf: (html: string | undefined, name: string, heading?: string) => void;
  readonly currentReport: () => Report | null;
  readonly downloadFullReport: () => void;
  readonly copyShareLink: (report: Report | null) => Promise<boolean>;
  readonly reportTitleFor: (tool: Exclude<ActionKind, "ask">) => string;
  readonly copyMessage: (text: string, n: number) => Promise<void>;
  readonly clearChat: () => void;
  readonly restoreRecent: (item: RecentItem) => void;
  readonly downloadItem: (item: RecentItem) => void;
  readonly switchLanguage: (next: LanguageCode, tool: ActionKind) => void;
  readonly redlineOps: ReturnType<typeof diffWords> | undefined;
  // session restore (IndexedDB, same browser only)
  readonly sessionRestored: boolean;
  readonly dismissRestore: () => void;
  readonly startFresh: () => void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace(): WorkspaceValue {
  const v = useContext(WorkspaceContext);
  if (v === null) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return v;
}

export function WorkspaceProvider({ children }: { children: ReactNode }): ReactNode {
  const [doc, setDoc] = useState("");
  const [docA, setDocA] = useState("");
  const [docB, setDocB] = useState("");
  const [labelA, setLabelA] = useState("Contract A");
  const [labelB, setLabelB] = useState("Contract B");
  const [question, setQuestion] = useState("");
  const [goal, setGoal] = useState("");
  const [situation, setSituation] = useState("");
  const [specialty, setSpecialty] = useState(SPECIALTIES[0]?.id ?? "contract");
  const [compareView, setCompareView] = useState<CompareView>("ai");
  const [editedRules, setEditedRules] = useState<readonly PlaybookRule[] | null>(null);
  const [history, setHistoryState] = useState<readonly ChatTurn[]>([]);
  const [jurisdiction, setJurisdiction] = useState("Maharashtra, India");
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>("standard");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [showOriginal, setShowOriginalState] = useState(false);
  const [translatedDoc, setTranslatedDoc] = useState<
    Partial<Record<Exclude<ActionKind, "ask">, string>>
  >({});
  const [chatTranslated, setChatTranslated] = useState<Readonly<Record<string, string>>>({});
  const [translating, setTranslating] = useState(false);
  const [translateNote, setTranslateNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState<Results>({});
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [dragTarget, setDragTarget] = useState<DropTarget | null>(null);
  const [recent, setRecent] = useState<readonly RecentItem[]>([]);
  const [recentOpen, setRecentOpenState] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState<number | null>(null);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);
  const [tourDismissed, setTourDismissed] = useState(false);
  const [tourRequested, setTourRequested] = useState(false);

  const storedTourDone = useSyncExternalStore(noopSubscribe, tourCompleted, () => true);
  const storedDisclaimerOk = useSyncExternalStore(noopSubscribe, disclaimerAccepted, () => true);
  const rawPlaybook = useSyncExternalStore(noopSubscribe, readPlaybookRaw, () => null);
  const storedRules = useMemo(() => parsePlaybook(rawPlaybook), [rawPlaybook]);
  const rules = editedRules ?? storedRules;

  const stampReqRef = useRef<StampVerifyRequest | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const fileTarget = useRef<DropTarget>("single");
  const tCache = useRef(new Map<string, string>());
  const trReq = useRef(0);

  const setHistory = useCallback((h: readonly ChatTurn[]) => setHistoryState(h), []);
  const setShowOriginal = useCallback(
    (v: boolean | ((p: boolean) => boolean)) =>
      setShowOriginalState((p) => (typeof v === "function" ? (v as (p: boolean) => boolean)(p) : v)),
    [],
  );
  const setRecentOpen = useCallback(
    (v: boolean | ((p: boolean) => boolean)) =>
      setRecentOpenState((p) => (typeof v === "function" ? (v as (p: boolean) => boolean)(p) : v)),
    [],
  );

  const showError = useCallback((message: string, retry = false): void => {
    setError(message);
    setCanRetry(retry);
  }, []);
  const clearError = useCallback((): void => {
    setError("");
    setCanRetry(false);
  }, []);

  const langLabel = LANGUAGES.find((l) => l.code === language)?.label ?? language;

  const translateDocResult = useCallback(
    async (markdown: string, forTab: Exclude<ActionKind, "ask">, lang: LanguageCode): Promise<void> => {
      if (lang === "en") return;
      const target = TranslationTargetEnum.parse(lang);
      const key = cacheKey(markdown, lang);
      const cached = tCache.current.get(key);
      if (cached !== undefined) {
        setTranslatedDoc((prev) => (prev[forTab] === cached ? prev : { ...prev, [forTab]: cached }));
        return;
      }
      const id = (trReq.current += 1);
      setTranslating(true);
      setTranslateNote("");
      try {
        const out = await translateTexts([markdown], target);
        if (trReq.current !== id) return;
        const text = out[0] ?? markdown;
        tCache.current.set(key, text);
        setTranslatedDoc((prev) => ({ ...prev, [forTab]: text }));
      } catch {
        if (trReq.current !== id) return;
        setTranslateNote("Translation unavailable — showing English.");
      } finally {
        if (trReq.current === id) setTranslating(false);
      }
    },
    [],
  );

  const ensureChatTranslated = useCallback(
    async (turns: readonly ChatTurn[], lang: LanguageCode): Promise<void> => {
      if (lang === "en") return;
      const target = TranslationTargetEnum.parse(lang);
      const pend: { key: string; content: string }[] = [];
      const hits: Record<string, string> = {};
      for (const m of turns) {
        if (m.role !== "assistant") continue;
        const key = cacheKey(m.content, lang);
        const cached = tCache.current.get(key);
        if (cached !== undefined) hits[key] = cached;
        else pend.push({ key, content: m.content });
      }
      if (Object.keys(hits).length > 0) setChatTranslated((prev) => ({ ...prev, ...hits }));
      if (pend.length === 0) return;
      const id = (trReq.current += 1);
      setTranslating(true);
      setTranslateNote("");
      try {
        const out = await translateTexts(
          pend.map((p) => p.content),
          target,
        );
        if (trReq.current !== id) return;
        const merged: Record<string, string> = {};
        pend.forEach((p, i) => {
          const text = out[i] ?? p.content;
          tCache.current.set(p.key, text);
          merged[p.key] = text;
        });
        setChatTranslated((prev) => ({ ...prev, ...merged }));
      } catch {
        if (trReq.current === id) setTranslateNote("Translation unavailable — showing English.");
      } finally {
        if (trReq.current === id) setTranslating(false);
      }
    },
    [],
  );

  const loadSample = useCallback((id: string, target: DropTarget): void => {
    const found = SAMPLE_DOCS.find((s) => s.id === id);
    if (found === undefined) return;
    if (target === "a") {
      setDocA(found.body);
      setLabelA(found.title);
    } else if (target === "b") {
      setDocB(found.body);
      setLabelB(found.title);
    } else {
      setDoc(found.body);
      setFileInfo(null);
    }
    setNotice("");
  }, []);

  const onPickFile = useCallback((target: DropTarget): void => {
    fileTarget.current = target;
    fileRef.current?.click();
  }, []);

  const handleFile = useCallback(
    async (file: File, target: DropTarget): Promise<void> => {
      const place = (text: string, info: FileInfo): void => {
        const shortName = info.name.replace(/\.[a-z0-9]+$/i, "");
        if (target === "a") {
          setDocA(text);
          setLabelA(shortName);
        } else if (target === "b") {
          setDocB(text);
          setLabelB(shortName);
        } else {
          setDoc(text);
          setFileInfo(info);
        }
      };
      setError("");
      setNotice("");
      try {
        const lowerName = file.name.toLowerCase();
        const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
        const isDocx =
          file.type ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          lowerName.endsWith(".docx");
        if (!isPdf && !isDocx) {
          const text = await readTextFile(file);
          place(text.slice(0, MAX_DOC_CHARS), {
            name: file.name,
            pages: null,
            truncated: text.length > MAX_DOC_CHARS,
          });
          return;
        }
        if (file.size > MAX_PDF_BYTES) {
          showError("That file is larger than 12 MB. Try a smaller file.");
          return;
        }
        setExtracting(true);
        const form = new FormData();
        form.append("file", file, file.name);
        const res = await fetch("/api/extract-pdf", { method: "POST", body: form });
        const data: unknown = await res.json();
        if (!res.ok) {
          showError(
            serverError(data) ??
              "We couldn't read text from that file. If it's a scan, paste the text instead.",
          );
          return;
        }
        if (!isExtractPdfOk(data)) {
          showError("We couldn't read text from that file. Please try again.", true);
          return;
        }
        place(data.text, { name: data.fileName, pages: data.pages, truncated: data.truncated });
      } catch {
        showError("Could not read that file. Paste the text instead.");
      } finally {
        setExtracting(false);
      }
    },
    [showError],
  );

  const onFileChosen = useCallback(async (): Promise<void> => {
    const input = fileRef.current;
    const file = input?.files?.[0];
    if (file === undefined) return;
    await handleFile(file, fileTarget.current);
    if (input) input.value = "";
  }, [handleFile]);

  const dropProps = useCallback(
    (target: DropTarget) => ({
      onDragOver: (e: DragEvent<HTMLElement>): void => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragTarget(target);
      },
      onDragLeave: (e: DragEvent<HTMLElement>): void => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragTarget(null);
      },
      onDrop: (e: DragEvent<HTMLElement>): void => {
        e.preventDefault();
        setDragTarget(null);
        const file = e.dataTransfer.files[0];
        if (file !== undefined) void handleFile(file, target);
      },
    }),
    [handleFile],
  );

  const clearInput = useCallback(
    (tool: ActionKind): void => {
      if (tool === "compare") {
        setDocA("");
        setDocB("");
      } else {
        setDoc("");
        setFileInfo(null);
      }
      setError("");
      setNotice("");
    },
    [],
  );

  const updateRules = useCallback((next: readonly PlaybookRule[]): void => {
    setEditedRules(next);
    savePlaybook(next);
  }, []);

  const writeClipboard = useCallback(
    async (text: string): Promise<boolean> => {
      if (text === "") return false;
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        showError("Your browser blocked copying. Select the text and copy it manually.");
        return false;
      }
    },
    [showError],
  );

  const downloadText = useCallback((fileName: string, text: string): void => {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const shownMarkdownFor = useCallback(
    (tool: Exclude<ActionKind, "ask">): string | undefined => {
      const active = results[tool];
      if (active === undefined) return undefined;
      if (language === "en" || showOriginal) return active.markdown;
      return translatedDoc[tool] ?? active.markdown;
    },
    [results, language, showOriginal, translatedDoc],
  );

  const reportTitleFor = useCallback(
    (tool: Exclude<ActionKind, "ask">): string => {
      if (tool === "compare") return `${labelA} vs ${labelB}`;
      return fileInfo?.name ?? titleFrom(doc, "LexClarity report");
    },
    [doc, fileInfo, labelA, labelB],
  );

  const currentReport = useCallback((): Report | null => {
    const order: readonly Exclude<ActionKind, "ask">[] = [
      "simplify",
      "risks",
      "playbook",
      "compare",
      "action",
      "handoff",
      "stamp",
    ];
    const sections = order.flatMap((id) => {
      const r = results[id];
      return r === undefined ? [] : [{ action: id, markdown: r.markdown, grounded: r.grounded }];
    });
    if (sections.length === 0) return null;
    const first = (Object.keys(results) as (Exclude<ActionKind, "ask">)[])[0];
    const title = first !== undefined ? reportTitleFor(first) : "LexClarity report";
    return {
      v: 1,
      title: title.slice(0, 200),
      createdAt: Date.now(),
      ...(jurisdiction.trim() ? { jurisdiction: jurisdiction.trim().slice(0, 120) } : {}),
      sections,
    };
  }, [results, reportTitleFor, jurisdiction]);

  const downloadFullReport = useCallback((): void => {
    const report = currentReport();
    if (report !== null) downloadText(reportFileName(report.title), buildReportMarkdown(report));
  }, [currentReport, downloadText]);

  const copyShareLink = useCallback(
    async (report: Report | null): Promise<boolean> => {
      if (report === null) return false;
      try {
        const token = await encodeReport(report);
        return await writeClipboard(shareUrl(window.location.origin, token));
      } catch {
        showError("Couldn't create a share link for this report.");
        return false;
      }
    },
    [writeClipboard, showError],
  );

  const downloadResult = useCallback(
    (tool: Exclude<ActionKind, "ask">): void => {
      const md = shownMarkdownFor(tool);
      const active = results[tool];
      if (active === undefined || md === undefined) return;
      downloadText(
        `lexclarity-${active.action}${language !== "en" && !showOriginal ? `-${language}` : ""}.md`,
        md,
      );
    },
    [shownMarkdownFor, results, downloadText, language, showOriginal],
  );

  const downloadPdf = useCallback(
    (html: string | undefined, name: string, heading?: string): void => {
      if (html === undefined) {
        showError("Could not open the print view.");
        return;
      }
      const top =
        heading === undefined
          ? ""
          : `<h1>${heading.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</h1><p class="meta">Prepared with LexClarity${jurisdiction.trim() ? ` · ${jurisdiction.trim().replaceAll("<", "&lt;")}` : ""} · ${new Date().toLocaleDateString("en-IN")}</p>`;
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
      document.body.appendChild(frame);
      const fdoc = frame.contentDocument;
      const win = frame.contentWindow;
      if (fdoc === null || win === null) {
        frame.remove();
        showError("Could not open the print view.");
        return;
      }
      fdoc.open();
      fdoc.write(`<!doctype html><html><head><meta charset="utf-8">
<title>lexclarity-${name}</title>
<style>
  @page { margin: 18mm; }
  body { font: 11pt/1.6 system-ui, "Noto Sans", "Noto Sans Devanagari", sans-serif; color: #111; }
  h2 { font-size: 15pt; margin: 1.2em 0 .4em; } h3 { font-size: 12.5pt; margin: 1em 0 .3em; }
  table { width: 100%; border-collapse: collapse; margin: .6em 0; page-break-inside: avoid; }
  th, td { border: 1px solid #bbb; padding: 4px 8px; text-align: left; vertical-align: top; }
  th { background: #f1ece0; }
  blockquote { border-left: 3px solid #c9a227; margin: .6em 0; padding-left: .8em; color: #444; }
  code { background: #f3f3f3; padding: 0 3px; border-radius: 3px; }
  hr { border: 0; border-top: 1px solid #ccc; }
  a { color: #111; }
  h1 { font-size: 18pt; margin: 0 0 .2em; } .meta { color: #555; font-size: 9.5pt; margin: 0 0 1em; }
  .foot { margin-top: 2em; border-top: 1px solid #ccc; padding-top: .5em; font-size: 9pt; color: #555; }
</style></head><body>${top}${html}<p class="foot">Information only — not legal advice. Consult an advocate enrolled with the Bar Council of India.</p></body></html>`);
      fdoc.close();
      const cleanup = (): void => frame.remove();
      win.addEventListener("afterprint", () => setTimeout(cleanup, 0));
      setTimeout(() => {
        win.focus();
        win.print();
        setTimeout(cleanup, 60_000);
      }, 50);
    },
    [showError, jurisdiction],
  );

  const buildPayloadFor = useCallback(
    (tool: ActionKind, stampReq?: StampVerifyRequest | null): Record<string, unknown> | null => {
      const common = {
        readingLevel,
        ...(jurisdiction.trim() ? { jurisdiction: jurisdiction.trim() } : {}),
      };
      switch (tool) {
        case "simplify":
        case "risks":
        case "action":
          if (doc.trim().length < 20) {
            showError("Paste at least a few sentences of the document first.");
            return null;
          }
          return {
            action: tool,
            document: doc,
            ...(tool === "action" && goal.trim() ? { goal: goal.trim() } : {}),
            ...common,
          };
        case "playbook": {
          if (doc.trim().length < 20) {
            showError("Paste at least a few sentences of the document first.");
            return null;
          }
          const checked = activeRules(rules);
          if (checked.length === 0) {
            showError("Turn on at least one playbook position to check.");
            return null;
          }
          return { action: tool, document: doc, rules: checked, ...common };
        }
        case "handoff":
          if (doc.trim().length < 20) {
            showError("Paste at least a few sentences of the document first.");
            return null;
          }
          return {
            action: tool,
            document: doc,
            ...(situation.trim() ? { situation: situation.trim().slice(0, 2000) } : {}),
            specialty: findSpecialty(specialty)?.label ?? specialty,
            ...common,
          };
        case "stamp": {
          const req = stampReq ?? stampReqRef.current;
          if (req === null) {
            showError("Fill in the calculator, then press Verify with live sources.");
            return null;
          }
          return { action: tool, ...req, ...common };
        }
        case "compare":
          if (docA.trim().length < 20 || docB.trim().length < 20) {
            showError("Add both documents to compare.");
            return null;
          }
          return { action: tool, documentA: docA, documentB: docB, labelA, labelB, ...common };
        case "ask":
          if (question.trim().length < 3) {
            showError("Type a question first.");
            return null;
          }
          return {
            action: tool,
            question: question.trim(),
            ...(doc.trim() ? { document: doc } : {}),
            history: history.slice(-8),
            ...common,
          };
      }
    },
    [doc, docA, docB, labelA, labelB, question, goal, situation, specialty, rules, history, jurisdiction, readingLevel, showError],
  );

  const runTool = useCallback(
    async (tool: Exclude<ActionKind, "ask">, stampReq?: StampVerifyRequest | null): Promise<void> => {
      if (loading) return;
      setError("");
      setCanRetry(false);
      if (tool === "stamp" && stampReq !== undefined) stampReqRef.current = stampReq;
      const payload = buildPayloadFor(tool, stampReq);
      if (payload === null) return;

      const dropEmptySeed = (): void => {
        setResults((prev) => {
          const cur = prev[tool];
          if (cur === undefined || cur.markdown !== "") return prev;
          const next = { ...prev };
          delete next[tool];
          return next;
        });
      };

      const finish = (markdown: string, model: string, grounded: boolean): void => {
        setResults((prev) => ({ ...prev, [tool]: { action: tool, markdown, model, grounded } }));
        void translateDocResult(markdown, tool, language);
        const fallback = tool;
        setRecent(
          saveRecent({
            id: `${Date.now()}`,
            action: tool,
            title:
              tool === "compare"
                ? `${labelA} vs ${labelB}`
                : tool === "stamp"
                  ? `Stamp duty · ${(stampReq ?? stampReqRef.current)?.state ?? jurisdiction} (${(stampReq ?? stampReqRef.current)?.instrument === "sale" ? "sale deed" : "rent"})`
                  : (fileInfo?.name ?? titleFrom(doc, fallback)),
            ...(jurisdiction.trim() ? { jurisdiction: jurisdiction.trim() } : {}),
            createdAt: Date.now(),
            markdown,
            model,
            grounded,
          }),
        );
      };

      const runBuffered = async (): Promise<void> => {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data: unknown = await res.json();
        if (!res.ok) {
          const failure = describeFailure(res.status, serverError(data));
          showError(failure.message, failure.retry);
          dropEmptySeed();
          return;
        }
        if (!isAnalyzeOk(data)) {
          showError("Something went wrong on our side. Please try again.", true);
          dropEmptySeed();
          return;
        }
        finish(data.markdown, data.model, data.grounded);
      };

      setLoading(true);
      setProgress("Reading your document…");
      try {
        // Seed an empty result so the panel renders streamed tokens immediately.
        setResults((prev) => ({
          ...prev,
          [tool]: { action: tool, markdown: "", model: "", grounded: false },
        }));
        const res = await fetch("/api/analyze/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok || res.body === null) {
          // Deterministic rejection (400/401/429) — surface it directly;
          // the buffered endpoint would fail identically.
          const data: unknown = await res.json().catch(() => undefined);
          const failure = describeFailure(res.status, serverError(data));
          showError(failure.message, failure.retry);
          dropEmptySeed();
          return;
        }
        let acc = "";
        const done = await consumeAnalyzeStream(res, {
          onToken: (delta) => {
            acc += delta;
            const snap = acc;
            setResults((prev) => ({
              ...prev,
              [tool]: { action: tool, markdown: snap, model: "", grounded: false },
            }));
          },
          onProgress: (label) => setProgress(label),
        });
        finish(done.markdown, done.model, done.grounded);
      } catch {
        // Stream dropped mid-flight — fall back to the buffered endpoint.
        try {
          await runBuffered();
        } catch {
          showError("We couldn't reach the server. Check your internet connection and try again.", true);
        }
      } finally {
        setLoading(false);
        setProgress("");
      }
    },
    [loading, buildPayloadFor, translateDocResult, showError, language, labelA, labelB, fileInfo, doc, jurisdiction],
  );

  const runAsk = useCallback(async (): Promise<void> => {
    if (loading) return;
    setError("");
    setCanRetry(false);
    const payload = buildPayloadFor("ask");
    if (payload === null) return;
    const chatQ = String(payload["question"] ?? "");
    setQuestion("");
    const outgoing: ChatTurn = { role: "user", content: chatQ };
    const base = [...history, outgoing].slice(-20);
    const failAsk = (): void => {
      setHistoryState(base.slice(0, -1));
      setQuestion(chatQ);
    };

    const runBufferedAsk = async (): Promise<void> => {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const failure = describeFailure(res.status, serverError(data));
        showError(failure.message, failure.retry);
        failAsk();
        return;
      }
      if (!isAnalyzeOk(data)) {
        showError("Something went wrong on our side. Please try again.", true);
        failAsk();
        return;
      }
      const reply: ChatTurn = { role: "assistant", content: data.markdown };
      const full = [...base, reply].slice(-20);
      setHistoryState(full);
      void ensureChatTranslated(full, language);
    };

    // Seed a placeholder assistant message so streamed tokens render live.
    const placeholder: ChatTurn = { role: "assistant", content: "" };
    setHistoryState([...base, placeholder].slice(-20));
    setLoading(true);
    setProgress("Researching Indian law…");
    try {
      const res = await fetch("/api/analyze/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok || res.body === null) {
        const data: unknown = await res.json().catch(() => undefined);
        const failure = describeFailure(res.status, serverError(data));
        showError(failure.message, failure.retry);
        failAsk();
        return;
      }
      let acc = "";
      const done = await consumeAnalyzeStream(res, {
        onToken: (delta) => {
          acc += delta;
          const snap: ChatTurn = { role: "assistant", content: acc };
          setHistoryState([...base, snap].slice(-20));
        },
        onProgress: (label) => setProgress(label),
      });
      if (done.markdown.trim() === "") {
        await runBufferedAsk();
        return;
      }
      const reply: ChatTurn = { role: "assistant", content: done.markdown };
      const full = [...base, reply].slice(-20);
      setHistoryState(full);
      void ensureChatTranslated(full, language);
    } catch {
      try {
        await runBufferedAsk();
      } catch {
        showError("We couldn't reach the server. Check your internet connection and try again.", true);
        failAsk();
      }
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [loading, buildPayloadFor, history, language, ensureChatTranslated, showError]);

  const retry = useCallback(
    async (tool: ActionKind): Promise<void> => {
      if (tool === "ask") await runAsk();
      else await runTool(tool);
    },
    [runAsk, runTool],
  );

  const copyMessage = useCallback(
    async (text: string, n: number): Promise<void> => {
      if (await writeClipboard(text)) {
        setCopiedMsg(n);
        setTimeout(() => setCopiedMsg((c) => (c === n ? null : c)), 1800);
      }
    },
    [writeClipboard],
  );

  const clearChat = useCallback((): void => {
    setHistoryState([]);
    setError("");
    setNotice("");
  }, []);

  const openRecent = useCallback((): void => {
    setRecent(loadRecent());
    setRecentOpenState((v) => !v);
  }, []);

  const downloadItem = useCallback(
    (item: RecentItem): void => {
      const report: Report = {
        v: 1,
        title: item.title.slice(0, 200),
        createdAt: item.createdAt,
        ...(item.jurisdiction !== undefined ? { jurisdiction: item.jurisdiction.slice(0, 120) } : {}),
        sections: [{ action: item.action, markdown: item.markdown, grounded: item.grounded }],
      };
      downloadText(reportFileName(report.title), buildReportMarkdown(report));
    },
    [downloadText],
  );

  const restoreRecent = useCallback(
    (item: RecentItem): void => {
      setResults((prev) => ({
        ...prev,
        [item.action]: {
          action: item.action,
          markdown: item.markdown,
          model: item.model,
          grounded: item.grounded,
        },
      }));
      setTranslatedDoc((prev) => {
        const next = { ...prev };
        delete next[item.action];
        return next;
      });
      setShowOriginalState(false);
      setError("");
      setRecentOpenState(false);
      void translateDocResult(item.markdown, item.action, language);
    },
    [language, translateDocResult],
  );

  const switchLanguage = useCallback(
    (next: LanguageCode, tool: ActionKind): void => {
      setLanguage(next);
      setShowOriginalState(false);
      setTranslateNote("");
      if (next === "en") return;
      if (tool === "ask") void ensureChatTranslated(history, next);
      else {
        const active = results[tool];
        if (active !== undefined) void translateDocResult(active.markdown, tool, next);
      }
    },
    [history, results, ensureChatTranslated, translateDocResult],
  );

  const showDisclaimer = !storedDisclaimerOk && !disclaimerDismissed;
  const showTour = tourRequested || (!showDisclaimer && !storedTourDone && !tourDismissed);

  // ── Same-browser session restore (IndexedDB) ──────────────────────
  const [sessionRestored, setSessionRestored] = useState(false);
  const hydratedRef = useRef(false);

  // Rehydrate once on mount. The guard flag also gates the saver below so
  // the default (empty) state can never overwrite a stored session.
  useEffect(() => {
    let cancelled = false;
    void loadSession().then((snap) => {
      if (cancelled) return;
      hydratedRef.current = true;
      if (snap === null || isSnapshotEmpty(snap)) return;
      setDoc(snap.doc.slice(0, MAX_DOC_CHARS));
      setDocA(snap.docA.slice(0, MAX_DOC_CHARS));
      setDocB(snap.docB.slice(0, MAX_DOC_CHARS));
      setLabelA(snap.labelA.slice(0, 60) || "Contract A");
      setLabelB(snap.labelB.slice(0, 60) || "Contract B");
      setGoal(snap.goal.slice(0, 500));
      setSituation(snap.situation.slice(0, 2000));
      if (snap.specialty.trim() !== "") setSpecialty(snap.specialty.slice(0, 60));
      if (snap.jurisdiction !== "") setJurisdiction(snap.jurisdiction.slice(0, 120));
      if ((READING_LEVELS as readonly string[]).includes(snap.readingLevel)) {
        setReadingLevel(snap.readingLevel as ReadingLevel);
      }
      const lang = LanguageCodeSchema.safeParse(snap.language);
      if (lang.success) setLanguage(lang.data);
      const restored: Results = {};
      for (const [key, r] of Object.entries(snap.results)) {
        if ((SESSION_TOOLS as readonly string[]).includes(key)) {
          restored[key as Exclude<ActionKind, "ask">] = {
            action: key as Exclude<ActionKind, "ask">,
            markdown: r.markdown,
            model: r.model,
            grounded: r.grounded,
          };
        }
      }
      setResults(restored);
      setHistoryState(
        snap.history.map((m) => ({ role: m.role, content: m.content })).slice(-20),
      );
      setSessionRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced saver: snapshots the live session ~1s after the last change.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const id = window.setTimeout(() => {
      const snapshot: SessionSnapshot = {
        v: 1,
        savedAt: Date.now(),
        doc,
        docA,
        docB,
        labelA,
        labelB,
        goal,
        situation,
        specialty,
        jurisdiction,
        readingLevel,
        language,
        results: Object.fromEntries(
          Object.entries(results).filter(([, r]) => r !== undefined),
        ),
        history: history.map((m) => ({ role: m.role, content: m.content })),
      };
      void saveSession(snapshot);
    }, 800);
    return () => window.clearTimeout(id);
  }, [
    doc,
    docA,
    docB,
    labelA,
    labelB,
    goal,
    situation,
    specialty,
    jurisdiction,
    readingLevel,
    language,
    results,
    history,
  ]);

  const dismissRestore = useCallback((): void => setSessionRestored(false), []);

  const startFresh = useCallback((): void => {
    setDoc("");
    setDocA("");
    setDocB("");
    setLabelA("Contract A");
    setLabelB("Contract B");
    setGoal("");
    setSituation("");
    setQuestion("");
    setHistoryState([]);
    setResults({});
    setTranslatedDoc({});
    setChatTranslated({});
    setShowOriginalState(false);
    setFileInfo(null);
    setCompareView("ai");
    setError("");
    setNotice("");
    stampReqRef.current = null;
    setSessionRestored(false);
    void clearSession();
  }, []);

  const startTour = useCallback((): void => {
    setRecentOpenState(false);
    setTourRequested(true);
  }, []);
  const endTour = useCallback((completed = true): void => {
    if (completed) completeTour();
    setTourDismissed(true);
    setTourRequested(false);
  }, []);
  const dismissDisclaimer = useCallback((): void => {
    acceptDisclaimer();
    setDisclaimerDismissed(true);
  }, []);

  const redlineOps = useMemo(
    () => (docA.trim() !== "" && docB.trim() !== "" ? diffWords(docA, docB) : undefined),
    [docA, docB],
  );

  const value: WorkspaceValue = {
    doc,
    setDoc: (v) => setDoc(v.slice(0, MAX_DOC_CHARS)),
    docA,
    setDocA: (v) => setDocA(v.slice(0, MAX_DOC_CHARS)),
    docB,
    setDocB: (v) => setDocB(v.slice(0, MAX_DOC_CHARS)),
    labelA,
    setLabelA,
    labelB,
    setLabelB,
    fileInfo,
    question,
    setQuestion,
    goal,
    setGoal,
    situation,
    setSituation,
    specialty,
    setSpecialty,
    compareView,
    setCompareView,
    rules,
    updateRules,
    history,
    setHistory,
    jurisdiction,
    setJurisdiction,
    readingLevel,
    setReadingLevel,
    language,
    setLanguageCode: (v) => setLanguage(v),
    langLabel,
    showOriginal,
    setShowOriginal,
    loading,
    progress,
    extracting,
    error,
    canRetry,
    notice,
    setNotice,
    translating,
    translateNote,
    results,
    chatTranslated,
    translatedDoc,
    recent,
    setRecent,
    recentOpen,
    setRecentOpen,
    copiedMsg,
    dragTarget,
    setDragTarget,
    fileRef,
    showDisclaimer,
    dismissDisclaimer,
    showTour,
    startTour,
    endTour,
    openRecent,
    showError,
    clearError,
    loadSample,
    onPickFile,
    handleFile,
    onFileChosen,
    dropProps,
    clearInput,
    runTool,
    runAsk,
    retry,
    setLastStampReq: (req) => {
      stampReqRef.current = req;
    },
    writeClipboard,
    downloadText,
    shownMarkdownFor,
    downloadResult,
    downloadPdf,
    currentReport,
    downloadFullReport,
    copyShareLink,
    reportTitleFor,
    copyMessage,
    clearChat,
    restoreRecent,
    downloadItem,
    switchLanguage,
    redlineOps,
    sessionRestored,
    dismissRestore,
    startFresh,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.markdown,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={onFileChosen}
      />
      {children}
    </WorkspaceContext.Provider>
  );
}
