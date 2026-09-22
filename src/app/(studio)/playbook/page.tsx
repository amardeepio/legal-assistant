import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToolPage } from "@/components/studio/tool-page";

export const metadata: Metadata = {
  title: "Playbook — LexClarity",
  description: "Check any contract against your standard positions.",
};

export default function PlaybookPage(): ReactNode {
  return <ToolPage tool="playbook" />;
}
