"use client";

import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useDismiss } from "./use-dismiss";
import {
  ArchiveIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  FileIcon,
  LinkIcon,
} from "./icons";

interface ExportMenuProps {
  readonly disabled: boolean;
  /** Resolves true when the text reached the clipboard. */
  readonly onCopy: () => Promise<boolean>;
  readonly onMarkdown: () => void;
  readonly onPdf: () => void;
  /** Every finished tool result for this document in one .md file. */
  readonly onFullReport?: () => void;
  /** Resolves true when a read-only share link reached the clipboard. */
  readonly onShareLink?: () => Promise<boolean>;
}

export function ExportMenu({
  disabled,
  onCopy,
  onMarkdown,
  onPdf,
  onFullReport,
  onShareLink,
}: ExportMenuProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const flash = (label: string): void => {
    setCopied(label);
    setTimeout(() => setCopied(null), 1800);
  };
  const root = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, root, close);

  const item =
    "hover-soft flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="chip flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold disabled:opacity-40"
      >
        {copied !== null ? <CheckIcon className="h-3.5 w-3.5" /> : null}
        {copied ?? "Export"}
        <ChevronDownIcon className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          role="menu"
          className="popover absolute right-0 top-full z-30 mt-1.5 w-52 rounded-xl p-1.5"
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={async () => {
              setOpen(false);
              if (await onCopy()) flash("Copied");
            }}
          >
            <CopyIcon className="h-4 w-4 opacity-70" />
            Copy text
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onMarkdown();
            }}
          >
            <DownloadIcon className="h-4 w-4 opacity-70" />
            Download .md
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onPdf();
            }}
          >
            <FileIcon className="h-4 w-4 opacity-70" />
            Save as PDF
          </button>
          {(onFullReport !== undefined || onShareLink !== undefined) && (
            <div className="bl my-1 border-t" role="separator" />
          )}
          {onFullReport !== undefined && (
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setOpen(false);
                onFullReport();
              }}
            >
              <ArchiveIcon className="h-4 w-4 opacity-70" />
              Full report (.md)
            </button>
          )}
          {onShareLink !== undefined && (
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={async () => {
                setOpen(false);
                if (await onShareLink()) flash("Link copied");
              }}
            >
              <LinkIcon className="h-4 w-4 opacity-70" />
              Copy read-only link
            </button>
          )}
        </div>
      )}
    </div>
  );
}
