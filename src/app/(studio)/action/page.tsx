import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToolPage } from "@/components/studio/tool-page";

export const metadata: Metadata = {
  title: "Action Plan — LexClarity",
  description: "Obligations, deadlines, evidence and next steps for your matter.",
};

export default function ActionPage(): ReactNode {
  return <ToolPage tool="action" />;
}
