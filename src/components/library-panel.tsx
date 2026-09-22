"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { RecentItem } from "@/lib/recent";
import { RECENT_LIMIT, filterLibrary, removeRecent, renameRecent, togglePinRecent } from "@/lib/recent";
import { ACTION_LABELS } from "@/lib/legal";
import { CheckIcon, DownloadIcon, LinkIcon, PencilIcon, StarIcon, TrashIcon } from "./icons";

interface LibraryPanelProps {
  readonly items: readonly RecentItem[];
  readonly onItems: (items: readonly RecentItem[]) => void;
  readonly onOpen: (item: RecentItem) => void;
  /** Resolves true once a read-only link is on the clipboard. */
  readonly onShare: (item: RecentItem) => Promise<boolean>;
  readonly onDownload: (item: RecentItem) => void;
}

/** Saved analyses: search, pin, rename, share, download, delete. Browser-only. */
export function LibraryPanel({ items, onItems, onOpen, onShare, onDownload }: LibraryPanelProps): ReactNode {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [shared, setShared] = useState<string | null>(null);
  const shown = filterLibrary(items, query);
  const icon = "chip grid h-7 w-7 shrink-0 place-items-center rounded-lg";

  return (
    <div className="popover absolute right-0 top-full z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl p-2">
      <div className="flex items-center gap-2 px-1 pb-2">
        <p className="t1 text-xs font-bold">Library</p>
        <span className="t3 text-[11px]">
          {items.length} saved · pinned items are kept
        </span>
      </div>
      {items.length > 0 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles and results…"
          aria-label="Search library"
          className="field mb-1.5 w-full rounded-lg px-2.5 py-1.5 text-xs"
        />
      )}
      <ul className="thread-scroll grid max-h-[60vh] gap-1 overflow-y-auto" aria-label="Saved analyses">
        {items.length === 0 && (
          <li className="t3 px-3 py-4 text-center text-xs">Your saved analyses will appear here.</li>
        )}
        {items.length > 0 && shown.length === 0 && (
          <li className="t3 px-3 py-4 text-center text-xs">Nothing matches “{query}”.</li>
        )}
        {shown.map((r) => (
          <li key={r.id} className="hover-soft flex items-center gap-1.5 rounded-lg px-2 py-1.5">
            {editing === r.id ? (
              <form
                className="flex min-w-0 flex-1 gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  onItems(renameRecent(r.id, draft));
                  setEditing(null);
                }}
              >
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setEditing(null);
                    }
                  }}
                  aria-label="New title"
                  className="field min-w-0 flex-1 rounded-md px-2 py-1 text-xs"
                />
                <button type="submit" aria-label="Save title" className={icon}>
                  <CheckIcon className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => onOpen(r)}
                className="min-w-0 flex-1 text-left"
                title="Open in the studio"
              >
                <span className="t1 block truncate text-xs font-semibold">{r.title}</span>
                <span className="t3 block truncate text-[11px]">
                  {ACTION_LABELS[r.action]} ·{" "}
                  {new Date(r.createdAt).toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {r.jurisdiction ? ` · ${r.jurisdiction}` : ""}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onItems(togglePinRecent(r.id))}
              aria-label={r.pinned === true ? `Unpin ${r.title}` : `Pin ${r.title}`}
              aria-pressed={r.pinned === true}
              className={`${icon} ${r.pinned === true ? "accent" : ""}`}
            >
              <StarIcon filled={r.pinned === true} className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (await onShare(r)) {
                  setShared(r.id);
                  setTimeout(() => setShared((s) => (s === r.id ? null : s)), 1800);
                }
              }}
              aria-label={`Copy share link for ${r.title}`}
              title={shared === r.id ? "Link copied" : "Copy read-only link"}
              className={icon}
            >
              {shared === r.id ? <CheckIcon className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
            </button>
            <button type="button" onClick={() => onDownload(r)} aria-label={`Download ${r.title}`} className={icon}>
              <DownloadIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(r.title);
                setEditing(r.id);
              }}
              aria-label={`Rename ${r.title}`}
              className={icon}
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onItems(removeRecent(r.id))}
              aria-label={`Delete ${r.title}`}
              className={`${icon} danger-hover`}
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <p className="t3 border-t bl mt-1.5 px-2 pb-0.5 pt-2 text-[10px]">
        Saved only in this browser (up to {RECENT_LIMIT} plus pinned). Share links contain
        the report itself — anyone with the link can read it.
      </p>
    </div>
  );
}
