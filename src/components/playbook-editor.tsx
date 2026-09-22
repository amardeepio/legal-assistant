"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { PlaybookRule } from "@/lib/playbook";
import { DEFAULT_RULES, MAX_RULES, MAX_RULE_CHARS } from "@/lib/playbook";
import { PlusIcon, XIcon } from "./icons";

interface PlaybookEditorProps {
  readonly rules: readonly PlaybookRule[];
  readonly onChange: (rules: readonly PlaybookRule[]) => void;
}

/** Edit the standard positions every document is checked against. */
export function PlaybookEditor({ rules, onChange }: PlaybookEditorProps): ReactNode {
  const [draft, setDraft] = useState("");
  const enabled = rules.filter((r) => r.enabled).length;

  const update = (id: string, patch: Partial<Omit<PlaybookRule, "id">>): void => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const add = (): void => {
    const text = draft.trim();
    if (text.length < 3 || rules.length >= MAX_RULES) return;
    onChange([...rules, { id: `r${Date.now()}`, text: text.slice(0, MAX_RULE_CHARS), enabled: true }]);
    setDraft("");
  };

  return (
    <fieldset className="thread grid gap-2 rounded-2xl p-3">
      <legend className="sr-only">Your playbook</legend>
      <div className="flex items-center gap-2">
        <p className="t1 text-xs font-bold">Your playbook</p>
        <span className="t3 text-[11px]">
          {enabled} of {rules.length} positions on · saved in this browser
        </span>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_RULES)}
          className="chip ml-auto rounded-lg px-2 py-0.5 text-[11px] font-semibold"
        >
          Reset
        </button>
      </div>
      <ul className="grid gap-1.5">
        {rules.map((r, n) => (
          <li key={r.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={r.enabled}
              onChange={(e) => update(r.id, { enabled: e.target.checked })}
              aria-label={`Check position ${n + 1}`}
              className="mt-2 accent-amber-500"
            />
            <textarea
              value={r.text}
              rows={1}
              maxLength={MAX_RULE_CHARS}
              onChange={(e) => update(r.id, { text: e.target.value })}
              aria-label={`Position ${n + 1}`}
              className={`field min-h-9 flex-1 resize-y rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${r.enabled ? "" : "opacity-60"}`}
            />
            <button
              type="button"
              onClick={() => onChange(rules.filter((x) => x.id !== r.id))}
              aria-label={`Remove position ${n + 1}`}
              className="chip danger-hover mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      {rules.length < MAX_RULES && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !(e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                add();
              }
            }}
            maxLength={MAX_RULE_CHARS}
            placeholder='Add a position, e.g. "Security deposit refunded within 15 days"'
            aria-label="New playbook position"
            className="field flex-1 rounded-lg px-2.5 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={add}
            disabled={draft.trim().length < 3}
            className="chip flex items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold disabled:opacity-40"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      )}
    </fieldset>
  );
}
