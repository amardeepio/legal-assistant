"use client";

import type { ReactNode } from "react";
import { ChatPanel } from "@/components/studio/chat-panel";

export default function AskPage(): ReactNode {
  return (
    <main className="grid gap-4">
      <div>
        <p className="accent text-[11px] font-bold uppercase tracking-[0.2em]">Q&amp;A grounded in docs</p>
        <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">Ask</h1>
        <p className="t2 mt-1 text-sm leading-relaxed">
          Questions answered from your document and Indian law.
        </p>
      </div>
      <ChatPanel />
    </main>
  );
}
